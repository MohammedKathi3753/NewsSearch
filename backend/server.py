"""NewsSearch — Python Flask JSON API (served by Gunicorn).

Routes:
  /health          root-level probe for the platform (no /api prefix)
  /api/health      liveness
  /api/ready       readiness (model + Supabase + providers + Groq)
  /api/me          current user (validates Supabase token)
  /api/analyze     hybrid analysis: ML track + external evidence track
  /api/analyses    user history (PostgREST with user JWT -> Postgres RLS)
  /api/notifications
  /api/discover    worldwide multi-provider search
  /api/sources     curated primary sources
  /api/providers   provider health/status
"""
import datetime
import logging
import os
import re
import sys
import time
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, g, jsonify, request
from flask_cors import CORS

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import ml_model
import providers
import sources_data
from groq_client import explain_prediction, groq_available, summarize_evidence
from ingestion import start_scheduler
from ssrf import extract_article, safe_fetch
from supa import (
    ApiError,
    auth_health,
    require_auth,
    rest_user,
    service_configured,
    supabase_configured,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger("newssearch.api")

ANALYZE_MAX_TEXT = 10000
HISTORY_LIMIT = 50
UUID_RE = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")


def _now_iso():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def _cors_origins():
    """Restricted allow-list: this app's own frontends only. No wildcard."""
    origins = set()
    for item in (os.environ.get("APP_ORIGINS") or "").split(","):
        item = item.strip().rstrip("/")
        if item:
            origins.add(item)
    for candidate in (
        "http://localhost:19006",
        "http://localhost:3000",
        "http://localhost:8081",
        "http://127.0.0.1:19006",
        "https://localhost:19006",
    ):
        origins.add(candidate)
    try:
        frontend_env = Path("/app/frontend/.env").read_text()
        match = re.search(r"EXPO_PACKAGER_PROXY_URL=\"?([^\"\n]+)", frontend_env)
        if match:
            origins.add(match.group(1).strip().rstrip("/"))
    except OSError:
        pass
    # Platform hosting domains of this app (web preview + deployment).
    # Anchored so look-alike hosts (e.g. x.emergent.host.evil.com) never match.
    origins.add(r"^https://[a-z0-9-]+\.preview\.emergentagent\.com$")
    origins.add(r"^https://[a-z0-9-]+\.emergent\.host$")
    return sorted(origins)


flask_app = Flask(__name__)
flask_app.config["MAX_CONTENT_LENGTH"] = 1 * 1024 * 1024
CORS(
    flask_app,
    origins=_cors_origins(),
    methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "apikey"],
    max_age=600,
)

# ---------------------------------------------------------------------------
# Minimal in-memory rate limiting (per user / per route)
# ---------------------------------------------------------------------------
_rate: dict = {}
_RATE_LIMITS = {"/api/analyze": (30, 3600), "/api/discover": (120, 3600)}


def rate_limited(bucket: str, user_id: str | None):
    spec = _RATE_LIMITS.get(bucket)
    if not spec:
        return
    limit, window = spec
    key = (bucket, user_id or request.remote_addr or "anonymous")
    now = time.time()
    hits = [t for t in _rate.get(key, []) if now - t < window]
    if len(hits) >= limit:
        raise ApiError("rate_limited", 429, "Too many requests. Please try again later.")
    hits.append(now)
    _rate[key] = hits


# ---------------------------------------------------------------------------
# Public endpoints
# ---------------------------------------------------------------------------
@flask_app.route("/health", methods=["GET", "HEAD"])
def health_root():
    return jsonify({"status": "ok", "service": "newssearch-api"})


@flask_app.get("/api/health")
def health():
    return jsonify({"ok": True, "service": "newssearch-api", "time": _now_iso()})


@flask_app.get("/api/ready")
def ready():
    ml = ml_model.status()
    checks = {
        "supabase_configured": supabase_configured(),
        "supabase_service_configured": service_configured(),
        "supabase_reachable": auth_health() if supabase_configured() else False,
        "model_loaded": ml["loaded"],
        "model_version": ml.get("version"),
        "model_error": ml.get("error"),
        "groq_configured": groq_available(),
        "providers_enabled": providers.enabled_count(),
    }
    ok = supabase_configured() and ml["loaded"]
    return jsonify({"ok": ok, "degraded": not ok, "checks": checks}), (200 if ok else 503)


@flask_app.get("/api/sources")
def sources():
    return jsonify({"sources": sources_data.CURATED_SOURCES, "retrieved_at": _now_iso()})


# ---------------------------------------------------------------------------
# Authenticated endpoints
# ---------------------------------------------------------------------------
@flask_app.get("/api/me")
@require_auth
def me():
    return jsonify({
        "user": {"id": g.user["id"], "email": g.user.get("email")},
        "retention": {"max_history": HISTORY_LIMIT, "days": 30},
    })


@flask_app.post("/api/analyze")
@require_auth
def analyze():
    rate_limited("/api/analyze", g.user["id"])
    data = request.get_json(silent=True) or {}
    text = str(data.get("text") or "").strip()
    url = str(data.get("url") or "").strip()
    if not text and not url:
        raise ApiError("empty_input", 400, "Enter a claim, article text, or an article URL to analyze.")
    if len(text) > ANALYZE_MAX_TEXT:
        raise ApiError("input_too_long", 400, f"Text is too long (limit is {ANALYZE_MAX_TEXT} characters).")
    if url and not re.match(r"^https?://", url):
        raise ApiError("invalid_url", 400, "The article link must start with http:// or https://.")

    source_title = None
    if url:
        try:
            html_text = safe_fetch(url)
            extracted = extract_article(html_text)
            source_title = extracted.get("title") or None
            body = extracted.get("text") or ""
            if not body and not text:
                raise ApiError("url_extract_failed", 422, "No readable text could be extracted from this URL.")
            text = "\n\n".join(part for part in (text, body) if part)
        except ApiError:
            raise
        except Exception:
            raise ApiError("url_fetch_failed", 422, "This URL could not be fetched (unreachable, blocked, or not public).")
    text = text[:ANALYZE_MAX_TEXT]

    ml = ml_model.predict(text)
    keywords = ml_model.keywords(text)
    query = " ".join(keywords[:8]) or text[:80]

    evidence, provider_results = providers.search_all(query)

    explanation, explanation_reason = None, None
    summary, summary_reason = None, None
    if groq_available():
        if ml is not None:
            explanation = explain_prediction(text[:2000], ml)
            explanation_reason = None if explanation else "groq_request_failed"
        if evidence:
            summary = summarize_evidence(text[:1500], evidence[:10])
            summary_reason = None if summary else "groq_request_failed"
    else:
        explanation_reason = summary_reason = "groq_not_configured"

    providers_failed = [r for r in provider_results if r["status"] in ("error", "cooldown")]

    row = {
        "user_id": g.user["id"],
        "input_type": "url" if url else "text",
        "input_text": text[:4000],
        "input_url": url or None,
        "source_title": source_title,
        "ml_available": ml is not None,
        "ml_label": ml["label"] if ml else None,
        "ml_probability": ml["probabilities"]["real"] if ml else None,
        "ml_features": {"top": ml["top_features"]} if ml else None,
        "ml_model_version": ml["model_version"] if ml else None,
        "keywords": keywords,
        "evidence": [providers.public_item(i) for i in evidence[:12]],
        "ai_explanation": explanation,
        "ai_summary": summary,
        "providers_used": [r["provider"] for r in provider_results if r["status"] == "ok"],
        "providers_failed": providers_failed,
    }

    persisted = True
    if supabase_configured():
        try:
            saved = rest_user("POST", "analyses", g.token, json_body=row, prefer="return=representation")
            if saved:
                row["id"] = saved[0]["id"]
                row["created_at"] = saved[0]["created_at"]
        except ApiError as exc:
            persisted = False
            log.warning("history write failed for user %s: %s", g.user["id"], exc.code)
    else:
        persisted = False

    log.info(
        "analyze user=%s type=%s ml=%s evidence=%s providers=%s",
        g.user["id"],
        row["input_type"],
        (ml or {}).get("label"),
        len(evidence),
        ",".join(row["providers_used"]) or "-",
    )

    return jsonify({
        "id": row.get("id"),
        "created_at": row.get("created_at") or _now_iso(),
        "persisted": persisted,
        "input": {"type": row["input_type"], "text": text[:600], "url": url or None, "source_title": source_title},
        "ml_track": ml or {"available": False, "reason": "model_not_available"},
        "ai_explanation": {"available": explanation is not None, "text": explanation, "reason": explanation_reason},
        "evidence_track": {
            "summary": {"available": summary is not None, "text": summary, "reason": summary_reason},
            "items": [providers.public_item(i) for i in evidence],
            "providers_used": row["providers_used"],
            "providers_failed": providers_failed,
        },
    }), 201


@flask_app.get("/api/analyses")
@require_auth
def list_analyses():
    try:
        limit = min(max(int(request.args.get("limit", "50")), 1), 50)
        offset = max(int(request.args.get("offset", "0")), 0)
    except ValueError:
        raise ApiError("invalid_pagination", 400, "limit and offset must be integers.")
    rows = rest_user(
        "GET",
        "analyses",
        g.token,
        params={
            "select": "id,input_type,input_text,input_url,source_title,ml_available,ml_label,ml_probability,"
                      "evidence,providers_used,providers_failed,created_at",
            "order": "created_at.desc",
            "limit": str(limit),
            "offset": str(offset),
        },
    )
    return jsonify(rows)


@flask_app.get("/api/analyses/<analysis_id>")
@require_auth
def get_analysis(analysis_id: str):
    if not UUID_RE.match(analysis_id):
        raise ApiError("invalid_id", 400, "The analysis id is not valid.")
    rows = rest_user("GET", "analyses", g.token, params={"id": f"eq.{analysis_id}", "limit": "1"})
    if not rows:
        raise ApiError("not_found", 404, "This analysis does not exist in your history.")
    return jsonify(rows[0])


@flask_app.delete("/api/analyses/<analysis_id>")
@require_auth
def delete_analysis(analysis_id: str):
    if not UUID_RE.match(analysis_id):
        raise ApiError("invalid_id", 400, "The analysis id is not valid.")
    rest_user("DELETE", "analyses", g.token, params={"id": f"eq.{analysis_id}"})
    return jsonify({"ok": True})


@flask_app.delete("/api/analyses")
@require_auth
def clear_analyses():
    rest_user("DELETE", "analyses", g.token, params={"user_id": f"eq.{g.user['id']}"})
    return jsonify({"ok": True})


@flask_app.get("/api/notifications")
@require_auth
def list_notifications():
    rows = rest_user(
        "GET",
        "notifications",
        g.token,
        params={"select": "*", "order": "created_at.desc", "limit": "50"},
    )
    return jsonify(rows)


@flask_app.post("/api/notifications/<notification_id>/read")
@require_auth
def mark_notification_read(notification_id: str):
    if not UUID_RE.match(notification_id):
        raise ApiError("invalid_id", 400, "The notification id is not valid.")
    rest_user("PATCH", "notifications", g.token, params={"id": f"eq.{notification_id}"}, json_body={"read": True})
    return jsonify({"ok": True})


@flask_app.post("/api/notifications/read_all")
@require_auth
def mark_all_notifications_read():
    rest_user(
        "PATCH",
        "notifications",
        g.token,
        params={"user_id": f"eq.{g.user['id']}", "read": "eq.false"},
        json_body={"read": True},
    )
    return jsonify({"ok": True})


@flask_app.get("/api/discover")
@require_auth
def discover():
    rate_limited("/api/discover", g.user["id"])
    q = (request.args.get("q") or "").strip()
    kind = (request.args.get("kind") or "").strip()
    if len(q) < 2:
        raise ApiError("query_too_short", 400, "Enter at least 2 characters to search.")
    q = q[:200]
    if kind not in ("", "factcheck", "news"):
        kind = ""
    items, provider_results = providers.search_all(q, kinds=(kind or None))
    return jsonify({
        "query": q,
        "items": [providers.public_item(i) for i in items],
        "providers": provider_results,
        "retrieved_at": _now_iso(),
    })


@flask_app.get("/api/providers")
@require_auth
def provider_status():
    return jsonify({"providers": providers.describe()})


# ---------------------------------------------------------------------------
# Error handlers
# ---------------------------------------------------------------------------
@flask_app.errorhandler(ApiError)
def handle_api_error(exc: ApiError):
    return jsonify({"error": {"code": exc.code, "message": exc.message}}), exc.status


@flask_app.errorhandler(404)
def handle_not_found(_):
    return jsonify({"error": {"code": "not_found", "message": "Unknown endpoint."}}), 404


@flask_app.errorhandler(405)
def handle_method_not_allowed(_):
    return jsonify({"error": {"code": "method_not_allowed", "message": "Method not allowed."}}), 405


@flask_app.errorhandler(413)
def handle_too_large(_):
    return jsonify({"error": {"code": "payload_too_large", "message": "Request body is too large."}}), 413


@flask_app.errorhandler(Exception)
def handle_unexpected(exc: Exception):
    log.exception("unhandled error: %s", exc)
    return jsonify({"error": {"code": "internal_error", "message": "An unexpected error occurred."}}), 500


# ---------------------------------------------------------------------------
# Server entrypoints
# ---------------------------------------------------------------------------
ml_model.load_model()
if os.environ.get("NEWSSEARCH_DISABLE_SCHEDULER") != "1":
    start_scheduler()

# The platform's process manager starts this module with uvicorn; the target
# runtime is Gunicorn serving this same Flask app. Serve the Flask WSGI app
# directly under Gunicorn, and wrap it as ASGI when loaded by uvicorn.
if "gunicorn" in (sys.argv[0] or ""):
    app = flask_app
else:
    from a2wsgi import WSGIMiddleware

    app = WSGIMiddleware(flask_app)


if __name__ == "__main__":
    flask_app.run(host="0.0.0.0", port=8001, threaded=True)
