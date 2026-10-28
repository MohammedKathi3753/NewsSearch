"""SSRF-safe fetching for user-supplied article URLs.

Protections: scheme allow-list, no credentials in URL, DNS resolution checked
against non-global/private/link-local/metadata addresses, manual redirect
following with re-validation, content-type + size caps.
"""
import ipaddress
import socket
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

MAX_BYTES = 2_000_000
MAX_REDIRECTS = 3
USER_AGENT = "NewsSearchBot/1.0 (article fetch for user-requested analysis)"
ALLOWED_CONTENT = ("text/html", "application/xhtml", "text/plain")


class FetchBlocked(Exception):
    pass


def _assert_safe(url: str):
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise FetchBlocked("scheme_not_allowed")
    if not parsed.hostname:
        raise FetchBlocked("missing_host")
    if parsed.username or parsed.password:
        raise FetchBlocked("credentials_in_url")
    try:
        infos = socket.getaddrinfo(parsed.hostname, None)
    except socket.gaierror as exc:
        raise FetchBlocked("dns_resolution_failed") from exc
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
            or not ip.is_global
        ):
            raise FetchBlocked("private_address_blocked")


def safe_fetch(url: str, timeout: int = 8) -> bytes:
    current = url
    for _ in range(MAX_REDIRECTS + 1):
        _assert_safe(current)
        response = requests.get(
            current,
            headers={"User-Agent": USER_AGENT},
            timeout=(3, timeout),
            stream=True,
            allow_redirects=False,
        )
        if response.status_code in (301, 302, 303, 307, 308):
            location = response.headers.get("Location")
            if not location:
                raise FetchBlocked("redirect_without_location")
            current = urljoin(current, location)
            continue
        response.raise_for_status()
        content_type = (response.headers.get("Content-Type") or "").lower()
        if content_type and not any(kind in content_type for kind in ALLOWED_CONTENT):
            raise FetchBlocked("content_type_not_html")
        chunks: list = []
        size = 0
        for chunk in response.iter_content(chunk_size=65536):
            chunks.append(chunk)
            size += len(chunk)
            if size > MAX_BYTES:
                break
        return b"".join(chunks).decode("utf-8", errors="replace")
    raise FetchBlocked("too_many_redirects")


def extract_article(html_text: str) -> dict:
    try:
        soup = BeautifulSoup(html_text, "lxml")
    except Exception:  # noqa: BLE001
        soup = BeautifulSoup(html_text, "html.parser")
    for tag in soup(["script", "style", "noscript", "nav", "footer", "header", "aside", "form"]):
        tag.decompose()
    title = ""
    if soup.title and soup.title.string:
        title = soup.title.string.strip()
    description = ""
    meta = soup.find("meta", attrs={"name": "description"})
    if meta and meta.get("content"):
        description = meta["content"].strip()
    paragraphs = [p.get_text(" ", strip=True) for p in soup.find_all("p")]
    paragraphs = [p for p in paragraphs if len(p) > 40]
    text = "\n".join(paragraphs)[:20000]
    return {"title": title[:300], "description": description[:500], "text": text}
