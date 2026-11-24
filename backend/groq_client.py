"""Groq integration — used ONLY to explain model predictions and to summarize
retrieved evidence. Strictly grounded: the prompts forbid inventing facts, and
the model only ever sees the real claim + real model output / real records.
"""
import logging
import os

import requests

log = logging.getLogger("newssearch.groq")

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b")

GROUNDING_RULES = (
    "You are part of a fact-checking assistance pipeline. You NEVER fabricate information.\n"
    "Rules you must follow:\n"
    "- Use ONLY the content explicitly provided in the user message.\n"
    "- Do not add outside facts, do not speculate, and do not invent records, sources or numbers.\n"
    "- If the provided material is insufficient, say exactly that in plain words.\n"
    "- Keep a neutral, factual tone. Never use emojis. Never use markdown headings."
)


def groq_available() -> bool:
    return bool(os.environ.get("GROQ_API_KEY"))


def _chat(system: str, user: str, max_tokens: int = 600) -> str:
    response = requests.post(
        GROQ_URL,
        headers={
            "Authorization": f"Bearer {os.environ['GROQ_API_KEY']}",
            "Content-Type": "application/json",
        },
        json={
            "model": GROQ_MODEL,
            "temperature": 0.1,
            "max_tokens": max_tokens,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        },
        timeout=40,
    )
    response.raise_for_status()
    return response.json()["choices"][0]["message"]["content"].strip()


def explain_prediction(claim_excerpt: str, ml_result: dict) -> str | None:
    """Explain the model's own prediction using its real top features."""
    features = "\n".join(
        f"- \"{f['feature']}\" (pushes toward {f['direction']}, weight {f['contribution']})"
        for f in ml_result.get("top_features", [])
    )
    user_prompt = (
        "A TF-IDF + Logistic Regression classifier processed the claim below. "
        "Explain, in 3 to 5 sentences, what the language patterns that most influenced the model suggest, "
        "and clearly remind the reader that this is a statistical language-pattern signal, not proof of "
        "truth or falsehood.\n\n"
        f"Claim (excerpt): {claim_excerpt}\n"
        f"Model label: {ml_result.get('label')}\n"
        f"Model probability of REAL: {ml_result.get('probabilities', {}).get('real')}\n"
        f"Most influential words/phrases the model actually saw:\n{features}\n"
    )
    try:
        return _chat(GROUNDING_RULES, user_prompt, max_tokens=450)
    except Exception as exc:  # noqa: BLE001
        log.warning("groq explain failed: %s", exc)
        return None


LANGUAGE_NAMES = {"en": "English", "es": "Spanish", "fr": "French", "gu": "Gujarati", "hi": "Hindi"}


def _language_rule(lang: str) -> str:
    name = LANGUAGE_NAMES.get(lang or "en", "English")
    if name == "English":
        return ""
    return (
        f"\nWrite your entire answer in {name}. Keep publisher names, record titles and "
        "quoted ratings exactly as given (do not translate them)."
    )


VERDICTS = ("supported", "contradicted", "mixed", "insufficient")
CONFIDENCES = ("low", "medium", "high")


def assess_claim(claim_excerpt: str, items: list, lang: str = "en") -> dict | None:
    """Search-based verdict: judge the claim ONLY against the retrieved records.

    Returns {verdict, confidence, reasoning, citations[]} with citations
    validated against the real record list; anything uncited is downgraded
    to 'insufficient' so no verdict is ever produced without evidence.
    """
    import json
    import re

    records = []
    for index, item in enumerate(items, start=1):
        source = item.get("source") or {}
        publisher = source.get("publisher") or source.get("domain") or item.get("provider")
        rating = f" | fact-check rating: {source['rating']}" if source.get("rating") else ""
        records.append(
            f"[{index}] ({item.get('kind')}) {item['title']} — {publisher}{rating} — {item.get('snippet') or ''}".strip()
        )
    user_prompt = (
        "Decide whether the retrieved records SUPPORT or CONTRADICT the claim below.\n"
        "- 'supported': reputable records report the same event/fact as the claim.\n"
        "- 'contradicted': fact-checks rate this claim false/misleading, or reputable records clearly report the opposite.\n"
        "- 'mixed': relevant records disagree with each other.\n"
        "- 'insufficient': no record is directly about this claim. Prefer this whenever unsure.\n"
        "Only use and cite records that are directly about the same subject and event as the claim; "
        "never cite a record just because it shares a word with the claim. Cite record numbers.\n"
        'Respond with ONLY a JSON object: {"verdict": "supported|contradicted|mixed|insufficient", '
        '"confidence": "low|medium|high", "reasoning": "2-4 sentences citing [n]", "citations": [n, ...]}'
        + _language_rule(lang)
        + "\n\n"
        f"Claim: {claim_excerpt}\n\nRetrieved records:\n" + "\n".join(records) + "\n"
    )
    try:
        raw = _chat(GROUNDING_RULES, user_prompt, max_tokens=2000)
        # Reasoning models emit a <think>…</think> block before the JSON — strip it.
        raw_stripped = re.sub(r"<think>.*?</think>", "", raw, flags=re.S).strip()
        match = re.search(r"\{.*\}", raw_stripped or raw, re.S)
        data = json.loads(match.group(0) if match else (raw_stripped or raw))
    except Exception as exc:  # noqa: BLE001
        log.warning("groq assess failed: %s", exc)
        return None
    verdict = str(data.get("verdict", "")).lower()
    confidence = str(data.get("confidence", "")).lower()
    citations = []
    for value in data.get("citations") or []:
        try:
            number = int(value)
        except (TypeError, ValueError):
            continue
        if 1 <= number <= len(items) and number not in citations:
            citations.append(number)
    if verdict not in VERDICTS:
        verdict = "insufficient"
    if confidence not in CONFIDENCES:
        confidence = "low"
    if verdict != "insufficient" and not citations:
        verdict, confidence = "insufficient", "low"
    return {
        "verdict": verdict,
        "confidence": confidence,
        "reasoning": str(data.get("reasoning") or "").strip()[:1500],
        "citations": [
            {"index": n, "title": items[n - 1]["title"], "url": items[n - 1]["url"], "fingerprint": items[n - 1]["fingerprint"]}
            for n in citations
        ],
    }


def summarize_evidence(claim_excerpt: str, items: list, lang: str = "en") -> str | None:
    """Summarize retrieved evidence records with citations, grounded only in them."""
    records = []
    for index, item in enumerate(items, start=1):
        source = item.get("source") or {}
        publisher = source.get("publisher") or source.get("domain") or item.get("provider")
        rating = f" | rating: {source['rating']}" if source.get("rating") else ""
        snippet = item.get("snippet") or ""
        records.append(f"[{index}] {item['title']} — {publisher}{rating} — {snippet}".strip())
    user_prompt = (
        "Summarize what the following retrieved records say that is relevant to the claim below. "
        "Cite records with their [number]. Only state what the records contain. "
        "If no record is directly relevant, reply exactly: "
        "\"No directly relevant records were found.\" Do not add any facts of your own."
        + _language_rule(lang)
        + "\n\n"
        f"Claim (excerpt): {claim_excerpt}\n\n"
        "Retrieved records:\n" + "\n".join(records) + "\n"
    )
    try:
        return _chat(GROUNDING_RULES, user_prompt, max_tokens=1200)
    except Exception as exc:  # noqa: BLE001
        log.warning("groq summarize failed: %s", exc)
        return None
