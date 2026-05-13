# SOP · Discord → Hermes → Discord 信息流 · 2026-05-13

> Matthew 要求: 让流程**可控 · 可视化**。每个通知要**相关 · 有用 · 人话**，
> 让看 Discord 的人 (operator / Matthew) 知道当前是什么阶段、下一步是什么、
> 业务上意味着什么。

## 设计原则 · 通知 4 项必备

每条 Discord 回帖**必含**:

1. **业务事件** (人话 · 不是 task_id · 不是 exit code)
   - ❌ "任务 abc123 完成 · 用时 4.8s · exit=0"
   - ✅ "✓ 找到 12 家 Brisbane 屋顶公司"
2. **数字结果** (找到几条 · 跳过几条 · 失败几条)
3. **下一步预期** (谁干 · 多久 · 哪里看)
4. **可点击下钻** (admin URL · 或下一条 thread reply 的指引)

技术细节 (task_id / exit code / cli args) 保留 · 但**折叠到 thread 最后** 或 admin URL 后。

---

## Flow 1 · M1 · 抓 lead → 入库 → master.md skeleton

### 触发方式 (4 种)

| 操作员在 Discord 发 | 路由到 | 业务意图 |
|---|---|---|
| `find brisbane roofers` 或 `搜 Brisbane 屋顶` | `pl:pipeline-batch-start` → `pl:scrape-docker` | 批量抓一城/一行业 |
| `"cafe brisbane" "cafe melbourne"` (引号) | `pl:places-search-intake` | 精准搜 2-5 个商家 |
| `Joe Plumbing 0412345678 Sydney` (名+电+城) | `pl:single-enrich` | 已知商家 · 拿完整 GMB |
| 上传图 (招牌 / 名片 / 网页截图) | `pl:ingest-image` (vision OCR 提取信息) | 路边发现的 lead |

### 时间线 · 操作员看到什么

```
┌─────────────────────────────────────────────────────────────────────┐
│ T+0s   Discord 发: "find brisbane roofers"                           │
│                                                                       │
│         ↓ pl-task-listener 路由意图 (regex 或 ollama)                 │
│                                                                       │
│ T+2s   📥 收到了 · 帮你找 Brisbane 的 roofer 客户                     │
│         · 预计 1-2 分钟出结果 · 找到后我会告诉你                       │
│         (task abc123 · 内部记: pl:scrape-docker)                      │
│                                                                       │
│         ↓ Hermes dispatcher 拾任务 · 跑 gosom docker scraper          │
│                                                                       │
│ T+90s  ✓ 找到 12 家 Brisbane roofer                                  │
│         · 8 家有网站 · 4 家无网站 (NO_WEBSITE bonus +40 适用)         │
│         · 全部 discoveryScore ≥ 15 · 已入库为待 audit                  │
│         · master.md skeleton 已自动建好 (含联系方式)                   │
│         · 看清单: <admin URL>/discovery?run=abc123                    │
│                                                                       │
│         技术细节 ↘                                                     │
│         ▼                                                              │
│         task_id: abc123 · duration: 88.4s · gosom returned 12 rows    │
│         entity keys: place_xxx (8), domain_xxx (4)                    │
└─────────────────────────────────────────────────────────────────────┘
```

### 失败模式 · 通知要友好

| 情况 | 现在 (jargon) | 改成 (人话) |
|---|---|---|
| gosom docker 没起 | `❌ 任务 abc123 执行失败 · CLI 退出码 exit=1 · stderr: container "gmaps-scraper-web" not running` | `❌ 抓取失败 · gosom docker 没启动 · 在终端跑 docker start gmaps-scraper-web 重启后 ✅ 重试这条 task` |
| 配额超限 | `❌ exit=1 · PlacesQuotaCapExceeded` | `❌ 今天 Google Places 额度用完了 · 等明天 0:00 重置 · 或用 docker 抓取 (找批量任务建议用 docker)` |
| 0 结果 | `✅ 完成 · 0 rows returned` | `⚠ 0 结果 · 这个 search query 在 GMB 上没匹配 · 试试: 1) 换更具体词 ("Brisbane roof restoration") 2) 加 niche 词 ("roofing contractor") 3) 试相邻区域` |

### 自动出口 · 入库后做的事 (不需要 operator)

```
12 entity 入库后 · 系统自动:
  1. enqueueMasterMdRefresh → 写每 entity 的 master.md skeleton (含联系方式)
  2. 非 thin-contact (有 phone OR website) → 进 SOP-2 audit 队列 (等 dispatcher 拾)
  3. thin-contact (无 phone 无 website) → 触发 enrich task (Tinyfish 等补全)
```

→ operator 干第一步 (Discord 发) · 然后等 2 小时 audit 完。

---

## Flow 2 · M2 · entity → audit → master.md design-ready

### 触发方式 · 现在是手动 · M3 hook 后自动

**现在**: operator Discord 发 `audit <entityKey>` 或在 admin UI 点 "跑 audit"
**M3 hook 后**: M1 入库后非 thin-contact entity → 自动入队 audit (无需手动)

### 时间线 · audit 4 stage

```
┌─────────────────────────────────────────────────────────────────────┐
│ T+0s    audit 开始 · entity: brisbane-roof-restoration-experts        │
│         网站: brisbaneroofrestorationexperts.com.au                   │
│                                                                       │
│ T+5s    [1/4] 内容审计 · 检查 HTTPS / title / phone visibility / form │
│                                                                       │
│ T+10s   ✓ 内容: 4 issues 找到 · 1 关键 (HTTPS 缺) · 3 主要              │
│                                                                       │
│ T+15s   [2/4] 视觉审计 · Claude 看截图打分 (备用: Codex / Ollama)       │
│                                                                       │
│ T+90s   ✓ 视觉: 新鲜度 4/10 · 信任 5/10 · 转化 6/10                   │
│         · 设计年代: 略过时                                              │
│         · 用了 claude_cli (在 cascade · ollama 没掉到)                  │
│                                                                       │
│ T+95s   [3/4] 详细审计 · sitemap · 技术栈 · PageSpeed · DNS · GEO        │
│                                                                       │
│ T+140s  ✓ 详细审计 :                                                   │
│         · 153 页面 (sitemap 已检测)                                    │
│         · WordPress + Google Ads Pixel · 数字成熟度 3/6                │
│         · PageSpeed mobile 64 · CRUX 真实用户体验 SLOW                  │
│         · AI 可发现性 40/100 · 8 项缺失 (FAQ schema / EEAT 等)          │
│                                                                       │
│ T+145s  [4/4] 拍证据图 · desktop / mobile / video / issue 特写         │
│                                                                       │
│ T+170s  ✓ 证据 7 张 issue PNG · video 30s · desktop+mobile 全屏        │
│                                                                       │
│ T+175s  ✅ Audit 完成 · 整体 70/100 · 内部分级 C (轻触)                 │
│                                                                       │
│         · 优势: 4.9★ 21 reviews · 客户口碑强 · "fast response"        │
│         · 痛点: HTTPS 没装 · 表单 18 字段太多 · 移动端电话埋深          │
│         · 上市机会: redesign $X + Social packaging $1500 setup        │
│         · 完整 master.md → clients/<slug>/v2/master.md                │
│         · 内部技术报告 → /audit-reports/<entityKey>/                    │
│                                                                       │
│         自动开了: 没动作 (low_priority C grade)                        │
│         M3 hook 后: A/B grade 会自动出 demo · C 进 batch outreach 队列  │
└─────────────────────────────────────────────────────────────────────┘
```

### 失败模式

| 情况 | 现在 | 改 |
|---|---|---|
| 网站打不开 | `❌ exit=1 · stage 3 failed: ECONNREFUSED` | `❌ 客户网站打不开 (https://X · 连接拒绝) · 可能挂了 / DNS 错 / 防火墙 · 跳过 audit · entity 标 manual_review` |
| Claude vision 失败 fallback | (现在 silent) | `⚠ Claude vision 拿不到 · 自动切 Codex · 已成功 (这次 cascade fallback 是正常的 · 不需要 operator 干预)` |
| Vision cascade 全挂 | (silent fail · visual_freshness = null) | `⚠ 3 个 vision provider 都失败 · 这个 entity 缺视觉审计 · master.md 该 section 会显 "TBD" · 跑 npm run leads:run-pipeline -- --entity-key X 重试` |

### Audit 自动出口 (M3 hook 后)

```
grade A (audit_score ≤ 50 + reviews ≥ 50): 自动出 demo HTML + Discord ping operator
grade B (audit_score 50-70 + 普通 reviews): 自动出 demo HTML + Discord ping
grade C (audit_score ≥ 70 或低交互信号): 进 cold_outreach_queue · batch 发邮件 (低投入)
grade D (audit_score ≥ 80): 跳过 · 网站已经够好 · 投入产出比低
```

---

## Flow 3 · M3 · auto demo · entity audit 完 → reference-adapter → preview HTML

### 触发 · M3 hook 写完后自动

```
audit 完成 → grade router persistLeadGrade → 
  if grade ∈ {A, B}: createTask({ kind: 'demo_build', cli: 'pl:build-from-reference', args: ['--slug', slug] })
  if grade === 'C': createTask({ kind: 'outreach_queued', queue addition })
```

### 时间线

```
┌─────────────────────────────────────────────────────────────────────┐
│ T+0s   audit 刚完 · entity grade=A · 触发 demo_build task             │
│                                                                       │
│ T+2s   🎨 开始做 demo · brisbane-roof-restoration-experts             │
│         · 用 classic-premium-roftix 模板                                │
│         · 预计 3 分钟出结果                                              │
│                                                                       │
│         ↓ dispatcher 跑 pl:build-from-reference                       │
│                                                                       │
│ T+185s ✅ Demo 出炉 · 3 分钟                                           │
│         · 文件: clients/<slug>/v2/concept/reference-adapter/index.html │
│         · 预览: file:// 本地打开 (CF Pages 发布需另跑 publish task)    │
│         · 用了真客户的 21 reviews 中 3 条做 trust quote                  │
│         · audit 痛点已嵌入 hero copy ("HTTPS 没装" 转化角度)            │
│         · 商家名 / 电话 / 地址 / 服务区都已 swap 进                      │
│         · cost: $0.30 (1 次 claude CLI · sonnet-4-5)                  │
│                                                                       │
│         你现在能干的:                                                    │
│         · 看 demo 决定 ✅ 发给客户 / 🔁 重做 / ❌ 跳过                   │
│         · 或加 react 反应: ✅ = 发布 to CF Pages · 🗑 = 弃                │
└─────────────────────────────────────────────────────────────────────┘
```

### 失败模式

| 情况 | 改 |
|---|---|
| claude CLI 不可用 | `❌ Demo 做不了 · claude CLI 不在 PATH · 跑 which claude 检查 · 或用 codex 作 fallback (改 PL_REFERENCE_ADAPTER_MODEL=codex)` |
| reference family 不存在 | `❌ 客户 niche="dental" 还没有 reference site · M3 任务: 复用 round 0 patterns 建 dental family (~6h)` |
| HTML 输出不合法 | `❌ claude 输出不是有效 HTML · 已自动重试 1 次 · 第二次仍失败 · 进 human queue 等 operator 查` |

---

## Flow 4 · M5 (paid 后) · Stripe webhook → photos download → operator 接管

> Matthew 决定: photos 是 **paid-stage** · 不在 preview。

```
┌─────────────────────────────────────────────────────────────────────┐
│ T+0s    Stripe checkout completed · entity X 付费                     │
│                                                                       │
│ T+1s    💳 客户 X 付款完成 · $XXX · 开始接管 demo                       │
│         · 下一步: 自动跑 places-enrich + 下 6 张 GMB 照片                │
│         · 等 photos 到位后 ping operator 复审                          │
│                                                                       │
│         ↓ createTask kind=photos_fetch                                │
│                                                                       │
│ T+30s   📷 photos 下完 · 6 张                                          │
│         · 路径: data/v2/fixtures/places-photos/<key>/photo-0X.jpg     │
│         · cost: $0.042 (Places Photo API)                              │
│         · 操作员现在: 看 6 张 · 挑哪张做 hero · 哪张做 services         │
│         · 不挑也 OK · 默认按 GMB 排序 (photo-01 = hero)                  │
│         · 看图 + 编辑: <admin URL>/customer/<slug>/photos               │
│                                                                       │
│         (operator 决定后 · rebuild HTML 触发 · 替换 reference stock 图) │
└─────────────────────────────────────────────────────────────────────┘
```

**不用 LLM 分类** (Matthew 决定 D24)。 Operator 手挑。GMB 排序通常已经对 (Google ranks by relevance)。

---

## 通知设计标准 (改 dispatcher 代码用)

### 模板结构 (4 块)

```
{emoji} {一句业务结论 · 数字优先}
· {子点 1: 哪些好}
· {子点 2: 哪些缺 / 警告}
· {子点 3: 数字 + cost (如果有)}

你现在能干的: {1-2 个具体动作}

技术细节 ↘
{task_id} {duration} {model used} {raw output 缩起来}
```

### Emoji 含义 (一致)

| Emoji | 含义 |
|---|---|
| 📥 | 收到任务 / 启动 |
| ⏳ | 进行中 / 等 |
| ✓ | 一个 stage 完成 (有结果) |
| ✅ | 整任务完成 (终态) |
| ⚠ | 警告 · 部分失败 · 仍可用 |
| ❌ | 终止失败 · 进 human queue |
| 🔁 | 重试 |
| 🎨 | demo build |
| 💳 | 付款相关 |
| 📷 | photos |
| 🔍 | audit · 查 |

### 业务术语统一 · 不混杂英文 / 技术词

| ❌ 不要写 | ✅ 写成 |
|---|---|
| `kind: scrape` | `批量抓取` |
| `provider: regex` | `用规则识别` |
| `cli: pl:scrape-docker` | `跑 Brisbane 批量抓` (折叠 task 详情到 thread 末) |
| `entity_key: place_chij...` | `12 家屋顶公司` (摘要 · 详情进 admin URL) |
| `exit=0` | `成功` |
| `exit=1` | `失败` (+ 加一句解释) |
| `ECONNREFUSED` | `网站打不开` |
| `provider quota cap exceeded` | `今天 Google 额度用完` |

### Admin URL · 每条通知至少 1 个深链

```
<admin URL>/discovery?run=abc123          # 看本批 lead 清单
<admin URL>/customer/<slug>/audit         # 看 audit 报告
<admin URL>/customer/<slug>/demo          # 看 demo HTML
<admin URL>/customer/<slug>/photos        # M5 photo review
<admin URL>/queue/cold-outreach           # C grade 邮件队列
<admin URL>/tasks?id=abc123               # task 技术详情
```

---

## Operator 视角 · 一天典型流程

```
9:00 AM · Matthew 在 Discord #website-tasks 发: "find brisbane roofers --count 20"
9:02 AM · 📥 收到 · 1-2 min 出结果
9:03 AM · ✓ 找到 20 家屋顶公司 · 14 家有网站 · 6 家无 · 已建 skeleton 看 <admin URL>
9:03 AM · (自动) 14 家入 audit 队列

9:05 AM ~ 9:45 AM · 14 个 audit 平行跑 (Hermes dispatcher max-concurrent 2)
9:05 · 🔍 [1/14] 开始 audit · Brisbane Roof Co
9:08 · ✓ Brisbane Roof Co audit 完 · 65/100 grade B · 看报告
9:08 · (自动 M3 hook) 🎨 开始做 demo
9:11 · ✅ Demo 完 · 看 demo

(parallel · 14 entity audit + 8-10 demo 同时在跑)

10:30 AM · Matthew 桌面: 14 个 demo HTML 等他看
         · A/B grade 8 个 (高优先 personal outreach)
         · C grade 5 个 (进 cold email batch 队列)
         · D grade 1 个 (网站已经好 · 跳过)

10:30-11:00 AM · Matthew 看 8 demo · ✅ 7 个 / 🔁 1 个 (重做 hero 角度)
11:00 AM · ✅ 7 → 自动 publish to <slug>-dev.pages.dev (M3 publish task)
11:30 AM · cold outreach queue 6 封模板邮件 (5 C + 1 改后重过)

next day · 看 reply · 跟进
```

---

## 实施 plan

### Phase 1 · 改 Discord 模板 (~2h)

1. `scripts/cli/pl-task-listener.js` · 改 `lines` 数组 (line 226-231) · 写人话
2. `scripts/cli/pl-task-dispatcher.js` · 改 4 个 `postThreadReply` (lines 331/338/345/357) · 加业务摘要 + 折叠技术细节
3. 加 `core/discord-tasks/humanize.js` · 把 task.kind / status / cli 翻译成人话
4. 加 `core/discord-tasks/admin-deep-link.js` · 生成 admin URL

### Phase 2 · 中间状态通知 (~1h)

audit 4 stage 各发 1 个进展通知 (现在沉默 · 跑完才说)。
- `appendProgress` 已经存在 · 但只写到 task store · 没回 Discord
- 加 `discord_progress: 'silent' | 'verbose'` task flag · stage hook 时 post

### Phase 3 · admin UI 深链 (~3h)

- `<admin URL>/customer/<slug>/audit` · audit 报告 + master.md 嵌入
- `<admin URL>/customer/<slug>/demo` · reference-adapter HTML 预览 + ✅/🔁/❌ 按钮
- `<admin URL>/queue/cold-outreach` · 队列管理

### Phase 4 · live E2E 验证 (~1h)

- 启 listener + dispatcher
- Matthew 在 Discord 真发 1 条
- 验证: 5 个 emoji 阶段都到位 · 没 jargon · admin URL 点开能看到

---

## 这份 SOP 的位置 · 跟代码同步

- 这文档: `docs/v3/SOP-DISCORD-HERMES-FLOW.md`
- D23 规则: 改 code 时必更新这文档 (notifications template / emoji 集 / admin URL schema)
- 测试: 加 `npm run qa:test-discord-message-templates` (~30min · 验证模板没漏字段)
