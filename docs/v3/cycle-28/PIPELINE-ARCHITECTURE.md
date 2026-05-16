# Pipeline Architecture · Cycle-28

> Stage 0-5 详细 · routing 规则 · `handoff/` 目录 schema

---

## 整体流程图

```
┌──────────────────────────────────────────────────────────────────────┐
│ Stage 0 · Intake (instant · $0)                                       │
│  Places API 或 Docker scrape                                          │
│  ↓ 写 handoff/raw/gbp-fields.json (initial)                          │
│  ↓ 写 handoff/core-facts.json (initial · name+phone+address+niche)   │
└────────────────────────────┬─────────────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────────────┐
│ Stage 0.5 · Enrichment (~10s · $0 · 并发 4 路 HTTP)                  │
│  - Places Details API 全字段 (description / types / attrs / reviews) │
│  - ABN ABR API (SearchByName → AbnDetails)                           │
│  - WHOIS RDAP (rdap.org/domain/<domain>)                             │
│  - Wayback first snapshot (archive.org)                              │
│  ↓ 写 handoff/raw/gbp-full.json + abn-record.json + whois-record.json │
│  ↓ 写 handoff/raw/wayback-first-snapshot.json                        │
│  ↓ 升级 handoff/core-facts.json (含 abn · domain_age · first_online) │
└────────────────────────────┬─────────────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────────────┐
│ Stage 1 · Light Audit (Tinyfish-only · ~10s · $0)                    │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━           │
│  抓取 (并发):                                                          │
│   - Tinyfish fetch homepage (5-7s) → markdown                         │
│   - Tinyfish search name+city+niche (5s) → 10 results                 │
│   - URL probe (HTTPS / 200/404 / favicon URL / og:image URL)         │
│                                                                        │
│  分析 (text-only · 无 LLM):                                           │
│   - light-audit.js 跑 18 个 text detectors (复用 detailed-audit rules)│
│   - issuePriorityScore() · 加权 issue × severity                     │
│                                                                        │
│  写盘:                                                                 │
│   handoff/raw/tinyfish-homepage.md                                    │
│   handoff/raw/tinyfish-search.json                                    │
│   handoff/raw/light-audit-issues.json                                 │
│   handoff/raw/issue-priority-score.json                               │
│   handoff/raw/url-probe.json                                          │
│   handoff/design/logo-source-urls.json (探测到的 logo 候选 URL)      │
│   handoff/content/reviews/real.json (从 GBP reviews 抽出 deep-link)  │
│                                                                        │
│  路由 (filter-config.json 配阈值):                                    │
│   score ≥ 30 → DEEP_AUDIT_CANDIDATE → Stage 2                         │
│   score 15-29 → QA_PENDING → operator review                          │
│   score < 15 → ARCHIVE (现网够好 / 没救)                              │
│                                                                        │
│  特殊路径 (STARTER):                                                  │
│   无网站 + GBP active + ABN active → STARTER_CANDIDATE → 直接 Stage 3│
│   网站 5xx / dead domain → STARTER_CANDIDATE (重建)                  │
│   无网站 + 无 ABN + 无 GBP traction → ENRICHMENT_NEEDED               │
└────────────────────────────┬─────────────────────────────────────────┘
                             ↓ (deep_audit_candidate)
┌──────────────────────────────────────────────────────────────────────┐
│ Stage 2 · Deep Audit (Playwright + Vision + Firecrawl · 3-5min · $0.30) │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━           │
│  - 现有 site-fetch-full · Playwright desktop + mobile + perf          │
│  - 现有 detailed-audit.js 30 rules + 5 新加 (about/table/web2/font/nav) │
│  - 现有 multi-page-crawl (Firecrawl · 5-10 pages)                    │
│  - Vision LLM (screenshot → visual_freshness + issues) ← Cascade A    │
│                                                                        │
│  写盘:                                                                 │
│   handoff/raw/audit-detailed.json                                     │
│   handoff/raw/multi-page-crawl.json                                   │
│   handoff/raw/visual-audit.json                                       │
│   handoff/raw/playwright-screenshots/                                 │
│   handoff/content/photos/source/existing-site/ (现网 <img> 抓)        │
│   handoff/design/logo-existing.{svg,png} (下载 Stage 1 探测到的 URL) │
│   handoff/audit-findings.json (每条 issue 带 fix_prescription + verification)│
└────────────────────────────┬─────────────────────────────────────────┘
                             ↓ (audit confirms worthwhile)
┌──────────────────────────────────────────────────────────────────────┐
│ Stage 3 · Build Decision · LLM 第一次出场 (~3min · $0.05) ← Cascade A│
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━           │
│  LLM Cascade A (default Codex · fallback 链):                         │
│   - customer-summary.md (双语 · 9 段 · 含 URL 来源)                  │
│   - services-list.json (从 markdown + GBP types 抽)                  │
│   - about-narrative.md (综合 about 段 + GBP description + review 语气)│
│   - faq.json (niche typical 4-6 问)                                  │
│   - page-map.json (新站要建哪几页)                                    │
│   - seo-strategy.md (长尾 target: <service> in <area>)                │
│   - reviews/generated.json (if real < 3 · AI fallback · 不标 placeholder)│
│   - reviews/selected.json (LLM 挑 top 3-5 混合 real + gen)            │
│   - issue-fix-matrix.json (audit issue → page + section + verification)│
│                                                                        │
│  Vision LLM (photos AI 分析):                                         │
│   handoff/content/photos/ai-analysis.json (每张图 placement + issues) │
│   handoff/content/photos/selected/{hero,gallery,before-after,services}│
│                                                                        │
│  Logo skill (条件触发):                                               │
│   if logo-source-urls.json 有候选 + Stage 2 下载成功:                │
│     → existing-logo-brand skill → handoff/design/logo-source.svg     │
│   else:                                                                │
│     → logo-design skill → handoff/design/logo-generated.svg          │
│                                                                        │
│  handoff/design/brand-tokens.json (从 logo 提 primary/accent/font)    │
│  handoff/design/design-style.md (LLM 推断 visual style description)   │
│                                                                        │
│  决策路由:                                                              │
│   STARTER · 无 audit · 直接 → AUTO_BUILD                              │
│   REDESIGN · audit critical ≥ 3 → AUTO_BUILD                          │
│   REDESIGN · audit critical < 3 · score 15-29 → QA_PENDING            │
│   else (audit 显示现网 OK · 我们抢不动) → ARCHIVE                      │
└────────────────────────────┬─────────────────────────────────────────┘
                             ↓ (auto_build OR operator approve)
┌──────────────────────────────────────────────────────────────────────┐
│ Stage 4 · Handoff Optimizer + Build (~5min · $0.30-0.80) ← Cascade A │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━           │
│  - final-handoff.md aggregator · 引用 handoff/* 全部                  │
│  - Codex retex template w/ handoff input                              │
│  - 输出 clients/<slug>/v2/concept/reference-adapter/index.html       │
│  - 复制 handoff/content/photos/selected/* → /v2/concept/assets/      │
│  - 复制 handoff/design/logo-{existing,generated}.svg → assets/        │
└────────────────────────────┬─────────────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────────────┐
│ Stage 5 · Publish + Verify Closed-Loop (~2min · $0)                  │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━           │
│  - Cloudflare Pages deploy                                            │
│  - pl:verify-handoff-fixes · 跑 audit-findings.json 每条 verification │
│  - 写 handoff/verification-report.json                                │
│                                                                        │
│  3-tier escalation 失败处理:                                          │
│   Tier 1 · auto-retry 1 次 (build prompt 加 "previous verification    │
│     failed: [issues]" · 重 build · 50% 概率自愈 · $0.30)              │
│   Tier 2 · section regen (只重生失败 section · $0.05 · 拼回 build)    │
│   Tier 3 · qa-pending (Discord 按钮 4 选 1)                           │
│                                                                        │
│  全 pass:                                                              │
│   - entity.phase = outreach-active                                    │
│   - 更新 master.md (sales-side aggregator)                            │
│   - 更新 internal-audit-report.html (含 verification 段 + 销售话术)  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## `handoff/` 目录 schema (per-entity)

```
clients/<slug>/v2/handoff/
├── core-facts.json                   ← S0/S0.5 · 硬数据 · 永不能错
├── business-background.preliminary.md ← S1 · Tinyfish-only 初版 · 78% 完整度
├── business-background.full.md       ← S3 · LLM cascade · 95% 完整度
│
├── raw/                              ← Stage 0-2 原始数据 · 不动 · 给 S3 LLM 当 input
│   ├── gbp-fields.json               ← S0 · 初始 entity payload 字段
│   ├── gbp-full.json                 ← S0.5 · Places Details API 全字段
│   ├── abn-record.json               ← S0.5 · ABR API 返回
│   ├── whois-record.json             ← S0.5 · RDAP 返回
│   ├── wayback-first-snapshot.json   ← S0.5 · archive.org 返回
│   ├── tinyfish-homepage.md          ← S1 · homepage markdown
│   ├── tinyfish-search.json          ← S1 · search top 10
│   ├── url-probe.json                ← S1 · HTTPS/5xx/favicon/og:image
│   ├── light-audit-issues.json       ← S1 · 18 text detector 输出
│   ├── issue-priority-score.json     ← S1 · 加权 issue × severity score
│   ├── audit-detailed.json           ← S2 · 30 rule + 5 new detector
│   ├── multi-page-crawl.json         ← S2 · Firecrawl 5-10 pages
│   ├── visual-audit.json             ← S2 · Vision LLM screenshot 评分
│   └── playwright-screenshots/       ← S2 · desktop.png · mobile.png
│
├── design/                           ← S1 探测 → S2 下载 → S3 skill 调用
│   ├── logo-source-urls.json         ← S1 · favicon · og:image · img[alt~=logo] 候选 URL
│   ├── logo-mode.json                ← S3 · "existing" | "generated"
│   ├── logo-source.svg               ← if existing · existing-logo-brand skill 输出
│   ├── logo-generated.svg            ← else · logo-design skill 输出
│   ├── brand-tokens.json             ← S3 · { primary, accent, font_heading, font_body }
│   └── design-style.md               ← S3 · LLM 推断 visual style description
│
├── content/                          ← S1+S2+S3 累积 · 给 build 用
│   ├── services-list.json            ← S3 · LLM 从 markdown + GBP types 抽
│   ├── about-narrative.md            ← S3 · LLM 综合 about + GBP description + review 语气
│   ├── faq.json                      ← S3 · niche typical 4-6 问
│   ├── reviews/
│   │   ├── real.json                 ← S1 · 从 GBP + Tinyfish search 抽 · deep-link URL
│   │   ├── generated.json            ← S3 · AI fallback (if real < 3 · 不标 placeholder)
│   │   └── selected.json             ← S3 · LLM 挑 top 3-5 混合 real + gen
│   ├── photos/
│   │   ├── source/
│   │   │   ├── gbp/                  ← S2 · Places Photo API (付费 · 默认关)
│   │   │   ├── existing-site/        ← S2 · 现网 <img> Playwright 抓
│   │   │   └── uploaded/             ← M5 revision flow · 客户上传
│   │   ├── ai-analysis.json          ← S3 · Vision LLM 评 placement + issues
│   │   └── selected/                 ← S3 · AI-approved · 按 placement 分子目录
│   │       ├── hero/
│   │       ├── gallery/
│   │       ├── before-after/
│   │       └── service-cards/
│   └── badges/
│       └── license.json              ← S0.5 · QBCC 号 · ABN · 行业认证
│
├── structure/                        ← S3 LLM 决策
│   ├── page-map.json                 ← 新站建哪几页 (home / services × N / area-pages × N / contact)
│   ├── nav-structure.json            ← top nav + footer 结构
│   └── seo-strategy.md               ← 长尾 target: <service> in <area> 组合
│
├── audit-findings.json               ← S2 · 每条 issue { id, severity, what_observed, fix_prescription, fix_target, verification }
├── issue-fix-matrix.json             ← S3 · audit issue → page + section + verification check
│
├── final-handoff.md                  ← S4 前 · aggregator · 作 build prompt input
└── verification-report.json          ← S5 · build 后 verification 闭环结果
```

---

## Routing 规则

### Route 分类 · Stage 1 决定

```
entity.latest.website 状态 →
  empty / null                          → STARTER (no_website)
  社媒主页 (facebook.com / yelp.com)    → STARTER (social_or_third_party)
  目录站 (localsearch / truelocal)      → STARTER (directory_listing)
  独立 HTTPS / HTTP                     → REDESIGN_CANDIDATE
  5xx / dead domain                     → STARTER (broken_site · 重建)
```

### Score 路由 · Stage 1 决定 (REDESIGN 路径)

```
Stage 1 issue_priority_score (0-50) →
  ≥ 30  → DEEP_AUDIT_CANDIDATE  · Tier 3 跑值得
  15-29 → QA_PENDING            · operator 复审
  5-14  → MINOR_ISSUES_ONLY     · 现网够好 · archive
  < 5   → STRONG_EXISTING_SITE  · 抢不动 · archive
```

### 阈值都在 `filter-config.json` 外置:

```json
{
  "active_profile": "default",
  "profiles": {
    "default": {
      "stage1_thresholds": {
        "deep_audit": 30,
        "qa_pending": 15,
        "minor_only": 5,
        "archive": 0
      },
      "stage2_thresholds": {
        "auto_build": 60,
        "qa_pending": 40,
        "archive": 0
      },
      "rules": {
        "no_phone_above_fold": { "severity": "critical", "weight": 8 },
        "no_city_in_hero":     { "severity": "critical", "weight": 5 },
        "no_cta_above_fold":   { "severity": "critical", "weight": 5 },
        "homepage_text_thin":  { "severity": "critical", "weight": 5 },
        // ... 全部 rule
      }
    }
  }
}
```

详细 rule 列表见 [PIPELINE-ARCHITECTURE.md § Stage 1 Detectors](#stage-1-detectors-text-only).

---

## Stage 1 Detectors (text-only · 18 个)

**复用 `core/scoring/detailed-audit.js` 现有 rules** · light-audit wrapper 过滤跑 text-detectable subset:

### A · 首屏 (max 18 分)
| Rule ID | severity | 分 | 检测 |
|---|---|---|---|
| `no_phone_above_fold` | critical | 8 | markdown 前 1500 字无电话数字 |
| `no_city_in_hero` | critical | 5 | 前 1500 字无 city 名 |
| `no_cta_above_fold` | critical | 5 | 前 1500 字无 CTA 关键词 (quote/contact/call/book/get/free) |

### B · 内容空洞 (max 12 分)
| Rule ID | severity | 分 | 检测 |
|---|---|---|---|
| `homepage_text_thin` | critical | 5 | markdown < 300 字符 |
| `missing_services_section` | critical | 4 | 无 services / what we do 标题 |
| `no_about_section` | major | 3 | 无 about / our story 标题 |

### C · 信任缺失 (max 10 分)
| Rule ID | severity | 分 | 检测 |
|---|---|---|---|
| `no_social_proof_text` | major | 4 | markdown 无 review / testimonial 词 |
| `no_license_text` | major | 3 | 无 license / QBCC / ABN / licensed / insured |
| `stale_year_in_text` | major | 3 | 含年份 < (now - 2) 且无更新年 |

### D · 本地 SEO (max 6 分)
| Rule ID | severity | 分 | 检测 |
|---|---|---|---|
| `no_city_anywhere` | major | 3 | 全 markdown 城市 mention < 2 |
| `generic_meta_desc` | major | 3 | meta description 不含城市 |

### E · 反模式 (max 4 分)
| Rule ID | severity | 分 | 检测 |
|---|---|---|---|
| `welcome_to_pattern` | minor | 2 | "welcome to" / "your trusted" / "X years of excellence" |
| `no_specific_services` | minor | 2 | 服务描述只总称 (e.g. "all roofing") 无子项 |

**Stage 1 总分 max = 50**

---

## Stage 2 Detectors (HTML-required · 加 5 个到 detailed-audit)

| Rule ID | severity | 分 | 检测 (需 raw HTML) |
|---|---|---|---|
| `no_about_section_html` (新) | major | 3 | rawHtml 找 heading 含 about / our story |
| `table_layout` (新) | critical | 4 | rawHtml ≥ 5 `<table>` 无 role=presentation |
| `web2_design_markers` (新) | major | 3 | gradient + sidebar + animated gif |
| `inconsistent_fonts` (新) | minor | 2 | head `<link>` font-family ≥ 4 |
| `mobile_nav_broken` (新) | major | 3 | mobile viewport 但 nav 无 hamburger |

加上现有 30 rules · 总 max = 100。

---

## Cascade 调用点

| 步骤 | LLM? | Cascade |
|---|---|---|
| S0 intake | ❌ 纯 HTTP | 无 |
| S0.5 enrichment | ❌ 纯 HTTP (ABR/RDAP/Wayback) | 无 |
| S1 light audit | ❌ 纯 regex / Tinyfish text | 无 |
| S2 Vision LLM (screenshot 评分) | ✅ | 现有 vision cascade |
| S2 multi-page-crawl | ❌ Firecrawl | 无 |
| **S3 customer-summary** | ✅ | **Cascade A** |
| **S3 services/about/faq/page-map/seo** | ✅ | **Cascade A** |
| **S3 photos AI analysis** | ✅ Vision | Vision cascade |
| **S3 logo skill** | ✅ (skill 内部) | skill 决 |
| **S4 retex build** | ✅ | **Cascade A** |
| S5 verification | ❌ 纯 regex / DOM check | 无 |

---

## 数据流向 (3 个最终文档的来源)

```
handoff/raw/* + handoff/content/* + handoff/design/* + handoff/audit-findings.json
                          │
       ┌──────────────────┼──────────────────┐
       ↓                  ↓                  ↓
   master.md         final-handoff.md   internal-audit-report.html
   (sales)           (build · OD)        (sales 话术)
       │                  │                  │
       │ S5 verification 写回:
       │   - 交付链接段                       - "Build 后 verification 闭环" 段
       │
   销售看              Codex retex 读        销售跟客户讲
```

详见 [DOCUMENT-TEMPLATES.md](./DOCUMENT-TEMPLATES.md)。
