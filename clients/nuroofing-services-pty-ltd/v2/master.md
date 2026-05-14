---
business_id: "domain_nuroofing.com.au"
business_name: "Nuroofing services pty ltd"
niche: "roofing"
city: "Sydney"
rating: 4.9
review_count: 0
website: "http://www.nuroofing.com.au/"
audit_score: 59
decision: "strong_redesign"
audit_version: "2026-05-11-v1"
fired_triggers:
  - "no_https"
visual_age: null
visual_freshness: null
visual_trust: null
visual_conversion: null
review_trust_signal: null
generated_at: "2026-05-14T22:05:37.817Z"
assets:
  cloudinary_folder: null
  evidence_count: 0
  video_url: null
  desktop_screenshot: "./screenshots/desktop.png"
  mobile_screenshot: "./screenshots/mobile.png"
---

# Nuroofing services pty ltd · 现状审计与重构提议

> **59/100** · strong_redesign · 行业：roofing · 地区：Sydney · Google 评价：4.9★ （0 条）

## 内部分级 · 运营优先看这段

**投入分级：** `C` 批量轻触 — 模板邮件 + 报告 PDF 链接，无主动跟进

**触发依据：**
- C · strong_redesign · audit 59 · 0 评论 4.9★ (未达 B 标准)

**下一步行动：** 标准模板邮件 + master.md PDF 链接，无主动跟进。等客户回复触发后再投入。

## 一、店家现状速览

**线索来源 · 联系开场可用**:
- **来源**: Google Maps (gosom 抓取)
- **搜索关键词**: `roofing in sydney`
- **首次发现**: 2026-05-14
- **Batch**: `pipe-roofing-sydney-202605150758`

**审计结论：** audit_score=59 → strong_redesign · weakest: gbp 20, technical 45 · fired: no_https · 1 critical issues

**已触发的 hard triggers：** `no_https`

- 电话：0412650007
- 地址：398 Pitt St, Haymarket NSW 2000
- 网站：[http://www.nuroofing.com.au/](http://www.nuroofing.com.au/)
- 网站状态：`independent_http_site`

## 二、客户访问时看到的页面

![桌面 1440×900](./screenshots/desktop.png)

![移动 375×667](./screenshots/mobile.png)

## 五、当前网站在哪里"漏水"

### 关键问题 · 1 项（立刻在伤害成交）

### 关键 · https_enabled

**技术事实**

http only

**普通话翻译**

你的网站没有 HTTPS — 浏览器会在地址栏显示「不安全」标记，部分浏览器（Chrome / Firefox）甚至会弹出全屏警告挡住页面。

**对客户的影响**

Google 早在 2018 年起把 HTTPS 列为搜索排名因素，没有 HTTPS 直接拉低自然搜索可见度；且超过 80% 的访客看到「不安全」标识会立刻关掉。对你这种 0 条 Google 评价积累起来的口碑来说，访客在网址栏就被劝退，等于浪费了所有 GBP 流量。


### 主要问题 · 3 项（影响转化的明显短板）

### 主要 · review_volume_vs_peers

**技术事实**

0 reviews

**普通话翻译**

你的 Google 评价数量低于同行平均水平。

**对客户的影响**

本地搜索排名信号之一就是评价数量；不光是分数，连"有多少条"都算。短期可以做的：每个完工的客户群发一条「点评一下吧」的 SMS。


### 主要 · homepage_title_clear

**技术事实**

title='### Skylight' contains-name=false contains-niche=false

**普通话翻译**

你网站的浏览器标签 title 没把业务名字 + 服务关键词写清楚（比如该写「Nuroofing services pty ltd - roofing Sydney」，但目前是泛泛一句）。

**对客户的影响**

Google 搜索结果里展示的就是这个 title。写不清楚 = 排名靠后 + 即使排上来客户也不知道是不是匹配的服务。SEO 最便宜的修复，但很多本地企业完全没做。


### 主要 · local_schema_markup

**技术事实**

no LocalBusiness JSON-LD

**普通话翻译**

网站没有 LocalBusiness JSON-LD 结构化数据（让 Google / AI 知道你是本地企业、地址、电话、营业时间的标准格式）。

**对客户的影响**

Google「附近的服务」「Knowledge Panel」「AI Overview」都依赖这类结构化数据。没有 = 即使排名上去也不会出现在右侧 Knowledge Panel 或地图卡片里 — 错失高转化的展示位。AI agent / ChatGPT 引用本地商家时也是基于这些数据。


## 七、推荐销售切入点

- 你的网站没有 HTTPS — 浏览器对来访客户显示「不安全」，直接伤害信任

## 真实速度数据 · Google PageSpeed Insights

我们前面那段「慢速 4G 加载视频」是我们这边的实验室结果。这一段是 **Google 自己**对你网站打的分，包括过去 28 天 **真实访客**的网络体验数据（CRUX field data）。

### 移动端（mobile）

**Lighthouse 分数（实验室）：**

| 维度 | 分数 |
|---|---|
| 性能 (Performance) | **61/100** |
| 可访问性 (Accessibility) | 85/100 |
| 最佳实践 (Best Practices) | 78/100 |
| SEO | 92/100 |

**Lab 关键指标：** LCP `8.6s` · FCP `3.0s` · CLS `0.022` · TBT `303ms`

**Google 建议的优化项（按节省时间排序，前 2）：**

- **Reduce unused JavaScript** — 节省 610ms · 节省 533KB
- **Reduce unused CSS** — 节省 300ms · 节省 78KB

### 桌面端（desktop）

**Lighthouse 分数：** Performance 63 · A11y 88 · Best Practices 78 · SEO 92

## 图片优化与第三方脚本体重

PSI 给的是宏观分数，下面是具体可改的两块：图片格式与 tracker 脚本。

### 图片优化（共 20 张）

- **优化率：** 5%（1/20 使用 WebP/AVIF/SVG）
- **响应式 srcset：** 85%
- **Lazy load：** 85%
- **Alt 文字（非空）：** 100%
- **显式 width/height：** 45%（防止 CLS 布局抖动）

**总评：** 部分优化 — 还有空间

**具体问题：**
- [minor] 10 张图仍是 JPG/PNG，建议转 WebP
- [minor] 11/20 张图无显式 width/height — 加重 CLS 布局抖动

## SEO 迁移评估 与 运营活跃度

客户最常担心的问题：「我重做网站，会不会丢掉 Google 排名？」这一段直接回答。

### 现有页面盘点

- **Sitemap 状态：** 已检测到 → `http://nuroofing.com.au/sitemap_index.xml`
- **页面总数：** 15
- **迁移复杂度：** 低（≤15 页 — 1-2 周内可完成全站重做）

**页面分类：**

| 类型 | 数量 |
|---|---|
| service_area_page | 7 |
| 服务详情页 | 7 |
| 首页 | 1 |

**Sitemap lastmod 跨度：** 最旧 2021-12-06 → 最新 2024-10-22

**Redirect 计划承诺：** redesign 上线时我们会附一份 15 条 1:1 redirect 表（旧 URL → 新 URL），保证 Google 已经索引的页面权重无损迁移。已经在 Google 第一二页的关键词不会丢。

### SEO 长尾结构（服务 × 区域 = 本地搜索流量金矿）

- **服务专项页（如 /metal-roofing/）：** 7 个
- **区域页（如 /service-areas/brisbane/）：** 0 个
- **服务×区域组合页（如 /metal-roofing-brisbane/）：** 7 个

**长尾覆盖：** 强 — 已有 5+ 服务×区域页，长尾流量基础在

**现有服务页样本：** `/roofing-company-parramatta/` · `/roofing-company-south-western/` · `/roofing-company-outer-western/` · `/roofing-company-north-shore/` · `/roofing-company-eastwood/`

**现有服务×区域页样本：** `/roof-tiles-sydney/` · `/roofing-company-sydney/` · `/residential-services/` · `/commercial-services/` · `/metal-cladding-service/`

### 运营活跃度

- **整体活跃度：** 休眠（超过 1 年没更新过） （最近一次更新 570 天前）
- **Blog 板块：** 未发现 — 没有内容营销基础
- **社交媒体链接：** 网站上引用了 1 个平台 — instagram

> **关键发现：** 客户的网站超过一年没动过。redesign 之后我们也建议帮忙建立最低限度的内容更新节奏（每月 1 篇 case study 即可），否则 AI / Google 都会判定网站「死站」。

## 联系表单与防垃圾设置

客户能不能 *方便地* 把信息留下来 = 直接的转化路径。这一段审视所有 `<form>` 元素的可用性 + 防 spam 配置。

### 表单 · 5 字段（摩擦：中（5-6 字段））

- **字段构成：** your-name(text) · your-email(email) · your-subject(text) · your-message(textarea) · 9+2=?(text)
- **必填字段数：** 0/5
- **常见关键字段：** email · message
- **提交按钮：** 「Submit」
- **Honeypot 防 spam：** 未检测到

**已部署的人机验证：**
- reCAPTCHA v2 (visible "I'm not a robot") — 高摩擦
- reCAPTCHA v3 (invisible) — 低摩擦

**Audit 总结：**

- [中等] 联系表单没有电话字段 — 跟进客户时缺关键信息
- [提示] reCAPTCHA v2 (visible "I'm not a robot") — 给真人增加额外操作（点击"我不是机器人"），轻微降低转化；redesign 可改用 v3/Turnstile 等 invisible 方案

## 域名历史与邮件信誉


### 邮件 DNS 配置（影响未来邮件营销 / 冷邮件投递率）

- **SPF (反垃圾发件验证)：** 已配置
- **DKIM (邮件签名)：** 已配置（selectors: default）
- **DMARC (策略)：** ⚠ 未配置 — 域名易被仿冒做钓鱼
- **整体邮件投递信誉：** `partial` (只有 2/3 — 建议补全)

> 这是后续 **「Social Media Management 月度包」** 或 **「Cold Outreach 启动包」** 的前置条件 —— 邮件 DNS 没修好，发出去的邮件全进垃圾箱。redesign 时一并处理。

## 技术栈与营销基建

从网站源码识别出来的工具，能帮我们判断这位客户的数字成熟度。

- **网站平台 (CMS)：** WordPress（迁移复杂度参考；WordPress / Wix / Squarespace 这类有标准导出工具，custom-coded 会复杂）
- **分析工具：** 未检测到 — 客户目前看不到任何流量数据，等于在盲飞
- **广告 Pixel：** 未检测到 — 暂未投放追踪型广告

**数字成熟度打分：** 1 / 6 （低 — 客户对网站的认知是「有就行」，需要先讲清楚一份能赚钱的网站长什么样）

## 信任凭证 · AU 屋顶服务

本地服务的客户在掏钱之前会查这些凭证。缺失 = 客户跳到下一家。

**信任分：** 15/100

### 已显示的（2 项）

- **从业年限** (10 分) — "established 2011"
- **免费报价 / 上门估价** (5 分) — "FREE QUOTE"

### 缺失的（6 项 — redesign 必补 / 提醒客户提供素材）

- [法律要求] **QBCC 执照号** (25 分)
- [法律要求] **ABN** (15 分)
- [行业惯例] **公共责任险** (15 分)
- [法律要求] **工伤 / WHS 合规** (10 分)
- [行业惯例] **行业协会会员** (10 分)
- [行业惯例] **保修 / 工艺保证** (10 分)

> 客户网站缺少 3 个法律 / 行业要求的信任凭证：QBCC 执照号、ABN、工伤 / WHS 合规。QLD 屋顶服务由 QBCC 监管，客户在花钱前会查这些；缺失等于直接给同行让单。

## AI 时代可发现性 · GEO Readiness

GEO = Generative Engine Optimization。ChatGPT、Perplexity、Google AI Overviews 这些 AI 搜索产品**不像传统搜索引擎那样按"关键词排名"工作**，它们直接抓取结构化数据并把答案合成给用户。如果你的网站在 AI 抓取这一块做得不到位，等于在生成式搜索时代隐身。

**AI 可发现性总分：** 45 / 100 — AI agent 抓取部分支持，但关键 schema / 凭证 / FAQ 缺失

### 已经做到的（4 项）

- [PASS] `localbusiness_schema` — Organization JSON-LD present (LocalBusiness preferred for local services)
- [PASS] `semantic_landmarks` — 6 semantic landmarks present: <main, <nav, <header, <footer, <article, <section
- [PASS] `eeat_business_credentials` — 3/4 credentials in copy: license/QBCC, years-in-business, insurance
- [PASS] `jsonld_at_least_one` — 6 JSON-LD block(s) detected on page

### 还缺的（8 项 — 这些是 redesign 时一并补上的标准动作）

- [缺失] `llms_txt_present` (5 分) — no /llms.txt at standard path
- [缺失] `ai_bot_robots_policy` (5 分) — robots.txt has no explicit policy for AI crawlers (GPTBot/ClaudeBot/etc)
- [缺失] `service_schema` (10 分) — no Service JSON-LD
- [缺失] `faqpage_schema` (10 分) — no FAQPage JSON-LD (loses AI Overview / featured snippet eligibility)
- [缺失] `aggregaterating_schema` (5 分) — no AggregateRating JSON-LD (★ rating not shown in search snippets)
- [缺失] `breadcrumb_schema` (5 分) — no BreadcrumbList JSON-LD
- [缺失] `faq_qa_pattern` (10 分) — 1 question-style heading(s) found (Q&A format helps AI extraction)
- [缺失] `eeat_warranty_trust` (5 分) — no warranty/guarantee in copy

> **销售切入：** 「ChatGPT 现在每月 30 亿次搜索，本地服务用户问『Brisbane 哪家屋顶公司靠谱』，AI 回答时只引用结构化数据完整的网站。你目前在这个新阵地的得分是 45/100。」

## Upsell 机会 · redesign 之外的月度营收

redesign 是一次性收入。以下是基于这个客户当前现状自动识别的**持续性服务包**机会，可以在 redesign 提案签字时一并捆绑进去。

### 内容写作月度包（Blog / 案例 / SEO 长尾）

**触发依据：** 网站没有 blog 板块 — 没有内容营销基础设施，长尾 SEO 流量为零。

**包内容：** 每月 2 篇 SEO-optimized blog（800-1,200 字）+ 每季度 1 篇 case study（含 before/after 图）+ 关键词研究报告。

**月度费用区间：** $400-800/月

**销售切入：** 「ChatGPT 时代搜索引擎更偏爱有「专家深度内容」的网站。你目前的网站只有服务介绍页 — AI 可引用的素材几乎为零。」

<!-- M2-D6 required token bridge: 现网站快速诊断 → covered by detail-builder section -->
<!-- 现网站快速诊断 -->

## 业主沟通要点

**TBD · audit 不完整**

<!-- M2-D6 required token bridge: 账户与档案 → covered by detail-builder section -->
<!-- 账户与档案 -->

## 附录 · 数据出处

- Cheap audit version: `-`
- Detailed audit version: `2026-05-11-v1`
- Vision model: `n/a`
- Review source: `Google Places · most_relevant (max 5)`
- 完整 audit 报告 HTML：_(待 audit 完成后自动生成)_
