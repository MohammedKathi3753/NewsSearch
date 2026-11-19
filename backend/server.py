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
from groq_client import LANGUAGE_NAMES, assess_claim, groq_available, summarize_evidence
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
    expose_headers=["Content-Disposition"],
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
    ok = supabase_configured() and checks["supabase_reachable"] and ml["loaded"]
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
    lang = str(data.get("lang") or "en").lower()[:5]
    if lang not in LANGUAGE_NAMES:
        lang = "en"

    ml = ml_model.predict(text)
    if ml is not None:
        # The baseline learned long-form writing style; short claims are unreliable.
        ml["reliability"] = "low" if len(text.split()) < 80 else "normal"
        ml.pop("top_features", None)
    keywords = ml_model.keywords(text)
    short_claim = len(text) <= 220
    query = re.sub(r"[\"“”]", "", text).strip() if short_claim else (" ".join(keywords[:8]) or text[:80])

    evidence, provider_results = providers.search_all(query)
    if short_claim and len(evidence) < 3 and keywords:
        # Fall back to keyword search when the exact phrasing finds little.
        more, more_results = providers.search_all(" ".join(keywords[:6]))
        seen = {item["fingerprint"] for item in evidence}
        evidence.extend(item for item in more if item["fingerprint"] not in seen)
        provider_results = more_results

    summary, summary_reason = None, None
    verdict, verdict_reason = None, None
    if groq_available():
        if evidence:
            verdict = assess_claim(text[:1500], evidence[:12], lang)
            verdict_reason = None if verdict else "groq_request_failed"
            summary = summarize_evidence(text[:1500], evidence[:10], lang)
            summary_reason = None if summary else "groq_request_failed"
        else:
            verdict = {"verdict": "insufficient", "confidence": "low", "reasoning": "", "citations": []}
    else:
        summary_reason = verdict_reason = "groq_not_configured"

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
        "ml_features": {"reliability": ml["reliability"]} if ml else None,
        "ml_model_version": ml["model_version"] if ml else None,
        "keywords": keywords,
        "evidence": [providers.public_item(i) for i in evidence[:12]],
        "ai_explanation": None,
        "ai_summary": summary,
        "evidence_verdict": verdict,
        "lang": lang,
        "providers_used": [r["provider"] for r in provider_results if r["status"] == "ok"],
        "providers_failed": providers_failed,
    }

    persisted = True
    if supabase_configured():
        try:
            try:
                saved = rest_user("POST", "analyses", g.token, json_body=row, prefer="return=representation")
            except ApiError as first_error:
                if first_error.code != "schema_column_missing":
                    raise
                # Migration 002 not applied yet: keep verdict + language inside the existing ml_features JSON.
                legacy = {k: v for k, v in row.items() if k not in ("evidence_verdict", "lang")}
                legacy["ml_features"] = {**(row["ml_features"] or {}), "evidence_verdict": verdict, "lang": lang}
                saved = rest_user("POST", "analyses", g.token, json_body=legacy, prefer="return=representation")
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
        "evidence_verdict": {"available": verdict is not None, "reason": verdict_reason, **(verdict or {})},
        "evidence_track": {
            "summary": {"available": summary is not None, "text": summary, "reason": summary_reason},
            "items": [providers.public_item(i) for i in evidence],
            "providers_used": row["providers_used"],
            "providers_failed": providers_failed,
        },
    }), 201


def _normalize(row: dict) -> dict:
    """Uniform analysis shape whether or not migration 002 is applied."""
    features = row.get("ml_features") or {}
    if not row.get("evidence_verdict") and isinstance(features, dict) and features.get("evidence_verdict"):
        row["evidence_verdict"] = features.get("evidence_verdict")
    if not row.get("lang") and isinstance(features, dict):
        row["lang"] = features.get("lang") or "en"
    if isinstance(features, dict):
        row["ml_features"] = {"reliability": features.get("reliability")} if features.get("reliability") else None
    row.pop("ai_explanation", None)
    row.pop("expires_at", None)
    return row


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
            "select": "*",
            "order": "created_at.desc",
            "limit": str(limit),
            "offset": str(offset),
        },
    )
    return jsonify([_normalize(r) for r in rows])


@flask_app.get("/api/analyses/<analysis_id>")
@require_auth
def get_analysis(analysis_id: str):
    if not UUID_RE.match(analysis_id):
        raise ApiError("invalid_id", 400, "The analysis id is not valid.")
    rows = rest_user("GET", "analyses", g.token, params={"id": f"eq.{analysis_id}", "limit": "1"})
    if not rows:
        raise ApiError("not_found", 404, "This analysis does not exist in your history.")
    return jsonify(_normalize(rows[0]))


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


SHARE_FIELDS = (
    "input_type", "input_text", "input_url", "source_title", "ml_available", "ml_label", "ml_probability",
    "ml_features", "ml_model_version", "evidence", "ai_summary", "evidence_verdict", "providers_used",
    "providers_failed", "created_at", "lang",
)


def _own_analysis(analysis_id: str) -> dict:
    if not UUID_RE.match(analysis_id):
        raise ApiError("invalid_id", 400, "The analysis id is not valid.")
    rows = rest_user("GET", "analyses", g.token, params={"id": f"eq.{analysis_id}", "limit": "1"})
    if not rows:
        raise ApiError("not_found", 404, "This analysis does not exist in your history.")
    return _normalize(rows[0])


@flask_app.get("/api/analyses/<analysis_id>/share")
@require_auth
def get_share(analysis_id: str):
    _own_analysis(analysis_id)
    rows = rest_user("GET", "shared_analyses", g.token, params={"analysis_id": f"eq.{analysis_id}", "limit": "1"})
    return jsonify({"shared": bool(rows), "token": rows[0]["token"] if rows else None})


@flask_app.post("/api/analyses/<analysis_id>/share")
@require_auth
def create_share(analysis_id: str):
    import secrets

    analysis = _own_analysis(analysis_id)
    existing = rest_user("GET", "shared_analyses", g.token, params={"analysis_id": f"eq.{analysis_id}", "limit": "1"})
    if existing:
        return jsonify({"shared": True, "token": existing[0]["token"]})
    token = secrets.token_urlsafe(18)
    snapshot = {key: analysis.get(key) for key in SHARE_FIELDS}
    rest_user(
        "POST",
        "shared_analyses",
        g.token,
        json_body={"token": token, "analysis_id": analysis_id, "owner_id": g.user["id"], "snapshot": snapshot},
        prefer="return=minimal",
    )
    return jsonify({"shared": True, "token": token}), 201


@flask_app.delete("/api/analyses/<analysis_id>/share")
@require_auth
def delete_share(analysis_id: str):
    _own_analysis(analysis_id)
    rest_user("DELETE", "shared_analyses", g.token, params={"analysis_id": f"eq.{analysis_id}"})
    return jsonify({"shared": False, "token": None})


@flask_app.get("/api/shared/<token>")
@require_auth
def view_shared(token: str):
    """Signed-in users only. The share token is looked up server-side, so
    shared rows are never listable through the database API."""
    if not re.match(r"^[A-Za-z0-9_-]{16,64}$", token):
        raise ApiError("invalid_token", 400, "This share link is not valid.")
    from supa import rest_service

    rows = rest_service(
        "GET", "shared_analyses", params={"token": f"eq.{token}", "select": "snapshot,created_at", "limit": "1"}
    )
    if not rows:
        raise ApiError("not_found", 404, "This shared analysis no longer exists or sharing was turned off.")
    return jsonify({"analysis": rows[0]["snapshot"], "shared_at": rows[0]["created_at"]})


VERDICT_LABELS = {
    "supported": "Supported by sources",
    "contradicted": "Contradicted by fact-checks/sources",
    "mixed": "Mixed evidence",
    "insufficient": "Not enough evidence",
}


@flask_app.get("/api/export")
@require_auth
def export_history():
    import csv
    import io

    from flask import Response

    fmt = (request.args.get("format") or "csv").lower()
    if fmt not in ("csv", "pdf"):
        raise ApiError("invalid_format", 400, "Format must be csv or pdf.")
    rows = [_normalize(r) for r in rest_user("GET", "analyses", g.token, params={"select": "*", "order": "created_at.desc", "limit": "50"})]
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d-%H%M")

    def verdict_of(row):
        v = row.get("evidence_verdict") or {}
        return VERDICT_LABELS.get(v.get("verdict"), "—"), v.get("confidence") or "", v.get("reasoning") or ""

    if fmt == "csv":
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow([
            "created_at", "input_type", "claim_or_text", "url", "search_verdict", "verdict_confidence",
            "verdict_reasoning", "evidence_summary", "language_model_label", "language_model_p_real",
            "evidence_count", "evidence_sources",
        ])
        for row in rows:
            label, confidence, reasoning = verdict_of(row)
            evidence = row.get("evidence") or []
            writer.writerow([
                row.get("created_at"), row.get("input_type"), (row.get("input_text") or "")[:2000],
                row.get("input_url") or "", label, confidence, reasoning, row.get("ai_summary") or "",
                row.get("ml_label") or "", row.get("ml_probability") if row.get("ml_probability") is not None else "",
                len(evidence), " | ".join(f"{e.get('title')} <{e.get('url')}>" for e in evidence[:8]),
            ])
        data = "\ufeff" + buffer.getvalue()
        return Response(
            data.encode("utf-8"),
            mimetype="text/csv",
            headers={"Content-Disposition": f'attachment; filename="newssearch-history-{stamp}.csv"'},
        )

    from xml.sax.saxutils import escape as _escape

    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer

    font_dir = ROOT_DIR / "fonts"
    for family in ("NotoSans", "NotoSansDevanagari", "NotoSansGujarati"):
        if family not in pdfmetrics.getRegisteredFontNames():
            pdfmetrics.registerFont(TTFont(family, str(font_dir / f"{family}-Regular.ttf")))
            pdfmetrics.registerFont(TTFont(f"{family}-Bold", str(font_dir / f"{family}-Bold.ttf")))
            pdfmetrics.registerFontFamily(family, normal=family, bold=f"{family}-Bold", italic=family, boldItalic=f"{family}-Bold")

    script_runs = re.compile(r"([\u0900-\u097F\u1CD0-\u1CFF\uA8E0-\uA8FF]+(?: +[\u0900-\u097F\u1CD0-\u1CFF\uA8E0-\uA8FF]+)*"
                             r"|[\u0A80-\u0AFF]+(?: +[\u0A80-\u0AFF]+)*)")

    def escape(text: str) -> str:
        """Escape for reportlab markup and wrap Hindi/Gujarati runs in fonts that have those glyphs."""
        parts = []
        for chunk in script_runs.split(str(text)):
            if not chunk:
                continue
            if re.match(r"[\u0900-\u097F\u1CD0-\u1CFF\uA8E0-\uA8FF]", chunk):
                parts.append(f"<font name='NotoSansDevanagari'>{_escape(chunk)}</font>")
            elif re.match(r"[\u0A80-\u0AFF]", chunk):
                parts.append(f"<font name='NotoSansGujarati'>{_escape(chunk)}</font>")
            else:
                parts.append(_escape(chunk))
        return "".join(parts)

    out = io.BytesIO()
    doc = SimpleDocTemplate(out, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=18 * mm, bottomMargin=18 * mm,
                            title="NewsSearch analysis history")
    base = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=base["Heading1"], fontName="NotoSans-Bold", fontSize=18, spaceAfter=4)
    h2 = ParagraphStyle("h2", parent=base["Heading3"], fontName="NotoSans-Bold", fontSize=11, spaceBefore=8, spaceAfter=2)
    body = ParagraphStyle("b", parent=base["BodyText"], fontName="NotoSans", fontSize=9, leading=13)
    small = ParagraphStyle("s", parent=body, fontSize=8, textColor="#76726E")
    story = [
        Paragraph("NewsSearch — analysis history", h1),
        Paragraph(f"Exported {escape(stamp)} UTC · {len(rows)} analyses · {escape(g.user.get('email') or '')}", small),
        Spacer(1, 6),
    ]
    for row in rows:
        label, confidence, reasoning = verdict_of(row)
        story.append(HRFlowable(width="100%", color="#2C2A29", thickness=0.6))
        story.append(Paragraph(escape(f"{row.get('created_at', '')[:16].replace('T', ' ')} · {row.get('input_type')}"), small))
        story.append(Paragraph(escape((row.get("source_title") or row.get("input_text") or "")[:500]), h2))
        story.append(Paragraph(f"<b>Search-based verdict:</b> {escape(label)}" + (f" ({escape(confidence)} confidence)" if confidence else ""), body))
        if reasoning:
            story.append(Paragraph(escape(reasoning), body))
        if row.get("ai_summary"):
            story.append(Paragraph(f"<b>Evidence summary:</b> {escape(row['ai_summary'])}", body))
        if row.get("ml_available") and row.get("ml_probability") is not None:
            story.append(Paragraph(
                escape(f"Language-pattern signal (experimental, separate from the verdict): P(real) = {row['ml_probability']:.2f}"), small))
        for item in (row.get("evidence") or [])[:6]:
            story.append(Paragraph(f"• {escape(item.get('title') or '')} — <font color='#7D846C'>{escape(item.get('url') or '')}</font>", small))
        story.append(Spacer(1, 6))
    if not rows:
        story.append(Paragraph("No analyses in your history.", body))
    doc.build(story)
    return Response(
        out.getvalue(),
        mimetype="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="newssearch-history-{stamp}.pdf"'},
    )


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
