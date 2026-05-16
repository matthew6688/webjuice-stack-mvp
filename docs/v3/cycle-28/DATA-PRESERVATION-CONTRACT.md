# 数据保护契约 · Cycle-28

> 防 LLM 吃 base data · 强制区分 LOCKED / SUMMARIZABLE / LLM-DERIVED 三类

---

## 问题

LLM Cascade 在 Stage 3 / Stage 4 跑 · 如果不约束 · 可能:
- 把电话号"美化" (重新格式化 · 改连字符)
- 把地址"简化" (省略门牌号)
- 把 ABN / license 号当成"装饰" 改写
- 把客户原话 (review · GBP description) 重写
- 把审计数字 (audit_score 27) "总结" 成模糊描述

→ **强制三类 + 流向规则** · 任何 LLM call 都必须遵守。

---

## 三类字段

### A · LOCKED (永不许 LLM rewrite)

**这些字段 LLM 调用时 · 只能作为 INPUT 让 LLM 读 · 不能让 LLM "改写后输出"**。流向: 直接从 raw/ 复制到 master.md / final-handoff.md · 不经 LLM。

| 字段 | 来源 | 用途 |
|---|---|---|
| `business_name` | GBP · ABR | title · nav · footer · 不许 LLM 拼写改 |
| `phone` | GBP | tel: link · 不许格式化 |
| `email` | GBP / Tinyfish | mailto: · 不许改 |
| `address` | GBP | 显示 · schema · 不许简化 |
| `abn` | ABR | footer · about · 不许改格式 |
| `license_no` | ABR / Tinyfish | hero badge · footer · 不许改数字 |
| `google_maps_url` | GBP cid | GMB link · 不许改 |
| `audit_score` | detailed-audit | 数字 · 不许"约等于" |
| `visual_freshness` / `visual_trust` / `visual_conversion` | Vision LLM 原始评分 | 数字 · 不许 LLM 重评 |
| `lcp_ms` / `fcp_ms` / `transferSizeBytes` | PSI / Playwright | 真实数字 · 不许改 |
| `review_count` / `rating` | GBP | 数字 · 不许改 |
| 每条 review 的 author + rating + text + url | GBP reviews[] | verbatim · 引用必须 1:1 |
| screenshot file paths | Playwright | URL · 不许改 |
| sitemap URLs | sitemap-analyzer | URL list · 不许改 |
| tech stack detected | detectTechStack | CMS 名 · pixel 列表 · 不许改 |
| Vision LLM 原话 (visual audit verbatim) | Codex Vision | 客户原话 · 必须引用 |
| `editorial_summary` from GBP | Places Details | Google 写的描述 · verbatim 引用 |
| `domain_age_years` | WHOIS RDAP | 数字 · 不许改 |
| `first_online` | Wayback | 日期 · 不许改 |
| `firstSeenAt` / `lastSeenAt` | discovery | timestamp · 不许改 |

**实现机制**:
1. raw/* 文件**永远 verbatim 写入** · LLM 不参与
2. master.md / final-handoff.md 渲染时 · LOCKED 字段直接读 raw/ · 不经 LLM 中转
3. LLM prompt 显式告知: "这些字段你只能读不能改 · 输出引用必须 1:1"

### B · SUMMARIZABLE (LLM 可重组 · 但原始永存)

**这些字段 LLM 可以重写 / 综合 · 但 raw/ 必须保留原始文本 · 可对照**。

| 字段 | 来源 | LLM 怎么用 | 原始保留 |
|---|---|---|---|
| `about-narrative` | homepage about 段 + GBP description + reviews | 综合写一段 about 文案 (英文 build 用) | raw/tinyfish-homepage.md · raw/gbp-full.json |
| `services-list` | homepage services 段 + GBP types[] | 拆分 + 描述 + niche typical 补 | raw/tinyfish-homepage.md · raw/gbp-full.json |
| `USP description` | homepage 强调词 + review 高频词 | 1-3 条 USP | raw 原文 |
| `service-areas` | address + sitemap area pages + review suburbs | 列 suburb · 标 [LLM推断] 那些靠推断的 | raw 原文 |
| FAQ questions | niche typical | 4-6 问 + 答案 | 标 [LLM 生成] |

**实现机制**:
- LLM 输出每条都带 `derived_from: [raw/file.md:section-name]` 元数据
- 渲染时如果该字段被人工质疑 · 一键回看 raw 原文

### C · LLM-DERIVED (始终标 [LLM推断])

**纯 LLM 推断 · 没硬数据来源 · 必须标记**。

| 字段 | 推断依据 | 标记 |
|---|---|---|
| 投资能力评估 (small/medium/large) | 经营年限 + license + 商业 vs 住宅 + 评论数 | `[LLM推断: ABN 7年 + QBCC + 26评论 → medium]` |
| Outreach 建议 / sales angle | 全综合 | `[LLM推断]` |
| 痛点切入 | audit findings + 客户类型 | `[LLM推断]` |
| Page-map 决策 (新建哪几页) | sitemap + audit + niche | `[LLM推断]` |
| SEO strategy (长尾 target) | sitemap gap + 竞品 | `[LLM推断]` |
| Page transformation map (旧→新内容迁移) | sitemap + audit | `[LLM推断]` |

**实现机制**: 渲染时这类 bullet 末尾**强制**显示 `[LLM推断]` tag (跟 [GBP] [官网] [搜索] [ABR] [WHOIS] 等同 source 来源标记并列)。

---

## LLM Prompt 约束模板 (所有 Cascade A 调用必加)

每个 LLM call 的 prompt 末尾追加:

```
## 严格规则 · 数据保护契约
- 以下字段是 LOCKED · 你只能读不能改 · 引用必须 1:1 verbatim:
  - 商家名 / 电话 / 邮箱 / 地址 / ABN / license 号
  - 所有数字 (audit_score · 评分 · 评论数 · LCP · 等)
  - 所有评论的 author + text + URL
  - 所有 screenshot 路径 · 所有 URL
  - GBP editorial_summary 引用必须 1:1
  - Vision LLM 视觉评分原话引用必须 1:1
- LLM 推断的字段必须标 [LLM推断] tag
- 综合改写的字段必须保留 raw/ 文件路径作 derivation reference
- 违反 → 输出会被 acceptance criteria 拒收 · fallback 下一 tier
```

Acceptance criteria 增加 LOCKED 字段验证:
```js
function checkLockedFields(text, entity) {
  // 数字 verbatim check
  if (entity.rating != null && !text.includes(String(entity.rating))) return false;
  if (entity.audit_score != null && !text.includes(String(entity.audit_score))) return false;
  // phone format check (允许的格式列表)
  if (entity.phone) {
    const phoneDigits = entity.phone.replace(/\D/g, '');
    const textDigits = text.replace(/\D/g, '');
    if (!textDigits.includes(phoneDigits)) return false;
  }
  // ABN/license 数字 check
  // ...
  return true;
}
```

---

## 流向图

```
discovery (Places / Docker)
  ↓ 写
raw/gbp-fields.json  (LOCKED 数据 · verbatim 保存)
  ↓
Stage 0.5 enrichment (ABR / WHOIS / Wayback)
  ↓ 写
raw/abn-record.json · raw/whois-record.json · raw/wayback-*.json (LOCKED · verbatim)
  ↓
Stage 1 (Tinyfish · 文本分析)
  ↓ 写
raw/tinyfish-homepage.md · raw/tinyfish-search.json (LOCKED · verbatim)
raw/light-audit-issues.json (detector 输出 · 不经 LLM)
  ↓
Stage 2 (Playwright · audit · Vision)
  ↓ 写
raw/audit-detailed.json (30 rules · 数字 LOCKED)
raw/visual-audit.json (Vision LLM 原话 · LOCKED 引用)
raw/playwright-screenshots/* (LOCKED 文件)
  ↓
Stage 3 (LLM Cascade A · 内容生成)
  读: raw/* 全部 (作 INPUT)
  ↓ 输出 (LLM 改写 · 但每条带 derivation 元数据)
content/services-list.json  (Class B · derived_from: raw/tinyfish-homepage.md)
content/about-narrative.md  (Class B)
content/customer-summary.md (Class B · 9 段 · 每条标 [GBP/官网/搜索/LLM推断])
content/reviews/selected.json (Class A · verbatim review text)
content/page-map.json (Class C · [LLM推断])
issue-fix-matrix.json (Class C · [LLM推断])
  ↓
Renderer (master-md-builder / handoff-aggregator / audit-html)
  → LOCKED 字段直接读 raw/* (不经 LLM)
  → Class B 字段读 content/* (LLM 改写过 · 带 derivation link)
  → Class C 字段读 content/* + 必显示 [LLM推断] tag
```

---

## 渲染时的 Source 标记规范

每个 markdown bullet 末尾标 source:

| 标记 | 含义 | 数据流 |
|---|---|---|
| `[GBP]` | Google Business Profile 字段 (verbatim) | raw/gbp-full.json |
| `[ABR]` | Australian Business Register | raw/abn-record.json |
| `[WHOIS]` | RDAP domain record | raw/whois-record.json |
| `[Wayback]` | Internet Archive | raw/wayback-first-snapshot.json |
| `[官网]` | Tinyfish 抓的官网 markdown | raw/tinyfish-homepage.md |
| `[搜索]` | Tinyfish search 结果 | raw/tinyfish-search.json |
| `[多页]` | multi-page crawl 抓的页 | raw/multi-page-crawl.json |
| `[审计]` | detailed-audit.js 跑的 rule 输出 | raw/audit-detailed.json |
| `[Vision]` | Vision LLM 原话 (verbatim 引用) | raw/visual-audit.json |
| `[PSI]` | PageSpeed Insights 真实数据 | raw/audit-detailed.json.pagespeed |
| `[LLM推断]` | LLM 综合推断 · 无直接 source | content/* |
| `[缺数据]` | 我们没抓到 · 标识缺失 | (none) |

---

## 验证机制

1. **Acceptance criteria** 增加 LOCKED 字段 verbatim check (上面代码)
2. **Source tag 强制**: 渲染后每条 bullet 必须有 source tag · 缺失 → renderer 警报
3. **Audit trail**: 每次 LLM call 的 trace 写 ledger · 含 raw/* 输入 + content/* 输出 · 可对照
4. **Doctor scan** (`pl:data-preservation-doctor`): 抽样比对 master.md 中 LOCKED 字段 vs raw/ · 不一致警报
5. **Cycle-doctor 检**: PR 前自动 grep · master.md 中所有 phone / ABN / license 数字 ✕ raw/ 中的真值 · 必须 1:1

---

## 实施落点 (cycle-28 哪个 Phase 落)

| 工作 | 落到 |
|---|---|
| 三类字段定义 | docs 本文件 · Phase 1 一开始 |
| Prompt 约束模板 | Phase 4 · Cascade A 模块内置 |
| Acceptance LOCKED check | Phase 4 · acceptance-criteria.js |
| Source tag 强制 | Phase 9 · 各 renderer (master-md / handoff / audit-html) |
| Audit trail ledger | Phase 4 · cascade-trace-ledger.js |
| Doctor scan CLI | Phase 10 · 跟 cycle-doctor 一起 |
