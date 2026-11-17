# Questions generator service

Backend for the **Questions generator** tab in the admin panel. It runs the
Question Paper Generator's logic (the same code as the Streamlit app) and
returns results to the admin panel:

- **Generate new questions** from a source PDF, with real figures detected,
  cleaned of labels and placed inside the question.
- **Extract existing questions** from a PDF or images, using built-in OCR (no
  AI needed) or an AI vision model.
- **Word file** in the same 17-field table format, and rows formatted for the
  Atlas `mcqs` table (**Add to question bank**).

AI keys are stored only in this service's environment variables. The browser
never sees them. Every request must come from a logged-in Atlas **admin**:
the service checks the Supabase login token and the user's `role`.

## Deploy (Render) — quickest way

1. Render → **New → Blueprint** → choose this repository. Render reads
   `render.yaml` at the repo root and creates **only** the new
   `atlas-questions-generator` service. Your existing services are untouched.
2. Fill in the values it asks for:
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`: the same values as the site's
     `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
   - At least one AI key: `ANTHROPIC_API_KEY` (+ optional `CLAUDE_MODEL`),
     `AGENTROUTER_API_KEY` or `OMNIROUTE_API_KEY`. Only providers with a key
     are offered. OCR extraction needs no key. Leave the others empty.
3. Deploy, then open `https://atlas-questions-generator.onrender.com/health`.
   It should show `{"ok": true, "ocr": true, "low_memory": true}`.
4. The admin panel already points at that address. If Render gives the service
   a different URL, set `VITE_QUESTIONS_GENERATOR_API=<that URL>` in the
   website's hosting settings and redeploy the site.

### Memory: 512 MB (testing) vs 2 GB

The blueprint uses Render's **free 512 MB** plan with `QPG_LOW_MEMORY=1`. In
that mode the service:

- Runs PDF analysis, OCR and Word export in short-lived child processes, so
  memory never builds up.
- Reads scanned pages in strips, with leaner OCR settings.
- Does one heavy job at a time.

It was tested under a hard 512 MB limit with a 20-page PDF, 16+ OCR pages in a
row and parallel requests, without crashing. If a single file is too big, the
admin sees a clear message instead of the service going down.

Free-plan limits:
- The service sleeps after about 15 minutes idle; the first visit then waits
  1–3 minutes while it wakes. The admin panel retries automatically.
- It has 0.1 CPU, so OCR pages are slower (about a minute per image).

The container starts with `boot.py`, which opens the port within seconds and
loads the app in the background. Until it is ready, `/health` answers
`{"starting": true}` and other requests get a 503 "starting up" reply, so
the host never shows 502 while the libraries load.

For everyday use, switch to **Standard (2 GB)** and remove `QPG_LOW_MEMORY`.
That gives full OCR quality and speed, the same as the Streamlit app.

Other hosts work too, since it's a plain Docker image listening on `$PORT`. On Google Cloud Run, set memory to 2 GiB and the request timeout to
900 s. A page can take a few minutes when the AI provider is slow.

## When the AI provider is busy

If the chosen model fails because the provider is out of capacity (for example
OmniRoute's `503 Maximum combo retry limit reached`, rate limits, overload),
the service retries the same page with other models of that provider. These
come from `OMNIROUTE_FALLBACK_MODELS` / `AGENTROUTER_FALLBACK_MODELS` /
`CLAUDE_FALLBACK_MODELS` (comma separated), or else the provider's own model
list. A busy model is skipped for 5 minutes, and the admin panel re-tries any
failed page once more at the end of the run.

## Extraction methods

- **OCR + AI clean-up** (default when an AI key is set): the page is read on
  the server (PDF text layer, or OCR), then the AI fixes the question /
  option / answer structure and OCR slips. It can optionally see the page
  image too. If the AI step fails, the built-in reader's result is used.
- **Built-in OCR**: no AI, free.
- **AI vision model**: the page image goes straight to a vision model.

## Never reaching the memory limit (no 502 restarts)

Render restarts the whole service when anything in it runs out of memory, and
every request during the restart gets 502. So on small servers the service:

- reads PDFs in batches of 4 pages (then page by page, then skips only that
  page's figures) in short-lived helpers, each with a hard memory budget;
- watches real container memory and stops a helper itself ~45 MB before the
  limit (`QPG_MEMORY_MARGIN_MB`), returning a normal error instead;
- keeps OCR lean (800 px working size): measured peak ~445 MB of 512 for the
  whole service across a 20-page image-heavy PDF, extreme photos and OCR.

Slow steps also run as background jobs (see `boot.py`), so no request is held
open long enough for a gateway to answer 502/504.

## Stability: locked versions + build-time self-test

- The Docker build installs `requirements.lock`, the exact library versions
  the service was tested with. A new library release (like pypdf 7.0, which
  removed a setting and broke PDF reading) can't change the service by itself.
- Every build runs `selftest.py`: it reads a PDF, finds figures, renders
  previews, runs OCR, builds Word files and calls the endpoints. If anything
  fails, the build fails, and Render keeps the previous working version live.
- Unexpected server errors come back as a readable message, not a crash.

To upgrade libraries: edit `requirements.txt`, install it in a fresh Python 3.11
venv, run `python selftest.py`, then regenerate the lock with
`pip freeze > requirements.lock` (keep the header comment).

## Keeping it in sync with the Streamlit app

`core/qpg_core.py` is generated from the Streamlit app's `app.py`. Never edit
it by hand. After changing `app.py`, re-sync and redeploy:

```bash
python sync_core.py /path/to/Question-Paper-Generator-new-/app.py
```

## Run locally

```bash
pip install -r requirements.txt
cp .env.example .env   # fill in values, then export them
uvicorn main:app --port 8000
```

`QPG_AUTH_DISABLED=1` skips the login check. Use it **only** for local testing.
