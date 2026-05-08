# Cold Outreach Provider Integration

更新日期：2026-05-08

这份文档只回答一个问题：

**ProfitsLocal 后面能不能把 cold outreach 的发送和回复管理，切到 Instantly、Smartlead 或其他专业 cold outreach 系统？**

答案是：**可以，而且现在的内部真相源已经开始按 provider-agnostic 方式收口。**

---

## 1. 我们的边界

我们现在把邮件系统分成两层：

### A. Transactional email

- 用途：
  - review ready
  - revision receipt
  - approval / live
  - domain status
- 当前发送方：
  - `Resend`
- 风格：
  - 品牌化 HTML

### B. Cold outreach

- 用途：
  - 主动开发客户
  - 发送 demo / preview / proof
  - 跟进 prospect 回复
- 当前状态：
  - 发送 artifact、admin 状态、forum 流转已经存在
  - 当前推荐 live 路径是 `Agentic Inbox` 的人工发送 / operator review
  - `Resend` 只用于 transactional，不作为常规 cold outreach 真相源
  - 但内部状态已经开始按 provider-agnostic 结构归一
- 推荐风格：
  - plain text / 简洁文本为主

---

## 2. 为什么可以接 Instantly / Smartlead

我们核对了官方文档，目前两边都具备核心能力：

### Instantly

- API 可以创建 lead：
  - `POST /api/v2/leads`
- API 可以管理 webhook：
  - `POST /api/v2/webhooks`
  - `GET /api/v2/webhooks/event-types`
  - `POST /api/v2/webhooks/{id}/test`
- webhook 事件包含：
  - `email_sent`
  - `email_opened`
  - `reply_received`
  - `email_bounced`
  - `lead_unsubscribed`
  - `lead_interested`
  - `lead_not_interested`
  - `lead_meeting_booked`
  - `lead_closed`
- 也有回复接口：
  - `POST /api/v2/emails/reply`

### Smartlead

- API 可以创建 campaign：
  - `POST /api/v1/campaigns/create`
- API 可以往 campaign 加 leads：
  - `POST /api/v1/campaigns/{campaign_id}/leads`
- API 可以创建 webhook：
  - `POST /api/v1/webhook/create`
- webhook 事件包含：
  - `EMAIL_SENT`
  - `EMAIL_OPENED`
  - `EMAIL_CLICKED`
  - `EMAIL_REPLIED`
  - `EMAIL_BOUNCED`
  - `EMAIL_UNSUBSCRIBED`
- 也有 campaign-context reply：
  - `POST /api/v1/campaigns/{campaign_id}/reply-email-thread`
- 还有统一 inbox replies：
  - `POST /api/v1/master-inbox/inbox-replies`

---

## 3. 我们内部现在统一记录哪些字段

`clients/<client>/outreach/email/*.json` 里的 artifact，现在应该被理解成：

```json
{
  "provider": "resend|instantly|smartlead|gmail|agentic-email",
  "sendResult": {
    "status": "draft|sent|replied|bounced|unsubscribed|opened|clicked",
    "provider": "resend|instantly|smartlead",
    "sourceSystem": "resend|instantly|smartlead|gmail|agentic-email",
    "sentAt": "ISO timestamp",
    "id": "internal send id",
    "externalCampaignId": "provider campaign id",
    "externalLeadId": "provider lead id",
    "externalMessageId": "provider message id",
    "externalThreadUrl": "provider inbox/thread url",
    "replyState": "replied",
    "nextFollowUpDue": "ISO timestamp",
    "bounceState": "bounced"
  },
  "providerEvent": {
    "...": "raw webhook payload from Instantly or Smartlead"
  }
}
```

当前作用：

- `/admin/leads` 不再只知道 “有没有草稿”
- 也能知道：
  - 用的是哪个 provider
  - 有没有 sent
  - 有没有 replied
  - 有没有 bounced
  - 有没有 provider thread / campaign / lead id

当前建议的 provider 策略：

- `agentic-email`
  - 当前 live operator 路径
  - 负责 conversational inbox、AI draft、人工发送 cold outreach
  - 现在已经有 inbound provider event 入口：
    - `/api/outreach-provider-event`
    - workflow: `sync-outreach-provider-event.yml`
  - 当前支持把 `replied / bounced / follow-up due` 类事件写回：
    - `clients/<client>/outreach/email/*.json`
    - `data/cases/*/*/timeline.jsonl`（如果已有 case）
    - `website-leads` forum（如果已有 workspace）
- `instantly`
  - planned
  - 等 webhook ingest、reply-state 回流、campaign/lead 自动建档
- `smartlead`
  - planned
  - 等 webhook ingest、reply-state 回流、campaign/lead 自动建档
- `resend`
  - transactional only
  - 不作为常规 cold outreach 发送真相源

---

## 4. 当前已经做好的兼容层

代码里现在已经有：

- `core/funnel/outreach-provider-state.js`

它会把不同 provider 的状态归一成统一字段。

当前已兼容的事件映射：

### Instantly

- `email_sent` -> `sent`
- `reply_received` -> `replied`
- `email_bounced` -> `bounced`
- `lead_unsubscribed` -> `unsubscribed`
- `email_opened` -> `opened`
- `link_clicked` -> `clicked`

### Smartlead

- `EMAIL_SENT` -> `sent`
- `EMAIL_REPLIED` -> `replied`
- `EMAIL_BOUNCED` -> `bounced`
- `EMAIL_UNSUBSCRIBED` -> `unsubscribed`
- `EMAIL_OPENED` -> `opened`
- `EMAIL_CLICKED` -> `clicked`

这意味着后面如果我们把 Instantly / Smartlead webhook 真正接进来，`/admin/leads` 和 SOP 不需要整体重写。

---

## 5. 当前还没做完的部分

现在只是把 **内部状态模型** 先收好了，还没有把外部平台真正接进来。

还缺：

1. `Instantly` live integration
   - 创建 campaign / leads
   - 创建 webhook
   - webhook endpoint 落盘

2. `Smartlead` live integration
   - 创建 campaign
   - push leads
   - 创建 webhook
   - inbox replies / reply thread 接回 agent

3. 统一 webhook ingest
   - `functions/api/outreach-webhook` 之类的入口
   - 原始 payload 落盘
   - 归一状态写回 artifact / case / forum

4. `replied / follow-up due / bounced` 的 admin 视图增强
  - 现在已经能显示 provider / reply / bounce 的骨架
  - 但还没有完整的 saved views / queue

5. `agentic-email` inbound 自动来源
   - 现在已经有入口和 repo 回写链
   - 但还缺 Agentic Inbox 侧真正自动 POST / webhook 触发配置

---

## 6. 推荐落地顺序

### 第一阶段

- 继续让 `Resend` 只负责 transactional
- cold outreach 先保持：
  - plain text
  - draft artifact
  - admin tracking
  - Agentic Inbox operator send + provider event 回流

### 第二阶段

- 选一个 provider 先接：
  - 更偏 agency/volume：`Smartlead`
  - 更偏 API + webhook 清晰：`Instantly`

### 第三阶段

- 接统一 webhook ingest
- 把 `replied / follow-up due / bounced / interested` 接回：
  - `/admin/leads`
  - `website-leads` forum
  - case timeline

---

## 7. 当前结论

**可以接，而且值得接。**

更准确地说：

- `Resend` 继续做 transactional email
- cold outreach 后面完全可以迁到：
  - `Instantly`
  - `Smartlead`
  - 甚至 agentic inbox / Gmail sender
- 我们现在已经开始把内部真相源做成 provider-agnostic，所以后面切换不会把 admin、forum、SOP 全部推倒重来
