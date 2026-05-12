# V3 架构 · 设计文档 · 2026-05-13

> **基于 3 份调研报告综合**：
> - `data/qa/sop-pipeline-inventory-2026-05-13.md` (销售 pipeline 现状)
> - `data/qa/hermes-deep-dive-2026-05-13.md` (Hermes 35 subcommand 调研)
> - `data/qa/open-design-inventory-2026-05-13.md` (Open Design IP 评估)
>
> **目标**：把 12 天工程量减到极致 · 把精力对准真正的护城河 · 上线 Open Design 真实付费客户

---

## 0. 执行摘要 (一页)

**3 个事实判断**：

1. **我们 60% 的代码在重造 Hermes Agent 已有的能力**（kanban / cron / dedup / cost tracker / dispatcher / state machine）。Hermes v0.13 的 durable kanban 是 SQLite-backed + cross-profile + idempotent，比我们 fs 文件存储健壮 10x。

2. **Open Design 不是我们的 IP**（Apache 2.0 OSS · `nexu-io/open-design`）。我们 4500 LOC 包装中 90% 是 `run-concept.js` (1431 行) 跟 OD daemon SSE 流挣扎的胶水。**Hermes 直接调 API 出 HTML 替代 55-65% 的代码**。

3. **当前 192 entity · 销售漏斗前段 (96 个 queued_for_audit) 完全没流动**。两套并行系统 (legacy `status` + V2 `phase`) 没真正整合 · `PROPOSAL_SENT` / `PAID` 阶段零自动 trigger · 邮件发送 default 是 dry-run · 没 follow-up · 没 SMS / Voice / Cal.com 集成。**Pipeline 本身没真跑过完整闭环**。

**V3 核心思想**：
- master.md = 单一真相 · 所有阶段往里更新
- Hermes kanban = 任务推进引擎 · 不再自造
- Hermes skills = 把我们 IP 暴露成 LLM 可路由的能力
- Discord forum = 操作员可视化 kanban (保留)
- Cloudflare = 状态层 / 公网访问层
- 本机 = 长跑计算（gosom · audit · OD app）

**V3 真正的护城河（~2000 LOC 不动）**：
- `core/scoring/lead-grading.js` 评级机制
- `core/leads/template-match.js` 策展规则
- `core/leads/copy-brief.js` + `open-design-handoff.js` fact-lock
- `templates/roofing/families/*` 4 家族策展
- `core/audit/*` 12 维 audit
- `core/reports/master-md-builder.js` 文档生成
- `core/leads/dedup-detector.js` 8-key 判重

**V3 砍掉 (~3000 LOC 删 / 重构)**：
- `core/tasks/*` (task-store / dispatcher / intent-router) → Hermes kanban
- `scripts/cli/pl-task-{listener,dispatcher,api}.js` → Hermes gateway
- `scripts/open-design/run-concept.js` 1431 行 → Hermes API + ~100 行包装
- `core/leads/vision-ollama.js` + 5-通道 enrichment → Hermes built-in
- Two parallel status/phase systems → 统一到 phase + Discord tag

---

## 1. 三个不可忽视的事实

### 事实 1 · Hermes 是更强的基础设施 · 我们一直在重造

| 我们造的 | 行数 | Hermes 内置等价 | 评价 |
|---|---|---|---|
| `core/tasks/task-store.js` 文件存储 + state machine | ~500 | `hermes kanban` SQLite-backed | 完全重复 · 更脆弱 |
| `pl:task-dispatcher` daemon fs.watch | ~400 | Hermes gateway 自动 dispatch | 完全重复 |
| `core/tasks/intent-router.js` ollama + regex | ~300 | skill description + LLM 自路由 | 完全重复 |
| `pl:task-retention` 30 天 archive | ~150 | `kanban gc` + auto archive | 完全重复 |
| 自造 cost tracker | ~200 | `hermes insights` 30 天 token/cost | 完全重复 |
| 自造 dedup 表 | ~100 | kanban `--idempotency-key` | 完全重复 |
| 5 daemon launchd plist | — | Hermes gateway 1 个进程 | 过度工程 |

**我们 Hermes 用率仅 5%**（只用了 cron daily ping）。

### 事实 2 · Open Design 是工具，不是产品

```
你以为：           Open Design = 我们的核心 IP
现实是：           Open Design = 你 fork 的 Apache 2.0 OSS
                  你的 IP = 用 OD + 我们的 audit + 策展规则 + 客户运营
```

OD 本身有：
- 140 个 design systems（内置）
- 31 个 skills（内置）
- 16 个 coding agent CLI 支持（含 Hermes）

我们包装 OD 的 4500 LOC 中：
- **1431 行** = `run-concept.js` 跟 OD daemon SSE 流死磕
- ~500 行 = 配套测试 / sync / validate

**Hermes 直接调 OD 的 HTTP API 出 HTML** → 可砍 1500+ 行。

### 事实 3 · 销售 pipeline 没真跑通过

**真实数据**：
```
总 entity:                     192
有 grade A/B/C/D 的:           11   (5.7%)
有 V2 phase 的:                4    (2.1%)
卡在 queued_for_audit 的:      96   (50%)  ← audit pipeline 没批量跑过
真正付费客户:                  2    (opa-bar-mezze · rich-and-rare)
```

**完全缺自动 trigger 的阶段**：
- `PROPOSAL_SENT` → 0 个自动 trigger
- `PAID` → 0 个自动 trigger
- C-grade 批量轻触 → 设计了但没实装

**通讯系统空白**：
- 邮件发送 default dry-run · 真发要 CF Access token (没配)
- SMS · 0 代码
- Voice · 0 代码
- Cal.com · 0 代码

**漏斗几乎是空的**。我们造了一堆基础设施 · 真正的销售闭环没跑起来。

---

## 2. V3 架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│  人 (Matthew)                                                            │
│  Discord (operator interface · forum tag kanban 可视化)                  │
└───────────────┬───────────────────────────────┬─────────────────────────┘
                │                               │
        外联通道 (sales)                  操作员对话 / 看板
                │                               │
       ┌────────┴────────┐         ┌────────────┴──────────────┐
       │ agentic email   │         │  Hermes Gateway            │
       │ (Cloudflare)    │         │  - Discord forum adapter   │
       │ Vapi voice      │         │  - kanban dispatcher       │
       │ Termux SMS      │◀────────│  - notify-subscribe        │
       │ Cal.com         │         │  - cron scheduler          │
       └─────────────────┘         │  - webhook server           │
                ▲                  └────────────┬────────────────┘
                │                               │
                │                               ▼
                │              ┌────────────────────────────────┐
                │              │  Hermes kanban (SQLite)        │
                │              │  - per-customer board          │
                │              │  - task state machine          │
                │              │  - idempotency / dedup         │
                │              │  - cross-profile dispatch      │
                │              │  - hooks (pre/post tool call)  │
                │              └────────────┬───────────────────┘
                │                           │
                │                  ┌────────┴────────┐
                │                  ▼                 ▼
                │           Profitslocal       Other skills
                │           Skills (8)         (49 installed)
                │           ───────────       ───────────
                │           - intake          - himalaya (email)
                │           - master-md       - google-workspace
                │           - audit           - linear / notion
                │           - design          - domain-intel
                │           - publish         - dokobot
                │           - outreach        - doko-research
                │           - sales           - ...
                │           - nurture
                │                  │
                │                  ▼
                │           ┌──────────────────────────────────────┐
                │           │  Our IP CLIs (~2000 LOC kept)        │
                │           │  ─────────────────────────────       │
                │           │  scoring/lead-grading                 │
                │           │  leads/template-match                 │
                │           │  leads/copy-brief (fact-lock)         │
                │           │  audit/* (12 维)                      │
                │           │  reports/master-md-builder            │
                │           │  leads/dedup-detector (8-key)         │
                │           │  pl:scrape-docker (gosom)             │
                │           │  templates/roofing/families/*         │
                │           └──────────────────────────────────────┘
                │                          │
                │                          ▼
                │           ┌──────────────────────────────────────┐
                │           │  Storage layer                       │
                │           │  ──────────────                      │
                │           │  master.md (per entity)               │
                │           │  data/leads/entities (本机 · 可迁 CF) │
                │           │  data/v2/fixtures/audit (本机)        │
                │           │  Cloudflare D1 (将来 · 状态镜像)      │
                │           │  Cloudflare R2 (master.md 公网)        │
                │           └──────────────────────────────────────┘
                │
                └─── Hermes 调出去外联 (闭环回头看 reply)
```

---

## 3. 完整 Skill 体系 (8 个 + 复用 5 个外部)

### 3.1 我们要写的 8 个 skills

```
skills/
├── profitslocal-master/         🏠 入口路由 (任意请求 → dispatch)
│   ├── SKILL.md
│   └── (体: 描述 8 个子 skill 的 trigger)
│
├── profitslocal-intake/         📥 SOP-1
│   └── CLI: pl:scrape-docker · pl:single-enrich · pl:places-search-intake
│
├── profitslocal-master-md/      📄 master.md 中央枢纽
│   └── CLI: leads:build-master-md · refresh
│
├── profitslocal-audit/          🔍 SOP-2 12 维 audit + 评级
│   └── CLI: leads:run-pipeline · scoring/lead-grading
│
├── profitslocal-design/         🎨 SOP-3 Open Design wrapper (薄)
│   └── CLI: hermes 直调 OD HTTP API · 代替 run-concept 1431 行
│
├── profitslocal-publish/        🚀 SOP-3.5 CF Pages 部署
│   └── CLI: wrangler pages deploy · (替代 GH repo bootstrap)
│
├── profitslocal-outreach/       📧 SOP-4 通讯
│   └── CLI: agentic-email · vapi-call · termux-sms · cal-link
│
└── profitslocal-sales/          💼 SOP-5 回复 + 提案 + 收款
    └── CLI: pl:reply-handle · proposal-generate · stripe-webhook
```

### 3.2 复用现有 skills (Hermes 已装 49 个)

| Skill | 用在哪 |
|---|---|
| `himalaya` (IMAP/SMTP) | agentic email reply 监听 fallback |
| `google-workspace` | 客户日历 (Cal.com 替代) + Drive 文档存档 |
| `domain-intel` | audit whois / DNS / 域名历史 |
| `dokobot` + `doko-research` | enrichment 5 通道替代 · web search 兜底 |
| `huashu-design` | master.md → HTML 渲染（已在用）|

### 3.3 Skill body 模板 (canonical)

```yaml
---
name: profitslocal-intake
description: |
  当用户提到"找商家 / 抓 leads / 输入电话名片 URL"时调用。
  从任意输入抽商家信息 → 8-key 去重 → 入 entity store → 触发 master.md 建档。
read_when:
  - "find {niche} in {city}"
  - 电话 + 名字 (e.g. "Joe's Plumbing 0412...")
  - Google Maps URL
  - 图片附件 (名片 / 店招)
  - 多引号 (multi-query places search)
allowed-tools: Bash
metadata:
  author: profitslocal
  version: "3.0"
  niche: au-local-business
---

# ProfitsLocal Intake

## 4 个入口

| 输入 | CLI |
|---|---|
| 自然语言 X in Y | `npm run pl:scrape-docker -- --niche X --city Y --count 10` |
| 多引号 query | `npm run pl:places-search-intake -- --query "..." --query "..."` |
| 单商家 name+phone+city | `npm run pl:single-enrich -- --business-name "..." --phone ... --city ...` |
| 图片附件 | Hermes vision 先抽字段 → `npm run pl:ingest-image -- --business-name=... --phone=...` |

## Behavioral guidance

- ABN 是最强判重信号 · 找到必查
- 经纬度 < 50m 视为同店
- 8 个判重字段: ABN · place_id · 经纬度 · 电话 · 邮箱 · 域名 · 公司名 fuzzy · 地址
- 出口承诺: enrichment_status ∈ {complete, partial, unenrichable}
- 触发后 master.md 自动建档 (hook 在 discovery-store.js)
- 进入 phase=AWAITING · 等 audit pipeline 接

## Gotchas

- gosom 要 lat/lon (用 core/leads/geocode.js 前置 geocode)
- gosom 返回 "Status":"ok" 大写 (我们已 normalize)
- pl:single-enrich 当前不支持纯电话 / 纯 URL (textSearch 不索引电话号 · gbp-url 不解析)
  - V3.1 任务: 改用 web-search-first cascade

## 完成后

- entity_key 返回给操作员
- master.md 自动建（adb094e5 hook）
- Discord forum thread 在 #websites-leads 自动开（V3 新接入）
- Hermes kanban task created · status: triage → ready → done
```

---

## 4. master.md = 通用真相中枢

### 4.1 frontmatter 完整 schema (V3)

```yaml
# 身份
business_id: place_chij...           # 唯一 entityKey
business_name: ""
niche: ""
city: ""
abn: null                            # 8-key 之一
geo: { lat, lng }                    # 8-key 之一

# 联系
phone: ""
email: ""
website: ""

# 评分 (SOP-2)
audit_score: 73
investment_level: B                  # A/B/C/D
decision: redesign|upgrade|skip
fired_triggers: [low-mobile-score, old-design, ...]
review_count: 165
rating: 4.6

# 阶段 (V3 新加 · 同步到 Discord forum tag)
stage: outreach-active
stage_history:
  - { stage: discovered, at: 2026-05-13, source: gosom-cairns }
  - { stage: audited-B, at: 2026-05-14, score: 73 }
  - { stage: outreach-active, at: 2026-05-15, channel: email }

# Discord 视图
discord_entity_thread_id: "1503..."  # 这商家主页 thread
hermes_kanban_task_id: "task_..."    # 本 entity 对应 kanban task

# 通讯日志 (V3 新加)
contact_log:
  - { channel: email, at: 2026-05-15, template: 'outreach-v3', status: delivered }
  - { channel: sms, at: 2026-05-17, template: 'followup-1', status: delivered }
  - { channel: email, at: 2026-05-20, type: reply, intent: interested, summary: '想看 demo' }

# Demo (V3 新加)
design_preview:
  url: https://preview.profitslocal.com/<slug>
  generated_at: 2026-05-22
  open_design_run_id: "od_..."

# 提案 (V3 新加)
proposal:
  sent_at: 2026-05-25
  pdf_url: cloudinary://...
  amount: AUD 1980        # 用新价 schema ($399/$799/$1000+)
  paid_at: null
  payment_method: stripe

# 下一步动作 (V3 新加 · Hermes cron 读这个)
next_action:
  what: "wait for proposal reply · re-engage in 5 days"
  due_at: 2026-05-30
  owner: hermes-auto

# 产物清单
assets:
  cloudinary_folder: ""
  evidence_count: 0
  video_url: null
```

### 4.2 谁能写 master.md (写者分工)

| 写者 | 写哪些字段 | trigger |
|---|---|---|
| `pl:single-enrich` 等 SOP-1 CLI | business_*, identifiers, geo, contact | entity 入库时 |
| `leads:run-pipeline` SOP-2 audit | audit_score, decision, investment_level, fired_triggers | audit 跑完 |
| `pl:set-stage` (V3 新 CLI) | stage, stage_history | phase 转换时 |
| `pl:log-contact` (V3 新 CLI) | contact_log[] | 每次通讯发送 / 接收 |
| `open-design:port-handoff` | design_preview | OD 出图后 |
| `pl:generate-proposal` (V3 新 CLI) | proposal | 提案生成 |
| Stripe webhook | proposal.paid_at, payment_method | 收款后 |
| Hermes cron `daily-tick` | next_action | 每日扫漏斗 |

### 4.3 master.md 怎么驱动一切

```
master.md.frontmatter.stage == "audited-B"
    +
master.md.frontmatter.contact_log == []
    ↓ Hermes cron 看到这个组合
    ↓ skill profitslocal-outreach trigger
    ↓ 选 template-v3-redesign
    ↓ agentic email send
    ↓ 写 contact_log[] + next_action
    ↓ Discord thread 翻 tag → outreach-active
```

---

## 5. Discord forum kanban ↔ Hermes board 同步桥

### 5.1 设计原则

**Discord 是 view · Hermes board 是 state · master.md 是 truth**

- Discord forum thread = 一商家一个（在 `#websites-leads`）
- Hermes kanban task = 一商家一个 task（per-customer board · `pl-<entityKey>`）
- master.md = 一商家一个 .md 文件（`clients/<slug>/v2/master.md`）

三者通过 `entityKey` 关联。

### 5.2 同步事件

| 事件 | Discord 反应 | Hermes kanban 反应 | master.md 反应 |
|---|---|---|---|
| 新 entity 入库 | 在 `#websites-leads` 开 thread + tag `discovered` | 在 `pl-<entityKey>` board create task | 自动 build (已实装) |
| audit 完 grade B | thread tag 翻 `audited-B` | task move triage → ready | refresh (已实装) |
| 操作员 ✅ reaction "approve outreach" | thread tag 翻 `outreach-active` | task claim by outreacher profile | log_contact append |
| 发出 email | reply 到 thread "📧 email sent" | task progress event | log_contact append |
| 收到 reply (positive) | thread reply "💬 客户回了 · 'interested'" | task move to "ready for proposal" | log_contact + next_action |
| 提案 paid | thread tag 翻 `paid` | task complete | proposal.paid_at |

### 5.3 实施方式

```javascript
// 旧:  SOP-0 listener routes Discord → 自造 task-store
// V3:  SOP-0 listener routes Discord → hermes kanban create

// pseudo-code
discord.on('threadCreate', async (thread) => {
  const route = await routeIntent(thread.text);
  await execAsync('hermes', [
    'kanban', 'create',
    '--skill', `profitslocal-${route.kind}`,
    '--body', thread.text,
    '--idempotency-key', `discord-${thread.id}`,
    '--assignee', 'website-agent',
    '--json',
  ]);
  // Hermes 内部 dispatch · 跑完 notify-subscribe 回帖 thread
});

// Hermes notify-subscribe 触发 Discord 回帖 + forum tag swap
hermes.on('kanban.task.complete', async (task) => {
  if (task.metadata.discord_thread_id) {
    await postReply(task.metadata.discord_thread_id, formatResult(task));
    await patchThreadTag(task.metadata.discord_thread_id, task.metadata.stage);
  }
});
```

---

## 6. Cloudflare 迁移可行性

### 6.1 现在已在 CF 上跑

```
functions/api/*.ts (15 个 Cloudflare Workers · 部署在 CF Pages):
  - stripe-webhook · tally-webhook · intake-submit · contact
  - domain-request · domain-status · create-checkout-session
  - approval-request · revision-submit · outreach-provider-event
  - _agent-dispatch · admin/lead-note · admin/lead-queue-action · admin/_middleware

src/pages/admin/* (Astro SSG · 部署在 CF Pages):
  - admin/scoring/* · admin/tasks · admin/cron · admin/leads-live ...
```

### 6.2 可迁但还没迁

| 当前本机 | CF 可迁? | 怎么迁 |
|---|---|---|
| `pl:single-enrich` · `pl:places-search-intake` | ✅ YES | Worker · Places API HTTP 调用 |
| master.md builder | ✅ YES | Worker + R2 (entity 存 D1) |
| dedup-detector 8-key | ✅ YES (规则计算 · 无外部依赖) | Worker · 调 D1 query |
| 评分 / lead-grading | ✅ YES | Worker · 纯规则 |
| AI dedup decider | ✅ YES | Worker 调 Anthropic API (不用本地 ollama) |
| 5-通道 enrichment | ✅ YES → 干脆删 | 改用 Hermes web search 或 dokobot |

### 6.3 不能迁 (本机长跑)

| 必须本机 | 原因 |
|---|---|
| `pl:scrape-docker` (gosom container) | CF Worker 不能跑 Docker / 50ms CPU 限制 |
| Audit pipeline (PSI + visual + ...) | 1-3 分钟单 lead · Worker 30s 上限 |
| Open Design app | 长跑 GUI app |
| Hermes Agent gateway | 自托管 daemon |
| Discord listener daemon | WS 长连接 |
| Ollama LLM | 本地 |

### 6.4 V3 推荐 (新数据从入库就放 CF)

```
新 entity 路径:
  Discord trigger → SOP-0 listener (本机)
     ↓ hermes kanban create
  Hermes (本机) dispatch task
     ↓ Hermes 直接调 CF Workers HTTP API
  CF Worker: pl-api-intake.ts
     ↓ POST Places API
     ↓ 写 D1 (entity store · 替代 data/leads/entities)
     ↓ R2 写 master.md
     ↓ 通知本机 (gosom 长跑) 异步抓 gosom
  本机 gosom 完 → POST 回 CF Worker → D1 update + master.md refresh
  Admin UI 直接读 CF D1 → 不再依赖本机
```

**好处**: 本机停机 admin 仍可用 · 多机协作 · 全自动 backup

**坏处**: 多一层 API · 调试稍复杂

**判断**: V3 中期做 · V3 初期先用 hermes kanban 解掉 60% 重造问题 · CF 迁移作为 V3.2

---

## 7. V3 销售 pipeline 闭环设计

### 7.1 漏斗 + 自动 trigger 全图 (V3 目标)

```
┌── INTAKE ───────────────────────────────────────────────────┐
│  Source: gosom / Places API / single-enrich / image         │
│  Output: phase=AWAITING, master.md created                  │
│  Discord tag: discovered                                    │
└────────────────────┬────────────────────────────────────────┘
                     ↓ 自动 (audit cron · daily)
┌── AUDIT ────────────────────────────────────────────────────┐
│  leads:run-pipeline · 12 维 audit                           │
│  Output: grade A/B/C/D · phase=AWAITING                     │
│  Discord tag: audited-A / audited-B / audited-C / audited-D │
└────────────────────┬────────────────────────────────────────┘
                     ↓ 自动 (grade-based)
        ┌────────────┼────────────┬─────────────┐
        ↓ grade A    ↓ grade B    ↓ grade C    ↓ grade D
   ┌────────┐  ┌─────────┐  ┌──────────┐  ┌──────────┐
   │ 个性化 │  │ 批量    │  │ 模板邮件 │  │ 跳过 6mo │
   │ 全攻   │  │ 试探    │  │ 无跟进   │  │ 重启     │
   │ + 电话 │  │ outreach│  │ (V3 实装)│  │          │
   └───┬────┘  └────┬────┘  └────┬─────┘  └──────────┘
       ↓            ↓            ↓
   phase=OUTREACH_ACTIVE
   Discord tag: outreach-active
       ↓ 等回复 (5 day timeout · daily cron 监督)
       ↓
   ┌──────────┬───────────┬────────────┬───────────────┐
   ↓ replied  ↓ silent    ↓ unsubscribe ↓ bounced       
   ┌──────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
   │ DEMO │  │ followup │  │ ARCHIVED │  │ try alt   │
   │ phase│  │ SMS/voice│  │          │  │ contact  │
   └──┬───┘  └────┬─────┘  └──────────┘  └──────────┘
      ↓           ↓
   send preview   ↓
   URL via email  ↓ second silent → NURTURE
      ↓
   phase=PROPOSAL_SENT (V3 自动 trigger · 当前 0)
   Discord tag: proposal
      ↓ Stripe paid webhook
   phase=PAID (V3 自动 trigger · 当前 0)
   Discord tag: paid
      ↓ Open Design + publish
   client live · master.md.paid_at set
```

### 7.2 当前漏斗 vs V3 目标

| 阶段 | 当前自动率 | V3 目标 | 缺什么 |
|---|---|---|---|
| INTAKE → entity | ~80% (有 bug L-1) | 100% | 修 listener intake niche/city 抽取 |
| AUDIT 自动 trigger | 0% (manual `--all-with-detailed`) | 100% | cron 扫 AWAITING + new → run audit |
| Grade → outreach 自动 | 0% (manual) | 100% (grade A/B) | cron 扫 audited-A/B + 没 contact → trigger outreach |
| Email send 真发 | 0% (default dry-run) | 100% | 配 CF Access token · agentic email reply 监听 |
| Follow-up 重发 | 0% | 80% (3-day cron) | 加 cron schedule + 模板 |
| Reply classify | 100% (12 类 · regex+ollama) | 保留 | (已成熟 · 改用 Claude API 更准) |
| PROPOSAL_SENT trigger | 0% | 80% (Hermes cron + cal.com booking → trigger) | 加 reply→proposal 自动 chain |
| PAID trigger | 0% | 100% (Stripe webhook 已有) | 把 webhook 链到 phase 转换 |

### 7.3 7-stage Discord forum tag set (V3)

```
phase           Discord forum tag        触发 + 持续
─────────────────────────────────────────────────────────────
AWAITING        🆕 discovered            entity 入库后
                🟦 audited-A             grade A
                🟦 audited-B             grade B
                🟦 audited-C             grade C (轻触)
                ⬛ audited-D             跳过
OUTREACH_ACTIVE 📧 outreach-active       发了第 1 通邮件
REPLIED         💬 replied                客户回了
                💬 replied-positive
                💬 replied-negative
                💬 replied-question
PROPOSAL_SENT   📝 proposal              demo + 报价发出
NURTURE         🌱 nurture                沉默 30 天 / 拒绝 (软)
PAID            ✅ paid                   Stripe webhook
ARCHIVED        ⬛ archived               不发任何东西 / unsubscribe
NEEDS_HUMAN     ⚠️ needs-human            异常 · ping Matthew
```

---

## 8. V3 执行计划 · 12 天

| 阶段 | 工时 | 内容 | 产出 |
|---|---|---|---|
| **D0-D1** | 2 天 | **Hermes kanban 集成基础** | 1 board / 1 task 真跑通 |
| · 写 `skills/profitslocal-master/SKILL.md` (入口路由) | 0.5 | skill 描述 8 个 sub-skill | |
| · 写 `skills/profitslocal-intake/SKILL.md` (4 入口) | 0.5 | LLM 知道怎么调 SOP-1 CLI | |
| · 改 SOP-0 listener → `hermes kanban create` | 0.5 | 替换 task-store 调用 | |
| · 接 notify-subscribe → Discord forum 回帖 | 0.5 | 端到端跑通 1 case | |
| **D2-D3** | 2 天 | **master.md frontmatter 升级 + 链同步** | 完整 V3 schema |
| · master.md schema 扩 (stage_history / contact_log / proposal / next_action) | 1 | build-master-md 支持新字段 | |
| · 写 `pl:set-stage` + `pl:log-contact` CLI | 0.5 | 标准 API 改 master.md | |
| · Discord forum tag ↔ master.md.stage 双向 sync | 0.5 | 一处改另一处自动跟 | |
| **D4** | 1 天 | **打开 audit 漏斗 · 让 96 个 queued_for_audit 流动** | 96 → 0 |
| · 加 `hermes cron` 每日扫 AWAITING + grade=null · auto trigger audit | 0.5 | cron job | |
| · 修 audit pipeline 已知 bug | 0.5 | | |
| **D5-D6** | 2 天 | **Open Design 大砍 · 替代 run-concept.js 1431 行** | -1300 LOC |
| · 写 `skills/profitslocal-design/SKILL.md` | 0.5 | Hermes 知道怎么用 OD HTTP API | |
| · 写薄包装 (~100 LOC) 替代 SSE 流处理 | 1 | run-concept.js 退役 | |
| · 改 publish 路径用 wrangler pages deploy | 0.5 | 替代 GH repo bootstrap | |
| **D7-D8** | 2 天 | **闭环 outreach 通讯** | 真发邮件 + reply 真接 |
| · 配 CF Access token · `pl:email-send` 出 dry-run | 0.5 | 真发 | |
| · agentic email reply 监听 → webhook → hermes kanban | 0.5 | reply 端到端 | |
| · Termux:API SMS 接 (Android 真 SIM) | 1 | SMS 通道 | |
| **D9** | 1 天 | **C-grade 批量轻触 + follow-up 自动** | 批量发实装 |
| · `pl:c-grade-batch-send` 实装 | 0.5 | 已设计但没实装的批量轻触 | |
| · cron 每 3 天扫 outreach-active 沉默 · 自动 follow-up | 0.5 | | |
| **D10** | 1 天 | **PROPOSAL_SENT + PAID 自动 trigger** | 0 trigger → 自动 |
| · Stripe webhook 链 phase=PAID | 0.5 | | |
| · reply-positive + cal.com booking → trigger proposal generation | 0.5 | | |
| **D11** | 1 天 | **Cal.com + Vapi 接通** | A-grade 真打 1 通 AI 电话 |
| · Cal.com webhook + skill | 0.5 | | |
| · Vapi 接 + ACMA 合规检查 + 1 通真电话 | 0.5 | | |
| **D12** | 1 天 | **Insights + 监控 + V3 doc 发布** | 100% 上线 |
| · `hermes insights` 接 admin 财务视图 | 0.5 | 30 天 cost 透明 | |
| · V3 跑 1 个真完整 case (新 lead → 真签约 of test pseudo-customer) | 0.5 | | |

**总: 12 天** · 砍 ~3000 LOC · 加 ~1000 LOC (skill body + Hermes 集成)

---

## 9. V3 风险 + 决策点

### 9.1 风险

| 风险 | 缓解 |
|---|---|
| Hermes kanban 接 Discord forum tag 跳了帧 | D0 第一天做 POC · 不跑通暂不删 SOP-0 |
| Open Design HTTP API 调不通 / 文档少 | D5 先小步试 1 个客户 · 通了再砍 run-concept |
| CF Access token + agentic email 之间认证 | D7 单独验证 1 小时再大改 |
| 96 个 queued_for_audit 跑起来后 Places 配额爆 | D4 加配额护栏 · 每天 50 个上限 |
| Termux:API 在 Android 失败 (权限 / 后台被杀) | 准备方案 B (KDE Connect) |
| Stripe webhook 配置 (CF Worker 已有) | 验已有 webhook 是否触 phase 转换 |

### 9.2 需要你决定

1. **认可 V3 总方向吗?** (Hermes kanban + master.md 中枢 + skill 化 + 砍 OD 包装)
2. **D0 先做哪个 POC?** Hermes kanban Discord 桥 / OD HTTP API 替代 / agentic email 真发 ←三选一
3. **96 个 queued_for_audit 现在跑吗?** 跑会消耗 ~$5 PSI / Places 配额 · 但漏斗才能流
4. **Open Design 大砍 (D5-D6) 你信心多少?** 我把 1431 LOC 砍掉 · 1 个 client 测试通过后再大批量改

---

## 10. 不做什么 (重要)

V3 期间**主动暂停**的工作：
- ❌ 修 L-1 / L-2 listener routing bug → skill 化后这俩自动消失
- ❌ 修 single-enrich phone-only / URL · 改 web-search-first → 等 V3.1 (Hermes skill 路由后就不疼)
- ❌ vision OCR ollama 3 模型 cascade → Hermes Claude vision 替
- ❌ admin 页继续打磨 → V3 期间 admin 改读 hermes kanban + master.md · 老 admin 砍 50%
- ❌ 新写 SOP doc · 现有 doc 等 V3 跑通后一次性同步

V3 期间**继续维护**的工作：
- ✅ SOP-0 daily health ping (已在 Hermes cron)
- ✅ Discord forum tag UX (这是核心 UX)
- ✅ master.md 早建 + 自动 refresh (已实装)
- ✅ 4 入口注册表 (已实装)

---

## 11. 长远 (V3 后 · V4 候选)

- 多客户 SaaS 化 (一客户一 Hermes profile · 多机协作)
- B2B 客户 self-service portal (CF Pages + D1 状态)
- 客户网站后续 A/B 测试自动化
- 自动化销售内容生成 (基于 master.md.audit + 行业模板)
- Open Design 反向贡献 (我们 fork 的有用改动 → upstream)

---

**V3 设计完成 · 等你拍板**
