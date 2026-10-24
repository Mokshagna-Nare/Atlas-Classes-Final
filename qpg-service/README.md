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

## Deploy (Render)

1. Render → **New → Web Service** → connect this repository.
2. **Root directory:** `qpg-service` · **Runtime:** Docker.
3. **Instance type:** at least **2 GB RAM** (Render "Standard"). Figure
   detection plus OCR peaked at about 870 MB in testing, so 512 MB plans will
   crash.
4. **Environment variables** (see `.env.example`):
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`: same values as the admin panel's
     `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
   - `QPG_ALLOWED_ORIGINS`: your admin panel URL, e.g. `https://your-site.vercel.app`.
   - At least one AI key: `ANTHROPIC_API_KEY` (+ optional `CLAUDE_MODEL`),
     `AGENTROUTER_API_KEY`, or `OMNIROUTE_API_KEY`. Only providers with a key
     are offered in the admin panel. OCR extraction needs no key.
   - `SUPABASE_SERVICE_ROLE_KEY`: optional. It's only needed if your `users`
     table doesn't let a logged-in user read their own row (the admin check
     returns 403 for a real admin).
5. Deploy, then open `https://<service>.onrender.com/health`. It should show
   `{"ok": true, "ocr": true}`.
6. In the admin panel's hosting (Vercel → Project → Settings → Environment
   Variables), add `VITE_QUESTIONS_GENERATOR_API=https://<service>.onrender.com`
   and redeploy the frontend.

Other hosts work the same way, since it's a plain Docker image listening on
`$PORT`. On Google Cloud Run, set memory to 2 GiB and the request timeout to
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
