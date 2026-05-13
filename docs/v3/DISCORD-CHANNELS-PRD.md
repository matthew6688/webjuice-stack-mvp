# V3 · Discord 6-Channel Architecture PRD

> **Status**: 90% confidence · 待 Matthew 终审 → 实装
> **Owner**: V3-modular branch · 跨 M1-M5 模块
> **Last verified**: 2026-05-14
> **替代**: `docs/SOP_OVERVIEW.md §6` 4-channel 临时表 + 散落在 SOP-1/2/3-FLOW 中的 channel 引用 → 这里是 SoT

---

## 0. TL;DR

- **6 个 channel · 角色互斥 · graduation 机制串联**
- **核心原则**: channel 本身就是分类 · 不靠 tag 内嵌「在哪阶段」
- **#website-leads** = 还没 demo 的销售 · `#website-projects` = 有 demo 的销售 · `#paid-websites` = 已付款交付
- **revision 只在 #paid-websites 发生** · pre-pay 永不改 demo
- **算力允许时默认每个 grade ABC lead 走完 build → 进 #website-projects** · 成本 ~$0.40-0.60/lead

---

## 1. Goal · 用 Discord channel 做销售漏斗的可视化操作台

每个 channel 等价一个销售漏斗阶段 · operator 在 Discord 里看到 thread 数量 + tag 就能瞬时判断:
- 漏斗状态 (多少 leads / 多少 projects / 多少 paid)
- 卡在哪 (哪个 channel 没动 · 哪些 tag 累积)
- 下一步动什么 (per-thread profile card 含 next action)

不靠外部 admin UI · Discord 就是看板。

---

## 2. 6 个 Channel 完整盘点

| # | Channel | ID | Env Var | 状态 | 单位 |
|---|---|---|---|---|---|
| 1 | `#website-tasks` | (env) | `WEBSITE_TASKS_FORUM_CHANNEL_ID` | ✅ live | 1 命令 = 1 thread |
| 2 | `#lead-discovery-runs` | 1503513633756283070 | `LEAD_DISCOVERY_RUNS_DISCORD_CHANNEL_ID` | ⚠️ env set · 代码在 · 未实际写入 | 1 batch = 1 thread |
| 3 | `#website-leads` | 1501187038706401290 | `WEBSITE_LEADS_DISCORD_CHANNEL_ID` | ✅ live · 4 thread | 1 lead (no-demo) = 1 thread |
| 4 | `#website-projects` | 1501945763650080899 | `WEBSITE_PROJECTS_DISCORD_CHANNEL_ID` | ⚠️ env set · 未实际写入 | 1 lead (with-demo) = 1 thread |
| 5 | `#website-templates` | 1502432818360352910 | **TODO 加** `WEBSITE_TEMPLATES_DISCORD_CHANNEL_ID` | ✅ live · 4 family thread | 1 niche family = 1 thread |
| 6 | `#paid-websites` | 1503529874336383137 | **TODO 加** `PAID_WEBSITES_DISCORD_CHANNEL_ID` | ❌ env 缺 · M5 启动后用 | 1 付费客户 = 1 thread |

---

## 3. 完整漏斗图 · 6 channel 串联

```
┌──────────────────────────────────────────────────────────────────────┐
│  Layer 0 · ENTRY                                                       │
│  #website-tasks (forum)                                                │
│  Matthew / Hermes 发命令 → listener → intent-router → CLI               │
│  Tag 集: kind={intake/places-intake/single-enrich/image-extract/audit  │
│         /ops} + status={pending/running/done/failed/human}             │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                             ▼ (CLI 跑 SOP-1 batch)
                                                                  ┌─────────────────┐
                                                                  │ Layer 2 ·       │
┌─────────────────────────────────────────────────────────────┐  │ Cross-cutting  │
│  Layer 1 · LIFECYCLE                                          │  │                 │
│                                                               │  │ #website-       │
│  ┌─────────────────────────────────────────────────────┐    │  │ templates       │
│  │ #lead-discovery-runs                                 │    │  │                 │
│  │ 1 batch = 1 thread                                   │    │  │ 1 family = 1    │
│  │ summary: source · count · fresh · dedup-merged ·    │    │  │ thread          │
│  │           cost · top entities                        │    │  │                 │
│  │ Tags: place-intake/docker-scrape/image-extract/      │    │  │ Tag: niche +    │
│  │       batch-done/batch-failed/batch-partial          │    │  │ status +        │
│  └────────────────────────┬────────────────────────────┘    │  │ design-style    │
│                           │ grade-router · 自动               │  │                 │
│                           ▼                                    │  │ M3 build 时按   │
│  ┌─────────────────────────────────────────────────────┐    │  │ niche 选 family │
│  │ #website-leads                                       │    │  └────────┬────────┘
│  │ 1 lead (no demo yet) = 1 thread                     │    │           │
│  │ Profile card pinned · 16 字段 embed                  │    │  template-match
│  │ Tag: grade-{abc} · {sales-only/build-pending}       │    │           │
│  │ 销售口径: 用 master.md + audit 冷接触                 │    │           │
│  └────────────────────────┬────────────────────────────┘    │           │
│                           │ pl:publish-demo done             │           │
│                           │ → close thread · graduate         │           │
│                           ▼                                    │           │
│  ┌─────────────────────────────────────────────────────┐    │           │
│  │ #website-projects                                    │◄───┼───────────┘
│  │ 1 lead (with demo URL) = 1 thread                   │    │
│  │ Profile card · 17 字段 (加 demo URL)                 │    │
│  │ Tag: grade-{abc} · demo-ready → outreach-sent →     │    │
│  │       client-reviewing → interested → proposal-sent │    │
│  │       → closed-won / closed-lost / nurture          │    │
│  │ 销售口径: 用 demo URL 冷接触 · 高转化                  │    │
│  │ 关键: demo 永不变 · 想改 → 付款 → r1                  │    │
│  └────────────────────────┬────────────────────────────┘    │
│                           │ Stripe webhook · 自动             │
│                           ▼                                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ #paid-websites                                       │    │
│  │ 1 付费客户 = 1 thread                                 │    │
│  │ Tag: paid-new → in-build → in-revision → approved → │    │
│  │       live → maintenance / churned                  │    │
│  │ Revision 唯一在这里发生 · T1: 3 round · T2: 12/年    │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘

Entity store 联通所有 channel · 一个 entity 在不同 channel 各有 1 thread:
  entity.discord_thread_id          → #website-leads thread (closed)
  entity.project_thread_id          → #website-projects thread (current)
  entity.paid_thread_id             → #paid-websites thread (后期)
  entity.batch_thread_id            → #lead-discovery-runs thread (历史 · 不动)
```

---

## 4. Per-Channel Spec

### 4.1 `#website-tasks` · Layer 0 · 命令入口 forum

| 项 | 值 |
|---|---|
| **Unit** | 1 命令 = 1 thread |
| **Audience** | Matthew + Hermes + listener daemon |
| **进入** | Matthew/Hermes 在 forum 开 thread · 首条 message = 命令 |
| **退出** | task exit 0/非0 · dispatcher 回报 done/failed/timeout |
| **Pin/Profile card** | 无 · 仅文本 task 状态汇报 |
| **Tag 集 (12)** | `intake` · `places-intake` · `single-enrich` · `image-extract` · `audit` · `ops` (6 kind) + `pending` · `running` · `done` · `failed` · `timeout` · `human` (6 status) |
| **SLA** | 命令收到 < 2s · routing < 20s · task 完成 < 4 min (default timeout) |
| **故障 runbook** | listener crash → `launchctl kickstart -k ai.profitslocal.task-listener` |
| **文档** | [SOP-1-FLOW.md](./SOP-1-FLOW.md) §2 |
| **状态** | ✅ live |

### 4.2 `#lead-discovery-runs` · Layer 1 · SOP-1 batch 监控

| 项 | 值 |
|---|---|
| **Unit** | 1 batch (per intake run) = 1 thread |
| **Audience** | Matthew + AI 监督 |
| **进入** | SOP-1 batch CLI 启动时 (places-intake / docker-scrape / image-extract / single-enrich) |
| **退出** | batch 完成 · summary message + tag swap |
| **Pin** | batch summary embed (TODO 设计 · 见 §10 open) |
| **Tag 集 (9)** | `places-intake` · `docker-scrape` · `image-extract` · `single-enrich` (4 source) + `in-progress` · `batch-done` · `batch-partial` · `batch-failed` · `batch-aborted` (5 status) |
| **批量 summary 内容** | source · query · count requested · count returned · fresh new · dedup-merged · failed · cost ($) · top 5 entity names · `data/v2/pipeline-batches/<id>.json` 链接 |
| **SLA** | thread 开 < 5s · summary 写入 < 30s |
| **故障** | 无 thread = batch CLI 没 import `openBatchThread` · 见 §10 |
| **文档** | TODO SOP-1-FLOW 更新 §1 加 batch thread |
| **状态** | ⚠️ env+code 存在 · 实际未写入 (P3 接通) |

### 4.3 `#website-leads` · Layer 1 · 无 demo 的销售

| 项 | 值 |
|---|---|
| **Unit** | 1 lead (grade ABC · 无 demo URL) = 1 thread |
| **Audience** | 销售 (Matthew · 未来 sales hire) |
| **进入** | grade-router 跑完 · entity.phase = `design-ready` · **`pl:publish-demo` 还没跑** |
| **退出** | (a) `pl:publish-demo` 成功 → auto-graduate 到 #website-projects · (b) `sales-only` tag → 一直留这里 cold call · (c) `archived` |
| **Pin** | Profile card (现 16 字段 · D31 后加 `phase=design-ready` 显示) |
| **Tag 集 (9)** | `grade-a` · `grade-b` · `grade-c` (3 grade) + `awaiting` · `sales-only` · `build-pending` · `archived` (4 status) + `urgent` · `do-not-contact` (2 modifier) |
| **关键规则** | **没有 demo URL · 没有 build · 没有 revision** |
| **SLA** | thread 开 < 10s after grade · profile card refresh < 2 min |
| **故障** | `WEBSITE_LEADS_DISCORD_CHANNEL_ID` not set · bot token missing |
| **文档** | TODO SOP-4-FLOW (operator runbook) |
| **状态** | ✅ live · 4 thread (但需迁出 · 见 §6) |

### 4.4 `#website-projects` · Layer 1 · 有 demo 的销售

| 项 | 值 |
|---|---|
| **Unit** | 1 lead (有 demo URL live) = 1 thread |
| **Audience** | 销售 + 客户 (客户可受邀进 thread review demo) |
| **进入** | `pl:publish-demo` 成功 · `cf-pages-deploy.json` 写入 |
| **退出** | (a) Stripe webhook (paid) → auto-graduate 到 #paid-websites · (b) closed-lost → archive · (c) nurture (3 月静默) |
| **Pin** | Profile card 17 字段 (加 🌐 Demo LIVE URL field) |
| **Tag 集 (13)** | `grade-a` · `grade-b` · `grade-c` (3 grade) + `demo-ready` · `outreach-sent` · `client-reviewing` · `interested` · `proposal-sent` (5 sales stage) + `closed-won` · `closed-lost` · `nurture` (3 outcome) + `urgent` · `waiting-customer` (2 modifier) |
| **关键规则** | **demo 永不变** · 客户想改先付款 · 进 #paid-websites r1 开始 |
| **SLA** | demo-ready → thread 开 < 30s · outreach-sent tag swap manual by 销售 |
| **故障** | `WEBSITE_PROJECTS_DISCORD_CHANNEL_ID` not set · `cf-pages-deploy.json` 缺 · CF deploy fail |
| **文档** | TODO SOP-5-FLOW (operator runbook · 销售场景) |
| **状态** | ⚠️ env set · 未实际写入 (P1 启用) |

### 4.5 `#website-templates` · Layer 2 · niche template 库

| 项 | 值 |
|---|---|
| **Unit** | 1 niche template family = 1 thread |
| **Audience** | 设计 + Matthew |
| **进入** | 手动创建新 family (or `template-lab` 工具) |
| **退出** | family deprecated (业务退出某 niche 或 design 过时) |
| **Pin** | family manifest embed · DESIGN.md · reference URLs · approved leads count |
| **Tag 集 (11)** | `roofing` · `restaurant` · `plumber` · `electrician` · `custom` (5+ niche) + `draft` · `qa-pass` · `published` · `deprecated` (4 status) + `classic` · `editorial` · `productized` · `lead-capture` (4 style) — pick 1 per dim · 总数随 niche 增长 |
| **现有 4 family thread** | classic-premium-roftix · editorial-bold-commercial · productized-modern-roofing · lead-capture-restoration (all roofing) |
| **SLA** | 手动节奏 · 无自动 SLA |
| **文档** | [NICHE_TEMPLATE_SYSTEM.md](./NICHE_TEMPLATE_SYSTEM.md) (现有 · 不需重写) |
| **状态** | ✅ live · 4 family · env var 待加 |

### 4.6 `#paid-websites` · Layer 1 · 付费交付

| 项 | 值 |
|---|---|
| **Unit** | 1 付费客户 = 1 thread |
| **Audience** | 交付 (Matthew · 未来 build hire) |
| **进入** | Stripe webhook · `entity.phase = paid` |
| **退出** | (a) churn (退款 / 取消) · (b) 长期 maintenance (T2/T3) |
| **Pin** | Profile card 18 字段 (加 💳 paid date · subscription type · next renewal · 当前 revision round) |
| **Tag 集 (12)** | `paid-new` · `in-build` · `live` · `maintenance` · `churned` (5 stage) + `in-revision` · `revision-done` · `extra-revision-paid` · `approved` (4 revision) + `healthy` · `attention-needed` · `escalated` (3 health) |
| **Revision 规则** | T1 = 3 round 内含 · T2 = 12 round/年内含 · T3 = custom · 超出 `extra-revision-paid` ($100/round) |
| **SLA** | r1 → 客户 review < 48h · approved → live < 24h · maintenance check < 7d |
| **故障** | `PAID_WEBSITES_DISCORD_CHANNEL_ID` not set · Stripe webhook fail |
| **文档** | TODO SOP-6-FLOW (operator runbook · 交付场景) |
| **状态** | ❌ env 缺 · M5 启动后 (依赖 Stripe webhook · M5 模块) |

---

## 5. Cross-Channel Entity Model

### 5.1 Entity 字段映射

```js
// data/leads/entities/<key>.json
{
  // M1 · intake
  "entityKey": "place_chij...",
  "latest": { name, phone, address, website, ... },

  // M2 · audit + grade + thread
  "scoring": { grade, tier, ... },
  "phase": "design-ready",          // ENTITY_PHASE
  "batch_thread_id": "1503...",     // #lead-discovery-runs thread (一旦写入不动)

  // M2.5 · website-leads
  "discord_thread_id": "1504...",   // #website-leads thread (graduate 后 close · 不删字段)
  "discord_thread_closed_at": "...",
  "discord_profile_message_id": "...",

  // M3 · build + website-projects
  "demo_url": "https://<slug>-dev.pages.dev",
  "demo_built_at": "...",
  "project_thread_id": "1505...",   // #website-projects thread (current)
  "project_thread_opened_at": "...",

  // M5 · paid
  "paid_at": "...",
  "stripe_customer_id": "...",
  "paid_thread_id": "1506...",      // #paid-websites thread

  "archive_reason": null            // (any phase 可 archive)
}
```

### 5.2 Profile card · 单一渲染器 · 不同 channel 取子集

`core/funnel/profile-card.js#renderProfileCard(entity, { channel, audit })`:
- `channel='leads'` → 16 字段 · 不含 demo URL
- `channel='projects'` → 17 字段 · 加 🌐 Demo LIVE URL
- `channel='paid'` → 18 字段 · 加 💳 paid info + revision tracker

一个函数 · 三种 mode · 同源数据。

### 5.3 Tag taxonomy 数量限制

Discord forum 限制 = 20 tags / channel。当前规划：

| Channel | 当前 | 限额 | 余量 |
|---|---|---|---|
| website-tasks | 12 | 20 | 8 |
| lead-discovery-runs | 9 | 20 | 11 |
| website-leads | 9 | 20 | 11 |
| website-projects | 13 | 20 | 7 |
| website-templates | 11 (随 niche 长) | 20 | ~9 |
| paid-websites | 12 | 20 | 8 |

每个 channel 至少 7 个余量供未来扩展。

---

## 6. Migration Plan · 11 keepers + 现有 4 thread

### 6.1 现状 vs 目标

| Entity | 当前 thread | 当前 channel | 应该在 | 动作 |
|---|---|---|---|---|
| Brisbane Roofing Solutions | 1504014264996855858 | leads | projects | **migrate**: close leads thread + open projects |
| FIX MY ROOF | 1503256064244842547 | leads | projects | **migrate** |
| Gutter and Roof Repairs | 1504014636960317500 | leads | projects | **migrate** |
| WeatherpRoof | 1504015361526468671 | leads | projects | **migrate** |
| Brisbane Roof Restoration Experts | — | — | projects | **open new** (C 客户 · 但 demo 已 live) |
| Diamond Roof Tiling | — | — | projects | **open new** |
| Queensland Roofing (entity 1) | — | — | projects | **open new** |
| Queensland Roofing (entity 2) | — | — | projects | merge into entity 1 (dedup) · 或 open · 待 Matthew 决 |
| Roof Space Renovators | — | — | projects (or archive?) | grade=D · 决策点 |
| Roofshield | — | — | projects | **open new** |
| Hurricane Digital | archived | — | (archived · 不动) | 跳过 |

### 6.2 Migration 步骤

**P1.1 Tools 实装** (~1.5h):
```js
// core/funnel/lead-thread-sync.js
export async function openProjectThread(entityKey)           // 类比 openLeadThread · 写 project_thread_id
export async function migrateLead2Project(entityKey)         // close leads thread + open projects thread + copy 关键 msg
export async function closeThread(threadId, reason)          // 通用 close · 加最后一条说明 message
```

**P1.2 一键迁移 11 keepers** (~30 min):
```bash
npm run pl:migrate-keepers-to-projects -- --dry-run
npm run pl:migrate-keepers-to-projects -- --apply
```

**P1.3 Verify** (~15 min):
```bash
npm run pl:lead-journey-doctor   # 看 phase 字段更新
# Discord 手验: #website-projects 应有 9 个新 thread · #website-leads 4 个 thread closed
```

---

## 7. Auto-graduation 触发器

### 7.1 #lead-discovery-runs → #website-leads

| 触发 | grade-router 完成 grade ∈ {A,B,C} (D 不走 leads · 直 archive) |
| 实装 | `core/leads/grade-router.js` · 已实装 |
| Hook | `setEntityPhase('design-ready')` → 触发 `openLeadThread` |
| 状态 | ✅ 已实装 (D31 后 phase 修正) |

### 7.2 #website-leads → #website-projects

| 触发 | `pl:publish-demo` 成功 · `cf-pages-deploy.json` 写入 |
| 实装 | **TODO**: 在 `scripts/cli/pl-publish-demo.js` 末尾加 hook 调 `migrateLead2Project(entityKey)` |
| 工作量 | ~30 min |
| 状态 | 🔴 待实装 (P1) |

### 7.3 #website-projects → #paid-websites

| 触发 | Stripe webhook · payment_intent.succeeded |
| 实装 | **TODO**: M5 模块 (整套 paid lifecycle) |
| 状态 | ❌ M5 未启动 · P4 推后 |

### 7.4 任何 channel → archive

| 触发 | (a) manual 🗑 reaction · (b) D-grade auto · (c) closed-lost · (d) 3 月 nurture 静默 |
| 实装 | `setEntityPhase('archived')` + thread tag swap |
| 状态 | ✅ a/b 已实装 · c/d TODO |

---

## 8. Implementation Phases

### Phase 1 · 启用 #website-projects + 迁移 11 keepers (P1 · ~3.5h · $0)

| 步骤 | 工作量 | 依赖 |
|---|---|---|
| `core/funnel/discord.js` blueprints.projects 改 13 tag (砍 revision) | 15 min | — |
| `core/funnel/discord.js` blueprints.leads 改 9 tag (砍 outreach/reply/proposal) | 15 min | — |
| `core/funnel/lead-thread-sync.js` 加 `openProjectThread` + `migrateLead2Project` + `closeThread` | 1.5h | — |
| `core/funnel/profile-card.js` 加 `channel='projects'` mode + demo URL field | 30 min | — |
| `scripts/cli/pl-publish-demo.js` 末尾 hook · migrateLead2Project | 30 min | 上面 |
| `scripts/cli/pl-migrate-keepers-to-projects.js` (新) · dry-run + apply | 30 min | 上面 |
| Apply · 9 个 → projects + 4 close leads | 15 min | 上面 |
| Verify (Discord 手验 + doctor) | 15 min | — |

### Phase 2 · 文档 + env vars (P2 · ~2h · $0)

| 步骤 | 工作量 |
|---|---|
| 加 `WEBSITE_TEMPLATES_DISCORD_CHANNEL_ID` + `PAID_WEBSITES_DISCORD_CHANNEL_ID` 到 .env.local | 5 min |
| `core/admin/settings-index.js` 显示 2 个新 channel | 15 min |
| 写 `SOP-4-FLOW.md` (#website-leads operator runbook) | 30 min |
| 写 `SOP-5-FLOW.md` (#website-projects operator runbook) | 45 min |
| 更新 `docs/v3/SOP-1-FLOW.md` §2 加 batch thread 触发 | 15 min |
| 更新 `docs/v3/README.md` SoT 加 channel 索引 | 15 min |
| `docs/SOP_OVERVIEW.md §6` 4-channel 临时表 → 删 + 链接到本 PRD | 10 min |

### Phase 3 · #lead-discovery-runs 真接通 (P3 · ~2h · $0)

| 步骤 | 工作量 |
|---|---|
| `core/funnel/pipeline-batch-thread.js` 完善 `openBatchThread` + `appendBatchSummary` | 1h |
| Hook 进 `pl:places-search-intake` + `pl:scrape-docker` + `pl:single-enrich` + `pl:ingest-image` (4 entry) | 45 min |
| Verify · 实际跑 batch · #lead-discovery-runs 应出新 thread | 15 min |

### Phase 4 · #paid-websites + M5 (依赖 M5 · TBD)

M5 module 整套 (Stripe webhook · paid handoff · revision tracker · domain provisioning) · 单独 PRD · 此 PRD 仅为它预留 channel + tag 集。

### Phase 5 · doctors (P5 · ~3h · $0)

| 步骤 | 工作量 |
|---|---|
| `pl:channels-doctor` (新) · 检查 6 channel env + bot 权限 + tag 同步 | 1h |
| 拓展 `pl:lead-journey-doctor` 加 invariant 11: 每 grade ABC entity 有 thread (在 leads 或 projects) | 30 min |
| Daily cron `ai.profitslocal.channels-doctor-daily` | 30 min |
| SOP-1-FLOW · SOP-2-FLOW · SOP-3-FLOW · LEAD-JOURNEY 互引更新 | 1h |

---

## 9. Risks + Rollback

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| Discord API rate limit (1 sec per channel) | 低 | 迁移慢 | 1 lead 间隔 200ms |
| Thread close 不可撤销 (Discord 把已 close thread 反激活很难) | 中 | 失去 4 个 thread 历史 | 选项: 不真 close · 只 swapTag archived + 锁定 thread |
| Stripe webhook 实装前 paid 客户无 channel | 低 | M5 启动前不会有 paid · OK | 等 M5 |
| `cf-pages-deploy.json` 缺导致 migrate hook 不触发 | 中 | demo 跑了但 thread 没建 | hook 加 fallback · 5 min 内 retry |
| tag 数 > 20 (未来 niche 太多) | 中 | Discord 拒绝 PATCH | 监控 + 砍合并 |

### Rollback 方案

每个 phase 独立 rollback:
- Phase 1: 删除新建 thread (Discord UI 手删) + git revert · 11 keepers 数据回到 archive 前
- Phase 2: 删 env vars + git revert docs · 0 数据损失
- Phase 3: 删 batch thread hook · batch 继续跑 · 只是没 Discord 通知
- Phase 5: 删 cron + doctor script · 不影响 production

---

## 10. Open Questions · 待 Matthew 决

| # | 问题 | 我的建议 |
|---|---|---|
| 1 | 现有 4 个 leads thread 真 close · 还是 swap-archive tag? | swap-archive (保留 thread 历史 · 但 lock) |
| 2 | Queensland Roofing 2 个 entity key · merge 还是 keep both? | merge (8-key dedup 应自动 · 跑一次 dedup-detector) |
| 3 | Roof Space Renovators · D-grade · 进 projects 还是 archived? | archived (D 不该有 demo · 浪费成本) |
| 4 | Hurricane Digital (archived) · 也迁 projects 留底? | 不动 (archive 就是 archive) |
| 5 | `#paid-websites` env var 现在加吗 (M5 启动前)? | 加 (env var 不花钱 · 防 forgetting) |
| 6 | `#website-templates` env var 现在加吗? | 加 (现有代码引用零成本) |
| 7 | `lead-discovery-runs` batch thread P3 优先级? | P3 (现 #website-tasks 也能看 task done · 重复度高) |
| 8 | open-design tag (V2 leftover) 删吗? | 删 (现 M3 已是 reference-adapter · OD 不在主路径) |
| 9 | nurture 3 月静默自动 archive 实装吗? | TODO P4 (现手动 OK) |
| 10 | Stripe webhook 哪个 endpoint 接? (M5 设计) | M5 PRD · 此处不答 |

---

## 11. Acceptance Criteria · 怎么算这套架构完成

- [x] 6 channel ID + env vars 全部配置 (TODO: 加 2 个 env)
- [x] 每个 channel 有明确 unit + audience + tag 集 + profile card spec
- [x] graduation 机制定义清楚 (auto / manual)
- [ ] **P1 完成**: 11 keepers 在 #website-projects 全可视化 + #website-leads 留 sales-only
- [ ] **P2 完成**: 6 个 channel 都有 operator runbook (SOP-N-FLOW)
- [ ] **P3 完成**: #lead-discovery-runs 真接通 (每次 batch 写 summary thread)
- [ ] **P5 完成**: `pl:channels-doctor` daily 监控
- [ ] V3 README SoT 加 channel 索引节
- [ ] Open questions 1-10 全部答 + 实施

整套上线 = **真客户从 intake → audit → grade → demo → outreach → 付款 → 交付** 全程在 Discord 6 channel 可视化追踪。

---

## 12. 相关文档

- [README.md (SoT)](./README.md) · V3 source of truth · channel 索引会加在这里
- [LEAD-JOURNEY.md](./LEAD-JOURNEY.md) · lead lifecycle 12 阶段 · 跨 channel
- [SOP-1-FLOW.md](./SOP-1-FLOW.md) · intake (#website-tasks + #lead-discovery-runs)
- [SOP-2-FLOW.md](./SOP-2-FLOW.md) · audit
- [SOP-3-FLOW.md](./SOP-3-FLOW.md) · publish · (这里触发 leads → projects 迁移)
- [M3-PRD.md](./M3-PRD.md) · reference-adapter + CF Pages
- [NICHE_TEMPLATE_SYSTEM.md](./NICHE_TEMPLATE_SYSTEM.md) · #website-templates 详解
- [DECISIONS-LOG.md](./DECISIONS-LOG.md) · D27 cascade · D31 design-ready · D33 archive
- [SOP-DISCORD-HERMES-FLOW.md](./SOP-DISCORD-HERMES-FLOW.md) · cross-cutting Discord ↔ Hermes (旧 V2)
- [SOP_OVERVIEW.md §6](../SOP_OVERVIEW.md) · 旧 4-channel 临时表 (P2 时删 · 替为链接到本 PRD)
