FROM python:3.11-slim-bookworm

WORKDIR /app

COPY requirements.txt requirements.lock ./
# Exact tested versions (requirements.lock), never "whatever is newest today".
RUN pip install --no-cache-dir -r requirements.lock

COPY core ./core
COPY data ./data
COPY main.py boot.py ocr_layout.py ocr_figures.py text_checks.py image_input.py selftest.py ./

# Load the OCR models once at build time so the first request is fast, then
# run the self-test: if reading PDFs, finding figures, OCR or the Word export
# is broken, the build FAILS and the host keeps the previous working version.
RUN python -m compileall -q main.py boot.py ocr_layout.py ocr_figures.py text_checks.py image_input.py core \
    && python selftest.py

ENV PORT=8000 \
    MALLOC_ARENA_MAX=2
EXPOSE 8000

CMD ["sh", "-c", "uvicorn boot:app --host 0.0.0.0 --port ${PORT} --timeout-keep-alive 75"]
