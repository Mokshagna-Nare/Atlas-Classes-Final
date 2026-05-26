from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from bs4 import BeautifulSoup
import tempfile
import subprocess
import shutil
import os
import re
import base64

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

def clean_key(raw: str) -> str:
    return (
        raw.replace("\xa0", " ")
        .strip()
        .lstrip("#")
        .rstrip("*")
        .strip()
        .lower()
    )

def file_to_data_url(path: str):
    if not os.path.exists(path):
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
    }.get(ext, f"image/{ext}")

    with open(path, "rb") as f:
        encoded = base64.b64encode(f.read()).decode("utf-8")

    return f"data:{mime};base64,{encoded}"

def extract_content(td, temp_dir: str):
    # Find ALL images in the cell
    imgs = td.find_all("img")
    image_src = None

    # Grab the first valid image we can find
    for img in imgs:
        src = img.get("src")
        if not src:
            continue
            
        if src.startswith("data:image"):
            image_src = src
            break
        else:
            # LibreOffice sometimes adds relative paths or url-encodes them
            import urllib.parse
            clean_src = urllib.parse.unquote(src)
            img_path = os.path.join(temp_dir, clean_src)
            
            if os.path.exists(img_path):
                image_src = file_to_data_url(img_path)
                break

    # Extract text after removing images
    td_clone = BeautifulSoup(str(td), "html.parser")
    for tag in td_clone.find_all("img"):
        tag.decompose()

    # Get text, preserving basic spacing
    text = td_clone.get_text(" ", strip=True).replace("\xa0", " ").strip()
    
    return text, image_src

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/parse-docx")
async def parse_docx(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".docx"):
        raise HTTPException(status_code=400, detail="Only .docx files are supported")

    with tempfile.TemporaryDirectory() as temp_dir:
        input_path = os.path.join(temp_dir, file.filename)

        with open(input_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        cmd = [
            "libreoffice",
            "--headless",
            "--convert-to",
            "html:XHTML Writer File:UTF8",
            "--outdir",
            temp_dir,
            input_path,
        ]

        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail=f"LibreOffice conversion failed: {result.stderr or result.stdout}"
            )

        html_files = [f for f in os.listdir(temp_dir) if f.lower().endswith(".html")]
        if not html_files:
            raise HTTPException(status_code=500, detail="No HTML output generated")

        html_path = os.path.join(temp_dir, html_files[0])

        with open(html_path, "r", encoding="utf-8", errors="ignore") as f:
            html = f.read()

        soup = BeautifulSoup(html, "html.parser")
        tables = soup.find_all("table")

        rows = []
        errors = []

        if not tables:
            return {
                "rows": [],
                "errors": ["No tables found in the document. Ensure it is a .docx with one table per question."]
            }

        for table_index, table in enumerate(tables):
            trs = table.find_all("tr")
            options = []
            option_images = []
            correct_index = None

            item = {
                "grade": "",
                "subject": "",
                "topic": "",
                "sub_topic": "",
                "question_type": "",
                "difficulty": "Medium",
                "question": "",
                "imageUrl": None,
                "question_code": "",
                "marks": 4,
                "explanation": "",
            }

            for tr in trs:
                cells = tr.find_all(["td", "th"])
                if len(cells) < 2:
                    continue

                key_raw = cells[0].get_text(" ", strip=True)
                key = clean_key(key_raw)
                val_raw, image_src = extract_content(cells[1], temp_dir)

                if key == "grade":
                    item["grade"] = val_raw
                elif key == "subject":
                    item["subject"] = val_raw
                elif key == "topic":
                    item["topic"] = val_raw
                elif key in ["sub-topic", "sub topic", "sub_topic"]:
                    item["sub_topic"] = val_raw
                elif key in ["question skill type", "question type", "skill type"]:
                    item["question_type"] = val_raw
                elif key in ["question difficulty", "difficulty"]:
                    item["difficulty"] = val_raw or "Medium"
                elif key == "question":
                    item["question"] = val_raw
                    if image_src:
                        item["imageUrl"] = image_src
                elif key == "explanation":
                    item["explanation"] = val_raw
                elif key in ["question id/code", "question id", "question_code"]:
                    item["question_code"] = val_raw
                elif key == "marks":
                    try:
                        item["marks"] = int(val_raw)
                    except:
                        item["marks"] = 4
                elif key.startswith("option"):
                    match = re.match(r"option\s*(\d+)", key, re.I)
                    if match:
                        idx = int(match.group(1)) - 1
                        while len(options) <= idx:
                            options.append("")
                        while len(option_images) <= idx:
                            option_images.append(None)
                        options[idx] = val_raw
                        option_images[idx] = image_src
                elif key in ["key", "answer key", "correct option"]:
                    try:
                        correct_index = int(val_raw) - 1
                    except:
                        correct_index = None

            max_len = max(len(options), len(option_images), 4)
            normalized_options = []
            normalized_option_images = []

            for i in range(max_len):
                normalized_options.append(options[i].strip() if i < len(options) and options[i] else "")
                normalized_option_images.append(option_images[i] if i < len(option_images) else None)

            missing = []
            if not item["subject"]:
                missing.append("Subject")
            if not item["question"] and not item["imageUrl"]:
                missing.append("Question Content")

            text_opt_count = len([o for o in normalized_options if o])
            img_opt_count = len([o for o in normalized_option_images if o])

            if text_opt_count < 2 and img_opt_count < 2:
                missing.append("Options (min 2 text or images)")

            if missing:
                errors.append(f"Table {table_index + 1}: Missing {', '.join(missing)}")
                continue

            if correct_index is None or correct_index < 0 or correct_index >= len(normalized_options):
                errors.append(f"Table {table_index + 1}: Invalid/missing Key (correct option number).")
                continue

            answer = normalized_options[correct_index]

            rows.append({
                **item,
                "options": normalized_options,
                "option_images": normalized_option_images,
                "answer": answer,
            })

        return {
            "rows": rows,
            "errors": errors,
        }