# V3 · Handoff 文档结构定义 (Open Design 输入)

> **状态**: V3 立刻推进 · 不属于 V4 计划范围
> **目的**: 定义当前 V3 周期 build 阶段给 Open Design (Codex retex) 的 handoff 文档完整结构
> 现状: handoff 太薄 · OD 用 demo 占位 · build 质量不稳定
> 目标: 完整 handoff 包 · OD 一次过出 80-85 分网站
>
> **不属于本文范围**: V4 整体 pipeline 重构 → 见 [`docs/v4/`](../v4/)

---

## 1. 为什么需要这份文档

**当前 V3 痛点** (来自 `docs/v3/OD-HANDOFF-RESEARCH.md`):
- handoff 留太多自由参数 · OD 不知道好成啥样
- 没 logo / brand tokens · OD 自己挑色
- 没 photos · OD 用 SVG / placeholder
- 没 reviews · OD 编造或省略
- 没 audit issues 系统化输入 · OD 不知道修啥
- master.md 是销售向 · 不适合直接喂 build LLM

**V3 立刻要做的**: 把 build 输入升级 · 一份**完整的 handoff package** 喂给 OD · 让它不再靠"猜" · 直接渲染。

---

## 2. Handoff 目录结构 (per-customer · 当前 V3 实施)

```
clients/<slug>/v2/handoff/
│
├── README.md                          ← 入口 · 列本目录全文件 + 各文件作用
│
├── core-facts.json                    ← 硬数据 · 永不能错 · LOCKED
│
├── design/                            ← 设计系统
│   ├── logo.svg                       ← 客户 logo (existing OR generated)
│   ├── logo-mode.json                 ← "existing" / "generated" + skill 调用 log
│   ├── brand-tokens.json              ← { primary, accent, font_heading, font_body }
│   └── design-style.md                ← LLM 推断 visual style (一句话)
│
├── content/                           ← 网站文案素材
│   ├── services.json                  ← 服务清单 (3-5 条 · 含描述)
│   ├── about.md                       ← 公司故事 narrative
│   ├── faq.json                       ← niche typical 4-6 问 + 答
│   ├── hero-copy.md                   ← hero 文案建议 (标题 + 副标 + CTA)
│   └── upsell-hooks.md                ← 长期可加的 cross-sell 钩子
│
├── photos/                            ← 图片资产
│   ├── source/                        ← 抓回来的原图
│   │   └── (来自现网 <img> · 客户上传 · etc.)
│   ├── selected.json                  ← AI 挑出的 · 按 placement 分组
│   │                                    { hero: [...], gallery: [...], services: [...] }
│   └── ai-analysis.json               ← 每张图: quality / placement / issues
│
├── reviews/                           ← 评价
│   ├── real.json                      ← 真 reviews · author + rating + text + deep-link
│   ├── generated.json                 ← AI 生成补 (if real < 3 · 内部用 · 不标 placeholder)
│   └── selected.json                  ← LLM 选 top 3-5 · 混合 real + gen
│
├── structure/                         ← 新站结构
│   ├── page-map.json                  ← 新站要建哪几页 · 每页 URL + 用途
│   ├── nav.json                       ← top nav + footer 结构
│   └── seo-strategy.md                ← SEO 长尾 target (<service> in <area>)
│
├── audit/                             ← 现网 audit (REDESIGN 才有 · STARTER 跳)
│   ├── findings.json                  ← 22 条 issue · 含 fix_prescription + verification
│   └── issue-fix-matrix.json          ← issue → 新站哪页+哪 section 解决 + verification check
│
├── boundaries.md                      ← LOCKED 字段清单 · OD 不能改的
│
└── final-prompt.md                    ← build 用的总 prompt · aggregator · 引用上面所有
```

---

## 3. 每个文件的具体 schema

### 3.1 `core-facts.json` · 硬数据 (LOCKED)

```json
{
  "business_name": "VIP Roofing Brisbane",
  "phone": "(07) 3062 7779",
  "phone_tel_link": "tel:+61730627779",
  "email": "info@viproofingbrisbane.com.au",
  "address": "39/71 Eagle St, Brisbane City QLD 4000, Australia",
  "city": "Brisbane",
  "state": "QLD",
  "postcode": "4000",
  "niche": "roofer",
  "gbp_categories": ["roofing_contractor", "roof_repair_service"],
  "rating": 5.0,
  "review_count": 26,
  "abn": "12 345 678 901",
  "abn_status": "Active",
  "abn_registered_at": "2018-03-15",
  "qbcc_license": "1234567",
  "industry_memberships": ["Master Builders QLD"],
  "google_maps_url": "https://maps.google.com/?cid=...",
  "social_links": {
    "facebook": "https://facebook.com/viproofingbrisbane",
    "instagram": null,
    "linkedin": null
  },
  "hours": {
    "monday": "07:00-17:00",
    "tuesday": "07:00-17:00",
    "...": "..."
  },
  "domain": "viproofingbrisbane.com.au",
  "domain_age_years": 5,
  "first_online": "2020-08-12",
  "_meta": {
    "generated_at": "2026-05-16T10:00:00Z",
    "sources": {
      "business_name": "[GBP]",
      "phone": "[GBP]",
      "abn": "[ABR]",
      "qbcc_license": "[ABR public records]",
      "domain_age_years": "[WHOIS RDAP]",
      "first_online": "[Wayback]"
    }
  }
}
```

**LOCKED 规则**:
- LLM 永远不允许 rewrite 这些值
- 渲染时直接读 · 不经 LLM 中转
- 数字格式不许"美化" (phone 必须按原格式 · ABN 按 11 位带空格)

---

### 3.2 `design/logo.svg` + `design/brand-tokens.json`

**logo.svg**:
- 优先级 1: 客户现有 logo (从现网 favicon · og:image · header `<img>` 抽 → existing-logo-brand skill 转 SVG)
- 优先级 2: AI 生成 (logo-design skill · 无现有 logo 时)

**logo-mode.json**:
```json
{
  "mode": "existing",
  "source_url": "https://viproofingbrisbane.com.au/favicon.ico",
  "skill_invoked": "existing-logo-brand",
  "extracted_at": "2026-05-16T10:00:00Z",
  "fallback_to": null
}
```

**brand-tokens.json**:
```json
{
  "primary": "#1a3d5c",
  "primary_source": "extracted from logo dominant color",
  "accent": "#d97706",
  "accent_source": "niche typical (roofer · warm orange)",
  "font_heading": "Inter",
  "font_body": "Inter",
  "font_source": "niche typical · industry standard"
}
```

**design-style.md** (一句话):
```markdown
Modern Industrial · Trust-heavy · Editorial layout · Warm earth tones with navy anchor.
```

---

### 3.3 `content/services.json`

```json
{
  "services": [
    {
      "id": "roof-repair",
      "name": "Roof Repair",
      "description": "漏水修复 · 屋瓦更换 · 紧急维修 · 商业 + 住宅",
      "page_slug": "/roof-repair",
      "icon_hint": "wrench",
      "source": ["[GBP types: roofing_contractor]", "[官网]"]
    },
    {
      "id": "gutter-replacement",
      "name": "Gutter Replacement",
      "description": "...",
      "page_slug": "/gutter-replacement",
      "source": ["[GBP types]", "[LLM 补 · niche typical]"]
    }
  ],
  "_meta": {
    "generator": "Stage 3 LLM · Cascade A",
    "raw_input": "raw/tinyfish-homepage.md · raw/gbp-full.json"
  }
}
```

---

### 3.4 `content/about.md`

```markdown
---
generator: "Stage 3 LLM"
raw_input: ["raw/tinyfish-homepage.md#about-section", "raw/gbp-full.json", "core-facts.json"]
source_tags: ["[官网]", "[GBP]", "[ABR]"]
---

VIP Roofing Brisbane is a Brisbane-based roofing contractor with **QBCC License 1234567**
and registered ABN since 2018. We service Brisbane CBD and surrounding suburbs
with roof repair, gutter replacement, and gutter guard installation. Our 26 five-star
Google reviews speak to our commitment to quality workmanship and on-time delivery.

(全文 200-400 字 · 引用 ABN / license / review count 是 LOCKED · 不许编)
```

---

### 3.5 `content/faq.json`

```json
{
  "faqs": [
    {
      "q": "How much does roof repair cost in Brisbane?",
      "a": "Free quote · pricing depends on damage extent · we provide written estimates within 24 hours.",
      "source": "[LLM · niche typical]"
    },
    { "q": "Are you QBCC licensed?", "a": "Yes · QBCC License 1234567 · public record at ABR.", "source": "[ABR]" },
    { "q": "...", "a": "..." }
  ]
}
```

---

### 3.6 `photos/selected.json`

```json
{
  "hero": [
    { "file": "source/site-extract-1.jpg", "alt": "Brisbane Colorbond roof", "ai_score": 8 }
  ],
  "gallery": [
    { "file": "source/site-extract-2.jpg", "alt": "Recent gutter project Brisbane", "ai_score": 7 }
  ],
  "services": {
    "roof-repair": [{ "file": "source/repair-1.jpg", "ai_score": 6 }],
    "gutter-replacement": []
  },
  "before-after": [],
  "_fallback_to_sample": false,
  "_meta": {
    "total_source": 8,
    "selected": 4,
    "rejected": 4,
    "rejection_reasons": ["low-resolution", "watermark", "stock-feel"]
  }
}
```

**Fallback**: 如果现网无照片 + 客户没上传 + GBP Photo API 关 → `_fallback_to_sample: true` · OD 用 niche typical stock + 标 `data-od-sample="true"`。

---

### 3.7 `reviews/selected.json`

```json
{
  "selected": [
    {
      "author": "Sarah M.",
      "rating": 5,
      "text": "(verbatim from GBP)",
      "date": "2025-08-12",
      "source_url": "https://maps.google.com/?cid=...",
      "is_real": true
    },
    {
      "author": "Jordan W.",
      "rating": 5,
      "text": "Professional service · highly recommend.",
      "is_real": false,
      "generated_by": "Stage 3 LLM Cascade A",
      "is_placeholder": false
    }
  ],
  "_meta": {
    "real_count": 3,
    "generated_count": 2,
    "selection_strategy": "real-first · gen fill to 5"
  }
}
```

**规则**:
- Real review text + author 是 LOCKED · 必须 verbatim
- Generated review **不标 placeholder** (Matthew 决策 · 内部用)
- 但 metadata `is_real: false` 永远存 · audit 可追溯

---

### 3.8 `structure/page-map.json`

```json
{
  "pages": [
    { "slug": "/", "name": "Home", "purpose": "hero + 3 services + reviews + map + CTA", "priority": 1 },
    { "slug": "/roof-repair", "name": "Roof Repair", "type": "service", "priority": 2 },
    { "slug": "/gutter-replacement", "name": "Gutter Replacement", "type": "service", "priority": 2 },
    { "slug": "/roofer-brisbane-cbd", "name": "Roofer Brisbane CBD", "type": "area", "priority": 3 },
    { "slug": "/roofer-brisbane-northside", "name": "Roofer Northside", "type": "area", "priority": 3 },
    { "slug": "/about", "name": "About", "purpose": "company story + ABN + license · trust", "priority": 2 },
    { "slug": "/reviews", "name": "Reviews", "purpose": "26 reviews aggregator", "priority": 3 },
    { "slug": "/contact", "name": "Contact", "purpose": "form + tel + map", "priority": 1 }
  ],
  "total_pages": 8,
  "service_pages": 2,
  "area_pages": 2,
  "_meta": {
    "generator": "Stage 3 LLM",
    "rationale": "Brisbane CBD address · niche typical area pages · service split based on GBP categories"
  }
}
```

---

### 3.9 `structure/seo-strategy.md`

```markdown
---
generator: "Stage 3 LLM"
source: ["raw/audit-detailed.json.sitemap_analysis", "core-facts.json"]
---

## Primary Keywords
- "roofer Brisbane"
- "roof repair Brisbane"
- "gutter replacement Brisbane"

## Long-tail (Service × Area)
- "roof repair Brisbane CBD"
- "gutter replacement Inner Brisbane"
- "roofer Brisbane Northside"
- "gutter guard Brisbane Southside"

## Schema
- LocalBusiness (whole-site · 含 ABN · phone · address)
- Service (per service page)
- AggregateRating (含 5★ × 26)
- FAQ (per page · LocalBusiness FAQPage)
```

---

### 3.10 `audit/findings.json` (REDESIGN 才有)

```json
{
  "audit_score": 27,
  "decision": "strong_redesign",
  "findings": [
    {
      "id": "no_visible_cta_or_phone",
      "severity": "critical",
      "weight": 8,
      "what_observed": "Desktop first 1500 chars have no phone digits or CTA keywords",
      "why_it_costs": "Mobile visitors lose 80% within first 3 seconds without visible CTA",
      "fix_prescription": "Nav sticky tel: link · hero primary CTA · footer · mobile sticky CTA bar (4 placements)",
      "fix_target": ["header", "hero", "footer", "mobile-sticky"],
      "verification": "mobile首屏markdown含tel:+61730627779≥4处",
      "source": "[审计 · rule above_fold_cta_within_5s · earned 0/30]",
      "evidence_screenshot": "raw/playwright-screenshots/desktop.png#region:hero"
    }
    // ... 全部 22 条
  ]
}
```

---

### 3.11 `audit/issue-fix-matrix.json`

```json
{
  "matrix": [
    {
      "issue_id": "no_visible_cta_or_phone",
      "resolved_in_pages": ["all"],
      "resolved_in_sections": ["header.tel-link", "hero.cta", "footer.contact", "mobile-sticky-bar"],
      "verification_check": {
        "type": "regex_count",
        "target": "build output mobile HTML",
        "pattern": "tel:\\+617\\d{8}",
        "min_count": 4
      }
    },
    {
      "issue_id": "no_localbusiness_schema",
      "resolved_in_pages": ["all (head)"],
      "resolved_in_sections": ["head.json-ld"],
      "verification_check": {
        "type": "json_ld_parse",
        "target": "build output",
        "must_contain": { "@type": "Roofer", "telephone": "(07) 3062 7779" }
      }
    }
  ]
}
```

---

### 3.12 `boundaries.md`

```markdown
# OD 不能改的 (LOCKED · 严格)

## 商家硬数据 (verbatim · 一字不改)
- business_name: "VIP Roofing Brisbane"
- phone: "(07) 3062 7779"
- address: "39/71 Eagle St, Brisbane City QLD 4000"
- abn: "12 345 678 901"
- qbcc_license: "1234567"

## 评论文本 (verbatim · 引用必须 1:1)
- 见 reviews/selected.json · 每条 text 不许 paraphrase

## Brand tokens (一旦写定不许改)
- primary: #1a3d5c
- accent: #d97706
- font: Inter

## 不许做的
- 编造 license 号 / award / 价格 / 团队规模
- 改 Reference template 的 data-od-locked 区
- 删 data-od-sample 标记 (M5 客户要改占位)
- 用 "Welcome to" / "Your trusted" / "X years of excellence" 这种模板套话
```

---

### 3.13 `final-prompt.md` (build aggregator)

```markdown
You are adapting a reference website to a real customer · VIP Roofing Brisbane.

# REFERENCE TEMPLATE (locked design system)
(inline template HTML here)

# HANDOFF PACKAGE
Read these files in order:
1. core-facts.json (LOCKED data · use verbatim)
2. design/logo.svg + brand-tokens.json + design-style.md
3. content/services.json (services to feature)
4. content/about.md (about narrative · use as-is or tighten)
5. content/faq.json
6. content/hero-copy.md (hero starter)
7. photos/selected.json (which photos go where)
8. reviews/selected.json (top 5 · verbatim text)
9. structure/page-map.json (build these N pages)
10. structure/seo-strategy.md
11. audit/findings.json (22 issues to fix · with fix_prescription)
12. audit/issue-fix-matrix.json (which page/section solves which issue · with verification check)
13. boundaries.md (what you CANNOT do)

# YOUR TASK
Output complete HTML for each page in page-map.json · plus assets/ directory.

# REQUIREMENTS
- Every LOCKED field from core-facts.json must appear verbatim
- Every audit issue from audit/findings.json must be addressed per fix_prescription
- Output must pass verification checks in audit/issue-fix-matrix.json (will be run after build)
- Follow boundaries.md strictly
```

---

## 4. 当前 V3 立刻要补的 (vs 现状)

| 文件 | 现状 | V3 立刻补 |
|---|---|---|
| `core-facts.json` | ❌ 没有 · 散落 master.md frontmatter | ✅ 立刻建 · 含 ABN/QBCC/WHOIS/Wayback |
| `design/logo.svg` | ❌ OD 用 demo 占位 | ✅ Skill 调用 (existing/generated) |
| `design/brand-tokens.json` | ❌ OD 自己挑色 | ✅ 从 logo 提 · 或 niche typical fallback |
| `content/services.json` | ⚠ 部分在 master.md 文字描述 | ✅ 结构化 · 每条带 source |
| `content/about.md` | ⚠ master.md 里一段 | ✅ 独立文件 · 含 ABN/license · LOCKED |
| `content/faq.json` | ❌ 没有 · OD 编 | ✅ niche typical 4-6 问 · 含 source |
| `photos/selected.json` | ❌ OD 用 SVG / placeholder | ✅ AI 挑现网图 · 按 placement 分 |
| `reviews/selected.json` | ⚠ master.md reviewVoice 字段散 | ✅ 结构化 · real + AI fill · 含 deep-link |
| `structure/page-map.json` | ❌ OD 默认 home + services | ✅ 明确 N 页 · 含 area 长尾页 |
| `structure/seo-strategy.md` | ❌ 没有 | ✅ 长尾 target 列表 |
| `audit/findings.json` | ⚠ internal-audit-report.html 有 · 但格式不一 | ✅ JSON · 含 fix_prescription + verification |
| `audit/issue-fix-matrix.json` | ❌ 没有 | ✅ issue → page+section 映射 |
| `boundaries.md` | ✅ templates/.../HANDOFF-BOUNDARIES.md 已有 | ✅ 沿用 · 加 per-customer LOCKED 字段 |
| `final-prompt.md` | ⚠ 在 `pl-build-from-reference.js` 代码里硬编码 | ✅ 独立文件 · 引用所有 handoff 部分 |

---

## 5. 实施落点 · V3 各 Phase

| Phase | 工作 | 文件 |
|---|---|---|
| V3 当前 | core-facts.json 提取 + ABR/WHOIS/Wayback enrichment | `core/handoff/core-facts-builder.js` |
| V3 当前 | Logo skill 接入 (existing-logo-brand · logo-design) | `core/handoff/logo-dispatcher.js` |
| V3 当前 | brand-tokens 从 logo 提 · niche fallback | `core/handoff/brand-tokens.js` |
| V3 当前 | services / about / faq LLM 抽 | `core/handoff/content-builder.js` |
| V3 当前 | photos AI 分析 + 选择 | `core/handoff/photos-selector.js` |
| V3 当前 | reviews real-fetch + AI fill | `core/handoff/reviews-builder.js` |
| V3 当前 | page-map LLM 决策 · 含 area pages | `core/handoff/page-map-decider.js` |
| V3 当前 | audit findings JSON schema 升级 (加 fix_prescription) | `core/scoring/detailed-audit.js` 扩展 |
| V3 当前 | issue-fix-matrix LLM 生成 | `core/handoff/issue-fix-matrix.js` |
| V3 当前 | final-prompt.md aggregator | `core/handoff/final-prompt-aggregator.js` |
| V3 当前 | pl-build-from-reference 改读 final-prompt.md | 改现有 CLI |

---

## 6. LOCKED 字段保护 (强制)

继承 [v4/DATA-PRESERVATION-CONTRACT.md](../v4/DATA-PRESERVATION-CONTRACT.md) 同样的三类划分:

| Class | 内容 | 流向 |
|---|---|---|
| **A · LOCKED** | core-facts.json 所有字段 · review text · evidence screenshots · audit 数字 | raw → handoff (verbatim · 不经 LLM) |
| **B · SUMMARIZABLE** | about.md · services.json · faq.json | LLM 改写 · 但 raw/ 永存 |
| **C · LLM-DERIVED** | page-map.json · seo-strategy.md · issue-fix-matrix.json | LLM 推断 · 必标 source |

LLM prompt 强制约束 (build 时):
```
LOCKED 字段你只能读不能改 · 引用必须 1:1 verbatim:
- core-facts.json 所有字段
- reviews/selected.json 中 is_real:true 的 text + author + url
- audit/findings.json 中 the what_observed 字段
违反 → 输出被 acceptance criteria 拒收
```

---

## 7. 决策记录

| # | 决策 | 选项 | 时间 |
|---|---|---|---|
| H1 | Logo 优先 existing · 没有再 generate (不调 premium-logo) | ✅ | 2026-05-16 |
| H2 | Generated reviews 不标 placeholder (内部用) | ✅ | 2026-05-16 |
| H3 | GBP Photo API 默认关 (付费) · 接口留 | ✅ | 2026-05-16 |
| H4 | Real reviews 必须 verbatim · 含 deep-link URL | ✅ | 2026-05-16 |
| H5 | LOCKED 字段不经 LLM 中转 · renderer 直接读 raw | ✅ | 2026-05-16 |
| H6 | final-prompt.md 独立文件 · 不再硬编码在 CLI | ✅ | 2026-05-16 |
| H7 | audit findings 加 fix_prescription + verification 字段 | ✅ | 2026-05-16 |
| H8 | issue-fix-matrix LLM 生成 · 但必须可被 verification check 自动验证 | ✅ | 2026-05-16 |

---

## 8. Mockup · 这份 handoff 长什么样

V3 handoff 文档 mockup (用 VIP Roofing Brisbane 真数据):
**https://customer-summaries.pages.dev/mockups-v2/final-handoff.html**

(这是 v4 mockup · V3 handoff 实施时基本结构相同 · v4 加了更多 enrichment 字段如 Wayback)

---

## 9. 跟 V4 的区别

| | V3 (本文 · 立刻做) | V4 ([docs/v4/](../v4/) · 将来) |
|---|---|---|
| 触发 | build 阶段 · 单次 | 全 pipeline 累积式 (Stage 0-5 都加文件) |
| 范围 | 给 OD 的 build 输入 | 全 lead lifecycle 数据架构 |
| 数据源 | 现有 audit + GBP + 新加 ABR/WHOIS/Wayback | 同 V3 + Stage 0.5 enrichment 系统化 |
| LLM 调用 | build 前一次 (Stage 3 等价) | 推迟到 build decision · 全 pipeline 1 次 |
| 大改动 | 不动现有 Stage 1-2 pipeline | Stage 0-5 重排 · routing 改 |
| 估时 | 2-3 周融入现有 pipeline | 18 工作日重构 (3-4 周) |

**V3 把 handoff 完整化** → V4 来时直接复用这套结构 · 只多加 Stage 0-5 累积逻辑。

---

## 文档版本

- v1 · 2026-05-16 · Matthew + Claude · V3 handoff 结构定义初版
