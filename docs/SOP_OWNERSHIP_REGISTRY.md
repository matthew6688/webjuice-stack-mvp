# SOP Ownership Registry · 概念归属表

**版本**: v1.0
**最近更新**: 2026-05-12
**约束力**: 🔴 强制 · 所有 SOP 写作必须遵守
**配套规则**: [`SOP_MAINTENANCE_RULES.md`](SOP_MAINTENANCE_RULES.md)

---

## 0. 核心原则

> **一个业务概念，一个 SOP 拥有完整描述权（owner）。其他 SOP 引用 owner 时，只能 1) 一句话简介 + 2) 链接到 owner SOP。**

杜绝场景：同一规则在 SOP-1 写 "9 GBP rules + 10 启发式"，在 SOP-2 写 "19 规则"，3 个月后两者漂移到不一致 — 这种尴尬必须从源头杜绝。

---

## 1. 概念归属表

### 1.0 SOP-0 Task System 拥有（统一入口 + 调度）

**SOP-0 出口承诺**：把一切活儿（Discord 文字 / 图 / PDF / admin 表单 / Hermes cron tick）统一成 task，自动路由到对应 SOP 的 CLI，进度回写 Discord thread + admin。**不做业务 · 只驱动业务。**

| 概念 | Owner | 引用方式 |
|---|---|---|
| **Task schema** (`data/pipeline/tasks/<id>.json`) + status 状态机 | SOP-0 §2 | 他 SOP: "见 [SOP-0 §2]" |
| 入口 router（Discord / admin / cron → kind 识别） | SOP-0 §3 | 同上 |
| CLI 路由表（kind → target_cli） | SOP-0 §3.3 | 同上 |
| Dispatcher（主 tick + entity-driven auto-dispatch） | SOP-0 §4 | 同上 |
| Discord forum thread ↔ task 1:1 映射 + tag 同步 | SOP-0 §5.1 | SOP-X-Discord 接手后引用 |
| `/admin/tasks` viewer (P7) | SOP-0 §5.2 | — |
| `/admin/cron` viewer / setter (P7+) | SOP-0 §5.3 | Hermes cron infra 见 SOP-X-Tooling |
| 失败处理协议（tag-based · `needs-human` · 不另设仓库） | SOP-0 §6 | 同上 |
| task `task_id` 命名规则（`YYYYMMDD-HHMMSS-rand6`） | SOP-0 §2.1 | 同上 |

详见 [`SOP_0_TASK_SYSTEM.md`](SOP_0_TASK_SYSTEM.md) (v0.1-draft · P1-P8 阶段化交付)。

### 1.1 SOP-1 拥有（客户发现 + 去重 + 增强 / Intake）

**SOP-1 出口承诺**：把候选客户找进来 + 去重 + 联系方式补全 → 输出 **dedup-clean + enrichment-complete 的 entity** 给 SOP-2。

| 概念 | Owner | 引用方式 |
|---|---|---|
| gosom Docker scraper 操作链路 (8 步 API 详解) | SOP-1 §3 | 他 SOP: "见 [SOP-1 §3]" |
| `pl:scrape-docker` CLI 用法 | SOP-1 §3 | 同上 |
| `pl:pipeline-batch-*` CLI | SOP-1 §4 | 同上 |
| `pl:ingest-image` (image-lead V2) | SOP-1 §2.1 | 同上 |
| `pl:places-enrich` Places API 增强（Step 3b） | SOP-1 §3 | 同上 |
| `batch_id` 字段语义 + 传播 | SOP-1 §4.1 | 同上 |
| `sourceQuery` 强制规则 (= run.query) | SOP-1 §3.4 | 同上 |
| `max_time ≥ 180` gosom API hard limit | SOP-1 §7 | 同上 |
| **Dedup 作为 pipeline 步骤** (Step 2 · auto-merge + suspect detection) | SOP-1 §X (执行) | 协议详解 → SOP-X-Dedup |
| **Enrichment 作为 pipeline 步骤** (Step 3 · thin-contact 5 路 search) | SOP-1 §X (执行) | thin-contact predicate 在 SOP-1 |
| **Thin-contact predicate** (`!phone && !website`) | SOP-1 §X | SOP-2 不再 own 这个判定 |
| **Scraper fallback chain** (gosom → Places → 3rd-party 待 G-11) | SOP-1 §X (TODO) | SOP-X-Tooling fail-over 配套 |

### 1.2 SOP-2 拥有（筛选 + 审计）

**SOP-2 入口期望**：拿到 SOP-1 交付的 dedup-clean + enrichment-complete entity，**不再 own** 联系方式补全 / 去重逻辑。

| 概念 | Owner | 引用方式 |
|---|---|---|
| cheap-audit-v2 Stage 1 (9 GBP rules) | SOP-2 §3.1 | 他 SOP: "见 [SOP-2 §3.1]" |
| cheap-audit-v2 Stage 2 (10 site quick-scan 启发式) | SOP-2 §3.1 | 同上 |
| cheap-audit-v2 5 hard triggers | SOP-2 §3.3 | 同上 |
| detailed-audit 6 维 34 规则 | SOP-2 §2 Step B | 同上 |
| detailed-audit 5 hard triggers | SOP-2 §2 Step B | 同上 |
| 4 档 decision 阈值 (strong/moderate/low/not_qualified) | SOP-2 §2 Step B | 同上 |
| `niche_match` SKIP 行为 | SOP-2 §3.3 | 同上 |
| `starter_candidate` 路径 + 未完全自动化 | SOP-2 §6 | 同上 |
| `relevance_pass` 校验 | SOP-2 §3 | 同上 |
| Investment level A/B/C/D 触发条件 | SOP-2 §4.1 | 同上 |
| HARD_SKIP 8 条规则 | SOP-2 §4.1 | 同上 |
| Product tier T1/T2/T3 触发信号 + 报价 | SOP-2 §4.2 | 同上 |
| A/B 自动开 thread (`openLeadThread`) | SOP-2 Stage 2 Step D | 同上 |
| `grade-c` tag 语义 (C 手动晋升) | SOP-2 §4.1 | 同上 |
| Visual audit 链路 (claude→gemini→ollama) | SOP-2 Stage 2 Step C | 同上 |
| PSI integration (Stage 2i) | SOP-2 §2 Step A | 同上 |
| ~~Stage 0 Discovery~~ | **已迁出 → SOP-1** | — |
| ~~Stage 0.5 Enrichment~~ | **已迁出 → SOP-1 §X** | — |
| ~~Discord 4-channel 完整架构~~ | **已迁出 → SOP overview §6** | 待 SOP-X-Discord |

### 1.3 SOP-X-Handoff 拥有（数据交接）

| 概念 | Owner | 引用方式 |
|---|---|---|
| **Entity schema 全字段定义** | SOP-X-Handoff §2 | 其他 SOP: 不重述字段表，链接 |
| 8 个 V1 status 值 + 升级规则 | SOP-X-Handoff §3 | 同上 |
| 8 个 V2 phase 值 + 转换规则 | SOP-X-Handoff §4 | 同上 |
| `latest.places_enrichment` 子对象结构 | SOP-X-Handoff §2.3 | 同上 |
| **`enrichment_status` 字段 schema + 决定逻辑** | SOP-X-Handoff §2.3.2 | SOP-1 引用 step / when to trigger |
| **`contact_identity` 字段 schema** | SOP-X-Handoff §2.3.1 | 同上 |
| schemaVersion 升级协议 | SOP-X-Handoff §6 | 同上 |
| SOP-2 入口必填校验列表 | SOP-X-Handoff §5 | 同上 |

### 1.4 SOP-X-Tooling 拥有（第三方工具 + 健康）

| 概念 | Owner | 引用方式 |
|---|---|---|
| 第三方工具矩阵 (20+) + tier + cost | SOP-X-Tooling §1 | 其他 SOP: 链接 |
| Google Places API 月度免费额度 ($200) | SOP-X-Tooling §2 | 同上 |
| Places quota cap 机制 (11K cap, ledger 文件) | SOP-X-Tooling §2 | 同上 |
| `ops:health-check` 9 项周期检查 | SOP-X-Tooling §3 | 同上 |
| Fail-over routing (DDGS → Tinyfish → Firecrawl → Perplexity) | SOP-X-Tooling §1.1 | 同上 |
| LLM fallback chain (claude → gemini → ollama) | SOP-X-Tooling §1.2 | 同上 |
| `SYSTEM_ALERTS_DISCORD_WEBHOOK_URL` + alert-pusher | SOP-X-Tooling §3 | 同上 |

### 1.5 SOP-X-Dedup 拥有（去重协议详解）

**职责分工**：本文档是 **dedup 协议详解 owner**。dedup 作为 **pipeline 步骤** 归 [SOP-1 §X](SOP_1_INTAKE_DISCOVERY.md)（执行时机 + 流程）。规则在这里，步骤在 SOP-1。

| 概念 | Owner | 引用方式 |
|---|---|---|
| 3-key dedup 策略 (place_id / phoneDigits / websiteDomain) | SOP-X-Dedup §1 | 他 SOP: "见 [SOP-X-Dedup]" |
| Auto-merge 条件 (place_id 命中) | SOP-X-Dedup §2 | 同上 |
| 嫌疑队列 (`dedup-review-queue.json`) | SOP-X-Dedup §3 | 同上 |
| `pl:dedup-audit` / `pl:dedup-merge` CLI | SOP-X-Dedup §4 | 同上 |
| Merge 协议 (loser 标 `merged_into` 归档不删) | SOP-X-Dedup §2 | 同上 |
| Operator 决策 UI (`/admin/v2-leads/dedup-review`) | SOP-X-Dedup §5 | 同上 |

### 1.6 Niche Cohort (SOP-1 §6 扩展) 拥有

| 概念 | Owner |
|---|---|
| Niche cohort 分组 (物理 flat + 逻辑分组) | SOP-1 §6 |
| `data/leads/niches/<niche>/<city>.entityKeys.json` 索引文件 | SOP-1 §6 |
| `entity.cohorts[]` 字段（多 niche 兼容） | SOP-1 §6 |
| `pl:rebuild-niche-shards` CLI | SOP-1 §6 |
| Cohort lifecycle (active / mature / dormant / archived) | SOP-1 §6 |

### 1.7 SOP-X-Discord 拥有（待写 · 占位）

| 概念 | Owner | 当前状态 |
|---|---|---|
| 4-channel 完整架构图 | SOP-X-Discord (TODO) | 暂存 SOP-2 §1，写完迁出 |
| Forum tags 总集（6 个 batch tag + 8 个 lead tag）| SOP-X-Discord (TODO) | 暂存 SOP-1 §4 + SOP-2 §1 |
| Bot 权限 + 设置 | SOP-X-Discord (TODO) | 暂无 |
| Webhook 双轨（SYSTEM_ALERTS vs SPECIAL_ALERTS）| SOP-X-Discord (TODO) | 暂存 SOP-X-Tooling |

### 1.8 SOP overview 拥有

| 概念 | Owner |
|---|---|
| 16-SOP 3 层架构图 | SOP_OVERVIEW.md §1-3 |
| USP "先做网站再对接" + 三分支分流 | SOP_OVERVIEW.md §1-2 |
| 维护协议 (单源原则 §5.1) | SOP_OVERVIEW.md §5 |
| 全局 TODO 优先级列表 | SOP_OVERVIEW.md §7 |

### 1.9 SOP-3 / SOP-4 / SOP-5 (待写)

| 范围 | Owner (未来) |
|---|---|
| Open Design 网站预制 | SOP-3 |
| 销售对接 + multi-touch outreach | SOP-4 |
| C-grade Hermes auto-outreach | SOP-4 |
| 付费 → 交付 → 维护 | SOP-5 |

---

## 2. 引用模式（必须照做）

### ✅ 正确（SOP-1 引用 SOP-2 概念）

```markdown
### 5.X niche_match 校验

详见 [SOP-2 §3.3 Hard triggers](SOP_2_LEAD_DISCOVERY_PIPELINE.md#33-hard-triggers)。
本节略。
```

### ❌ 错误（SOP-1 重述 SOP-2 概念）

```markdown
### 5.X niche_match 校验

- 当 category 不含 niche 关键词时 → SKIP (hard)
- 这是 cheap-audit-v2 的 5 个 hard triggers 之一
- ...
```
↑ 跟 SOP-2 同步漂移风险 100%。**禁止**。

---

## 3. 检查机制

### 3.1 写作前自查 (五问)
见 [`SOP_MAINTENANCE_RULES.md`](SOP_MAINTENANCE_RULES.md)。

### 3.2 自动 audit
`npm run ops:sop-audit` — grep 跨 SOP 出现的关键概念，flag 重复。

### 3.3 PR 模板
未来的 SOP-PR 必须勾选：
- [ ] 改的概念 owner 是 X (本 PR 限于这个 owner)
- [ ] 跨 SOP 引用都用链接，不复述
- [ ] 跑 `npm run ops:sop-audit` 通过

---

## 4. 异常处理

**如果一个新概念跨 SOP 没法分清归属**：
1. 升级讨论 — 在 SOP overview TODO 列表加一行 "概念 X 归属待定"
2. 临时归 SOP overview
3. 写下规则后迁出到正式 owner

**永远不要 "复制 + 修改"** —— 哪怕开头是同步的，3 个月后就是 stale 灾难。
