# Iteration 2: search-based verdict, ML demotion, lang, export (csv/pdf), share links
import re
import time
import pytest
import requests

from test_newssearch_api import BASE_URL, _token

DEVANAGARI = re.compile(r"[\u0900-\u097F]")


@pytest.fixture(scope="module")
def h1():
    return {"Authorization": f"Bearer {_token('tester.newssearch@example.com')}"}


@pytest.fixture(scope="module")
def h2():
    return {"Authorization": f"Bearer {_token('tester2.newssearch@example.com')}"}


def _analyze(h, text, lang="en"):
    r = requests.post(f"{BASE_URL}/api/analyze", headers=h, json={"text": text, "lang": lang}, timeout=120)
    assert r.status_code == 201, r.text[:500]
    return r.json()


@pytest.fixture(scope="module")
def true_claim(h1):
    return _analyze(h1, "The Eiffel Tower is in Paris")


@pytest.fixture(scope="module")
def false_claim(h1):
    time.sleep(8)
    return _analyze(h1, "Drinking bleach cures COVID-19")


@pytest.fixture(scope="module")
def hindi_claim(h1):
    time.sleep(8)
    return _analyze(h1, "Drinking bleach cures COVID-19", lang="hi")


def _check_shape(d):
    assert "ai_explanation" not in d
    assert "ai_explanation" not in d.get("ml_track", {})
    ml = d["ml_track"]
    assert "top_features" not in ml
    if ml.get("available", True) and "label" in ml:
        assert ml.get("reliability") in ("low", "normal")
    v = d["evidence_verdict"]
    assert "available" in v
    if v["available"]:
        assert v["verdict"] in ("supported", "contradicted", "mixed", "insufficient")
        assert v["confidence"] in ("low", "medium", "high")
        urls = {i["url"] for i in d["evidence_track"]["items"]}
        for c in v["citations"]:
            assert {"index", "title", "url"} <= set(c)
            assert c["url"] in urls
            assert d["evidence_track"]["items"][c["index"] - 1]["url"] == c["url"]


# Verdict
class TestVerdict:
    def test_true_claim(self, true_claim):
        _check_shape(true_claim)
        v = true_claim["evidence_verdict"]
        print("TRUE:", v.get("verdict"), v.get("confidence"), v.get("reason"), (v.get("reasoning") or "")[:200],
              "ml_rel=", true_claim["ml_track"].get("reliability"), "items=", len(true_claim["evidence_track"]["items"]))
        if not v["available"]:
            pytest.skip(f"verdict unavailable: {v.get('reason')}")
        assert v["verdict"] == "supported"

    def test_false_claim(self, false_claim):
        _check_shape(false_claim)
        v = false_claim["evidence_verdict"]
        print("FALSE:", v.get("verdict"), v.get("confidence"), v.get("reason"), (v.get("reasoning") or "")[:200],
              "items=", len(false_claim["evidence_track"]["items"]))
        if not v["available"]:
            pytest.skip(f"verdict unavailable: {v.get('reason')}")
        assert v["verdict"] == "contradicted"

    def test_hindi(self, hindi_claim):
        _check_shape(hindi_claim)
        v = hindi_claim["evidence_verdict"]
        print("HI:", v.get("verdict"), (v.get("reasoning") or "")[:200])
        if not v["available"]:
            pytest.skip(f"verdict unavailable: {v.get('reason')}")
        assert DEVANAGARI.search(v.get("reasoning") or ""), "reasoning not in Hindi"

    def test_persisted_detail_has_verdict(self, h1, true_claim):
        assert true_claim["persisted"] and true_claim["id"]
        r = requests.get(f"{BASE_URL}/api/analyses/{true_claim['id']}", headers=h1, timeout=20)
        assert r.status_code == 200
        body = r.json()
        print("DETAIL keys:", list(body.keys())[:20])
        blob = str(body)
        assert "evidence_verdict" in blob


# Export
class TestExport:
    def test_csv(self, h1):
        r = requests.get(f"{BASE_URL}/api/export?format=csv", headers=h1, timeout=60)
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("text/csv")
        first = r.content.decode("utf-8-sig").splitlines()[0]
        assert first.startswith("created_at,input_type,claim_or_text")

    def test_pdf(self, h1):
        r = requests.get(f"{BASE_URL}/api/export?format=pdf", headers=h1, timeout=90)
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("application/pdf")
        assert r.content[:4] == b"%PDF"
        open("/tmp/export.pdf", "wb").write(r.content)

    def test_bad_format(self, h1):
        r = requests.get(f"{BASE_URL}/api/export?format=xls", headers=h1, timeout=20)
        assert r.status_code == 400 and r.json()["error"]["code"] == "invalid_format"

    def test_no_auth(self):
        r = requests.get(f"{BASE_URL}/api/export?format=csv", timeout=20)
        assert r.status_code == 401


# Share links
class TestShare:
    def test_share_flow(self, h1, h2, true_claim):
        aid = true_claim["id"]
        url = f"{BASE_URL}/api/analyses/{aid}/share"
        r = requests.post(url, headers=h1, timeout=20)
        print("SHARE POST", r.status_code, r.text[:300])
        if r.status_code == 503:
            assert r.json()["error"]["code"] == "database_update_required"
            pytest.skip("migration 002 not applied (expected)")
        assert r.status_code in (200, 201)
        token = r.json()["token"]
        # idempotent
        r = requests.post(url, headers=h1, timeout=20)
        assert r.json()["token"] == token
        r = requests.get(url, headers=h1, timeout=20)
        assert r.json() == {"shared": True, "token": token}
        # tester2 cannot manage tester1's share
        r = requests.post(url, headers=h2, timeout=20)
        assert r.status_code == 404
        # tester2 can view by token
        r = requests.get(f"{BASE_URL}/api/shared/{token}", headers=h2, timeout=20)
        assert r.status_code == 200
        snap = r.json()["analysis"]
        assert snap["input_text"].startswith("The Eiffel Tower")
        assert "user_id" not in snap
        # unauthenticated
        assert requests.get(f"{BASE_URL}/api/shared/{token}", timeout=20).status_code == 401
        # invalid / unknown token
        assert requests.get(f"{BASE_URL}/api/shared/bad!", headers=h2, timeout=20).status_code in (400, 404)
        assert requests.get(f"{BASE_URL}/api/shared/{'a' * 24}", headers=h2, timeout=20).status_code == 404
        # tester2 cannot delete
        requests.delete(url, headers=h2, timeout=20)
        assert requests.get(f"{BASE_URL}/api/shared/{token}", headers=h2, timeout=20).status_code == 200
        # owner stops sharing
        r = requests.delete(url, headers=h1, timeout=20)
        assert r.status_code == 200 and r.json()["shared"] is False
        assert requests.get(f"{BASE_URL}/api/shared/{token}", headers=h2, timeout=20).status_code == 404

    def test_share_no_auth(self, true_claim):
        r = requests.post(f"{BASE_URL}/api/analyses/{true_claim['id']}/share", timeout=20)
        assert r.status_code == 401
