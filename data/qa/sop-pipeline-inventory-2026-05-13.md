# 销售 Pipeline + 分级 现状盘点

生成时间: 2026-05-13 · evidence-based 盘点 (非记忆) · 仅关注 sales / pipeline / lead 分级，不重复 SOP-0 task infra。

## 概览

- **总 entity 数**: 192 (data/leads/entities/*.json)
- **当前 phase 分布** (V2 lifecycle):
  - `(none)` = 188 (绝大多数仍未跑过 grading-pipeline 或仅 status)
  - `outreach-active` = 1
  - `replied` = 1
  - `needs-human` = 1
  - `awaiting` = 1
  - `proposal-sent` / `nurture` / `paid` / `archived` = **0** (从未触发过)
- **当前 grade 分布** (`entity.grade.investment_level`):
  - `(none)` = 181
  - `A` = 4 · `B` = 4 · `C` = 1 · `D` = 2
- **legacy status 分布** (sop-1 老 funnel):
  - `queued_for_audit` = 96 · `skipped` = 59 · `manual_review` = 17 · `ready_for_outreach_brief` = 8 · `graded` = 5 · `promoted` = 4 · `scored` = 3

结论: V2 grading + phase 系统**已实装但渗透率极低** (11/192 = 5.7% 有 grade · 4/192 = 2.1% 有 phase)。绝大多数 entity 还停在老 status 体系。

---

## A. Grade A/B/C/D 机制

### 计算入口 — `core/scoring/lead-grading.js:244` `gradeLead(ctx)`

输入 `ctx` 必备字段:
- `entity` (含 `latest.review_count`, `latest.rating`, `latest.categories`, `latest.websiteStatus`)
- `detailedAudit` (含 `decision`, `audit_score`, `hard_triggers`)
- `cheapAudit` (`relevance_pass`, `action`, `fired_triggers`)
- `techStack` (`sophistication_score`, `has_paid_ads_evidence`, `has_measurement`)
- `sitemapAnalysis.total_urls`
- `activity` (`days_since_newest_blog`, `social_links`, `blog_section_present`)
- `domainHistory.recent_redesign_signal`
- `reviewAnalysis.trust_signal_strength`
- `businessSizeSignal.tier`

### 算法 (cascade — first match wins)

**Hard skip → D** (`lead-grading.js:30-87`, 8 条规则):
1. `niche_mismatch` — detailed_audit / cheap_audit hard_trigger
2. `recent_redesign` — Wayback 信号 12 个月内重做过
3. `enterprise_size` — businessSizeSignal.tier === 'enterprise'
4. `too_many_pages` — sitemap.total_urls > 200
5. `too_many_categories` — categories.length ≥ 5
6. `relevance_fail` — cheapAudit.relevance_pass === false
7. `fully_managed` — 活跃 blog ≤ 30d + 3+ socials + 投广告 + 有分析 + sophistication ≥ 4
8. `not_qualified_decision` — detailed_audit.decision === 'not_qualified'

**非跳过 → 投资等级** (`classifyInvestment` @ `lead-grading.js:91`):
- `decision='strong_redesign'` + reviews ≥30 + rating ≥3.5 → **A**
- `decision='strong_redesign'` 但口碑薄 → **B**
- `decision='starter_candidate'` + reviews ≥30 → **B**
- `decision='starter_candidate'` 口碑薄 → **C**
- `decision='moderate_candidate'` + reviews ≥30 + audit_score <75 → **B**
- 其他 moderate / low_priority / 未知 → **C**

**产品 tier** (`recommendProductTier` @ `lead-grading.js:150`, 仅对 A/B 计算):
- T1 ($399 一次性) — 简单业务: reviews<30 / 无网站 / sitemap<15 / 单分类 / sophistication<2
- T2 ($799/年) — 默认中等档
- T3 ($1000+ 定制) — reviews≥100 ★≥4.3 + 投过广告 + sophistication≥4 + Blog 缺失/停滞

### 写入入口 — `persistLeadGrade` @ `lead-grading.js:291-363`

副作用 (执行顺序):
1. 写 `entity.grade = { investment_level, product_tier, recommended_pricing, skip_reasons, graded_at }`
2. 调 `updateDiscoveryEntityStatus` — D → status=`skipped`，A/B/C → status=`graded`
3. 调 `setEntityPhase`:
   - D → `ENTITY_PHASE.ARCHIVED` (含 archive_reason)
   - A/B → `ENTITY_PHASE.AWAITING`
   - C → **不设 phase** (`lead-grading.js:325-345`，C 走批量轻触不进 per-lead thread)
4. 异步触发 `openLeadThread(entityKey)` (仅 A/B，受 `SKIP_LEAD_THREAD_OPEN` env 控制)

**唯一调用方**: `scripts/leads/run-audit-pipeline.js:190` (Stage 3a) + `scripts/leads/migrate-grade-fields.js`

### Grade 读取分支 (downstream branching)

| File:line | 读取方式 | 分支动作 |
|---|---|---|
| `core/outreach/email-body-generator.js:71-75` | `entity.grade?.investment_level` | A → tier='T3' (sonnet) · B/C → 'T1' (haiku) |
| `core/funnel/lead-thread-sync.js:60-65` | level === 'A'/'B'/'C' | 加 forum tag grade-a / grade-b / grade-c |
| `scripts/leads/build-internal-report.js:119-122` | `!['A','B']` | C/D **跳过 review fetch** (省钱) |
| `scripts/leads/build-internal-report.js:167-169` | `!['A','B']` | C/D 跳过 GBP extras |
| `scripts/cli/pl-reply-poll.js:64` | `grade.investment_level !== 'D'` | D 不进 reply matching pool |
| `scripts/cli/pl-context.js` | level === 'D'/'A'/'B' | D=auto-archive 提示, A=主动出, B=等位 |
| `core/funnel/hermes-cron.js:36` | grade === 'A' | A: 'every 4h' cron, 否则 'every 12h' |
| `core/leads/niche-cohort.js:83` | grade.investment_level || 'ungraded' | niche 分桶 |

### 每 grade 下游动作 (actual code)

- **A 全攻** — 强口碑 + redesign 信号:
  - 进 phase=AWAITING · 自动开 Discord forum post + tag `grade-a`
  - `email-body-generator`: 用 Claude Sonnet 生成 personalized 邮件
  - `build-internal-report`: 跑完整 review + GBP extras
  - `hermes-cron`: 'every 4h' 心跳 (registerLeadCron @ hermes-cron.js:31)
  - `lead-grading.js:234`: "跑完整 Open Design redesign brief + personalized cold email + 报告/视频 + 3 次跟进"
- **B 预览试探** — phase=AWAITING + Sonnet/Haiku · 心跳 12h · 同 A 但分级稍弱
- **C 批量轻触** — **不设 phase · 不开 thread**。仅 status='graded'。无 cron。仅在客户回复后人工升级 (lead-thread-sync.js:62-65 注释)
- **D 跳过** — phase=ARCHIVED · status='skipped' · archive_reason 留下 hard_skip rule id

---

## B. 销售阶段流转

### 8 phases (`core/leads/discovery-store.js:56-65`)

| Phase | 字面值 | 意义 |
|---|---|---|
| AWAITING | `awaiting` | 已 grade A/B，等首次外联 |
| OUTREACH_ACTIVE | `outreach-active` | 邮件已发送，等回复 |
| REPLIED | `replied` | 客户回了 (interested / question / objection) |
| PROPOSAL_SENT | `proposal-sent` | **enum 存在但无自动 trigger** |
| NURTURE | `nurture` | 不是现在 (objection-timing / not-now)，等 nurture_due_at |
| PAID | `paid` | **enum 存在但无自动 trigger** |
| ARCHIVED | `archived` | D-grade / no_response_Nd / unsubscribe / no / bounced |
| NEEDS_HUMAN | `needs-human` | 回复模糊 (reply-classifier.class='unclear') |

### 转换图

```
   [grade]
      │
   ┌──┴──┬─────┬─────┐
   ▼     ▼     ▼     ▼
  D     A,B    C   (no grade)
  │     │     │
ARCHIVED AWAITING (no phase set)
          │
   pl:email-send (script)
          ▼
   OUTREACH_ACTIVE ───[no_response_Nd via pl:daily-tick]──▶ ARCHIVED
          │
          │ (pl:reply-poll · pl:reply-handle · outreach-provider-event reply)
          ▼
   classifyReply → playbook.recommended_phase
          │
     ┌────┼────┬─────────┬─────────┬─────────┐
     ▼    ▼    ▼         ▼         ▼         ▼
  REPLIED NURTURE ARCHIVED AWAITING NEEDS-HUMAN (no PAID, no PROPOSAL_SENT)
              │
              │ pl:daily-tick (nurture_due_at ≤ now)
              ▼
           AWAITING (loop)
```

### 触发器表 (file:line)

| Transition | Trigger | File:line |
|---|---|---|
| → AWAITING (initial, A/B) | `persistLeadGrade` | `core/scoring/lead-grading.js:337-344` |
| → ARCHIVED (D auto-skip) | `persistLeadGrade` | `core/scoring/lead-grading.js:330-336` |
| → OUTREACH_ACTIVE | `pl:email-send` | `scripts/cli/pl-email-send.js:85-89` |
| → ARCHIVED (no_response_Nd) | `pl:daily-tick` (cron) | `scripts/cli/pl-daily-tick.js:74-80` |
| NURTURE → AWAITING | `pl:daily-tick` (cron) | `scripts/cli/pl-daily-tick.js:49-54` |
| → REPLIED/NURTURE/ARCHIVED/etc | `pl:reply-handle` | `scripts/cli/pl-reply-handle.js:56-61` |
| 同上 (poll) | `pl:reply-poll` (cron) | `scripts/cli/pl-reply-poll.js:169-174` |
| 同上 (provider webhook) | `outreach-provider-event` | `core/funnel/outreach-provider-event.js:207-212` |
| → 任意 (manual) | `pl:advance` CLI | `scripts/cli/pl-advance.js:30-37` |

### Discord forum tag set (`data/discord/website-tasks-forum-tags.json`)

注意: 该 JSON 文件是 SOP-0 task forum tags (`website-tasks` channel)，**不是** lead forum。Lead forum 的 tag 集在代码里 (`core/funnel/discord.js:209-224`):

```
leads: grade-a, grade-b, grade-c, awaiting, outreach-active, replied,
       proposal-sent, nurture, paid, archived, needs-human,
       urgent, do-not-contact, nurture-due
```

14 个 tag · 通过 `syncDiscordForumTags` 同步到 channel `WEBSITE_LEADS_DISCORD_CHANNEL_ID`。

Phase 与 tag mapping @ `lead-thread-sync.js:55-69`: 阶段名 1:1 对应 tag 名。

---

## C. Outreach 现状

| 渠道 | 状态 | 模块 |
|---|---|---|
| **Email send** | 已实装但默认 dry-run | `core/integrations/agentic-inbox.js:58 sendOutbound()` · 走 mail.profitslocal.com Cloudflare worker · CF Access service token auth · 需要 `--no-dry-run` 标志开真发 (`pl-email-send.js:43`) |
| **Email draft** | 已实装 AI gen | `core/outreach/email-body-generator.js` · auto-pick Sonnet (A) / Haiku (B/C) / Ollama qwen3.5:9b (fallback) |
| **Email reply poll** | 已实装 | `pl-reply-poll.js` 拉 mail.profitslocal.com `/api/v1/mailboxes/{id}/emails?folder=inbox` · 5min cron · state @ `data/leads/reply-poll-state.json` |
| **SMS** | **无代码** | (grep 全 repo 无 twilio/sms 模块) |
| **Voice** | **无代码** | |
| **Reply webhook** | 部分实装 | `core/funnel/outreach-provider-event.js` 接收 webhook → 触发 reply 分类，但 Cloudflare worker 未推送入站 |

### Email 模板 (variants)

3 个 active variants @ `data/outreach/variants/`:
- `v_2026-05_audit-led/` — audit findings 主导
- `v_2026-05_curiosity-led/` — 好奇心钩子
- `v_2026-05_pain-led/` — 痛点切入

Variant 选择 → `core/outreach/variant-picker.js`。Body 生成 → `email-body-generator.js`。

---

## D. 回复 + Nurture

### Reply handling

3 个入口共享同一 pipeline:
1. **`pl:reply-handle`** — 操作员手动粘贴回复文本
2. **`pl:reply-poll`** — Hermes 每 5min 拉 inbox
3. **`outreach-provider-event`** (`syncOutreachProviderEvent`) — 第三方 provider webhook (agentic-email/sales-flare 等)

共同流程:
1. `classifyReply(text)` @ `core/llm/reply-classifier.js:84` — regex 11 模式 → 12 classes
2. 模糊时 `classifyReplyWithFallback` → Ollama qwen3.5:9b (T0 免费) @ `reply-classifier.js:43`
3. `lookupPlaybook(class)` @ `core/sales/reply-playbook.js:88` → `recommended_phase` + `recommended_action` + `draft_prompt_outline`
4. `setEntityPhase` 推进
5. 异步: swap forum tag · 写 thread message · 更新 profile card

### Nurture / 重启 (`scripts/cli/pl-daily-tick.js`)

两个独立循环:
1. **Nurture revival** (lines 37-55): phase=`nurture` + `nurture_due_at` ≤ now → `awaiting`
2. **Outreach timeout** (lines 59-81): phase=`outreach-active` + `last_contact_at` > N天前 + 非 do_not_contact → `archived` with reason `no_response_${N}d`

默认 timeout = 21 天 (CLI `--timeout-days`). 注意: **没有 follow-up 自动重发** — 只有 archive。Follow-up 邮件需要操作员手动触发或被 Hermes 心跳 prompt 提议。

### Time-based scheduler

- Hermes cron 注册: `core/funnel/hermes-cron.js`
  - `registerLeadCron(entityKey, grade)` 创建 per-lead 心跳 (A='every 4h', B/C='every 12h')
  - 默认 paused (decision D3)
  - Prompt 让 Hermes 跑 `pl:context` → 自主决定 idle / draft / advance / archive
- 全局 cron: `pl:reply-poll` (5min)、`pl:daily-tick` (24h @ 09:00) — 都是 paused-by-default 设计

---

## E. 每阶段 IN/OUT 总览

| Stage | IN trigger | Action while in stage | OUT trigger |
|---|---|---|---|
| **AWAITING** | `persistLeadGrade` (A/B); `reply-playbook: wrong-person`; `pl:daily-tick` nurture revival; `pl:advance` | 等首次邮件 / Hermes 心跳建议 draft | `pl:email-send` → OUTREACH_ACTIVE |
| **OUTREACH_ACTIVE** | `pl:email-send` | 等回复 / follow-up draft (手动) | reply pipeline → REPLIED/NURTURE/ARCHIVED/NEEDS_HUMAN; `pl:daily-tick` 21d → ARCHIVED |
| **REPLIED** | reply playbook (interested / question / objection-price / objection-scope / referred) | 操作员/Hermes draft 回复 | 无自动 OUT；`pl:advance` 手动推 |
| **PROPOSAL_SENT** | **无自动 trigger** (仅 `pl:advance` 手动) | — | **未编码** |
| **NURTURE** | reply playbook (objection-timing / not-now) | 等 `nurture_due_at` | `pl:daily-tick` → AWAITING |
| **PAID** | **无自动 trigger** (仅 `pl:advance` 手动 — `pl-context.js:92` 提示 "Handoff to project flow") | — | **未编码**；理论上对接 `core/funnel/paid-intake-*.js` |
| **ARCHIVED** | D-grade auto; 21d timeout; reply (unsubscribe/no/bounced) | (immutable terminal — 但可 `pl:advance` 重启) | 无 |
| **NEEDS_HUMAN** | reply class=`unclear` | 等人 | `pl:advance` 手动 |

---

## F. Queues

| Queue file | Schema | 谁写 | 谁读 |
|---|---|---|---|
| `data/leads/queues/queues.json` | `{cheapSiteAudit:[], manualReview:[], outreachBrief:[], selectedEnrichment:[]}` aggregated per niche/status | `scripts/leads/discovery-store-report.js` · `rebuildDiscoveryIndex` | `npm run pl:list` · admin UI |
| `data/leads/queues/cheap-site-audit.json` | array of {entityKey, status, name, niche, website, discoveryScore, recommendedAction, ...} | discovery-store rebuild | `pl:run-enrichment-batch` · `scripts/leads/audit-discovery-sites.js` |
| `data/leads/queues/manual-review-triage.json` | 同上 schema · status='manual_review' | discovery-store | admin /admin/leads/queue UI |
| `data/leads/queues/outreach-brief.json` | 同上 schema · status='ready_for_outreach_brief' | discovery-store | `scripts/leads/build-discovery-outreach-briefs.js` |
| `data/leads/queues/selected-enrichment-plan.json` | enrichment plan rows | `scripts/leads/plan-discovery-enrichment.js` | `pl:run-enrichment-batch` |
| `data/leads/queues/selected-enrichment.json` | post-execution result rows | run-enrichment-batch | report |
| `data/leads/queue-operations.jsonl` | `{operationId, action, entityKey, status, command, ...}` event log | `core/funnel/queue-operations.js:appendQueueOperation` | admin operations history |

注意: queues 是**老 SOP-1 funnel** 的概念，按 `entity.status` 分桶。**V2 phase 不进 queues 文件** — V2 只读 entity.phase 直接查。两套系统并行。

---

## G. 客户文档 (per-stage artifacts)

| Artifact | 路径 | 谁建 | 何时建 | 实施状态 |
|---|---|---|---|---|
| **master.md** | `clients/<slug>/v2/master.md` · `public/audit-reports/<entityKey>/master.md` | `core/reports/master-md-builder.js` via `enqueueMasterMdRefreshBatch` | intake 入库时自动 (discovery-store.js:157-161) + audit pipeline 后 | ✅ 全自动 |
| **internal-audit-report.html** | `clients/<slug>/v2/internal-audit-report.html` · `public/audit-reports/<entityKey>/internal-audit-report.html` | `scripts/leads/build-internal-report.js` | run-audit-pipeline Stage 4 | ✅ 全自动 · grade C/D 跳过 reviews+GBP extras 省钱 |
| **master.report.html** | `clients/<slug>/v2/master.report.html` | huashu-md → html pipeline | master.md 后 | ✅ |
| **screenshots/** | `clients/<slug>/v2/screenshots/` | run-audit-pipeline visual stage | audit 时 | ✅ |
| **evidence/** | `clients/<slug>/v2/evidence/` | site-audit · enrichment | audit 时 | ✅ |
| **video/** | `clients/<slug>/v2/video/` | hyperframes pipeline | 手动 | 半自动 |
| **proposal.html / PDF** | (无) | — | — | ❌ **未实装** |
| **demo preview HTML** | template-library 内有原型 | template-mockup-handoff | A-grade only (理论) | 🟡 实装但无自动触发钩到 phase=PROPOSAL_SENT |

---

## H. Reply 意图分类

### Intent set (12 classes) — `core/sales/reply-playbook.js:10`

```
interested · question · objection-price · objection-timing · objection-scope
not-now · wrong-person · referred · unsubscribe · no · bounced · unclear
```

### 模型

- **Pass 1**: 11 个 regex 模式 @ `core/llm/reply-classifier.js:13-31`，每个带 confidence 0.7-0.99
- **Pass 2** (fallback): Ollama qwen3.5:9b (T0, 免费) — 仅当 regex `class='unclear'` 或 confidence<0.5 时触发 (lines 43-82)
- 输出: `{class, confidence, method, signal_excerpt, candidates}`
- Tie handling: 两个 top match 同 confidence 且 class 不同 → `unclear` (line 100)

### Playbook (12 entries · `reply-playbook.js:25-86`)

每个 class 映射:
- `recommended_phase` (8 phases 之一)
- `recommended_action` (字符串 ID e.g. `send_discovery_questions_or_calendly`, `reframe_value_or_offer_smaller_tier`)
- `draft_prompt_outline` (≤200 字 prompt 模板传给 Claude CLI 生成回复)

### "不感兴趣" 标记

- `unsubscribe` → ARCHIVED + `entity.do_not_contact=true` (playbook line 69)
- `no` → ARCHIVED with reason='no'
- `bounced` → ARCHIVED with reason='bounced' (理论会 fallback 到 backup_email，未实装)

---

## I. Gap 列表

### 实装但孤儿 (代码存在但无 trigger / 无 caller)

1. **`ENTITY_PHASE.PROPOSAL_SENT`** — enum 定义 + tag + lead-thread-sync 都支持，**但没有任何 code path setEntityPhase 到 'proposal-sent'**。仅 `pl:advance` 手动可触发。
2. **`ENTITY_PHASE.PAID`** — 同上。`pl-context.js:92` 写了 "Handoff to project flow"，但**没钩到** `core/funnel/paid-intake-*.js`。
3. **`bounced` reply class** — playbook 说 "check backup_email if present"，但 `pl-reply-handle.js` / `pl-reply-poll.js` 都没读 `entity.latest.backup_email` 重发逻辑。
4. **`urgent` tag** — 在 `lead-thread-sync.js:68` 读 `entity.urgent`，但**没有任何 code 写这个字段**。
5. **`sub_status`** — `setEntityPhase` 接收并写，`pl:advance --sub-status` 透传，但**没有 reader** branch on sub_status。

### Doc 写了但未实装

1. **Auto follow-up** — `pl:daily-tick` 只 archive，**不重发**。注释里没说"未来会做"，但需求显然存在。
2. **C-grade 批量轻触实际流程** — `lead-grading.js:236` 说 "标准模板邮件 + master.md PDF 链接"，但没找到 C-only batch send 的 CLI / function。`pl-pipeline-batch-*.js` 是 batch step runner，不是 C-grade 批量外联。
3. **Proposal 阶段** — phase=PROPOSAL_SENT 存在，但没有 proposal artifact 生成器、没有 send CLI、没有钩子从 REPLIED → PROPOSAL_SENT。

### 转换无自动 trigger (manual only via `pl:advance`)

- REPLIED → PROPOSAL_SENT (无 trigger)
- PROPOSAL_SENT → PAID (无 trigger)
- REPLIED → PAID (无 trigger)
- NEEDS_HUMAN → 任何 (无 trigger)
- ARCHIVED 反向 (没有 unarchive 自动逻辑)

### 第三方 stubbed 但未 wired

1. **Real email send** — `agentic-inbox.js sendOutbound` 完整实装，但 `pl-email-send.js:43` 默认 dry-run；需要 CF Access service token (`AGENTIC_INBOX_ACCESS_CLIENT_ID/SECRET`)。注释说 "real transport will be wired during Block 12 E2E"，未完成。
2. **Inbound webhook** — `outreach-provider-event.js` 接 webhook，但 mail.profitslocal.com worker 不推送入站事件 (pl-reply-poll.js comment line 4: "Pull-mode replacement for the (unimplemented) push webhook on inbound")。
3. **Hermes cron** — 全部默认 paused。`npm run cron:pl:enable` 未实装为 npm script (检查: package.json 无 `cron:pl:enable`)。
4. **SMS / Voice / WhatsApp** — 完全无代码。
5. **Calendly / 日历 booking** — playbook 提到 "offer Calendly"，无集成代码。

### Grade 覆盖率问题

- 192 个 entity 中只有 11 (5.7%) 有 grade — 因为 grading 只在 `run-audit-pipeline.js` Stage 3a 跑，绝大多数 entity 卡在前面 (`queued_for_audit`=96, `manual_review`=17, `skipped`=59)。
- 老 status 体系 (`STATUS_RANK` @ discovery-store.js:69) 与新 phase 体系**完全独立**，互不感知 (除了 `persistLeadGrade` 同时写两边)。

---

## 数据样本

5 个不同 phase / grade 的实际 JSON (核心字段):

```json
{
  "A grade · OUTREACH_ACTIVE": {
    "entityKey": "place_chij-9wdzxxakwsr-lljrd1u3jq",
    "name": "Queensland Roofing Pty Ltd",
    "phase": "outreach-active",
    "grade": {
      "investment_level": "A",
      "product_tier": "T2",
      "recommended_pricing": { "one_time": "$3-6K", "monthly": null },
      "skip_reasons": [],
      "graded_at": "2026-05-11T02:09:40.536Z"
    },
    "status": "queued_for_audit",
    "history_count": 8
  },
  "B grade · REPLIED · objection-price": {
    "entityKey": "place_chijl3ph8wbbkwsrlheky2pl5pm",
    "name": "Gutter and Roof Repairs",
    "phase": "replied",
    "grade": {
      "investment_level": "B",
      "product_tier": "T3",
      "recommended_pricing": { "one_time": "$5-8K", "monthly": "$800-1500/月" }
    },
    "signals": { "replied": 3 },
    "last_reply_class": "objection-price",
    "last_contact_at": "2026-05-11T07:11:58.152Z"
  },
  "C grade · (no phase)": {
    "entityKey": "place_chijwdbif2xzkwsrru6lkmu2l0o",
    "name": "Brisbane Roof Restoration Experts",
    "phase": null,
    "grade": {
      "investment_level": "C",
      "product_tier": null,
      "recommended_pricing": null,
      "skip_reasons": []
    },
    "status": "queued_for_audit"
  },
  "D grade · ARCHIVED (auto-skip)": {
    "entityKey": "place_chija7rmbn38k2srv29x1ubwqmg",
    "name": "Roof Space Renovators",
    "phase": "archived",
    "grade": {
      "investment_level": "D",
      "skip_reasons": [
        { "id": "too_many_pages", "reason": "现有网站超过 200 页 — 迁移成本失控" }
      ]
    },
    "status": "skipped"
  },
  "(no grade) · status=queued_for_audit": {
    "name": "(181 entities like this — 老 funnel 卡在 audit 前)",
    "phase": null,
    "grade": null,
    "status": "queued_for_audit"
  }
}
```

(注: 价格字段在 entity 内仍是旧版 $3-6K / $5-8K — `lead-grading.js` 已升级为 $399/$799/$1000+ 2026-05-11 锁，但持久化数据未 migrate。需要 `migrate-grade-fields.js` 或重跑 audit pipeline 才会更新。)

---

## 关键文件索引 (绝对路径)

```
/Users/matthew/Developer/google-map-website/
├── core/scoring/lead-grading.js           [407 lines] grade 计算 + persist
├── core/leads/discovery-store.js          [560+ lines] entity store + setEntityPhase
├── core/sales/reply-playbook.js           [91 lines]  12 reply classes → action
├── core/llm/reply-classifier.js           [119 lines] regex + Ollama 分类
├── core/outreach/email-body-generator.js  [129+ lines] AI email gen
├── core/integrations/agentic-inbox.js     [128 lines] sendOutbound CF worker
├── core/funnel/outreach-provider-event.js [347 lines] webhook → reply pipeline
├── core/funnel/lead-thread-sync.js        [249 lines] Discord forum sync
├── core/funnel/hermes-cron.js             [89 lines]  per-lead cron register
├── core/funnel/queue-operations.js        [69 lines]  老 funnel queue ops
├── core/funnel/discord.js                 [600+ lines, line 209 leads blueprint]
├── core/leads/outreach-brief.js           [183 lines] 老 SOP-1 brief (legacy)
├── scripts/cli/pl-advance.js              手动 phase advance
├── scripts/cli/pl-email-draft.js          AI 草稿
├── scripts/cli/pl-email-send.js           发送 + → OUTREACH_ACTIVE
├── scripts/cli/pl-reply-handle.js         手动 reply 处理
├── scripts/cli/pl-reply-poll.js           cron 拉 inbox
├── scripts/cli/pl-daily-tick.js           cron nurture + timeout
├── scripts/cli/pl-context.js              pl:context 状态摘要
├── scripts/leads/run-audit-pipeline.js    Stage 3a = gradeLead + persist
└── data/leads/entities/*.json             192 entity 状态
```
