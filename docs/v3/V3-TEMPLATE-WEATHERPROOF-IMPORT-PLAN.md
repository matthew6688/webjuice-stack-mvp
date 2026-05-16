# V3 · Weatherproof 模板入库计划

> **状态**: 计划阶段 · 暂不执行 · 等 Matthew 确认 build 策略后开干
> **背景**: Matthew 2026-05-16: "之前套用模板效果不好 · 太单一 · 很死板 · 不是所有的都是用的 · zip 是新模板 · 准备入库"
> **关键洞察**: 这个新模板是 **12-page 完整 multi-page site** · 解决之前 single-page family 太死板的问题 · 但 V3 build 流程需要升级支持 multi-page

---

## 1. 模板内容盘点 (实测 zip 后)

**Brand**: Weatherproof Roof Restorations (Brisbane)
**Style**: modern trade · durable · direct · practical
**Color**: teal accent (#177487) + charcoal slate (#0F1F24) + cool white surfaces
**Type**: Barlow Condensed display + Inter body
**Logo**: 5 SVG 变体 (light · dark · light-outlined · dark-outlined · mark)

### 12 个 HTML page

| Page | 文件 | 行数 | 用途 |
|---|---|---|---|
| Home | `index.html` | 918 | hero + services overview + reviews + CTA |
| About | `about.html` | 463 | 公司故事 · 团队 · 信任 |
| Our Work | `our-work.html` | — | 项目案例 · before/after |
| Contact | `contact.html` | 395 | form · 电话 · 地图 |
| Blog | `blog.html` | — | 10 篇 blog post |
| Careers | `careers.html` | — | 招聘 |
| Privacy / Terms | 2 pages | — | legal |
| Roof Cleaning | `services/roof-cleaning.html` | 496 | service 详情 |
| Roof Painting | `services/roof-painting.html` | 427 | service 详情 |
| Roof Repairs | `services/roof-repairs.html` | 505 | service 详情 |
| Roof Restoration | `services/roof-restoration.html` | 438 | service 详情 |

### 关键资源

- 1 shared.css (单一 design system)
- 1 shared.js
- 23 main images (hero · 4 services · 5 about · 等)
- 10 blog images
- 4 partner logos
- 10 work before/after (5 对)
- 5 logo SVG 变体

### Drop 的噪音

- 50+ raw ChatGPT export PNG (`mp64*`, `mp6f*`, `mp6g*` 等 prefix)
- Ridgewell brand-spec.json (OD agent generation 副产品 · 不是这个模板的)
- swiftbar/open-design-chrome-debug.sh (OD 调试脚本)
- weatherproof-redesign.html (496 byte stub · redirect to index.html)

---

## 2. 跟现有 4 family 的对比

| 维度 | 现有 4 family | Weatherproof (新) |
|---|---|---|
| **页数** | 1 (只 index.html) | **12** (含 services × 4 + about/contact/work/blog/careers + legal) |
| **CSS** | 内联 / 单文件 | 1 shared.css · 跨页一致 |
| **JS** | 几乎无 | 1 shared.js · fade-up animations |
| **图片资源** | 5 张 (selectedImages) | 23+ 张 (curated · niche-typical) |
| **Brand kit** | 单一 logo | 5 SVG 变体 + tokens.css + 完整 visual-style-contract |
| **Service pages** | 无 (服务列在 home) | **每个服务独立 page** · SEO 长尾天然支持 |
| **Sub-pages** | 无 | blog · careers · legal 全套 |

**结论**: 这是质的飞跃 · 不是迭代。Matthew 抱怨 "太单一" 完全对 — 现有 4 family 都是 single-page · 客户想看 "Roof Restoration 详情" 就没页可点。

---

## 3. V3 build 流程需要升级 · 3 个选项

现有 build (`pl:build-from-reference`):
```
claude CLI (sonnet-4-5) · 1 prompt 出 1 个 index.html · $0.30/build
```

新模板 multi-page · 3 个支持路径:

### Path 1 · Template-fit (推荐 · 不调 LLM · 快)
- `cp -r reference-site/* clients/<slug>/v2/concept/reference-adapter/`
- 全文 grep replace LOCKED 字段: Weatherproof → 客户名 · 电话 · 地址 · ABN 等
- LLM 只跑 1 次 · 重写 services list (4 servic描述需 customize) + about narrative
- 成本: $0.05/customer (1 LLM call)
- 时间: 30s
- **优点**: 设计 1:1 保留 Matthew 做的 (你说 "不要太单一" · template-fit 保住了设计)
- **缺点**: 服务名/页面结构 12 页固定 (但客户也通常 fit)

### Path 2 · Per-page LLM (现状延伸 · 贵)
- claude CLI · 12 prompts (每页 1 个)
- 每 prompt 含 page 模板 + 客户数据 → 输出 adapted HTML
- 成本: $0.30 × 12 = **$3.60/customer**
- 时间: 12 × 3min = 36min (serial · 并发可缩到 5min)
- **优点**: 每页都个性化
- **缺点**: 太贵 · 12× 现有成本

### Path 3 · Batch LLM (1 prompt · 出所有页)
- 1 个超长 prompt · 含 12 page 模板 + 客户数据 → 1 次输出所有 page HTML
- 成本: ~$0.80-1.50/customer (~150k token input + ~80k output)
- 时间: 5-10min
- **优点**: 中间路径 · 价格能接受
- **缺点**: claude 一次输出 12 page HTML 可能 truncate · 不稳

### 推荐: **Path 1** 当 default + Path 3 当 fallback (Matthew 想要全 LLM 时)

---

## 4. V3 import 步骤 (12 步 · 待 Matthew 拍板执行)

### Step 1 · 复制 staging → repo
```bash
cp -r /tmp/weatherproof-staging/ /Users/matthew/Developer/google-map-website-v3/templates/roofing/families/weatherproof-restoration/
```

### Step 2 · 改名 logo SVG (去 mp prefix 已做)
```bash
# 已 done in staging · 5 SVG 命名: weatherproof-roof-restorations{,-dark,-light,-dark-outlined,-light-outlined}.svg
```

### Step 3 · 提取 brand-tokens.json 从 shared.css `:root`
```json
{
  "primary": "#0F1F24",         // slate-deep
  "accent": "#177487",          // teal
  "surface": "#F4F6F5",
  "surface_white": "#FFFFFF",
  "muted_text": "#58676B",
  "border": "#D7E2E5",
  "font_display": "Barlow Condensed",
  "font_body": "Inter"
}
```

### Step 4 · 生成 design-language.md (从 visual-style-contract.md 转 V3 格式)
- 已有完整 17-section contract · 直接 copy + 加 V3 header

### Step 5 · 生成 section-patterns.json
- 从 12 HTML page 抽 section 序列
- index.html: hero · trust-bar · services-grid · about-snippet · work-preview · reviews · cta · footer
- service/*.html: hero · service-detail · before-after · faq · cta-related · cta · footer
- 等

### Step 6 · 生成 template-manifest.json
```json
{
  "templateId": "roofing/weatherproof-restoration",
  "displayName": "Weatherproof Roof Restorations · Modern Trade",
  "niche": "roofing",
  "family": "weatherproof-restoration",
  "fit": {
    "subNiches": ["roof restoration", "roof cleaning", "roof painting", "roof repairs"],
    "bestFor": [
      "established roofer with 4+ services",
      "multi-page site (12 pages)",
      "modern trade-service brand (not luxury)",
      "QLD / NSW Australia roofer"
    ],
    "notFor": [
      "single-page lead capture",
      "emergency-only roofer",
      "luxury / spa-style brand",
      "B2B / industrial only"
    ]
  },
  "buildPath": "template-fit",
  "selectedImages": {
    "hero": "assets/hero-roof-restoration.png",
    "services_grid": ["assets/service-roof-restoration.png", "assets/service-roof-cleaning.png", "assets/service-roof-painting.png", "assets/service-roof-repairs.png"],
    "about_team": "assets/about-team-roof-inspection.png",
    "trust_partners": ["assets/partners/logo-1.png", "..."]
  }
}
```

### Step 7 · 生成 HANDOFF-BOUNDARIES.md
- 沿用现有 4 family 格式
- 加 demo customer: Weatherproof Roof Restorations (用于 reference)
- LOCKED 字段清单
- LLM 不许做的反模式 (沿用)

### Step 8 · Playwright 截图 desktop.png + mobile.png
- 跑本地 server (`python -m http.server` in reference-site/)
- Playwright headless 截图

### Step 9 · 注册到 FAMILY_REGISTRY (`core/leads/reference-adapter-handoff.js`)
```js
const FAMILY_REGISTRY = {
  roofing: 'classic-premium-roftix',
  roofer: 'classic-premium-roftix',
  // ... 现有 14 trade niches ...
  'roof restoration': 'weatherproof-restoration',  // sub-niche match
  'roof_restoration': 'weatherproof-restoration',
};
```

### Step 10 · Build pl:build-from-template (新 CLI · Path 1)
- 新 CLI · 不调 LLM · 全文 grep replace
- 输入: --slug + chosen-family (从决策器)
- 输出: clients/<slug>/v2/concept/reference-adapter/ 12 page

### Step 11 · 写 1 个 LLM call · regenerate services + about
- 用 handoff/content/services.json + about.md 作为 source · 重写 4 service.html + about.html
- 保留 design + 仅替换 copy
- 成本 $0.05

### Step 12 · 测试 1 个真实 customer
- 跑 VIP Roofing Brisbane 全 path
- 看输出 · audit · 公开
- 对比现有 4 family 是否真的解决 "太单一" 抱怨

---

## 5. 集成后的 V3 流程图

```
client entity → light audit + enrichment 
              ↓
pl:build-handoff (V3 MVP · 已落 · 14 file handoff/)
              ↓
Stage 2 · pre-handoff audit (NEW · V3-BUILD-AUDIT-LOOP-PLAN Phase A)
              ↓
Stage 3 · Family 决策器:
  niche · sub-niche · audit findings · invest tier →
  选 1 of 5 family:
    classic-premium-roftix · editorial-bold · lead-capture-restoration ·
    productized-modern · weatherproof-restoration (新)
              ↓
Stage 4 · Build (default Path 1 · template-fit + 1 LLM):
  - cp reference-site/* → clients/<slug>/v2/concept/reference-adapter/
  - grep replace LOCKED 字段 (12 page 全 1:1 replace)
  - 1 LLM call · regenerate services HTML + about narrative
              ↓
Stage 5 · Post-build audit (NEW · V3-BUILD-AUDIT-LOOP-PLAN Phase A)
  A · core info verify
  B · audit fix verification
  C · aesthetic / brand consistency
              ↓
Stage 6 · Publish + internal-fix-comparison
```

---

## 6. Open questions · 等 Matthew 拍板

| # | 问题 | 选项 / 建议 |
|---|---|---|
| **WP-1** | Build path 默认走 1 (template-fit · $0.05) 还是 3 (batch LLM · $0.80) | **建议 1** · 你说 "套模板效果不好 · 太单一" 其实是 single-page 太死板 · 这个是 12-page · template-fit 不会再死板 |
| **WP-2** | 多页选择 · 是否所有客户都建 12 page? 还是看客户类型? | **建议** 决策树: STARTER → 全 12 page · REDESIGN audit critical ≥ 5 → 全 12 page · 简单 case (无 audit) → 6 page (drop blog/careers/legal) |
| **WP-3** | 这个模板替换 lead-capture-restoration 还是并存? | **建议** 并存 · 两个都是 restoration niche · 但 lead-capture 是 1-page lead form · weatherproof 是 12-page full site · 不同 use case |
| **WP-4** | 后续 Matthew 加 niche 模板 (electrician/plumber/dental) · 同 12-page 结构? | **建议** 同结构 · 不同 brand tokens + service names · 我可以写 niche-template-generator CLI 自动从 1 个 base export 衍生 N 个 niche |
| **WP-5** | 模板内 mp* prefix 文件 + Ridgewell brand-spec · 怎么处理 | **建议** drop 全部 (已 staging 排除) · 仅留 essential 46 files |
| **WP-6** | DESIGN-HANDOFF.md + DESIGN-MANIFEST.json 是 OD agent format · V3 需要吗 | **建议** 保留 in family/docs/ · 给销售看模板设计原意 · V3 build 不读它 |
| **WP-7** | 12 page 全 cp 后 grep-replace 不调 LLM · LOCKED 字段 (phone · address · ABN) verbatim · 行吗? | **建议** 可以 · 加 audit step 检查每页 LOCKED 字段全 verbatim (V3-BUILD-AUDIT-LOOP-PLAN Stage 5A · core info verify) |

---

## 7. 不在本计划范围 (deferred)

- Path 2 (per-page LLM · $3.60) · 太贵 · 暂不实现
- Path 3 (batch LLM · 1 prompt 出 12 page) · token limit 风险 · Phase B 测
- 自动从 12-page export 衍生 N 个 niche (WP-4 idea) · 等加第 6 个 family 时考虑
- Blog / careers / legal 是否要 customize · 这些是模板化 · 客户名 + 联系方式 grep replace 够 · 不需要 LLM

---

## 8. Decision Log

| # | Decision | 选项 |
|---|---|---|
| WP-A | 现在开 import (Step 1-9 复制 + 注册) · 不动 build 流程 | ✅/✗ |
| WP-B | Build 新 CLI (`pl:build-from-template-fit`) · Path 1 实现 | ✅/✗ |
| WP-C | LLM regenerate services + about (1 call · $0.05) | ✅/✗/全 verbatim |
| WP-D | 跑 1 个真实 customer 测试 (VIP Roofing Brisbane) | ✅/✗ |
| WP-E | 这个 family 跟 lead-capture-restoration **并存** | ✅/✗ replace |

---

## 9. 工作量估算

| Phase | 工作 | 估时 |
|---|---|---|
| **A.1** Step 1-9 模板入库 (cp · manifest · boundaries · screenshot · register) | 半天 |
| **A.2** Step 10 `pl:build-from-template-fit` CLI (Path 1 实现) | 1 天 |
| **A.3** Step 11 LLM 1-call services + about regenerate | 半天 |
| **A.4** Step 12 跑 1 customer 测试 + 调 | 半天 |
| **总** | | **~2.5 天** |

---

## 10. 文档版本

- v1 · 2026-05-16 · Claude 调查 + 计划 · 95% confidence
- 状态: 等 Matthew 拍 WP-1..WP-7 + WP-A..WP-E
