import assert from "node:assert/strict";
import test from "node:test";
import { buildDigest, parseArxivFeed, screenArxivPaper, validateDigest } from "../scripts/cloud_refresh.mjs";

const sampleFeed = `<?xml version="1.0"?><feed><entry>
  <id>https://arxiv.org/abs/2608.12345v1</id>
  <updated>2026-08-05T10:00:00Z</updated><published>2026-08-05T10:00:00Z</published>
  <title>Provable Safe Reinforcement Learning with Linear Function Approximation</title>
  <summary>We study constrained reinforcement learning with linear function approximation. We prove a finite-sample convergence theorem and establish a sample complexity bound. Experiments on benchmark environments validate the method and include an ablation study.</summary>
  <author><name>Alice Example</name></author><author><name>Bob Example</name></author>
</entry></feed>`;

test("parses and screens recent arXiv metadata", () => {
  const [paper] = parseArxivFeed(sampleFeed);
  assert.equal(paper.id, "2608.12345");
  assert.deepEqual(paper.authors, ["Alice Example", "Bob Example"]);
  const screened = screenArxivPaper(paper, new Date("2026-08-06T00:00:00Z"));
  assert.equal(screened.status, "arxiv");
  assert.match(screened.caveat, /自动初筛/);
  assert.ok(screened.score >= 70 && screened.score <= 96);
});

test("builds a valid rolling digest while preserving verified conference papers", () => {
  const previous = {
    profile: { paperCount: 800, topics: [{ name: "安全 / CMDP", weight: 1 }], summary: "test" },
    papers: Array.from({ length: 5 }, (_, index) => ({
      id: `conf-${index}`,
      title: `Verified Conference Paper ${index}`,
      authors: ["Author"], source: "ICLR 2026", status: "conference", publishedAt: "2026-01-26",
      updatedAt: null, primaryUrl: `https://openreview.net/forum?id=${index}`, secondaryUrl: null,
      score: 90 - index, topics: ["安全 / CMDP"], thesis: "thesis", method: "method", evidence: "evidence", why: "why", caveat: "caveat",
    })),
  };
  const fetched = parseArxivFeed(sampleFeed);
  const digest = buildDigest(previous, fetched, new Date("2026-08-06T00:00:00Z"));
  assert.equal(digest.policy.arxivQualityGate, "automated-abstract-screen-v1");
  assert.ok(digest.papers.some((paper) => paper.status === "conference"));
  assert.ok(digest.papers.some((paper) => paper.id === "2608.12345"));
  assert.equal(validateDigest(digest), true);
});

