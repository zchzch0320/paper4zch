import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

test("builds a deployable GitHub Pages artifact", async () => {
  const html = await readFile(new URL("../gh-pages-dist/index.html", import.meta.url), "utf8");
  const feed = JSON.parse(await readFile(new URL("../gh-pages-dist/recommendations.json", import.meta.url), "utf8"));
  const image = await stat(new URL("../gh-pages-dist/og.png", import.meta.url));

  assert.match(html, /<title>Paper2Z · 每日文献雷达<\/title>/);
  assert.match(html, /\/paper4zch\/assets\//);
  assert.equal(feed.policy.windowDays, 365);
  assert.ok(feed.papers.length > 0);
  assert.ok(image.size > 100_000);
});

