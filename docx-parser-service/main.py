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

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"

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
    return ((raw or "").replace("\xa0", " ").strip().lstrip("#").rstrip("*").strip().lower())

def parse_option_number(key: str) -> Optional[int]:
    m = re.search(r"option\s*(\d+)", key, re.I)
    if not m: return None
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

def dedupe_str_list(items: List[str]) -> List[str]:
    out = []
    seen = set()
    for item in items:
        if item and item not in seen:
            seen.add(item)
            out.append(item)
    return out

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
    return dedupe_str_list(images)

# NEW: Recursively pull ALL text from raw XML to catch hidden math and revision tracking
def extract_xml_text(element) -> str:
    texts = []
    for node in element.iter():
        if node.tag.endswith('}t'): # w:t or m:t (Word text or Math text)
            if node.text:
                texts.append(node.text)
    return "".join(texts)

def extract_cell_content(cell, rid_to_data_url: dict) -> dict:
    text_parts: List[str] = []
    images: List[str] = []
    has_object = False
    has_omml = False
    warnings: List[str] = []

    for paragraph in cell.paragraphs:
        para_parts: List[str] = []
        try:
            omml_nodes = paragraph._p.xpath(".//*[local-name()='oMath' or local-name()='oMathPara']")
            if omml_nodes: has_omml = True
        except Exception:
            pass

        for run in paragraph.runs:
            run_text = (run.text or "").replace("\xa0", " ")
            if run_text: 
                para_parts.append(run_text)

            run_images = extract_run_images(run, rid_to_data_url)
            if run_images: images.extend(run_images)

            try:
                if run._element.xpath(".//*[local-name()='OLEObject']") or run._element.xpath(".//*[local-name()='object']"):
                    has_object = True
            except Exception:
                pass

        # If python-docx's native run.text is empty, but we suspect math/objects are there, fallback to raw XML extraction
        para_text = "".join(para_parts).strip()
        if not para_text and (has_omml or has_object):
             para_text = extract_xml_text(paragraph._p).strip()

        if para_text: text_parts.append(para_text)

    # Finally, if paragraph iteration failed to get anything, try extracting from the whole cell xml
    text = "\n".join([t for t in text_parts if t]).strip()
    if not text and (has_omml or has_object):
         text = extract_xml_text(cell._tc).strip()

    text = restore_fraction_spacing(text)
    images = dedupe_str_list(images)

    if has_omml and not text and not images:
        warnings.append("Math equation detected but could not be extracted as text.")
    if has_object and not text and not images:
        warnings.append("Embedded object detected but could not be extracted as text.")

    return {
        "text": text,
        "images": images,
        "has_object": has_object,
        "has_omml": has_omml,
        "warnings": warnings,
    }

def normalize_row_text_fields(row: dict) -> dict:
    for field in ["question", "explanation", "answer", "source", "remarks"]:
        row[field] = restore_fraction_spacing(row.get(field, ""))
    if isinstance(row.get("options"), list):
        row["options"] = [restore_fraction_spacing(opt) if isinstance(opt, str) else opt for opt in row["options"]]
    return row

def parse_docx_tables(docx_path: str) -> Tuple[List[dict], List[str], int]:
    rid_to_data_url, _ = build_docx_image_maps(docx_path)
    doc = Document(docx_path)
    rows = []
    errors = []
    unresolved_object_count = 0

    for table_index, table in enumerate(doc.tables):
        item = {
            "grade": "", "subject": "", "topic": "", "sub_topic": "",
            "question_type": "", "difficulty": "Medium",
            "question": "", "inline_images": [], "imageUrl": None,
            "question_code": "", "marks": 4, "explanation": "",
            "options": [], "option_images": [], "option_inline_images": [],
            "answer": "", "answer_index": None,
            "source": "", "remarks": "",
            "parser_meta": {
                "unresolved_question_object": False,
                "unresolved_option_objects": [False, False, False, False],
                "unresolved_math_objects": 0,
                "has_omml": False,
                "option_has_omml": [False, False, False, False],
                "warnings": [],
            },
        }

        correct_index = None

        for row in table.rows:
            if len(row.cells) < 2: continue
            
            key_data = extract_cell_content(row.cells[0], rid_to_data_url)
            key = clean_key(key_data["text"])
            
            val = extract_cell_content(row.cells[1], rid_to_data_url)
            val_text = val["text"]
            val_images = val["images"]
            first_image = val_images[0] if val_images else None

            if key == "grade": item["grade"] = val_text
            elif key == "subject": item["subject"] = val_text
            elif key == "topic": item["topic"] = val_text
            elif key in ["sub-topic", "sub topic", "sub_topic"]: item["sub_topic"] = val_text
            elif key in ["question type", "skill type", "question skill type"]: item["question_type"] = val_text
            elif key in ["question difficulty", "difficulty"]: item["difficulty"] = val_text or "Medium"
            elif key == "question":
                item["question"] = val_text
                item["inline_images"] = val_images
                item["imageUrl"] = first_image
                item["parser_meta"]["has_omml"] = bool(val["has_omml"])
                item["parser_meta"]["warnings"].extend(val["warnings"])
                if (val["has_object"] or val["has_omml"]) and not val_text and not val_images:
                    item["parser_meta"]["unresolved_question_object"] = True
                    unresolved_object_count += 1
            elif key == "explanation": item["explanation"] = val_text
            elif key == "source": item["source"] = val_text
            elif key == "remarks": item["remarks"] = val_text
            elif key in ["question id/code", "question id", "question_code"]: item["question_code"] = val_text
            elif key == "marks":
                try: item["marks"] = int(val_text)
                except: item["marks"] = 4
            elif key.startswith("option"):
                idx = parse_option_number(key)
                if idx is not None and 0 <= idx <= 3:
                    while len(item["options"]) <= idx: item["options"].append("")
                    while len(item["option_images"]) <= idx: item["option_images"].append(None)
                    while len(item["option_inline_images"]) <= idx: item["option_inline_images"].append([])
                    
                    item["options"][idx] = val_text
                    item["option_images"][idx] = first_image
                    item["option_inline_images"][idx] = val_images
                    item["parser_meta"]["option_has_omml"][idx] = bool(val["has_omml"])
                    item["parser_meta"]["warnings"].extend([f"Option {idx+1}: {w}" for w in val["warnings"]])

                    if (val["has_object"] or val["has_omml"]) and not val_text and not val_images:
                        item["parser_meta"]["unresolved_option_objects"][idx] = True
                        unresolved_object_count += 1
            elif key in ["key", "answer key", "correct option"]:
                try: correct_index = int(val_text) - 1
                except: correct_index = None

        max_len = max(len(item["options"]), len(item["option_images"]), len(item["option_inline_images"]), 4)
        while len(item["options"]) < max_len: item["options"].append("")
        while len(item["option_images"]) < max_len: item["option_images"].append(None)
        while len(item["option_inline_images"]) < max_len: item["option_inline_images"].append([])

        item["parser_meta"]["unresolved_math_objects"] = unresolved_object_count

        if correct_index is not None and 0 <= correct_index < len(item["options"]):
            item["answer_index"] = correct_index
            item["answer"] = item["options"][correct_index]
        else:
            errors.append(f"Table {table_index + 1}: Invalid/missing Key (correct option number).")

        item["parser_meta"]["warnings"] = dedupe_str_list(item["parser_meta"]["warnings"])
        rows.append(normalize_row_text_fields(item))

    return rows, errors, unresolved_object_count

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
                "rows": rows,
                "errors": errors,
                "unresolved_math_objects": unresolved_object_count,
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)