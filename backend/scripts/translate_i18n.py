"""Translates the English UI dictionary into es/fr/gu/hi with Groq.

Usage: node frontend/scripts/dump-i18n.js > /tmp/en.json
       python backend/scripts/translate_i18n.py /tmp/en.json frontend/src/i18n/locales
Keys missing from a translation fall back to English at runtime.
"""
import json
import os
import re
import sys
import time
from pathlib import Path

from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from groq_client import _chat  # noqa: E402

LANGS = {"es": "Spanish", "fr": "French", "gu": "Gujarati", "hi": "Hindi"}
SYSTEM = (
    "You are a professional software localizer. Translate UI strings accurately and naturally. "
    "Keep placeholders like {count} and {date} unchanged. Keep brand names (NewsSearch, Supabase, Groq, "
    "PolitiFact, Google, NewsAPI, AFP, GDELT, CSV, PDF, URL) unchanged. Return ONLY valid JSON with exactly the same keys."
)


def translate_obj(obj, language):
    raw = _chat(SYSTEM, f"Translate every value into {language}. Return the JSON object only.\n\n" + json.dumps(obj, ensure_ascii=False), max_tokens=3500)
    match = re.search(r"\{.*\}", raw, re.S)
    return json.loads(match.group(0) if match else raw)


def main(src, out_dir):
    data = json.loads(Path(src).read_text())
    strings = data["strings"]
    keys = list(strings)
    Path(out_dir).mkdir(parents=True, exist_ok=True)
    only = sys.argv[3:] or list(LANGS)
    for code in only:
        language = LANGS[code]
        existing_path = Path(out_dir, f"{code}.json")
        result = json.loads(existing_path.read_text()) if existing_path.exists() else {"strings": {}, "legal": {}}
        result.setdefault("strings", {}); result.setdefault("legal", {})
        for i in range(0, len(keys), 45):
            chunk = {k: strings[k] for k in keys[i:i + 45] if k not in result["strings"]}
            if not chunk:
                continue
            for attempt in range(6):
                try:
                    translated = translate_obj(chunk, language)
                    result["strings"].update({k: v for k, v in translated.items() if k in chunk and isinstance(v, str)})
                    time.sleep(12)
                    break
                except Exception as exc:  # noqa: BLE001
                    print(code, "chunk", i, "retry", attempt, exc, flush=True)
                    time.sleep(25 * (attempt + 1))
        for section in ("terms", "privacy"):
            if result["legal"].get(section):
                continue
            for attempt in range(6):
                try:
                    payload = {str(n): s for n, s in enumerate(data["legal"][section])}
                    translated = translate_obj(payload, language)
                    result["legal"][section] = [
                        {"heading": translated[str(n)]["heading"], "body": translated[str(n)]["body"]}
                        for n in range(len(data["legal"][section]))
                    ]
                    time.sleep(12)
                    break
                except Exception as exc:  # noqa: BLE001
                    print(code, section, "retry", attempt, exc, flush=True)
                    time.sleep(25 * (attempt + 1))
        existing_path.write_text(json.dumps(result, ensure_ascii=False, indent=1))
        print(code, "done", len(result["strings"]), "/", len(keys), "legal", list(result["legal"]), flush=True)


if __name__ == "__main__":
    os.environ.setdefault("GROQ_MODEL", "openai/gpt-oss-120b")
    main(sys.argv[1], sys.argv[2])
