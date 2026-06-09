import os
import re
import shutil
import base64
import tempfile
from typing import List, Optional, Tuple
from zipfile import ZipFile

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from docx import Document
from docx.oxml.ns import qn


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"
V_NS = "urn:schemas-microsoft-com:vml"


def bytes_to_data_url(blob: bytes, ext: str) -> str:
    ext = (ext or "png").lower().replace(".", "")
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
        "bin": "application/octet-stream",
    }.get(ext, f"image/{ext}")

    encoded = base64.b64encode(blob).decode("utf-8")
    return f"data:{mime};base64,{encoded}"


def restore_fraction_spacing(text: str) -> str:
    if not isinstance(text, str) or not text.strip():
        return text

    text = text.replace("\u00a0", " ")
    text = re.sub(r"\s+", " ", text).strip()

    text = re.sub(r"(?<=\d)\s+(?=\d\s*[a-zA-Z(]\b)", "/", text)
    text = re.sub(r"(?<=\d)\s+(?=\d\b)", "/", text)

    text = re.sub(r"-\s+(\d+)/(\d+)", r"-\1/\2", text)
    text = re.sub(r"\+\s+(\d+)/(\d+)", r"+\1/\2", text)
    text = re.sub(r"=\s*-\s*(\d+)/(\d+)", r"= -\1/\2", text)
    text = re.sub(r"=\s*(\d+)/(\d+)", r"= \1/\2", text)
    text = re.sub(r"\(\s*-\s*(\d+)/(\d+)", r"(-\1/\2", text)
    text = re.sub(r"\(\s*(\d+)/(\d+)", r"(\1/\2", text)

    return re.sub(r"\s+", " ", text).strip()


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


def parse_option_number(key: str) -> Optional[int]:
    m = re.search(r"option\s*(\d+)", key, re.I)
    if not m:
        return None
    return int(m.group(1)) - 1


def build_docx_image_maps(docx_path: str) -> Tuple[dict, dict]:
    rid_to_data_url = {}
    target_to_data_url = {}

    with ZipFile(docx_path, "r") as z:
        names = set(z.namelist())
        media_files = [n for n in names if n.startswith("word/media/")]

        for media_path in media_files:
            ext = os.path.splitext(media_path)[1].replace(".", "").lower() or "png"
            blob = z.read(media_path)
            data_url = bytes_to_data_url(blob, ext)
            target_to_data_url[media_path] = data_url
            target_to_data_url[media_path.replace("word/", "")] = data_url
            target_to_data_url[os.path.basename(media_path)] = data_url

    doc = Document(docx_path)
    for rel_id, rel in doc.part.rels.items():
        try:
            if "image" in rel.reltype:
                part = rel.target_part
                ext = os.path.splitext(part.partname)[1].replace(".", "").lower() or "png"
                blob = part.blob
                rid_to_data_url[rel_id] = bytes_to_data_url(blob, ext)
        except Exception:
            continue

    return rid_to_data_url, target_to_data_url


def extract_run_images(run, rid_to_data_url: dict) -> List[str]:
    images = []

    try:
        blips = run._element.xpath(".//*[local-name()='blip']")
        for blip in blips:
            rid = blip.get(f"{{{R_NS}}}embed")
            if rid and rid in rid_to_data_url:
                images.append(rid_to_data_url[rid])
    except Exception:
        pass

    try:
        imagedata_nodes = run._element.xpath(".//*[local-name()='imagedata']")
        for node in imagedata_nodes:
            rid = node.get(f"{{{R_NS}}}id")
            if rid and rid in rid_to_data_url:
                images.append(rid_to_data_url[rid])
    except Exception:
        pass

    deduped = []
    seen = set()
    for img in images:
        if img not in seen:
            seen.add(img)
            deduped.append(img)
    return deduped


def extract_cell_content(cell, rid_to_data_url: dict) -> Tuple[str, List[str], bool]:
    text_parts: List[str] = []
    images: List[str] = []
    has_object = False

    for paragraph in cell.paragraphs:
        para_parts: List[str] = []

        for run in paragraph.runs:
            run_text = run.text or ""
            run_text = run_text.replace("\xa0", " ")
            if run_text:
                para_parts.append(run_text)

            run_images = extract_run_images(run, rid_to_data_url)
            if run_images:
                images.extend(run_images)

            try:
                ole_nodes = run._element.xpath(".//*[local-name()='OLEObject']")
                if ole_nodes:
                    has_object = True
            except Exception:
                pass

            try:
                object_nodes = run._element.xpath(".//*[local-name()='object']")
                if object_nodes:
                    has_object = True
            except Exception:
                pass

        para_text = "".join(para_parts).strip()
        if para_text:
            text_parts.append(para_text)

    text = "\n".join([t for t in text_parts if t]).strip()
    text = restore_fraction_spacing(text)

    deduped_images = []
    seen = set()
    for img in images:
        if img not in seen:
            seen.add(img)
            deduped_images.append(img)

    return text, deduped_images, has_object


def normalize_row_text_fields(row: dict) -> dict:
    if not isinstance(row, dict):
        return row

    row["question"] = restore_fraction_spacing(row.get("question", ""))
    row["explanation"] = restore_fraction_spacing(row.get("explanation", ""))
    row["answer"] = restore_fraction_spacing(row.get("answer", ""))

    if isinstance(row.get("options"), list):
        row["options"] = [
            restore_fraction_spacing(opt) if isinstance(opt, str) else opt
            for opt in row["options"]
        ]

    return row


def parse_docx_tables(docx_path: str) -> Tuple[List[dict], List[str], int]:
    rid_to_data_url, _ = build_docx_image_maps(docx_path)
    doc = Document(docx_path)

    rows = []
    errors = []
    unresolved_object_count = 0

    for table_index, table in enumerate(doc.tables):
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

        for row in table.rows:
            if len(row.cells) < 2:
                continue

            raw_key, _, _ = extract_cell_content(row.cells[0], rid_to_data_url)
            key = clean_key(raw_key)

            val_text, val_images, has_object = extract_cell_content(row.cells[1], rid_to_data_url)
            first_image = val_images[0] if val_images else None

            if has_object and not val_text:
                unresolved_object_count += 1

            if key == "grade":
                item["grade"] = val_text
            elif key == "subject":
                item["subject"] = val_text
            elif key == "topic":
                item["topic"] = val_text
            elif key in ["sub-topic", "sub topic", "sub_topic"]:
                item["sub_topic"] = val_text
            elif key in ["question skill type", "question type", "skill type"]:
                item["question_type"] = val_text
            elif key in ["question difficulty", "difficulty"]:
                item["difficulty"] = val_text or "Medium"
            elif key == "question":
                item["question"] = val_text
                item["inline_images"] = val_images
                item["imageUrl"] = first_image
            elif key == "explanation":
                item["explanation"] = val_text
            elif key in ["question id/code", "question id", "question_code"]:
                item["question_code"] = val_text
            elif key == "marks":
                try:
                    item["marks"] = int(val_text)
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

                    item["options"][idx] = val_text
                    item["option_images"][idx] = first_image
                    item["option_inline_images"][idx] = val_images

                    if has_object and not val_text:
                        unresolved_object_count += 1
            elif key in ["key", "answer key", "correct option"]:
                try:
                    correct_index = int(val_text) - 1
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

    return rows, errors, unresolved_object_count


@app.get("/health")
def health():
    return {"ok": True, "version": "docx-table-direct-v3"}


@app.post("/parse-docx")
async def parse_docx(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".docx"):
        raise HTTPException(status_code=400, detail="Only .docx files are supported")

    with tempfile.TemporaryDirectory() as temp_dir:
        docx_path = os.path.join(temp_dir, file.filename)

        with open(docx_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        try:
            rows, errors, unresolved_object_count = parse_docx_tables(docx_path)

            return {
                "debug_version": "docx-table-direct-v3",
                "rows": rows,
                "errors": errors,
                "unresolved_math_objects": unresolved_object_count,
            }

        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)