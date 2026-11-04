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
import contextlib
import ctypes
import gc
import hashlib
import importlib.util
import io
import json
import multiprocessing
import os
import pathlib
import sys
import threading
import time
from collections import OrderedDict

import httpx
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field

sys.path.insert(0, str(pathlib.Path(__file__).parent / "core"))


def _memory_limit_bytes():
    for path in ("/sys/fs/cgroup/memory.max", "/sys/fs/cgroup/memory/memory.limit_in_bytes"):
        try:
            value = pathlib.Path(path).read_text().strip()
        except OSError:
            continue
        if value.isdigit():
            return int(value)
    return None


# Low-memory mode (for small servers, e.g. 512 MB): leaner OCR settings,
# smaller caches, and one heavy job at a time. "auto" turns it on when
# the container has 1 GB of memory or less.
_low_memory_setting = os.environ.get("QPG_LOW_MEMORY", "auto").strip().lower()
if _low_memory_setting == "auto":
    _limit = _memory_limit_bytes()
    LOW_MEMORY = _limit is not None and _limit <= 1100 * 1024 * 1024
else:
    LOW_MEMORY = _low_memory_setting in ("1", "true", "yes", "on")

if LOW_MEMORY:
    os.environ.setdefault("QPG_CACHE_ENTRIES", "1")

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
# Match the admin panel's two-step verification: only sessions that passed
# it (Supabase "aal2") may use the service.
REQUIRE_MFA = os.environ.get("QPG_REQUIRE_MFA", "") == "1"
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

if LOW_MEMORY:
    # Skip the very large zoomed OCR re-reads; those dominate memory use.
    # Small images (question screenshots) still get the extra passes that
    # recover thin minus signs; full scanned pages get one careful pass.
    core.OCR_MAX_PASS_SIDE_PX = 1800

    @st_shim.cache_resource
    def _lean_ocr_engine():
        try:
            from rapidocr import RapidOCR

            return RapidOCR(
                params={
                    "Global.log_level": "error",
                    "Global.use_cls": False,
                    "Global.max_side_len": 1200,
                    "Det.limit_side_len": 400,
                    "Rec.rec_batch_num": 3,
                    "EngineConfig.onnxruntime.intra_op_num_threads": 1,
                    "EngineConfig.onnxruntime.inter_op_num_threads": 1,
                }
            )
        except Exception:
            return None

    core.get_ocr_engine = _lean_ocr_engine

# One memory-heavy job (PDF analysis, OCR, Word export) at a time on
# small servers, so two admins can't double the peak together.
_heavy_lock = threading.RLock() if LOW_MEMORY else None


def heavy_job():
    return _heavy_lock if _heavy_lock is not None else contextlib.nullcontext()


def locked(function):
    def run():
        with heavy_job():
            return function()

    return run


try:
    _libc = ctypes.CDLL("libc.so.6")
except OSError:
    _libc = None

CHILD_TIMEOUT_SECONDS = 600  # small free-tier CPUs are slow
OUT_OF_MEMORY_MESSAGE = (
    "The server ran out of memory on this step. Try a smaller file (fewer "
    "pages, or a cropped image), use the AI method for scanned pages, or "
    "upgrade the Questions generator server to 2 GB RAM."
)
STRIP_TARGET_HEIGHT_PX = 650
STRIP_MIN_WIDTH_PX = 1601  # keeps strips at their own resolution (no 2x upscale)


class IsolatedJobFailed(RuntimeError):
    """A child job was stopped (out of memory or too slow)."""


def _child_entry(connection, function, args):
    # Fresh locks: another thread may have held these at fork time.
    st_shim._cache_lock = threading.Lock()
    gc.disable()  # short-lived; GC passes would copy the parent's pages

    try:
        connection.send(("ok", function(*args)))
    except HTTPException as error:
        connection.send(("http", (error.status_code, str(error.detail))))
    except BaseException as error:  # noqa: BLE001 — report anything back
        connection.send(("error", f"{type(error).__name__}: {error}"[:600]))
    finally:
        connection.close()


def isolated(function, *args):
    """
    Runs function(*args). On small servers it runs in a short-lived child
    process: the PDF engine and OCR give all their memory back when the
    child ends (so nothing builds up between requests), and if one job is
    too big for the server only the child is stopped — the service stays
    up and the admin gets a clear message.
    """

    if not LOW_MEMORY:
        return function(*args)

    gc.collect()

    if _libc is not None:
        _libc.malloc_trim(0)

    gc.freeze()
    context = multiprocessing.get_context("fork")
    receiver, sender = context.Pipe(duplex=False)
    process = context.Process(target=_child_entry, args=(sender, function, args), daemon=True)
    process.start()
    sender.close()
    result = None

    try:
        if receiver.poll(CHILD_TIMEOUT_SECONDS):
            result = receiver.recv()
    except (EOFError, OSError):
        result = None
    finally:
        receiver.close()
        process.join(5)

        if process.is_alive():
            process.kill()
            process.join()

        gc.unfreeze()

    if result is None:
        raise IsolatedJobFailed(OUT_OF_MEMORY_MESSAGE)

    status, value = result

    if status == "http":
        raise HTTPException(*value)

    if status == "error":
        raise RuntimeError(value)

    return value


def _page_strips(image_bytes):
    """
    A tall page split into horizontal strips at blank gaps between text
    lines, so each OCR pass stays small. Short images come back whole.
    """

    from PIL import Image, ImageOps
    import numpy as np

    prepared, _ = core.prepare_image_for_vision(image_bytes)
    image = Image.open(io.BytesIO(prepared)).convert("L")

    if np.asarray(image).mean() < 128:
        image = ImageOps.invert(image)

    if image.height <= STRIP_TARGET_HEIGHT_PX * 1.4:
        return [prepared]

    ink = (np.asarray(image) < 160).sum(axis=1)
    cuts = [0]

    while image.height - cuts[-1] > STRIP_TARGET_HEIGHT_PX * 1.4:
        target = cuts[-1] + STRIP_TARGET_HEIGHT_PX
        low, high = target - 150, min(image.height - 1, target + 150)
        cuts.append(low + int(np.argmin(ink[low:high])))

    cuts.append(image.height)
    strips = []

    for top, bottom in zip(cuts, cuts[1:]):
        strip = image.crop((0, top, image.width, bottom))

        if strip.width < STRIP_MIN_WIDTH_PX:
            padded = Image.new("L", (STRIP_MIN_WIDTH_PX, strip.height), 255)
            padded.paste(strip, (0, 0))
            strip = padded

        buffer = io.BytesIO()
        strip.save(buffer, "PNG")
        strips.append(buffer.getvalue())

    return strips


def _read_image_page_in_strips(page):
    texts = []

    for strip in _page_strips(page["image_bytes"]):
        text, error = core.ocr_image_to_text(strip)

        if error:
            return [], "", error

        texts.append(text)
        gc.collect()

    text = "\n".join(part for part in texts if part.strip())
    return core.parse_questions_from_text(text), text, None


app = FastAPI(title="Atlas Questions generator service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


@app.middleware("http")
async def release_memory(request, call_next):
    """Hands freed memory back to the system after every request."""

    response = await call_next(request)
    gc.collect()

    if _libc is not None:
        try:
            _libc.malloc_trim(0)
        except Exception:
            pass

    return response


# ---------------------------------------------------------------------------
# AUTH — only logged-in Atlas admins may use the service
# ---------------------------------------------------------------------------
_auth_cache = {}
_auth_lock = threading.Lock()
AUTH_CACHE_SECONDS = 300


def _token_claims(token):
    """Claims of a token Supabase has just accepted (so they're genuine)."""

    try:
        payload = token.split(".")[1]
        payload += "=" * (-len(payload) % 4)
        return json.loads(base64.urlsafe_b64decode(payload))
    except Exception:
        return {}


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

    if REQUIRE_MFA and _token_claims(token).get("aal") != "aal2":
        raise HTTPException(403, "Finish two-step verification in the admin panel, then try again.")
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


def render_page_png(pdf_bytes, page_number, zoom):
    """One PDF page as PNG (instead of rendering the whole document)."""

    document = core.fitz.open(stream=pdf_bytes, filetype="pdf")

    try:
        page = document.load_page(page_number - 1)
        return page.get_pixmap(matrix=core.fitz.Matrix(zoom, zoom), alpha=False).tobytes("png")
    except Exception:
        return None
    finally:
        document.close()


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


# ---------------------------------------------------------------------------
# PDF ANALYSIS (text + figures), cached as plain data in the main process
# ---------------------------------------------------------------------------
_analysis_cache = OrderedDict()
_analysis_lock = threading.Lock()
ANALYSIS_CACHE_ENTRIES = 2 if LOW_MEMORY else 8


def _analyse_pdf(pdf_bytes, label_mode, size_preset):
    try:
        pages = core.extract_pdf_pages(pdf_bytes)
    except Exception as error:
        raise HTTPException(400, f"Couldn't read this PDF: {error}")

    if len(pages) > core.MAX_PDF_PAGES:
        raise HTTPException(
            400,
            f"The maximum supported document size is {core.MAX_PDF_PAGES} pages. "
            f"This PDF has {len(pages)} pages.",
        )

    figures = core.extract_all_page_source_images(pdf_bytes, label_mode, size_preset)
    return {"pages": pages, "figures": figures}


def pdf_analysis(doc_id, pdf_bytes, label_mode, size_preset):
    """{"pages": [...], "figures": {page_number: [figure, ...]}} for a PDF."""

    key = (doc_id, label_mode_code(label_mode), size_preset_name(size_preset))

    with _analysis_lock:
        if key in _analysis_cache:
            _analysis_cache.move_to_end(key)
            return _analysis_cache[key]

    with heavy_job():
        try:
            analysis = isolated(_analyse_pdf, pdf_bytes, key[1], key[2])
        except IsolatedJobFailed as error:
            raise HTTPException(503, str(error))

    with _analysis_lock:
        _analysis_cache[key] = analysis

        while len(_analysis_cache) > ANALYSIS_CACHE_ENTRIES:
            _analysis_cache.popitem(last=False)

    return analysis


def _preview_urls(pdf_bytes):
    previews = core.render_all_pdf_page_previews(pdf_bytes, zoom=1.0)
    return {number: small_preview(png) for number, png in previews.items()}


# ---------------------------------------------------------------------------
# ENDPOINTS
# ---------------------------------------------------------------------------
def ocr_available():
    if LOW_MEMORY:
        # Don't load the OCR models into the main process on small servers.
        return importlib.util.find_spec("rapidocr") is not None

    return core.get_ocr_engine() is not None


@app.get("/health")
def health():
    return {"ok": True, "ocr": ocr_available(), "low_memory": LOW_MEMORY}


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
        "ocr_available": ocr_available(),
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
        doc_id = store_doc(data)
        analysis = pdf_analysis(doc_id, data, label_mode, size_preset)
        figures = analysis["figures"]
        page_previews = {}

        if previews:
            try:
                with heavy_job():
                    page_previews = isolated(_preview_urls, data)
            except IsolatedJobFailed:
                page_previews = {}  # previews are only a visual aid

        return {
            "doc_id": doc_id,
            "file_name": file.filename or "source.pdf",
            "page_count": len(analysis["pages"]),
            "pages": [
                {
                    "page_number": page["page_number"],
                    "has_text": page["has_text"],
                    "chars": len(page["text"]),
                    "preview": page_previews.get(page["page_number"]),
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
                for page in analysis["pages"]
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
    analysis = pdf_analysis(request.doc_id, pdf_bytes, request.label_mode, request.size_preset)
    pages = {page["page_number"]: page for page in analysis["pages"]}
    page = pages.get(request.page_number)

    if page is None:
        raise HTTPException(400, f"Page {request.page_number} doesn't exist in this PDF.")

    if request.exam_mode not in core.EXAM_MODES or request.subject not in core.SUBJECTS:
        raise HTTPException(400, "Unknown exam mode or subject.")

    if request.question_type not in core.QUESTION_TYPES or request.difficulty_mix not in core.DIFFICULTY_MIXES:
        raise HTTPException(400, "Unknown question type or difficulty mix.")

    available = analysis["figures"].get(request.page_number, [])
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
def _pdf_overview(data, name, doc_id):
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

    entries = []

    for page in text_pages:
        number = page["page_number"]
        entry = {"doc_id": doc_id, "kind": "pdf", "page_number": number, "label": f"{name}, page {number}"}

        if len(page["text"].strip()) >= core.MIN_EXTRACT_TEXT_CHARS:
            entry.update({"mode": "text", "page_text": page["text"], "preview": None})
        else:
            # A scanned page: read as an image (shown here as a preview).
            preview = render_page_png(data, number, 1.0)

            if not preview:
                continue

            entry.update({"mode": "image", "page_text": None, "preview": small_preview(preview)})

        entries.append(entry)

    return entries


def _image_overview(data, name, doc_id, mime):
    try:
        image_bytes, _ = core.prepare_image_for_vision(data, mime)
    except Exception as error:
        raise HTTPException(400, f"Couldn't open {name} as an image: {error}")

    return {
        "doc_id": doc_id,
        "kind": "image",
        "page_number": None,
        "label": name,
        "mode": "image",
        "page_text": None,
        "preview": small_preview(image_bytes),
        "mime": mime,
    }


def _build_page(data, kind, mode, page_number, label, mime):
    """The page dict the Streamlit app's extraction functions expect."""

    page = {"label": label, "mode": mode}

    if kind == "pdf" and mode == "text":
        pages = {item["page_number"]: item for item in core.extract_pdf_pages(data)}
        source = pages.get(page_number)

        if source is None:
            raise HTTPException(400, "That page doesn't exist in the PDF.")

        page.update({"page_text": source["text"], "pdf_bytes": data, "page_number": page_number})
    elif kind == "pdf":
        # Same 2.5x zoom the Streamlit app uses for scanned pages.
        rendered = render_page_png(data, page_number, 2.5)

        if not rendered:
            raise HTTPException(400, "That page couldn't be rendered.")

        page.update({"mode": "image", "image_bytes": rendered, "image_mime": "image/png"})
    else:
        image_bytes, image_mime = core.prepare_image_for_vision(data, mime or "image/jpeg")
        page.update({"mode": "image", "image_bytes": image_bytes, "image_mime": image_mime})

    return page


def _page_for_ai(*args):
    page = _build_page(*args)
    page.pop("pdf_bytes", None)
    return page


def _ocr_page(*args):
    page = _build_page(*args)

    if LOW_MEMORY and page["mode"] == "image":
        return _read_image_page_in_strips(page)

    return core.read_questions_without_ai(page)


@app.post("/extract/prepare", dependencies=[Depends(require_admin)])
async def extract_prepare(files: list[UploadFile] = File(...)):
    uploads = [(upload, await read_upload(upload)) for upload in files]

    def work():
        pages = []

        for upload, data in uploads:
            name = upload.filename or "upload"
            doc_id = store_doc(data)

            try:
                with heavy_job():
                    if is_pdf(upload, data):
                        pages.extend(isolated(_pdf_overview, data, name, doc_id))
                    else:
                        mime = upload.content_type or "image/jpeg"
                        pages.append(isolated(_image_overview, data, name, doc_id, mime))
            except IsolatedJobFailed as error:
                raise HTTPException(503, f"{name}: {error}")

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

    return await run_in_threadpool(locked(work))


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
    page_args = (data, request.kind, request.mode, request.page_number, request.label, request.mime)
    result = {"label": request.label, "questions": [], "text_read": None, "error": None, "fatal": False}

    if request.method == "ocr":
        try:
            with heavy_job():
                raw_questions, text_read, read_error = isolated(_ocr_page, *page_args)
        except (IsolatedJobFailed, RuntimeError) as error:
            raw_questions, text_read, read_error = [], "", str(error)

        result["text_read"] = text_read

        if read_error:
            result["error"] = f"Couldn't read {request.label}: {read_error}"
            result["fatal"] = "isn't installed" in read_error
            return result
    else:
        try:
            with heavy_job():
                page = isolated(_page_for_ai, *page_args)
        except IsolatedJobFailed as error:
            result["error"] = f"Couldn't prepare {request.label}: {error}"
            return result

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


def _docx_bytes(mode, pages, grade, subject, topic, source_name):
    if mode == "generate":
        results = []

        for page in pages:
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

        buffer = core.build_docx(results=results, grade=grade, subject=subject, topic=topic, source_name=source_name)
    else:
        buffer = core.build_docx_from_extracted(
            pages=pages, grade=grade, subject=subject, topic=topic, source_name=source_name
        )

    return buffer.getvalue()


@app.post("/docx", dependencies=[Depends(require_admin)])
def docx(request: DocxRequest):
    base_name = (request.source_name or "source").rsplit(".", 1)[0]
    prefix = "Generated" if request.mode == "generate" else "Extracted"
    file_name = f"{prefix}_Question_Bank_{base_name}.docx"

    try:
        with heavy_job():
            content = isolated(
                _docx_bytes,
                request.mode,
                request.pages,
                request.grade,
                request.subject,
                request.topic.strip(),
                request.source_name,
            )
    except IsolatedJobFailed as error:
        raise HTTPException(503, str(error))

    safe_name = "".join(char if char.isalnum() or char in "._-" else "_" for char in file_name)
    return Response(
        content=content,
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
