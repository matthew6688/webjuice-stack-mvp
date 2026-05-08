# ProfitsLocal Lead Profile Schema

更新日期：2026-05-08

这份文档定义 ProfitsLocal 的 **lead 真相源**。  
目标不是一次把所有字段都做满，而是先把最影响业务闭环的字段定清楚，再按阶段逐步补强。

---

## 为什么需要这份 schema

ProfitsLocal 的 lead 不是单纯联系人列表。  
它同时要支撑：

- lead discovery / qualification
- 网站 demo 制作
- cold outreach
- reply / follow-up
- paid project handoff
- admin dashboard / ROI / forum 状态

所以 lead profile 至少要同时覆盖：

1. 商家是谁
2. 我们怎么联系对方
3. 对方现在的线上存在感怎样
4. 我们有没有足够资料做 demo
5. 销售状态推进到哪一步了

---

## 设计原则

### 1. 对外身份统一

客户看到的外发邮箱、品牌和签名要统一专业。

- 发件人可以是：
  - `Matthew @ ProfitsLocal <hi@profitslocal.com>`
  - 或以后统一的业务邮箱
- 不要把 `clientSlug`、项目内部标识、系统 routing key 暴露给客户

### 2. 内部匹配靠 lead truth source

reply / follow-up / paid handoff 的归因，不应主要依赖“怪邮箱 local-part”。

优先级应该是：

1. `leadId`
2. `clientSlug`
3. `lead email` 唯一匹配
4. provider 的 external ids / thread url
5. 必要时人工确认

### 3. 先做核心字段，再补增强字段

我们现在不追求一次做完 CRM。  
先把能支撑当前核心闭环的字段做稳：

```text
lead
-> demo
-> outreach
-> reply
-> follow-up
-> paid
-> project handoff
```

---

## 分层结构

Lead profile 建议分成 6 层。

### A. Identity

这是所有后续数据关联的基础。

必备字段：

- `leadId`
- `clientSlug`
- `businessName`
- `legalName`
- `niche`
- `country`
- `city`
- `timezone`
- `status`

说明：

- `leadId` 是内部稳定主键
- `clientSlug` 用于 repo / files / forum / case
- `businessName` 是对外展示名

---

### B. Business facts

这是做网站 demo 和基础联系必须用到的商家资料。

建议字段：

- `address`
- `suburb`
- `city`
- `state`
- `postcode`
- `phone`
- `email`
- `websiteUrl`
- `contactPageUrl`
- `googleMapsUrl`
- `googlePlaceId`
- `openingHours`
- `reservationUrl`
- `menuUrl`
- `bookingProvider`
- `primaryCallToAction`
- `serviceArea`

扩展联系方式：

- `whatsapp`
- `wechat`
- `line`
- `telegram`

---

### C. Contacts

不要只记录“公司邮箱”，最好知道是在和谁对话。

建议字段：

- `ownerName`
- `managerName`
- `decisionMakerName`
- `decisionMakerRole`
- `contactEmails[]`
- `contactPhones[]`
- `bestContactChannel`
- `bestContactTime`
- `language`

---

### D. Social / presence

这是判断商家活跃度、品牌感、social proof、以及 outreach 角度的重要来源。

建议字段：

- `instagramUrl`
- `facebookUrl`
- `tiktokUrl`
- `xUrl`
- `linkedinUrl`
- `youtubeUrl`
- `xiaohongshuUrl`
- `douyinUrl`
- `tripadvisorUrl`
- `yelpUrl`
- `ubereatsUrl`
- `doordashUrl`
- `menulogUrl`
- `opentableUrl`
- `sevenroomsUrl`

质量字段：

- `googleRating`
- `googleReviewCount`
- `socialLastActiveAt`
- `instagramFollowers`
- `tiktokFollowers`

---

### E. Design / evidence

这是把 lead 推到 `ready to build` 的核心资料层。

建议字段：

- `hasWebsite`
- `currentWebsiteQuality`
- `websiteCms`
- `logoUrl`
- `faviconUrl`
- `brandColors[]`
- `brandFonts[]`
- `photoAssets[]`
- `menuAssets[]`
- `pdfAssets[]`
- `evidenceSources[]`
- `contentCompleteness`
- `designDirection`
- `redesignFeasible`
- `sitemapSummary`
- `keyPages[]`
- `mustPreserveContent[]`
- `mustPreserveUrls[]`
- `redirectRequired`
- `robotsNeeded`
- `schemaMarkupNeeded`

---

### F. Sales / workflow

这是让 lead 真正能进 dashboard、forum、project handoff 的运营层。

建议字段：

- `source`
- `qualificationStatus`
- `qualificationReason`
- `outreachStatus`
- `replyStatus`
- `followUpDue`
- `lastContactAt`
- `lastReplyAt`
- `provider`
- `externalCampaignId`
- `externalLeadId`
- `externalMessageId`
- `externalThreadUrl`
- `assignedTo`
- `priority`
- `demoReady`
- `paidStatus`
- `projectCaseId`
- `doNotContact`
- `disqualifiedReason`
- `notes[]`

后续事件字段：

- `bounced`
- `opened`
- `clicked`
- `unsubscribed`
- `spamComplaint`

---

## 分阶段推进

### Phase 1: MVP core

先把最支撑当前业务闭环的字段做稳。

#### 必须字段

- `leadId`
- `clientSlug`
- `businessName`
- `niche`
- `address`
- `phone`
- `email`
- `websiteUrl`
- `contactPageUrl`
- `googleMapsUrl`
- `googlePlaceId`
- `instagramUrl`
- `facebookUrl`
- `whatsapp`
- `hasWebsite`
- `logoUrl`
- `menuUrl`
- `evidenceSources[]`
- `qualificationStatus`
- `outreachStatus`
- `replyStatus`
- `followUpDue`
- `notes[]`
- `provider`
- `externalThreadUrl`

#### 目标

支撑：

```text
lead discovery
-> qualification
-> demo/outreach
-> replied / follow-up due
-> paid
-> project handoff
```

---

### Phase 2: Sales clarity

第二层优先补这些：

- `decisionMakerName`
- `decisionMakerRole`
- `reservationUrl`
- `bookingProvider`
- `openingHours`
- `socialLastActiveAt`
- `currentWebsiteQuality`
- `designDirection`
- `redesignFeasible`
- `sitemapSummary`
- `mustPreserveContent[]`

#### 目标

让 demo 质量更稳、outreach 更像真实销售跟进，而不是只会群发。

---

### Phase 3: Scale / optimization

等前两层稳定后，再补这些：

- `opened`
- `clicked`
- `unsubscribe`
- `spamComplaint`
- `followers`
- `seoRiskLevel`
- `serviceArea`
- `language`
- `bestContactTime`

#### 目标

让 Instantly / Smartlead / ROI / lead scoring 更完整。

---

## 与现有系统的映射

### 当前已经有的近似真相源

- `clients/<client>/outreach/outreach-pack.json`
- `clients/<client>/outreach/email/*.json`
- `clients/<client>/outreach/lead-notes.jsonl`
- `data/cases/<client>/<order>/case.json`
- `data/paid-intakes/<client>/*.json`
- `/admin/leads`

### 当前缺口

现在我们更像“从 outreach artifact 反推 lead 状态”，还不是一个完整 lead registry。

后续应该逐步演进到：

- 一个明确的 lead truth source
- outreach / reply / forum / admin 都围绕同一个 lead record

---

## 与 reply matching 的关系

### 正确原则

客户回复的自动归因不应该主要靠“奇怪的外发邮箱地址”。

推荐顺序：

1. `lead email` 唯一匹配
2. provider 的 external ids / thread url
3. 已知 `clientSlug`
4. 不唯一时进入 `needs_human_input`

### 可选增强

如果未来确实需要更强自动路由，可以增加 **内部 routing alias**。  
但这不应该成为客户看到的主发件邮箱。

---

## 与 admin 的关系

这个 schema 最终应该进 admin 的这些页面：

### `/admin/leads`

最先落地：

- identity
- business contact
- social links
- website/design readiness
- outreach status
- reply status
- follow-up due
- lead notes

### `/admin/settings`

不放具体 lead 数据，只放：

- 当前 live outreach provider
- provider webhook 配置覆盖情况
- 事件支持矩阵

### `/admin`

后面可以聚合：

- qualified leads
- demo ready
- outreach sent
- replied
- follow-up due
- paid

---

## 当前建议

当前最值得先做的，不是一下做全 CRM，而是这 3 步：

1. 把 **MVP core fields** 收成明确结构
2. 让 `replied / follow-up due / notes` 都回到同一个 lead truth source
3. 再把这个 truth source 更明确地显示到 `/admin/leads`

这样系统会稳定很多，也更适合后面接：

- Agentic Inbox
- Instantly
- Smartlead
- 其他 cold outreach 工具

