import { readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const digestPath = resolve(projectRoot, "public", "recommendations.json");
const DAY_MS = 86_400_000;

const TOPIC_RULES = [
  { name: "安全 / CMDP", terms: ["constrained reinforcement", "safe reinforcement", "cmdp", "constraint violation", "primal-dual"] },
  { name: "分布鲁棒", terms: ["distributionally robust", "robust reinforcement", "uncertainty set", "worst-case"] },
  { name: "多智能体博弈", terms: ["multi-agent", "multiagent", "markov game", "self-play", "imperfect information"] },
  { name: "函数逼近 / 理论", terms: ["function approximation", "linear mdp", "low-rank", "sample complexity", "regret bound"] },
  { name: "Actor–Critic", terms: ["actor-critic", "policy gradient", "natural policy gradient"] },
  { name: "RLHF / 偏好学习", terms: ["preference learning", "rlhf", "reward model", "human feedback"] },
];

const EVIDENCE_TERMS = [
  "we prove", "we establish", "theorem", "convergence", "sample complexity", "regret",
  "experiments", "empirical", "benchmark", "ablation", "finite-sample", "upper bound", "lower bound",
];

export function normalizeWhitespace(value = "") {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function decodeXml(value = "") {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

function tagValue(block, tag) {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return normalizeWhitespace(decodeXml(match?.[1] ?? ""));
}

export function parseArxivFeed(xml) {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)].map((match) => {
    const block = match[1];
    const idUrl = tagValue(block, "id");
    const id = idUrl.match(/abs\/(.+?)(?:v\d+)?$/)?.[1] ?? idUrl;
    const authors = [...block.matchAll(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/gi)]
      .map((author) => normalizeWhitespace(decodeXml(author[1])));
    return {
      id,
      title: tagValue(block, "title"),
      abstract: tagValue(block, "summary"),
      authors,
      publishedAt: tagValue(block, "published").slice(0, 10),
      updatedAt: tagValue(block, "updated").slice(0, 10) || null,
      primaryUrl: `https://arxiv.org/abs/${id}`,
    };
  }).filter((paper) => paper.id && paper.title && paper.abstract && paper.publishedAt);
}

function matchedTopics(text) {
  const lower = text.toLowerCase();
  return TOPIC_RULES
    .map((rule) => ({ name: rule.name, hits: rule.terms.filter((term) => lower.includes(term)).length }))
    .filter((rule) => rule.hits > 0)
    .sort((a, b) => b.hits - a.hits);
}

function sentences(text) {
  return normalizeWhitespace(text).split(/(?<=[.!?])\s+/).filter(Boolean);
}

function clip(text, limit) {
  const clean = normalizeWhitespace(text);
  return clean.length <= limit ? clean : `${clean.slice(0, limit - 1).trim()}…`;
}

export function screenArxivPaper(paper, now = new Date()) {
  const text = `${paper.title}. ${paper.abstract}`;
  const topics = matchedTopics(text);
  const lower = text.toLowerCase();
  const evidenceHits = EVIDENCE_TERMS.filter((term) => lower.includes(term));
  const ageDays = Math.max(0, Math.floor((now - new Date(`${paper.publishedAt}T00:00:00Z`)) / DAY_MS));
  if (ageDays > 365 || topics.reduce((sum, topic) => sum + topic.hits, 0) < 2 || evidenceHits.length < 1 || paper.abstract.length < 200) return null;

  const relevance = topics.reduce((sum, topic) => sum + topic.hits, 0);
  const freshness = Math.max(0, 8 - Math.floor(ageDays / 45));
  const score = Math.min(96, 62 + Math.min(20, relevance * 3) + Math.min(6, evidenceHits.length * 2) + freshness);
  const abstractSentences = sentences(paper.abstract);
  const evidenceSentence = abstractSentences.find((sentence) => EVIDENCE_TERMS.some((term) => sentence.toLowerCase().includes(term)));
  const topicNames = topics.slice(0, 3).map((topic) => topic.name);

  return {
    id: paper.id,
    title: paper.title,
    authors: paper.authors,
    source: `arXiv · ${paper.publishedAt.replaceAll("-", ".")}`,
    status: "arxiv",
    publishedAt: paper.publishedAt,
    updatedAt: paper.updatedAt,
    primaryUrl: paper.primaryUrl,
    secondaryUrl: null,
    score,
    topics: topicNames,
    thesis: `作者摘要要点：${clip(abstractSentences[0] ?? paper.abstract, 260)}`,
    method: `公开摘要自动整理：${clip(paper.abstract, 520)}`,
    evidence: evidenceSentence ? `摘要中的证据信号：${clip(evidenceSentence, 320)}` : "作者摘要未提供足够具体的理论或实验结果，需阅读正文核验。",
    why: `与公开研究画像中的「${topicNames.join("、")}」方向匹配。`,
    caveat: "这是免费云端流程基于标题和公开摘要的自动初筛，不是完整同行评审、录用预测或正文级质量评估。",
  };
}

function normalizedTitle(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function buildDigest(previous, fetched, now = new Date()) {
  const cutoff = new Date(now.getTime() - 365 * DAY_MS);
  const eligibleExisting = previous.papers.filter((paper) => new Date(`${paper.publishedAt}T00:00:00Z`) >= cutoff);
  const screened = fetched.map((paper) => screenArxivPaper(paper, now)).filter(Boolean);
  const byTitle = new Map(eligibleExisting.map((paper) => [normalizedTitle(paper.title), paper]));
  for (const paper of screened) if (!byTitle.has(normalizedTitle(paper.title))) byTitle.set(normalizedTitle(paper.title), paper);

  const all = [...byTitle.values()].sort((a, b) => b.score - a.score || b.publishedAt.localeCompare(a.publishedAt));
  const conferences = all.filter((paper) => paper.status === "conference").slice(0, 2);
  const arxiv = all.filter((paper) => paper.status === "arxiv").slice(0, 6);
  const preferred = [...arxiv, ...conferences];
  const preferredIds = new Set(preferred.map((paper) => paper.id));
  const selected = [...preferred, ...all.filter((paper) => !preferredIds.has(paper.id))]
    .sort((a, b) => b.score - a.score || b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 8);

  return {
    generatedAt: now.toISOString(),
    policy: {
      windowDays: 365,
      conferenceVenues: ["ICLR", "ICML", "NeurIPS"],
      conferenceTrack: "main",
      arxivQualityGate: "automated-abstract-screen-v1",
    },
    profile: previous.profile,
    papers: selected,
  };
}

export function validateDigest(digest, now = new Date(digest.generatedAt)) {
  if (!Date.parse(digest.generatedAt) || !digest.profile || !Array.isArray(digest.papers) || digest.papers.length < 5 || digest.papers.length > 8) throw new Error("invalid digest shape");
  const cutoff = new Date(now.getTime() - 365 * DAY_MS);
  const titles = new Set();
  for (const paper of digest.papers) {
    if (!paper.id || !paper.title || !paper.thesis || !paper.why || !paper.caveat || !paper.primaryUrl?.startsWith("https://")) throw new Error(`invalid paper: ${paper.title || paper.id}`);
    if (new Date(`${paper.publishedAt}T00:00:00Z`) < cutoff) throw new Error(`paper outside rolling window: ${paper.title}`);
    if (paper.status === "conference" && !/(ICLR|ICML|NeurIPS)/.test(paper.source)) throw new Error(`unverified conference source: ${paper.title}`);
    if (paper.status === "arxiv" && !paper.primaryUrl.startsWith("https://arxiv.org/abs/")) throw new Error(`invalid arXiv source: ${paper.title}`);
    const title = normalizedTitle(paper.title);
    if (titles.has(title)) throw new Error(`duplicate title: ${paper.title}`);
    titles.add(title);
  }
  return true;
}

async function fetchRecentArxiv() {
  const query = '(all:"reinforcement learning" OR all:"markov game") AND (all:constrained OR all:safe OR all:robust OR all:"multi-agent" OR all:"function approximation" OR all:"low-rank" OR all:"actor-critic" OR all:preference)';
  const url = new URL("https://export.arxiv.org/api/query");
  url.searchParams.set("search_query", query);
  url.searchParams.set("start", "0");
  url.searchParams.set("max_results", "60");
  url.searchParams.set("sortBy", "submittedDate");
  url.searchParams.set("sortOrder", "descending");
  const response = await fetch(url, { headers: { "user-agent": "Paper4ZCH/1.0 (https://github.com/zchzch0320/paper4zch)" } });
  if (!response.ok) throw new Error(`arXiv request failed: ${response.status}`);
  return parseArxivFeed(await response.text());
}

async function main() {
  const previous = JSON.parse(await readFile(digestPath, "utf8"));
  const fetched = await fetchRecentArxiv();
  const next = buildDigest(previous, fetched, new Date());
  validateDigest(next);
  const temporary = `${digestPath}.tmp`;
  await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  await rename(temporary, digestPath);
  console.log(`Paper4ZCH selected ${next.papers.length} papers from ${fetched.length} recent arXiv records.`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

