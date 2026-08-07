import { readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const digestPath = resolve(projectRoot, "public", "recommendations.json");
const historyPath = resolve(projectRoot, "public", "recommendation-history.json");
const DAY_MS = 86_400_000;
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;
const HISTORY_WINDOW_DAYS = 7;
const HISTORY_RETENTION_DAYS = 30;
const ROTATION_MIN_SCORE = 80;

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

export function beijingDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Date(date.getTime() + BEIJING_OFFSET_MS).toISOString().slice(0, 10);
}

export function shouldRefreshToday(previous, now = new Date()) {
  const lastSuccessfulCheck = previous.checkedAt ?? previous.generatedAt;
  return beijingDateKey(lastSuccessfulCheck) !== beijingDateKey(now);
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

function beijingDayAge(dateKey, now) {
  const today = Date.parse(`${beijingDateKey(now)}T00:00:00Z`);
  const date = Date.parse(`${dateKey}T00:00:00Z`);
  return Number.isFinite(date) ? Math.floor((today - date) / DAY_MS) : Number.POSITIVE_INFINITY;
}

export function normalizeHistory(history = {}) {
  return {
    windowDays: HISTORY_WINDOW_DAYS,
    retentionDays: HISTORY_RETENTION_DAYS,
    entries: Array.isArray(history.entries) ? history.entries
      .filter((entry) => entry?.date && Array.isArray(entry.paperIds))
      .map((entry) => ({ ...entry, introducedIds: Array.isArray(entry.introducedIds) ? entry.introducedIds : [] })) : [],
    catalog: Array.isArray(history.catalog) ? history.catalog : [],
  };
}

function recordHistory(history, candidatePapers, selected, introducedIds, now) {
  const normalized = normalizeHistory(history);
  const today = beijingDateKey(now);
  const entriesByDate = new Map(normalized.entries.map((entry) => [entry.date, {
    paperIds: new Set(entry.paperIds),
    introducedIds: new Set(entry.introducedIds),
  }]));
  const todayEntry = entriesByDate.get(today) ?? { paperIds: new Set(), introducedIds: new Set() };
  const todayIds = todayEntry.paperIds;
  selected.forEach((paper) => todayIds.add(paper.id));
  introducedIds.forEach((id) => todayEntry.introducedIds.add(id));
  entriesByDate.set(today, todayEntry);

  const entries = [...entriesByDate.entries()]
    .filter(([date]) => beijingDayAge(date, now) < HISTORY_RETENTION_DAYS)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, entry]) => ({ date, paperIds: [...entry.paperIds], introducedIds: [...entry.introducedIds] }));
  const retainedIds = new Set(entries.flatMap((entry) => entry.paperIds));
  const catalogById = new Map(normalized.catalog.map((paper) => [paper.id, paper]));
  candidatePapers.forEach((paper) => catalogById.set(paper.id, paper));
  const catalog = [...catalogById.values()].filter((paper) => retainedIds.has(paper.id));
  return { windowDays: HISTORY_WINDOW_DAYS, retentionDays: HISTORY_RETENTION_DAYS, entries, catalog };
}

export function buildRefresh(previous, fetched, history = {}, now = new Date()) {
  const cutoff = new Date(now.getTime() - 365 * DAY_MS);
  const normalizedHistory = normalizeHistory(history);
  const eligibleExisting = [...previous.papers, ...normalizedHistory.catalog]
    .filter((paper) => new Date(`${paper.publishedAt}T00:00:00Z`) >= cutoff);
  const screened = fetched.map((paper) => screenArxivPaper(paper, now)).filter(Boolean);
  const byTitle = new Map(eligibleExisting.map((paper) => [normalizedTitle(paper.title), paper]));
  for (const paper of screened) if (!byTitle.has(normalizedTitle(paper.title))) byTitle.set(normalizedTitle(paper.title), paper);

  const all = [...byTitle.values()].sort((a, b) => b.score - a.score || b.publishedAt.localeCompare(a.publishedAt));
  const recentIds = new Set(normalizedHistory.entries
    .filter((entry) => beijingDayAge(entry.date, now) < HISTORY_WINDOW_DAYS)
    .flatMap((entry) => entry.paperIds));
  const currentIds = new Set(previous.papers.map((paper) => paper.id));
  const freshCandidates = all.filter((paper) => !currentIds.has(paper.id) && !recentIds.has(paper.id) && paper.score >= ROTATION_MIN_SCORE);
  const today = beijingDateKey(now);
  const todayEntry = normalizedHistory.entries.find((entry) => entry.date === today);
  const fallbackIntroducedIds = beijingDateKey(previous.checkedAt) === today ? (previous.rotation?.newPaperIds ?? []) : [];
  const alreadyIntroducedIds = new Set(todayEntry?.introducedIds?.length ? todayEntry.introducedIds : fallbackIntroducedIds);
  const excellentCount = freshCandidates.filter((paper) => paper.score >= 88).length;
  const targetTotal = excellentCount >= 5 ? 5 : excellentCount >= 4 ? 4 : 3;
  const replacementTarget = Math.min(freshCandidates.length, Math.max(0, 5 - alreadyIntroducedIds.size), Math.max(0, targetTotal - alreadyIntroducedIds.size));
  const rotatedIn = freshCandidates.slice(0, replacementTarget);
  rotatedIn.forEach((paper) => alreadyIntroducedIds.add(paper.id));
  const keepers = previous.papers
    .filter((paper) => new Date(`${paper.publishedAt}T00:00:00Z`) >= cutoff)
    .sort((a, b) => b.score - a.score || b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, Math.max(0, 8 - rotatedIn.length));
  const selected = [...rotatedIn, ...keepers]
    .sort((a, b) => b.score - a.score || b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 8);
  const previousIds = previous.papers.map((paper) => paper.id);
  const selectedIds = selected.map((paper) => paper.id);
  const recommendationsChanged = previousIds.length !== selectedIds.length
    || previousIds.some((id, index) => id !== selectedIds[index]);

  const digest = {
    generatedAt: recommendationsChanged ? now.toISOString() : (previous.generatedAt ?? now.toISOString()),
    checkedAt: now.toISOString(),
    recommendationsChanged,
    rotation: {
      targetMin: 3,
      targetMax: 5,
      replacedCount: alreadyIntroducedIds.size,
      newPaperIds: [...alreadyIntroducedIds],
      historyWindowDays: HISTORY_WINDOW_DAYS,
      qualityFloor: ROTATION_MIN_SCORE,
      insufficientNewPapers: alreadyIntroducedIds.size < 3,
    },
    policy: {
      windowDays: 365,
      conferenceVenues: ["ICLR", "ICML", "NeurIPS"],
      conferenceTrack: "main",
      arxivQualityGate: "automated-abstract-screen-v1",
    },
    profile: previous.profile,
    papers: selected,
  };
  const nextHistory = recordHistory(normalizedHistory, [...eligibleExisting, ...screened, ...previous.papers, ...selected], selected, alreadyIntroducedIds, now);
  return { digest, history: nextHistory };
}

export function buildDigest(previous, fetched, now = new Date(), history = {}) {
  return buildRefresh(previous, fetched, history, now).digest;
}

export function validateDigest(digest, now = new Date(digest.generatedAt)) {
  if (!Date.parse(digest.generatedAt) || !digest.profile || !Array.isArray(digest.papers) || digest.papers.length < 5 || digest.papers.length > 8) throw new Error("invalid digest shape");
  if (!Date.parse(digest.checkedAt) || typeof digest.recommendationsChanged !== "boolean") throw new Error("invalid refresh status");
  if (!digest.rotation || digest.rotation.replacedCount < 0 || digest.rotation.replacedCount > 5 || !Array.isArray(digest.rotation.newPaperIds)) throw new Error("invalid rotation status");
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

export function validateHistory(history) {
  const normalized = normalizeHistory(history);
  if (normalized.windowDays !== HISTORY_WINDOW_DAYS || normalized.retentionDays !== HISTORY_RETENTION_DAYS) throw new Error("invalid history policy");
  const catalogIds = new Set(normalized.catalog.map((paper) => paper.id));
  for (const entry of normalized.entries) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date) || new Set(entry.paperIds).size !== entry.paperIds.length || new Set(entry.introducedIds).size !== entry.introducedIds.length) throw new Error("invalid history entry");
    if (entry.paperIds.some((id) => !catalogIds.has(id))) throw new Error("history paper missing from catalog");
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
  const history = JSON.parse(await readFile(historyPath, "utf8"));
  const fetched = await fetchRecentArxiv();
  const next = buildRefresh(previous, fetched, history, new Date());
  validateDigest(next.digest);
  validateHistory(next.history);
  const digestTemporary = `${digestPath}.tmp`;
  const historyTemporary = `${historyPath}.tmp`;
  await writeFile(digestTemporary, `${JSON.stringify(next.digest, null, 2)}\n`, "utf8");
  await writeFile(historyTemporary, `${JSON.stringify(next.history, null, 2)}\n`, "utf8");
  await rename(digestTemporary, digestPath);
  await rename(historyTemporary, historyPath);
  const status = next.digest.rotation.insufficientNewPapers ? "high-quality candidates were sparse" : "rotation target met";
  console.log(`Paper4ZCH rotated ${next.digest.rotation.replacedCount} of ${next.digest.papers.length} papers from ${fetched.length} recent arXiv records; ${status}.`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

