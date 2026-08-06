#!/usr/bin/env python3
"""Build a lightweight interest profile from a Zotero SQLite database."""

from __future__ import annotations

import argparse
import collections
import datetime as dt
import json
import math
import re
import sqlite3
import sys
from pathlib import Path
from urllib.parse import quote


ITEM_TYPES = ("journalArticle", "conferencePaper", "preprint", "report", "thesis")
STOPWORDS = {
    "all", "and", "any", "are", "artificial", "computer", "could", "deep", "during", "field",
    "find", "for", "function", "how", "however", "intelligence", "its", "may", "machine",
    "mean", "our", "over", "science", "some", "systems", "tasks", "the", "they", "those",
    "towards", "training", "used", "via", "was", "were", "will",
    "about", "after", "again", "against", "algorithm", "algorithms", "also", "among",
    "approach", "based", "been", "being", "between", "both", "can", "data", "different",
    "does", "each", "efficient", "existing", "first", "from", "general", "have", "into",
    "learning", "method", "methods", "model", "models", "more", "most", "new", "novel",
    "online", "only", "optimal", "paper", "policy", "problem", "propose", "proposed",
    "provide", "reinforcement", "results", "setting", "settings", "show", "study", "such",
    "than", "that", "their", "theory", "there", "these", "this", "through", "under",
    "using", "value", "where", "which", "while", "with", "without", "work",
}
PHRASES = (
    "constrained reinforcement learning", "safe reinforcement learning", "constrained mdp",
    "distributionally robust reinforcement learning", "robust reinforcement learning",
    "low-rank mdp", "linear function approximation", "general function approximation",
    "partially observable markov game", "partially observable stochastic game",
    "partially observable reinforcement learning", "multi-agent reinforcement learning",
    "preference optimization", "reinforcement learning from human feedback",
    "offline reinforcement learning", "representation learning", "actor-critic",
)


def normalize_title(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def parse_date(value: str) -> dt.datetime:
    try:
        return dt.datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        return dt.datetime(1970, 1, 1)


def connect_read_only(path: Path) -> sqlite3.Connection:
    resolved = quote(path.resolve().as_posix(), safe="/:")
    return sqlite3.connect(f"file:{resolved}?mode=ro", uri=True)


def load_items(connection: sqlite3.Connection, limit: int) -> list[dict]:
    placeholders = ",".join("?" for _ in ITEM_TYPES)
    query = f"""
        SELECT i.itemID, it.typeName,
               COALESCE(MAX(CASE WHEN f.fieldName='title' THEN v.value END), ''),
               COALESCE(MAX(CASE WHEN f.fieldName='abstractNote' THEN v.value END), ''),
               i.dateAdded
        FROM items i
        JOIN itemTypes it ON it.itemTypeID=i.itemTypeID
        LEFT JOIN itemData d ON d.itemID=i.itemID
        LEFT JOIN fields f ON f.fieldID=d.fieldID
        LEFT JOIN itemDataValues v ON v.valueID=d.valueID
        LEFT JOIN deletedItems di ON di.itemID=i.itemID
        WHERE di.itemID IS NULL AND it.typeName IN ({placeholders})
        GROUP BY i.itemID, it.typeName, i.dateAdded
        ORDER BY i.dateAdded DESC
        LIMIT ?
    """
    rows = connection.execute(query, (*ITEM_TYPES, limit)).fetchall()
    items = []
    for item_id, item_type, title, abstract, date_added in rows:
        tags = [
            row[0]
            for row in connection.execute(
                "SELECT t.name FROM itemTags it JOIN tags t ON t.tagID=it.tagID WHERE it.itemID=?",
                (item_id,),
            )
        ]
        if title.strip():
            items.append({
                "id": item_id,
                "type": item_type,
                "title": title.strip(),
                "abstract": abstract.strip(),
                "tags": tags,
                "dateAdded": date_added,
            })
    return items


def build_profile(items: list[dict], topic_limit: int) -> dict:
    now = dt.datetime.now(dt.timezone.utc).replace(tzinfo=None)
    scores: collections.Counter[str] = collections.Counter()
    counts: collections.Counter[str] = collections.Counter()
    seen_titles: set[str] = set()
    anchors = []

    for item in items:
        normalized = normalize_title(item["title"])
        if not normalized or normalized in seen_titles:
            continue
        seen_titles.add(normalized)
        age_days = max(0, (now - parse_date(item["dateAdded"])).days)
        recency = 0.35 + 0.65 * math.exp(-age_days / 240.0)
        title_text = item["title"].lower()
        abstract_text = item["abstract"].lower()
        tag_text = " ".join(item["tags"]).lower()
        combined = f"{title_text} {abstract_text} {tag_text}"

        for phrase in PHRASES:
            occurrences = combined.count(phrase)
            if occurrences:
                scores[phrase] += recency * (4.0 + min(occurrences, 3))
                counts[phrase] += 1

        for source, multiplier in ((title_text, 2.8), (abstract_text, 0.45), (tag_text, 3.6)):
            for token in re.findall(r"[a-z][a-z0-9-]{2,}", source):
                if token not in STOPWORDS and not token.isdigit():
                    scores[token] += recency * multiplier
                    counts[token] += 1

        if len(anchors) < 20:
            anchors.append({
                "title": item["title"],
                "type": item["type"],
                "dateAdded": item["dateAdded"],
            })

    phrase_ranked = [
        {"name": name, "weight": round(weight, 3), "documentCount": counts[name]}
        for name, weight in sorted(
            ((name, scores[name]) for name in PHRASES if scores[name] > 0),
            key=lambda pair: pair[1],
            reverse=True,
        )
    ]
    token_ranked = [
        {"name": name, "weight": round(weight, 3), "documentCount": counts[name]}
        for name, weight in scores.most_common(topic_limit * 4)
        if name not in PHRASES and counts[name] >= 2
    ]
    phrase_slots = min(len(phrase_ranked), max(8, topic_limit // 2))
    ranked = phrase_ranked[:phrase_slots] + token_ranked[: topic_limit - phrase_slots]
    return {
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "library": {
            "paperCount": len(items),
            "uniqueTitleCount": len(seen_titles),
            "latestSave": max((item["dateAdded"] for item in items), default=None),
        },
        "topics": ranked,
        "anchors": anchors,
        "existingTitles": sorted(seen_titles),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", required=True, type=Path)
    parser.add_argument("--limit", type=int, default=600)
    parser.add_argument("--topics", type=int, default=24)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if not args.db.exists():
        parser.error(f"Zotero database not found: {args.db}")
    with connect_read_only(args.db) as connection:
        profile = build_profile(load_items(connection, args.limit), args.topics)
    payload = json.dumps(profile, ensure_ascii=False, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(payload + "\n", encoding="utf-8")
    else:
        sys.stdout.write(payload + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

