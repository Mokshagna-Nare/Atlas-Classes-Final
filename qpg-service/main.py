"""
Questions generator service for the Atlas Classes admin panel.

Runs the Question Paper Generator's logic (core/qpg_core.py, an exact
copy of the Streamlit app's core — see sync_core.py) behind a small
JSON API:

  GET  /health                 liveness check (no login needed)
  GET  /config                 options + which AI providers have keys
  GET  /models?provider=...    model list for a provider (server key)
  POST /generate/prepare       PDF -> pages, previews, detected figures
  POST /generate/page          one page -> generated questions
  POST /generate/finalize      cross-page duplicate review pass
  POST /extract/prepare        PDF / images -> pages to read
  POST /extract/page           one page -> transcribed questions
  POST /docx                   questions -> Word file (same format)

AI keys live only in this service's environment variables; the
browser never sees them. Every endpoint except /health requires a
logged-in Atlas user whose role is in QPG_ALLOWED_ROLES (admin).
"""

import base64
import hashlib
import io
import os
import pathlib
import sys
import threading
import time

import httpx
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field

sys.path.insert(0, str(pathlib.Path(__file__).parent / "core"))

import st_shim  # noqa: E402
import qpg_core as core  # noqa: E402

# ---------------------------------------------------------------------------
# SETTINGS (environment variables)
# ---------------------------------------------------------------------------
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
ALLOWED_ROLES = {
    role.strip().lower()
    for role in os.environ.get("QPG_ALLOWED_ROLES", "admin").split(",")
    if role.strip()
}
AUTH_DISABLED = os.environ.get("QPG_AUTH_DISABLED", "") == "1"
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("QPG_ALLOWED_ORIGINS", "*").split(",")
    if origin.strip()
]
DOC_DIR = pathlib.Path(os.environ.get("QPG_DOC_DIR", "/tmp/qpg-docs"))
DOC_TTL_SECONDS = 6 * 60 * 60
MAX_UPLOAD_BYTES = int(os.environ.get("QPG_MAX_UPLOAD_MB", "50")) * 1024 * 1024
PREVIEW_MAX_SIDE_PX = 900

if os.environ.get("OMNIROUTE_BASE_URL"):
    core.OMNIROUTE_BASE_URL = os.environ["OMNIROUTE_BASE_URL"]

# provider -> (API key variable, default model variable, fallback model)
PROVIDER_ENV = {
    "OmniRoute": ("OMNIROUTE_API_KEY", "OMNIROUTE_MODEL", "auto"),
    "Agent Router": ("AGENTROUTER_API_KEY", "AGENTROUTER_MODEL", ""),
    "Claude API": ("ANTHROPIC_API_KEY", "CLAUDE_MODEL", ""),
}

DOC_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Atlas Questions generator service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


# ---------------------------------------------------------------------------
# AUTH — only logged-in Atlas admins may use the service
# ---------------------------------------------------------------------------
_auth_cache = {}
_auth_lock = threading.Lock()
AUTH_CACHE_SECONDS = 300


def _lookup_role(user_id, token):
    url = f"{SUPABASE_URL}/rest/v1/users"
    params = {"id": f"eq.{user_id}", "select": "role"}
    attempts = [(SUPABASE_ANON_KEY, token)]

    if SUPABASE_SERVICE_ROLE_KEY:
        attempts.append((SUPABASE_SERVICE_ROLE_KEY, SUPABASE_SERVICE_ROLE_KEY))

    for api_key, bearer in attempts:
        try:
            response = httpx.get(
                url,
                params=params,
                headers={"apikey": api_key, "Authorization": f"Bearer {bearer}"},
                timeout=10,
            )
        except httpx.HTTPError:
            continue

        if response.status_code == 200 and response.json():
            return str(response.json()[0].get("role") or "").lower()

    return ""


def require_admin(authorization: str = Header(default="")):
    if AUTH_DISABLED:
        return

    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(500, "Service misconfigured: SUPABASE_URL / SUPABASE_ANON_KEY not set.")

    token = authorization[7:].strip() if authorization.lower().startswith("bearer ") else ""

    if not token:
        raise HTTPException(401, "Please log in to the admin panel again.")

    with _auth_lock:
        cached = _auth_cache.get(token)

    if cached and cached > time.time():
        return

    try:
        response = httpx.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={"apikey": SUPABASE_ANON_KEY, "Authorization": f"Bearer {token}"},
            timeout=10,
        )
    except httpx.HTTPError as error:
        raise HTTPException(503, f"Couldn't verify your login: {error}")

    if response.status_code != 200:
        raise HTTPException(401, "Your login has expired — log in to the admin panel again.")

    user_id = response.json().get("id")
    role = _lookup_role(user_id, token) if user_id else ""

    if role not in ALLOWED_ROLES:
        raise HTTPException(403, "Only admins can use the Questions generator.")

    with _auth_lock:
        _auth_cache[token] = time.time() + AUTH_CACHE_SECONDS


# ---------------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------------
def provider_key(provider):
    if provider not in PROVIDER_ENV:
        raise HTTPException(400, f"Unknown AI provider: {provider}")

    key = os.environ.get(PROVIDER_ENV[provider][0], "").strip()

    if not key:
        raise HTTPException(
            400,
            f"No API key is configured on the server for {provider}. Ask the "
            f"administrator to set {PROVIDER_ENV[provider][0]}.",
        )

    return key


def provider_client(provider, timeout_seconds):
    key = provider_key(provider)
    base_url = core.OMNIROUTE_BASE_URL if provider == "OmniRoute" else None
    return core.build_client(provider, key, base_url, timeout_seconds=timeout_seconds)


def data_url(data, mime):
    return f"data:{mime};base64,{base64.b64encode(data).decode('ascii')}"


def from_data_url(value):
    if not isinstance(value, str) or not value.startswith("data:") or "," not in value:
        return None, None

    header, payload = value.split(",", 1)
    mime = header[5:].split(";")[0] or "image/png"

    try:
        return base64.b64decode(payload), mime
    except Exception:
        return None, None


def small_preview(png_bytes):
    """Page preview as a compact JPEG data URL (for display only)."""

    if not png_bytes:
        return None

    from PIL import Image

    image = Image.open(io.BytesIO(png_bytes)).convert("RGB")
    image.thumbnail((PREVIEW_MAX_SIDE_PX, PREVIEW_MAX_SIDE_PX))
    buffer = io.BytesIO()
    image.save(buffer, "JPEG", quality=72, optimize=True)
    return data_url(buffer.getvalue(), "image/jpeg")


def cleanup_docs():
    cutoff = time.time() - DOC_TTL_SECONDS

    for path in DOC_DIR.glob("*"):
        try:
            if path.stat().st_mtime < cutoff:
                path.unlink()
        except OSError:
            pass


def store_doc(data):
    cleanup_docs()
    doc_id = hashlib.sha256(data).hexdigest()[:32]
    path = DOC_DIR / doc_id

    if not path.exists():
        path.write_bytes(data)
    else:
        path.touch()

    return doc_id


def load_doc(doc_id):
    if not doc_id or not doc_id.isalnum():
        raise HTTPException(400, "Invalid document id.")

    path = DOC_DIR / doc_id

    if not path.exists():
        # The client re-uploads the file and retries on this status.
        raise HTTPException(409, "Document expired on the server — re-upload needed.")

    path.touch()
    return path.read_bytes()


async def read_upload(upload):
    data = await upload.read()

    if not data:
        raise HTTPException(400, f"{upload.filename} is empty.")

    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, f"{upload.filename} is larger than {MAX_UPLOAD_BYTES // (1024 * 1024)} MB.")

    return data


def is_pdf(upload, data):
    return data[:5] == b"%PDF-" or (upload.filename or "").lower().endswith(".pdf")


def label_mode_code(label_mode):
    return core.FIGURE_LABEL_MODES.get(label_mode, label_mode if label_mode in ("hide", "letters") else "hide")


def size_preset_name(size_preset):
    return size_preset if size_preset in core.FIGURE_SIZE_PRESETS else core.DEFAULT_FIGURE_SIZE_PRESET


def figure_details(figure):
    if figure.get("markers"):
        return ", ".join(f"{letter} = {name}" for letter, name in figure["markers"][:4])

    return ", ".join(figure.get("parts", [])[:3])


def figure_to_json(figure):
    if not figure:
        return None

    return {
        "image": data_url(figure["image"], figure["mime"]),
        "mime": figure["mime"],
        "width_pt": figure.get("width_pt"),
        "height_pt": figure.get("height_pt"),
        "size_kb": figure.get("size_kb"),
    }


def figure_from_json(figure):
    if not isinstance(figure, dict):
        return None

    data, mime = from_data_url(figure.get("image"))

    if data is None:
        return None

    return {
        "image": data,
        "mime": mime,
        "width_pt": float(figure.get("width_pt") or 216),
        "height_pt": float(figure.get("height_pt") or 216),
    }


def question_to_json(question):
    result = {}

    for key, value in question.items():
        if key == "figure":
            result[key] = figure_to_json(value)
        elif isinstance(value, (str, int, float, bool, type(None), list, dict)):
            result[key] = value

    return result


def page_figures(pdf_bytes, page_number, label_mode, size_preset):
    all_figures = core.extract_all_page_source_images(
        pdf_bytes, label_mode_code(label_mode), size_preset_name(size_preset)
    )
    return all_figures.get(page_number, [])


# ---------------------------------------------------------------------------
# ENDPOINTS
# ---------------------------------------------------------------------------
@app.get("/health")
def health():
    return {"ok": True, "ocr": core.get_ocr_engine() is not None}


@app.get("/config", dependencies=[Depends(require_admin)])
def config():
    providers = []

    for name in core.PROVIDERS:
        key_var, model_var, fallback = PROVIDER_ENV[name]
        providers.append(
            {
                "name": name,
                "configured": bool(os.environ.get(key_var, "").strip()),
                "default_model": os.environ.get(model_var, fallback),
                "model_listing": name != "OmniRoute",
            }
        )

    return {
        "providers": providers,
        "subjects": core.SUBJECTS,
        "default_subject": "Biology",
        "exam_modes": core.EXAM_MODES,
        "default_exam_mode": core.EXAM_MODES[1],
        "question_types": core.QUESTION_TYPES,
        "difficulty_mixes": list(core.DIFFICULTY_MIXES),
        "bloom_levels": core.BLOOM_LEVELS,
        "plain_difficulties": core.PLAIN_DIFFICULTIES,
        "figure_size_presets": list(core.FIGURE_SIZE_PRESETS),
        "default_figure_size_preset": core.DEFAULT_FIGURE_SIZE_PRESET,
        "figure_label_modes": list(core.FIGURE_LABEL_MODES),
        "default_figure_label_mode": core.DEFAULT_FIGURE_LABEL_MODE,
        "extraction_methods": [
            {"label": label, "value": value} for label, value in core.EXTRACTION_METHODS.items()
        ],
        "max_pdf_pages": core.MAX_PDF_PAGES,
        "max_total_questions": core.MAX_TOTAL_QUESTIONS,
        "min_request_delay": core.MIN_REQUEST_DELAY,
        "numerical_option_text": core.NUMERICAL_OPTION_TEXT,
        "field_labels": core.FIELD_LABELS,
        "ocr_available": core.get_ocr_engine() is not None,
    }


@app.get("/models", dependencies=[Depends(require_admin)])
def models(provider: str):
    key = provider_key(provider)
    default = os.environ.get(PROVIDER_ENV[provider][1], PROVIDER_ENV[provider][2])

    try:
        if provider == "Claude API":
            listed = core.fetch_claude_models(key)
        elif provider == "Agent Router":
            listed = core.fetch_agentrouter_models(key)
        else:
            client = core.OpenAI(api_key=key, base_url=core.OMNIROUTE_BASE_URL, timeout=15, max_retries=0)
            listed = sorted({model.id for model in client.models.list().data if model.id})
    except Exception as error:
        return {"models": [default] if default else [], "default": default, "error": str(error)[:300]}

    if default and default not in listed:
        listed = [default] + listed

    return {"models": listed, "default": default or (listed[0] if listed else ""), "error": None}


# ----- Generate new questions ------------------------------------------------
@app.post("/generate/prepare", dependencies=[Depends(require_admin)])
async def generate_prepare(
    file: UploadFile = File(...),
    label_mode: str = Form(core.DEFAULT_FIGURE_LABEL_MODE),
    size_preset: str = Form(core.DEFAULT_FIGURE_SIZE_PRESET),
    previews: bool = Form(True),
):
    data = await read_upload(file)

    if not is_pdf(file, data):
        raise HTTPException(400, "Please upload a PDF file.")

    def work():
        try:
            pages = core.extract_pdf_pages(data)
        except Exception as error:
            raise HTTPException(400, f"Couldn't read this PDF: {error}")

        if len(pages) > core.MAX_PDF_PAGES:
            raise HTTPException(
                400,
                f"The maximum supported document size is {core.MAX_PDF_PAGES} pages. "
                f"This PDF has {len(pages)} pages.",
            )

        figures = core.extract_all_page_source_images(
            data, label_mode_code(label_mode), size_preset_name(size_preset)
        )
        page_previews = core.render_all_pdf_page_previews(data, zoom=1.0) if previews else {}

        return {
            "doc_id": store_doc(data),
            "file_name": file.filename or "source.pdf",
            "page_count": len(pages),
            "pages": [
                {
                    "page_number": page["page_number"],
                    "has_text": page["has_text"],
                    "chars": len(page["text"]),
                    "preview": small_preview(page_previews.get(page["page_number"])),
                    "figures": [
                        {
                            "index": index,
                            "image": data_url(figure["image"], figure["mime"]),
                            "size_kb": figure["size_kb"],
                            "details": figure_details(figure),
                        }
                        for index, figure in enumerate(figures.get(page["page_number"], []), start=1)
                    ],
                }
                for page in pages
            ],
        }

    from starlette.concurrency import run_in_threadpool

    return await run_in_threadpool(work)


class GeneratePageRequest(BaseModel):
    doc_id: str
    page_number: int
    count: int = Field(ge=1)
    subtopic: str
    figure_indexes: list[int] = []
    provider: str
    model: str
    exam_mode: str
    subject: str
    topic: str
    question_type: str
    difficulty_mix: str
    send_figure_images: bool = False
    label_mode: str = core.DEFAULT_FIGURE_LABEL_MODE
    size_preset: str = core.DEFAULT_FIGURE_SIZE_PRESET
    previous_questions: list = []
    previous_concepts: list = []


@app.post("/generate/page", dependencies=[Depends(require_admin)])
def generate_page(request: GeneratePageRequest):
    st_shim.reset_notices()
    pdf_bytes = load_doc(request.doc_id)
    pages = {page["page_number"]: page for page in core.extract_pdf_pages(pdf_bytes)}
    page = pages.get(request.page_number)

    if page is None:
        raise HTTPException(400, f"Page {request.page_number} doesn't exist in this PDF.")

    if request.exam_mode not in core.EXAM_MODES or request.subject not in core.SUBJECTS:
        raise HTTPException(400, "Unknown exam mode or subject.")

    if request.question_type not in core.QUESTION_TYPES or request.difficulty_mix not in core.DIFFICULTY_MIXES:
        raise HTTPException(400, "Unknown question type or difficulty mix.")

    available = page_figures(pdf_bytes, request.page_number, request.label_mode, request.size_preset)
    chosen = [available[index - 1] for index in request.figure_indexes if 1 <= index <= len(available)]
    count = max(int(request.count), len(chosen))

    if count > core.MAX_TOTAL_QUESTIONS:
        raise HTTPException(400, f"The maximum allowed is {core.MAX_TOTAL_QUESTIONS} questions per run.")

    previous_questions = list(request.previous_questions)
    previous_concepts = list(request.previous_concepts)
    result = {
        "page_number": request.page_number,
        "questions": [],
        "rejected": [],
        "missing_figures": [],
        "error": None,
        "fatal": False,
    }

    if not page["has_text"]:
        result["error"] = f"Page {request.page_number} has no extractable text and was skipped."
        result["rejected"] = ["No extractable text"]
    else:
        try:
            client = provider_client(request.provider, core.GENERATION_TIMEOUT_SECONDS)
            questions, rejected, missing = core.generate_questions_for_page(
                provider=request.provider,
                client=client,
                model=request.model.strip(),
                exam_mode=request.exam_mode,
                subject=request.subject,
                topic=request.topic.strip(),
                subtopic=request.subtopic.strip(),
                page_text=page["text"],
                number_of_questions=count,
                difficulty=core.DIFFICULTY_MIXES[request.difficulty_mix],
                question_type=request.question_type,
                figures=chosen,
                send_figure_images=request.send_figure_images,
                previous_questions=previous_questions,
                previous_concepts=previous_concepts,
            )
            result["questions"] = [question_to_json(question) for question in questions]
            result["rejected"] = [str(reason) for reason in rejected]
            result["missing_figures"] = [str(figure_id).replace("F", "") for figure_id in missing]
        except HTTPException:
            raise
        except core.HTMLResponseError as error:
            # Same for every remaining page (wrong base URL) — stop the run.
            result["error"] = f"Stopped after page {request.page_number}: {error}"
            result["fatal"] = True
        except Exception as error:
            explanation = core.explain_provider_error(
                error, sent_images=bool(request.send_figure_images and chosen)
            )
            result["error"] = f"Page {request.page_number} failed: {explanation}"
            result["rejected"] = [str(error)[:600]]

    result["previous_questions"] = previous_questions
    result["previous_concepts"] = previous_concepts
    result["notes"] = st_shim.notices()
    return result


class FinalizeRequest(BaseModel):
    results: list


@app.post("/generate/finalize", dependencies=[Depends(require_admin)])
def generate_finalize(request: FinalizeRequest):
    results, flagged = core.final_review_pass(request.results)
    return {"results": results, "flagged": flagged}


# ----- Extract existing questions ----------------------------------------------
@app.post("/extract/prepare", dependencies=[Depends(require_admin)])
async def extract_prepare(files: list[UploadFile] = File(...)):
    uploads = [(upload, await read_upload(upload)) for upload in files]

    def work():
        pages = []

        for upload, data in uploads:
            name = upload.filename or "upload"
            doc_id = store_doc(data)

            if is_pdf(upload, data):
                try:
                    text_pages = core.extract_pdf_pages(data)
                except Exception as error:
                    raise HTTPException(400, f"Couldn't read {name}: {error}")

                if len(text_pages) > core.MAX_PDF_PAGES:
                    raise HTTPException(
                        400,
                        f"The maximum supported document size is {core.MAX_PDF_PAGES} "
                        f"pages/images. {name} has {len(text_pages)} pages.",
                    )

                needs_image = {
                    page["page_number"]
                    for page in text_pages
                    if len(page["text"].strip()) < core.MIN_EXTRACT_TEXT_CHARS
                }
                previews = core.render_all_pdf_page_previews(data, zoom=2.5) if needs_image else {}

                for page in text_pages:
                    number = page["page_number"]
                    entry = {
                        "doc_id": doc_id,
                        "kind": "pdf",
                        "page_number": number,
                        "label": f"{name}, page {number}",
                    }

                    if number not in needs_image:
                        entry.update({"mode": "text", "page_text": page["text"], "preview": None})
                    elif previews.get(number):
                        entry.update({"mode": "image", "page_text": None, "preview": small_preview(previews[number])})
                    else:
                        continue

                    pages.append(entry)
            else:
                try:
                    image_bytes, _ = core.prepare_image_for_vision(data, upload.content_type or "image/jpeg")
                except Exception as error:
                    raise HTTPException(400, f"Couldn't open {name} as an image: {error}")

                pages.append(
                    {
                        "doc_id": doc_id,
                        "kind": "image",
                        "page_number": None,
                        "label": name,
                        "mode": "image",
                        "page_text": None,
                        "preview": small_preview(image_bytes),
                        "mime": upload.content_type or "image/jpeg",
                    }
                )

        if len(pages) > core.MAX_PDF_PAGES:
            raise HTTPException(
                400,
                f"The maximum supported document size is {core.MAX_PDF_PAGES} pages/images. "
                f"This upload has {len(pages)}.",
            )

        if not pages:
            raise HTTPException(400, "No readable pages/images were found in this upload.")

        names = [upload.filename or "upload" for upload, _ in uploads]
        return {
            "pages": pages,
            "source_name": names[0] if len(names) == 1 else f"{len(names)}_files",
        }

    from starlette.concurrency import run_in_threadpool

    return await run_in_threadpool(work)


class ExtractPageRequest(BaseModel):
    doc_id: str
    kind: str
    page_number: int | None = None
    label: str
    mode: str
    mime: str | None = None
    method: str = "ocr"
    provider: str | None = None
    model: str | None = None
    difficulty: str = "Medium"
    bloom_level: str = "Understand"


@app.post("/extract/page", dependencies=[Depends(require_admin)])
def extract_page(request: ExtractPageRequest):
    st_shim.reset_notices()
    data = load_doc(request.doc_id)
    page = {"label": request.label, "mode": request.mode}

    if request.kind == "pdf" and request.mode == "text":
        pages = {item["page_number"]: item for item in core.extract_pdf_pages(data)}
        source = pages.get(request.page_number)

        if source is None:
            raise HTTPException(400, "That page doesn't exist in the PDF.")

        page.update({"page_text": source["text"], "pdf_bytes": data, "page_number": request.page_number})
    elif request.kind == "pdf":
        rendered = core.render_all_pdf_page_previews(data, zoom=2.5).get(request.page_number)

        if not rendered:
            raise HTTPException(400, "That page couldn't be rendered.")

        page.update({"mode": "image", "image_bytes": rendered, "image_mime": "image/png"})
    else:
        image_bytes, image_mime = core.prepare_image_for_vision(data, request.mime or "image/jpeg")
        page.update({"mode": "image", "image_bytes": image_bytes, "image_mime": image_mime})

    result = {"label": request.label, "questions": [], "text_read": None, "error": None, "fatal": False}

    if request.method == "ocr":
        raw_questions, text_read, read_error = core.read_questions_without_ai(page)
        result["text_read"] = text_read

        if read_error:
            result["error"] = f"Couldn't read {request.label}: {read_error}"
            result["fatal"] = "isn't installed" in read_error
            return result
    else:
        sent_image = page.get("image_bytes") is not None

        try:
            client = provider_client(request.provider or "", core.EXTRACTION_TIMEOUT_SECONDS)
            raw_questions = core.extract_questions_from_page(
                request.provider,
                client,
                (request.model or "").strip(),
                request.label,
                image_png_bytes=page.get("image_bytes"),
                image_mime=page.get("image_mime", "image/png"),
                page_text=page.get("page_text"),
            )
        except HTTPException:
            raise
        except core.HTMLResponseError as error:
            result["error"] = f"Extraction stopped: {error}"
            result["fatal"] = True
            return result
        except Exception as error:
            explanation = core.explain_provider_error(error, sent_images=sent_image)
            result["error"] = f"Extraction failed on {request.label}: {explanation}"
            result["fatal"] = isinstance(error, core.ProviderTimeoutError) or explanation.startswith(
                "The selected model can't read images"
            )
            return result

    for raw_question in raw_questions:
        cleaned, _ = core.normalize_extracted_question(raw_question, request.difficulty, request.bloom_level)

        if cleaned is not None:
            result["questions"].append(cleaned)

    result["notes"] = st_shim.notices()
    return result


# ----- Word document -------------------------------------------------------------
class DocxRequest(BaseModel):
    mode: str  # "generate" | "extract"
    pages: list
    grade: str
    subject: str
    topic: str
    source_name: str


@app.post("/docx", dependencies=[Depends(require_admin)])
def docx(request: DocxRequest):
    base_name = (request.source_name or "source").rsplit(".", 1)[0]

    if request.mode == "generate":
        results = []

        for page in request.pages:
            questions = []

            for question in page.get("questions", []):
                question = dict(question)
                question["figure"] = figure_from_json(question.get("figure"))
                questions.append(question)

            results.append(
                {
                    "page_number": page.get("page_number"),
                    "subtopic": page.get("subtopic", ""),
                    "questions": questions,
                }
            )

        buffer = core.build_docx(
            results=results,
            grade=request.grade,
            subject=request.subject,
            topic=request.topic.strip(),
            source_name=request.source_name,
        )
        file_name = f"Generated_Question_Bank_{base_name}.docx"
    else:
        buffer = core.build_docx_from_extracted(
            pages=request.pages,
            grade=request.grade,
            subject=request.subject,
            topic=request.topic.strip(),
            source_name=request.source_name,
        )
        file_name = f"Extracted_Question_Bank_{base_name}.docx"

    safe_name = "".join(char if char.isalnum() or char in "._-" else "_" for char in file_name)
    return Response(
        content=buffer.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"'},
    )


# ----- Question bank (Atlas `mcqs` rows) -------------------------------------------
# Atlas's "question type" is a cognitive level; map Bloom's levels onto it.
BLOOM_TO_ATLAS_TYPE = {
    "remember": "Knowledge Based",
    "understand": "Understanding",
    "apply": "Application",
    "analyze": "Analytical",
    "analyse": "Analytical",
    "evaluate": "Analytical",
    "create": "Analytical",
}


def bank_text(value):
    """Plain text for the question bank: x^{2} -> x², H_{2}O -> H₂O."""

    text = core.render_exponents_as_unicode(str(value or ""))
    return core.strip_illegal_xml_chars(text).strip()


class BankFormatRequest(BaseModel):
    pages: list
    grade: str
    subject: str
    topic: str


@app.post("/bank-format", dependencies=[Depends(require_admin)])
def bank_format(request: BankFormatRequest):
    rows = []

    for page in request.pages:
        for question in page.get("questions", []):
            options = [bank_text(option) for option in (question.get("options") or [])]
            key = str(question.get("key") or "").strip()
            numerical = question.get("question_type") == "Numerical" or not options

            if numerical:
                answer = bank_text(key)
                options = []
            else:
                options = (options + ["", "", "", ""])[:4]
                answer = options[int(key) - 1] if key in {"1", "2", "3", "4"} else ""

            difficulty = str(question.get("difficulty") or "Medium").strip().capitalize()
            bloom = str(question.get("bloom_level") or "").strip().lower()
            flags = [
                str(flag)
                for flag in (question.get("review_flags") or [])
                if str(flag).strip()
            ]
            figure = question.get("figure") or {}

            rows.append(
                {
                    "question": bank_text(question.get("question")),
                    "options": options,
                    "answer": answer,
                    "explanation": bank_text(question.get("explanation")),
                    "grade": request.grade,
                    "subject": request.subject,
                    "topic": request.topic.strip(),
                    "sub_topic": str(page.get("subtopic") or "").strip(),
                    "question_type": BLOOM_TO_ATLAS_TYPE.get(bloom, "Understanding"),
                    "difficulty": difficulty if difficulty in core.PLAIN_DIFFICULTIES else "Medium",
                    "marks": 4,
                    "type": "Short Answer" if numerical else "Multiple Choice",
                    "imageUrl": figure.get("image") if isinstance(figure, dict) else None,
                    "review_notes": "; ".join(flags),
                }
            )

    return {"rows": rows}
