# Discord-first 销售推进 + Outreach 反馈闭环 PRD

更新日期：2026-05-11
作者：与 Matthew 7 轮迭代后定稿

> 这份 PRD 描述 V2 阶段的第二件大事：把销售推进面从 admin UI 迁到 Discord forum，并把 cold outreach 接入 TrackLayer 形成 autoresearch 反馈闭环。第一件大事（lead audit + grading）见 [V2_UPGRADE_PLAN.md](V2_UPGRADE_PLAN.md)。
> 任务列表见 [DISCORD_OUTREACH_TASKS.md](DISCORD_OUTREACH_TASKS.md)。

## 1. 背景

V2 audit + grading pipeline 已能把 lead 自动评为 A/B/C/D。问题是：**graded 之后怎么推进**没有系统化答案。当前依赖 admin UI 手动操作，但 Matthew 实际工作流主要在 Discord，admin 翻找半天才能拿全 context。

同时，cold outreach 的"哪个 sequence 有效"完全靠经验。已存在的两个基础设施未被 V2 链路调用：

- **agentic-inbox-profitslocal**（`mail.profitslocal.com`，Cloudflare）：自建 AI inbox，send/receive/follow-up 完整，webhook 已配到 profitslocal
- **TrackLayer**（`tl.fengtalk.ai`，Cloudflare）：完整 outbound 信号链，含 `evaluate_and_improve` 端点直接输出 `{decision, key_findings, improvement_plan, ab_test_plan}` 决策合约

## 2. 目标

1. **每个 grade=A/B lead 自动成为 Discord forum 的一个 thread**，thread 顶有 always-fresh profile card，包含联系人、时区当前时间、所有 asset 链接
2. **状态推进发生在 Discord，admin 退为只读看板**。Hermes agent 每 4-12h 心跳读 thread → 提议下一步 → Matthew ✅ → skill 执行
3. **Cold outreach 走 variant 实验体系**：每封外发邮件挂载 variant_id，TrackLayer 收 open/click/visit/engage/reply/paid 信号，每周 LLM 调 `evaluate_and_improve` 输出 AB test plan
4. **客户 asset 走 manifest 模型**：未来加视频、PPT、参考案例无需改 schema

## 3. 范围

### 在范围
- A/B lead Discord forum thread 自动开 + tag 双向同步
- Profile card 钉顶 + 16 字段实时维护
- 8 阶段 lifecycle phase + 12 类 reply class
- Asset manifest（screenshot/video/presentation/document/reference/report 6 类）
- Hermes skill `profitslocal-lead-ops` + 4h/12h 心跳 cron（dev 期 pause）
- agentic-inbox 用现有路径发送 cold email（**不接 TrackLayer**，本期只发，不追踪）
- Variant registry（本地 JSON），picker 走 round-robin；hypothesis 由 Claude/Codex CLI 自动生成
- Reply 入站：保留现有 GitHub Action 路径处理回信 → reply-classifier → entity + Discord
- locale/timezone 字段（澳洲 20 城 hardcode）

### 不在范围（明确推迟）
- **整套 outreach 追踪信号链（open/click/visit/engage）** — TrackLayer 是 fengtalk 体系产物，本期不集成。后期需要时 fork [tracklayer-panel](https://github.com/matthew6688/tracklayer-panel) 改造一份 profitslocal 专版
- **autoresearch 反馈闭环（evaluate_and_improve）** — 没有信号就没有数据可分析，与上一条同时延期
- 自定义短域名 `track.profitslocal.com`
- Openclaw 集成
- SMS 链路
- 多国 timezone 表（澳洲之外）
- agentic-inbox UI 改造
- admin UI 重构（仅做只读对齐）
- 数据 backfill（全是测试数据）

## 4. 用户故事（决定性的工作流）

### 4.1 Matthew 早上看 Discord
打开 `website-leads` forum，27 个 post 按 tag 过滤：
- 点 `grade-a` + `awaiting-action`：3 个新 lead 等他决定首封邮件
- 点 `replied`：2 个 lead 客户回信了，agent 已起草回应
- 点 `urgent`：1 个 lead AI 觉得需要他手动决策

每个 thread 顶 profile card 让他不用滚动就看到电话、邮件、当前客户本地时间、上次联系 N 天前、已发邮件数。

### 4.2 推进单条 lead
打开 thread → 看 agent 起草的邮件 → 按 `✅` → skill 调 agentic-inbox 实发 → TrackLayer 包好链接 + pixel → entity.phase=outreach-sent → tag swap → thread append "📤 sent variant=v_audit-led at 14:32 AEST"。

### 4.3 客户回信
TrackLayer inbox worker 检测到回信 → webhook → reply-classifier 分类 `question` → entity.last_reply_class 更新 → profile card 重渲 → thread append "💬 reply (class=question): 客户问价格" → Hermes 心跳触发 → agent 起草含 master.md 引用的回应。

### 4.4 每周一早晨
`#outreach-experiments` 频道出现一条 embed：
> **v_audit-led 周报 (5/4-5/11)**
> Decision: **expand**
> Key findings: grade-a 回复率 18%（vs v_pain-led 12%）; restaurant niche 显著弱于 roofing
> AB test plan: 提议 v_audit-led_restaurant_variant 改用更口语化开场 [✅ Register]

Matthew 按 ✅ → 新 variant 注册到 profitslocal + TrackLayer，下一封 restaurant 邮件就会被 picker 选中。

## 5. 架构

```
┌────────────────────────────────────────────────────────────────┐
│ profitslocal (Node, this repo)                                 │
│   • persistLeadGrade → openLeadThread + register cron          │
│   • setEntityPhase → swap forum tag + append thread + edit card│
│   • pl:email-draft → pick variant → emit to agentic-inbox      │
│   • /api/outreach-provider-event ← TrackLayer webhook ingest   │
└─────┬──────────────────────────────────┬───────────────────────┘
      │ send                              │ webhook
      ▼                                   ▲
┌─────────────────────────────┐    ┌──────────────────────────┐
│ agentic-inbox-profitslocal  │    │ TrackLayer               │
│ (Cloudflare)                │    │ (Cloudflare)             │
│ • wrap links via TrackLayer │───▶│ • pixel/redirect/beacon  │
│ • inject pixel              │    │ • inbox (catch reply)    │
│ • send via Email Service    │    │ • evaluate_and_improve   │
└─────────────────────────────┘    └──────────────────────────┘
      │                                   │
      └────────────────────────────────────┘
                   (Cloudflare network)

           ┌──────────────────────────────────┐
           │ Hermes Agent (website-agent)     │
           │ • skill: profitslocal-lead-ops   │
           │ • cron: lead-<entityKey> (4/12h) │
           │ • cron: pl-weekly-eval           │
           └──────────────────────────────────┘
```

## 6. 数据模型变更

### 6.1 entity 新增字段（在已有结构上 patch，不破坏旧字段）
```
entity.phase                       ← 8 lifecycle phase 之一
entity.sub_status                  ← 可选细分（如 follow-up-1）
entity.archive_reason              ← phase=archived 时填
entity.phaseChangedAt              ← ISO，phase 上次变化
entity.discord_thread_id           ← A/B grade 落地时写入
entity.discord_profile_message_id  ← 首条 profile card 消息 id
entity.discord_thread_opened_at    ← ISO
entity.tracklayer_contact_id       ← 推迟 — TrackLayer 集成后写入
entity.locale.country              ← AU
entity.locale.timezone             ← Australia/Brisbane
entity.locale.language             ← en-AU
entity.signals.sent                ← 出站发件次数（pl:email-send 增）
entity.signals.replied             ← 入站回信次数（pl:reply-poll 增）
entity.signals.{opened,clicked,visited,engaged,unsubscribed}  ← TrackLayer 集成后填
entity.outbound_message_ids[]      ← pl:email-send 成功后追加（用于 reply 匹配）
entity.inbound_message_ids[]       ← pl:reply-poll 处理后追加（去重）
entity.last_contact_at             ← ISO（出/入站皆更新）
entity.last_sent_variant_id        ← 最近用的 variant id
entity.last_reply_class            ← 12 类之一
entity.last_reply_at               ← ISO
entity.last_reply_excerpt          ← 前 300 字符
entity.est_value                   ← 数字，预期成交金额（手工设置）
entity.do_not_contact              ← 永久 unsubscribe 标记
entity.nurture_due_at              ← phase=nurture 时填，到期回 awaiting
```

### 6.2 Asset manifest
路径：`clients/<slug>/assets/manifest.json` + 子目录 `screenshots/ videos/ presentations/ documents/ references/`

```json
{
  "schemaVersion": 1,
  "entityKey": "place_xxx",
  "assets": [
    {
      "id": "homepage-desktop",
      "type": "screenshot",
      "label": "现状首页",
      "localPath": "screenshots/homepage-desktop.png",
      "cloudinaryUrl": "https://res.cloudinary.com/...",
      "addedAt": "2026-05-11T...",
      "tags": ["audit-evidence", "hero"]
    }
  ]
}
```

支持 type：`screenshot | video | presentation | document | reference | report`。增类型不改 schema。

### 6.3 Variant registry
路径：`data/outreach/variants/<id>.json` + `data/outreach/variants/<id>/body.md`

```json
{
  "id": "v_2026-05_audit-led_friendly",
  "active": true,
  "created_at": "...",
  "retired_at": null,
  "subject_template": "{{businessName}} - 我看了一下你们网站的几个具体问题",
  "body_template_path": "v_2026-05_audit-led_friendly/body.md",
  "send_time_rule": "client-local 09:00-11:00 weekday",
  "tone": "friendly",
  "hypothesis": "技术问题清单 + 友好语气比销售话术回复率高",
  "primary_metric": "reply_rate_grade_a_roofing",
  "tracklayer_campaign_id": "spring-2026-audit-led"
}
```

**Hypothesis 字段必填** —— 没有假设的实验只是随机扰动。

### 6.4 Event log
路径：`data/events/outreach-events.jsonl`（append-only）

```jsonl
{"at":"...","type":"opened","msg_id":"...","entity_key":"...","variant_id":"...","ip_country":"AU"}
{"at":"...","type":"clicked","msg_id":"...","entity_key":"...","variant_id":"...","url":"/audit-report"}
{"at":"...","type":"engaged","msg_id":"...","entity_key":"...","scroll":0.85,"dwell_ms":42000}
{"at":"...","type":"replied","msg_id":"...","entity_key":"...","class":"question"}
```

## 7. Phase + Tag 系统

### 7.1 Lifecycle phase（8，互斥，作为 Discord tag）

| Phase | 进入条件 | 自动转出 |
|---|---|---|
| `awaiting` | grade=A/B 落地默认 | 首封邮件发出 → `outreach-active` |
| `outreach-active` | 第一封 sent | 收到回信 → `replied`；N 天无回应 → `nurture` |
| `replied` | 收到客户回信 | 发 proposal → `proposal-sent`；明确 no → `archived` |
| `proposal-sent` | proposal page 链接发出 | 同意 → `paid`；拒绝 → `archived` |
| `nurture` | 客户说"以后再说"或 N 次无回 | nurture_due_at 到期 → `awaiting`（agent 重启） |
| `paid` | Stripe 付款事件 | 终态 |
| `archived` | 拒绝/沉默/D-grade | 终态 |
| `needs-human` | AI 不确定 | Matthew 手动出 |

### 7.2 Reply class（12，存在 entity.last_reply_class，不上 tag）

`interested / question / objection-price / objection-timing / objection-scope / not-now / wrong-person / referred / unsubscribe / no / bounced / unclear`

每类有 playbook：见 [`core/sales/reply-playbook.js`](../../core/sales/reply-playbook.js)（待建）。

### 7.3 Discord forum tag 清单（14，留 6 余量）

- Grade（3）：`grade-a` `grade-b` `grade-c`
- Lifecycle（8）：上表 8 个
- Modifier（3）：`urgent` `do-not-contact` `nurture-due`

niche 不上 tag，写到 thread 标题前缀 `[restaurant]`。

## 8. Profile card（16 字段，钉 thread 顶）

```
🏢  {businessName}
📍  {address} · {niche}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📞  {phone}
✉️  {primary_email}
✉️  {backup_email}        (if any)
🌐  {website_url}         | website_status
👤  {decision_maker}      (if known)
📱  {social_links}
🌏  客户本地: {local_now} {timezone}
━━━ ProfitsLocal status ━━━
Grade:        {grade}/{tier}
Phase:        {phase}
Audit:        {audit_score}/100 ({critical_count} critical)
Last contact: {last_contact_at} ({days_ago}d)
Email stats:  sent={n} open={n} click={n} reply={n}
Est value:    ${est_value}
━━━ Quick links ━━━
{asset_links from manifest}
🗓 Calendly: {calendly_url}
```

更新机制：每次 setEntityPhase / asset 添加 / 联系人更新 → 调 Discord `PATCH /channels/{thread_id}/messages/{message_id}` 重渲同一条消息，不发新消息。

## 8.1 Admin UI 状态同步模型

**核心约定**：entity JSON 文件是单一来源（source of truth）。所有写入（Discord 事件、agentic-inbox webhook、TrackLayer 信号、Hermes agent 操作）都落到 entity，admin 每次请求时读 entity 渲染。**Discord ↔ entity ↔ admin** 三者一致由 entity 居中保证，不引入额外同步层。

### 8.1.1 同步路径

```
Discord 操作 ──▶ pl:* CLI ──▶ setEntityPhase / writeEntity ──▶ entity JSON
TrackLayer 信号 ──▶ webhook ──▶ outreach-provider-event ──▶ entity.signals + appendThreadMessage
                                                                    │
                                                                    ▼
                                                              entity JSON
                                                                    │
                                                                    ▼
                                                       admin pages (server-render on request)
```

Admin 不做 WebSocket / SSE / 轮询。Matthew 刷新页面看到最新状态，足够"occasional check"用途。

### 8.1.2 Admin 必须显示的新字段

每个 lead 行/详情都要可见：

| 字段 | 来源 | 显示位置 |
|---|---|---|
| `phase` | entity.phase | 行 badge + 分 cell |
| `grade.investment_level` `grade.product_tier` | entity.grade | 行 badge |
| `discord_thread_id` | entity.discord_thread_id | 行右侧 "→ Discord" 链接（深链到 thread） |
| `signals` 计数 | entity.signals.{sent,opened,clicked,visited,engaged,replied} | 行内紧凑展示 `📤3 📧2 🔗1 💬1` |
| `last_reply_class` | entity.last_reply_class | replied phase 时显示 |
| `last_contact_at` + 距今天数 | entity.last_contact_at | 行尾 |
| `locale.timezone` + 客户本地时间 | entity.locale | 详情页 |
| asset manifest 预览 | manifest.assets[] 缩略图 | 详情页 |
| profile card 预览 | renderProfileCard 同一函数 | 详情页右栏 |

### 8.1.3 反向同步（admin → entity）

Admin 默认只读。**唯一例外**：3 个紧急操作按钮，仅用于异常恢复，不是日常工作流。
- `[手动归档]` — D-grade 误判救援，调 `pl:advance --to archived`
- `[重新分级]` — 重跑 grading，调 `pl:audit` 等价命令
- `[标记 needs-human]` — 强制 swap tag 到 needs-human，让 Matthew 在 Discord 看到

3 个按钮都走同一组 CLI，保证"action → entity → Discord/admin"路径一致。Admin 自己不直接写 entity。

## 9. 集成点

### 9.1 agentic-inbox-profitslocal
**本期不改 worker 代码**。继续走现有发送路径：
- pl:email-send 调 agentic-inbox 的发件 API（reply-forward.ts 路径 / 或现有 MCP）
- 邮件头注入 `X-PL-Variant` `X-PL-Entity-Key` 作为元数据（后期对接追踪时复用）
- 不包链接，不插 pixel

### 9.2 profitslocal webhook 接收端
**保持现有逻辑**。[outreach-provider-event.js](../../core/funnel/outreach-provider-event.js) 处理 reply 事件不变：
- 现有 GitHub Action 路径仍跑（1-3 min 延迟）
- 在 syncOutreachProviderEvent 末尾加 reply-classifier 调用 → 更新 entity.last_reply_class → swap phase tag → appendThreadMessage

### 9.3 Hermes cron
单类 job：
- **per-lead**：`lead-<entityKey>`，4h（A）/ 12h（B），prompt 让 agent 读 thread 提议下一步

Dev 期所有 cron 创建即 pause。生产时 `npm run cron:pl:enable`。

> weekly-eval cron 延期到 TrackLayer fork 改造完成后再加。

## 10. 验收硬证据（端到端）

完整跑通需观察到：
1. 选 1 个 grade=A entity → forum 自动开 thread + 3 个 tag（niche/grade-a/awaiting）
2. profile card 显示 16 字段全部非空（locale 显示客户本地时间）
3. `pl:email-draft` → variant picker 返回 v_audit-led → draft 推 thread
4. ✅ → agentic-inbox 实发 → 邮件含 TrackLayer pixel + wrapped links + X-PL-Variant header
5. 收件人打开邮件 → thread 出现 "📧 opened"
6. 收件人点链接 → thread 出现 "🔗 clicked"
7. 收件人访问落地页 → thread 出现 "👁 visited" + 60s 后 "engaged"
8. 收件人回信 → thread 出现 "💬 reply (class=...)" + tag swap 到 `replied`
9. 手动 `hermes cron run pl-weekly-eval` → `#outreach-experiments` 出现 decision report
10. ✅ AB test plan → 新 variant 自动 register 到 profitslocal + TrackLayer

## 11. 风险 + 回退

| 风险 | 概率 | 缓解 |
|---|---|---|
| Discord forum 20-tag 上限 | 已识别 | 当前 14 tag，留 6 余量 |
| Hermes 100 命令上限再触发 | 中 | 新功能不注册新 slash，走 `/skill profitslocal-lead-ops` 自由参数 |
| TrackLayer API auth 不确定 | 低 | 开工时先 1 次 `GET /contacts` 探测 |
| agentic-inbox 改造引入回归 | 中 | 在 staging 环境测；保留旧发送路径作为 fallback |
| Apple Mail Privacy 让 open 信号失真 | 已识别 | open 仅做相对比较，绝对值不信；click/visit/reply 权重更高 |
| writeEntity 全覆盖丢字段 | 低 | 所有新字段写入走 read-merge-write helper |

## 12. 决策记录

- **D1**：不重写 admin，只对齐成只读看板；推进面 = Discord（Matthew 5/11）
- **D2**：A/B 全部自动开 thread；C 批量列表不开 thread（Matthew 5/11）
- **D3**：Hermes cron dev 期 pause，部署时启用（Matthew 5/11）
- **D4**：不 backfill 历史 Discord thread + 历史 entity，全是测试数据（Matthew 5/11）
- **D5**：变体 hypothesis 字段必填（待 Matthew 最终确认）
- **D6**：TrackLayer 决策权（evaluate_and_improve）外置，profitslocal 只执行 ab_test_plan（Matthew 5/11）
- **D7**：澳洲先单国 hardcode timezone，国际化后续（Matthew 5/11）
- **D8**：admin UI = 只读看板，entity JSON 是单一来源，不引入 WebSocket/SSE 同步层。3 个紧急操作按钮走 pl:* CLI 保证一致性（Matthew 5/11）
- **D9**：TrackLayer 不集成。它是 fengtalk 项目配套，强行嵌入 V2 会污染设计。后期 fork `tracklayer-panel` 改造独立版本（Matthew 5/11）
- **D10**：本期发邮件不追踪 open/click/visit/engage。reply 走现有 CI webhook 路径（1-3 min 延迟可接受）。autoresearch 反馈闭环延期（Matthew 5/11）
- **D11**：variant registry 保留（本地 JSON）。Hypothesis 由 Claude/Codex CLI 自动生成。即使没追踪数据，变体本身的内容沉淀有价值，未来 TrackLayer fork 接入时零迁移（Matthew 5/11）
- **D12**：邮件实发走 agentic-inbox 现有 `POST /api/v1/mailboxes/{id}/emails` 路径，鉴权用 CF Access service token（已配，token id `bd400a9a-ee0f-4000-9452-524c66d14c57`）；不改 agentic-inbox worker 代码（E2E LIVE 5/11）
- **D13**：Reply 入站走 Pull 模式 — Hermes cron `pl-reply-poll` 每 5 min 拉 agentic-inbox 收件箱，按 thread_id 或 sender_email 匹配 entity；不在 agentic-inbox worker 加 push hook（Matthew 5/11）
- **D14**：entity 同时存 `outbound_message_ids[]` + `inbound_message_ids[]` — pl:email-send 写出站、pl:reply-poll 写入站。强 thread_id 匹配（弱 sender_email 是 fallback）（Matthew 5/11）
- **D15**：LLM 路由（基于 P2.1+P2.3 实测评测确认 5/11）
   - **Internal / cron / 内部任务** → T0 qwen3.5:9b（heartbeat 12s ✓ 决策正确、$0/月）
     - reply-classifier unclear fallback、hypothesis 生成、audit narration、heartbeat
   - **Cold email body B/C grade** → T1 haiku（12s、$0.05/封）
   - **Cold email body A grade** → T3 sonnet（10s、$0.06/封；引用真实细节最准）
   - **本地模型 fallback** 仅 CLI 不可用时用，加 `body_warning` 提示操作员审稿（本地编造细节风险）
   - 模型评测可重跑：`npm run pl:llm-eval -- --task heartbeat|email-body --entityKey <key>`

## 13. 不变量（写代码时不能违反）

1. 任何写 entity 的路径都必须 read-merge-write，不能覆盖未知字段
2. setEntityPhase 是状态变化的唯一入口，所有 hook 挂在它上面
3. 新变体必须有 hypothesis 字段非空
4. 发邮件必须经 agentic-inbox → TrackLayer 路径，不直连 SMTP
5. profile card 由单一渲染函数生成，所有数据来自 entity + asset manifest，不允许散在多处拼装
6. 任何对 TrackLayer / agentic-inbox 的写动作必须幂等（重放安全）
