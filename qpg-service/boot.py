"""
Fast-starting entry point. On small instances (e.g. Render free, 0.1 CPU)
loading the PDF/OCR/AI libraries takes over a minute; without this the
port stays closed meanwhile and the host answers every request with 502.

This opens the port at once, answers /health, and loads the real app
(main.py) in the background. Until it is ready, other requests get a
503 "starting up" reply (with CORS headers, so the admin panel can read
it and retry).
"""

import importlib
import json
import threading
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


async def app(scope, receive, send):
    if _app is not None and scope["type"] != "lifespan":
        await _app(scope, receive, send)
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
