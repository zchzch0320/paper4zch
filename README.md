# Paper4ZCH

Paper4ZCH 是根据公开 Zotero 衍生研究画像生成的个性化文献雷达，部署在 GitHub Pages。

## 更新方式

推荐内容改为 **Codex 手动更新**，仓库中没有定时检索或定时改写推荐数据的 GitHub Actions workflow。

- 用户在 Codex 中提出更新请求后，Codex 核验新论文、更新推荐数据并推送到 `main`。
- `.github/workflows/pages.yml` 仅在代码被推送后构建和部署静态网页；它不会搜索、筛选或改写论文。
- 因此电脑和 Codex 不需要为 Pages 部署保持在线，但在用户下一次要求 Codex 更新之前，推荐内容不会自行变化。

## 人工更新规则

1. 使用滚动 365 天窗口。
2. 会议论文仅接受 ICLR、ICML、NeurIPS 主会正式录用记录。
3. arXiv 候选按 `.agents/skills/zotero-literature-radar/references/source-policy.md` 的正文级质量门槛筛选。
4. 每次优先替换 3–5 篇，最近 7 个北京时间自然日展示过的论文不重新引入。
5. 高质量候选不足时明确标记，不以弱相关论文凑数。
6. 同步更新：
   - `public/recommendations.json`
   - `public/recommendation-history.json`

## 验证与发布

```bash
npm ci
npm test
git diff --check
```

验证通过后，只暂存本次确认的文件，提交并推送到 `main`。GitHub Pages 会自动部署该次已审核的静态内容。

## 本地预览

```bash
npm run dev
```

GitHub Pages 构建：

```bash
npm run build:pages
npm run test:pages
```
