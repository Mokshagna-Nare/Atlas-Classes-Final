import os
import re
import shutil
import base64
import tempfile
import subprocess
from typing import List, Optional, Tuple
from urllib.parse import unquote

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from bs4 import BeautifulSoup
from docx import Document


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def file_to_data_url(path: str) -> Optional[str]:
    if not path or not os.path.exists(path):
        return None

    ext = os.path.splitext(path)[1].lower().replace(".", "")
    mime = {
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "gif": "image/gif",
        "svg": "image/svg+xml",
        "webp": "image/webp",
        "bmp": "image/bmp",
        "wmf": "image/wmf",
        "emf": "image/emf",
    }.get(ext, f"image/{ext}")

    with open(path, "rb") as f:
        encoded = base64.b64encode(f.read()).decode("utf-8")

    return f"data:{mime};base64,{encoded}"


def convert_wmf_emf_to_png(input_path: str, output_path: str) -> bool:
    ext = os.path.splitext(input_path)[1].lower()

    if ext not in [".wmf", ".emf"]:
        try:
            shutil.copy(input_path, output_path)
            return True
        except Exception:
            return False

    try:
        temp_dir = os.path.dirname(output_path)

        lo_cmd = [
            "libreoffice",
            "--headless",
            "--convert-to",
            "png",
            "--outdir",
            temp_dir,
            input_path,
        ]
        result = subprocess.run(lo_cmd, capture_output=True, text=True, timeout=20)

        converted_name = os.path.splitext(os.path.basename(input_path))[0] + ".png"
        converted_path = os.path.join(temp_dir, converted_name)

        if result.returncode == 0 and os.path.exists(converted_path):
            if converted_path != output_path:
                shutil.move(converted_path, output_path)
            return True

        magick_cmd = ["convert", input_path, output_path]
        result = subprocess.run(magick_cmd, capture_output=True, text=True, timeout=20)
        return result.returncode == 0 and os.path.exists(output_path)

    except Exception:
        return False


def extract_images_from_docx(docx_path: str, temp_dir: str) -> dict:
    image_map = {}

    try:
        doc = Document(docx_path)

        for rel_id, rel in doc.part.rels.items():
            if "image" not in rel.target_ref:
                continue

            try:
                img_part = rel.target_part
                img_bytes = img_part.blob
                content_type = img_part.content_type

                ext_map = {
                    "image/png": "png",
                    "image/jpeg": "jpg",
                    "image/gif": "gif",
                    "image/bmp": "bmp",
                    "image/x-wmf": "wmf",
                    "image/x-emf": "emf",
                    "image/emf": "emf",
                    "image/wmf": "wmf",
                }

                ext = ext_map.get(content_type, "png")
                raw_path = os.path.join(temp_dir, f"{rel_id}.{ext}")

                with open(raw_path, "wb") as f:
                    f.write(img_bytes)

                if ext in ["wmf", "emf"]:
                    png_path = os.path.join(temp_dir, f"{rel_id}.png")
                    ok = convert_wmf_emf_to_png(raw_path, png_path)
                    image_map[rel_id] = png_path if ok and os.path.exists(png_path) else raw_path
                else:
                    image_map[rel_id] = raw_path

            except Exception:
                continue

    except Exception:
        pass

    return image_map


def restore_fraction_spacing(text: str) -> str:
    if not isinstance(text, str) or not text.strip():
        return text

    text = text.replace("\u00a0", " ")
    text = re.sub(r"\s+", " ", text).strip()

    text = re.sub(r"(?<=\d)\s+(?=\d\s*[a-zA-Z]\b)", "/", text)
    text = re.sub(r"(?<=\d)\s+(?=\d\b)", "/", text)

    text = re.sub(r"-\s+(\d+)/(\d+)", r"-\1/\2", text)
    text = re.sub(r"\+\s+(\d+)/(\d+)", r"+\1/\2", text)

    text = re.sub(r"=\s*-\s*(\d+)/(\d+)", r"= -\1/\2", text)
    text = re.sub(r"=\s*(\d+)/(\d+)", r"= \1/\2", text)

    text = re.sub(r"\(\s*-\s*(\d+)/(\d+)", r"(-\1/\2", text)
    text = re.sub(r"\(\s*(\d+)/(\d+)", r"(\1/\2", text)

    text = re.sub(r"\s+", " ", text).strip()
    return text


def normalize_row_text_fields(row: dict) -> dict:
    if not isinstance(row, dict):
        return row

    if "question" in row:
        row["question"] = restore_fraction_spacing(row.get("question", ""))

    if "explanation" in row:
        row["explanation"] = restore_fraction_spacing(row.get("explanation", ""))

    if "answer" in row:
        row["answer"] = restore_fraction_spacing(row.get("answer", ""))

    if isinstance(row.get("options"), list):
        row["options"] = [
            restore_fraction_spacing(opt) if isinstance(opt, str) else opt
            for opt in row["options"]
        ]

    return row


def clean_key(raw: str) -> str:
    return (
        (raw or "")
        .replace("\xa0", " ")
        .strip()
        .lstrip("#")
        .rstrip("*")
        .strip()
        .lower()
    )


def safe_text(el) -> str:
    if el is None:
        return ""
    return re.sub(r"\s+", " ", el.get_text(" ", strip=True)).strip()


def parse_option_number(key: str) -> Optional[int]:
    m = re.search(r"option\s*(\d+)", key, re.I)
    if not m:
        return None
    return int(m.group(1)) - 1


def resolve_img_src_to_path(img_src: str, temp_dir: str) -> Optional[str]:
    if not img_src:
        return None

    if img_src.startswith("data:"):
        return img_src

    cleaned = img_src.strip()
    cleaned = cleaned.split("#")[0]
    cleaned = cleaned.split("?")[0]
    cleaned = unquote(cleaned)
    cleaned = cleaned.replace("\\", os.sep)

    candidates = [
        os.path.join(temp_dir, cleaned),
        os.path.join(temp_dir, os.path.basename(cleaned)),
    ]

    for path in candidates:
        if os.path.exists(path):
            return path

    return None


def img_src_to_payload(img_src: str, temp_dir: str) -> Optional[str]:
    if not img_src:
        return None

    if img_src.startswith("data:"):
        return img_src

    resolved = resolve_img_src_to_path(img_src, temp_dir)
    if not resolved:
        return None

    return file_to_data_url(resolved)


def extract_cell_content(cell, temp_dir: str) -> Tuple[str, List[str], Optional[str]]:
    text = safe_text(cell)

    img_payloads = []
    for img in cell.find_all("img"):
        src = img.get("src")
        payload = img_src_to_payload(src, temp_dir)
        if payload:
            img_payloads.append(payload)

    first_image = img_payloads[0] if img_payloads else None
    return text, img_payloads, first_image


def parse_html_tables(html: str, temp_dir: str) -> Tuple[List[dict], List[str]]:
    soup = BeautifulSoup(html, "html.parser")
    tables = soup.find_all("table")
    rows = []
    errors = []

    for table_index, table in enumerate(tables):
        item = {
            "grade": "",
            "subject": "",
            "topic": "",
            "sub_topic": "",
            "question_type": "",
            "difficulty": "Medium",
            "question": "",
            "inline_images": [],
            "imageUrl": None,
            "question_code": "",
            "marks": 4,
            "explanation": "",
            "options": [],
            "option_images": [],
            "option_inline_images": [],
            "answer": "",
            "answer_index": None,
        }

        correct_index = None

        for tr in table.find_all("tr"):
            cells = tr.find_all(["td", "th"])
            if len(cells) < 2:
                continue

            key = clean_key(safe_text(cells[0]))
            val, img_payloads, first_image = extract_cell_content(cells[1], temp_dir)

            if key == "grade":
                item["grade"] = val
            elif key == "subject":
                item["subject"] = val
            elif key == "topic":
                item["topic"] = val
            elif key in ["sub-topic", "sub topic", "sub_topic"]:
                item["sub_topic"] = val
            elif key in ["question skill type", "question type", "skill type"]:
                item["question_type"] = val
            elif key in ["question difficulty", "difficulty"]:
                item["difficulty"] = val or "Medium"
            elif key == "question":
                item["question"] = val
                item["inline_images"] = img_payloads
                if first_image:
                    item["imageUrl"] = first_image
            elif key == "explanation":
                item["explanation"] = val
            elif key in ["question id/code", "question id", "question_code"]:
                item["question_code"] = val
            elif key == "marks":
                try:
                    item["marks"] = int(val)
                except Exception:
                    item["marks"] = 4
            elif key.startswith("option"):
                idx = parse_option_number(key)
                if idx is not None:
                    while len(item["options"]) <= idx:
                        item["options"].append("")
                    while len(item["option_images"]) <= idx:
                        item["option_images"].append(None)
                    while len(item["option_inline_images"]) <= idx:
                        item["option_inline_images"].append([])

                    item["options"][idx] = val
                    item["option_images"][idx] = first_image
                    item["option_inline_images"][idx] = img_payloads
            elif key in ["key", "answer key", "correct option"]:
                try:
                    correct_index = int(val) - 1
                except Exception:
                    correct_index = None

        max_len = max(len(item["options"]), len(item["option_images"]), len(item["option_inline_images"]), 4)

        while len(item["options"]) < max_len:
            item["options"].append("")
        while len(item["option_images"]) < max_len:
            item["option_images"].append(None)
        while len(item["option_inline_images"]) < max_len:
            item["option_inline_images"].append([])

        if correct_index is not None and 0 <= correct_index < len(item["options"]):
            item["answer_index"] = correct_index
            item["answer"] = item["options"][correct_index]
        else:
            errors.append(f"Table {table_index + 1}: Invalid/missing Key (correct option number).")

        rows.append(normalize_row_text_fields(item))

    return rows, errors


def convert_docx_to_html(docx_path: str, temp_dir: str) -> str:
    cmd = [
        "libreoffice",
        "--headless",
        "--convert-to",
        "html",
        "--outdir",
        temp_dir,
        docx_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)

    if result.returncode != 0:
        raise RuntimeError(result.stderr or "LibreOffice HTML conversion failed")

    base_name = os.path.splitext(os.path.basename(docx_path))[0]
    html_path = os.path.join(temp_dir, f"{base_name}.html")

    if not os.path.exists(html_path):
        alt_candidates = [f for f in os.listdir(temp_dir) if f.lower().endswith(".html")]
        if not alt_candidates:
            raise RuntimeError("Converted HTML file not found")
        html_path = os.path.join(temp_dir, alt_candidates[0])

    with open(html_path, "r", encoding="utf-8", errors="ignore") as f:
        return f.read()


@app.get("/health")
def health():
    return {"ok": True, "version": "image-dataurl-fix-v2"}


@app.post("/parse-docx")
async def parse_docx(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".docx"):
        raise HTTPException(status_code=400, detail="Only .docx files are supported")

    with tempfile.TemporaryDirectory() as temp_dir:
        docx_path = os.path.join(temp_dir, file.filename)

        with open(docx_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        try:
            image_map = extract_images_from_docx(docx_path, temp_dir)
            html = convert_docx_to_html(docx_path, temp_dir)
            rows, errors = parse_html_tables(html, temp_dir)
            rows = [normalize_row_text_fields(row) for row in rows]

            return {
                "debug_version": "image-dataurl-fix-v2",
                "rows": rows,
                "errors": errors,
                "image_relations_found": len(image_map),
            }

        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)