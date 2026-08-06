# Source policy

## Eligibility window and venue scope

- Use a rolling 365-day window ending at `generatedAt`.
- Conference eligibility is limited to accepted **ICLR, ICML, and NeurIPS main-track** papers. Exclude workshops, tutorials, challenges, side tracks, submissions without an acceptance decision, rejected/withdrawn papers, and papers from other venues.
- For conference papers, evaluate the window using the official conference publication or acceptance date. For arXiv papers, use the first arXiv submission date, not the latest revision date.
- If the eligible set is sparse, publish fewer recommendations. Never widen the venue list or date window silently.

## Precedence

1. Official conference program or proceedings record.
2. OpenReview forum page with an explicit published/accepted venue decision.
3. arXiv abstract page and version history.
4. Author project page only for code or supplementary context.

Do not use aggregators as the factual source when a primary record exists.

## Status labels

- `conference`: official proceedings/program, or OpenReview explicitly says published/accepted at ICLR, ICML, or NeurIPS main track.
- `under-review`: submission record without a verified acceptance decision.
- `arxiv`: arXiv record without a verified publication venue.

If a paper has both arXiv and a verified conference version, keep one card, label it `conference`, and retain both URLs when useful.

`workshop` and `under-review` items are ineligible for this feed even though the data contract retains those labels for compatibility.

## arXiv top-tier-quality gate

“Top-tier quality” is an editorial screening judgment, not a factual venue status or acceptance forecast. Score each arXiv candidate from 0–4 on:

1. Problem importance and fit to the Zotero profile.
2. Novelty relative to closely related work.
3. Technical depth and correctness signals, including explicit assumptions and theorem/proof structure when theoretical.
4. Evidence strength: appropriate baselines, ablations, scale, uncertainty reporting, or complete formal guarantees.
5. Completeness and reproducibility: sufficiently detailed paper, code/data when relevant, and claims traceable to the text.

Include only candidates scoring at least 15/20, with no score below 2 for novelty, technical depth, or evidence strength. Read beyond the abstract before scoring. Record a concise selection rationale internally, and expose limitations in `caveat`. Do not use author affiliation, reputation, social-media attention, or citation count as a substitute for paper quality.

## Dates

- Freshness uses the first public submission/publication date.
- Display an updated date separately when a revision is substantively relevant.
- Never interpret a crawler timestamp or OpenReview modification timestamp as the publication date.

## Search coverage

For theoretical reinforcement learning, search these threads independently within the eligible venue and date boundary:

- constrained/safe RL and CMDPs;
- robust or distributionally robust RL;
- low-rank/linear/general function approximation;
- POMDPs, partially observable games, and multi-agent RL;
- preference learning/RLHF theory when present in the library profile.

Expand or narrow the list from the actual Zotero profile.

