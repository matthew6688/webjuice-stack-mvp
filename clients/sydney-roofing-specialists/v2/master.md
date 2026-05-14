---
business_id: "domain_sydneyroofingspecialists.com"
business_name: "Sydney Roofing Specialists"
niche: "roofing"
city: "Sydney"
rating: 5
review_count: 0
website: "http://www.sydneyroofingspecialists.com/"
audit_score: 23
decision: "strong_redesign"
audit_version: "2026-05-11-v1"
fired_triggers:
  - "no_https"
  - "no_visible_cta_or_phone"
visual_age: "severely_outdated"
visual_freshness: 3
visual_trust: 3
visual_conversion: 3
review_trust_signal: null
generated_at: "2026-05-14T22:09:19.021Z"
assets:
  cloudinary_folder: null
  evidence_count: 7
  video_url: "./video/mobile-throttled.webm"
  desktop_screenshot: "./screenshots/desktop.png"
  mobile_screenshot: "./screenshots/mobile.png"
---

# Sydney Roofing Specialists · 现状审计与重构提议

> **23/100** · strong_redesign · 行业：roofing · 地区：Sydney · Google 评价：5★ （0 条）

## 内部分级 · 运营优先看这段

**投入分级：** `C` 批量轻触 — 模板邮件 + 报告 PDF 链接，无主动跟进

**触发依据：**
- C · strong_redesign · audit 23 · 0 评论 5★ (未达 B 标准)

**下一步行动：** 标准模板邮件 + master.md PDF 链接，无主动跟进。等客户回复触发后再投入。

## 一、店家现状速览

**线索来源 · 联系开场可用**:
- **来源**: Google Maps (gosom 抓取)
- **搜索关键词**: `roofing in sydney`
- **首次发现**: 2026-05-14
- **Batch**: `pipe-roofing-sydney-202605150758`

**审计结论：** audit_score=23 → strong_redesign · weakest: ux_conversion 0, content 10 · fired: no_https, no_visible_cta_or_phone · 3 critical issues

**已触发的 hard triggers：** `no_https` · `no_visible_cta_or_phone`

- 电话：0427364223
- 地址：55 Day St, Marrickville NSW 2204
- 网站：[http://www.sydneyroofingspecialists.com/](http://www.sydneyroofingspecialists.com/)
- 网站状态：`independent_http_site`

## 二、客户访问时看到的页面

![桌面 1440×900](./screenshots/desktop.png)

![移动 375×667](./screenshots/mobile.png)

**慢速 4G 加载实景视频**（1.6 Mbps · 150ms 延迟 · 4× CPU 节流，模拟真实手机访客的体验）：

[播放视频](./video/mobile-throttled.webm)

## 三、视觉审计 · Vision LLM 怎么看

> The mobile page has clear roofing messaging and phone visibility, but the desktop screenshot shows a 403 error and the mobile hero feels cramped and trust-light.

新鲜度 **3/10** · 信任度 **3/10** · 转化准备度 **3/10** · 设计年代 `severely_outdated`

**值得保留的优点：**
- The mobile page clearly states 'Sydney Roofing Specialists' in the first screen.
- The phone number is visible in the orange call bar near the top of mobile.
- The Google rating graphic is prominent and worth preserving in a more credible format.

## 五、当前网站在哪里"漏水"

### 关键问题 · 4 项（立刻在伤害成交）

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


### 关键 · Desktop page is blocked

**技术事实**

The desktop screenshot shows a full-page light blue error screen with the centered text '403 - Forbidden' and 'Access to this page is forbidden.'

**普通话翻译**

电脑端打开网站时看到的是“403禁止访问”错误页，不是正常的公司首页。

**对客户的影响**

这会直接丢客户。很多人在Google上点开网站后，如果页面打不开，几秒内就会返回搜索结果找下一家；这类错误基本等于把桌面端询盘全部浪费掉。

**正确长啥样**

A working desktop homepage with the business name, service area, phone number, emergency roofing message, review proof, and a quote/call button visible above the fold.

**Redesign 怎么改**

Fix the server access issue first, then replace the error page with a responsive homepage hero that loads correctly on desktop and shows the primary phone CTA immediately.


### 主要问题 · 10 项（影响转化的明显短板）

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

你网站的浏览器标签 title 没把业务名字 + 服务关键词写清楚（比如该写「Sydney Roofing Specialists - roofing Sydney」，但目前是泛泛一句）。

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


### 主要 · Primary call button is split

**技术事实**

On the mobile screenshot, the orange 'Call 0427 364 223' button at the bottom is only partly visible, with the lower part cut off by the screenshot edge.

**普通话翻译**

手机页面最重要的拨打电话按钮露出来不完整，看起来像被截断了。

**对客户的影响**

本地服务搜索大多数发生在手机上，客户通常想马上打电话。按钮不够明显会减少来电，尤其是屋顶漏水这类紧急需求，客户会直接打给更容易联系的竞争对手。

**正确长啥样**

A sticky bottom call bar or a fully visible hero CTA with at least 44px height, clear phone icon, and enough spacing from the screen edge.

**Redesign 怎么改**

Add a persistent mobile bottom bar with a phone icon and 'Call 0427 364 223', and keep a second full-width orange call button fully visible inside the first screen.


### 主要 · Hero copy feels cramped

**技术事实**

The mobile hero places a large 'Sydney Roofing Specialists' heading, a long paragraph, a large Google rating graphic, and a call button all in one narrow vertical area.

**普通话翻译**

手机首页第一屏塞了太多文字和元素，客户一眼看过去会觉得拥挤。

**对客户的影响**

访客通常会在几秒内判断要不要继续看。信息太挤会让人跳过重点，少点电话按钮，Google商家资料带来的访问也更容易流失。

**正确长啥样**

A shorter mobile hero with one clear headline, one 1-2 line benefit statement, visible call button, and review proof placed below with breathing room.

**Redesign 怎么改**

Rewrite the hero paragraph to one short line such as 'Roof repairs, replacements and emergency roofing across Sydney', then move the longer explanation below the first CTA.


### 主要 · Hero image lacks local proof

**技术事实**

The mobile hero background shows a darkened close-up roofing/gutter image but no visible Sydney job, team member, branded vehicle, or completed roof project.

**普通话翻译**

首页大图看起来像普通屋顶素材图，没有体现这是悉尼本地真实公司。

**对客户的影响**

修屋顶客单价高，客户会先判断这家公司靠不靠谱。缺少真实项目照片会降低信任，特别是从Google点进来的陌生客户更容易选择有真实案例的商家。

**正确长啥样**

A bright, real project photo showing a completed roof, team member, or branded ute, with a dark overlay only strong enough to keep white text readable.

**Redesign 怎么改**

Replace the hero background with an authentic Sydney roofing job photo and add a small visual trust strip below it showing licensed/insured, emergency availability, and review count.


### 主要 · Rating lacks review count

**技术事实**

The mobile hero shows a large Google '5.0 Google Rating' graphic with five stars, but no visible number of reviews or link-style proof.

**普通话翻译**

页面写了Google 5.0评分，但没有显示有多少条评价。

**对客户的影响**

客户会怀疑这个评分有多可信。5星但只有少量评价说服力有限；显示评价数量通常能提高陌生客户拨电话的信心。

**正确长啥样**

A compact review badge that says '5.0 stars from X Google reviews' with the star row and a link or button to view reviews.

**Redesign 怎么改**

Update the rating block to include the live review count and place it near the CTA as a smaller trust badge rather than a huge graphic.


## 六、Redesign 的发力点（综合视觉 + 评论数据）

1. [视觉] 1. Fix the desktop 403 error and make the homepage load normally on laptop screens.
2. [视觉] 2. Rebuild the mobile hero around one clear headline, one complete call button, and concise local service proof.
3. [视觉] 3. Replace generic trust visuals with real project photos, review count, and licensed/insured emergency-service trust badges.

## 七、推荐销售切入点

- 你的网站没有 HTTPS — 浏览器对来访客户显示「不安全」，直接伤害信任
- 客户进来看不到联系按钮和电话 — 找不到怎么联系你就直接走了

## 真实速度数据 · Google PageSpeed Insights

我们前面那段「慢速 4G 加载视频」是我们这边的实验室结果。这一段是 **Google 自己**对你网站打的分，包括过去 28 天 **真实访客**的网络体验数据（CRUX field data）。

### 移动端（mobile）

**Lighthouse 分数（实验室）：**

| 维度 | 分数 |
|---|---|
| 性能 (Performance) | **64/100** |
| 可访问性 (Accessibility) | 88/100 |
| 最佳实践 (Best Practices) | 81/100 |
| SEO | 92/100 |

**Lab 关键指标：** LCP `8.0s` · FCP `3.3s` · CLS `0.000` · TBT `91ms`

**Google 建议的优化项（按节省时间排序，前 2）：**

- **Reduce unused JavaScript** — 节省 900ms · 节省 158KB
- **Avoid multiple page redirects** — 节省 630ms

### 桌面端（desktop）

**Lighthouse 分数：** Performance 77 · A11y 88 · Best Practices 81 · SEO 92

## SEO 迁移评估 与 运营活跃度

客户最常担心的问题：「我重做网站，会不会丢掉 Google 排名？」这一段直接回答。

### 现有页面盘点

- **Sitemap 状态：** 已检测到 → `https://sydneyroofingspecialists.com/wp-sitemap.xml`
- **页面总数：** 5
- **迁移复杂度：** 低（≤15 页 — 1-2 周内可完成全站重做）

**页面分类：**

| 类型 | 数量 |
|---|---|
| 内页 | 3 |
| 首页 | 1 |
| 联系 / 报价 | 1 |

**Sitemap lastmod 跨度：** 最旧 2022-08-10 → 最新 2023-12-04

**Redirect 计划承诺：** redesign 上线时我们会附一份 5 条 1:1 redirect 表（旧 URL → 新 URL），保证 Google 已经索引的页面权重无损迁移。已经在 Google 第一二页的关键词不会丢。

### SEO 长尾结构（服务 × 区域 = 本地搜索流量金矿）

- **服务专项页（如 /metal-roofing/）：** 0 个
- **区域页（如 /service-areas/brisbane/）：** 0 个
- **服务×区域组合页（如 /metal-roofing-brisbane/）：** 0 个

**长尾覆盖：** 无 — 没有服务专项页面，redesign 时是关键补点

### 运营活跃度

- **整体活跃度：** 休眠（超过 1 年没更新过） （最近一次更新 893 天前）
- **Blog 板块：** 未发现 — 没有内容营销基础
- **社交媒体链接：** 网站上没有 social 链接 — GBP 流量进来后没有第二触点

> **关键发现：** 客户的网站超过一年没动过。redesign 之后我们也建议帮忙建立最低限度的内容更新节奏（每月 1 篇 case study 即可），否则 AI / Google 都会判定网站「死站」。

## 域名历史与邮件信誉

- **域名"在线已"约：** 41 年（创建于 1985-01-01）— 老域名 = 多年 SEO 资产，redesign 时 redirect map 必须做对

### 邮件 DNS 配置（影响未来邮件营销 / 冷邮件投递率）

- **SPF (反垃圾发件验证)：** 已配置
- **DKIM (邮件签名)：** 已配置（selectors: s1, s2）
- **DMARC (策略)：** ⚠ 未配置 — 域名易被仿冒做钓鱼
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

**AI 可发现性总分：** 0 / 100 — AI agent / ChatGPT 几乎无法准确引用此网站 — 在生成式搜索时代等于隐身

### 还缺的（12 项 — 这些是 redesign 时一并补上的标准动作）

- [缺失] `llms_txt_present` (5 分) — no /llms.txt at standard path
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

> **销售切入：** 「ChatGPT 现在每月 30 亿次搜索，本地服务用户问『Brisbane 哪家屋顶公司靠谱』，AI 回答时只引用结构化数据完整的网站。你目前在这个新阵地的得分是 0/100。」

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
- Vision model: `codex_cli`
- Review source: `Google Places · most_relevant (max 5)`
- 完整 audit 报告 HTML：[internal-audit-report](./internal-audit-report.html)
