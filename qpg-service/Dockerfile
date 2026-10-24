FROM python:3.11-slim-bookworm

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY core ./core
COPY main.py .

# Load the OCR models once at build time so the first request is fast.
RUN python -c "import sys; sys.path.insert(0, 'core'); import qpg_core; assert qpg_core.get_ocr_engine() is not None"

ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT} --timeout-keep-alive 75"]
