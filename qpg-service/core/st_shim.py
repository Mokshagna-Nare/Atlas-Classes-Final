"""
Stand-in for the `streamlit` module so the Question Paper Generator's
core logic (qpg_core.py, copied from the Streamlit app by
sync_core.py) runs unchanged inside this web service.

- cache_data / cache_resource keep their caching behaviour.
- st.info / st.warning / st.error / st.success messages raised while a
  request is being handled are collected (see notices()) so the API
  can return them to the admin panel instead of drawing them.
- Everything else (layout, widgets, page config) is a harmless no-op.
"""

import copy
import functools
import hashlib
import os
import threading
from collections import OrderedDict

_local = threading.local()
_cache_lock = threading.Lock()


def reset_notices():
    _local.notices = []


def notices():
    return list(getattr(_local, "notices", []))


def _record(kind, message):
    if not hasattr(_local, "notices"):
        _local.notices = []
    _local.notices.append({"kind": kind, "text": str(message)})


def info(message="", *args, **kwargs):
    _record("info", message)


def warning(message="", *args, **kwargs):
    _record("warning", message)


def error(message="", *args, **kwargs):
    _record("error", message)


def success(message="", *args, **kwargs):
    _record("success", message)


def _fingerprint(value):
    if isinstance(value, (bytes, bytearray, memoryview)):
        return ("bytes", hashlib.sha256(bytes(value)).hexdigest())
    if isinstance(value, (list, tuple)):
        return (type(value).__name__, tuple(_fingerprint(item) for item in value))
    if isinstance(value, dict):
        return ("dict", tuple(sorted((str(k), _fingerprint(v)) for k, v in value.items())))
    return ("value", repr(value))


def cache_data(func=None, *, max_entries=None, **_ignored):
    """Memoises on a fingerprint of the arguments (bytes hashed)."""

    limit = max_entries or int(os.environ.get("QPG_CACHE_ENTRIES", "8"))

    def decorate(function):
        store = OrderedDict()

        @functools.wraps(function)
        def wrapper(*args, **kwargs):
            key = (_fingerprint(args), _fingerprint(kwargs))

            with _cache_lock:
                if key in store:
                    store.move_to_end(key)
                    return copy.deepcopy(store[key])

            result = function(*args, **kwargs)

            with _cache_lock:
                store[key] = result
                while len(store) > limit:
                    store.popitem(last=False)

            return copy.deepcopy(result)

        wrapper.clear = store.clear
        return wrapper

    return decorate(func) if callable(func) else decorate


def cache_resource(func=None, **_ignored):
    """One shared instance per argument set (e.g. the OCR engine)."""

    def decorate(function):
        cached = functools.lru_cache(maxsize=None)(function)
        lock = threading.Lock()

        @functools.wraps(function)
        def wrapper(*args, **kwargs):
            with lock:
                return cached(*args, **kwargs)

        wrapper.clear = cached.cache_clear
        return wrapper

    return decorate(func) if callable(func) else decorate


def dialog(*_args, **_kwargs):
    def decorate(function):
        return function

    return decorate


class _NoOp:
    """Absorbs any attribute access, call or `with` block."""

    def __call__(self, *args, **kwargs):
        return self

    def __getattr__(self, name):
        return self

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def __iter__(self):
        return iter(())

    def __bool__(self):
        return False


session_state = {}


def __getattr__(name):
    return _NoOp()
