# Iteration 3: retest of fixes - verdict/lang fallback persistence, share 503, PDF Devanagari, /api/ready
import csv
import io
import re
import sys
import time

import pytest
import requests

from test_newssearch_api import BASE_URL, _token

DEVANAGARI = re.compile(r"[\u0900-\u097F]")
CREATED = []


@pytest.fixture(scope="module")
def h1():
    return {"Authorization": f"Bearer {_token('tester.newssearch@example.com')}"}


@pytest.fixture(scope="module", autouse=True)
def cleanup(h1):
    yield
    # ids kept for UI check; set ITER3_CLEANUP=1 to delete immediately
    import os
    open("/tmp/iter3_ids.txt", "w").write("\n".join(CREATED))
    if os.environ.get("ITER3_CLEANUP") == "1":
        for aid in CREATED:
            requests.delete(f"{BASE_URL}/api/analyses/{aid}", headers=h1, timeout=20)


def _analyze(h, text, lang="en"):
    r = requests.post(f"{BASE_URL}/api/analyze", headers=h, json={"text": text, "lang": lang}, timeout=120)
    assert r.status_code == 201, r.text[:500]
    d = r.json()
    if d.get("id"):
        CREATED.append(d["id"])
    return d


@pytest.fixture(scope="module")
def en_row(h1):
    return _analyze(h1, "TEST_ The Eiffel Tower is in Paris")


@pytest.fixture(scope="module")
def hi_row(h1, en_row):
    time.sleep(6)
    return _analyze(h1, "TEST_ Drinking bleach cures COVID-19", lang="hi")


# Ready endpoint (FIX 4)
def test_ready_200_now():
    r = requests.get(f"{BASE_URL}/api/ready", timeout=20)
    assert r.status_code == 200, r.text
    assert r.json()["checks"]["supabase_reachable"] is True


def test_ready_503_when_supabase_unreachable(monkeypatch):
    sys.path.insert(0, "/app/backend")
    import server
    monkeypatch.setattr(server, "auth_health", lambda: False)
    r = server.flask_app.test_client().get("/api/ready")
    assert r.status_code == 503
    assert r.get_json()["ok"] is False and r.get_json()["checks"]["supabase_reachable"] is False


# Verdict + lang persistence via ml_features fallback (FIX 1)
def test_analyze_persisted(en_row):
    assert en_row["persisted"] is True and en_row["id"]
    assert en_row["evidence_verdict"]["available"] is True, en_row["evidence_verdict"]


def _assert_norm(row, lang):
    assert "ai_explanation" not in row
    assert row["lang"] == lang
    assert row.get("evidence_verdict") and row["evidence_verdict"].get("verdict") in (
        "supported", "contradicted", "mixed", "insufficient")
    assert not (row.get("ml_features") or {}).get("evidence_verdict")
    assert not (row.get("ml_features") or {}).get("lang")


def test_list_contains_verdict_and_lang(h1, en_row, hi_row):
    r = requests.get(f"{BASE_URL}/api/analyses", headers=h1, timeout=30)
    assert r.status_code == 200
    rows = {x["id"]: x for x in r.json()}
    for x in r.json():
        assert "ai_explanation" not in x
    _assert_norm(rows[en_row["id"]], "en")
    _assert_norm(rows[hi_row["id"]], "hi")


def test_get_one_contains_verdict_and_lang(h1, en_row):
    r = requests.get(f"{BASE_URL}/api/analyses/{en_row['id']}", headers=h1, timeout=30)
    assert r.status_code == 200
    _assert_norm(r.json(), "en")
    assert r.json()["evidence_verdict"]["verdict"] == en_row["evidence_verdict"]["verdict"]


def test_csv_verdict_filled(h1, en_row, hi_row):
    r = requests.get(f"{BASE_URL}/api/export?format=csv", headers=h1, timeout=60)
    assert r.status_code == 200
    rows = list(csv.DictReader(io.StringIO(r.content.decode("utf-8-sig"))))
    recent = [x for x in rows if x["claim_or_text"].startswith("TEST_ ")][:2]
    assert len(recent) == 2
    for x in recent:
        assert x["search_verdict"] not in ("", "—"), x


# PDF Devanagari (FIX 3)
def test_pdf_contains_devanagari(h1, hi_row):
    import fitz
    r = requests.get(f"{BASE_URL}/api/export?format=pdf", headers=h1, timeout=90)
    assert r.status_code == 200 and r.content[:4] == b"%PDF"
    doc = fitz.open(stream=r.content, filetype="pdf")
    text = "".join(p.get_text() for p in doc)
    fonts = {f[3] for p in doc for f in p.get_fonts()}
    print("FONTS:", fonts)
    assert DEVANAGARI.search(text), "no Devanagari in extracted PDF text"
    assert any("Devanagari" in f for f in fonts)


# Share endpoints w/o migration -> 503 database_update_required (FIX 2)
@pytest.mark.parametrize("method", ["GET", "POST"])
def test_share_503(h1, en_row, method):
    t = time.time()
    r = requests.request(method, f"{BASE_URL}/api/analyses/{en_row['id']}/share", headers=h1, timeout=30)
    assert time.time() - t < 5
    assert r.status_code == 503, r.text
    assert "database_update_required" in r.text
