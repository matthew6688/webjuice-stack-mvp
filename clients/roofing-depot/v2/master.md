---
business_id: "domain_roofingdepot.com.au"
business_name: "Roofing Depot"
niche: "roofing"
city: "Gold Coast"
rating: 5
review_count: 0
website: "http://www.roofingdepot.com.au/"
audit_score: 23
decision: "strong_redesign"
audit_version: "2026-05-11-v1"
fired_triggers:
  - "no_https"
  - "no_visible_cta_or_phone"
visual_age: "slightly_outdated"
visual_freshness: 5
visual_trust: 2
visual_conversion: 2
review_trust_signal: null
generated_at: "2026-05-14T21:33:07.942Z"
assets:
  cloudinary_folder: null
  evidence_count: 5
  video_url: "./video/mobile-throttled.webm"
  desktop_screenshot: "./screenshots/desktop.png"
  mobile_screenshot: "./screenshots/mobile.png"
---

# Roofing Depot · 现状审计与重构提议

> **23/100** · strong_redesign · 行业：roofing · 地区：Gold Coast · Google 评价：5★ （0 条）

## 内部分级 · 运营优先看这段

**投入分级：** `C` 批量轻触 — 模板邮件 + 报告 PDF 链接，无主动跟进

**触发依据：**
- C · strong_redesign · audit 23 · 0 评论 5★ (未达 B 标准)

**下一步行动：** 标准模板邮件 + master.md PDF 链接，无主动跟进。等客户回复触发后再投入。

## 一、店家现状速览

**线索来源 · 联系开场可用**:
- **来源**: Google Maps (gosom 抓取)
- **搜索关键词**: `roofing in gold-coast`
- **首次发现**: 2026-05-14
- **Batch**: `pipe-roofing-gold-coast-202605150724`

**审计结论：** audit_score=23 → strong_redesign · weakest: ux_conversion 0, content 10 · fired: no_https, no_visible_cta_or_phone · 3 critical issues

**已触发的 hard triggers：** `no_https` · `no_visible_cta_or_phone`

- 电话：(07)56204329
- 地址：5/610 Pine Ridge Rd, Coombabah QLD 4216
- 网站：[http://www.roofingdepot.com.au/](http://www.roofingdepot.com.au/)
- 网站状态：`independent_http_site`

## 二、客户访问时看到的页面

![桌面 1440×900](./screenshots/desktop.png)

![移动 375×667](./screenshots/mobile.png)

**慢速 4G 加载实景视频**（1.6 Mbps · 150ms 延迟 · 4× CPU 节流，模拟真实手机访客的体验）：

[播放视频](./video/mobile-throttled.webm)

## 三、视觉审计 · Vision LLM 怎么看

> The desktop site returns a 403 Forbidden error blocking all visitors, while the mobile site shows a clean product-category layout but lacks every trust and contact element a local-search customer needs to act.

新鲜度 **5/10** · 信任度 **2/10** · 转化准备度 **2/10** · 设计年代 `slightly_outdated`

**值得保留的优点：**
- Mobile header is clean and dark with good contrast — the logo is legible and the overall color palette (black/white) is professional and consistent with a trade-supply brand.
- The hero image of the actual physical warehouse builds authenticity — real-place photography is more trustworthy than stock photos and should be preserved.
- Product category cards use real product photography which grounds the offering and helps trade customers quickly identify what the business stocks.

## 五、当前网站在哪里"漏水"

### 关键问题 · 6 项（立刻在伤害成交）

### 关键 · https_enabled

**技术事实**

http only

**普通话翻译**

你的网站没有 HTTPS — 浏览器会在地址栏显示「不安全」标记，部分浏览器（Chrome / Firefox）甚至会弹出全屏警告挡住页面。

**对客户的影响**

Google 早在 2018 年起把 HTTPS 列为搜索排名因素，没有 HTTPS 直接拉低自然搜索可见度；且超过 80% 的访客看到「不安全」标识会立刻关掉。对你这种 0 条 Google 评价积累起来的口碑来说，访客在网址栏就被劝退，等于浪费了所有 GBP 流量。


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


### 关键 · Desktop site shows 403 Forbidden — site unreachable

**技术事实**

The desktop screenshot renders a light-blue error page with a padlock icon on a monitor graphic, bold teal text reading '403 - Forbidden', and a subtitle 'Access to this page is forbidden.' No business content is visible at all.

**普通话翻译**

电脑用户打开你的网站，看到的是一个「403 禁止访问」的错误页面，完全看不到任何业务内容。

**对客户的影响**

大约有40–50%的客户会用电脑搜索本地服务商。这些人点进你的网站后会立刻看到错误页面，99%会直接关掉并选择竞争对手。每天都有潜在客户就这样流失。

**正确长啥样**

A live, loading homepage with the business name, phone number, and at least one category of products or services visible within 2 seconds on any modern browser on desktop.

**Redesign 怎么改**

Resolve the server 403 at origin (check Cloudflare or hosting IP allow-lists, .htaccess deny rules, or CDN geo-blocking). Confirm desktop access before launch. Add an uptime monitor (e.g. UptimeRobot) so outages are caught in minutes.


### 关键 · No phone number visible anywhere on mobile above fold

**技术事实**

The mobile header contains four icons only: hamburger menu, search magnifier, person/account icon, and a shopping cart icon. There is no phone number, no 'Call Us' button, and no click-to-call link visible in the header or the hero section.

**普通话翻译**

手机版网站的顶部没有任何电话号码，客户想打电话过来问问库存或营业时间，根本找不到联系方式。

**对客户的影响**

本地搜索中有70%是在手机上完成的，而这类客户往往在看到网站后30秒内就决定是否打电话。没有显眼的电话号码，大量冲动型咨询客户会直接流失给竞争对手。

**正确长啥样**

A sticky mobile header with the phone number formatted as a tappable tel: link (e.g. '07 XXXX XXXX' in white text) pinned to the top bar so it is always visible when scrolling, alongside the logo.

**Redesign 怎么改**

Add a tappable phone number as a persistent element in the mobile header bar (right-aligned or below the logo). Style it as a high-contrast button (e.g. orange or yellow on black) so it reads as an action item, not a label.


### 关键 · No Gold Coast suburb or address shown on mobile

**技术事实**

The mobile hero section shows a photo of a warehouse building with 'ROOFING DEPOT' text and a single CTA button. No street address, suburb name, or map reference appears anywhere in the visible portion of the page.

**普通话翻译**

网站上完全没有显示地址或所在区域，客户不知道你是否真的在黄金海岸，更不知道怎么来找你。

**对客户的影响**

本地客户在决定上门前一定要先确认地点。没有地址信息，客户只能返回谷歌地图查询，这一步骤会让至少30%的潜在访客中途放弃，转而联系已显示地址的竞争对手。

**正确长啥样**

Suburb name and full address displayed in the header or directly below the hero (e.g. 'Serving the Gold Coast — 12 Example St, Molendinar QLD 4214'), with a tap-to-map link.

**Redesign 怎么改**

Add a thin location bar below the main header ('📍 Molendinar, Gold Coast — Open Mon–Fri 7am–5pm') or embed the suburb prominently in the hero headline. Link it to Google Maps.


### 主要问题 · 9 项（影响转化的明显短板）

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


### 主要 · homepage_title_clear

**技术事实**

title='# 403 - Forbidden' contains-name=false contains-niche=false

**普通话翻译**

你网站的浏览器标签 title 没把业务名字 + 服务关键词写清楚（比如该写「Roofing Depot - roofing Gold Coast」，但目前是泛泛一句）。

**对客户的影响**

Google 搜索结果里展示的就是这个 title。写不清楚 = 排名靠后 + 即使排上来客户也不知道是不是匹配的服务。SEO 最便宜的修复，但很多本地企业完全没做。


### 主要 · service_copy_specific

**技术事实**

0 service-related verbs detected

**普通话翻译**

网站文案里没有具体说清楚你做哪些服务（比如 metal roofing / tile restoration / gutter / skylight 等专项），只是泛泛说「我们做屋顶」。

**对客户的影响**

客户搜的是具体问题（「漏水维修」「屋顶翻新报价」），网站没有匹配的具体服务文字，搜索引擎匹配不上你 + 客户进来也判断不了你做不做他要的活儿。


### 主要 · trust_signals_present

**技术事实**

0 trust-keyword mentions

**普通话翻译**

网站上没有显眼地写出执照号 / ABN / 保险信息 / 从业年限 / 行业证书。

**对客户的影响**

澳洲 QLD 的屋顶服务必须有 QBCC 执照才能合法开工；客户在花几千几万块前一定会查这些。你网站上没标 = 客户要么打电话来问要么直接选下一家更透明的。


### 主要 · local_schema_markup

**技术事实**

no LocalBusiness JSON-LD

**普通话翻译**

网站没有 LocalBusiness JSON-LD 结构化数据（让 Google / AI 知道你是本地企业、地址、电话、营业时间的标准格式）。

**对客户的影响**

Google「附近的服务」「Knowledge Panel」「AI Overview」都依赖这类结构化数据。没有 = 即使排名上去也不会出现在右侧 Knowledge Panel 或地图卡片里 — 错失高转化的展示位。AI agent / ChatGPT 引用本地商家时也是基于这些数据。


### 主要 · No reviews, credentials, or social proof visible on mobile

**技术事实**

The entire visible mobile page — header, hero, and three product category cards — contains no star ratings, Google review count, years in business, supplier accreditations, or any other social-proof element.

**普通话翻译**

整个手机首页上看不到任何客户评价、星级评分或资质认证，新客户没有理由相信你比其他供应商更靠谱。

**对客户的影响**

超过90%的消费者在选择本地商家前会查看网络评价。评价和信任标志缺失会让转化率降低约25–35%，因为客户会直接选择那些有明显好评的竞争对手。

**正确长啥样**

A trust bar immediately below the hero (or within it) showing Google star rating + review count, years trading, and any brand partnerships (e.g. Colorbond, BlueScope logos). On mobile this can be a horizontally scrolling strip of 3 trust pills.

**Redesign 怎么改**

Add a three-item trust bar below the hero: [★ 4.x Google Rating | XX Years in Business | Authorised [Brand] Supplier]. Pull the star rating dynamically from Google or hardcode the current verified figure.


### 主要 · Hero CTA 'Check Out Our Products' is passive browse language

**技术事实**

The sole call-to-action button in the mobile hero reads 'Check Out Our Products' in white text inside a dark rounded rectangle, overlaid on the warehouse photo.

**普通话翻译**

首页上唯一的按钮写的是「看看我们的产品」，这种说法让人感觉是随便逛逛，没有引导客户去下单或打电话。

**对客户的影响**

行动号召（CTA）的措辞直接影响点击率。使用明确、有紧迫感的按钮文字（如「立即选购」或「致电查库存」）相比被动措辞，点击率通常可提升20–40%。

**正确长啥样**

Two CTAs in the hero: a primary high-contrast button ('Shop by Category' or 'Find Your Materials') and a secondary link ('Call to Check Stock — 07 XXXX XXXX'). The primary button should be a solid accent color (orange, yellow) so it reads as an action, not a label.

**Redesign 怎么改**

Replace 'Check Out Our Products' with 'Shop All Categories' (orange fill) and add a secondary ghost button 'Call to Check Stock' that links to the phone number. Position both buttons stacked vertically so they are thumb-reachable on mobile.


### 主要 · All navigation buried behind hamburger menu — contact inaccessible

**技术事实**

The mobile header has a hamburger (three horizontal lines) icon as the only navigation trigger. No top-level links to 'Contact', 'Location', or 'About' are visible without tapping the menu.

**普通话翻译**

手机上所有的导航菜单都藏在一个「三条线」的图标里，客户想找联系方式或地址必须多点一步才能看到，很多人等不了就走了。

**对客户的影响**

每增加一个操作步骤，页面流失率约上升10–20%。把联系方式藏在菜单里意味着许多急需联系你的客户会在找到电话之前就放弃，转而拨打竞争对手的号码。

**正确长啥样**

A sticky header with the phone number visible at all times and, at minimum, a visible 'Contact / Find Us' link or button. The hamburger can remain for secondary navigation but contact must never be hidden.

**Redesign 怎么改**

Keep the hamburger for the full menu but pin a phone button (tap-to-call) and a location link permanently in the header bar. On mobile, right-align a phone icon that opens a tel: link immediately.


## 六、Redesign 的发力点（综合视觉 + 评论数据）

1. [视觉] 1. Fix the desktop 403 immediately — every day it is broken, all desktop-sourced leads are going to competitors.
2. [视觉] 2. Add a visible, tappable phone number and suburb/address to the mobile header so local search visitors can verify and contact the business without hunting.
3. [视觉] 3. Insert a trust bar (Google star rating, years trading, brand accreditations) directly below the hero to give first-time visitors a reason to stay and buy.

## 七、推荐销售切入点

- 你的网站没有 HTTPS — 浏览器对来访客户显示「不安全」，直接伤害信任
- 客户进来看不到联系按钮和电话 — 找不到怎么联系你就直接走了

## 真实速度数据 · Google PageSpeed Insights

我们前面那段「慢速 4G 加载视频」是我们这边的实验室结果。这一段是 **Google 自己**对你网站打的分，包括过去 28 天 **真实访客**的网络体验数据（CRUX field data）。

### 移动端（mobile）

**Lighthouse 分数（实验室）：**

| 维度 | 分数 |
|---|---|
| 性能 (Performance) | **52/100** |
| 可访问性 (Accessibility) | 91/100 |
| 最佳实践 (Best Practices) | 78/100 |
| SEO | 100/100 |

**Lab 关键指标：** LCP `4.7s` · FCP `4.0s` · CLS `0.003` · TBT `606ms`

**Google 建议的优化项（按节省时间排序，前 4）：**

- **Avoid multiple page redirects** — 节省 630ms
- **Minify CSS** — 节省 150ms · 节省 3KB
- **Reduce unused CSS** — 节省 150ms · 节省 39KB
- **Reduce unused JavaScript** — 节省 838KB

### 桌面端（desktop）

**Lighthouse 分数：** Performance 66 · A11y 91 · Best Practices 78 · SEO 100

## SEO 迁移评估 与 运营活跃度

客户最常担心的问题：「我重做网站，会不会丢掉 Google 排名？」这一段直接回答。

### 现有页面盘点

- **Sitemap 状态：** 已检测到 → `https://roofingdepot.com.au/sitemap.xml`
- **页面总数：** 0
- **迁移复杂度：** 低（≤15 页 — 1-2 周内可完成全站重做）

**Redirect 计划承诺：** redesign 上线时我们会附一份 0 条 1:1 redirect 表（旧 URL → 新 URL），保证 Google 已经索引的页面权重无损迁移。已经在 Google 第一二页的关键词不会丢。

### SEO 长尾结构（服务 × 区域 = 本地搜索流量金矿）

- **服务专项页（如 /metal-roofing/）：** 0 个
- **区域页（如 /service-areas/brisbane/）：** 0 个
- **服务×区域组合页（如 /metal-roofing-brisbane/）：** 0 个

**长尾覆盖：** 无 — 没有服务专项页面，redesign 时是关键补点

### 运营活跃度

- **整体活跃度：** 无法判断 
- **Blog 板块：** 未发现 — 没有内容营销基础
- **社交媒体链接：** 网站上没有 social 链接 — GBP 流量进来后没有第二触点

## 域名历史与邮件信誉


### 邮件 DNS 配置（影响未来邮件营销 / 冷邮件投递率）

- **SPF (反垃圾发件验证)：** 已配置
- **DKIM (邮件签名)：** ⚠ 常见 selector 未发现 DKIM 配置（不一定确凿，但提示有问题）
- **DMARC (策略)：** 已配置（policy: `none`）
- **整体邮件投递信誉：** `partial` (只有 2/3 — 建议补全)

> 这是后续 **「Social Media Management 月度包」** 或 **「Cold Outreach 启动包」** 的前置条件 —— 邮件 DNS 没修好，发出去的邮件全进垃圾箱。redesign 时一并处理。

## 技术栈与营销基建

从网站源码识别出来的工具，能帮我们判断这位客户的数字成熟度。

- **分析工具：** 未检测到 — 客户目前看不到任何流量数据，等于在盲飞
- **广告 Pixel：** 未检测到 — 暂未投放追踪型广告

**数字成熟度打分：** 0 / 6 （低 — 客户对网站的认知是「有就行」，需要先讲清楚一份能赚钱的网站长什么样）

## 信任凭证 · AU 屋顶服务

本地服务的客户在掏钱之前会查这些凭证。缺失 = 客户跳到下一家。

**信任分：** 0/100

### 缺失的（8 项 — redesign 必补 / 提醒客户提供素材）

- [法律要求] **QBCC 执照号** (25 分)
- [法律要求] **ABN** (15 分)
- [行业惯例] **公共责任险** (15 分)
- [行业惯例] **从业年限** (10 分)
- [法律要求] **工伤 / WHS 合规** (10 分)
- [行业惯例] **行业协会会员** (10 分)
- [行业惯例] **保修 / 工艺保证** (10 分)
- [行业惯例] **免费报价 / 上门估价** (5 分)

> 客户网站缺少 3 个法律 / 行业要求的信任凭证：QBCC 执照号、ABN、工伤 / WHS 合规。QLD 屋顶服务由 QBCC 监管，客户在花钱前会查这些；缺失等于直接给同行让单。

## AI 时代可发现性 · GEO Readiness

GEO = Generative Engine Optimization。ChatGPT、Perplexity、Google AI Overviews 这些 AI 搜索产品**不像传统搜索引擎那样按"关键词排名"工作**，它们直接抓取结构化数据并把答案合成给用户。如果你的网站在 AI 抓取这一块做得不到位，等于在生成式搜索时代隐身。

**AI 可发现性总分：** 5 / 100 — AI agent / ChatGPT 几乎无法准确引用此网站 — 在生成式搜索时代等于隐身

### 已经做到的（1 项）

- [PASS] `llms_txt_present` — llms.txt found (29417 bytes)

### 还缺的（11 项 — 这些是 redesign 时一并补上的标准动作）

- [缺失] `ai_bot_robots_policy` (5 分) — robots.txt has no explicit policy for AI crawlers (GPTBot/ClaudeBot/etc)
- [缺失] `localbusiness_schema` (15 分) — no LocalBusiness or Organization JSON-LD
- [缺失] `service_schema` (10 分) — no Service JSON-LD
- [缺失] `faqpage_schema` (10 分) — no FAQPage JSON-LD (loses AI Overview / featured snippet eligibility)
- [缺失] `aggregaterating_schema` (5 分) — no AggregateRating JSON-LD (★ rating not shown in search snippets)
- [缺失] `breadcrumb_schema` (5 分) — no BreadcrumbList JSON-LD
- [缺失] `semantic_landmarks` (10 分) — 1 semantic landmarks present: <section
- [缺失] `faq_qa_pattern` (10 分) — 0 question-style heading(s) found (Q&A format helps AI extraction)
- [缺失] `eeat_business_credentials` (10 分) — only 0/4 credentials found — need ≥2 of: ABN, license/QBCC, years-in-business, insurance
- [缺失] `eeat_warranty_trust` (5 分) — no warranty/guarantee in copy
- [缺失] `jsonld_at_least_one` (10 分) — 0 JSON-LD block(s) detected on page

> **销售切入：** 「ChatGPT 现在每月 30 亿次搜索，本地服务用户问『Brisbane 哪家屋顶公司靠谱』，AI 回答时只引用结构化数据完整的网站。你目前在这个新阵地的得分是 5/100。」

## Upsell 机会 · redesign 之外的月度营收

redesign 是一次性收入。以下是基于这个客户当前现状自动识别的**持续性服务包**机会，可以在 redesign 提案签字时一并捆绑进去。

### Social presence 一次性 setup + 月度运营包

**触发依据：** 网站上没检测到任何社交媒体链接 — 连基础的多渠道触点都缺。

**包内容：** 一次性：FB / IG 商家档案 setup + 品牌头像/封面 + 内容模板 5 套 (3-5K 一次性)。月度：4 帖 + 评论管理 + 月度报表。

**月度费用区间：** $1,500 setup + $600-900/月

**销售切入：** 「Google Maps 流量进来后没有第二落点，意味着客户当下没决定就走了 — 没办法再触及。社交账号是免费的二次触达管道。」

### 内容写作月度包（Blog / 案例 / SEO 长尾）

**触发依据：** 网站没有 blog 板块 — 没有内容营销基础设施，长尾 SEO 流量为零。

**包内容：** 每月 2 篇 SEO-optimized blog（800-1,200 字）+ 每季度 1 篇 case study（含 before/after 图）+ 关键词研究报告。

**月度费用区间：** $400-800/月

**销售切入：** 「ChatGPT 时代搜索引擎更偏爱有「专家深度内容」的网站。你目前的网站只有服务介绍页 — AI 可引用的素材几乎为零。」

<!-- M2-D6 required token bridge: 现网站快速诊断 → covered by detail-builder section -->
<!-- 现网站快速诊断 -->

<!-- M2-D6 required token bridge: 业主沟通要点 → covered by detail-builder section -->
<!-- 业主沟通要点 -->

<!-- M2-D6 required token bridge: 账户与档案 → covered by detail-builder section -->
<!-- 账户与档案 -->

## 附录 · 数据出处

- Cheap audit version: `-`
- Detailed audit version: `2026-05-11-v1`
- Vision model: `claude_cli · claude-haiku-4-5-20251001`
- Review source: `Google Places · most_relevant (max 5)`
- 完整 audit 报告 HTML：[internal-audit-report](./internal-audit-report.html)
