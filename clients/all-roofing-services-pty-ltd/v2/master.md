---
business_id: "domain_allroofingservices.com.au"
business_name: "All Roofing Services Pty Ltd"
niche: "roofing"
city: "Sydney"
rating: 4.8
review_count: 0
website: "http://www.allroofingservices.com.au/"
audit_score: 57
decision: "strong_redesign"
audit_version: "2026-05-11-v1"
fired_triggers:
  - "no_https"
visual_age: null
visual_freshness: null
visual_trust: null
visual_conversion: null
review_trust_signal: null
generated_at: "2026-05-14T22:05:46.665Z"
assets:
  cloudinary_folder: null
  evidence_count: 0
  video_url: null
  desktop_screenshot: "./screenshots/desktop.png"
  mobile_screenshot: "./screenshots/mobile.png"
---

# All Roofing Services Pty Ltd · 现状审计与重构提议

> **57/100** · strong_redesign · 行业：roofing · 地区：Sydney · Google 评价：4.8★ （0 条）

## 内部分级 · 运营优先看这段

**投入分级：** `D` 跳过 — 不投入精力

**触发依据：**
- [hard skip · too_many_pages] 现有网站超过 200 页 — 迁移成本失控

**下一步行动：** 不投入精力，归档原因。';

## 一、店家现状速览

**线索来源 · 联系开场可用**:
- **来源**: Google Maps (gosom 抓取)
- **搜索关键词**: `roofing in sydney`
- **首次发现**: 2026-05-14
- **Batch**: `pipe-roofing-sydney-202605150758`

**审计结论：** audit_score=57 → strong_redesign · weakest: gbp 20, technical 45 · fired: no_https · 2 critical issues

**已触发的 hard triggers：** `no_https`

- 电话：(02)80862059
- 地址：618 Parramatta Rd, Croydon NSW 2132
- 网站：[http://www.allroofingservices.com.au/](http://www.allroofingservices.com.au/)
- 网站状态：`independent_http_site`

## 二、客户访问时看到的页面

![桌面 1440×900](./screenshots/desktop.png)

![移动 375×667](./screenshots/mobile.png)

## 五、当前网站在哪里"漏水"

### 关键问题 · 2 项（立刻在伤害成交）

### 关键 · https_enabled

**技术事实**

http only

**普通话翻译**

你的网站没有 HTTPS — 浏览器会在地址栏显示「不安全」标记，部分浏览器（Chrome / Firefox）甚至会弹出全屏警告挡住页面。

**对客户的影响**

Google 早在 2018 年起把 HTTPS 列为搜索排名因素，没有 HTTPS 直接拉低自然搜索可见度；且超过 80% 的访客看到「不安全」标识会立刻关掉。对你这种 0 条 Google 评价积累起来的口碑来说，访客在网址栏就被劝退，等于浪费了所有 GBP 流量。


### 关键 · phone_visible_above_fold

**技术事实**

phone hidden below fold or missing

**普通话翻译**

电话号码在第一屏看不到 — 客户必须滚动才能找到怎么联系你。

**对客户的影响**

本地服务客户 60-70% 倾向打电话沟通（不是填表单）。电话号没在第一屏 = 这部分客户里很多人会直接关掉去搜下一家。这是最便宜的转化优化之一。


### 主要问题 · 2 项（影响转化的明显短板）

### 主要 · review_volume_vs_peers

**技术事实**

0 reviews

**普通话翻译**

你的 Google 评价数量低于同行平均水平。

**对客户的影响**

本地搜索排名信号之一就是评价数量；不光是分数，连"有多少条"都算。短期可以做的：每个完工的客户群发一条「点评一下吧」的 SMS。


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
| 性能 (Performance) | **31/100** |
| 可访问性 (Accessibility) | 93/100 |
| 最佳实践 (Best Practices) | 96/100 |
| SEO | 92/100 |

**Lab 关键指标：** LCP `10.1s` · FCP `9.3s` · CLS `0.000` · TBT `1238ms`

**Google 建议的优化项（按节省时间排序，前 4）：**

- **Reduce unused CSS** — 节省 3740ms · 节省 736KB
- **Reduce unused JavaScript** — 节省 750ms · 节省 1450KB
- **Initial server response time was short** — 节省 429ms
- **Minify JavaScript** — 节省 13KB

### 桌面端（desktop）

**Lighthouse 分数：** Performance 50 · A11y 93 · Best Practices 96 · SEO 92

## 图片优化与第三方脚本体重

PSI 给的是宏观分数，下面是具体可改的两块：图片格式与 tracker 脚本。

### 图片优化（共 13 张）

- **优化率：** 8%（1/13 使用 WebP/AVIF/SVG）
- **响应式 srcset：** 77%
- **Lazy load：** 31%
- **Alt 文字（非空）：** 38%
- **显式 width/height：** 92%（防止 CLS 布局抖动）

**总评：** 部分优化 — 还有空间

**具体问题：**
- [minor] 12 张图仍是 JPG/PNG，建议转 WebP
- [minor] 9/13 张图未 lazy load — 首屏外的图阻塞主线程
- [major] 8/13 张图缺 alt 文字 — 影响 SEO + 可访问性 + AI 抓取

### 第三方脚本占用情况

- **总请求数：** 103（77 自有 + 26 第三方）
- **第三方占总下载量：** 12%（835 KB / 7254 KB）
- **Tracker 脚本数：** 5（合计 413 KB）

**已识别的 tracker：**

| 工具 | 类型 | 请求数 | 字节 |
|---|---|---|---|
| Google Tag Manager | analytics | 3 | 410.9 KB |
| DoubleClick | ad_serving | 1 | 2.1 KB |
| Google Analytics | analytics | 1 | 0.0 KB |

> **观察：** 5 个 tracker 合计加载了 413 KB —— 这些都是阻塞主线程的脚本，是性能 + 隐私双角度的销售切入点。redesign 时可以建议清理不再使用的 tracker。

## SEO 迁移评估 与 运营活跃度

客户最常担心的问题：「我重做网站，会不会丢掉 Google 排名？」这一段直接回答。

### 现有页面盘点

- **Sitemap 状态：** 已检测到 → `https://www.allroofingservices.com.au/sitemap_index.xml`
- **页面总数：** 313
- **迁移复杂度：** 高（>80 页 — 需要分阶段迁移 + 完整 redirect map）

**页面分类：**

| 类型 | 数量 |
|---|---|
| 顶层页面 | 124 |
| service_area_page | 69 |
| 服务详情页 | 65 |
| area_page | 23 |
| 内页 | 15 |
| 关于 / 团队 | 3 |
| 客户评价 | 3 |
| Blog 文章 | 3 |
| 联系 / 报价 | 3 |
| 法律 / 隐私 | 2 |
| 作品集 / 案例 | 2 |
| 首页 | 1 |

**Sitemap lastmod 跨度：** 最旧 2013-04-11 → 最新 2025-10-26

**Redirect 计划承诺：** redesign 上线时我们会附一份 50 条 1:1 redirect 表（旧 URL → 新 URL），保证 Google 已经索引的页面权重无损迁移。已经在 Google 第一二页的关键词不会丢。

### SEO 长尾结构（服务 × 区域 = 本地搜索流量金矿）

- **服务专项页（如 /metal-roofing/）：** 65 个
- **区域页（如 /service-areas/brisbane/）：** 23 个
- **服务×区域组合页（如 /metal-roofing-brisbane/）：** 69 个

**长尾覆盖：** 强 — 已有 5+ 服务×区域页，长尾流量基础在

**现有服务页样本：** `/roof-restoration/` · `/installing-a-colorbond-roof/` · `/times-when-you-need-to-call-a-roof-plumber/` · `/roofing-success/` · `/mould-and-roof-leaks/`

**现有服务×区域页样本：** `/the-advantages-offered-by-metal-roofing/` · `/roof-replacement-finished/` · `/roof-repair-in-sydney/` · `/residential-roof-replacements/` · `/dont-ignore-the-leak/`

### 运营活跃度

- **整体活跃度：** 停滞（超过 3 个月没动） （最近一次更新 201 天前）
- **Blog 板块：** 有，共 3 篇文章 
- **社交媒体链接：** 网站上引用了 3 个平台 — facebook, instagram, pinterest

## 联系表单与防垃圾设置

客户能不能 *方便地* 把信息留下来 = 直接的转化路径。这一段审视所有 `<form>` 元素的可用性 + 防 spam 配置。

### 表单 · 29 字段（摩擦：高（≥7 字段，会显著降低转化））

- **字段构成：** Your Name*(text) · Company Name(text) · Phone Number*(tel) · Your Email*(email) · Job Address*(text) · Your Suburb*(text) · Residential(checkbox) · Commercial(checkbox) · Industrial(checkbox) · Government(checkbox) · School / University(checkbox) · 1 Storey(checkbox) · 2 Storey(checkbox) · Higher(checkbox) · Roof Repair(checkbox) · Re-Roof(checkbox) · Roof Replacement(checkbox) · Roof Maintenance(checkbox) · Guttering(checkbox) · Other(checkbox) · Please select the Type of New Roof Required:(select-one) · Metal/Colorbond(checkbox) · Tile(checkbox) · Slate(checkbox) · Asbestos(checkbox) · Your Message(textarea) · g-recaptcha-response(textarea) · apbct__email_id__gravity_form(text) · Δ(textarea)
- **必填字段数：** 0/29
- **常见关键字段：** email · phone · message
- **提交按钮：** 「Submit」
- **Honeypot 防 spam：** 未检测到

### 表单 · 4 字段（摩擦：低（≤4 字段，转化友好））

- **字段构成：** Email*(email) · g-recaptcha-response(textarea) · apbct__email_id__gravity_form(text) · Δ(textarea)
- **必填字段数：** 0/4
- **常见关键字段：** email · message
- **提交按钮：** 「Click Here」
- **Honeypot 防 spam：** 未检测到

**已部署的人机验证：**
- reCAPTCHA v2 (visible "I'm not a robot") — 高摩擦
- Akismet (WordPress comment spam) — 不可见

**Audit 总结：**

- [关键] 表单字段数 29 — 远超行业标准 3-4 字段，会显著降低转化率
- [中等] 联系表单没有电话字段 — 跟进客户时缺关键信息
- [提示] reCAPTCHA v2 (visible "I'm not a robot") — 给真人增加额外操作（点击"我不是机器人"），轻微降低转化；redesign 可改用 v3/Turnstile 等 invisible 方案

## 域名历史与邮件信誉


### 邮件 DNS 配置（影响未来邮件营销 / 冷邮件投递率）

- **SPF (反垃圾发件验证)：** 已配置
- **DKIM (邮件签名)：** 已配置（selectors: default, selector1, selector2）
- **DMARC (策略)：** 已配置（policy: `none`）
- **整体邮件投递信誉：** `strong` (SPF + DKIM + DMARC 齐全)

## 技术栈与营销基建

从网站源码识别出来的工具，能帮我们判断这位客户的数字成熟度。

- **网站平台 (CMS)：** WordPress（迁移复杂度参考；WordPress / Wix / Squarespace 这类有标准导出工具，custom-coded 会复杂）
- **分析工具：** Google Tag Manager · Google Analytics 4
- **广告 Pixel：** Google Ads Conversion — 客户已经在投放（或投放过）付费广告，对营销预算不陌生

**数字成熟度打分：** 4 / 6 （高 — 客户懂数字营销，redesign 谈预算时不必从零教育）

### Redesign 时必须保留 / 重新安装的追踪代码

客户可能有数月 / 数年的历史数据 + 广告投放受众 sit 在这些 ID 上面。重做时**必须用同一套 ID 重新接进新网站**，否则等于清零所有累积。

- Google Tag Manager
- Google Analytics 4
- Google Ads Conversion

我们 redesign 交付清单会把这些列为「必须 setup 项」。

## 信任凭证 · AU 屋顶服务

本地服务的客户在掏钱之前会查这些凭证。缺失 = 客户跳到下一家。

**信任分：** 40/100

### 已显示的（4 项）

- **公共责任险** (15 分) — "fully insured"
- **从业年限** (10 分) — "over 20 years"
- **保修 / 工艺保证** (10 分) — "7-year guarantee"
- **免费报价 / 上门估价** (5 分) — "free quote"

### 缺失的（4 项 — redesign 必补 / 提醒客户提供素材）

- [法律要求] **QBCC 执照号** (25 分)
- [法律要求] **ABN** (15 分)
- [法律要求] **工伤 / WHS 合规** (10 分)
- [行业惯例] **行业协会会员** (10 分)

> 客户网站缺少 3 个法律 / 行业要求的信任凭证：QBCC 执照号、ABN、工伤 / WHS 合规。QLD 屋顶服务由 QBCC 监管，客户在花钱前会查这些；缺失等于直接给同行让单。

## AI 时代可发现性 · GEO Readiness

GEO = Generative Engine Optimization。ChatGPT、Perplexity、Google AI Overviews 这些 AI 搜索产品**不像传统搜索引擎那样按"关键词排名"工作**，它们直接抓取结构化数据并把答案合成给用户。如果你的网站在 AI 抓取这一块做得不到位，等于在生成式搜索时代隐身。

**AI 可发现性总分：** 55 / 100 — AI agent 抓取部分支持，但关键 schema / 凭证 / FAQ 缺失

### 已经做到的（6 项）

- [PASS] `localbusiness_schema` — Organization JSON-LD present (LocalBusiness preferred for local services)
- [PASS] `breadcrumb_schema` — BreadcrumbList JSON-LD present
- [PASS] `semantic_landmarks` — 6 semantic landmarks present: <main, <nav, <header, <footer, <article, <section
- [PASS] `eeat_business_credentials` — 2/4 credentials in copy: license/QBCC, insurance
- [PASS] `eeat_warranty_trust` — warranty/guarantee mentioned
- [PASS] `jsonld_at_least_one` — 5 JSON-LD block(s) detected on page

### 还缺的（6 项 — 这些是 redesign 时一并补上的标准动作）

- [缺失] `llms_txt_present` (5 分) — no /llms.txt at standard path
- [缺失] `ai_bot_robots_policy` (5 分) — robots.txt has no explicit policy for AI crawlers (GPTBot/ClaudeBot/etc)
- [缺失] `service_schema` (10 分) — no Service JSON-LD
- [缺失] `faqpage_schema` (10 分) — no FAQPage JSON-LD (loses AI Overview / featured snippet eligibility)
- [缺失] `aggregaterating_schema` (5 分) — no AggregateRating JSON-LD (★ rating not shown in search snippets)
- [缺失] `faq_qa_pattern` (10 分) — 0 question-style heading(s) found (Q&A format helps AI extraction)

> **销售切入：** 「ChatGPT 现在每月 30 亿次搜索，本地服务用户问『Brisbane 哪家屋顶公司靠谱』，AI 回答时只引用结构化数据完整的网站。你目前在这个新阵地的得分是 55/100。」

## 业务规模信号 · 内部筛选用

**注：这一段只给运营内部看，不进入客户报告。** 用来判断这个 lead 是不是匹配我们「小网站 / 多批量 / 快上线」的产品定位。

- **规模信号汇总：** 中型客户特征
- **客户分级：** `mid` — 中型客户，可接但价格要往上提（基础包 + 配置项）

> 报价以上方 **建议报价** 为准（来自 entity.grade.recommended_pricing / PRODUCT_TIER_TABLE）。本段只用来判断 lead 是否匹配产品定位，不竞争报价。

**触发依据：**
- 网站页面数 313（≥300，复杂多服务体系）
- 已部署 3 个追踪工具

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
