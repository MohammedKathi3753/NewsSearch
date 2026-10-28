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


def summarize_evidence(claim_excerpt: str, items: list) -> str | None:
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
        "\"No directly relevant records were found.\" Do not add any facts of your own.\n\n"
        f"Claim (excerpt): {claim_excerpt}\n\n"
        "Retrieved records:\n" + "\n".join(records) + "\n"
    )
    try:
        return _chat(GROUNDING_RULES, user_prompt, max_tokens=600)
    except Exception as exc:  # noqa: BLE001
        log.warning("groq summarize failed: %s", exc)
        return None
