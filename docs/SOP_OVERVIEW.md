# SOP 总览 · 销售流水线详细文档

**版本**: v1.0
**最近更新**: 2026-05-12
**配套页面**: [`/admin/scoring/`](/admin/scoring/) (macro overview · 大局图)
**单一真理来源规则**: 代码 ↔ 文档 ↔ 页面 三者必须同步。未上代码的设计只能进 TODO，不能在此文档声称已实现。

---

## 0. 一句话总结

ProfitsLocal 把"网站设计 + 销售"分成 4 段 Discord 生命周期，每段一份独立 SOP：

```
客户发现 (SOP-1)
  ↓ entity 入库
筛选 + 审计 (SOP-2)
  ↓ A/B/C grade 触发"网站预制"分支
Open Design 网站预制 (SOP-3, 待写)
  ↓ demo 完成
销售对接 (SOP-4, 待写)
  ↓ 客户决定付费
交付 + 维护 (SOP-5, 待写)
```

横切（不绑定阶段）：客户 master.md (SOP-ART-1) · 客户 audit report (SOP-ART-2) · 客户 profile (SOP-ART-3) · Discord 整体架构 (SOP-X-Discord) · 改价格协议 (SOP-X-Pricing) · 前端部署 (SOP-X-Deploy) · etc.

---

## 1. 我们的差异化 / USP

**"先做好网站，再去对接客户"** — Pre-build the website, then pitch.

```
传统做法：销售 cold call → 客户问"先做个 demo 我看看" → 失之交臂

我们做法：销售前已经基于客户 GMB + audit 数据用 Open Design 预制好网站
       → 销售带网站去对接 → "这是基于你公司做的预览，30 分钟看一下吗？"
       → 比空对空 pitch 高 5-10 倍转化
```

这是为什么有 SOP-3 (Open Design 预制) 在 SOP-2 (筛选审计) 和 SOP-4 (销售) 中间。

---

## 2. USP 三分支分流

筛选完拿到 A/B/C/D grade 后，是否预制网站走 4 条路：

| Grade | 预制策略 | 销售触发 |
|---|---|---|
| **A** | ✅ 必做，**优先排** | 网站做完 → 销售带去对接 |
| **B** | ✅ 也做，A 排完算力允许时 | 同 A |
| **C** | ⏸ 看意向 — 销售先聊 | 有意向 → 反向预制 → 给客户看 → 决定 |
| **D** | ❌ 跳过 (hard-skip) | 不投入 |

**算力 / 优先级矩阵** (待写)：什么算"A 排完算力允许"？标准待 SOP-3 v0.1 定义。

---

## 3. 4 个 Discord channel

每段生命周期一个 forum channel：

| Channel | ID | 用途 | 单位 | 谁看 |
|---|---|---|---|---|
| `#lead-discovery-runs` | 1503513633756283070 | 抓取 + 筛选 + 审计 batch ops | 1 batch task = 1 thread | 你 + AI 监督 |
| `#website-leads` | 1501187038706401290 | A/B/C 客户销售对话 | 1 客户 = 1 thread | 销售 |
| `#website-projects` | 1501945763650080899 | 网站方案 + demo 制作 | 1 demo = 1 thread | 设计 + 客户 |
| `#paid-websites` | 1503529874336383137 | 付费客户交付维护 | 1 付费客户 = 1 thread | 交付 |

详见 [SOP-X-Discord 详细文档](/admin/scoring/sop-x-discord-doc) **(TODO: 文档未建)**

---

## 4. 全部 SOP 矩阵

### Layer 1 · Lifecycle Process (5 个)

| # | 名称 | 状态 | 文档 |
|---|---|---|---|
| SOP-1 | 客户发现 Intake & Discovery | 🟡 调研笔记 | [`SOP_1_INTAKE_DISCOVERY.md`](SOP_1_INTAKE_DISCOVERY.md) **(TODO: v0.1 未写)** |
| SOP-2 | 筛选 + 审计 Screening & Audit | ✅ v1.0 | [`SOP_2_LEAD_DISCOVERY_PIPELINE.md`](SOP_2_LEAD_DISCOVERY_PIPELINE.md) |
| SOP-3 | Open Design 网站预制 | ⚪ 待写 | **(TODO)** |
| SOP-4 | 销售对接 Sales Engagement | ⚪ 待写 | **(TODO)** |
| SOP-5 | 交付维护 Delivery & Maintenance | ⚪ 待写 | **(TODO)** |

### Layer 2 · Per-Lead Artifact (3 个)

| # | 名称 | 状态 | 文档 |
|---|---|---|---|
| SOP-ART-1 | Master.md 维护协议 | ⚪ 待写 | **(TODO)** |
| SOP-ART-2 | Internal Audit Report 协议 | ⚪ 待写 | **(TODO)** |
| SOP-ART-3 | Customer Profile / Contact Identity | ⚪ 待写 | **(TODO)** |

### Layer 3 · Cross-cutting Method / Infra (8 个)

| # | 名称 | 状态 | 文档 |
|---|---|---|---|
| SOP-X-Discord | Discord 4-channel 架构 | 🔴 立刻写 | **(TODO)** |
| SOP-X-Pricing | 改价格协议 | 🔴 立刻写 | **(TODO)** |
| SOP-X-Deploy | 前端部署验证协议 | 🔴 立刻写 | **(TODO)** |
| SOP-X-PhaseTrans | V2 phase 状态机 | ⚪ 待写 | **(TODO)** |
| SOP-X-CronOps | Hermes cron 运维 | ⚪ 待写 | **(TODO)** |
| SOP-X-CostLedger | 预算护栏 | 🟡 已有 [`COST_DISCIPLINE.md`](v2/COST_DISCIPLINE.md) | 待提为 SOP |
| SOP-X-Autoresearch | Autoresearch 方法论 | 🟡 已有 [`AUTORESEARCH_REPORT_OPTIMIZATION.md`](v2/AUTORESEARCH_REPORT_OPTIMIZATION.md) | 待提为 SOP |
| SOP-X-Backup | 备份 / 密钥轮换 | ⚪ 待写 | **(TODO)** |

---

## 5. 维护协议（必读）

每个 SOP 同时维护 3 个产物：

| 产物 | 路径 | 谁看 |
|---|---|---|
| **admin 页面** (macro) | `/admin/scoring/<sop-id>` | 操作员看大局 |
| **详细文档** (source of truth) | `docs/SOP_<id>.md` | AI / 工程师 / 新人 |
| **调研笔记** (建 SOP 前的现状摸底) | `data/qa/sop-investigations/<sop-id>.md` | 建 SOP 时的过程 |

### 5.1 单一真理来源规则

**代码 ↔ 文档 ↔ 页面 三者必须同步。**

- **如果代码没改**：文档 / 页面里**不能**声称"已经这样做了"
- **如果有新想法**：写在文档的 **TODO 章节**或页面的**待办列表**，不在主流程章节描述
- **如果检测到不一致**：admin 页面顶部 `.admin-code-sync-banner` 显示 `is-stale`，列出哪些字段不匹配

代码 → 文档 → 页面的更新链路：
```
1. 改代码
2. (同一 PR) 改文档对应章节
3. (同一 PR) 改 admin 页面
4. (同一 PR) 截图验证 live
```

任何一步漏 → page 顶 banner 标 stale → 待修。

### 5.2 版本号 + 最近更新

每个 SOP 页面顶部有 `.admin-page-meta` 显示：

```
v<MAJOR>.<MINOR>  ·  最近更新 YYYY-MM-DD  ·  [配套数据]
```

版本号规则：
- 初稿 = v0.1-draft (调研笔记完成，正式 SOP 未写)
- 正式发布 = v1.0
- 重大改动 (新 stage / 新规则) = MAJOR +1 → v2.0
- 小改 (字段命名 / 阈值) = MINOR +1 → v1.1

### 5.3 文档链接规则

页面里链接的所有文档 **必须**能点开访问（在线 admin 子页面）。

- 文档已存在 + 已有 doc viewer → 正常超链接
- 文档存在但 viewer 待建 → 链接 + `.admin-todo-link` class (划掉 + 红 TODO 标签) + 该步骤进 admin 页面 TODO 列表
- 文档不存在 → 同上，但 TODO 标签更显眼

---

## 6. 当前状态快照（build-time）

注：这部分从 `data/leads/entities/` 和 `data/v2/pipeline-batches/` 读取，每次 build 刷新。详见 [`/admin/scoring/`](/admin/scoring/) 页面底部 "业务现状" section。

---

## 7. 当前 TODO 列表（按优先级）

### 🔴 立刻做（业务关键 · 下一轮起手）

- [ ] **G-9 跨源 dedup 工具链**（高优先 · `pl:dedup-audit` + `pl:dedup-merge` + `/admin/v2-leads/dedup-review` UI · 5 层 dedup 策略 — Scale 必需）
- [ ] **B2 Merged Entity Schema** 页面（SOP-1 + SOP-2 加 section · live sample 渲染真实 entity）
- [ ] **B3 Dedup overview page** `/admin/v2-leads/dedup-overview` — 业务核心可视化
- [ ] **SOP-X-Discord** — 4-channel 架构 + bot 权限 + forum tags
- [ ] **SOP-X-Pricing** — 改价时 5 处必须同改的协议
- [ ] **SOP-X-Deploy** — 前端 build + push + GH Actions + live verify + screenshot 协议

### 🟡 调研中 / 待 review

- [ ] **SOP-1 v0.1** — 调研笔记 `data/qa/sop-investigations/sop-1.md` 完成，待 Matthew 回 6 个检查点
- [ ] **search/enrichment skills 清单** — grep `core/` 列所有 search engine modules
- [ ] **G-1 `pl:scrape-docker` CLI** — gosom Web API → entity store bridge
- [ ] **G-2 `pl:preflight` CLI** — 跑 batch 前健康检查
- [ ] **G-3 entity.batch_id 字段** — mergeLeadIntoEntity 支持

### 🟡 中优（SOP-1 / SOP-X-Tooling 衍生工作）

- [ ] **G-11** 3rd-party scraper provider interface (outscraper / apify / brightdata) — gosom 备份 + 国际扩展
- [ ] **G-12** Google Places API 多账号 rotation — 当 1 个 key 接近 cap，自动切下一个
- [ ] **G-13** Places photos → master.md 素材库 (Cloudinary 上传)
- [ ] **G-14** opening_hours → 销售最佳联系时间 signal
- [ ] **G-18** Hermes cron 实际注册 `ops:health-check`（替代手动跑）
- [ ] **G-6.1** image-lead OCR/VLM 自动 extract（当前手填字段）

### ⚪ 后续（A/B 客户首次成交 / 算力突破后）

- [ ] **SOP-3** — Open Design 网站预制流程 + 算力优先级矩阵
- [ ] **SOP-4** — 销售对接 + outreach 自动化 sequence
- [ ] **SOP-5** — 付费客户交付 + 维护 + revise channel
- [ ] **SOP-ART-1** — master.md 维护协议
- [ ] **SOP-ART-2** — internal audit report 协议
- [ ] **SOP-ART-3** — 多触点 contact identity + entity 字段扩展
- [ ] **SOP-X-PhaseTrans** — V2 phase 状态机文档化
- [ ] **SOP-X-CronOps** — Hermes cron 健康监控
- [ ] **SOP-X-CostLedger** — 提 `COST_DISCIPLINE.md` 为正式 SOP
- [ ] **SOP-X-Autoresearch** — 提 `AUTORESEARCH_REPORT_OPTIMIZATION.md` 为正式 SOP
- [ ] **SOP-X-Backup** — Discord bot / PSI / CF API key 轮换

### 🚧 文档基础设施

- [ ] **SOP-Overview-doc** 页面 (本文档的 admin 子页 viewer) — **正在做**
- [ ] **SOP-1-doc** 页面 (本轮做)
- [ ] **SOP-3/4/5 - doc** 页面 — 等对应 SOP v0.1 写完再建

---

## 8. 相关文档（已在线）

| 文档 | 路径 | viewer |
|---|---|---|
| Admin Design System | [`docs/ADMIN_DESIGN_SYSTEM.md`](ADMIN_DESIGN_SYSTEM.md) | TODO viewer |
| SOP-2 详细文档 | [`docs/SOP_2_LEAD_DISCOVERY_PIPELINE.md`](SOP_2_LEAD_DISCOVERY_PIPELINE.md) | [`/admin/scoring/sop-2-doc`](/admin/scoring/sop-2-doc) ✓ |
| Pricing + Scaling 决策 | [`docs/v2/SCALING_AND_PRICING.md`](v2/SCALING_AND_PRICING.md) | TODO viewer |
| Cost Discipline | [`docs/v2/COST_DISCIPLINE.md`](v2/COST_DISCIPLINE.md) | TODO viewer |
| Autoresearch 优化框架 | [`docs/v2/AUTORESEARCH_REPORT_OPTIMIZATION.md`](v2/AUTORESEARCH_REPORT_OPTIMIZATION.md) | TODO viewer |
| Audit Report Schema | [`docs/v2/AUDIT_REPORT_SCHEMA.md`](v2/AUDIT_REPORT_SCHEMA.md) | TODO viewer |
| V2 Upgrade Plan | [`docs/v2/V2_UPGRADE_PLAN.md`](v2/V2_UPGRADE_PLAN.md) | TODO viewer |
