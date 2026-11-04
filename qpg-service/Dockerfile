FROM python:3.11-slim-bookworm

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY core ./core
COPY main.py boot.py ./

# Load the OCR models once at build time so the first request is fast.
RUN python -c "import sys; sys.path.insert(0, 'core'); import qpg_core; assert qpg_core.get_ocr_engine() is not None" \
    && python -m compileall -q main.py boot.py core

ENV PORT=8000 \
    MALLOC_ARENA_MAX=2
EXPOSE 8000

CMD ["sh", "-c", "uvicorn boot:app --host 0.0.0.0 --port ${PORT} --timeout-keep-alive 75"]
