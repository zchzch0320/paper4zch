"use client";

import { useEffect, useMemo, useState } from "react";

type PaperStatus = "conference" | "arxiv";

type Paper = {
  id: string;
  title: string;
  authors: string[];
  source: string;
  status: PaperStatus;
  publishedAt: string;
  score: number;
  topics: string[];
  thesis: string;
  method: string;
  evidence: string;
  why: string;
  caveat: string;
  primaryUrl: string;
};

type RotationStatus = {
  replacedCount: number;
  historyWindowDays: number;
  insufficientNewPapers: boolean;
};

const fallbackPapers: Paper[] = [
  {
    id: "2607.28390",
    title: "Hierarchical Multilevel Monte Carlo for Order-Optimal Neural Actor-Critic in Average-Reward CMDPs",
    authors: ["Ankur Naskar", "Vaneet Aggarwal"],
    source: "arXiv · 2026.07.30",
    status: "arxiv",
    publishedAt: "2026-07-30",
    score: 98,
    topics: ["约束 / CMDP", "Actor–Critic", "理论保证"],
    thesis: "用分层多层 Monte Carlo 同时消除轨迹采样与神经 critic 优化偏差，补上平均回报 CMDP 中神经 actor–critic 的阶最优收敛保证。",
    method: "作者指出，NTK 分析下神经 critic 存在偏差—计算成本冲突；新估计器用分层 MLMC 逼近长时间 critic 优化的偏差水平，同时只付出对数级期望样本成本，并嵌入 primal–dual Natural Actor–Critic。",
    evidence: "论文声称最优性差距和约束违反均达到 Õ(T⁻¹ᐟ²)，且不需要预先知道混合时间；作者称这是一般策略参数化与神经 critic 下的首个阶最优结果。",
    why: "与你库中 CMDP、primal–dual、安全 RL 和 actor–critic 理论四条主线同时重合，是今天最值得精读的一篇。",
    caveat: "核心分析建立在 NTK 型神经 critic 条件上；其对有限宽深网和实际训练超参数的解释力仍需阅读正文判断。",
    primaryUrl: "https://arxiv.org/abs/2607.28390",
  },
  {
    id: "2608.03562",
    title: "Robust General Utility for Reinforcement Learning",
    authors: ["Zixuan Liu", "Fangzheng Wu", "Brian Summa", "Zizhan Zheng"],
    source: "arXiv · 2026.08.04",
    status: "arxiv",
    publishedAt: "2026-08-04",
    score: 97,
    topics: ["分布鲁棒", "约束 RL", "非凸优化"],
    thesis: "把部署时的效用错设纳入 minimax 学习，让奖励鲁棒 RL、约束 RL 与一般占用度量效用共享同一框架。",
    method: "在策略诱导的 occupancy measure 上定义效用不确定集合；凹效用情形采用投影随机梯度下降–上升，非凹情形采用 stochastic prox-extragradient，针对非凹引起的不适定行为做稳定化。",
    evidence: "作者给出凹情形的驻点保证，以及非凹情形到近似一阶驻点的收敛保证，并用 LLM 安全对齐和探索最大化实验核对理论趋势。",
    why: "你的 Zotero 最近同时强化了分布鲁棒 RL、CMDP 与 RLHF 理论；这篇提供了一个可能统一三者的新抽象。",
    caveat: "非凹情形保证是一阶驻点而非全局最优；效用不确定集合如何校准也会直接决定鲁棒性含义。",
    primaryUrl: "https://arxiv.org/abs/2608.03562",
  },
  {
    id: "2605.03125",
    title: "Taming the Curses of Multiagency in Robust Markov Games with Large State Space through Linear Function Approximation",
    authors: ["Jingchu Gai", "Laixi Shi"],
    source: "arXiv · 2026.05.04",
    status: "arxiv",
    publishedAt: "2026-05-04",
    score: 96,
    topics: ["鲁棒 Markov 博弈", "线性函数逼近", "样本复杂度"],
    thesis: "在大状态空间的分布鲁棒 Markov 博弈中，引入线性函数逼近并尝试打破随智能体数量爆炸的样本复杂度。",
    method: "论文聚焦 total-variation 不确定集合下的一般鲁棒 Markov 博弈，分别研究生成模型访问与新定义的在线交互设置，目标是超越此前表格型或依赖 vanishing-minimal-value 假设的结果。",
    evidence: "作者声称两种设置中的算法都具备可证明的数据效率，并首次在大或无限状态空间下打破 robust Markov games 的 multiagency curse。",
    why: "它几乎精确落在你库中的“部分可观测/多智能体博弈 × 分布鲁棒 × 函数逼近”交叉点。",
    caveat: "摘要不足以判断结果是否依赖强规划 oracle、可实现性或特定 equilibrium 求解假设；这些应是精读时的第一检查项。",
    primaryUrl: "https://arxiv.org/abs/2605.03125",
  },
  {
    id: "2604.03891",
    title: "Provable Multi-Task Reinforcement Learning: A Representation Learning Framework with Low Rank Rewards",
    authors: ["Yaoze Guo", "Shana Moothedath"],
    source: "arXiv · 2026.04.04",
    status: "arxiv",
    publishedAt: "2026-04-04",
    score: 94,
    topics: ["表示学习", "低秩结构", "多任务 RL"],
    thesis: "利用多任务奖励矩阵的低秩结构学习共享表示，并把表示误差明确连接到样本复杂度与策略 regret。",
    method: "研究共享状态动作空间和转移、但奖励不同的 T 个线性 MDP；先用 reward-free RL 学数据采集策略，再估计低秩奖励矩阵，避免高斯特征、incoherence 或已知最优解等限制。",
    evidence: "理论给出低秩矩阵恢复条件、表示误差与样本复杂度关系以及由学习表示构造近最优策略的 regret bound，并配有有限数据实验。",
    why: "与你库中的低秩 MDP、multitask representation learning 和 reward-free exploration 直接衔接。",
    caveat: "任务共享同一转移且满足线性 MDP 是关键结构假设；对 transition 也变化的多任务场景不直接适用。",
    primaryUrl: "https://arxiv.org/abs/2604.03891",
  },
  {
    id: "2605.19235",
    title: "GAE Falls Short in Imperfect-Information Self-Play Reinforcement Learning",
    authors: ["Zhiyuan Fan", "Gabriele Farina"],
    source: "arXiv · 2026.05.19",
    status: "arxiv",
    publishedAt: "2026-05-19",
    score: 92,
    topics: ["不完美信息博弈", "Self-play", "方差缩减"],
    thesis: "指出 GAE 在随机均衡策略下存在即使 critic 精确也无法消除的动作采样方差，并提出针对 self-play 的替代估计器。",
    method: "Q-boosting 使用 centralized action-value critic，把 sampled multi-step backup 换为在每一步对策略动作求期望的 Expected SARSA(λ) trace；VRPO 保留 PPO clipped objective 与 on-policy actor 更新。",
    evidence: "作者报告 VRPO 在斗地主和无限注德州扑克等中大型不完美信息博弈上持续取得强表现；摘要主要提供机制解释与经验结果。",
    why: "你的库里有 POSG、imperfect-information game 与可证明 MARL；这篇从估计器方差角度解释常用 PPO/GAE 组件为何失效。",
    caveat: "centralized Q critic 与逐步动作期望的计算规模可能成为瓶颈，且摘要未给出均衡收敛或样本复杂度保证。",
    primaryUrl: "https://arxiv.org/abs/2605.19235",
  },
  {
    id: "EHs3tSukHC",
    title: "Off-Policy Safe Reinforcement Learning with Cost-Constrained Optimistic Exploration",
    authors: ["Guopeng Li", "Matthijs T. J. Spaan", "Julian Kooij"],
    source: "ICLR 2026 · Poster",
    status: "conference",
    publishedAt: "2026-01-26",
    score: 91,
    topics: ["安全探索", "离策略 RL", "约束优化"],
    thesis: "把 optimistic exploration 限制在成本可控区域，并用分布式 critic 修正安全成本低估，兼顾样本效率与训练期安全。",
    method: "COX-Q 以 cost-constrained optimistic exploration 处理奖励/成本梯度冲突并自适应调节 trust region，再用 truncated quantile critics 缓解累计成本的低估偏差，同时用分位数不确定性指导探索。",
    evidence: "ICLR 官方摘要报告其在安全速度、导航和自动驾驶任务中实现较高样本效率、竞争性的评估安全性，并控制数据收集阶段的成本。",
    why: "与你库中 exploration–exploitation in CMDPs、DOPE 和 episode-wise safety 的问题意识高度一致，可作为实践侧对照。",
    caveat: "证据以实验为主；方法控制训练成本不等同于给出所有轨迹上的硬安全保证。",
    primaryUrl: "https://iclr.cc/virtual/2026/poster/10010695",
  },
  {
    id: "1SdPgRQrr5",
    title: "Dual-Objective Reinforcement Learning with Novel Hamilton-Jacobi-Bellman Formulations",
    authors: ["William Sharpless", "Dylan Hirsch", "Sander Tonkens", "Nikhil Shinde", "Sylvia Herbert"],
    source: "ICLR 2026 · Poster",
    status: "conference",
    publishedAt: "2026-01-26",
    score: 89,
    topics: ["安全约束", "HJB", "值函数分解"],
    thesis: "把 Reach–Always–Avoid 与双目标 Reach–Reach 问题分解为可组合的 Hamilton–Jacobi RL 值函数，从而得到显式 Bellman 形式。",
    method: "论文给出两类 dual-satisfaction 目标的值函数分解定理，并据此构造 DO-HJ-PPO；其约束表达不是简单 Lagrangian 加权，而是直接编码阈值满足结构。",
    evidence: "作者报告算法在安全到达与多目标任务的成功率、安全性和速度上优于多种基线；会议状态由 ICLR 2026 官方日程与 OpenReview 记录确认。",
    why: "适合与你熟悉的期望型 CMDP / primal–dual 方法并排阅读，比较“约束预算”与“可达/始终避障”两类安全语义。",
    caveat: "它解决的是特定 threshold-satisfaction 语义，不能直接替代一般累计期望约束 CMDP。",
    primaryUrl: "https://openreview.net/forum?id=1SdPgRQrr5",
  },
  {
    id: "a19MA0ksbc",
    title: "DR-SAC: Distributionally Robust Soft Actor-Critic for Reinforcement Learning under Uncertainty",
    authors: ["Mingxuan Cui", "Duo Zhou", "Yuxuan Han", "Grani A. Hanasusanto", "Qiong Wang", "Huan Zhang", "Zhengyuan Zhou"],
    source: "ICLR 2026 · Poster",
    status: "conference",
    publishedAt: "2026-01-26",
    score: 88,
    topics: ["分布鲁棒", "离线 RL", "Actor–Critic"],
    thesis: "把 KL 不确定集合下的分布鲁棒软策略迭代扩展到连续动作 actor–critic，并面向离线数据估计名义转移。",
    method: "DR-SAC 优化最坏转移模型下的熵正则回报，推导 robust soft policy iteration 及其收敛性质，并以生成模型从离线数据估计未知 nominal dynamics。",
    evidence: "ICLR 官方页面报告在五个连续控制任务上，常见扰动下平均回报最高达到 SAC 基线的 9.8 倍，同时改善相较既有 DR-RL 的计算效率。",
    why: "它是你库中大量在线/离线分布鲁棒 RL 理论工作的实用 actor–critic 落点，可帮助识别理论假设到连续控制实现之间的缝隙。",
    caveat: "鲁棒性依赖名义转移估计与 KL 集半径；五个控制任务上的经验优势不构成普遍部署保证。",
    primaryUrl: "https://iclr.cc/virtual/2026/poster/10008754",
  },
];

const filters = [
  { id: "all", label: "全部" },
  { id: "conference", label: "三大会中稿" },
  { id: "arxiv", label: "arXiv 初筛" },
  { id: "safe", label: "安全与约束" },
  { id: "multi", label: "多智能体博弈" },
  { id: "theory", label: "函数逼近 / 理论" },
];

function readStoredSet(key: string, legacyKey?: string) {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(key) || (legacyKey ? localStorage.getItem(legacyKey) : null) || "[]"));
  } catch {
    return new Set<string>();
  }
}

export default function Home() {
  const [papers, setPapers] = useState<Paper[]>(fallbackPapers);
  const [activeFilter, setActiveFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"match" | "newest">("match");
  const [expanded, setExpanded] = useState<string | null>(fallbackPapers[0].id);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [read, setRead] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [generatedAt, setGeneratedAt] = useState("2026-08-06T16:00:00+08:00");
  const [checkedAt, setCheckedAt] = useState("2026-08-06T16:00:00+08:00");
  const [recommendationsChanged, setRecommendationsChanged] = useState(false);
  const [rotation, setRotation] = useState<RotationStatus>({ replacedCount: 0, historyWindowDays: 7, insufficientNewPapers: true });

  useEffect(() => {
    setSaved(readStoredSet("paper4zch-saved", "paper2z-saved"));
    setRead(readStoredSet("paper4zch-read", "paper2z-read"));
    setDismissed(readStoredSet("paper4zch-dismissed", "paper2z-dismissed"));
    fetch(new URL("recommendations.json", document.baseURI))
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("digest unavailable")))
      .then((digest) => {
        if (Array.isArray(digest.papers) && digest.papers.length) setPapers(digest.papers as Paper[]);
        if (digest.generatedAt) setGeneratedAt(digest.generatedAt);
        if (digest.checkedAt) setCheckedAt(digest.checkedAt);
        if (typeof digest.recommendationsChanged === "boolean") setRecommendationsChanged(digest.recommendationsChanged);
        if (digest.rotation) setRotation(digest.rotation as RotationStatus);
      })
      .catch(() => undefined);
  }, []);

  function persist(key: string, next: Set<string>) {
    localStorage.setItem(key, JSON.stringify([...next]));
  }

  function toggleSaved(id: string) {
    const next = new Set(saved);
    next.has(id) ? next.delete(id) : next.add(id);
    setSaved(next);
    persist("paper4zch-saved", next);
  }

  function markRead(id: string) {
    const next = new Set(read).add(id);
    setRead(next);
    persist("paper4zch-read", next);
  }

  function dismiss(id: string) {
    const next = new Set(dismissed).add(id);
    setDismissed(next);
    persist("paper4zch-dismissed", next);
  }

  const visiblePapers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const selected = papers.filter((paper) => {
      if (dismissed.has(paper.id)) return false;
      if (activeFilter === "conference" && paper.status !== "conference") return false;
      if (activeFilter === "arxiv" && paper.status !== "arxiv") return false;
      const topicText = paper.topics.join(" ");
      if (activeFilter === "safe" && !/约束|安全|鲁棒|cmdp/i.test(topicText)) return false;
      if (activeFilter === "multi" && !/多智能体|博弈|self-play/i.test(topicText)) return false;
      if (activeFilter === "theory" && !/理论|函数逼近|低秩|样本复杂度|actor/i.test(topicText)) return false;
      if (needle && !`${paper.title} ${paper.authors.join(" ")} ${topicText} ${paper.thesis}`.toLowerCase().includes(needle)) return false;
      return true;
    });
    return selected.sort((a, b) => sort === "newest" ? b.publishedAt.localeCompare(a.publishedAt) : b.score - a.score);
  }, [activeFilter, dismissed, papers, query, sort]);

  const generatedLabel = useMemo(() => new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(generatedAt)).replaceAll("/", "."), [generatedAt]);

  const checkedLabel = useMemo(() => new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(checkedAt)).replaceAll("/", "."), [checkedAt]);

  const rotationHeadline = rotation.insufficientNewPapers
    ? `今日高质量新论文不足${rotation.replacedCount ? ` · 已轮换 ${rotation.replacedCount} 篇` : ""}`
    : `今日已轮换 ${rotation.replacedCount} 篇`;

  return (
    <main>
      <header className="masthead">
        <a className="brand" href="#top" aria-label="Paper4ZCH 首页">
          <span className="brand-mark">P4Z</span>
          <span>Paper4ZCH</span>
        </a>
        <div className="masthead-meta">
          <span className="live-dot" />
          每日研究雷达
          <span className="meta-divider" />
          最后检查 {checkedLabel} CST
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">从你的 Zotero 出发，而不是从热榜出发</p>
          <h1>今天真正值得你读的<br /><em>8 篇论文</em></h1>
          <p className="hero-lede">
            根据最近 800 条文献元数据建立兴趣画像，只读近一年 ICLR、ICML、NeurIPS 主会中稿，
            以及通过公开摘要证据自动初筛的 arXiv 新稿，再按相关性、新鲜度与研究信号排序。
          </p>
          <div className="hero-actions">
            <a className="primary-action" href="#digest">开始浏览 <span>↓</span></a>
            <button className="text-action" onClick={() => setActiveFilter("conference")}>只看三大会中稿</button>
          </div>
        </div>

        <aside className="signal-card" aria-label="Zotero 兴趣画像">
          <div className="signal-heading">
            <span>你的研究信号</span>
            <span className="signal-pulse">强</span>
          </div>
          <div className="signal-stats">
            <div><strong>800</strong><span>已分析条目</span></div>
            <div><strong>745</strong><span>去重标题</span></div>
            <div><strong>8.03</strong><span>最近存入</span></div>
          </div>
          <div className="topic-cloud">
            <span className="topic-xl">多智能体 RL</span>
            <span className="topic-lg">Actor–Critic</span>
            <span className="topic-md">线性函数逼近</span>
            <span className="topic-md">表示学习</span>
            <span className="topic-sm">安全 / CMDP</span>
            <span className="topic-sm">低秩 MDP</span>
            <span className="topic-sm">分布鲁棒</span>
            <span className="topic-xs">RLHF 理论</span>
          </div>
          <p className="privacy-note"><span>✓</span> 仅使用标题、摘要、标签与保存时间；未读取附件与私人笔记</p>
        </aside>
      </section>

      <section className="digest" id="digest">
        <div className={`refresh-status ${recommendationsChanged ? "changed" : "unchanged"}`} role="status">
          <span className="refresh-status-dot" />
          <strong>{rotationHeadline}</strong>
          <small>最近 {rotation.historyWindowDays} 天不重复 · 最后检查 {checkedLabel} CST · 当前推荐更新于 {generatedLabel} CST</small>
        </div>
        <div className="digest-head">
          <div>
            <p className="section-index">01 / 今日文献</p>
            <h2>高匹配推荐</h2>
          </div>
          <p className="digest-note">范围：近 365 天；会议仅保留已核验的 ICLR / ICML / NeurIPS 主会中稿。新增 arXiv 为免费云端自动初筛，不代表录用或完整质量评审。</p>
        </div>

        <div className="controls" aria-label="论文筛选">
          <div className="filter-row">
            {filters.map((filter) => (
              <button
                key={filter.id}
                className={activeFilter === filter.id ? "filter active" : "filter"}
                onClick={() => setActiveFilter(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className="search-sort">
            <label className="search-box">
              <span>⌕</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题、作者或主题" />
            </label>
            <select value={sort} onChange={(event) => setSort(event.target.value as "match" | "newest")} aria-label="排序方式">
              <option value="match">按匹配度</option>
              <option value="newest">按新鲜度</option>
            </select>
          </div>
        </div>

        <div className="results-meta">
          <span>显示 {visiblePapers.length} 篇</span>
          <span>{saved.size ? `已收藏 ${saved.size} 篇` : "点击“稍后读”保存在本机"}</span>
        </div>

        <div className="paper-list">
          {visiblePapers.map((paper, index) => {
            const isExpanded = expanded === paper.id;
            return (
              <article className={`${isExpanded ? "paper-card expanded" : "paper-card"}${read.has(paper.id) ? " read" : ""}`} key={paper.id}>
                <div className="paper-rank">{String(index + 1).padStart(2, "0")}</div>
                <div className="paper-main">
                  <div className="paper-kicker">
                    <span className={`status ${paper.status}`}>{paper.status === "conference" ? "三大会" : "arXiv 初筛"}</span>
                    <span>{paper.source}</span>
                    {read.has(paper.id) && <span className="read-label">已读</span>}
                  </div>
                  <h3>
                    <button onClick={() => setExpanded(isExpanded ? null : paper.id)} aria-expanded={isExpanded}>
                      {paper.title}
                    </button>
                  </h3>
                  <p className="authors">{paper.authors.join(" · ")}</p>
                  <p className="thesis">{paper.thesis}</p>
                  <div className="paper-topics">
                    {paper.topics.map((topic) => <span key={topic}>{topic}</span>)}
                  </div>

                  {isExpanded && (
                    <div className="paper-detail">
                      <div className="detail-block">
                        <span>方法</span>
                        <p>{paper.method}</p>
                      </div>
                      <div className="detail-block">
                        <span>关键证据</span>
                        <p>{paper.evidence}</p>
                      </div>
                      <div className="why-block">
                        <span>为什么推荐给你</span>
                        <p>{paper.why}</p>
                      </div>
                      <div className="caveat-block">
                        <span>阅读时留意</span>
                        <p>{paper.caveat}</p>
                      </div>
                    </div>
                  )}

                  <div className="paper-actions">
                    <a href={paper.primaryUrl} target="_blank" rel="noreferrer" onClick={() => markRead(paper.id)}>
                      查看原文 <span>↗</span>
                    </a>
                    <button className={saved.has(paper.id) ? "saved" : ""} onClick={() => toggleSaved(paper.id)}>
                      {saved.has(paper.id) ? "★ 已收藏" : "☆ 稍后读"}
                    </button>
                    <button className="dismiss" onClick={() => dismiss(paper.id)}>不感兴趣</button>
                  </div>
                </div>
                <div className="score" aria-label={`匹配度 ${paper.score}`}>
                  <strong>{paper.score}</strong>
                  <span>匹配度</span>
                  <div><i style={{ width: `${paper.score}%` }} /></div>
                </div>
              </article>
            );
          })}
        </div>

        {!visiblePapers.length && (
          <div className="empty-state">
            <span>⌁</span>
            <h3>这个筛选下暂时没有论文</h3>
            <p>换一个主题，或恢复已隐藏的推荐。</p>
            <button onClick={() => { const empty = new Set<string>(); setActiveFilter("all"); setQuery(""); setDismissed(empty); persist("paper4zch-dismissed", empty); }}>恢复全部</button>
          </div>
        )}
      </section>

      <section className="method-section">
        <div>
          <p className="section-index">02 / 推荐逻辑</p>
          <h2>让每条推荐<br />都能说明理由</h2>
        </div>
        <div className="method-grid">
          <div><span>01</span><h3>兴趣画像</h3><p>近期保存、重复主题与显式标签权重更高；收藏不被误当作绝对偏好。</p></div>
          <div><span>02</span><h3>来源边界</h3><p>仅保留近一年已核验的三大会主会中稿；新增 arXiv 依据摘要中的理论与实验证据自动初筛，绝不冒充录用结果。</p></div>
          <div><span>03</span><h3>去重排序</h3><p>排除 Zotero 已有标题，并在相关性、新鲜度、理论密度与主题多样性间平衡。</p></div>
        </div>
      </section>

      <footer>
        <div><span className="brand-mark small">P4Z</span><strong>Paper4ZCH Literature Radar</strong></div>
        <p>每日轮换 3–5 篇 · 最近 7 天不重复 · 高质量候选不足时不凑数</p>
        {dismissed.size > 0 && <button onClick={() => { const empty = new Set<string>(); setDismissed(empty); persist("paper4zch-dismissed", empty); }}>恢复 {dismissed.size} 篇已隐藏论文</button>}
      </footer>
    </main>
  );
}
