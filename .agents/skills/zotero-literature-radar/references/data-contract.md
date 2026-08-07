# Daily digest data contract

Write UTF-8 JSON with this top-level shape:

```json
{
  "generatedAt": "ISO-8601 timestamp",
  "checkedAt": "ISO-8601 timestamp",
  "recommendationsChanged": false,
  "rotation": {
    "targetMin": 3,
    "targetMax": 5,
    "replacedCount": 0,
    "newPaperIds": [],
    "historyWindowDays": 7,
    "qualityFloor": 80,
    "insufficientNewPapers": false
  },
  "policy": {
    "windowDays": 365,
    "conferenceVenues": ["ICLR", "ICML", "NeurIPS"],
    "conferenceTrack": "main",
    "arxivQualityGate": "top-tier-rubric-v1"
  },
  "profile": {
    "paperCount": 0,
    "topics": [{"name": "topic", "weight": 0.0}],
    "summary": "short Chinese interest summary"
  },
  "papers": []
}
```

Each `papers` entry must contain:

```json
{
  "id": "stable arXiv, DOI, or venue id",
  "title": "verbatim paper title",
  "authors": ["Author One"],
  "source": "ICLR 2026 or arXiv",
  "status": "conference|arxiv|under-review|workshop",
  "publishedAt": "YYYY-MM-DD",
  "updatedAt": "YYYY-MM-DD or null",
  "primaryUrl": "https://...",
  "secondaryUrl": "https://... or null",
  "score": 0,
  "topics": ["matched topic"],
  "thesis": "one-sentence Chinese thesis",
  "method": "Chinese problem and method summary",
  "evidence": "Chinese key theorem/result claim with scope",
  "why": "Chinese personalized recommendation reason",
  "caveat": "Chinese limitation or open question"
}
```

Requirements:

- `generatedAt` records when the selected recommendation set last changed; `checkedAt` records the latest successful cloud check.
- Set `recommendationsChanged` to `true` only when the selected paper IDs or their ranking changed in the latest successful check.
- Store the bounded rotation ledger in `public/recommendation-history.json`; block papers shown during the last 7 Beijing calendar days from being reintroduced, while allowing the strongest current cards to remain.
- Each history entry stores `date`, all `paperIds` shown that day, and `introducedIds` newly rotated in that day; the bounded `catalog` retains the corresponding public paper records for later eligible reuse.
- Target 3–5 replacements per successful daily check. Set `insufficientNewPapers` when fewer than 3 unseen candidates pass the quality floor, and never lower that floor merely to fill the quota.
- Sort descending by `score`, then `publishedAt`.
- Keep `score` within 0–100.
- Reject papers outside the rolling window encoded by `policy.windowDays`.
- Require `conference` items to identify ICLR, ICML, or NeurIPS in `source`; require `arxiv` items to have passed the quality gate in `references/source-policy.md`.
- Use `null` for unknown optional values; do not guess.
- Preserve the previous valid file until the new JSON passes parsing, schema, URL, duplicate-title, and status checks.
- Do not publish private Zotero notes, keys, local paths, or attachment text.

