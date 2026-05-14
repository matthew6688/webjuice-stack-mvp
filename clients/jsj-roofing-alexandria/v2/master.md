---
business_id: "domain_jsjroofing.com.au"
business_name: "JSJ Roofing - Alexandria"
niche: "roofing"
city: "Sydney"
rating: 5
review_count: 0
website: "https://jsjroofing.com.au/"
audit_score: 49
decision: "strong_redesign"
audit_version: "2026-05-11-v1"
fired_triggers: []
visual_age: null
visual_freshness: null
visual_trust: null
visual_conversion: null
review_trust_signal: null
generated_at: "2026-05-14T22:04:55.587Z"
assets:
  cloudinary_folder: null
  evidence_count: 0
  video_url: null
  desktop_screenshot: "./screenshots/desktop.png"
  mobile_screenshot: "./screenshots/mobile.png"
---

# JSJ Roofing - Alexandria · 现状审计与重构提议

> **49/100** · strong_redesign · 行业：roofing · 地区：Sydney · Google 评价：5★ （0 条）

## 内部分级 · 运营优先看这段

**投入分级：** `C` 批量轻触 — 模板邮件 + 报告 PDF 链接，无主动跟进

**触发依据：**
- C · strong_redesign · audit 49 · 0 评论 5★ (未达 B 标准)

**下一步行动：** 标准模板邮件 + master.md PDF 链接，无主动跟进。等客户回复触发后再投入。

## 一、店家现状速览

**线索来源 · 联系开场可用**:
- **来源**: Google Maps (gosom 抓取)
- **搜索关键词**: `roofing in sydney`
- **首次发现**: 2026-05-14
- **Batch**: `pipe-roofing-sydney-202605150758`

**审计结论：** audit_score=49 → strong_redesign · weakest: gbp 20, ux_conversion 35 · 1 critical issues

- 电话：0435848688
- 地址：Unit 5/45/51 Huntley St, Alexandria NSW 2015
- 网站：[https://jsjroofing.com.au/](https://jsjroofing.com.au/)
- 网站状态：`independent_https_site`

## 二、客户访问时看到的页面

![桌面 1440×900](./screenshots/desktop.png)

![移动 375×667](./screenshots/mobile.png)

## 五、当前网站在哪里"漏水"

### 关键问题 · 1 项（立刻在伤害成交）

### 关键 · phone_visible_above_fold

**技术事实**

phone hidden below fold or missing

**普通话翻译**

电话号码在第一屏看不到 — 客户必须滚动才能找到怎么联系你。

**对客户的影响**

本地服务客户 60-70% 倾向打电话沟通（不是填表单）。电话号没在第一屏 = 这部分客户里很多人会直接关掉去搜下一家。这是最便宜的转化优化之一。


### 主要问题 · 4 项（影响转化的明显短板）

### 主要 · review_volume_vs_peers

**技术事实**

0 reviews

**普通话翻译**

你的 Google 评价数量低于同行平均水平。

**对客户的影响**

本地搜索排名信号之一就是评价数量；不光是分数，连"有多少条"都算。短期可以做的：每个完工的客户群发一条「点评一下吧」的 SMS。


### 主要 · click_to_call_link

**技术事实**

no tel: link

**普通话翻译**

电话号码不是 click-to-call 链接（手机上点击不会自动拨号）。

**对客户的影响**

移动客户必须复制号码再切到拨号界面再粘贴 — 每多一步操作就流失一批客户。修复成本只是把 `<a href="tel:0712345678">` 写对，但能立刻拉高电话转化率。


### 主要 · h1_unique

**技术事实**

24 <h1> tags

**普通话翻译**

页面要么没有 H1 标题（搜索引擎无法理解页面主旨），要么有多个 H1（搜索引擎不知道哪个是主题）。

**对客户的影响**

H1 是搜索引擎判断页面主题最权威的信号。写错或缺失 = 关键词排名拉低；同一页面同样的内容，H1 写对的可以排到前 3 页，写不对的可能挂在第 7 页。


### 主要 · local_schema_markup

**技术事实**

no LocalBusiness JSON-LD

**普通话翻译**

网站没有 LocalBusiness JSON-LD 结构化数据（让 Google / AI 知道你是本地企业、地址、电话、营业时间的标准格式）。

**对客户的影响**

Google「附近的服务」「Knowledge Panel」「AI Overview」都依赖这类结构化数据。没有 = 即使排名上去也不会出现在右侧 Knowledge Panel 或地图卡片里 — 错失高转化的展示位。AI agent / ChatGPT 引用本地商家时也是基于这些数据。


## 真实速度数据 · Google PageSpeed Insights

我们前面那段「慢速 4G 加载视频」是我们这边的实验室结果。这一段是 **Google 自己**对你网站打的分，包括过去 28 天 **真实访客**的网络体验数据（CRUX field data）。

### 移动端（mobile）

**Lighthouse 分数（实验室）：**

| 维度 | 分数 |
|---|---|
| 性能 (Performance) | **69/100** |
| 可访问性 (Accessibility) | 89/100 |
| 最佳实践 (Best Practices) | 96/100 |
| SEO | 92/100 |

**Lab 关键指标：** LCP `6.1s` · FCP `2.6s` · CLS `0.000` · TBT `235ms`

**Google 建议的优化项（按节省时间排序，前 2）：**

- **Reduce unused JavaScript** — 节省 780ms · 节省 482KB
- **Reduce unused CSS** — 节省 41KB

### 桌面端（desktop）

**Lighthouse 分数：** Performance 89 · A11y 98 · Best Practices 100 · SEO 92

## 图片优化与第三方脚本体重

PSI 给的是宏观分数，下面是具体可改的两块：图片格式与 tracker 脚本。

### 图片优化（共 24 张）

- **优化率：** 0%（0/24 使用 WebP/AVIF/SVG）
- **响应式 srcset：** 0%
- **Lazy load：** 0%
- **Alt 文字（非空）：** 100%
- **显式 width/height：** 100%（防止 CLS 布局抖动）

**总评：** 基本未优化 — redesign 可显著降低图片下载量

**具体问题：**
- [major] 24 张图几乎全是 JPG/PNG，未用 WebP/AVIF — 估算可节省 30-50% 图片下载量
- [minor] 24/24 张图无响应式 srcset — 移动端浪费带宽
- [minor] 24/24 张图未 lazy load — 首屏外的图阻塞主线程

### 第三方脚本占用情况

- **总请求数：** 36（23 自有 + 13 第三方）
- **第三方占总下载量：** 46%（682 KB / 1482 KB）
- **Tracker 脚本数：** 3（合计 275 KB）

**已识别的 tracker：**

| 工具 | 类型 | 请求数 | 字节 |
|---|---|---|---|
| Google Tag Manager | analytics | 2 | 274.6 KB |
| Google Analytics | analytics | 1 | 0.0 KB |

> **观察：** 3 个 tracker 合计加载了 275 KB —— 这些都是阻塞主线程的脚本，是性能 + 隐私双角度的销售切入点。redesign 时可以建议清理不再使用的 tracker。

## SEO 迁移评估 与 运营活跃度

客户最常担心的问题：「我重做网站，会不会丢掉 Google 排名？」这一段直接回答。

### 现有页面盘点

- **Sitemap 状态：** 已检测到 → `https://www.jsjroofing.com.au/sitemap_index.xml`
- **页面总数：** 60
- **迁移复杂度：** 中（≤80 页 — 服务页 + 部分 blog）

**页面分类：**

| 类型 | 数量 |
|---|---|
| service_area_page | 45 |
| 内页 | 4 |
| area_page | 3 |
| 服务详情页 | 3 |
| 首页 | 1 |
| 客户评价 | 1 |
| 关于 / 团队 | 1 |
| 顶层页面 | 1 |
| 联系 / 报价 | 1 |

**Sitemap lastmod 跨度：** 最旧 2017-09-29 → 最新 2025-07-03

**Redirect 计划承诺：** redesign 上线时我们会附一份 50 条 1:1 redirect 表（旧 URL → 新 URL），保证 Google 已经索引的页面权重无损迁移。已经在 Google 第一二页的关键词不会丢。

### SEO 长尾结构（服务 × 区域 = 本地搜索流量金矿）

- **服务专项页（如 /metal-roofing/）：** 3 个
- **区域页（如 /service-areas/brisbane/）：** 3 个
- **服务×区域组合页（如 /metal-roofing-brisbane/）：** 45 个

**长尾覆盖：** 强 — 已有 5+ 服务×区域页，长尾流量基础在

**现有服务页样本：** `/home/box-gutters-2/` · `/home/gutter-cleaning-2/` · `/home/re-roofing-2/`

**现有服务×区域页样本：** `/roofing-services/` · `/roofing-services/box-gutter-replacement/` · `/roofing-services/gutter-cleaning/` · `/roofing-services/leaf-screens/` · `/roofing-services/re-roofing/`

### 运营活跃度

- **整体活跃度：** 停滞（超过 3 个月没动） （最近一次更新 316 天前）
- **Blog 板块：** 未发现 — 没有内容营销基础
- **社交媒体链接：** 网站上引用了 2 个平台 — facebook, youtube

## 域名历史与邮件信誉


### 邮件 DNS 配置（影响未来邮件营销 / 冷邮件投递率）

- **SPF (反垃圾发件验证)：** 已配置
- **DKIM (邮件签名)：** ⚠ 常见 selector 未发现 DKIM 配置（不一定确凿，但提示有问题）
- **DMARC (策略)：** 已配置（policy: `none`）
- **整体邮件投递信誉：** `partial` (只有 2/3 — 建议补全)

> 这是后续 **「Social Media Management 月度包」** 或 **「Cold Outreach 启动包」** 的前置条件 —— 邮件 DNS 没修好，发出去的邮件全进垃圾箱。redesign 时一并处理。

## 技术栈与营销基建

从网站源码识别出来的工具，能帮我们判断这位客户的数字成熟度。

- **网站平台 (CMS)：** WordPress（迁移复杂度参考；WordPress / Wix / Squarespace 这类有标准导出工具，custom-coded 会复杂）
- **分析工具：** Google Tag Manager · Google Analytics 4
- **广告 Pixel：** 未检测到 — 暂未投放追踪型广告

**数字成熟度打分：** 2 / 6 （中 — 已有基础设施，缺少深度运营）

### Redesign 时必须保留 / 重新安装的追踪代码

客户可能有数月 / 数年的历史数据 + 广告投放受众 sit 在这些 ID 上面。重做时**必须用同一套 ID 重新接进新网站**，否则等于清零所有累积。

- Google Tag Manager
- Google Analytics 4

我们 redesign 交付清单会把这些列为「必须 setup 项」。

## 信任凭证 · AU 屋顶服务

本地服务的客户在掏钱之前会查这些凭证。缺失 = 客户跳到下一家。

**信任分：** 20/100

### 已显示的（2 项）

- **从业年限** (10 分) — "over 30 years"
- **行业协会会员** (10 分) — "HIA"

### 缺失的（6 项 — redesign 必补 / 提醒客户提供素材）

- [法律要求] **QBCC 执照号** (25 分)
- [法律要求] **ABN** (15 分)
- [行业惯例] **公共责任险** (15 分)
- [法律要求] **工伤 / WHS 合规** (10 分)
- [行业惯例] **保修 / 工艺保证** (10 分)
- [行业惯例] **免费报价 / 上门估价** (5 分)

> 客户网站缺少 3 个法律 / 行业要求的信任凭证：QBCC 执照号、ABN、工伤 / WHS 合规。QLD 屋顶服务由 QBCC 监管，客户在花钱前会查这些；缺失等于直接给同行让单。

## AI 时代可发现性 · GEO Readiness

GEO = Generative Engine Optimization。ChatGPT、Perplexity、Google AI Overviews 这些 AI 搜索产品**不像传统搜索引擎那样按"关键词排名"工作**，它们直接抓取结构化数据并把答案合成给用户。如果你的网站在 AI 抓取这一块做得不到位，等于在生成式搜索时代隐身。

**AI 可发现性总分：** 35 / 100 — AI agent / ChatGPT 几乎无法准确引用此网站 — 在生成式搜索时代等于隐身

### 已经做到的（5 项）

- [PASS] `llms_txt_present` — llms.txt found (1087 bytes)
- [PASS] `breadcrumb_schema` — BreadcrumbList JSON-LD present
- [PASS] `semantic_landmarks` — 6 semantic landmarks present: <main, <nav, <header, <footer, <article, <section
- [PASS] `eeat_warranty_trust` — warranty/guarantee mentioned
- [PASS] `jsonld_at_least_one` — 3 JSON-LD block(s) detected on page

### 还缺的（7 项 — 这些是 redesign 时一并补上的标准动作）

- [缺失] `ai_bot_robots_policy` (5 分) — robots.txt has no explicit policy for AI crawlers (GPTBot/ClaudeBot/etc)
- [缺失] `localbusiness_schema` (15 分) — no LocalBusiness or Organization JSON-LD
- [缺失] `service_schema` (10 分) — no Service JSON-LD
- [缺失] `faqpage_schema` (10 分) — no FAQPage JSON-LD (loses AI Overview / featured snippet eligibility)
- [缺失] `aggregaterating_schema` (5 分) — no AggregateRating JSON-LD (★ rating not shown in search snippets)
- [缺失] `faq_qa_pattern` (10 分) — 0 question-style heading(s) found (Q&A format helps AI extraction)
- [缺失] `eeat_business_credentials` (10 分) — only 0/4 credentials found — need ≥2 of: ABN, license/QBCC, years-in-business, insurance

> **销售切入：** 「ChatGPT 现在每月 30 亿次搜索，本地服务用户问『Brisbane 哪家屋顶公司靠谱』，AI 回答时只引用结构化数据完整的网站。你目前在这个新阵地的得分是 35/100。」

## 业务规模信号 · 内部筛选用

**注：这一段只给运营内部看，不进入客户报告。** 用来判断这个 lead 是不是匹配我们「小网站 / 多批量 / 快上线」的产品定位。

- **规模信号汇总：** 小型客户特征
- **客户分级：** `small` — 小型，符合我们标准产品包定位

> 报价以上方 **建议报价** 为准（来自 entity.grade.recommended_pricing / PRODUCT_TIER_TABLE）。本段只用来判断 lead 是否匹配产品定位，不竞争报价。

**触发依据：**
- 网站页面数 60（≥30，中小规模）
- 已部署 2 个追踪工具

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
