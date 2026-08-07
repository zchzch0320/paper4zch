---
name: zotero-literature-radar
description: Build personalized academic-paper recommendations from a Zotero library or public derived profile, restricted to accepted ICLR, ICML, and NeurIPS main-track papers from the latest rolling year plus clearly labeled arXiv candidates from the same period. Deduplicate and rank candidates, produce evidence-grounded summaries, and prepare daily digest data for the Paper4ZCH website or cloud automation.
---

# Zotero Literature Radar

Create a compact, high-precision daily paper feed from the user's actual reading history. Prefer a few defensible recommendations over a broad keyword dump.

## Workflow

1. Acquire the interest signal.
   - Prefer an authorized Zotero connector when available.
   - Otherwise, read a local `zotero.sqlite` strictly read-only with `scripts/build_interest_profile.py`.
   - If neither is available, request a Zotero CSV/JSON/RDF export.
   - Read bibliographic metadata, abstracts, tags, collections, and save dates only. Do not modify the library or inspect/upload attachments unless explicitly requested.
2. Build the profile.
   - Weight recent saves, repeated topics, explicit tags, and paper titles more than generic abstract vocabulary.
   - Retain several distinct research threads rather than collapsing everything into one keyword.
   - Treat the profile as an interest prior, not proof that every saved paper was liked.
3. Discover candidates.
   - Browse because recency and acceptance status are time-sensitive.
   - Apply a rolling 365-day window from the digest generation time.
   - For conference papers, search only accepted ICLR, ICML, and NeurIPS main-track papers. Verify acceptance using the official program/proceedings or an explicit accepted/published OpenReview record.
   - For preprints, search arXiv only and apply the top-tier-quality rubric in `references/source-policy.md`. Treat the result as an editorial quality assessment, never as an acceptance prediction.
   - Search each major interest thread separately, then merge results.
   - Verify title, authors, first-submission/publication date, version date, URL, and venue status from the primary page.
4. Normalize and rank.
   - Remove papers already in Zotero and collapse arXiv/conference duplicates by normalized title or DOI/arXiv ID.
   - Use `scripts/rank_candidates.py` for a reproducible first pass.
   - Balance relevance, freshness, source status, novelty relative to the library, and diversity.
   - Default to 5–8 papers. Avoid filling a quota with weak matches.
5. Read and summarize.
   - Read at least the abstract and primary record for every recommended paper; inspect the paper when claims cannot be supported by the abstract.
   - Write Chinese summaries containing: one-sentence thesis, problem/method, key theoretical or empirical claim, relevance to the user's library, and one limitation or question.
   - Distinguish author claims from independent inference. Never invent theorem assumptions, numerical results, acceptance decisions, or reviewer sentiment.
6. Publish the digest.
   - Follow `references/data-contract.md` when writing site data.
   - Link each card directly to its primary source.
   - Show the retrieval date and label items as `conference`, `arxiv`, `under-review`, or `workshop` only when verified.
7. Refresh automatically.
   - For this project, use the GitHub Actions retry schedule and the public derived profile so refreshes do not require the user's computer or Codex.
   - Attempt at several distributed cloud time slots, but use the Beijing calendar date in `checkedAt` to publish at most once after the first successful check that day.
   - Keep `generatedAt` as the time the recommendation set last changed. Update `checkedAt` after every successful daily check and set `recommendationsChanged` truthfully so the site can distinguish a fresh unchanged check from a stale feed.
   - Run the deterministic cloud refresh, validation, static build, and Pages deployment; publish only when validation succeeds.
   - Preserve the previous valid digest if retrieval, summarization, build, or deployment fails.

## Source and status rules

Read `references/source-policy.md` before a live search. Conference labels require an official accepted/published ICLR, ICML, or NeurIPS main-track record. A submission, workshop paper, or withdrawn paper is not eligible as a conference paper. Use the original arXiv submission date for preprint eligibility and display a separate updated date when useful.

## Quality gates

- Cite a primary URL for every recommendation.
- Reject conference papers outside the three named main tracks and reject every item older than the rolling 365-day window.
- Require every arXiv recommendation to pass the documented quality rubric; label it `arxiv`, not “top-conference accepted” or “likely accepted.”
- Exclude existing Zotero titles unless the user requests updates to known work.
- Keep summaries traceable to the paper record or text.
- Include at least two distinct interest threads when enough strong candidates exist.
- Flag sparse or failed retrieval instead of silently substituting old or unrelated work.
- Never expose Zotero API keys, local database paths, private notes, or attachment contents in the published site.

## Bundled tools

- `scripts/build_interest_profile.py`: extract a weighted profile from Zotero metadata without modifying the database.
- `scripts/fetch_arxiv.py`: fetch recent arXiv metadata for explicit queries.
- `scripts/rank_candidates.py`: deduplicate and score candidate metadata against the profile.
- `references/data-contract.md`: digest schema and writing contract.
- `references/source-policy.md`: source precedence, date handling, and venue-status checks.

