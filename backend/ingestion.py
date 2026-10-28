"""Background ingestion (fact-check feeds -> evidence_pool), grounded
notifications for users whose recent analyses match new records, and the
daily retention purge. All DB writes here use the service-role key.
"""
import logging
import os
import subprocess
import sys
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path

from apscheduler.schedulers.background import BackgroundScheduler

import ml_model
import providers
from supa import rest_service, service_configured

log = logging.getLogger("newssearch.ingestion")

INGEST_TARGETS = [
    ("politifact", None),
    ("euvsdisinfo", None),
    ("gdelt", "fact check"),
]
_ENV_TARGETS = {
    "AFP_FACTCHECK_FEED_URL": "afp_factcheck",
    "AFRICA_CHECK_FEED_URL": "africa_check",
}


def train_if_missing():
    def _job():
        try:
            if ml_model.status()["loaded"]:
                return
            log.info("model missing — training the baseline now (background)")
            subprocess.run(
                [sys.executable, str(Path(__file__).parent / "train_model.py")],
                check=False,
                timeout=570,
            )
            ml_model.load_model()
        except Exception as exc:  # noqa: BLE001
            log.warning("background training failed: %s", exc)

    threading.Thread(target=_job, daemon=True).start()


def ingest_job():
    if not service_configured():
        return
    targets = list(INGEST_TARGETS)
    for env_name, provider_name in _ENV_TARGETS.items():
        if os.environ.get(env_name):
            targets.append((provider_name, None))
    all_items = []
    for name, query in targets:
        provider = providers.get_provider(name)
        if not provider or not provider.available():
            continue
        try:
            all_items.extend(provider.fetch(query or "") or [])
        except Exception as exc:  # noqa: BLE001
            log.warning("ingest %s failed: %s", name, exc)
    all_items = all_items[:120]
    if not all_items:
        return
    fingerprints = [item["fingerprint"] for item in all_items]
    try:
        existing_rows = rest_service(
            "GET",
            "evidence_pool",
            params={
                "select": "fingerprint",
                "fingerprint": "in.(%s)" % ",".join(f'"{f}"' for f in fingerprints),
            },
        )
        existing = {row["fingerprint"] for row in existing_rows}
    except Exception as exc:  # noqa: BLE001
        log.warning("evidence_pool lookup failed: %s", exc)
        existing = set()
    fresh = [item for item in all_items if item["fingerprint"] not in existing]
    if not fresh:
        return
    rows = [
        {
            "fingerprint": item["fingerprint"],
            "provider": item["provider"],
            "kind": item["kind"],
            "title": item["title"],
            "url": item["url"],
            "snippet": item["snippet"],
            "published_at": item["published_at"],
            "source": item["source"],
        }
        for item in fresh
    ]
    try:
        rest_service("POST", "evidence_pool", json_body=rows, prefer="resolution=merge-duplicates")
    except Exception as exc:  # noqa: BLE001
        log.warning("evidence_pool insert failed: %s", exc)
        return
    _notify(fresh)
    log.info("ingested %s new evidence records", len(fresh))


def _notify(fresh: list):
    since = (datetime.now(timezone.utc) - timedelta(days=14)).isoformat()
    try:
        analyses = rest_service(
            "GET",
            "analyses",
            params={
                "select": "id,user_id,keywords",
                "created_at": f"gte.{since}",
                "order": "created_at.desc",
                "limit": "300",
            },
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("recent analyses lookup failed: %s", exc)
        return
    if not analyses:
        return
    urls = sorted({item["url"] for item in fresh})[:100]
    try:
        existing_notifications = rest_service(
            "GET",
            "notifications",
            params={
                "select": "user_id,evidence_url",
                "evidence_url": "in.(%s)" % ",".join(f'"{u}"' for u in urls),
            },
        )
    except Exception:  # noqa: BLE001
        existing_notifications = []
    seen = {(n["user_id"], n["evidence_url"]) for n in existing_notifications}

    prepared: dict = {}
    for item in fresh:
        tokens = set(ml_model.keywords(item["title"] + " " + (item["snippet"] or ""), 14))
        for analysis in analyses:
            keywords = set(analysis.get("keywords") or [])
            overlap = keywords & tokens
            strong = len(overlap) >= 2 or any(len(token) >= 8 for token in overlap)
            if not strong:
                continue
            key = (analysis["user_id"], item["url"])
            if key in seen:
                continue
            seen.add(key)
            user_id = analysis["user_id"]
            prepared.setdefault(user_id, [])
            if len(prepared[user_id]) < 3:
                prepared[user_id].append({
                    "user_id": user_id,
                    "kind": "evidence_match",
                    "title": "New evidence related to your analysis",
                    "body": item["title"][:200],
                    "analysis_id": analysis["id"],
                    "evidence_url": item["url"],
                    "evidence_provider": item["provider"],
                })
    if not prepared:
        return
    rows = [notification for batch in prepared.values() for notification in batch]
    try:
        rest_service("POST", "notifications", json_body=rows, prefer="return=minimal")
    except Exception as exc:  # noqa: BLE001
        log.warning("notification insert failed: %s", exc)


def retention_job():
    if not service_configured():
        return
    try:
        rest_service("POST", "rpc/purge_expired_documents", json_body={"batch_size": 5000})
        log.info("retention purge executed")
    except Exception as exc:  # noqa: BLE001
        log.warning("retention purge failed: %s", exc)


def start_scheduler():
    scheduler = BackgroundScheduler(timezone="UTC")
    scheduler.add_job(
        ingest_job,
        "interval",
        minutes=20,
        id="ingest",
        max_instances=1,
        coalesce=True,
        next_run_time=datetime.now(timezone.utc) + timedelta(seconds=45),
    )
    scheduler.add_job(retention_job, "cron", hour=3, minute=17, id="retention", max_instances=1)
    scheduler.add_job(
        train_if_missing,
        "date",
        run_date=datetime.now(timezone.utc) + timedelta(seconds=5),
        id="bootstrap-train",
    )
    scheduler.start()
    log.info("background scheduler started (ingest every 20 min, retention daily)")
