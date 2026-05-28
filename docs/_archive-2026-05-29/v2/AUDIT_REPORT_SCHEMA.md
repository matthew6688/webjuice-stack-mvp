# V2 Internal Audit Report — Schema Cheat Sheet

更新日期：2026-05-12
关联：
- 数据源 `data/v2/fixtures/detailed-audit/<entityKey>.json`
- 报告输出 `clients/<slug>/v2/internal-audit-report.html`
- 渲染脚本 `scripts/leads/build-internal-report.js`
- 评分逻辑 `core/scoring/detailed-audit.js`
- 决策映射 `core/scoring/lead-grading.js`

> 这份文档锁定 V2 audit 最终定稿的所有 datapoint。**新增字段必须先在此登记，再加进 fixture/HTML**。

---

## 1. 总分 + 决策（顶层 `detailed_audit`）

| 字段 | 类型 | 含义 |
|---|---|---|
| `audit_score` | 0-100 | 综合加权得分 |
| `decision` | enum | `strong_redesign` / `moderate_candidate` / `low_priority` / `starter_candidate` / `not_qualified` |
| `hard_triggers[]` | string[] | 命中的硬触发器：`no_https` / `high_traction_old_site` / `niche_mismatch` / `recent_redesign` / `enterprise_size` / `too_many_pages` / `too_many_categories` / `fully_managed` |
| `qualification_reason` | string | 中文一句话解释 |
| `audit_version` | string | `v2.x` |
| `audited_at` | ISO | 跑分时间 |
| `business_id` | string | entityKey |
| `inputs_present` | object | 输入信号清单（entity / business_profile / fetch_payload / raw_html / lighthouse / visual_score_provided）|

## 2. 6 维评分（`detailed_audit.dimension_scores` + `dimensions`）

| 维度 | 满分 | 子规则数 | 含义 |
|---|---|---|---|
| `gbp` | 100 | 8 | Google Business Profile 完整度（hours / service_area / reviews / photos / categories / posts / Q&A / response_rate） |
| `technical` | 100 | 7 | HTTPS / LCP / mobile_responsive / CWV / form_submittable / 第三方脚本权重 / 域名健康 |
| `ux_conversion` | 100 | 7 | 电话可见 / CTA 清晰 / 信任标志 / 表单友好 / 价格透明 / contact_us 页 / above-fold layout |
| `content` | 100 | 6 | 文案质量 / 本地相关 / 案例展示 / FAQ / about / 行业关键词 |
| `seo` | 100 | 5 | 标题 / meta / sitemap / local SEO / LocalBusiness JSON-LD |
| `visual` | 100 | 1 | Ollama vision 综合审美评分 |

每个 dimension 的 `rules[]` 含：
```
{ id, earned, max, hit (boolean), data_missing (boolean), rationale (英文调试) }
```

## 3. Issues 三级分类（`detailed_audit.issues`）

```
issues.critical[]   严重影响转化/排名，必须修
issues.major[]      显著影响，应该修
issues.minor[]      锦上添花
```

每条 issue 三段叙述（per `feedback_audit_must_be_actionable` 决策）：

| 字段 | 受众 | 用途 |
|---|---|---|
| `id` | 工程 | 规则 id |
| `rationale` | 工程 / 调试 | 英文事实摘要 |
| `max` | 评分 | 该规则满分 |
| `plain_language` | **客户** | 中文 — 这是个啥问题 |
| `customer_impact` | **客户 / 销售** | 中文 — 对生意的影响（卖单引用）|

示例：
```
{
  id: "https_enabled",
  max: 20,
  rationale: "http only",
  plain_language: "你的网站没有 HTTPS — 浏览器会显示「不安全」标记",
  customer_impact: "Google 把 HTTPS 列为搜索排名因素... 80% 访客看到不安全标识会关掉..."
}
```

## 4. 外围生意维度数据（fixture 顶层）

### `fetch_summary`
- `url` (final URL after redirects)
- `markdown_length`

### `tech_stack`
| 字段 | 含义 |
|---|---|
| `cms` | 检测到的 CMS（WordPress / Squarespace / Wix / Shopify / Custom） |
| `cms_alternatives[]` | 多重匹配时的备选 |
| `analytics[]` | GA4 / GTM / Plausible / Fathom |
| `pixels[]` | Facebook / TikTok / LinkedIn / Pinterest / Reddit |
| `chat[]` | Intercom / Drift / Tawk |
| `email_capture[]` | Mailchimp / Klaviyo / ConvertKit |
| `has_paid_ads_evidence` | boolean — Google Ads / Meta Pixel 等说明投过广告 |
| `has_measurement` | boolean — 装了任意分析工具 |
| `sophistication_score` | 0-6 数字成熟度（决定 grade 走向）|
| `hosting_hint` | cloudflare / wordpress.com / shopify / etc. |

### `sitemap_analysis`
- `total_urls` / `has_sitemap` / `has_robots`
- `migration_complexity` (low / medium / high)
- `reason` (cmf 评估说明)

### `activity` (站点活跃度)
| 字段 | 含义 |
|---|---|
| `blog_section_present` | boolean |
| `blog_post_count` | 数量 |
| `blog_freshness` / `days_since_newest_blog` | blog 新鲜度 |
| `days_since_last_modified` | Last-Modified header |
| `days_since_any_update` | 综合活跃度判断 |
| `days_since_newest_sitemap` | sitemap.xml 中最新 lastmod |
| `overall_freshness` | active / stale / dormant |
| `social_links` | { facebook, instagram, linkedin, ... } |
| `last_modified_header` / `newest_sitemap_lastmod` | 原始数据 |

### `ai_geo` (AI 时代搜索可发现性)
- `dimension_score` (该子项得分)
- `rules[]` (LocalBusiness schema / structured data / authoritative content / etc.)
- `summary` 中文总结
- `detail` 各 rule 细节

### `domain_history`
| 字段 | 含义 |
|---|---|
| `host` | 主域名 |
| `is_au_domain` | boolean (.au 域要特殊处理) |
| `domain_age_days` / `domain_age_years` | 域名年龄 |
| `domain_created_iso` | 创建时间（whois 或 Wayback fallback）|
| `domain_age_source` | whois / wayback / unknown |
| `days_since_first_wayback_snapshot` | Wayback 第一次抓取距今 |
| `days_since_last_wayback_snapshot` | 最近抓取距今 |
| `wayback` | snapshot 列表元数据 |
| `recent_redesign_signal` | **boolean — 近 12 个月有 redesign**（trigger D-skip）|
| `au_last_modified_iso` | .au 特有字段 |
| `registrar` | 注册商 |
| `email_dns` | { spf, dkim, dmarc, posture: strong/partial/weak/none } |

### `form_audit`
| 字段 | 含义 |
|---|---|
| `form_count_total` | 页面表单总数 |
| `contact_form_count` | 联系表单数 |
| `forms[]` | 每个 form 的 { fields, types, action, method } |
| `captchas_detected[]` | reCAPTCHA v2/v3 / hCaptcha / Turnstile / Akismet |
| `has_any_captcha` | boolean |
| `has_any_anti_spam` | boolean (honeypot / 时间戳验证等)|
| `auditor_notes[]` | 高摩擦警告（如 ≥7 fields）|

### `pagespeed` (PSI API)
- `results.desktop.metrics`:
  - `lcp` (Largest Contentful Paint, ms)
  - `cls` (Cumulative Layout Shift)
  - `fid` (First Input Delay, ms — legacy)
  - `inp` (Interaction to Next Paint, ms — 2024+)
  - `ttfb` (Time to First Byte)
  - `fcp` (First Contentful Paint)
  - `si` (Speed Index)
- `results.mobile.metrics` (同上)
- `latency_ms` PSI API 调用时长
- `failures[]` 任何 API 调用失败原因

## 5. Review 分析（独立 fixture `data/v2/fixtures/reviews/<key>.json`）

`analysis` 字段（Ollama qwen3.6:27b 跑）:

| 字段 | 含义 |
|---|---|
| `positive_themes[]` | 客户提到的好处（质量 / 服务 / 价格 / 速度 / 信任）|
| `negative_themes[]` | 投诉点 |
| `quotable_for_redesign[]` | 可以放进新网站的原话（客户原文）|
| `redesign_hooks[]` | 设计方向启发（"客户重视 trust，应突出 license + insurance"）|
| `trust_signal_strength` | strong / moderate / weak |
| `owner_reply_observations` | 店主是否回复评论的观察 |
| `summary` | 1 段总结 |

外加元字段：
- `analyzed_at`, `model`, `fetched.review_count`

## 6. 其他相关 fixture（按需）

```
data/v2/fixtures/
├── detailed-audit/         主 audit fixture（本文档主对象）
├── reviews/                Google Places + Ollama 分析
├── enrichment/             外围补料（地址校验、niche 复核）
├── gbp-extras/             GBP Posts + Q&A（暂未启用）
├── visual-autoresearch/    Ollama vision audit JSON
├── search-comparison/      搜索可见度对比
├── ddg/                    DuckDuckGo 搜索快照
├── dokobot/                Web 抓取后备
├── rescore/                定期重新 grade 的对照表
└── admin-ui/               admin 渲染快照
```

## 7. 报告 HTML 三层叙述结构

每个 issue 在 HTML 渲染三段：

```html
<section class="issue critical">
  <h3>{id}</h3>
  <div class="fact">技术事实 (rationale 英文)</div>
  <div class="plain">普通话翻译 (plain_language)</div>
  <div class="impact">对客户的影响 (customer_impact)</div>
</section>
```

不变量：**plain_language 和 customer_impact 必须非空才算 issue 定稿**。如果是 null/空 → fallback 用 `rationale` 翻译版（标记 `data_missing: true` 提醒人工补）。

## 8. 派生 grade（**不在** audit 报告里，在 entity.grade）

audit 完跑 `core/scoring/lead-grading.js` → entity 加：

| 字段 | 含义 |
|---|---|
| `investment_level` | A / B / C / D |
| `product_tier` | T1 / T2 / T3 (or null for D) |
| `recommended_pricing` | { one_time: "$3-6K", monthly: null \| "$xxx/月" } |
| `skip_reasons[]` | D-grade 命中的 hard skip 规则 |
| `investment_reason` | 中文一句话 |
| `product_tier_reason` | 中文 |
| `graded_at` | ISO |

## 9. 数据完整性约束

每次 detailed_audit 跑完，**必须**满足：

- [ ] `audit_score` 是 0-100 数字
- [ ] `decision` 在枚举集合内
- [ ] `dimension_scores` 含全部 6 个 key
- [ ] `dimensions.<each>.rules` 数组非空
- [ ] `issues.critical/major/minor` 是数组（可为空）
- [ ] 每个 issue 的 `plain_language` 非空（否则 fallback warning）
- [ ] `hard_triggers` 是数组（D-skip 时非空）
- [ ] `inputs_present` 至少含 `fetch_payload: true`（否则 audit 不应跑）

## 10. 报告核心 dashboard 指标（"一眼看"）

V2 admin 详情页 + 销售邮件 + master.md 引用的：

```
audit_score          /100
decision             一句话结论
6-dim radar:         gbp / technical / ux_conversion / content / seo / visual
hard_triggers[]      flags
issues.critical[]    数量 + top 3 列表（plain_language + customer_impact）
```

## 11. 生意决策维度（grade 路由用）

派生 grade 时关注的数据：

| 信号 | 来自 | 用途 |
|---|---|---|
| `tech_stack.sophistication_score` | tech_stack | 决定 A vs B（成熟客户走 T3 月度运营包） |
| `tech_stack.has_paid_ads_evidence` | tech_stack | "投过广告" = 懂月度预算 |
| `domain_history.recent_redesign_signal` | domain_history | 命中 = D-skip |
| `activity.blog_section_present` + `days_since_newest_blog` | activity | 决定是否推月度内容包 |
| `review_count` + `rating` | entity.latest | 客户基础（决定能否 A 级）|
| `sitemap_analysis.total_urls` | sitemap | > 200 = D-skip too_many_pages |
| `entity.latest.categories.length` | entity | ≥ 5 = D-skip too_many_categories |
| `review.trust_signal_strength` | reviews fixture | strong = A 候选 |
| `cheap_audit.relevance_pass` | cheap_audit | false = niche_mismatch D-skip |

## 12. 变更规则

新增字段流程：
1. 先在本文档登记
2. 加进 `detailed-audit.js` 评分逻辑或 `build-internal-report.js` 渲染
3. 加进 fixture schema 校验
4. 跑 1 个真 lead 验证字段实际产出
5. 更新本文档「最后定稿」标志

废弃字段流程：
1. 标记 `@deprecated` 注释 + 替代字段
2. 跑历史 entity 数据迁移
3. 60 天 grace period 后删除
4. 更新本文档
