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
