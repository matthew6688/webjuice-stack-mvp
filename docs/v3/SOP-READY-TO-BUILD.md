# SOP · Ready-to-Build 筛选标准 (M2 → M3 之间的 qualification gate)

> **作用域**: A/B 分级后 · 进入实际 build website 之前 · 客户必须满足的筛选标准。
> **owner**: M2 audit 出口 + M3 build 入口之间的 "qualification" 阶段 (D39 新 phase)。
> **status**: D39 (2026-05-14) 第一版 · 等 Matthew M1/M2 验证完后实装。

---

## 0. TL;DR

```
A/B 分级 (M2 出口)
   ↓
Multi-page crawl (homepage + about + services + contact + portfolio + ...)
   ↓
JSON dump 全 raw 给 AI 分析 · 提取核心信息 + 品牌素材
   ↓
Hard Gates (7 项 · 任一不通过 → archive)
   ↓
Scorecard 5 维 · 100 分 (核心信息 30 + 品牌 15 + 范围 25 + 技术 15 + 解决性 15)
   ↓
≥ 70 → phase=ready-to-build → 自动触发 M3 build
< 70 → phase=qualification-pending → operator review · 补缺重评
```

**核心原则**:
1. 核心信息有就用 · **没有不编造**
2. logo 没有 OK · 我们有 create-logo skill
3. 想用 AI 处理 raw JSON · 不预定义 extractor
4. 免费 sitemap 服务先试 · 不行再付费

---

## 1. Hard Gates · 7 项 (revised · 砍 2)

任一不通过 → ENTITY_PHASE = `archived` + `archive_reason`。

| # | Gate | 阈值 | 检测方式 |
|---|---|---|---|
| 1 | **页面太多** | sitemap > 50 pages | sitemap-analyzer (free) |
| 2 | **多业务复杂** | GBP ≥ 4 categories OR sitemap 服务页 ≥ 5 不同 niche | GBP + sitemap pattern |
| 3 | **e-commerce** | 现网有 cart/checkout/product/shop pattern | rawHtml + tech-stack (Shopify/WooCommerce/Magento 等) |
| 4 | **会员/portal** | 检测 /login /account /portal /dashboard /members | 多页 crawl |
| 5 | **活跃 blog 重** | > 50 blog posts (我们不迁内容) | sitemap pattern (blog-sitemap / post-sitemap) |
| 6 | **第三方集成深** | 检测 booking/CRM/booker embed (Mindbody · Calendly · Square · Acuity · TidyCal · Booker · etc.) ≥ 1 处 | tech-stack-detector |
| 7 | **第三方 pixel 过多** | tech_stack pixels[] 含 ≥ 5 个 (重投广告归因 · 重建破坏 attribution) | tech-stack pixels[] |

**砍掉 (per Matthew · "去掉")**:
- ~~域名所有权~~ (建网站不需要客户立刻给 DNS access)
- ~~版权诉讼/red flag~~ (操作员看 thread message · 不专门 gate)

---

## 2. Scorecard · 5 维 · 100 分 (revised)

### 维度 A · 核心信息 (30 分 · 升)

**有就用 · 没有不编造**。每项有 = 满分 · 缺 = 0 分。

| 子项 | 分 | 来源 |
|---|---|---|
| 商家名 | 4 | GBP + 现网 (拿到就行 · 不强求法定名一致) |
| 电话 ≥ 1 | 5 | GBP + 现网 |
| email ≥ 1 | 5 | /contact/ scrape + multi-page (无 → 0 分 · 不编造) |
| 物理地址 OR 明确 service area | 4 | GBP + 现网 |
| 营业时间 (≥ 5 天) | 3 | GBP |
| 服务列表 ≥ 1 项 | 3 | 现网 + GBP categories (有 1 项 OK · 不严) |
| 资质/牌照 (license/ABN/QBCC 等) | 3 | 现网 about (有更好 · 没有 0 分但不阻塞) |
| 创立年份 / 经营年数 | 3 | WHOIS + 现网 about (有更好) |

**通过线**: ≥ 18 分 (至少前 4 项 + 1)

### 维度 B · 品牌素材 (15 分 · 降 · logo 不强制)

| 子项 | 分 | 检测 |
|---|---|---|
| Logo: 有 OR 可创建 (create-logo skill) | 3 | scrape og:image / favicon · 没有 → 用 create-logo · **不扣关键分** |
| 品牌色 (能识别 primary · 至少 1 个) | 3 | vision LLM 看现网 hero |
| 字体方向 (sans/serif/handwritten) | 1 | computed style |
| 客户真实照片 ≥ 3 张 (team / project) | 4 | GBP photos + 现网 gallery scrape |
| 真实客户评价 ≥ 3 条 | 2 | Google reviews + 现网 testimonials |
| Voice/tone 能提取 | 2 | LLM analyze copy |

**通过线**: ≥ 8 分 (无 hard 阻塞)

### 维度 C · 范围可行性 (25 分 · 升)

| 子项 | 分 | 检测 |
|---|---|---|
| 页面 ≤ 10 (T1 1-page · T2/T3 5-page) | 8 | sitemap |
| 没要求 booking/payment (升级 T3 才支持) | 5 | 现网 + tech-stack |
| 没要求 multilingual | 3 | 现网 lang attr |
| 没要求实时 dynamic (库存/价格 daily 变) | 4 | LLM 推 niche typical |
| Form 简单 (≤ 5 fields · 无 multi-step) | 3 | form-audit |
| ~~service type 一致~~ | ~~砍~~ | 跨 niche OK · 不阻塞 |
| 没要求复杂 layout (parallax / 3D / animation 重度) | 2 | vision LLM 看现网 |

**通过线**: ≥ 16 分

### 维度 D · 技术迁移风险 (15 分 · 降)

| 子项 | 分 | 检测 |
|---|---|---|
| Sitemap 完整 (能列 URL 做 redirect plan) | 4 | sitemap-analyzer |
| SEO impact 低 (现 organic 流量低 / SimilarWeb traffic estimate < 1k/月) | 4 | PageSpeed + Ahrefs free (1 lookup/customer 免费 quota) |
| SSL/HTTPS OK | 3 | 自动 detect |
| 3rd party pixel ≤ 3 (≥ 4 但 < 5 → 降分 · ≥ 5 已 hard gate) | 4 | tech-stack pixels[] |
| ~~域名所有权清楚~~ | ~~砍~~ | 不要求 |

**通过线**: ≥ 10 分

### 维度 E · Audit 问题可解性 (15 分 · 升 · 不只 top 3)

**revised per Matthew "尽量多的解决所有的 audit 问题"**:

| 子项 | 分 | 检测 |
|---|---|---|
| 所有 audit issues 中 design/UX 类占比 ≥ 70% | 7 | audit issues 分类 (design/UX vs infrastructure vs content) |
| Top 3 issues 都是 design/UX | 3 | sort by severity |
| 没有 "基础设施" 致命 issue (e.g. 服务器/DB broken · 域名 expire) | 3 | tech audit |
| Visual outdated 是主因 (visual_freshness < 5) | 2 | 已 audit |

**通过线**: ≥ 10 分 (确保我们能交付价值)

### 维度 F · 客户参与就绪度 (0 分 · **全砍**)

per Matthew: "客户参与度 · 没有 · 不需要"

→ 不评 · cold lead 一样可进入 ready-to-build。outreach 是 M4 · 不阻塞 build。

---

## 3. 总分阈值

```
hard gates 全过 + 5 维 ≥ 70
   ↓
ENTITY_PHASE = 'ready-to-build'
触发: pl:build-from-reference + pl:publish-demo
```

```
hard gates 全过 但 < 70
   ↓
ENTITY_PHASE = 'qualification-pending'
operator review · 补缺信息 · 重新评 (manual entity edit + re-run scorecard)
```

```
任一 hard gate 不过
   ↓
ENTITY_PHASE = 'archived'
archive_reason = "gate_X_fail · {detail}"
```

---

## 4. 数据收集 · Multi-page crawl + AI 分析

### 4.1 Sitemap 发现 · 免费先试 · paid fallback

**Layer 1 · 免费 (依次尝试)**:
1. `https://<domain>/sitemap.xml` (已实装 sitemap-analyzer)
2. `https://<domain>/robots.txt` → 读 Sitemap: 指令 (已实装)
3. Common patterns: `/sitemap_index.xml` · `/sitemap-1.xml` · `/post-sitemap.xml` · `/page-sitemap.xml` (待加 · 5 min 实装)
4. **Crawl from homepage links** (BFS 2 级 · 自己 crawler · puppeteer 已有) — list internal anchors → fetch / 2 级 list
5. **Wayback Machine API** (`https://web.archive.org/cdx/search/cdx?url=domain&output=json`) — 历史 URL 列表 (已实装 in domain-history)
6. **Bing Webmaster Public** (无 site verification 时 limited · skip · 暂不用)

**Layer 2 · 付费 fallback** (仅 free 全失败 OR Layer 1 返 < 5 pages 且客户高值时):
- **DataForSEO Sitemap API** · ~$0.005/lookup · 1 lookup = 完整 sitemap
- **Ahrefs Site Audit (free 限额)** · 5/day · 自动 sitemap discovery
- **Screaming Frog (free desktop 500 URL)** · 本地跑 · 手动 export

**实装顺序**:
- D39: free Layer 1 (1-5 patterns + BFS + Wayback) → 90% 客户 OK
- P3 backlog: paid fallback (DataForSEO API) · 月预算 ~$5

### 4.2 Multi-page Crawl · 不预定义 extractor

**per Matthew "不要自己定义你要拿什么内容 · 就是把 json 全部抓回来 · 给 AI 去分析"**:

```js
// core/audit/multi-page-crawl.js (新 D39)
async function crawlPages(urls, options) {
  return await Promise.all(urls.map(async (url) => ({
    url,
    fetched_at: Date.now(),
    status: ...,
    final_url: ...,
    title: ...,
    meta: { description, og:*, twitter:* },
    rawHtml: ...,         // full HTML
    text: ...,            // text-only extraction
    images: [{src, alt, width, height}, ...],
    links: [{href, text, internal}, ...],
    forms: [{action, fields: [...]}, ...],
    headings: [{level, text}, ...],
    structured_data: {...},  // schema.org JSON-LD
  })));
}
```

**Pages to crawl** (~8-12 per customer):
- Homepage
- `/about` · `/about-us` · `/our-story`
- `/services` 首页 + ≤ 5 个 individual service pages
- `/contact` · `/contact-us`
- `/portfolio` · `/projects` · `/gallery` (≤ 3 pages)
- `/team` · `/our-team`
- `/testimonials` · `/reviews`
- `/blog` 首页 (检 active · 不抓 post 内容)
- `/faq` (如有)

Cost: Firecrawl ~$0.02/page × 10 page = $0.20 · OR Playwright batch (free · ~30s)

### 4.3 AI 分析 · 提取核心信息 + 拓展优化

**Prompt** (claude_cli sonnet-4-5):
```
You are analyzing a real local business website for a redesign project.
Below is the raw scrape of N pages (homepage + about + services + contact + ...).

Extract for each category. Match REAL data only — NEVER invent · use the customer's exact words.

REAL (must be customer's own · 核心不能错):
- business_name: exact spelling
- phone: all listed (verified format)
- email: all listed
- address: exact street + suburb + state + postcode
- license_numbers: regex patterns (ABN/QBCC/license)
- founded_year: regex "since YYYY" / "established YYYY"
- owner_name: from About page
- service_list: name + brief (1 sentence) · only services they explicitly offer
- testimonials: quote + author + location (real customer testimonials only)
- team_members: name + role (if shown)

BRAND ASSETS (可推断):
- logo_url: highest-res image referenced (og:image · favicon · header logo)
- primary_color · accent_color: from CSS/Hero
- font_family: from CSS @font-face
- voice_tone: classify (formal/casual/expert/luxury/friendly)
- key_messaging: 3-5 phrases customer uses to describe themselves

EXTEND (AI 优化 · 可拓展 · 标 source=ai):
- improved_hero_copy: more compelling H1 + subhead variants (2-3 options)
- improved_service_descriptions: rewrite each service for clarity + benefit
- meta_descriptions: SEO-optimized per page
- cta_suggestions: action verbs · niche-typical
- trust_signals_to_emphasize: from existing material

Output JSON:
{
  "core_info": { ... },
  "brand_assets": { ... },
  "extensions": { ... },
  "redesign_brief": "1-paragraph synthesis · what we should keep · what we should improve",
  "qualification_flags": {
    "scope_pages_estimate": N,
    "complexity": "simple|medium|complex",
    "logo_quality": "have|low-res|missing",
    "ready_to_build_concerns": [...]
  }
}
```

Cost: ~$1-2 per customer (claude sonnet-4-5 · 50KB input + 10KB output)

Output stored: `clients/<slug>/v2/redesign-brief.json`

### 4.4 写回 entity

```js
entity.qualification = {
  computed_at: "...",
  hard_gates: { gate_1: pass · gate_2: pass · ... },
  scorecard: {
    A_core_info: 26/30,
    B_brand: 11/15,
    C_scope: 21/25,
    D_tech: 13/15,
    E_solvability: 12/15,
    total: 83/100,
    threshold: 70,
    verdict: 'ready-to-build',
  },
  redesign_brief_path: 'clients/<slug>/v2/redesign-brief.json',
}

entity.phase = 'ready-to-build'  // 或 qualification-pending · archived
```

---

## 5. ENTITY_PHASE 新加 (D39)

```js
ENTITY_PHASE = {
  AWAITING: 'awaiting',                  // intake 后
  DESIGN_READY: 'design-ready',           // M2 audit + grade done (旧 · 不变)
  QUALIFICATION_PENDING: 'qualification-pending',  // ★ 新 D39 · 通过部分 gate · 缺信息
  READY_TO_BUILD: 'ready-to-build',      // ★ 新 D39 · 全过 + scorecard ≥ 70 · 触发 M3
  // ...
  OUTREACH_ACTIVE: 'outreach-active',
  // ... (其他不变)
}
```

Flow:
```
design-ready (audit done)
  ↓ qualification check
  ├─ hard gate fail → archived
  ├─ hard gate pass + score < 70 → qualification-pending (operator manual)
  └─ all pass + score ≥ 70 → ready-to-build → auto trigger M3
```

---

## 6. Operator Workflow

### 6.1 自动阶段 (audit 后 chain)

```
1. M2 audit pipeline done (D38 Stage 4 后)
2. setEntityPhase('design-ready')
3. ★ NEW · Stage 5: qualification check
   a. Multi-page crawl (~30s · sitemap discovery 优先 free)
   b. AI 分析 raw JSON · 提取 + 拓展 → redesign-brief.json
   c. 跑 hard gates (auto)
   d. 跑 scorecard 5 维 (auto · 大部分字段从 crawl 结果取)
   e. 写 entity.qualification + setEntityPhase
   f. Discord post Stage 5 消息
4. If ready-to-build → 自动 chain pl:build-from-reference + pl:publish-demo
   If qualification-pending → 等 operator
```

### 6.2 Discord 通知格式 (新 Stage 5)

```
**Stage 5/5 · Qualification check** · 45s

Hard gates: 6/7 passed (gate-5 blog: 32 posts OK)
            ❌ gate-3 e-commerce: WooCommerce 检测 · 跳过 build

OR 全过 → Scorecard 83/100:
- A 核心信息: 26/30 (license 缺)
- B 品牌素材: 11/15 (logo low-res · create-logo skill 备)
- C 范围: 21/25 (7 pages · OK)
- D 技术: 13/15 (3 pixels)
- E 解决性: 12/15 (UX 80% · 服务器 1 issue 不解)

Phase: ready-to-build (set) · 自动 chain M3 demo build
Redesign brief: [redesign-brief.json](url) · 7 services · 真照 4 张 · voice expert/professional
```

### 6.3 manual review (qualification-pending 时)

operator 在 thread:
- 看 scorecard 弱项 · 补字段 (e.g. 手动加 email 到 entity.latest.email)
- React ✅ → 触发 re-qualification check (pl:check-qualification)
- React 🗑 → archive · reason="manual sales call · not interested"

---

## 7. 实装 backlog

| 项 | 工作量 | 优先级 |
|---|---|---|
| `core/audit/multi-page-crawl.js` · BFS + sitemap_v2 + Wayback fallback | 4h | P1 (核心) |
| `core/audit/redesign-brief-builder.js` · claude_cli prompt + parse | 3h | P1 |
| `core/scoring/qualification-scorecard.js` · 7 hard gates + 5 维 scoring | 2h | P1 |
| `core/leads/discovery-store.js` 加 2 phase (qualification-pending · ready-to-build) | 30 min | P1 |
| `scripts/cli/pl-check-qualification.js` · manual + auto run · 写 entity.qualification | 1.5h | P1 |
| `audit-stage-messages.js` 加 stage5Message | 30 min | P1 |
| run-audit-pipeline.js 加 Stage 5 hook | 30 min | P1 |
| LEAD-JOURNEY 加 Stage 12.5 (qualification gate) | 30 min | P2 |
| DataForSEO paid fallback (sitemap) | 1h | P3 |

**总计**: ~13h · ~$0 (除 paid sitemap fallback) · 单客户 cost: $1-2 (AI 分析) + $0.005 (sitemap 付费 fallback if needed)

---

## 8. 数据存哪 (per Matthew "数据存哪")

```
clients/<slug>/v2/redesign-brief.json     # AI 分析输出 · 核心 + 拓展
clients/<slug>/v2/multi-page-crawl/        # raw page JSON dump
  - homepage.json
  - about.json
  - services-{name}.json
  - contact.json
  - ...

entity.latest.{email · contact_us_url · social_links}  # 已 D37
entity.latest.{brand_assets · content_assets · business_info}  # ★ D39 新
entity.qualification = {hard_gates · scorecard · verdict}  # ★ D39 新
entity.phase = qualification-pending | ready-to-build  # ★ D39 新
```

---

## 9. 相关文档

- [LEAD-JOURNEY.md](./LEAD-JOURNEY.md) · 加 Stage 12.5 qualification (待 D39 实装)
- [SOP-2-FLOW.md](./SOP-2-FLOW.md) · M2 audit · D39 后加 Stage 5
- [SOP-3-FLOW.md](./SOP-3-FLOW.md) · M3 publish · qualification gate 之后才走
- [SOP-AUDIT-STAGE-NOTIFICATIONS.md](./SOP-AUDIT-STAGE-NOTIFICATIONS.md) · 加 Stage 5 通知
- [DECISIONS-LOG.md](./DECISIONS-LOG.md) · D39 (待 Matthew review 后正式 log)

---

## 10. ⚠️ Matthew review 后开干 · 5 个 open questions

1. **5 维 weights** (30+15+25+15+15) OK 吗?
2. **总分 70** 合理? 50/60/80?
3. **multi-page crawl 工具**: Firecrawl ($0.20/customer) 还是 Playwright (free · 慢)?
4. **AI 分析 raw JSON · 用哪家**: claude_cli sonnet-4-5 ($1-2/customer) · GPT-4o · Gemini?
5. **新 phase 名**: `qualification-pending` + `ready-to-build` 合适? 还是 `info-pending` · `build-ready`?

回话后开干 · 在你完成 M1/M2 验证后整合到现 pipeline。
