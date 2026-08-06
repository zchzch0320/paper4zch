#!/usr/bin/env python3
"""Fetch recent arXiv metadata for explicit search queries."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path


ATOM = "{http://www.w3.org/2005/Atom}"
ARXIV = "{http://arxiv.org/schemas/atom}"


def clean(value: str | None) -> str:
    return " ".join((value or "").split())


def fetch(query: str, max_results: int) -> list[dict]:
    params = urllib.parse.urlencode({
        "search_query": query,
        "start": 0,
        "max_results": max_results,
        "sortBy": "submittedDate",
        "sortOrder": "descending",
    })
    request = urllib.request.Request(
        f"https://export.arxiv.org/api/query?{params}",
        headers={"User-Agent": "paper2z-literature-radar/0.1"},
    )
    with urllib.request.urlopen(request, timeout=40) as response:
        root = ET.fromstring(response.read())
    papers = []
    for entry in root.findall(f"{ATOM}entry"):
        entry_url = clean(entry.findtext(f"{ATOM}id"))
        arxiv_id = entry_url.rsplit("/", 1)[-1]
        links = {node.attrib.get("type", ""): node.attrib.get("href") for node in entry.findall(f"{ATOM}link")}
        papers.append({
            "id": arxiv_id,
            "title": clean(entry.findtext(f"{ATOM}title")),
            "authors": [clean(node.findtext(f"{ATOM}name")) for node in entry.findall(f"{ATOM}author")],
            "summary": clean(entry.findtext(f"{ATOM}summary")),
            "published": clean(entry.findtext(f"{ATOM}published")),
            "updated": clean(entry.findtext(f"{ATOM}updated")),
            "url": entry_url,
            "pdfUrl": links.get("application/pdf"),
            "categories": [node.attrib.get("term") for node in entry.findall(f"{ATOM}category")],
            "comment": clean(entry.findtext(f"{ARXIV}comment")),
            "journalRef": clean(entry.findtext(f"{ARXIV}journal_ref")),
            "source": "arxiv",
            "query": query,
        })
    return papers


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--query", action="append", required=True)
    parser.add_argument("--max-per-query", type=int, default=30)
    parser.add_argument("--days", type=int, default=365)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    cutoff = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=args.days)
    merged: dict[str, dict] = {}
    for index, query in enumerate(args.query):
        if index:
            time.sleep(3)
        for paper in fetch(query, args.max_per_query):
            try:
                published = dt.datetime.fromisoformat(paper["published"].replace("Z", "+00:00"))
            except ValueError:
                continue
            if published >= cutoff:
                merged.setdefault(paper["id"].split("v", 1)[0], paper)
    papers = sorted(merged.values(), key=lambda paper: paper["published"], reverse=True)
    payload = json.dumps({"generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(), "papers": papers}, ensure_ascii=False, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(payload + "\n", encoding="utf-8")
    else:
        sys.stdout.write(payload + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

