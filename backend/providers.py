"""Worldwide multi-provider news and fact-check discovery.

Resilience rules:
- every provider call has its own timeout and failure isolation;
- providers fail open (one broken provider never fails the whole response);
- after 3 consecutive failures a provider cools down for 10 minutes.
"""
import hashlib
import html as html_lib
import logging
import os
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import quote_plus, urlparse

import feedparser
import requests

log = logging.getLogger("newssearch.providers")

USER_AGENT = "NewsSearch/1.0 (fact-check discovery; respects provider terms)"
REQUEST_TIMEOUT = (4, 10)
MAX_FAILS = 3
COOLDOWN_SECONDS = 600

_health: dict = {}
_lock = threading.Lock()


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def _iso(value):
    if not value:
        return None
    if not isinstance(value, str):
        return None
    value = value.strip()
    if not value:
        return None
    if re.match(r"^\d{4}-\d{2}-\d{2}", value):  # already ISO
        return value
    match = re.match(r"^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$", value)  # GDELT
    if match:
        try:
            parts = [int(p) for p in match.groups()]
            return datetime(*parts, tzinfo=timezone.utc).isoformat()
        except ValueError:
            return None
    try:
        return parsedate_to_datetime(value).astimezone(timezone.utc).isoformat()
    except (TypeError, ValueError):
        return None


def _fingerprint(url: str) -> str:
    return hashlib.sha256((url or "").encode("utf-8")).hexdigest()[:16]


def _domain(url: str | None):
    try:
        return (urlparse(url).netloc or "").replace("www.", "") or None
    except Exception:  # noqa: BLE001
        return None


def _clean_text(value: str | None) -> str:
    """Strip HTML tags/entities from provider-supplied text."""
    if not value:
        return ""
    text = re.sub(r"<[^>]+>", " ", value)
    text = html_lib.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def _make_item(provider, kind, title, url, snippet=None, published_at=None, source=None):
    if not url:
        return None
    title = _clean_text(title)
    if not title:
        return None
    snippet_text = _clean_text(snippet)
    # Google News descriptions only repeat the headline + publisher; drop them.
    if snippet_text and title.lower()[:40] in snippet_text.lower():
        snippet_text = ""
    return {
        "provider": provider,
        "kind": kind,
        "title": title[:400],
        "url": url,
        "snippet": snippet_text[:600] or None,
        "published_at": _iso(published_at),
        "source": source or {},
        "fingerprint": _fingerprint(url),
    }


def _http_get(url, params=None, headers=None):
    merged = {"User-Agent": USER_AGENT}
    if headers:
        merged.update(headers)
    response = requests.get(url, params=params, headers=merged, timeout=REQUEST_TIMEOUT)
    if response.status_code >= 400:
        raise RuntimeError(f"HTTP {response.status_code}")
    return response


_GENERIC_TERMS = {
    "claim", "claims", "news", "report", "reports", "says", "said", "fact", "check", "true", "false",
    "people", "video", "photo", "post", "posts", "viral", "shows", "show", "year", "years", "time",
}


def _filter_relevant(items, query):
    """Whole-feed providers (no server-side search): keep only entries that
    share meaningful terms with the query. Empty query = ingestion, keep all."""
    terms = {t for t in re.findall(r"[a-z0-9]{4,}", (query or "").lower()) if t not in _GENERIC_TERMS}
    if not terms:
        return items
    needed = 1 if len(terms) <= 2 else 2
    kept = []
    for item in items:
        haystack = f"{item['title']} {item.get('snippet') or ''}".lower()
        if sum(1 for term in terms if re.search(rf"\b{re.escape(term)}", haystack)) >= needed:
            kept.append(item)
    return kept


def _fetch_rss(provider_name, kind, url, default_publisher):
    response = _http_get(url)
    feed = feedparser.parse(response.content)
    if getattr(feed, "bozo", False) and not feed.entries:
        raise RuntimeError("invalid_feed")
    items = []
    for entry in feed.entries[:25]:
        source = entry.get("source")
        publisher = source.get("title") if isinstance(source, dict) and source.get("title") else default_publisher
        items.append(
            _make_item(
                provider_name,
                kind,
                entry.get("title"),
                entry.get("link"),
                snippet=entry.get("summary"),
                published_at=entry.get("published") or entry.get("updated"),
                source={"publisher": publisher, "domain": _domain(entry.get("link"))},
            )
        )
    return [item for item in items if item]


class GdeltProvider:
    name = "gdelt"
    kind = "news"
    label = "GDELT"
    requires_key = False
    key_env = None

    def available(self):
        return True

    def fetch(self, query):
        response = _http_get(
            "https://api.gdeltproject.org/api/v2/doc/doc",
            params={"query": query, "mode": "artlist", "maxrecords": "50", "format": "json", "timespan": "3d", "sort": "datedesc"},
        )
        try:
            data = response.json()
        except ValueError as exc:
            raise RuntimeError("gdelt_invalid_response") from exc
        items = []
        for article in (data.get("articles") or [])[:30]:
            items.append(
                _make_item(
                    self.name,
                    self.kind,
                    article.get("title"),
                    article.get("url"),
                    published_at=article.get("seendate"),
                    source={
                        "domain": article.get("domain"),
                        "language": article.get("language"),
                        "country": article.get("sourcecountry"),
                    },
                )
            )
        return [item for item in items if item]


class GoogleNewsProvider:
    name = "google_news"
    kind = "news"
    label = "Google News"
    requires_key = False
    key_env = None

    def available(self):
        return True

    def fetch(self, query):
        url = f"https://news.google.com/rss/search?q={quote_plus(query)}&hl=en-US&gl=US&ceid=US:en"
        return _fetch_rss(self.name, self.kind, url, "Google News")


class PolitiFactProvider:
    name = "politifact"
    kind = "factcheck"
    label = "PolitiFact"
    requires_key = False
    key_env = None

    def available(self):
        return True

    def fetch(self, query):
        return _filter_relevant(
            _fetch_rss(self.name, self.kind, "https://www.politifact.com/rss/factchecks/", "PolitiFact"), query
        )


class EUvsDisinfoProvider:
    name = "euvsdisinfo"
    kind = "factcheck"
    label = "EUvsDisinfo"
    requires_key = False
    key_env = None

    def available(self):
        return True

    def fetch(self, query):
        return _filter_relevant(_fetch_rss(self.name, self.kind, "https://euvsdisinfo.eu/feed/", "EUvsDisinfo"), query)


class OptionalFeedProvider:
    name = "override"
    kind = "factcheck"
    label = "override"
    requires_key = False
    key_env = "override"
    default_publisher = "override"

    def available(self):
        return bool(os.environ.get(self.key_env))

    def fetch(self, query):
        url = os.environ[self.key_env]
        return _filter_relevant(_fetch_rss(self.name, self.kind, url, self.default_publisher), query)


class AfpFactCheckProvider(OptionalFeedProvider):
    name = "afp_factcheck"
    label = "AFP Fact Check"
    key_env = "AFP_FACTCHECK_FEED_URL"
    default_publisher = "AFP Fact Check"


class AfricaCheckProvider(OptionalFeedProvider):
    name = "africa_check"
    label = "Africa Check"
    key_env = "AFRICA_CHECK_FEED_URL"
    default_publisher = "Africa Check"


class GoogleFactCheckProvider:
    name = "google_factcheck"
    kind = "factcheck"
    label = "Google Fact Check Tools"
    requires_key = True
    key_env = "GOOGLE_FACTCHECK_API_KEY"

    def available(self):
        return bool(os.environ.get(self.key_env))

    def fetch(self, query):
        response = _http_get(
            "https://factchecktools.googleapis.com/v1alpha1/claims:search",
            params={"query": query, "languageCode": "en", "pageSize": "20", "key": os.environ[self.key_env]},
        )
        try:
            data = response.json()
        except ValueError as exc:
            raise RuntimeError("google_factcheck_invalid_response") from exc
        items = []
        for claim in data.get("claims", []):
            for review in claim.get("claimReview", []) or []:
                publisher = review.get("publisher")
                if isinstance(publisher, dict):
                    publisher = publisher.get("name")
                items.append(
                    _make_item(
                        self.name,
                        "factcheck",
                        review.get("title") or claim.get("text"),
                        review.get("url"),
                        snippet=review.get("textualRating") or claim.get("text"),
                        published_at=review.get("reviewDate") or claim.get("claimDate"),
                        source={
                            "publisher": publisher,
                            "rating": review.get("textualRating"),
                            "claimant": claim.get("claimant"),
                        },
                    )
                )
        return [item for item in items if item]


class NewsApiProvider:
    name = "newsapi"
    kind = "news"
    label = "NewsAPI"
    requires_key = True
    key_env = "NEWSAPI_KEY"

    def available(self):
        return bool(os.environ.get(self.key_env))

    def fetch(self, query):
        response = _http_get(
            "https://newsapi.org/v2/everything",
            params={"q": query, "language": "en", "sortBy": "publishedAt", "pageSize": "30", "searchIn": "title,description"},
            headers={"X-Api-Key": os.environ[self.key_env]},
        )
        try:
            data = response.json()
        except ValueError as exc:
            raise RuntimeError("newsapi_invalid_response") from exc
        if data.get("status") == "error":
            raise RuntimeError(str(data.get("code") or "newsapi_error"))
        items = []
        for article in (data.get("articles") or [])[:30]:
            source = article.get("source") or {}
            items.append(
                _make_item(
                    self.name,
                    self.kind,
                    article.get("title"),
                    article.get("url"),
                    snippet=article.get("description"),
                    published_at=article.get("publishedAt"),
                    source={"publisher": source.get("name"), "author": article.get("author")},
                )
            )
        return [item for item in items if item]


PROVIDERS = [
    PolitiFactProvider(),
    EUvsDisinfoProvider(),
    GoogleFactCheckProvider(),
    AfpFactCheckProvider(),
    AfricaCheckProvider(),
    GdeltProvider(),
    GoogleNewsProvider(),
    NewsApiProvider(),
]


def get_provider(name: str):
    for provider in PROVIDERS:
        if provider.name == name:
            return provider
    return None


def _state(name: str) -> dict:
    return _health.setdefault(name, {"fails": 0, "cooldown_until": 0.0, "last_error": None, "last_ok": None})


def enabled_count() -> int:
    return sum(1 for provider in PROVIDERS if provider.available())


def describe() -> list:
    out = []
    for provider in PROVIDERS:
        state = _state(provider.name)
        cooling = state["cooldown_until"] > time.time()
        out.append({
            "name": provider.name,
            "label": provider.label,
            "kind": provider.kind,
            "enabled": provider.available(),
            "requires_key": provider.requires_key,
            "status": "cooldown" if cooling else ("ok" if state["last_ok"] and not state["fails"] else ("error" if state["fails"] else "idle")),
            "last_error": state["last_error"],
            "last_ok": state["last_ok"],
        })
    return out


def search_all(query: str, kinds: str | None = None):
    statuses: list = []
    jobs = []
    with ThreadPoolExecutor(max_workers=8) as pool:
        for provider in PROVIDERS:
            state = _state(provider.name)
            if kinds and provider.kind != kinds:
                statuses.append({"provider": provider.name, "kind": provider.kind, "status": "skipped"})
                continue
            if not provider.available():
                statuses.append({"provider": provider.name, "kind": provider.kind, "status": "disabled"})
                continue
            if state["cooldown_until"] > time.time():
                statuses.append({"provider": provider.name, "kind": provider.kind, "status": "cooldown"})
                continue
            jobs.append((provider, pool.submit(provider.fetch, query)))
        results = []
        for provider, future in jobs:
            try:
                items = [item for item in (future.result() or [])]
                with _lock:
                    state = _state(provider.name)
                    state.update({"fails": 0, "last_ok": _now_iso(), "last_error": None})
                results.extend(items)
                statuses.append({"provider": provider.name, "kind": provider.kind, "status": "ok", "count": len(items)})
            except Exception as exc:  # noqa: BLE001
                with _lock:
                    state = _state(provider.name)
                    state["fails"] += 1
                    state["last_error"] = str(exc)[:200]
                    if state["fails"] >= MAX_FAILS:
                        state["cooldown_until"] = time.time() + COOLDOWN_SECONDS
                statuses.append({"provider": provider.name, "kind": provider.kind, "status": "error", "error": str(exc)[:120]})

    unique: dict = {}
    for item in results:
        unique.setdefault(item["fingerprint"], item)
    items = list(unique.values())
    # Fact checks first, then newest first inside each kind.
    items.sort(key=lambda item: item["published_at"] or "", reverse=True)
    items.sort(key=lambda item: 0 if item["kind"] == "factcheck" else 1)
    return items[:40], statuses


def public_item(item: dict) -> dict:
    return {
        "fingerprint": item["fingerprint"],
        "provider": item["provider"],
        "kind": item["kind"],
        "title": item["title"],
        "url": item["url"],
        "snippet": item["snippet"],
        "published_at": item["published_at"],
        "source": item["source"],
    }
