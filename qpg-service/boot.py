"""
Fast-starting entry point. On small instances (e.g. Render free, 0.1 CPU)
loading the PDF/OCR/AI libraries takes over a minute; without this the
port stays closed meanwhile and the host answers every request with 502.

This opens the port at once, answers /health, and loads the real app
(main.py) in the background. Until it is ready, other requests get a
503 "starting up" reply (with CORS headers, so the admin panel can read
it and retry).
"""

import asyncio
import hashlib
import importlib
import json
import os
import secrets
import threading
import time
import traceback

_app = None
_error = None


def _load():
    global _app, _error

    try:
        _app = importlib.import_module("main").app
    except Exception:  # noqa: BLE001 — reported through /health
        _error = traceback.format_exc(limit=3)
        print(_error, flush=True)


threading.Thread(target=_load, name="load-main", daemon=True).start()

_CORS_HEADERS = [
    (b"access-control-allow-origin", b"*"),
    (b"access-control-allow-headers", b"*"),
    (b"access-control-allow-methods", b"*"),
]


async def _lifespan(receive, send):
    while True:
        message = await receive()

        if message["type"] == "lifespan.startup":
            await send({"type": "lifespan.startup.complete"})
        elif message["type"] == "lifespan.shutdown":
            await send({"type": "lifespan.shutdown.complete"})
            return


async def _safe_call(scope, receive, send):
    """
    Last line of defence: if anything in the app raises unexpectedly, the
    admin panel still gets a readable JSON message (with CORS headers, so
    the browser lets it read it) instead of a bare crash.
    """

    started = False

    async def tracking_send(message):
        nonlocal started

        if message["type"] == "http.response.start":
            started = True

        await send(message)

    try:
        await _app(scope, receive, tracking_send)
    except Exception as error:  # noqa: BLE001
        traceback.print_exc()

        if scope["type"] != "http" or started:
            return

        body = json.dumps({
            "detail": (
                "Something unexpected went wrong on the Questions generator server "
                f"({type(error).__name__}: {str(error)[:200]}). Please try again; "
                "if it keeps happening, send this message to the developer."
            )
        }).encode()
        headers = [(b"content-type", b"application/json")] + _CORS_HEADERS
        await send({"type": "http.response.start", "status": 500, "headers": headers})
        await send({"type": "http.response.body", "body": body})


# ---------------------------------------------------------------------------
# BACKGROUND JOBS — no long-running HTTP requests.
#
# On a slow instance a PDF analysis or an AI page can take minutes. A
# request held open that long is what gateways answer with 502/504, and a
# restart or redeploy in the middle drops it. So a slow request sent with
# "X-QG-Async: 1" is answered at once with 202 {"job": id}; the real work
# runs here in the background, and the admin panel polls GET /jobs/<id>
# (short requests) until the original response is ready. The endpoints
# themselves are unchanged: the job replays the exact same request into
# the app and stores its response.
# ---------------------------------------------------------------------------
ASYNC_PATHS = {
    "/generate/prepare",
    "/generate/page",
    "/generate/finalize",
    "/extract/prepare",
    "/extract/page",
    "/docx",
    "/bank-format",
}
JOB_KEEP_SECONDS = 15 * 60  # finished results are kept this long
# Set QPG_ASYNC_JOBS=0 on hosts that only give CPU while a request is open
# (Google Cloud Run's default billing) and allow long requests anyway: slow
# requests are then simply processed while the request waits, as before.
ASYNC_JOBS = os.environ.get("QPG_ASYNC_JOBS", "1").strip().lower() not in ("0", "false", "no", "off")
_jobs = {}
_ALLOWED_ORIGINS = [
    origin.strip() for origin in os.environ.get("QPG_ALLOWED_ORIGINS", "*").split(",") if origin.strip()
]


def _header(scope, name):
    name = name.lower().encode()

    for key, value in scope.get("headers", []):
        if key.lower() == name:
            return value.decode("latin-1")

    return ""


def _cors(scope, expose=False):
    origin = _header(scope, "origin")
    allow = "*" if "*" in _ALLOWED_ORIGINS else (origin if origin in _ALLOWED_ORIGINS else "")
    headers = []

    if allow:
        headers += [(b"access-control-allow-origin", allow.encode()), (b"vary", b"Origin")]

    if expose:
        headers.append((b"access-control-expose-headers", b"Content-Disposition, X-QG-Job-Status"))

    return headers


def _auth_fingerprint(scope):
    return hashlib.sha256(_header(scope, "authorization").encode()).hexdigest()


def _cleanup_jobs():
    now = time.time()

    for job_id in [job_id for job_id, job in _jobs.items() if job.get("expires", now + 1) < now]:
        _jobs.pop(job_id, None)


async def _send_json(send, scope, status, payload, extra_headers=()):
    body = json.dumps(payload).encode()
    headers = [(b"content-type", b"application/json"), (b"cache-control", b"no-store")]
    headers += _cors(scope, expose=True) + list(extra_headers)
    await send({"type": "http.response.start", "status": status, "headers": headers})
    await send({"type": "http.response.body", "body": body})


async def _read_body(receive):
    chunks = []

    while True:
        message = await receive()

        if message["type"] == "http.disconnect":
            raise ConnectionError("client disconnected while uploading")

        chunks.append(message.get("body", b""))

        if not message.get("more_body"):
            return b"".join(chunks)


async def _run_job(job, scope, body):
    """Replays the original request into the app and stores its response."""

    finished = asyncio.Event()
    delivered = False
    status = 500
    headers = []
    chunks = []

    async def job_receive():
        nonlocal delivered

        if not delivered:
            delivered = True
            return {"type": "http.request", "body": body, "more_body": False}

        await finished.wait()  # never report a disconnect while the work runs
        return {"type": "http.disconnect"}

    async def job_send(message):
        nonlocal status, headers

        if message["type"] == "http.response.start":
            status = message["status"]
            headers = list(message.get("headers", []))
        elif message["type"] == "http.response.body":
            chunks.append(message.get("body", b""))

    try:
        await _safe_call(scope, job_receive, job_send)
    except Exception as error:  # noqa: BLE001 — stored as the job's result
        traceback.print_exc()
        status = 500
        headers = [(b"content-type", b"application/json")]
        chunks = [json.dumps({"detail": f"Unexpected server error ({type(error).__name__}: {error})"}).encode()]
    finally:
        finished.set()

    keep = [
        (key, value) for key, value in headers
        if key.lower() in (b"content-type", b"content-disposition")
    ]
    job.update(status="done", http_status=status, headers=keep, body=b"".join(chunks), expires=time.time() + JOB_KEEP_SECONDS)


async def _start_job(scope, receive, send):
    _cleanup_jobs()

    try:
        body = await _read_body(receive)
    except ConnectionError:
        return

    job_id = secrets.token_urlsafe(18)
    job = {"status": "running", "owner": _auth_fingerprint(scope), "expires": time.time() + 6 * 60 * 60}
    _jobs[job_id] = job

    job_scope = dict(scope)
    job_scope["headers"] = [(k, v) for k, v in scope.get("headers", []) if k.lower() != b"x-qg-async"]
    job["task"] = asyncio.get_running_loop().create_task(_run_job(job, job_scope, body))

    await _send_json(send, scope, 202, {"job": job_id})


async def _poll_job(scope, send, job_id):
    _cleanup_jobs()
    job = _jobs.get(job_id)

    if job is None or job["owner"] != _auth_fingerprint(scope):
        # Unknown here: finished long ago, or lost in a restart. The admin
        # panel then submits the request again.
        await _send_json(send, scope, 404, {"detail": "Job not found — it may have been lost in a server restart."})
        return

    if job["status"] != "done":
        await _send_json(send, scope, 200, {"status": "running"}, [(b"x-qg-job-status", b"running")])
        return

    headers = list(job["headers"]) + [(b"x-qg-job-status", b"done"), (b"cache-control", b"no-store")]
    headers += _cors(scope, expose=True)
    await send({"type": "http.response.start", "status": job["http_status"], "headers": headers})
    await send({"type": "http.response.body", "body": job["body"]})

    # Keep it a little longer in case this reply is lost on the way.
    job["expires"] = min(job["expires"], time.time() + 120)


async def app(scope, receive, send):
    if _app is not None and scope["type"] == "http":
        path = scope.get("path", "")
        method = scope.get("method", "")

        if method == "GET" and path.startswith("/jobs/"):
            await _poll_job(scope, send, path[len("/jobs/"):])
            return

        if ASYNC_JOBS and method == "POST" and path in ASYNC_PATHS and _header(scope, "x-qg-async") == "1":
            await _start_job(scope, receive, send)
            return

    if _app is not None and scope["type"] != "lifespan":
        await _safe_call(scope, receive, send)
        return

    if scope["type"] == "lifespan":
        await _lifespan(receive, send)
        return

    if scope["type"] != "http":
        return

    path = scope.get("path", "")

    if scope.get("method") == "OPTIONS":
        status, payload = 204, None
    elif path == "/health":
        status = 200 if _error is None else 500
        payload = {"ok": _error is None, "starting": True, "error": _error}
    else:
        status = 503
        payload = {
            "detail": (
                "The Questions generator service is starting up — try again in a minute."
                if _error is None
                else "The Questions generator service failed to start. Check its logs."
            )
        }

    body = b"" if payload is None else json.dumps(payload).encode()
    headers = [(b"content-type", b"application/json"), (b"retry-after", b"15")] + _CORS_HEADERS
    await send({"type": "http.response.start", "status": status, "headers": headers})
    await send({"type": "http.response.body", "body": body})
