# SOP · Discord 显示规范 (Thread Title + Profile Card)

> **作用域**: V3 所有 lead/project/paid forum thread 的 title 格式 + 钉顶 profile card 的字段排版规则。
> **目的**: 销售扫一眼 channel 列表就懂漏斗状态 · 打开 thread 第一眼就看到完整客户档案。
> **owner**: 跨 #website-leads / #website-projects / #paid-websites 三个 channel 的 cross-cutting display layer。
> **status**: D35 (2026-05-14) 第一版 · 实装后随 sales 反馈迭代。

---

## 0. TL;DR

```
Thread title:   [niche] [stage] [grade] business-name {emoji?}
Profile card:   7 section · 中文 label · 无 emoji 装饰
Emoji:          只用 4 个 (🔥 ⏰ 💬 👀) · 警报 / 提醒作用 · 大多数 thread 没有
```

---

## 1. Thread Title 规范

### 1.1 格式

```
[niche-2字] [stage-2字] [grade] business-name [emoji?]
```

| 段 | 内容 | 来源 |
|---|---|---|
| **niche** | 2 字中文 (屋顶/水管/电工/...) | `entity.latest.niche` 映射 |
| **stage** | 2 字中文 (待发/已发/有意/...) | `entity.sales_stage` 字段 |
| **grade** | A/B/C/D 单字 | `entity.scoring.grade` |
| **name** | 商家名 (英文原文) | `entity.latest.name` |
| **emoji** | 0 或 1 个 attention emoji (末尾) | 计算 / 手动 |

**字符上限**: 100 (Discord limit) · 超长时截断 name (保留前 3 段)。

### 1.2 Niche 中文词表 (16 个 · fallback 其他)

| 中文 | English niche values |
|---|---|
| 屋顶 | `roofer` · `roofing` |
| 水管 | `plumber` · `plumbing` |
| 电工 | `electrician` · `electrical` |
| 餐饮 | `restaurant` · `cafe` · `food` |
| 牙医 | `dentist` · `dental` |
| 美发 | `hair` · `salon` · `barber` |
| 汽修 | `auto` · `panelbeater` · `mechanic` |
| 油漆 | `painter` · `painting` |
| 暖通 | `hvac` · `heating` · `cooling` |
| 太阳 | `solar` |
| 医疗 | `medical` · `clinic` · `gp` |
| 美容 | `beauty` · `spa` · `wellness` |
| 宠物 | `pet` · `vet` |
| 园艺 | `landscape` · `garden` · `gardener` |
| 清洁 | `cleaning` · `cleaner` |
| 其他 | fallback / 未识别 |

### 1.3 Stage 中文词表 (按 channel)

#### `#website-projects` (8 stage · 主销售流程)
| 中文 | 状态机 |
|---|---|
| 待发 | demo 已 build · 还没外联 |
| 已发 | 冷邮件 / 电话 已发 |
| 在看 | 客户已点 demo |
| 有意 | 客户回信表达兴趣 |
| 报价 | 报价已发 |
| 成交 | 已成 · graduate paid |
| 流失 | 拒绝 / 长期无回应 |
| 养护 | 长期 drip |

#### `#website-leads` (3 stage · 无 demo)
| 中文 | 状态机 |
|---|---|
| 待建 | 等算力跑 demo |
| 仅销 | 决定不做 demo · 纯模板邮件 |
| 已弃 | archived |

#### `#paid-websites` (6 stage · 付费交付)
| 中文 | 状态机 |
|---|---|
| 新付 | 刚付款 · onboarding |
| 改稿 | 做 r1/r2/r3 · in-revision |
| 上线 | live |
| 维护 | 月度维护 |
| 续约 | 临近续费 / 流失风险 |
| 流失 | churned |

### 1.4 Attention Emoji (4 个 · 末尾 · 大多 thread 无)

**核心规则**: emoji 不是装饰 · 是销售看板的警报灯。

| Emoji | 含义 | 持续时间 | 触发 |
|---|---|---|---|
| 🔥 | **紧急** · 立刻 attention | 直到状态变 / operator 取消 | operator 在 thread react `🔥` (手动) |
| ⏰ | **跟进 due** · 等超时 | 直到 stage 推进 / 客户回 | 系统 daily cron 监测:<br>• `[已发]` 后 5 天没动 → 加<br>• `[报价]` 后 5 天没动 → 加<br>• `[有意]` 后 24h operator 没跟 → 加 |
| 💬 | **客户刚回信** | 24h 后自动消 | M4 inbound listener (待启动) |
| 👀 | **客户刚看 demo** | 24h 后自动消 | M4 link tracker (待启动) |

**优先级** (单 thread 只显 1 个 · 按优先级取): 🔥 > 💬 > 👀 > ⏰

### 1.5 实装时机 (D35 ship)

| Phase | 谁做 | 状态 |
|---|---|---|
| 静态 (niche + stage + grade + name) | 系统 (entity sync) | ✅ 立刻 |
| 🔥 manual flag · operator react | reaction listener | ⚠️ 暂用 entity.urgent field · UI react 等 P5 |
| ⏰ system cron | daily channels-doctor 拓展 | ⚠️ 待加 daily 监测 |
| 💬 / 👀 | M4 inbound + link tracker | ❌ M4 启动后 |

---

## 2. Profile Card 规范

### 2.1 7 Section 结构

```
[Embed Title]    [niche] [stage] [grade] business-name
[Description]    地址 (无 emoji)
[Color border]   按 grade · A=绿 B=蓝 C=灰 D=红

[Field 1 · 销售阶段]
分级: C · 批量轻触 · 模板邮件 + demo URL
最佳联系: Tue/Wed/Thu 10:00-12:00 · high
        工作日中段开门 + 避免周一开机/周五下班/午餐时间

[Field 2 · 基本信息]
行业: Roofing contractor (+2 个分类)
营业: 5 天/周 · 07:00-17:00
Google: 4.9★ · 21 条 · 信任度强

[Field 3 · 联系方式]
电话: (07) 3132 1605
网站: https://brisbaneroofrestorationexperts.com.au/  ·  独立 HTTPS
邮箱: —  (TODO M4 enrich)
表单页: —  (TODO scrape)
社媒: —  (TODO scrape)

[Field 4 · 审计结论]
总分: 70/100 · low_priority
视觉: 新鲜度 4/10 · 信任 5/10 · 转化 6/10 · 风格 outdated
Hard triggers: passed (无触发)

[Field 5 · 在线资源]
Demo: https://brisbane-roof-...-dev.pages.dev   (裸 URL)
[客户 audit]  ·  [内部 audit]  ·  [master.md]   (hyperlink)
[Desktop 截图] · [Mobile 截图] · [Mobile throttled 录屏]
证据 (6):
• [Busy hero with heavy shadow text]
• [Dated logo and header]
• [Desktop form visual clutter]
• [Generic trust signals missing]
• [Homepage title clear]
• [Quote form too demanding above fold]

[Field 6 · 线索来源]
Places API · 查询: "roofer brisbane" · 第 11 位
首次发现: 2026-05-09 (4 天前)
客户本地: 10:38 AEST · Australia/Brisbane, QLD

[Field 7 · 销售进程]
Phase: design-ready
最近更新: 2026-05-13 (今天)
(M4 启动后追加: 上次外联 / 邮件 sent-opened-clicked / 客户回信日期 / proposal sent 日期)

[Footer]   entityKey: place_chij...
```

### 2.2 Section 字段是 Discord embed field

- 每 section = 1 个 `field` · `inline: false` (全宽)
- `name` = section title (Discord 自动 bold) · 无 emoji
- `value` = section 多行内容 (每行一项 · `\n` 分隔)

### 2.3 链接策略 (per Matthew)

| 类型 | 显示方式 | 原因 |
|---|---|---|
| **客户官方网站** | 裸 URL | 销售复制粘贴用 |
| **我们 Demo URL** | 裸 URL | 销售复制粘贴用 (邮件附) |
| **客户 audit / 内部 audit / master.md** | `[label](url)` hyperlink | 操作员阅读用 |
| **截图 / 录屏 / 证据** | `[label](url)` hyperlink | 操作员快速点开看 |

### 2.4 空字段处理

| 字段 | 数据缺 | 处理 |
|---|---|---|
| 邮箱 / 表单页 / 社媒 | 多数客户没抓到 | 显示 `—` · **不 skip** (反向提醒销售这里要补) |
| Hard triggers | 通常空 | 显示 `passed (无触发)` |
| 其他 | 数据缺 | skip 该行 (不显示空 placeholder) |

### 2.5 PIN 规则

- **新开 thread** · `openProjectThread` 末尾自动 PUT `/pins/{messageId}` · profile card 自动钉
- **已存在 thread** (8 keepers) · `pl:pin-keepers` 一次性补 pin

---

## 3. 状态机 · stage 切换触发

### 3.1 自动 swap

| 触发 | 系统动作 |
|---|---|
| `pl:publish-demo` 成功 | `entity.sales_stage = 'demo-ready'` · title `[待发]` |
| M4 outreach 发邮件 | `'outreach-sent'` · title `[已发]` (待 M4) |
| M4 link tracker · 客户点 demo | `'client-reviewing'` · title `[在看]` + `👀` (待 M4) |
| M4 inbound · 客户回信 | `'interested'` · title `[有意]` + `💬` (待 M4) |
| Stripe webhook · 付款 | graduate to #paid-websites (待 M5) |

### 3.2 手动 swap

| 触发 | 谁动 |
|---|---|
| operator 在 thread react `📋` | swap → `[报价]` (待 reaction listener) |
| operator 在 thread react `🔥` | 加 emoji (待 reaction listener) |
| operator 命令: `stage interested` | swap (待 thread 内命令解析) |
| 直接编辑 `entity.sales_stage` · 跑 refresh CLI | 立刻生效 |

### 3.3 系统 cron (daily) 加 ⏰ 跟进 emoji

```
扫所有 phase=design-ready+ 的 entity:
  if stage='outreach-sent' and last_outreach_at > 5 days ago → 加 ⏰
  if stage='proposal-sent' and last_outreach_at > 5 days ago → 加 ⏰
  if stage='interested' and last_response_at > 24h ago → 加 ⏰
```

由 `pl:channels-doctor` cron 触发 · 加进 daily 09:00 跑。

---

## 4. 实装清单 (D35 ship)

| 文件 | 改动 |
|---|---|
| `core/funnel/niche-vocab.js` (新) | 16 niche → 2 字中文 map |
| `core/funnel/stage-vocab.js` (新) | 17 stage (8+3+6) → 2 字中文 map |
| `core/funnel/profile-card.js` | 7 section 重构 · 加 email/social/contact_us 占位字段 |
| `core/funnel/lead-thread-sync.js#buildLeadThreadName` | 拓展为 `buildThreadName(entity, channel)` · 加 stage + emoji |
| `core/funnel/lead-thread-sync.js` | 拓展 `swapPhaseTag` 调 `updateDiscordThread.name` 同步 title |
| `scripts/cli/pl-rename-keepers-titles.js` (新) | 一次性 rename + re-pin 8 个 keepers thread |

---

## 5. 验收

- [x] SOP 文档落盘 (本文档)
- [x] niche-vocab + stage-vocab 实装 (`core/funnel/display-vocab.js`)
- [x] profile card 7 section 渲染 (`core/funnel/profile-card.js`)
- [x] thread title 新格式生效 (`buildThreadTitle`)
- [x] 8 keepers rename + pin 完成 (`pl:rename-keepers-titles`)
- [x] doctor 5/5 + 10/10 仍绿
- [x] **5 lifecycle hooks 已实装** (D35 follow-up):
  - `core/leads/grade-router.js` · 已有 project_thread_id 不重开 leads thread
  - `scripts/leads/build-master-md.js` · master.md 重建 → refresh card + 发消息
  - `scripts/cli/pl-build-customer-audit.js` · 客户 audit HTML 重建 → refresh
  - `scripts/cli/pl-optimize-internal-report.js` · 多轮 optimize → refresh
  - `scripts/leads/run-audit-pipeline.js` · 4 stage audit 完 → refresh (per entity)
- [x] `refreshThreadAndPost(entityKey, message)` 统一工具 (`core/funnel/lead-thread-sync.js`)
- [x] commit + push

## 6. Lifecycle hook 触发表

| CLI / 模块 | Discord 反应 | 实装位置 |
|---|---|---|
| `pl:publish-demo` 成功 | 开 thread (idempotent) + refresh card + 发 demo URL | `pl-publish-demo.js` 末尾 |
| `leads:build-master-md` 完 | refresh card + `📄 master.md 已重建 + audit score` | `build-master-md.js` 末尾 |
| `pl:build-customer-audit` 完 | refresh card + `📋 客户 audit HTML 已重建` | `pl-build-customer-audit.js` 末尾 |
| `pl:optimize-internal-report` 完 | refresh card + `📊 内部 audit 优化版 N 轮` | `pl-optimize-internal-report.js` 末尾 |
| `leads:run-pipeline` 完 (per entity) | refresh card + audit summary | `run-audit-pipeline.js` 末尾 |
| `grade-router` (re-grade · 已有 project thread) | 不开新 leads thread · 直接 refresh projects + 发 grade 变更 | `grade-router.js` |
| (未来) operator react 🔥 | swap title emoji | 待 reaction listener |
| (未来) M4 inbound · 客户回信 | swap stage [有意] + 💬 | M4 |
| (未来) M4 link tracker · 客户看 demo | swap stage [在看] + 👀 | M4 |

---

## 6. 相关文档

- [DISCORD-CHANNELS-PRD.md](./DISCORD-CHANNELS-PRD.md) · 6 channel 架构 (D34)
- [LEAD-JOURNEY.md](./LEAD-JOURNEY.md) · 跨 channel lead lifecycle
- [DECISIONS-LOG.md](./DECISIONS-LOG.md) · D34 6-channel · D35 显示规范 (本)
