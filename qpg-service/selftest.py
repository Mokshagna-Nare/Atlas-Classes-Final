"""
Build-time self-test. The Dockerfile runs it after installing the
libraries: if any library update (pypdf, PyMuPDF, OCR, python-docx...)
breaks reading PDFs, finding figures, OCR or the Word export, the BUILD
fails and the host keeps the previous working version online instead of
deploying a broken one.

Runs offline: no AI provider, no Supabase, no network.

    python selftest.py
"""

import io
import os
import sys
import time

os.environ.setdefault("QPG_AUTH_DISABLED", "1")
os.environ.setdefault("QPG_LOW_MEMORY", "0")
os.environ.setdefault("QPG_DOC_DIR", "/tmp/qpg-selftest-docs")
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "core"))

CHECKS = []


def check(name):
    def decorate(function):
        CHECKS.append((name, function))
        return function

    return decorate


def sample_pdf():
    """A small textbook-like page: text, a vector figure with a label, a picture."""

    import fitz
    from PIL import Image, ImageDraw

    document = fitz.open()
    page = document.new_page(width=595, height=842)
    y = 60

    for line in (
        "7.1 Animal tissues",
        "Epithelial tissue covers the body surface and lines body cavities.",
        "Simple squamous epithelium is made of a single thin layer of flattened cells.",
        "The dimensional formula of energy is [ML2T-2].",
    ):
        page.insert_text((50, y), line, fontsize=11)
        y += 18

    shape = page.new_shape()

    for i in range(4):
        shape.draw_rect(fitz.Rect(80 + i * 40, 200, 118 + i * 40, 240))
        shape.draw_circle(fitz.Point(99 + i * 40, 220), 6)

    shape.finish(color=(0, 0, 0), fill=(0.85, 0.85, 0.85), width=1)
    shape.draw_line(fitz.Point(240, 220), fitz.Point(280, 220))
    shape.finish(color=(0, 0, 0), width=0.8)
    shape.commit()
    page.insert_text((284, 224), "Nucleus", fontsize=9)
    page.insert_text((90, 265), "Figure 7.1 Squamous epithelium", fontsize=9)

    picture = Image.new("RGB", (300, 200), "white")
    draw = ImageDraw.Draw(picture)

    for i in range(5):
        draw.ellipse((20 + i * 55, 60, 70 + i * 55, 140), outline="black", width=3, fill=(220, 180, 180))

    buffer = io.BytesIO()
    picture.save(buffer, "PNG")
    page.insert_image(fitz.Rect(330, 300, 530, 433), stream=buffer.getvalue())
    page.insert_text((350, 450), "Figure 7.2 Cuboidal epithelium", fontsize=9)
    return document.tobytes()


def sample_question_image():
    """A clean question screenshot for the OCR check."""

    from PIL import Image, ImageDraw, ImageFont

    image = Image.new("RGB", (1100, 260), "white")
    draw = ImageDraw.Draw(image)

    try:
        font = ImageFont.truetype("DejaVuSans.ttf", 26)
    except OSError:
        font = ImageFont.load_default()

    lines = [
        "1. Which tissue lines the air sacs of the lungs?",
        "(1) Squamous epithelium",
        "(2) Cuboidal epithelium",
        "(3) Columnar epithelium",
        "(4) Ciliated epithelium",
    ]

    for row, text in enumerate(lines):
        draw.text((30, 20 + row * 46), text, font=font, fill="black")

    buffer = io.BytesIO()
    image.save(buffer, "PNG")
    return buffer.getvalue()


@check("app loads (all libraries import)")
def _load():
    __import__("main")  # imports qpg_core, PyMuPDF, pypdf, OCR, docx, AI SDKs


@check("PDF text is read")
def _pdf_text():
    import qpg_core as core

    pages = core.extract_pdf_pages(sample_pdf())
    assert len(pages) == 1 and pages[0]["has_text"], pages
    assert "Epithelial tissue" in pages[0]["text"], pages[0]["text"][:200]


@check("PDF with superscripts/subscripts is read")
def _pdf_scripts():
    import qpg_core as core

    text = core.pdf_page_text_with_scripts(sample_pdf(), 1)
    assert "Epithelial tissue" in text, text[:200]


@check("figures are detected, cleaned and encoded")
def _figures():
    import qpg_core as core

    figures = core.extract_all_page_source_images(sample_pdf(), "hide", core.DEFAULT_FIGURE_SIZE_PRESET)
    found = figures.get(1, [])
    assert len(found) >= 2, f"expected 2 figures, found {len(found)}"
    assert all(figure["image"] and figure["size_kb"] > 0 for figure in found)


@check("page previews render")
def _previews():
    import qpg_core as core

    previews = core.render_all_pdf_page_previews(sample_pdf(), zoom=1.0)
    assert previews.get(1), "no preview rendered"


@check("built-in OCR reads an image and the questions are recognised")
def _ocr():
    import qpg_core as core

    text, error = core.ocr_image_to_text(sample_question_image())
    assert not error, error
    questions = core.parse_questions_from_text(text)
    assert questions, f"no question recognised in OCR text: {text[:300]!r}"
    assert len(questions[0]["options"]) == 4, questions[0]


@check("Word file is built (generated + extracted)")
def _docx():
    import qpg_core as core
    from docx import Document

    figure = core.extract_all_page_source_images(sample_pdf(), "hide", core.DEFAULT_FIGURE_SIZE_PRESET)[1][0]
    question = {
        "question_type": "MCQ",
        "question": "Identify the tissue shown in the picture. x^{2} H_{2}O",
        "options": ["Squamous", "Cuboidal", "Columnar", "Ciliated"],
        "key": "1",
        "difficulty": "Easy",
        "bloom_level": "Understand",
        "explanation": "It is a single thin layer of flat cells.",
        "review_flags": [],
        "figure": figure,
    }
    generated = core.build_docx(
        results=[{"page_number": 1, "subtopic": "Epithelium", "questions": [question]}],
        grade="11", subject="Biology", topic="Tissues", source_name="selftest.pdf",
    ).getvalue()
    document = Document(io.BytesIO(generated))
    assert len(document.tables) == 1
    assert document.tables[0].cell(7, 1)._tc.xpath(".//pic:pic"), "figure missing from #Question*"

    extracted = core.build_docx_from_extracted(
        pages=[{"label": "page 1", "subtopic": "Epithelium", "questions": [dict(question, figure=None)]}],
        grade="11", subject="Biology", topic="Tissues", source_name="selftest.png",
    ).getvalue()
    assert len(Document(io.BytesIO(extracted)).tables) == 1


@check("review checks: run-together words, structure, missing questions, page crops")
def _review_checks():
    import ocr_figures
    import text_checks
    from PIL import Image, ImageDraw

    fixed, _ = text_checks.fix_joined_words("formed by theprocess of packagingin under acidicpH")
    assert fixed == "formed by the process of packaging in under acidic pH", fixed
    kept, changes = text_checks.fix_joined_words("Lysosomes collenchyma Hasselbalch NaOH Avogadro")
    assert not changes, changes
    question = {"question": "Which is a plant tissue?", "options": ["Xylem", "Neuron", "Cartilage", ""], "question_type": "MCQ"}
    assert any("3 option" in check for check in text_checks.question_checks(question))
    questions = [{"question": "First question here?", "options": []}, {"question": "Third question here?", "options": []}]
    page = text_checks.page_checks(questions, "1. First question here?\n3. Third question here?")
    assert any("Question 2 not found" in check for check in page), page
    image = Image.new("RGB", (400, 200), "white")
    ImageDraw.Draw(image).text((10, 10), "1. First question here?", fill="black")
    boxes = [(10, 10, 200, 22, "1. First question here?"), (10, 110, 200, 122, "3. Third question here?")]
    assert ocr_figures.attach_source_crops(questions, image, boxes) == 2
    assert questions[0]["source_crop"].startswith("data:image/jpeg;base64,")


@check("unavailable AI models fail fast (no retries, quick stop)")
def _provider_fast_fail():
    import main

    unavailable = RuntimeError("Error code: 400 - [400]: Upstream request failed: Model is unavailable.")
    assert main.is_setup_error(unavailable)
    assert not main.core.is_retryable_error(unavailable)
    assert main.core.is_retryable_error(RuntimeError("503 overloaded"))
    original = main.working_models
    main.working_models = lambda provider, exclude=(): []

    try:
        def broken(model):
            raise unavailable

        try:
            main.run_with_model_fallback("SelfTest", "auto", broken, [])
            raise AssertionError("expected ProviderUnavailable")
        except main.ProviderUnavailable:
            pass

        started = time.time()

        try:
            main.run_with_model_fallback("SelfTest", "auto", broken, [])
        except main.ProviderUnavailable:
            assert time.time() - started < 1
    finally:
        main.working_models = original
        main._provider_down.pop("SelfTest", None)


@check("service endpoints answer")
def _endpoints():
    from fastapi.testclient import TestClient

    import main

    client = TestClient(main.app)
    assert client.get("/health").json()["ok"] is True
    config = client.get("/config").json()
    assert config["subjects"] and config["field_labels"]

    response = client.post(
        "/generate/prepare",
        files={"file": ("selftest.pdf", sample_pdf(), "application/pdf")},
        data={"previews": "true"},
    )
    assert response.status_code == 200, response.text[:300]
    page = response.json()["pages"][0]
    assert page["has_text"] and len(page["figures"]) >= 2, page

    response = client.post("/extract/prepare", files=[("files", ("q.png", sample_question_image(), "image/png"))])
    assert response.status_code == 200, response.text[:300]
    source = response.json()["pages"][0]
    response = client.post(
        "/extract/page",
        json={key: source.get(key) for key in ("doc_id", "kind", "page_number", "label", "mode", "mime")} | {"method": "ocr"},
    )
    assert response.status_code == 200 and response.json()["questions"], response.text[:300]


def main():
    failures = 0

    for name, function in CHECKS:
        started = time.time()

        try:
            function()
        except Exception as error:  # noqa: BLE001 — report every failure
            failures += 1
            print(f"FAIL  {name}: {type(error).__name__}: {error}", flush=True)
        else:
            print(f"ok    {name} ({time.time() - started:.1f}s)", flush=True)

    if failures:
        print(f"\nSELF-TEST FAILED: {failures} check(s). Not deploying this build.", flush=True)
        sys.exit(1)

    print("\nSelf-test passed.", flush=True)


if __name__ == "__main__":
    main()
