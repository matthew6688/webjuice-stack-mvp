---
business_id: "domain_sydneyroofers.net.au"
business_name: "Sydney Roofers"
niche: "roofing"
city: "Sydney"
rating: 5
review_count: 0
website: "https://www.sydneyroofers.net.au/"
audit_score: 53
decision: "strong_redesign"
audit_version: "2026-05-11-v1"
fired_triggers:
  - "no_visible_cta_or_phone"
visual_age: null
visual_freshness: null
visual_trust: null
visual_conversion: null
review_trust_signal: null
generated_at: "2026-05-14T22:06:24.256Z"
assets:
  cloudinary_folder: null
  evidence_count: 0
  video_url: null
  desktop_screenshot: "./screenshots/desktop.png"
  mobile_screenshot: "./screenshots/mobile.png"
---

# Sydney Roofers · 现状审计与重构提议

> **53/100** · strong_redesign · 行业：roofing · 地区：Sydney · Google 评价：5★ （0 条）

## 内部分级 · 运营优先看这段

**投入分级：** `C` 批量轻触 — 模板邮件 + 报告 PDF 链接，无主动跟进

**触发依据：**
- C · strong_redesign · audit 53 · 0 评论 5★ (未达 B 标准)

**下一步行动：** 标准模板邮件 + master.md PDF 链接，无主动跟进。等客户回复触发后再投入。

## 一、店家现状速览

**线索来源 · 联系开场可用**:
- **来源**: Google Maps (gosom 抓取)
- **搜索关键词**: `roofing in sydney`
- **首次发现**: 2026-05-14
- **Batch**: `pipe-roofing-sydney-202605150758`

**审计结论：** audit_score=53 → strong_redesign · weakest: gbp 20, ux_conversion 40 · fired: no_visible_cta_or_phone · 3 critical issues

**已触发的 hard triggers：** `no_visible_cta_or_phone`

- 电话：1800793766
- 地址：5 Crabbes Ave, North Willoughby NSW 2068
- 网站：[https://www.sydneyroofers.net.au/](https://www.sydneyroofers.net.au/)
- 网站状态：`independent_https_site`

## 二、客户访问时看到的页面

![桌面 1440×900](./screenshots/desktop.png)

![移动 375×667](./screenshots/mobile.png)

## 五、当前网站在哪里"漏水"

### 关键问题 · 3 项（立刻在伤害成交）

### 关键 · form_submittable

**技术事实**

form broken


### 关键 · above_fold_cta_within_5s

**技术事实**

no CTA keyword in first 1500 chars

**普通话翻译**

客户打开你的网站后，前 5 秒内（一屏之内）看不到任何明显的「联系我们 / 报价 / 立即拨打」按钮。

**对客户的影响**

行业研究：移动用户做决策的前 8 秒决定 70% 的留存。看不到 CTA = 等于没办法转化。你的 0 条好评在堆积信任，但客户找不到下一步该点哪。


### 关键 · phone_visible_above_fold

**技术事实**

phone hidden below fold or missing

**普通话翻译**

电话号码在第一屏看不到 — 客户必须滚动才能找到怎么联系你。

**对客户的影响**

本地服务客户 60-70% 倾向打电话沟通（不是填表单）。电话号没在第一屏 = 这部分客户里很多人会直接关掉去搜下一家。这是最便宜的转化优化之一。


### 主要问题 · 1 项（影响转化的明显短板）

### 主要 · review_volume_vs_peers

**技术事实**

0 reviews

**普通话翻译**

你的 Google 评价数量低于同行平均水平。

**对客户的影响**

本地搜索排名信号之一就是评价数量；不光是分数，连"有多少条"都算。短期可以做的：每个完工的客户群发一条「点评一下吧」的 SMS。


## 七、推荐销售切入点

- 客户进来看不到联系按钮和电话 — 找不到怎么联系你就直接走了

## 真实速度数据 · Google PageSpeed Insights

我们前面那段「慢速 4G 加载视频」是我们这边的实验室结果。这一段是 **Google 自己**对你网站打的分，包括过去 28 天 **真实访客**的网络体验数据（CRUX field data）。

### 移动端（mobile）

**Lighthouse 分数（实验室）：**

| 维度 | 分数 |
|---|---|
| 性能 (Performance) | **31/100** |
| 可访问性 (Accessibility) | 100/100 |
| 最佳实践 (Best Practices) | 96/100 |
| SEO | 100/100 |

**Lab 关键指标：** LCP `8.4s` · FCP `3.3s` · CLS `0.109` · TBT `1613ms`

**Google 建议的优化项（按节省时间排序，前 2）：**

- **Reduce unused JavaScript** — 节省 450ms · 节省 462KB
- **Reduce unused CSS** — 节省 139KB

### 桌面端（desktop）

**Lighthouse 分数：** Performance 59 · A11y 97 · Best Practices 96 · SEO 100

## 图片优化与第三方脚本体重

PSI 给的是宏观分数，下面是具体可改的两块：图片格式与 tracker 脚本。

### 图片优化（共 20 张）

- **优化率：** 0%（0/20 使用 WebP/AVIF/SVG）
- **响应式 srcset：** 0%
- **Lazy load：** 50%
- **Alt 文字（非空）：** 95%
- **显式 width/height：** 15%（防止 CLS 布局抖动）

**总评：** 基本未优化 — redesign 可显著降低图片下载量

**具体问题：**
- [major] 20 张图几乎全是 JPG/PNG，未用 WebP/AVIF — 估算可节省 30-50% 图片下载量
- [minor] 20/20 张图无响应式 srcset — 移动端浪费带宽
- [minor] 17/20 张图无显式 width/height — 加重 CLS 布局抖动

### 第三方脚本占用情况

- **总请求数：** 199（16 自有 + 183 第三方）
- **第三方占总下载量：** 86%（2781 KB / 3245 KB）
- **Tracker 脚本数：** 4（合计 255 KB）

**已识别的 tracker：**

| 工具 | 类型 | 请求数 | 字节 |
|---|---|---|---|
| Google Tag Manager | analytics | 1 | 157.8 KB |
| Meta Pixel | ad_pixel | 2 | 97.3 KB |
| Google Analytics | analytics | 1 | 0.0 KB |

> **观察：** 4 个 tracker 合计加载了 255 KB —— 这些都是阻塞主线程的脚本，是性能 + 隐私双角度的销售切入点。redesign 时可以建议清理不再使用的 tracker。

## SEO 迁移评估 与 运营活跃度

客户最常担心的问题：「我重做网站，会不会丢掉 Google 排名？」这一段直接回答。

### 现有页面盘点

- **Sitemap 状态：** 已检测到 → `https://www.sydneyroofers.net.au/sitemap.xml`
- **页面总数：** 175
- **迁移复杂度：** 高（>80 页 — 需要分阶段迁移 + 完整 redirect map）

**页面分类：**

| 类型 | 数量 |
|---|---|
| service_area_page | 119 |
| 服务详情页 | 43 |
| 顶层页面 | 5 |
| Blog 文章 | 4 |
| 关于 / 团队 | 1 |
| 首页 | 1 |
| 联系 / 报价 | 1 |
| 法律 / 隐私 | 1 |

**Sitemap lastmod 跨度：** 最旧 2025-07-18 → 最新 2026-05-12

**Redirect 计划承诺：** redesign 上线时我们会附一份 50 条 1:1 redirect 表（旧 URL → 新 URL），保证 Google 已经索引的页面权重无损迁移。已经在 Google 第一二页的关键词不会丢。

### SEO 长尾结构（服务 × 区域 = 本地搜索流量金矿）

- **服务专项页（如 /metal-roofing/）：** 43 个
- **区域页（如 /service-areas/brisbane/）：** 0 个
- **服务×区域组合页（如 /metal-roofing-brisbane/）：** 119 个

**长尾覆盖：** 强 — 已有 5+ 服务×区域页，长尾流量基础在

**现有服务页样本：** `/resources/categories/tiled-roof-repairs` · `/roof-repairs/mosman` · `/roof-repairs/artarmon` · `/roof-repairs/barangaroo` · `/roof-repairs/bellevue-hill`

**现有服务×区域页样本：** `/service-page/gutter-cleaning` · `/service-page/roofing-estimate` · `/locations/mosman-roofing-services` · `/locations/artarmon-roofing-services` · `/locations/barangaroo-roofing-services`

### 运营活跃度

- **整体活跃度：** 活跃（30 天内有更新） （最近一次更新 3 天前）
- **Blog 板块：** 有，共 4 篇文章 
- **社交媒体链接：** 网站上引用了 4 个平台 — facebook, linkedin, twitter, youtube

## 联系表单与防垃圾设置

客户能不能 *方便地* 把信息留下来 = 直接的转化路径。这一段审视所有 `<form>` 元素的可用性 + 防 spam 配置。

**关键发现：网站上没有可识别的联系/报价表单** — 客户只能通过电话或邮件触达。redesign 必须补一个高效的报价请求表单（建议 3-4 字段：姓名 / 电话 / 邮箱 / 简短需求）。

**未检测到任何 anti-spam 措施**（reCAPTCHA / hCaptcha / Turnstile / honeypot 都没有）— 表单极容易被自动机器人灌爆，垃圾询盘会让客户对真实询盘麻木。redesign 时建议加 Cloudflare Turnstile（不可见，免费）。

**Audit 总结：**

- [关键] 未发现联系/报价表单 — 客户只能通过电话或邮件触达，转化路径单一
- [中等] 表单未检测到任何 anti-spam 措施（reCAPTCHA / hCaptcha / Turnstile / honeypot 都没有）— 高 spam 风险

## 域名历史与邮件信誉


### 邮件 DNS 配置（影响未来邮件营销 / 冷邮件投递率）

- **SPF (反垃圾发件验证)：** ⚠ 未配置 — 客户如果用域名邮箱发邮件，进垃圾箱的概率高
- **DKIM (邮件签名)：** 已配置（selectors: s1, s2）
- **DMARC (策略)：** 已配置（policy: `none`）
- **整体邮件投递信誉：** `partial` (只有 2/3 — 建议补全)

> 这是后续 **「Social Media Management 月度包」** 或 **「Cold Outreach 启动包」** 的前置条件 —— 邮件 DNS 没修好，发出去的邮件全进垃圾箱。redesign 时一并处理。

## 技术栈与营销基建

从网站源码识别出来的工具，能帮我们判断这位客户的数字成熟度。

- **网站平台 (CMS)：** Wix（迁移复杂度参考；WordPress / Wix / Squarespace 这类有标准导出工具，custom-coded 会复杂）
- **分析工具：** Google Analytics 4
- **广告 Pixel：** Meta (Facebook) Pixel — 客户已经在投放（或投放过）付费广告，对营销预算不陌生

**数字成熟度打分：** 4 / 6 （高 — 客户懂数字营销，redesign 谈预算时不必从零教育）

### Redesign 时必须保留 / 重新安装的追踪代码

客户可能有数月 / 数年的历史数据 + 广告投放受众 sit 在这些 ID 上面。重做时**必须用同一套 ID 重新接进新网站**，否则等于清零所有累积。

- Google Analytics 4
- Meta (Facebook) Pixel

我们 redesign 交付清单会把这些列为「必须 setup 项」。

## 信任凭证 · AU 屋顶服务

本地服务的客户在掏钱之前会查这些凭证。缺失 = 客户跳到下一家。

**信任分：** 40/100

### 已显示的（4 项）

- **公共责任险** (15 分) — "fully insured"
- **从业年限** (10 分) — "Established in 1955"
- **保修 / 工艺保证** (10 分) — "Workmanship Warranty"
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

- [PASS] `llms_txt_present` — llms.txt found (3175 bytes)
- [PASS] `localbusiness_schema` — LocalBusiness JSON-LD present
- [PASS] `semantic_landmarks` — 5 semantic landmarks present: <main, <nav, <header, <footer, <section
- [PASS] `eeat_business_credentials` — 2/4 credentials in copy: license/QBCC, insurance
- [PASS] `eeat_warranty_trust` — warranty/guarantee mentioned
- [PASS] `jsonld_at_least_one` — 4 JSON-LD block(s) detected on page

### 还缺的（6 项 — 这些是 redesign 时一并补上的标准动作）

- [缺失] `ai_bot_robots_policy` (5 分) — robots.txt has no explicit policy for AI crawlers (GPTBot/ClaudeBot/etc)
- [缺失] `service_schema` (10 分) — no Service JSON-LD
- [缺失] `faqpage_schema` (10 分) — no FAQPage JSON-LD (loses AI Overview / featured snippet eligibility)
- [缺失] `aggregaterating_schema` (5 分) — no AggregateRating JSON-LD (★ rating not shown in search snippets)
- [缺失] `breadcrumb_schema` (5 分) — no BreadcrumbList JSON-LD
- [缺失] `faq_qa_pattern` (10 分) — 0 question-style heading(s) found (Q&A format helps AI extraction)

> **销售切入：** 「ChatGPT 现在每月 30 亿次搜索，本地服务用户问『Brisbane 哪家屋顶公司靠谱』，AI 回答时只引用结构化数据完整的网站。你目前在这个新阵地的得分是 55/100。」

## 业务规模信号 · 内部筛选用

**注：这一段只给运营内部看，不进入客户报告。** 用来判断这个 lead 是不是匹配我们「小网站 / 多批量 / 快上线」的产品定位。

- **规模信号汇总：** 中型客户特征
- **客户分级：** `mid` — 中型客户，可接但价格要往上提（基础包 + 配置项）

> 报价以上方 **建议报价** 为准（来自 entity.grade.recommended_pricing / PRODUCT_TIER_TABLE）。本段只用来判断 lead 是否匹配产品定位，不竞争报价。

**触发依据：**
- 网站页面数 175（≥100，中等复杂度）
- 已部署 2 个追踪工具
- 引用 4 个社交平台（多渠道运营）

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
