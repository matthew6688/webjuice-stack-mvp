# SOP-4 · Cold Outreach Operations & Deliverability

**版本**: v1.0
**最近更新**: 2026-05-15
**约束力**: 🔴 强制 · 所有 cold outreach 出件路径必须遵守
**配套文档**:
- [`COLD_OUTREACH_PROVIDER_INTEGRATION.md`](COLD_OUTREACH_PROVIDER_INTEGRATION.md) — provider 抽象层 + 内部 state schema（不重复，本 SOP 只 own 运维）
- [`SOP_OWNERSHIP_REGISTRY.md`](SOP_OWNERSHIP_REGISTRY.md) — 概念归属
- [`AGENTIC_INBOX.md`](AGENTIC_INBOX.md) — 入站回信处理
- [`SOP_2_LEAD_DISCOVERY_PIPELINE.md`](SOP_2_LEAD_DISCOVERY_PIPELINE.md) — qualified lead 出口（SOP-4 入口）

---

## 0. 一句话

**lead 进了 SOP-4 = 从专用发件域名 + warmup 过的 Workspace 邮箱、按 deliverability 规则发出去，事件回流到 sales-agent**。任何一条偏离，停发。

---

## 1. 边界

### 1.1 SOP-4 拥有

- 发件域名群（5 个，独立于主域）+ Workspace 账号配置
- Warmup 协议（14 天渐进 ramp + 每邮箱日发量上限）
- Provider 选型：Smartlead 为主，Instantly 为 fallback（理由见 §3）
- Deliverability 监控栈（Postmaster Tools / GlockApps / DMARC / MXToolbox）
- List hygiene 协议（发前 MillionVerifier 清洗）
- 内容规则（spintax、链接、附件、主题行、签名）
- AU Spam Act 合规（consent / identify / unsubscribe）
- Bounce / spam complaint 阈值 + 自动停发协议
- 运维节奏（daily / weekly / monthly）
- 出件邮箱 ↔ 收件路由 ↔ sales-agent webhook 链路

### 1.2 SOP-4 不拥有（链接到 owner）

- Provider 内部 state schema / 事件归一 → [`COLD_OUTREACH_PROVIDER_INTEGRATION.md` §3-4](COLD_OUTREACH_PROVIDER_INTEGRATION.md)
- Lead intake / dedup / enrichment → [`SOP-1`](SOP_1_INTAKE_DISCOVERY.md)
- Lead 资格审计 / qualification → [`SOP-2`](SOP_2_LEAD_DISCOVERY_PIPELINE.md)
- Entity schema / `outreach_status` 字段 → [`SOP_HANDOFF_CONTRACT.md`](SOP_HANDOFF_CONTRACT.md)
- Transactional email（Resend）→ [`COLD_OUTREACH_PROVIDER_INTEGRATION.md` §1.A](COLD_OUTREACH_PROVIDER_INTEGRATION.md)
- 入站回信 AI 起草 + MCP → [`AGENTIC_INBOX.md`](AGENTIC_INBOX.md)
- 第三方工具 tier / cost → [`SOP_X_TOOLING.md`](SOP_X_TOOLING.md)

---

## 2. Stack 总览

```
SOP-2 出口 (qualified entity)
       │
       ▼
┌──────────────────────────────────────────────┐
│  SOP-4 出件层（本 SOP）                       │
│                                              │
│  ┌──────────────────────┐                    │
│  │ List hygiene         │  MillionVerifier   │
│  │ (发前清洗，§7)        │                    │
│  └─────────┬────────────┘                    │
│            ▼                                 │
│  ┌──────────────────────┐                    │
│  │ Smartlead campaign   │  §3                │
│  │ + 5 发件邮箱轮发      │  §4                │
│  │ + spintax 内容        │  §8                │
│  └─────────┬────────────┘                    │
│            ▼                                 │
│  发出（每邮箱 ≤ §5 上限）                     │
│                                              │
│  事件回流 (Smartlead webhook)                 │
│            │                                 │
│            ▼                                 │
│  /api/outreach-webhook  (统一 ingest)        │
│            │                                 │
│            ▼                                 │
│  归一为 provider-agnostic state              │
│  (schema 详见 PROVIDER_INTEGRATION §3)        │
└──────────────────────────────────────────────┘
       │
       ▼
sales-agent worker → /admin/leads + Discord 通知
       │
       ▼
回信路径 → AGENTIC_INBOX
```

---

## 3. Provider 选型 · Smartlead 为主

### 3.1 决策（2026-05-15）

**主用 Smartlead。** 三个理由：

1. API 完整度高，campaign / lead / webhook / sequence 全可程序化（[`PROVIDER_INTEGRATION` §2](COLD_OUTREACH_PROVIDER_INTEGRATION.md) 已确认）
2. 多 workspace 模型对应 ProfitsLocal 未来给客户做 agency 外联的形态
3. 事件名稳定（`EMAIL_SENT` / `EMAIL_OPENED` / `EMAIL_CLICKED` / `EMAIL_REPLIED` / `EMAIL_BOUNCED` / `EMAIL_UNSUBSCRIBED`）

### 3.2 不选 Plunk 的理由

- Plunk 自托管底层强制 AWS SES，且无 multi-mailbox warmup / 轮发——为 product email（已 opt-in）设计，不为 cold outreach 设计
- Plunk Cloud 共享发件池——别人发垃圾会牵连本域名 reputation
- Plunk 没有项目级 webhook，只能用 workflow HTTP step DIY，无 HMAC

**Plunk 永远不进入 SOP-4 范围**。未来若 ProfitsLocal 变 SaaS，Plunk 可用于产品 lifecycle email，但那属于另一条 SOP。

### 3.3 Instantly 作为 fallback

只在 Smartlead 全平台故障 / 价格突变时切换。state schema 已 provider-agnostic（[`PROVIDER_INTEGRATION` §4](COLD_OUTREACH_PROVIDER_INTEGRATION.md)），切换不影响下游。

---

## 4. 发件基础设施 · 5 域名 5 邮箱

### 4.1 域名群（与主域隔离）

| 用途 | 域名 | DNS 设置 |
|---|---|---|
| 主网站（不发冷邮件） | `profitslocal.com` | 现状不变 |
| Transactional（Resend） | `mail.profitslocal.com`（子域） | Resend DKIM/SPF |
| Cold outreach #1 | `getprofitslocal.com` | Smartlead DKIM/SPF + custom tracking CNAME |
| Cold outreach #2 | `profitslocal.io` | 同上 |
| Cold outreach #3 | `tryprofitslocal.com` | 同上 |
| Cold outreach #4 | `profitslocalhq.com` | 同上 |
| Cold outreach #5 | `profitslocal.co` | 同上 |

**域名禁忌**：
- 不用 `.xyz / .top / .click / .info`（Gmail 默认怀疑）
- 不用 `@profitslocal.com` 直接发冷邮件（保护主域 reputation）
- 不用 alias 同域名假装多邮箱（共享 reputation，5 个绑一起死）

### 4.2 Workspace 配置

每个域名一个独立 Google Workspace Business Starter（US$7/月）。

每个 Workspace 必备：
- 1 个真人样用户（头像 / 全名 / signature / phone）
- DNS 五件套：SPF、DKIM（Google + Smartlead 两组）、DMARC、MX、tracking CNAME
- DMARC 起步 `p=none; rua=mailto:dmarc@profitslocal.com`，30 天后升 `p=quarantine`
- 注册后**域名静置 14–30 天再加入 Smartlead**（domain age 信号）

### 4.3 DNS 模板（每个冷邮件域名都装）

```
# SPF
@   TXT   "v=spf1 include:_spf.google.com include:amazonses.com ~all"

# DKIM (Google)
google._domainkey   TXT   "v=DKIM1; k=rsa; p=<Google 提供>"

# DKIM (Smartlead)
sl._domainkey       TXT   "v=DKIM1; k=rsa; p=<Smartlead 提供>"

# DMARC (起步)
_dmarc   TXT   "v=DMARC1; p=none; rua=mailto:dmarc@profitslocal.com; pct=100"

# MX
@   MX 1  smtp.google.com.

# Tracking CNAME (Smartlead 提供)
link   CNAME   <smartlead 提供的目标>
```

### 4.4 起步成本

| 项目 | 月成本 (USD) |
|---|---|
| 5 域名（年付摊月）| $5 |
| 5 Google Workspace | $35 |
| Smartlead Basic | $39 |
| MillionVerifier（list 清洗）| ~$10 |
| MXToolbox 黑名单监控 | $11 |
| **合计** | **~$100/月** |

---

## 5. Warmup 协议 · 14 天硬性 ramp

### 5.1 起步 14 天

Smartlead 内置 unlimited warmup。所有 5 个邮箱**同时启动 warmup**，不发任何真实 campaign。

| Day | 每邮箱 warmup 量（自动） | 真实 campaign |
|---|---|---|
| 1–3 | 4–8 封 | 禁止 |
| 4–7 | 12–18 封 | 禁止 |
| 8–14 | 20–30 封 | 禁止 |
| 15+ | 30–40 封持续 | **允许，按 §5.2 上限** |

### 5.2 真实 campaign 发件上限（每邮箱）

| 阶段 | 真实冷邮件量 / 邮箱 / 天 |
|---|---|
| Week 3 (warmup 之后第一周) | 15 封 |
| Week 4 | 20 封 |
| Week 5 | 30 封 |
| Week 6+ | 40 封（封顶） |

**5 邮箱 × 40 封 = 日发 200 封封顶**。需要更多 → 加邮箱，不要拉高单邮箱量。

### 5.3 Warmup 永不停

任何一个邮箱**任何时候都至少保留 warmup 量 ≥ 真实发件量的 30%**。Smartlead 默认行为，确认 campaign 设置勾选了 "keep warmup running"。

### 5.4 30 天休眠后必须重新 warmup

任何邮箱连续 7 天 0 真实发件 → 强制回到 §5.1 Day 8 量级重新 ramp 一周。

---

## 6. Deliverability 监控栈

### 6.1 监控工具矩阵

| 工具 | 频率 | 用途 | 成本 |
|---|---|---|---|
| Google Postmaster Tools | 每天看 | 每域名 reputation / spam rate / DKIM-SPF pass | 免费 |
| mail-tester.com | 每周一 | 单封 score 0–10 | 免费 |
| GlockApps seed test | 每周一（启用后）| 多 ISP IPR | $59/月 |
| Smartlead built-in warmup score | 每天看 dashboard | 每邮箱 warmup 健康 | 含在订阅 |
| MXToolbox Blacklist | 每周一 + 邮件告警 | Spamhaus / SpamCop / SORBS 等 | $11/月 |
| Postmark DMARC | 每月看一次 | 聚合报告 | 免费 |

### 6.2 关键阈值（任一触发 → 停发 + 排查）

| 指标 | 安全 | 警戒 | 停发 |
|---|---|---|---|
| Bounce rate（per campaign） | < 2% | 2–3% | > 3% |
| Spam complaint rate | < 0.1% | 0.1–0.2% | > 0.2% |
| Postmaster domain reputation | High / Medium | Low | Bad |
| mail-tester score | 9–10 | 7–8 | < 7 |
| MXToolbox 命中黑名单数 | 0 | 1（非 Spamhaus） | ≥ 1 Spamhaus / ≥ 2 总 |

### 6.3 自动告警

`scripts/qa/outreach-deliverability-check.mjs`（待建 · TODO §13）每天 06:00 跑：
- 拉 Smartlead campaign stats
- 计算每邮箱 bounce / complaint / reply rate
- 任一邮箱触线 → POST `SYSTEM_ALERTS_DISCORD_WEBHOOK_URL` + Smartlead API 暂停该邮箱

参考 [`SOP_X_TOOLING.md` §3 ops:health-check](SOP_X_TOOLING.md) 的健康检查模式接入。

---

## 7. List Hygiene · 发前清洗强制

### 7.1 规则

任何 lead 从 SOP-2 出口进入 SOP-4 之前，必须经过 MillionVerifier 验证。

**只发 status = `valid` 的邮箱**。以下一律 **不发**：
- `invalid` — bounce 必然
- `unknown` / `risky` — bounce 不可预测
- `catch-all` — domain 全收，看不到 bounce，但收件人不存在，deliverability 毒药
- `disposable` — 一次性邮箱
- `role-based`（`info@`、`admin@`、`sales@`）— 团队邮箱，spam complaint 风险高

### 7.2 实现

CLI（待建 · TODO §13）：
```bash
pl:outreach-clean --batch-id <id>
# 1. 读取 batch 内所有 lead emails
# 2. 调 MillionVerifier API
# 3. 把结果写回 entity.outreach_eligibility.{status, checked_at}
# 4. 只 status=valid 的 entity 可进入 Smartlead push
```

字段 schema 归 [`SOP_HANDOFF_CONTRACT.md`](SOP_HANDOFF_CONTRACT.md)，本 SOP 只 own 触发时机和阈值。

---

## 8. 内容规则 · 反 spam 触发器

### 8.1 必守 7 条

1. **正文 0–1 个链接**（含签名）。CTA 链接放 P.S. 或独立一行
2. **永不附件**（PDF、图片、Calendar 都不行）
3. **永不内嵌图片**（logo / signature 图片都不行）
4. **第一封邮件不放 Calendly / Cal.com / Tidycal**——两次回信后才放
5. **从不使用 `bit.ly` / `tinyurl` 等缩短器**——用 Smartlead 的 custom tracking domain (§4.3)
6. **永不使用 `Re:` / `Fwd:` 假装回信**
7. **同一公司一次只联系一个人**——`john@acme.com` 没回，**再换** `jane@acme.com`，不同时发

### 8.2 Spintax 要求

每个 campaign 模板**必须** spintax 化：
- 主题行 3–5 个变体
- 开场白 3–5 个变体
- 中段 2–3 个变体
- CTA 2–3 个变体

工具：Smartlead 模板编辑器原生支持 `{var1|var2|var3}` 语法。

### 8.3 主题行规则

- 全小写
- ≤ 50 字符
- 不含 `$`、`!`、`100%`、`free`、`guarantee`、`limited time`
- 不全大写
- 像同行随手发的（"quick question about acme's site"）

### 8.4 签名 + Reply-To

```
Matthew Kiata
ProfitsLocal
matthew@<sending-domain>
ABN <填实际 ABN>
<Office address line>

To stop receiving these, just reply "no thanks".
```

- 签名 ≤ 4 行
- 不放社交链接一排
- Reply-To 必须等于 From（Smartlead 默认）

### 8.5 发件时间

AU 业务客户最佳窗口：
- **周二 / 周三 / 周四**
- 当地时间 **9:00–11:00** 或 **14:00–16:00**
- 避开：周一上午、周五下午、周末、AU 公共假日

Smartlead campaign 设置 `sending_schedule.timezone = "Australia/Sydney"`（或对应州时区）。

---

## 9. AU Spam Act 2003 合规

### 9.1 三条强制

#### Consent
- B2B 场景适用 **inferred consent**：收件人**职位**与 ProfitsLocal **offering** 直接相关
- 每个 lead 必须可解释"为何相关"——SOP-1 抓取信息 + SOP-2 audit 结果作为证据
- 不相关的 lead **不发**（例：给餐厅经理发屋顶服务）

#### Identify
每封邮件签名（§8.4）必须包含：
- 公司全名 `ProfitsLocal`
- ABN
- 物理地址

#### Unsubscribe
- 必须**功能可用**
- 收到退订请求 **5 个工作日**内移除
- Smartlead campaign 必须配置回信关键词捕获：`unsubscribe` / `remove` / `stop` / `no thanks` / `not interested` → 自动加入 suppression list 并标记 entity.outreach_status = `unsubscribed`

### 9.2 Privacy Act 1988

- ProfitsLocal 网站必须有 Privacy Policy（[`profitslocal.com/privacy`](https://profitslocal.com/privacy)）
- Lead 邮箱不外卖、不共享给第三方
- 客户要求 data deletion → 24 小时内 purge entity

### 9.3 罚款风险

ACMA 单次违规最高 AUD $2.22M for corporate. **任何阶段不确定时一律停发问 Matthew**。

---

## 10. 事件回流 · webhook → sales-agent

### 10.1 Smartlead webhook 配置

每个 Smartlead campaign 创建一个 webhook：
```
URL:    https://profitslocal.com/api/outreach-webhook
Events: EMAIL_SENT, EMAIL_OPENED, EMAIL_CLICKED, EMAIL_REPLIED,
        EMAIL_BOUNCED, EMAIL_UNSUBSCRIBED
Header: X-Outreach-Secret: <SMARTLEAD_WEBHOOK_SECRET env>
```

Smartlead 不自带 HMAC，用静态 shared secret + HTTPS 校验。Secret 至少 48 字节随机，每 90 天轮转。

### 10.2 Ingest 路径

`functions/api/outreach-webhook.ts`（待建 · TODO §13）：
1. 验 `X-Outreach-Secret`，不等于 env 立即 401
2. 写原始 payload 到 `data/outreach/webhooks/<yyyy-mm-dd>/<event-id>.json`（审计用）
3. 调 `core/funnel/outreach-provider-state.js`（已存在）归一为 provider-agnostic state
4. 按 `lead_email` 找 `clientSlug`，回写 `clients/<client>/outreach/email/*.json` 的 `sendResult`
5. 高价值事件（`EMAIL_CLICKED` / `EMAIL_REPLIED`）额外 POST `SPECIAL_ALERTS_DISCORD_WEBHOOK_URL`
6. `EMAIL_REPLIED` 触发 sales-agent 调 Agentic Inbox MCP `draft_reply`（见 [`AGENTIC_INBOX.md`](AGENTIC_INBOX.md)）

字段归一详见 [`COLD_OUTREACH_PROVIDER_INTEGRATION.md` §4](COLD_OUTREACH_PROVIDER_INTEGRATION.md)。

### 10.3 幂等

每个 webhook event 必须有唯一 `event_id`，落盘前查重。重发 5 次内不重复处理。

---

## 11. 运维节奏

### 11.1 Daily（自动）

| 时间 | 动作 | 实现 |
|---|---|---|
| 06:00 AEST | `pl:outreach-health-check` 跑全邮箱 deliverability | Hermes cron + Discord 通知 |
| 06:05 | 任一邮箱超阈值 → 自动 Smartlead API 暂停 | health-check 脚本 |
| 实时 | webhook 入站 → state 回写 | §10 |

### 11.2 Weekly（Matthew 周一 09:30 AEST）

- 每域名 mail-tester.com 跑一次，记 score 到 `data/outreach/weekly-score.csv`
- MXToolbox Blacklist 巡检（自动告警 + 人工 review）
- Postmaster Tools 看每域名 7 天 reputation 趋势
- Smartlead campaign reply rate 复盘——< 1% 的 campaign 砍掉

### 11.3 Monthly

- DMARC 聚合报告复盘（Postmark Free）
- 主题行 / 开场白 A/B 数据回看，把 top 30% 模板提到 Smartlead favorites
- 退订名单同步到主 CRM（防止其他渠道再发）
- 任一域名 reputation 持续 Low 30 天 → 注销 Workspace 换新域名

### 11.4 Quarterly

- 全 stack deliverability audit（含 GlockApps 全 ISP seed test）
- Lead 来源质量评估——bounce 率 > 5% 的 source 砍掉，反馈到 SOP-1

---

## 12. 停发协议

### 12.1 域名级停发触发器

任一触发立即在 Smartlead 暂停该域名所有 campaign：
- Postmaster Tools domain reputation = `Low` 或 `Bad`
- Bounce rate 7 天滚动平均 > 3%
- Spam complaint rate > 0.2%
- 命中 Spamhaus

### 12.2 邮箱级停发触发器

- 单邮箱 24 小时内 bounce > 5 封
- 单邮箱 7 天 0 reply 且 0 open（warmup 失败信号）

### 12.3 恢复路径

- 域名级停发 → 至少 14 天纯 warmup + Postmaster 回到 Medium 才能复发
- 邮箱级停发 → 暂停 7 天 + 重 warmup 一周

任何停发动作发 Discord `SYSTEM_ALERTS_DISCORD_WEBHOOK_URL`，由 Matthew 确认是否需要更长隔离。

---

## 13. 待建（Phase 1）

按交付优先级：

1. **DNS + Workspace 注册**（人手，~2 小时 / 域名 × 5）
2. **Smartlead 账号 + 5 邮箱接入 + warmup 启动**（人手，1 小时）
3. **MillionVerifier 接入 + `pl:outreach-clean` CLI**（工程，半天）
4. **`functions/api/outreach-webhook.ts` + secret 校验 + state 回写**（工程，1 天）
5. **`pl:outreach-health-check` daily cron + Discord 告警**（工程，半天）
6. **`/admin/outreach` 视图**——按域名/邮箱/campaign 看 reply rate / bounce rate / reputation（工程，1 天）
7. **Postmaster Tools 5 域名手动接入 + 1 周后复查**（人手）
8. **首个 campaign：50 lead 试发 + 反馈复盘**（人手 + 工程联动）

每个块完成后立即更新本 SOP 的对应章节，标 `已交付 (YYYY-MM-DD)`。参考 [`SOP_MAINTENANCE_RULES.md` §3](SOP_MAINTENANCE_RULES.md) keep-docs-in-sync 要求。

---

## 14. 交付 / 验收清单

任何阶段宣布"上线"前必须勾完：

- [ ] 5 域名 DMARC `p=none` 已发布，DKIM/SPF Gmail 验证通过
- [ ] 5 个 Workspace 邮箱 warmup ≥ 14 天，Smartlead warmup score > 90%
- [ ] mail-tester score ≥ 9/10 在每个域名上验过
- [ ] Postmaster Tools 接入 + reputation = Medium 以上
- [ ] MillionVerifier 已对接，`pl:outreach-clean` 通过 50-lead 测试
- [ ] `/api/outreach-webhook` 收到 Smartlead 测试事件 + 落盘 + state 回写
- [ ] `outreach-provider-state.js` 归一逻辑对照 [`PROVIDER_INTEGRATION` §4](COLD_OUTREACH_PROVIDER_INTEGRATION.md) 表全过
- [ ] Discord `SYSTEM_ALERTS` 频道收到 1 次模拟超阈值告警
- [ ] AU Spam Act 三件套（consent 证据 / 签名带 ABN+地址 / unsubscribe 关键词）每个 campaign 都验过
- [ ] 首次试发 50 lead，bounce rate < 2% + reply rate ≥ 3%
- [ ] 复盘记录写入 `data/outreach/launch-postmortem-YYYY-MM-DD.md`
