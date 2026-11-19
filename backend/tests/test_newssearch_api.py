# NewsSearch API regression tests: health, auth gating, analyze, SSRF, history/RLS, discover, CORS
import os
import re
import pytest
import requests

def _env(path, key):
    if os.environ.get(key):
        return os.environ[key]
    for line in open(path):
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip().strip('"')
    return None

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or _env("/app/frontend/.env", "EXPO_PUBLIC_BACKEND_URL")).rstrip("/")
SUPA_URL = re.sub(r"/rest/v1/?$", "", _env("/app/backend/.env", "SUPABASE_URL").rstrip("/"))
SUPA_KEY = _env("/app/backend/.env", "SUPABASE_PUBLISHABLE_KEY")
PW = "NewsSearch#2026"


def _token(email):
    r = requests.post(f"{SUPA_URL}/auth/v1/token?grant_type=password",
                      headers={"apikey": SUPA_KEY, "Content-Type": "application/json"},
                      json={"email": email, "password": PW}, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"auth failed for {email}: {r.status_code} {r.text[:200]}")
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def t1():
    return {"Authorization": f"Bearer {_token('tester.newssearch@example.com')}"}


@pytest.fixture(scope="session")
def t2():
    return {"Authorization": f"Bearer {_token('tester2.newssearch@example.com')}"}


@pytest.fixture(scope="session")
def analysis(t1):
    r = requests.post(f"{BASE_URL}/api/analyze", headers=t1,
                      json={"text": "TEST_ Scientists confirm drinking bleach cures covid vaccine side effects, government hides truth"},
                      timeout=90)
    assert r.status_code == 201, r.text[:500]
    return r.json()


# Health / public
class TestPublic:
    def test_health_root(self):
        r = requests.get(f"{BASE_URL}/health", timeout=15)
        print("ROOT /health", r.status_code, r.text[:200])
        # NOTE: /health without /api is routed to the frontend by ingress
        assert r.status_code == 200

    def test_api_health(self):
        r = requests.get(f"{BASE_URL}/api/health", timeout=15)
        assert r.status_code == 200 and r.json()["ok"] is True

    def test_ready(self):
        r = requests.get(f"{BASE_URL}/api/ready", timeout=20)
        d = r.json()
        print("READY", d)
        assert r.status_code == 200 and d["ok"] is True and d["checks"]["model_loaded"] is True

    def test_sources(self):
        r = requests.get(f"{BASE_URL}/api/sources", timeout=15)
        assert r.status_code == 200 and isinstance(r.json()["sources"], list) and len(r.json()["sources"]) > 0


# Auth gating
@pytest.mark.parametrize("method,path", [("POST", "/api/analyze"), ("GET", "/api/analyses"),
                                         ("GET", "/api/notifications"), ("GET", "/api/discover?q=vaccine"),
                                         ("GET", "/api/providers"), ("GET", "/api/me"),
                                         ("DELETE", "/api/analyses")])
def test_private_requires_auth(method, path):
    r = requests.request(method, f"{BASE_URL}{path}", json={}, timeout=15)
    assert r.status_code == 401, f"{path} -> {r.status_code}"
    r2 = requests.request(method, f"{BASE_URL}{path}", headers={"Authorization": "Bearer garbage"}, json={}, timeout=15)
    assert r2.status_code == 401


# Analyze
class TestAnalyze:
    def test_analyze_shape(self, analysis):
        ml = analysis["ml_track"]
        assert ml["label"] in ("real", "fake", "likely_real", "likely_fake") or isinstance(ml["label"], str)
        assert set(ml["probabilities"].keys()) >= {"real", "fake"}
        assert abs(ml["probabilities"]["real"] + ml["probabilities"]["fake"] - 1) < 0.02
        assert isinstance(ml["top_features"], list)
        assert "available" in analysis["ai_explanation"]
        ev = analysis["evidence_track"]
        for k in ("items", "summary", "providers_used", "providers_failed"):
            assert k in ev
        assert analysis["persisted"] is True and analysis["id"]
        assert "verdict" not in analysis and "combined" not in str(analysis.keys())
        print("ML", ml["label"], ml["probabilities"], "AI", analysis["ai_explanation"]["available"],
              "items", len(ev["items"]), "used", ev["providers_used"], "failed",
              [(p["provider"], p.get("status")) for p in ev["providers_failed"]], "summary", ev["summary"]["available"])

    def test_empty_input(self, t1):
        r = requests.post(f"{BASE_URL}/api/analyze", headers=t1, json={"text": "  "}, timeout=15)
        assert r.status_code == 400 and r.json()["error"]["code"] == "empty_input"

    def test_invalid_scheme(self, t1):
        r = requests.post(f"{BASE_URL}/api/analyze", headers=t1, json={"url": "ftp://example.com/a"}, timeout=15)
        assert r.status_code == 400 and r.json()["error"]["code"] == "invalid_url"

    @pytest.mark.parametrize("url", ["http://169.254.169.254/latest/meta-data/", "http://localhost:8001/api/health",
                                     "http://127.0.0.1:27017", "http://[::1]:8001/"])
    def test_ssrf_blocked(self, t1, url):
        r = requests.post(f"{BASE_URL}/api/analyze", headers=t1, json={"url": url}, timeout=30)
        assert r.status_code == 422, f"{url} -> {r.status_code} {r.text[:200]}"


# History + RLS
class TestHistory:
    def test_list_contains(self, t1, analysis):
        r = requests.get(f"{BASE_URL}/api/analyses", headers=t1, timeout=20)
        assert r.status_code == 200
        assert analysis["id"] in [x["id"] for x in r.json()]

    def test_get_detail(self, t1, analysis):
        r = requests.get(f"{BASE_URL}/api/analyses/{analysis['id']}", headers=t1, timeout=20)
        assert r.status_code == 200 and r.json()["id"] == analysis["id"]

    def test_invalid_id(self, t1):
        r = requests.get(f"{BASE_URL}/api/analyses/not-a-uuid", headers=t1, timeout=20)
        assert r.status_code == 400

    def test_rls_other_user(self, t2, analysis):
        r = requests.get(f"{BASE_URL}/api/analyses/{analysis['id']}", headers=t2, timeout=20)
        assert r.status_code == 404
        lst = requests.get(f"{BASE_URL}/api/analyses", headers=t2, timeout=20).json()
        assert analysis["id"] not in [x["id"] for x in lst]
        # tester2 delete must not remove tester1 row
        requests.delete(f"{BASE_URL}/api/analyses/{analysis['id']}", headers=t2, timeout=20)

    def test_delete_then_404(self, t1, analysis):
        assert requests.get(f"{BASE_URL}/api/analyses/{analysis['id']}", headers=t1, timeout=20).status_code == 200
        r = requests.delete(f"{BASE_URL}/api/analyses/{analysis['id']}", headers=t1, timeout=20)
        assert r.status_code == 200
        assert requests.get(f"{BASE_URL}/api/analyses/{analysis['id']}", headers=t1, timeout=20).status_code == 404

    def test_clear_all(self, t2):
        r = requests.delete(f"{BASE_URL}/api/analyses", headers=t2, timeout=20)
        assert r.status_code == 200
        assert requests.get(f"{BASE_URL}/api/analyses", headers=t2, timeout=20).json() == []


# Discover / misc private
class TestDiscover:
    def test_discover(self, t1):
        r = requests.get(f"{BASE_URL}/api/discover", params={"q": "vaccine", "kind": "factcheck"}, headers=t1, timeout=90)
        assert r.status_code == 200
        d = r.json()
        print("DISCOVER items", len(d["items"]), [(p["provider"], p["status"]) for p in d["providers"]])
        assert isinstance(d["items"], list) and isinstance(d["providers"], list) and len(d["providers"]) > 0

    def test_discover_short(self, t1):
        r = requests.get(f"{BASE_URL}/api/discover", params={"q": "a"}, headers=t1, timeout=20)
        assert r.status_code == 400

    def test_me_providers_notifications(self, t1):
        me = requests.get(f"{BASE_URL}/api/me", headers=t1, timeout=20)
        assert me.status_code == 200 and me.json()["user"]["email"] == "tester.newssearch@example.com"
        assert requests.get(f"{BASE_URL}/api/providers", headers=t1, timeout=20).status_code == 200
        n = requests.get(f"{BASE_URL}/api/notifications", headers=t1, timeout=20)
        assert n.status_code == 200 and isinstance(n.json(), list)


# CORS
class TestCORS:
    def _acao(self, origin):
        r = requests.options(f"{BASE_URL}/api/health", headers={"Origin": origin, "Access-Control-Request-Method": "GET"}, timeout=15)
        return r.headers.get("Access-Control-Allow-Origin")

    def test_evil_origin(self):
        assert self._acao("https://evil.example.com") in (None, "")

    def test_preview_origin(self):
        assert self._acao(BASE_URL) == BASE_URL

    def test_suffix_bypass(self):
        # prefix-only regex match would allow attacker-controlled suffix domains
        o = "https://x.preview.emergentagent.com.evil.example.com"
        assert self._acao(o) in (None, ""), "regex origin prefix-match bypass"
