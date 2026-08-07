import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("builds a deployable GitHub Pages artifact", async () => {
  const html = await readFile(new URL("../gh-pages-dist/index.html", import.meta.url), "utf8");
  const feed = JSON.parse(await readFile(new URL("../gh-pages-dist/recommendations.json", import.meta.url), "utf8"));
  const history = JSON.parse(await readFile(new URL("../gh-pages-dist/recommendation-history.json", import.meta.url), "utf8"));
  assert.match(html, /<title>Paper4ZCH · 每日文献雷达<\/title>/);
  assert.match(html, /\/paper4zch\/assets\//);
  assert.equal(feed.policy.windowDays, 365);
  assert.ok(Date.parse(feed.checkedAt));
  assert.equal(typeof feed.recommendationsChanged, "boolean");
  assert.equal(feed.rotation.historyWindowDays, 7);
  assert.ok(feed.papers.length > 0);
  assert.equal(history.windowDays, 7);
  assert.equal(history.retentionDays, 30);
  assert.ok(history.entries.length > 0);
});
