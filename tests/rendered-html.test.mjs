import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Paper2Z literature radar", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Paper2Z · 每日文献雷达<\/title>/i);
  assert.match(html, /从你的 Zotero 出发/);
  assert.match(html, /Hierarchical Multilevel Monte Carlo/);
  assert.match(html, /今天真正值得你读的/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});

test("removes starter preview code and metadata", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /Paper2Z/);
  assert.match(page, /paper2z-saved/);
  assert.match(layout, /lang="zh-CN"/);
  assert.doesNotMatch(page, /_sites-preview|SkeletonPreview/);
  assert.doesNotMatch(layout, /Starter Project|codex-preview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});

test("daily recommendation feed is valid and deduplicated", async () => {
  const digest = JSON.parse(await readFile(new URL("../public/recommendations.json", import.meta.url), "utf8"));
  assert.ok(Date.parse(digest.generatedAt));
  assert.ok(digest.profile.paperCount > 0);
  assert.ok(digest.papers.length >= 5 && digest.papers.length <= 8);
  assert.equal(digest.policy.windowDays, 365);
  assert.deepEqual(digest.policy.conferenceVenues, ["ICLR", "ICML", "NeurIPS"]);
  assert.equal(digest.policy.conferenceTrack, "main");
  assert.equal(digest.policy.arxivQualityGate, "top-tier-rubric-v1");

  const generatedAt = new Date(digest.generatedAt);
  const cutoff = new Date(generatedAt);
  cutoff.setUTCDate(cutoff.getUTCDate() - digest.policy.windowDays);
  const titles = new Set();
  for (const paper of digest.papers) {
    assert.ok(paper.id && paper.title && paper.thesis && paper.why && paper.caveat);
    assert.match(paper.primaryUrl, /^https:\/\//);
    assert.ok(["conference", "arxiv"].includes(paper.status));
    assert.ok(new Date(`${paper.publishedAt}T00:00:00Z`) >= cutoff, `${paper.title} falls outside the rolling year`);
    if (paper.status === "conference") assert.match(paper.source, /ICLR|ICML|NeurIPS/);
    if (paper.status === "arxiv") {
      assert.match(paper.source, /arXiv/i);
      assert.match(paper.primaryUrl, /^https:\/\/arxiv\.org\/abs\//);
    }
    assert.ok(paper.score >= 0 && paper.score <= 100);
    const normalized = paper.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    assert.ok(!titles.has(normalized), `duplicate title: ${paper.title}`);
    titles.add(normalized);
  }
});

