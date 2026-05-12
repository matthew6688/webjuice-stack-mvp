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

简表见下方 [§6 Discord 4-channel 生命周期架构](#6-discord-4-channel-生命周期架构临时-owner--待-sop-x-discord-写完迁出)（临时 owner · 待 SOP-X-Discord 写完迁出）。

---

## 4. 全部 SOP 矩阵

### Layer 0 · 统一入口 (1 个)

| # | 名称 | 状态 | 文档 | Admin |
|---|---|---|---|---|
| SOP-0 | 任务系统 · 干活的总入口 | ✅ v1.7 (健康自检 + Discord 人话化 + admin 人话化 + Hermes cron 骨架) | [`SOP_0_TASK_SYSTEM.md`](SOP_0_TASK_SYSTEM.md) · [test plan](SOP_0_TEST_PLAN.md) · [results](SOP_0_TEST_RESULTS.md) · [operator guide](SOP_0_OPERATOR_GUIDE.md) · 健康自检 `npm run pl:sop0-doctor` | [`/admin/scoring/sop-0`](/admin/scoring/sop-0) (总览) · [`sop-0-doc`](/admin/scoring/sop-0-doc) (文档浏览) · [`/admin/tasks`](/admin/tasks) (任务列表) · [`/admin/cron`](/admin/cron) (定时任务) |

### Layer 1 · Lifecycle Process (5 个)

| # | 名称 | 状态 | 文档 |
|---|---|---|---|
| SOP-1 | 客户发现 + Dedup + Enrichment | ✅ v1.0 | [`SOP_1_INTAKE_DISCOVERY.md`](SOP_1_INTAKE_DISCOVERY.md) |
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

## 4.5 健康检查 cadence 规则（所有 SOP 强制 · 2026-05-13 起）

**默认每天 1 次**。理由 + 升级触发 + 实施模板 → [`memory/feedback_sop_health_check_cadence.md`](../../.claude/projects/-Users-matthew-profitslocal/memory/feedback_sop_health_check_cadence.md)（auto-load）。

简版规则：

| 阶段 | cadence | 渠道 |
|---|---|---|
| 现在（未上线 · 0 付费客户） | **daily 09:00** | `bot-logs` 心跳 + `sop-alert` 升级 |
| 第一个付费客户 / 自动外联开跑 | hourly | 同上 |
| Production SLA | 15min / on-call | 同上 + PagerDuty 等 |

**每个 SOP 必须有**：
1. `pl:<sop>-doctor` CLI（`--json` 给机器读）
2. Hermes daily cron 调上面 CLI
3. 连续 ≥ 2 次 fail → @Matthew 升级到 `sop-alert` (1503855265949421658)
4. Dead-man's switch：daily heartbeat 即便健康也发，**死寂 = 出事**
5. 脚本进 `ops/hermes-scripts/` + README

**SOP-0 是 canonical 参考**：`pl:sop0-doctor` + cron `2fad97bcc0c8` + `ops/hermes-scripts/sop0-*.sh`。新 SOP 复用这套模板，不重新发明。

---

## 5. 维护协议（必读）

每个 SOP 同时维护 3 个产物：

| 产物 | 路径 | 谁看 |
|---|---|---|
| **admin 页面** (macro) | `/admin/scoring/<sop-id>` | 操作员看大局 |
| **详细文档** (source of truth) | `docs/SOP_<id>.md` | AI / 工程师 / 新人 |
| **调研笔记** (建 SOP 前的现状摸底) | `data/qa/sop-investigations/<sop-id>.md` | 建 SOP 时的过程 |

### 5.1 单一真理来源规则（强制 · 双层）

**Layer 1 · 代码 ↔ 文档 ↔ 页面 三者必须同步**：
- 代码没改 → 文档 / 页面不能声称"已经这样做了"
- 新想法 → 写在 **TODO 章节** / **待办列表**，不在主流程章节
- 不一致 → admin 页面 `.admin-code-sync-banner` 显示 `is-stale`

**Layer 2 · 跨 SOP 单源 (Single Owner)**：
- 每个业务概念**有且只有一个** owner SOP（见 [`SOP_OWNERSHIP_REGISTRY.md`](SOP_OWNERSHIP_REGISTRY.md)）
- 其他 SOP 引用 owner 时**必须链接**，**禁止重述**（详见 [`SOP_MAINTENANCE_RULES.md`](SOP_MAINTENANCE_RULES.md)）
- 自动 audit: `npm run ops:sop-audit` — 检测跨 SOP 重复，失败 exit 1
- AI 工程师 / 工程师 / 操作员 改 SOP 前必读 Registry + Rules

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

## 6. Discord 4-channel 生命周期架构（临时 owner · 待 SOP-X-Discord 写完迁出）

V2 的运营载体：lead 生命周期分 4 段，每段对应一个 Discord channel。channel 之间用 "graduation" 机制串。

| Channel | ID | 用途 | 单位 | 谁看 |
|---|---|---|---|---|
| `#lead-discovery-runs` | 1503513633756283070 | SOP-1 batch ops + dedup review + 健康警报 | 1 batch task = 1 thread | 你 + AI 监督 |
| `#website-leads` | 1501187038706401290 | SOP-2/4 A/B/C 客户销售对话 | 1 客户 = 1 thread | 销售 |
| `#website-projects` | 1501945763650080899 | SOP-3 网站方案 + demo 制作 | 1 demo = 1 thread | 设计 + 客户 |
| `#paid-websites` | 1503529874336383137 | SOP-5 付费客户交付维护 | 1 付费客户 = 1 thread | 交付 |

**为什么 4 个不是 1 个**：每 channel 的 cadence（节奏）/ audience（受众）/ SLA 都不同。batch 节奏 vs per-lead 节奏 vs project 节奏 vs 客户节奏 — 不能混。

**Graduation 机制**：
- SOP-2 grade ≥ B 自动从 `#lead-discovery-runs` graduate 到 `#website-leads`
- 客户表示兴趣 → 手动从 `#website-leads` graduate 到 `#website-projects`
- 客户付费 → 手动从 `#website-projects` graduate 到 `#paid-websites`

⚠ **当 SOP-X-Discord v0.1 写完，这一节迁出本文档**（含 forum tags 完整列表 / bot 权限 / setup 协议等）。

---

## 7. 当前状态快照（build-time）

注：这部分从 `data/leads/entities/` 和 `data/v2/pipeline-batches/` 读取，每次 build 刷新。详见 [`/admin/scoring/`](/admin/scoring/) 页面底部 "业务现状" section。

---

## 8. 当前 TODO 列表（按优先级）

### ✅ 已完成（最近）

- [x] **SOP-1 v1.0** — Discovery + Dedup + Enrichment 全流程
- [x] **G-9 dedup 简化版** — 3-key detector + 3 CLI + review UI
- [x] **Niche Cohort** — `data/leads/niches/<niche>/` 物理 flat + 逻辑分组
- [x] **G-1 `pl:scrape-docker`** · G-2 `pl:preflight` · G-3 `entity.batch_id` · G-6 image-lead V2 · G-7 Places enrichment
- [x] **SOP-X-Tooling / Handoff / Dedup / Ownership Registry / Maintenance Rules** — 3 道墙立起

### 🔴 立刻做（业务关键 · 下一轮起手）

- [x] **C5-Phase-A SOP-1 出口契约 基础设施** ✅ 2026-05-12
  - `enrichment_status` 字段自动写入 `mergeLeadIntoEntity`（'pending' / 'complete' 自动判定）
  - `buildDiscoveryQueues` 加 `isEnrichmentReady` gate（向后兼容：缺字段=complete）
  - `pl:pipeline-batch-step --finalize` 自动 hook `pl:dedup-audit`
- [ ] **C5-Phase-B `pl:run-enrichment-batch` CLI** — 99% 信心已就绪 (real-test verified 2026-05-12)
  - 设计决策全部锁定：`contact_identity` schema + `enrichment_status` 决定逻辑 见 [Handoff Contract §2.3.1-2.3.2](SOP_HANDOFF_CONTRACT.md#231-latestcontact_identity-完整-schemareal-test-验证-2026-05-12)
  - Real-test 已跑：Regan Brothers Roofing · 6/6 routes 成功 · cost $0 · fixture `data/v2/fixtures/enrichment/place_chijd28ojc37k2sr-3f5yimly-4.json`
  - **9-step impl plan (~1.5h, 99% 信心)**：
    1. CLI scaffold + arg parsing (`--limit / --niche / --dry-run / --skip-approval`)
    2. Scan entities, filter `enrichment_status === 'pending'`
    3. enrichment-gate check (`getEnrichmentGate(entityKey)`)
    4. Serial loop · 500ms 间隔 · `enrichLead()` 调用
    5. Fixture write (复用 test-enrichment-live shape)
    6. Merge `contact_identity` 到 `entity.latest` + flip `enrichment_status`
    7. Discord summary 推 SYSTEM_ALERTS webhook
    8. Smoke verify 1 个真实 pending entity
    9. build + audit + commit + push
- [ ] **C5-Phase-C 分层模型注释** — keep cheap-audit-v2 `queued_for_enrichment` 作 fallback safety net + 注释说明（不迁移，10min）
- [ ] **Design system 技术债清理** — 19 个 admin pages 仍有 per-page `<style>` 自定义 class。逐页迁到 `admin-design-system.css`。当前 `ops:design-audit` 是 warning mode，迁完后改 strict
- [ ] **SOP-X-Discord** — 4-channel 架构 + bot 权限 + forum tags（迁出 §6 临时章节）
- [ ] **SOP-X-Pricing** — 改价时 5 处必须同改的协议
- [ ] **SOP-X-Deploy** — 前端 build + push + GH Actions + live verify + screenshot 协议
- [ ] **C-grade Hermes auto-outreach P1**（让 C 类立刻产生收入）

### 🟡 调研中 / 待 review

- [ ] **search/enrichment skills 清单** — grep `core/` 列所有 search engine modules

### 🟡 中优（SOP-1 / SOP-X-Tooling 衍生工作）— 调研后真实信心

详细调研报告：4 个并行 Explore agents · 2026-05-12 · 所有源码 + API 已读

| ID | 任务 | 估时 | 信心 | 关键发现 |
|---|---|---|---|---|
| ✅ G-12 | Places API 多账号 rotation | — | done | PlacesQuotaGuard.selectAvailableKey + schema v1→v2 migrate |
| 🔵 **G-18** | Hermes cron 注册 ops:health-check (daily) | **2h** | **92%** | `hermesCron(['create', 'every 24h', ...])` · **低优**（手动跑 OK · 详见 [SOP-X-Tooling §3](SOP_X_TOOLING.md)）|
| ✅ **G-13** | Places photos → master.md 素材库 | done 2026-05-12 | — | `pl:download-places-photos` CLI · Cloudinary 上传 · master.md "一(a) 商户视觉素材" 段 · smoke: New Farm Deli 6 张 |
| ✅ **Evidence trail UI** | `[entityKey].astro` 加 contact_identity + evidence_sources fold + photo grid | done 2026-05-12 | — | smoke: Bluey's Fancy Restaurant 1 thin-contact entity → 1 pending → complete (5 routes/4 evidence in 5.5s) · operator 可看每字段来源 + GMB 照片网格 + 建议联系时间 |
| 🟢 **Cost dashboard tier 视图** | finance.astro 加 tier × provider × month 面板 | **2-3h** | **95%** | `summarizeLedger()` 已支持 `byTier/byProvider` 过滤 · 只需 UI 面板 |
| 🟡 **G-6.1** | image-lead OCR/VLM 自动 extract | **4h** | **87%** | `core/llm/vision-claude-cli.js` 已存在 · 加 extract prompt + 改 pl-ingest-image · 准确率：Claude ~94% name / ~89% phone |
| ✅ **G-14** | opening_hours → sales-time signal | done 2026-05-12 | — | `core/leads/sales-contact-time.js` 解析 weekday_text · 写 `entity.latest.sales_signals.best_contact_time` · master.md "一(b) 建议联系时间" · smoke: New Farm Deli "Tue/Wed/Thu 10:00-12:00 high confidence" |
| 🟠 **G-11** | outscraper / apify scraper fallback | **8h** | **68%** | 在 pl-scrape-docker.js try-catch 加 fallback · 字段 schema match · **阻塞**：需 web-fetch outscraper/apify 当前 pricing + API key 结构 |
| 🟠 **Admin trigger button** | "Run enrichment batch" UI 按钮 | **2-3 day** | **72%** | API endpoint 在 `/functions/api/*.ts` (Cloudflare Workers, 不是 Astro!) · spawnSync precedent in `v2.astro` build-time 用 · **无 long-running job pattern** 需要建第一个 |
| 🟠 **Cross-niche rotation 策略** | daily quota + city schedule | needs design | **75%** | per-lead cron 已存在 (grade A=每 4h, B/C/D=每 12h) · 历史数据稀疏 (1 batch sample) · 建议 hybrid 模型 |
| 🟠 **E2E test chain** | batch → enrichment → dedup → audit → grade → thread | needs design | **70%** | 现有脚本拼图存在 (test-enrichment-live + run-audit-pipeline) · 无 orchestrator · 需新 runner |
| 🔴 **Design system 19-page CSS 清理** | per-page <style> 迁到 design system | **41-50h** | **88%** | mechanical · 393 unique classes 分 3 类 (A promote / B whitelist / C alias) · SOP-1 page 是 gold standard (0 violations) |

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

## 9. 相关文档（已在线）

| 文档 | 路径 | viewer |
|---|---|---|
| Admin Design System | [`docs/ADMIN_DESIGN_SYSTEM.md`](ADMIN_DESIGN_SYSTEM.md) | TODO viewer |
| SOP-2 详细文档 | [`docs/SOP_2_LEAD_DISCOVERY_PIPELINE.md`](SOP_2_LEAD_DISCOVERY_PIPELINE.md) | [`/admin/scoring/sop-2-doc`](/admin/scoring/sop-2-doc) ✓ |
| Pricing + Scaling 决策 | [`docs/v2/SCALING_AND_PRICING.md`](v2/SCALING_AND_PRICING.md) | TODO viewer |
| Cost Discipline | [`docs/v2/COST_DISCIPLINE.md`](v2/COST_DISCIPLINE.md) | TODO viewer |
| Autoresearch 优化框架 | [`docs/v2/AUTORESEARCH_REPORT_OPTIMIZATION.md`](v2/AUTORESEARCH_REPORT_OPTIMIZATION.md) | TODO viewer |
| Audit Report Schema | [`docs/v2/AUDIT_REPORT_SCHEMA.md`](v2/AUDIT_REPORT_SCHEMA.md) | TODO viewer |
| V2 Upgrade Plan | [`docs/v2/V2_UPGRADE_PLAN.md`](v2/V2_UPGRADE_PLAN.md) | TODO viewer |
