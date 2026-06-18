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
from lxml import etree

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
M_NS = "http://schemas.openxmlformats.org/officeDocument/2006/math"


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
    rid_to_data_url: dict = {}
    target_to_data_url: dict = {}

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
                ext = (
                    os.path.splitext(part.partname)[1].replace(".", "").lower() or "png"
                )
                rid_to_data_url[rel_id] = bytes_to_data_url(part.blob, ext)
        except Exception:
            continue

    return rid_to_data_url, target_to_data_url


def dedupe_str_list(items: List[str]) -> List[str]:
    out: List[str] = []
    seen: set = set()
    for item in items:
        if item and item not in seen:
            seen.add(item)
            out.append(item)
    return out


def get_vert_align(run_elem) -> Optional[str]:
    """Return vertAlign value (superscript/subscript) from a w:r element."""
    rpr = run_elem.find(f"{{{W_NS}}}rPr")
    if rpr is not None:
        va = rpr.find(f"{{{W_NS}}}vertAlign")
        if va is not None:
            return va.get(f"{{{W_NS}}}val")
    return None


# ── OMML → marker-based text ──────────────────────────────────────────────────
#
# We output structured markers instead of Unicode chars so the frontend can
# render them with proper CSS sizing:
#
#   [SUP]x[/SUP]                    → <sup> tag (readable size)
#   [SUB]x[/SUB]                    → <sub> tag (readable size)
#   [FRAC]numerator[SEP]denominator[/FRAC] → stacked fraction with bar
#
# This solves:
#   • Unicode ⁻¹⁰ being tiny/inconsistent across browsers/fonts
#   • Fractions showing as (a)/(b) slash notation instead of stacked


def extract_omml_as_text(omml_node) -> str:
    """Recursively convert an OMML node to marker-annotated readable text."""
    tag = omml_node.tag.split("}")[-1] if "}" in omml_node.tag else omml_node.tag

    # ── Fraction ──────────────────────────────────────────────────────────────
    if tag == "f":
        num_node = omml_node.find(f"{{{M_NS}}}num")
        den_node = omml_node.find(f"{{{M_NS}}}den")
        num = extract_omml_as_text(num_node) if num_node is not None else ""
        den = extract_omml_as_text(den_node) if den_node is not None else ""
        return f"[FRAC]{num}[SEP]{den}[/FRAC]"

    # ── Superscript ───────────────────────────────────────────────────────────
    if tag == "sSup":
        e_node = omml_node.find(f"{{{M_NS}}}e")
        sup_node = omml_node.find(f"{{{M_NS}}}sup")
        base = extract_omml_as_text(e_node) if e_node is not None else ""
        sup = extract_omml_as_text(sup_node) if sup_node is not None else ""
        return f"{base}[SUP]{sup}[/SUP]"

    # ── Subscript ─────────────────────────────────────────────────────────────
    if tag == "sSub":
        e_node = omml_node.find(f"{{{M_NS}}}e")
        sub_node = omml_node.find(f"{{{M_NS}}}sub")
        base = extract_omml_as_text(e_node) if e_node is not None else ""
        sub = extract_omml_as_text(sub_node) if sub_node is not None else ""
        return f"{base}[SUB]{sub}[/SUB]"

    # ── Superscript + Subscript combined ──────────────────────────────────────
    if tag == "sSubSup":
        e_node = omml_node.find(f"{{{M_NS}}}e")
        sub_node = omml_node.find(f"{{{M_NS}}}sub")
        sup_node = omml_node.find(f"{{{M_NS}}}sup")
        base = extract_omml_as_text(e_node) if e_node is not None else ""
        sub = extract_omml_as_text(sub_node) if sub_node is not None else ""
        sup = extract_omml_as_text(sup_node) if sup_node is not None else ""
        return f"{base}[SUB]{sub}[/SUB][SUP]{sup}[/SUP]"

    # ── Radical: √ or nth root ────────────────────────────────────────────────
    if tag == "rad":
        deg_node = omml_node.find(f"{{{M_NS}}}deg")
        e_node = omml_node.find(f"{{{M_NS}}}e")
        deg = extract_omml_as_text(deg_node).strip() if deg_node is not None else ""
        base = extract_omml_as_text(e_node) if e_node is not None else ""
        if deg:
            return f"[SUP]{deg}[/SUP]√({base})"
        return f"√({base})"

    # ── Delimiter: brackets ───────────────────────────────────────────────────
    if tag == "d":
        e_nodes = omml_node.findall(f"{{{M_NS}}}e")
        inner = "".join(extract_omml_as_text(e) for e in e_nodes)
        dpr = omml_node.find(f"{{{M_NS}}}dPr")
        beg, end = "(", ")"
        if dpr is not None:
            beg_node = dpr.find(f"{{{M_NS}}}begChr")
            end_node = dpr.find(f"{{{M_NS}}}endChr")
            if beg_node is not None:
                beg = beg_node.get(f"{{{M_NS}}}val", "(")
            if end_node is not None:
                end = end_node.get(f"{{{M_NS}}}val", ")")
        return f"{beg}{inner}{end}"

    # ── N-ary: Σ ∫ Π ─────────────────────────────────────────────────────────
    if tag == "nary":
        nary_pr = omml_node.find(f"{{{M_NS}}}naryPr")
        chr_node = nary_pr.find(f"{{{M_NS}}}chr") if nary_pr is not None else None
        symbol = (
            chr_node.get(f"{{{M_NS}}}val", "∫") if chr_node is not None else "∫"
        )
        sub_node = omml_node.find(f"{{{M_NS}}}sub")
        sup_node = omml_node.find(f"{{{M_NS}}}sup")
        e_node = omml_node.find(f"{{{M_NS}}}e")
        sub = extract_omml_as_text(sub_node) if sub_node is not None else ""
        sup = extract_omml_as_text(sup_node) if sup_node is not None else ""
        body = extract_omml_as_text(e_node) if e_node is not None else ""
        return f"{symbol}[SUB]{sub}[/SUB][SUP]{sup}[/SUP]{body}"

    # ── Function: sin, cos, lim etc. ──────────────────────────────────────────
    if tag == "func":
        fname_node = omml_node.find(f"{{{M_NS}}}fName")
        e_node = omml_node.find(f"{{{M_NS}}}e")
        fname = extract_omml_as_text(fname_node) if fname_node is not None else ""
        arg = extract_omml_as_text(e_node) if e_node is not None else ""
        return f"{fname}({arg})"

    # ── Matrix ────────────────────────────────────────────────────────────────
    if tag == "m":
        mat_rows = omml_node.findall(f"{{{M_NS}}}mr")
        row_texts = []
        for mat_row in mat_rows:
            cells = mat_row.findall(f"{{{M_NS}}}e")
            row_texts.append(
                ", ".join(extract_omml_as_text(c) for c in cells)
            )
        return "[" + "; ".join(row_texts) + "]"

    # ── Plain math text run ───────────────────────────────────────────────────
    if tag == "r":
        t_node = omml_node.find(f"{{{M_NS}}}t")
        if t_node is not None and t_node.text:
            return t_node.text
        return ""

    # ── Generic fallback: recurse children, skip property nodes ──────────────
    parts = []
    for child in omml_node:
        child_tag = child.tag.split("}")[-1] if "}" in child.tag else child.tag
        if child_tag.endswith("Pr"):
            continue
        parts.append(extract_omml_as_text(child))
    return "".join(parts)


# ── Paragraph walker ──────────────────────────────────────────────────────────
# Handles both:
#   • w:r with vertAlign=superscript/subscript  → [SUP]/[SUB] markers
#   • m:oMath / m:oMathPara                     → extract_omml_as_text()
# Processes children IN DOCUMENT ORDER so math is interleaved correctly.

def extract_paragraph_text_with_math(
    paragraph, rid_to_data_url: dict
) -> Tuple[str, List[str], bool]:
    p_elem = paragraph._p
    parts: List[str] = []
    images: List[str] = []
    has_omml = False

    for child in p_elem:
        local = child.tag.split("}")[-1] if "}" in child.tag else child.tag

        # ── Plain word run ────────────────────────────────────────────────────
        if local == "r":
            t_node = child.find(f"{{{W_NS}}}t")
            text = t_node.text if t_node is not None and t_node.text else ""

            if text:
                va = get_vert_align(child)
                if va == "superscript":
                    parts.append(f"[SUP]{text}[/SUP]")
                elif va == "subscript":
                    parts.append(f"[SUB]{text}[/SUB]")
                else:
                    parts.append(text)

            # Images inside the run
            try:
                for blip in child.xpath(".//*[local-name()='blip']"):
                    rid = blip.get(f"{{{R_NS}}}embed")
                    if rid and rid in rid_to_data_url:
                        images.append(rid_to_data_url[rid])
            except Exception:
                pass
            try:
                for node in child.xpath(".//*[local-name()='imagedata']"):
                    rid = node.get(f"{{{R_NS}}}id")
                    if rid and rid in rid_to_data_url:
                        images.append(rid_to_data_url[rid])
            except Exception:
                pass

        # ── Hyperlink (wraps w:r children) ────────────────────────────────────
        elif local == "hyperlink":
            for sub_run in child:
                sub_local = (
                    sub_run.tag.split("}")[-1] if "}" in sub_run.tag else sub_run.tag
                )
                if sub_local == "r":
                    t_node = sub_run.find(f"{{{W_NS}}}t")
                    text = t_node.text if t_node is not None and t_node.text else ""
                    if text:
                        va = get_vert_align(sub_run)
                        if va == "superscript":
                            parts.append(f"[SUP]{text}[/SUP]")
                        elif va == "subscript":
                            parts.append(f"[SUB]{text}[/SUB]")
                        else:
                            parts.append(text)

        # ── OMML math (inline or block) ───────────────────────────────────────
        elif local in ("oMath", "oMathPara"):
            has_omml = True
            if local == "oMathPara":
                for omath in child.findall(f"{{{M_NS}}}oMath"):
                    math_text = extract_omml_as_text(omath).strip()
                    if math_text:
                        parts.append(math_text)
            else:
                math_text = extract_omml_as_text(child).strip()
                if math_text:
                    parts.append(math_text)

    combined = "".join(parts).strip()
    combined = re.sub(r" {2,}", " ", combined)
    return combined, dedupe_str_list(images), has_omml


# ── Cell content extractor ────────────────────────────────────────────────────

def extract_cell_content(cell, rid_to_data_url: dict) -> dict:
    text_parts: List[str] = []
    images: List[str] = []
    has_object = False
    has_omml = False
    warnings: List[str] = []

    for paragraph in cell.paragraphs:
        # Check for embedded OLE objects
        try:
            if paragraph._p.xpath(
                ".//*[local-name()='OLEObject']"
            ) or paragraph._p.xpath(".//*[local-name()='object']"):
                has_object = True
        except Exception:
            pass

        para_text, para_images, para_has_omml = extract_paragraph_text_with_math(
            paragraph, rid_to_data_url
        )

        if para_has_omml:
            has_omml = True
        if para_text:
            text_parts.append(para_text)
        if para_images:
            images.extend(para_images)

    text = "\n".join([t for t in text_parts if t]).strip()
    images = dedupe_str_list(images)

    # Only warn when we got NOTHING out despite math/objects being present
    if has_omml and not text and not images:
        warnings.append(
            "Math equation detected but could not be extracted as text."
        )
    if has_object and not text and not images:
        warnings.append(
            "Embedded object detected but could not be extracted as text."
        )

    return {
        "text": text,
        "images": images,
        "has_object": has_object,
        "has_omml": has_omml,
        "warnings": warnings,
    }


def normalize_row_text_fields(row: dict) -> dict:
    """Clean up extra whitespace only — never modify math markers."""
    for field in ["question", "explanation", "answer", "source", "remarks"]:
        val = row.get(field, "") or ""
        row[field] = re.sub(r" {2,}", " ", val.replace("\u00a0", " ")).strip()
    if isinstance(row.get("options"), list):
        row["options"] = [
            re.sub(r" {2,}", " ", opt.replace("\u00a0", " ")).strip()
            if isinstance(opt, str)
            else opt
            for opt in row["options"]
        ]
    return row


# ── Main parser ───────────────────────────────────────────────────────────────

def parse_docx_tables(docx_path: str) -> Tuple[List[dict], List[str], int]:
    rid_to_data_url, _ = build_docx_image_maps(docx_path)
    doc = Document(docx_path)
    rows: List[dict] = []
    errors: List[str] = []
    unresolved_object_count = 0

    for table_index, table in enumerate(doc.tables):

        item: dict = {
            "grade": "",
            "subject": "",
            "topic": "",
            "sub_topic": "",
            "skill_type": "",
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
            "source": "",
            "remarks": "",
            "parser_meta": {
                "unresolved_question_object": False,
                "unresolved_option_objects": [False, False, False, False],
                "unresolved_math_objects": 0,
                "has_omml": False,
                "option_has_omml": [False, False, False, False],
                "warnings": [],
            },
        }

        correct_index: Optional[int] = None

        for row in table.rows:
            if len(row.cells) < 2:
                continue

            key_data = extract_cell_content(row.cells[0], rid_to_data_url)
            key = clean_key(key_data["text"])

            val = extract_cell_content(row.cells[1], rid_to_data_url)
            val_text: str = val["text"]
            val_images: List[str] = val["images"]
            first_image: Optional[str] = val_images[0] if val_images else None

            # ── Field mapping ─────────────────────────────────────────────────
            if key == "grade":
                item["grade"] = val_text

            elif key == "subject":
                item["subject"] = val_text

            elif key == "topic":
                item["topic"] = val_text

            elif key in ["sub-topic", "sub topic", "sub_topic"]:
                item["sub_topic"] = val_text

            elif key == "skill type":
                item["skill_type"] = val_text

            elif key in ["question type", "question skill type"]:
                item["question_type"] = val_text
                # Auto-fill skill_type when it matches a valid value
                # and was not already set by a dedicated #Skill type* row
                valid_skill_types = [
                    "Understanding",
                    "Knowledge Based",
                    "Application",
                    "Analytical",
                ]
                if not item["skill_type"] and val_text in valid_skill_types:
                    item["skill_type"] = val_text

            elif key in ["question difficulty", "difficulty"]:
                item["difficulty"] = val_text or "Medium"

            elif key == "question":
                item["question"] = val_text
                item["inline_images"] = val_images
                item["imageUrl"] = first_image
                item["parser_meta"]["has_omml"] = bool(val["has_omml"])
                item["parser_meta"]["warnings"].extend(val["warnings"])
                if (
                    (val["has_object"] or val["has_omml"])
                    and not val_text
                    and not val_images
                ):
                    item["parser_meta"]["unresolved_question_object"] = True
                    unresolved_object_count += 1

            elif key == "explanation":
                item["explanation"] = val_text

            elif key == "source":
                item["source"] = val_text

            elif key == "remarks":
                item["remarks"] = val_text

            elif key in ["question id/code", "question id", "question_code"]:
                item["question_code"] = val_text

            elif key == "marks":
                try:
                    item["marks"] = int(val_text)
                except Exception:
                    item["marks"] = 4

            elif key.startswith("option"):
                idx = parse_option_number(key)
                if idx is not None and 0 <= idx <= 3:
                    while len(item["options"]) <= idx:
                        item["options"].append("")
                    while len(item["option_images"]) <= idx:
                        item["option_images"].append(None)
                    while len(item["option_inline_images"]) <= idx:
                        item["option_inline_images"].append([])

                    item["options"][idx] = val_text
                    item["option_images"][idx] = first_image
                    item["option_inline_images"][idx] = val_images
                    item["parser_meta"]["option_has_omml"][idx] = bool(
                        val["has_omml"]
                    )
                    item["parser_meta"]["warnings"].extend(
                        [f"Option {idx + 1}: {w}" for w in val["warnings"]]
                    )
                    if (
                        (val["has_object"] or val["has_omml"])
                        and not val_text
                        and not val_images
                    ):
                        item["parser_meta"]["unresolved_option_objects"][idx] = True
                        unresolved_object_count += 1

            elif key in ["key", "answer key", "correct option"]:
                try:
                    correct_index = int(val_text) - 1
                except Exception:
                    correct_index = None

        # ── Pad all option arrays to uniform length ───────────────────────────
        max_len = max(
            len(item["options"]),
            len(item["option_images"]),
            len(item["option_inline_images"]),
            4,
        )
        while len(item["options"]) < max_len:
            item["options"].append("")
        while len(item["option_images"]) < max_len:
            item["option_images"].append(None)
        while len(item["option_inline_images"]) < max_len:
            item["option_inline_images"].append([])

        item["parser_meta"]["unresolved_math_objects"] = unresolved_object_count

        if correct_index is not None and 0 <= correct_index < len(item["options"]):
            item["answer_index"] = correct_index
            item["answer"] = item["options"][correct_index]
        else:
            errors.append(
                f"Table {table_index + 1}: Invalid/missing Key "
                f"(correct option number)."
            )

        item["parser_meta"]["warnings"] = dedupe_str_list(
            item["parser_meta"]["warnings"]
        )
        rows.append(normalize_row_text_fields(item))

    return rows, errors, unresolved_object_count


# ── FastAPI endpoint ──────────────────────────────────────────────────────────

@app.post("/parse-docx")
async def parse_docx(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".docx"):
        raise HTTPException(
            status_code=400, detail="Only .docx files are supported"
        )
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