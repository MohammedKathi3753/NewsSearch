"""Supabase helpers: token validation + PostgREST access.

- User requests are forwarded to Supabase PostgREST with the end-user's JWT so
  that PostgreSQL Row Level Security is enforced by the database itself.
- Service-role calls (background ingestion / retention) use the secret key and
  never touch the HTTP request path.
"""
import os
import threading
import time
from functools import wraps

import requests
from flask import g, request

def _project_origin(raw: str) -> str:
    """Accept either the bare project URL or one pasted with /rest/v1 etc."""
    from urllib.parse import urlparse

    parsed = urlparse(raw.strip())
    return f"{parsed.scheme}://{parsed.netloc}" if parsed.scheme and parsed.netloc else ""


SUPABASE_URL = _project_origin(os.environ.get("SUPABASE_URL") or "")
SUPABASE_KEY = (os.environ.get("SUPABASE_PUBLISHABLE_KEY") or os.environ.get("SUPABASE_ANON_KEY") or "")
SUPABASE_SECRET = (os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "")


def supabase_configured() -> bool:
    return bool(SUPABASE_URL and SUPABASE_KEY)


def service_configured() -> bool:
    return bool(SUPABASE_URL and SUPABASE_SECRET)


class ApiError(Exception):
    def __init__(self, code: str, status: int, message: str | None = None):
        super().__init__(message or code)
        self.code = code
        self.status = status
        self.message = message or code


_user_cache: dict = {}
_cache_lock = threading.Lock()
_CACHE_TTL = 300


def bearer_token() -> str | None:
    header = request.headers.get("Authorization", "")
    scheme, _, token = header.partition(" ")
    token = token.strip()
    return token if scheme.lower() == "bearer" and token else None


def get_user(token: str) -> dict:
    with _cache_lock:
        hit = _user_cache.get(token)
        if hit and hit[1] > time.time():
            return hit[0]
    try:
        response = requests.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}"},
            timeout=8,
        )
    except requests.RequestException:
        raise ApiError("auth_unavailable", 503, "Authentication service is unreachable. Try again shortly.")
    if response.status_code != 200:
        raise ApiError("invalid_or_expired_token", 401, "Your session is invalid or has expired. Please sign in again.")
    user = response.json()
    with _cache_lock:
        if len(_user_cache) > 2000:
            _user_cache.clear()
        _user_cache[token] = (user, time.time() + _CACHE_TTL)
    return user


def require_auth(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        token = bearer_token()
        if not token:
            raise ApiError("missing_token", 401, "Sign in to use this feature.")
        g.token = token
        g.user = get_user(token)
        return fn(*args, **kwargs)

    return wrapper


def _rest(method: str, key: str, token: str, table: str, params=None, json_body=None, prefer=None):
    headers = {"apikey": key, "Authorization": f"Bearer {token}", "Accept": "application/json"}
    if prefer:
        headers["Prefer"] = prefer
    response = requests.request(
        method,
        f"{SUPABASE_URL}/rest/v1/{table}",
        headers=headers,
        params=params,
        json=json_body,
        timeout=15,
    )
    if response.status_code >= 400:
        raise ApiError("database_request_failed", 502, f"Database request failed ({response.status_code}).")
    if not response.content:
        return []
    try:
        return response.json()
    except ValueError:
        return []


def rest_user(method: str, table: str, token: str, params=None, json_body=None, prefer=None):
    """PostgREST call with the end-user's JWT: Postgres RLS applies."""
    return _rest(method, SUPABASE_KEY, token, table, params, json_body, prefer)


def rest_service(method: str, table: str, params=None, json_body=None, prefer=None):
    """PostgREST call with the service-role key: background jobs only."""
    return _rest(method, SUPABASE_SECRET, SUPABASE_SECRET, table, params, json_body, prefer)


def auth_health() -> bool:
    if not supabase_configured():
        return False
    try:
        response = requests.get(f"{SUPABASE_URL}/auth/v1/health", headers={"apikey": SUPABASE_KEY}, timeout=4)
        return response.status_code == 200
    except requests.RequestException:
        return False
