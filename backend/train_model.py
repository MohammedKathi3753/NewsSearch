"""Trains the NewsSearch baseline: TF-IDF + Logistic Regression.

Dataset: the public `fake_or_real_news` CSV (Kaggle mirror hosted on GitHub).
If the bundled copy is missing it is downloaded once. Exits non-zero on failure
so background training surfaces problems in logs.

Usage: python train_model.py
"""
import csv
import hashlib
import io
import json
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from joblib import dump
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import train_test_split

ROOT = Path(__file__).parent
DATA_PATH = ROOT / "data" / "fake_or_real_news.csv"
OUT_PATH = ROOT / "models" / "baseline.joblib"
DOWNLOAD_URLS = [
    "https://raw.githubusercontent.com/lutzhamel/fake-news/master/data/fake_or_real_news.csv",
]


def load_dataset():
    if DATA_PATH.exists():
        texts, labels = parse_csv(DATA_PATH.read_bytes())
        if len(texts) >= 200:
            return texts, labels
    for url in DOWNLOAD_URLS:
        try:
            print(f"downloading dataset from {url}")
            raw = urllib.request.urlopen(url, timeout=30).read()  # noqa: S310
            texts, labels = parse_csv(raw)
            if len(texts) >= 200:
                DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
                DATA_PATH.write_bytes(raw)
                return texts, labels
        except Exception as exc:  # noqa: BLE001
            print(f"download failed ({url}): {exc}")
    raise SystemExit("no usable training data found")


def parse_csv(raw: bytes):
    texts, labels = [], []
    reader = csv.DictReader(io.StringIO(raw.decode("utf-8", "replace")))
    for row in reader:
        label = (row.get("label") or "").strip().upper()
        title = (row.get("title") or "").strip()
        body = (row.get("text") or "").strip()
        if label in ("FAKE", "REAL") and (title or body):
            texts.append(f"{title}\n{body}"[:5000])
            labels.append(label)
    return texts, labels


def main():
    texts, labels = load_dataset()
    print(f"training on {len(texts)} documents")

    x_train, x_test, y_train, y_test = train_test_split(
        texts, labels, test_size=0.15, random_state=42, stratify=labels
    )
    vectorizer = TfidfVectorizer(
        ngram_range=(1, 2),
        min_df=2,
        max_df=0.9,
        sublinear_tf=True,
        max_features=30000,
        stop_words="english",
    )
    x_train_v = vectorizer.fit_transform(x_train)
    classifier = LogisticRegression(C=5.0, max_iter=2000, class_weight="balanced", n_jobs=-1)
    classifier.fit(x_train_v, y_train)

    x_test_v = vectorizer.transform(x_test)
    predictions = classifier.predict(x_test_v)
    f1_fake = f1_score(y_test, predictions, labels=["FAKE"], average="macro")
    f1_real = f1_score(y_test, predictions, labels=["REAL"], average="macro")
    metrics = {
        "accuracy": round(float(accuracy_score(y_test, predictions)), 4),
        "f1_fake": round(float(f1_fake), 4),
        "f1_real": round(float(f1_real), 4),
        "test_docs": len(x_test),
    }
    print("metrics:", json.dumps(metrics))

    trained_at = datetime.now(timezone.utc).isoformat()
    version = "tfidf-lr-" + hashlib.sha1(f"{trained_at}-{len(texts)}".encode()).hexdigest()[:10]
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    dump(
        {
            "vectorizer": vectorizer,
            "model": classifier,
            "meta": {
                "version": version,
                "trained_at": trained_at,
                "n_docs": len(texts),
                "metrics": metrics,
                "source": "fake_or_real_news (public mirror)",
            },
            "loaded": False,
            "error": None,
        },
        OUT_PATH,
    )
    print(f"saved {OUT_PATH} (version {version})")


if __name__ == "__main__":
    main()
