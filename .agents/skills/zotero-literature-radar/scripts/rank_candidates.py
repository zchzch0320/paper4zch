#!/usr/bin/env python3
"""Deduplicate and rank candidate paper metadata against a Zotero profile."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import re
from pathlib import Path


def normalize_title(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def parse_date(value: str | None) -> dt.datetime:
    try:
        return dt.datetime.fromisoformat((value or "").replace("Z", "+00:00"))
    except ValueError:
        return dt.datetime(1970, 1, 1, tzinfo=dt.timezone.utc)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile", required=True, type=Path)
    parser.add_argument("--candidates", required=True, type=Path)
    parser.add_argument("--top", type=int, default=12)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    profile = json.loads(args.profile.read_text(encoding="utf-8"))
    candidates_payload = json.loads(args.candidates.read_text(encoding="utf-8"))
    candidates = candidates_payload.get("papers", candidates_payload)
    existing = set(profile.get("existingTitles", []))
    topics = profile.get("topics", [])
    max_weight = max((float(topic["weight"]) for topic in topics), default=1.0)
    now = dt.datetime.now(dt.timezone.utc)
    seen: set[str] = set()
    ranked = []

    for paper in candidates:
        title_key = normalize_title(paper.get("title", ""))
        if not title_key or title_key in existing or title_key in seen:
            continue
        seen.add(title_key)
        haystack = " ".join((paper.get("title", ""), paper.get("summary", ""), paper.get("comment", ""))).lower()
        matched = []
        relevance = 0.0
        for topic in topics:
            name = str(topic["name"]).lower()
            if name in haystack:
                normalized_weight = float(topic["weight"]) / max_weight
                relevance += normalized_weight * (1.7 if " " in name else 0.55)
                matched.append(topic["name"])
        relevance = 1.0 - math.exp(-relevance)
        published = parse_date(paper.get("published") or paper.get("publishedAt"))
        age_days = max(0, (now - published).days)
        freshness = math.exp(-age_days / 240.0)
        status = paper.get("status") or paper.get("source", "arxiv")
        status_bonus = 1.0 if status == "conference" else 0.78 if status == "arxiv" else 0.62
        score = round(100 * (0.68 * relevance + 0.24 * freshness + 0.08 * status_bonus))
        enriched = dict(paper)
        enriched["score"] = max(0, min(score, 100))
        enriched["matchedTopics"] = matched[:6]
        ranked.append(enriched)

    ranked.sort(key=lambda paper: (paper["score"], paper.get("published") or paper.get("publishedAt") or ""), reverse=True)
    payload = json.dumps({"generatedAt": now.isoformat(), "papers": ranked[: args.top]}, ensure_ascii=False, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(payload + "\n", encoding="utf-8")
    else:
        print(payload)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

