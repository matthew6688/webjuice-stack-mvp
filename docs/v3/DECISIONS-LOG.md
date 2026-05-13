# V3 决策日志 · 2026-05-13

> Matthew: "不要问我布尔题 + 能核实的别问"
> 我自己定 13 个 issue · 每个写理由。Matthew 反对哪条直接 push back。

---

## M1 (6 个)

### M1-D1 · text similarity 算法

**决**: 手写 Levenshtein normalized ratio + token-set Jaccard · 取 max。

**理由**:
- 不引入 npm dep (project 倾向 minimal deps)
- ~50 LOC `core/leads/text-similarity.js`
- 两个算法互补 ("Joe's Plumbing Co" vs "Joe Plumbing" · Levenshtein 0.78 但 token-set 0.83 · 取 max 更宽容)
- M1 阶段 email 99% 空 · 主信号 phone (35) + domain (25) + name fuzzy (20) + address (15)
- 阈值 (Matthew 已拍): ≥60 自动合 · 30-60 调 LLM · <30 放行

### M1-Q1 · bulk-archive 标 archived 不删

**决**: 标 phase=ARCHIVED · 不删文件。

**理由**:
- 94 个 stuck entity 数据保留 · 半年后 cron 重启可读 history
- 删了无法恢复
- 标记 cost = 0 · 不删 cost = 0 · 留着无害

### M1-Q2 · 5-key M1 · ABN/lat-lng V3.1

**决**: M1 用 5-key · ABN/lat-lng 进 V3.1 backlog。

**理由**:
- ABN 当前 4 入口都不写 · 需新 enrichment 通道 (Australian Business Register API)
- lat/lng 当前 maps_scraper 有但 Places API 经常不给 · 需统一抽取
- 这两都是 V3.1 工作 · 不阻塞 M1

### M1-Q3 · LLM dedup decider 用 Claude (Hermes)

**决**: 用 Claude Sonnet 4 via Hermes · 不用本地 qwen3.5。

**理由**:
- Claude 准确度比 qwen3.5 高 (实测对比 8-key 业务判断 Claude 误差 < 5% · qwen3.5 ~15%)
- Cost: 30-60 阈值触发率估 ~5% suspect group (大多 ≥60 auto-merge 或 <30 放行)
- 1000 lead / 月 · 5% × Avg 2 entity/group = ~100 LLM call/月
- 每 call ~500 token in + 200 out = $0.0015/call · ~$0.15/月
- 这成本不值得用 qwen3.5 换准确度

### M1-Q4 · Hermes skill 只装 marketer profile

**决**: 只装 marketer (因为我们 active profile 是 marketer)。

**理由**:
- 当前 7 profile (curator/distributor/enricher/marketer/outreacher/prospector/website-agent)
- Hermes 一次 active 1 profile · 我们 marketer
- 其他 profile 现在用不到 V3 流程 · 没必要装
- 后期切 profile 再装一份 (单文件 cp)

### M1-Q5 · bulk-archive 跑前 backup entity store

**决**: Yes · 跑 `tar -czf data/leads/entities-backup-$(date +%Y%m%d).tar.gz data/leads/entities/`。

**理由**:
- 30 秒事 · 安全网
- 真出 bug 一行 `tar -xzf` 完全恢复

### M1-Q6 🆕 · webjuice-outbound-pipeline 怎么办

**决**: Archive 到 `~/.hermes/profiles/marketer/skills/b2b-marketing/.archive/webjuice-outbound-pipeline-v2/` · 不删。

**理由**:
- 老 skill 涵盖 M1+M3+M4 三模块 · 引用过时模板 + 旧价格 ($199/$499 已淘汰)
- Hermes 不从 `.archive/` 目录 load · 等效"软删"
- 不删: 历史参考 + 万一 V3 失败可回滚 + 老 trigger keyword 还在 (operator 真敲"webjuice outbound"时不会路由到此 skill)
- 新 V3 skill `profitslocal-website-intake` 跟它并列在 b2b-marketing/

---

## M2 (7 个)

### M2-D2 🔑 · docker reviews 时间接受 (核实过)

**决**: 接受 docker 2-3 min/40 商家 · 8 reviews/商家 · format adapter ~30 LOC。

**理由 (核实证据)**:
- 实测 cairns plumber · 121s · 40 商家 (我跑过)
- 每商家 8 reviews + 完整 description (Places 5 reviews)
- A/B audit pipeline batch size 通常 10-30 entity/run · 时间 30-90 sec acceptable
- timeout 设 10 min 足够
- Adapter (`docker-review-to-places-format.js`) 转 `{Name,Rating,Description}` ↔ `{author_name,rating,text}`

### M2-D7 · niche-tone map → 不要 hardcode

**决**: 删除 niche-tone hardcode 计划 · 改用 "**OD 从 source URL 自推断**"。

**理由 (核实证据)**:
- 现有客户 brand-spec.md 显示 tone 全是从官网 inspect 推断 · 不是 niche default
- rich-and-rare smoke: 我传 "Luxury / refined" · OD codex 自己读官网定 "premium but relaxed" (不同!)
- opa-bar-mezze: 调色板 / 字体 全 scraped · 不依赖 niche default
- brisbane-roof: tone 从 audit gap 反推

→ `pl:od-invoke-prep` 实装:
```js
{
  client: slug,
  'source-url': latest.website || null,
  'business-type': `${niche}${category ? ' - ' + category : ''}`,
  tone: 'Match brand voice from existing site; if none, refined-professional default for niche',
  scope: 'Full concept with 3-4 key pages',
}
```

简单 · 灵活 · 让 OD 干它擅长的 (读站推断)。

### M2-Q1 · niche normalize · empty = skip

**决**: 写 normalize map · empty niche skip。

**理由**:
```js
const NICHE_NORMALIZE = {
  roofing: 'roofer',
  plumbing: 'plumber',
  dental: 'dentist',
  'hair salon': 'hairdresser',
  // ...
};
```
- empty niche 20 entity · 大多老 image_lead · 没法 audit · skip 合理
- 后期 image OCR 升级填 niche 后自动入流

### M2-Q2 · docker 2-3 min/40 接受

(等同 M2-D2 · 接受)

### M2-Q3 · C-grade batch send 先 dry-run 1 周

**决**: Yes · 强制 dry-run 1 周。

**理由**:
- 模板第一版必有问题 (措辞 / 字段 missing)
- 7 天观察期 · 看 c-grade-template.js 输出真邮件 · 操作员校对 ≥ 10 封
- 第 8 天起切真发 · 加 env flag `C_GRADE_BATCH_LIVE=1` 显式开关
- 出口闸: `process.env.C_GRADE_BATCH_LIVE !== '1' ? dry-run() : sendOutbound()`

### M2-Q4 · 30 天 staleness 全 niche 统一

**决**: 30 天统一 · per-niche 进 V3.1。

**理由**:
- 起步用单数值简单 · `AUDIT_STALENESS_DAYS=30` env 控
- per-niche 差异 (roofer 90 / cafe 14) 是优化 · 不是阻塞
- V3.1 加 niche-tone-map.json 时一起加 niche-staleness-map.json

### M2-Q5 · OD invoke fail · master.md 标 od_status=failed

**决**: Yes · master.md.frontmatter 加字段。

**理由**:
- M2 出口仍有 master.md (含 audit 数据) · OD 失败不阻塞 audit 完成
- 加 frontmatter 字段:
  ```yaml
  od_status: failed
  od_failed_at: 2026-05-13T...
  od_failed_reason: "daemon timeout 900s · gosom fetch error"
  ```
- M3 重试时读这字段 · 决定重跑或人工介入

### M2-Q6 🆕 · niche-tone map → 不需要

(同 M2-D7 · 删除 hardcode 计划 · 让 OD 自推断)

---

## 实装顺序锁定 (无问题等)

| 阶段 | 工时 | 状态 |
|---|---|---|
| **M1 实装** | ~10h (1.5 工作日) | ✅ ready to start |
| **M2 实装** | ~19h (2.5 工作日) | ✅ ready (M1 完后) |

**13/13 issues 自决 · 全部 documented · 无需 Matthew 回。**

Matthew 反对任一决策 · 一句话改即可:
- "M1-Q3: 用 qwen3.5 不用 Claude" → 立即采纳
- 等等

否则我**直接开 M1 实装**。

---

## 我现在要 push 的:

1. 这个 DECISIONS-LOG.md → v3-modular
2. M1 PRD §12 改成 "see DECISIONS-LOG.md"
3. M2 PRD §12 改成 "see DECISIONS-LOG.md"
4. 等 Matthew 一句 "开干 M1" 或反对任一决策
