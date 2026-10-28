"""TF-IDF + Logistic Regression baseline model (training lives in train_model.py).

predict() never fabricates: if the model is not loaded it returns None and the
API reports the ML track as unavailable.
"""
import logging
import re
import threading
from collections import Counter
from pathlib import Path

import joblib

log = logging.getLogger("newssearch.ml")

MODEL_PATH = Path(__file__).parent / "models" / "baseline.joblib"

_lock = threading.Lock()
_state: dict = {
    "loaded": False,
    "error": "model_not_trained",
    "vectorizer": None,
    "model": None,
    "meta": {},
    "names": None,
    "idf": None,
}

_STOPWORDS = {
    "the", "and", "for", "that", "with", "this", "from", "have", "has", "was", "were", "are", "you", "your",
    "said", "will", "not", "but", "all", "can", "her", "his", "she", "him", "who", "what", "when", "where",
    "why", "how", "into", "out", "about", "after", "before", "their", "there", "they", "them", "than",
    "then", "these", "those", "over", "just", "more", "most", "some", "such", "only", "also", "been",
    "because", "being", "which", "while", "would", "could", "should", "does", "did", "done", "get", "got",
}


def load_model():
    with _lock:
        if MODEL_PATH.exists():
            try:
                bundle = joblib.load(MODEL_PATH)
                names = bundle["vectorizer"].get_feature_names_out()
                _state.update(
                    loaded=True,
                    error=None,
                    vectorizer=bundle["vectorizer"],
                    model=bundle["model"],
                    meta=bundle.get("meta", {}),
                    names=names,
                    idf=dict(zip(names.tolist(), bundle["vectorizer"].idf_.tolist())),
                )
                log.info("baseline model loaded (version=%s)", _state["meta"].get("version"))
            except Exception as exc:  # noqa: BLE001
                _state.update(loaded=False, error=f"model_load_failed: {exc}")
        else:
            _state.update(loaded=False, error="model_not_trained")


def status() -> dict:
    meta = _state.get("meta") or {}
    return {
        "loaded": _state["loaded"],
        "error": _state["error"],
        "version": meta.get("version"),
        "trained_at": meta.get("trained_at"),
        "metrics": meta.get("metrics"),
        "n_docs": meta.get("n_docs"),
    }


def predict(text: str) -> dict | None:
    if not _state["loaded"] or not text.strip():
        return None
    try:
        vectorizer = _state["vectorizer"]
        model = _state["model"]
        classes = list(model.classes_)
        if classes != ["FAKE", "REAL"]:
            log.error("unexpected model classes: %s", classes)
            return None
        row = vectorizer.transform([text]).toarray()[0]
        proba = model.predict_proba(vectorizer.transform([text]))[0]
        p_real = float(proba[classes.index("REAL")])
        label = "REAL" if p_real >= 0.5 else "FAKE"

        coef = model.coef_[0]
        names = _state["names"]
        contributions = row * coef
        nonzero = [(i, float(contributions[i])) for i in range(len(contributions)) if row[i] > 0]
        nonzero.sort(key=lambda pair: abs(pair[1]), reverse=True)
        top_features = [
            {
                "feature": str(names[i]),
                "contribution": round(value, 4),
                "direction": "real" if value >= 0 else "fake",
            }
            for i, value in nonzero[:8]
        ]
        meta = _state["meta"]
        return {
            "available": True,
            "label": label,
            "probabilities": {"real": round(p_real, 4), "fake": round(1 - p_real, 4)},
            "confidence": round(max(p_real, 1 - p_real), 4),
            "top_features": top_features,
            "model_version": meta.get("version"),
            "trained_at": meta.get("trained_at"),
            "metrics": meta.get("metrics"),
        }
    except Exception as exc:  # noqa: BLE001
        log.warning("prediction failed: %s", exc)
        return None


def keywords(text: str, limit: int = 10) -> list:
    try:
        if _state["loaded"] and text.strip():
            analyzer = _state["vectorizer"].build_analyzer()
            tokens = [t for t in analyzer(text) if " " not in t and len(t) > 3 and not t.isdigit()]
            if tokens:
                idf = _state["idf"]
                counts = Counter(tokens)
                scored = {token: count * idf.get(token, 1.0) for token, count in counts.items()}
                ranked = sorted(scored, key=lambda token: (scored[token], len(token)), reverse=True)
                seen: list = []
                for token in ranked:
                    if token not in seen:
                        seen.append(token)
                    if len(seen) >= limit:
                        break
                return seen
    except Exception as exc:  # noqa: BLE001
        log.debug("model keywords failed: %s", exc)
    # Fallback tokenizer (no model needed).
    words = re.findall(r"[a-zA-Z][a-zA-Z'-]{3,}", text.lower())
    counts = Counter(word for word in words if word not in _STOPWORDS)
    return [word for word, _ in counts.most_common(limit)]
