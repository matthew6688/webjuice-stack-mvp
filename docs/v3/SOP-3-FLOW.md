# SOP-3 · audit → 网站 demo + CF Pages publish · 全链路文档

> **作用域**: 从 M2 出口 (master.md design-ready · audit 全 asset 在) 开始，到 `<slug>-dev.pages.dev` live URL 结束。
> **不在范围**: outreach (M4) · 购后 (M5) · 自定义域名。
> **owner**: M3-PRD owns 设计 · 本 doc 是 Operator-facing runbook。
> **status**: 当前生产实装 · 10 个真客户 live · curl 200 verified。
> **依赖**: SOP-2 已跑完 (master.md 22 章 + audit assets 全在)。

---

## 0. TL;DR · 1 屏看懂

```
M2 出口 · master.md 22 章 + audit assets · phase=DESIGN_READY
        │
        ▼
pl:build-from-reference --slug <customer-slug>
   └─ claude CLI · reference HTML → adapted demo HTML
   └─ output: clients/<slug>/v2/concept/reference-adapter/index.html + assets/
        │
        ▼ (并行 OK)
pl:build-customer-audit --slug <customer-slug>
   └─ claude CLI · English-only audit page
   └─ output: clients/<slug>/v2/customer-facing-audit.html
        │
        ▼ (optional polish · 多轮)
pl:optimize-internal-report --slug <customer-slug>
   └─ 3-5 round autoresearch on internal audit HTML
   └─ output: internal-audit-report.optimized.html
        │
        ▼
pl:publish-demo --slug <customer-slug>
   ├─ stage dir 拼装 (D28 bundle):
   │     adapter + audits + master.md + screenshots + evidence + video
   ├─ CF API ensure project (idempotent)
   └─ wrangler pages deploy → <slug>-dev.pages.dev
        │
        ▼
LIVE · https://<slug>-dev.pages.dev
   (demo + customer audit + master.md + internal audit + 截图/证据/视频)
```

**端到端单客户**: ~5-8 分钟 · ~$0.60 (无 optimize)

---

## 1. 入口触发方式

### 1.1 手动 · 单客户 (主路径)

```bash
# 全套 pipeline (推荐)
npm run pl:build-from-reference -- --slug brisbane-roof-restoration-experts
npm run pl:build-customer-audit -- --slug brisbane-roof-restoration-experts
npm run pl:publish-demo         -- --slug brisbane-roof-restoration-experts
```

### 1.2 手动 · 批量 (10 客户一起)

```bash
npm run pl:bulk-publish-demo -- --all
# 或指定:
npm run pl:bulk-publish-demo -- --slugs slug1,slug2,slug3
```

### 1.3 自动 · auto-build hook (半实装)

**File**: `scripts/cli/pl-auto-build-demo.js`
**Status**: 存在但未默认 enabled · 需手动 wire 进 audit pipeline Stage 4 完成 hook。

### 1.4 Discord 触发

目前**无 Discord kind** 直接触发 M3 (intent-router 没有 `publish` kind)。要走 Discord 必须先 ops kind + 人工指令。
**Future**: 加 `kind=publish` · routeIntent 识别 "publish <slug>" 或 "发布 <slug>"。

---

## 2. Step 1 · pl:build-from-reference

**File**: `scripts/cli/pl-build-from-reference.js`
**Core lib**: `core/leads/reference-adapter-handoff.js#buildAdapterPayload`

### 2.1 工作流

1. 找 entity file (slug → frontmatter `business_id` → `data/leads/entities/<key>.json`)
2. 读 master.md (22 章源)
3. niche → `FAMILY_REGISTRY` lookup → reference family (现 1 个 · `classic-premium-roftix`)
4. 构造 payload:
   - 客户信息 (name / phone / address / website / niche / city)
   - master.md 第二章 audit 痛点 (top 3-5 issues)
   - reference site `index.html` 全文
   - reference site `HANDOFF-BOUNDARIES.md` (AI 改什么 / 不改什么)
   - 5 张 PNG 资源说明 (hero / about / project / 2× service)
5. spawn `claude` CLI (sonnet-4-5 · stream stdout)
6. 解析 stdout · 提取 HTML block
7. 写入 + 复制 5 张 PNG (assets/ 目录)

### 2.2 输入参数

```bash
npm run pl:build-from-reference -- --slug <customer-slug> [--model claude-sonnet-4-5]
```

### 2.3 Output

```
clients/<slug>/v2/concept/reference-adapter/
├── index.html         # adapted HTML · 改了 business name / phone / address / hero copy
└── assets/
    ├── hero-premium-roof.png
    ├── about-roofer-working-roof-frame.png
    ├── project-before-after-roof-transformation.png
    ├── service-roof-installation-detail.png
    └── service-roof-repair-flashing-detail.png
```

### 2.4 时间 + 成本

- 耗时: ~3 min (claude 单次 ~57k input + 12k output)
- 成本: ~$0.30

### 2.5 HANDOFF-BOUNDARIES 规则 (reference 内嵌)

claude 必须遵守:
- ✅ 改: business name · phone · address · hero copy · service copy · CTA text
- ❌ 不改: layout · CSS · 字体选择 · 颜色 token · section 顺序 · 图片
- ❌ 不加: 新 section · 新 JS · 外链
- 输出: 单个 self-contained HTML (内联 CSS · 引用 ./assets/<png>)

---

## 3. Step 2 · pl:build-customer-audit

**File**: `scripts/cli/pl-build-customer-audit.js`
**System preamble**: `core/reports/generator.js#SYSTEM_PREAMBLES.customer`

### 3.1 D26 强制规则

- LANGUAGE: ENGLISH ONLY
- SPELLING: Australian (colour / optimise / behaviour / centre)
- HEADERS: "What's Working Well" / "What's Holding You Back" / "What Changes When We Fix This" / "Next Step"
- TONE: Australian-friendly · 不强推销 · 不显示价格 · 邀请 walkthrough only
- LENGTH: ~9 KB HTML (短 · 客户能扫完)

### 3.2 Verification (after run)

```bash
python3 -c "
import re
html = open('clients/<slug>/v2/customer-facing-audit.html').read()
chinese = len(re.findall(r'[一-鿿]', html))
print('Chinese chars:', chinese, '(must be 0)')
"
```

---

## 4. Step 3 · pl:optimize-internal-report (可选)

**File**: `scripts/cli/pl-optimize-internal-report.js`
**Goal**: 给 Matthew 自己看的 audit · 通过多轮 critique + rewrite 把版式 + 内容质量推到极致。

### 4.1 多轮流程

```
Round 1: generate (源: internal-audit-report.html · 强制中文标题 一、二、三章节序)
Round 2: critique (LLM 自审 · 找 5-10 个 issue)
Round 2: rewrite (改 issue)
Round 3: critique + rewrite
[default --rounds 3]
```

每轮 critique + rewrite 全留底到 `internal-audit-report.optimized.history.json`。

### 4.2 输出

```
clients/<slug>/v2/internal-audit-report.optimized.html       (~38 KB · 3 round)
clients/<slug>/v2/internal-audit-report.optimized.history.json (~24 KB · 轮次留底)
```

### 4.3 已知 bug

Round 3 critique 偶尔复读 Round 2 (LLM 静默 · 不影响 rewrite 但浪费一次 critique)。
**Priority**: low · cosmetic · 已 spawn task 单独处理。

---

## 5. Step 4 · pl:publish-demo (CF Pages)

**File**: `scripts/cli/pl-publish-demo.js`

### 5.1 Stage dir 拼装 (D28 完整 bundle)

```
data/qa/cf-pages-stage-<slug>-<timestamp>/
├── index.html                              ← reference-adapter HTML (rewritten links)
├── assets/                                 ← 5 PNG copy
│   └── *.png
├── customer-facing-audit.html              ← English audit page
├── master.md                               ← internal source-of-truth (D28)
├── master.report.html                      ← md→html (D28)
├── internal-audit-report.html              ← 中文 audit (D28)
├── internal-audit-report.optimized.html    ← 多轮优化 (若存在 · D28)
├── screenshots/                            ← desktop.png + mobile.png (D28)
├── evidence/                               ← issue-*.png (D28)
└── video/                                  ← mobile-throttled.webm (D28)
```

### 5.2 CF API 步骤

1. POST `https://api.cloudflare.com/client/v4/accounts/<id>/pages/projects`
   - Body: `{ name: '<slug>-dev', production_branch: 'main' }`
   - Idempotent (already exists 跳过)
2. `wrangler pages deploy <stageDir>` 参数:
   - `--project-name <slug>-dev`
   - `--branch main`
   - `--commit-dirty=true`
   - `--commit-message "pl-publish-demo <slug> <iso-timestamp>"` (D28 修 wrangler invalid commit message bug)
3. 写 `clients/<slug>/v2/concept/reference-adapter/cf-pages-deploy.json` (deploy record)

### 5.3 Env 必需

```bash
CF_API_TOKEN=...       # Pages:Edit scope
CF_ACCOUNT_ID=...      # CF dashboard 右下
```

---

## 6. Output · Live URLs

```
https://<slug>-dev.pages.dev/
                          /index.html                          ← demo HTML (adapted)
                          /customer-facing-audit.html          ← English audit (sales 用)
                          /master.md                           ← internal source-of-truth
                          /master.report.html                  ← md→html 渲染
                          /internal-audit-report.html          ← 中文 audit
                          /internal-audit-report.optimized.html   (若存在) ← 多轮优化版
                          /screenshots/desktop.png             ← 现状 desktop
                          /screenshots/mobile.png              ← 现状 mobile
                          /evidence/issue-*.png                ← annotated 问题截图
                          /video/mobile-throttled.webm         ← Slow 3G 录屏
```

---

## 7. Discord 汇报 · 当前现状

**目前无原生 Discord 触发** · 在 admin URL / Hermes 中跑。Future kind=publish 加上后将走 SOP-1 路径回报。

**手动跑的现 stdout 格式** (例 brisbane-roof):

```
[pl:publish-demo] slug:    brisbane-roof-restoration-experts
[pl:publish-demo] project: brisbane-roof-restoration-experts-dev
[pl:publish-demo] copied 5 asset files
[pl:publish-demo] included customer-facing-audit.html
[pl:publish-demo] included master.md
[pl:publish-demo] included master.report.html
[pl:publish-demo] included internal-audit-report.html
[pl:publish-demo] included internal-audit-report.optimized.html

[pl:publish-demo] ensuring project exists...
[pl:publish-demo] ✓ project already exists · reusing

[pl:publish-demo] deploying ... → brisbane-roof-restoration-experts-dev.pages.dev

✨ Compiled Worker successfully
✨ Success! Uploaded 0 files (20 already uploaded) (0.28 sec)
🌎 Deploying...
✨ Deployment complete!

[pl:publish-demo] ✅ DONE
  Demo URL:           https://brisbane-roof-restoration-experts-dev.pages.dev
  Customer audit URL: https://.../customer-facing-audit.html
  master.md URL:      https://.../master.md
  Internal HTML URL:  https://.../internal-audit-report.html
  Record:             /Users/matthew/.../cf-pages-deploy.json
```

---

## 8. 全部 asset 清单 · 网站 publish 之前/之后

### 网站 publish 之前 (build phase)

```
clients/<slug>/v2/concept/reference-adapter/
├── index.html                  # build-from-reference 出
└── assets/*.png                # 5 PNG copy from reference

clients/<slug>/v2/
├── customer-facing-audit.html  # build-customer-audit 出
├── internal-audit-report.optimized.html  (可选) # optimize-internal-report 出
└── internal-audit-report.optimized.history.json  (可选)
```

### 网站 publish 之后 (deploy phase)

```
clients/<slug>/v2/concept/reference-adapter/
└── cf-pages-deploy.json        # 含 demo_url / audit_url / master_md_url / etc.
```

**CF Pages 端 (cloudflare 维护 · 我们不本地存)**:
- project: `<slug>-dev`
- production deployment URL: `https://<slug>-dev.pages.dev`
- preview deployment URLs (per deploy · 历史可查 · 例 `https://115ad632.<slug>-dev.pages.dev`)

---

## 9. 10 真客户 live URL (per 5/13 batch)

| Customer | Demo URL | Customer Audit | master.md |
|---|---|---|---|
| brisbane-roof-restoration-experts | [demo](https://brisbane-roof-restoration-experts-dev.pages.dev) | [audit](https://brisbane-roof-restoration-experts-dev.pages.dev/customer-facing-audit.html) | [md](https://brisbane-roof-restoration-experts-dev.pages.dev/master.md) |
| brisbane-roofing-solutions-... | [demo](https://brisbane-roofing-solutions-roof-restoration-repairs-dev.pages.dev) | [audit](https://.../customer-facing-audit.html) | [md](https://.../master.md) |
| diamond-roof-tiling-restoration | [demo](https://diamond-roof-tiling-restoration-dev.pages.dev) | … | … |
| fix-my-roof-total-roof-restorations | [demo](https://fix-my-roof-total-roof-restorations-dev.pages.dev) | … | … |
| gutter-and-roof-repairs | [demo](https://gutter-and-roof-repairs-dev.pages.dev) | … | … |
| hurricane-digital-seo-brisbane | [demo](https://hurricane-digital-seo-brisbane-dev.pages.dev) | … | … |
| queensland-roofing-pty-ltd | [demo](https://queensland-roofing-pty-ltd-dev.pages.dev) | … | … |
| roof-space-renovators | [demo](https://roof-space-renovators-dev.pages.dev) | … | … |
| roofshield-roof-restorations | [demo](https://roofshield-roof-restorations-dev.pages.dev) | … | … |
| weatherproof-restorations | [demo](https://weatherproof-restorations-dev.pages.dev) | … | … |

每个 URL curl 200 verified (per commit `00e639ea`, `3de2d4aa`)。

---

## 10. 关键时序 (真实测试)

| 步骤 | 耗时 |
|---|---|
| pl:build-from-reference (claude · 57k input) | ~180s |
| pl:build-customer-audit | ~30-60s |
| pl:build-internal-audit | ~60-120s |
| pl:optimize-internal-report (3 round · 可选) | ~10 min |
| pl:publish-demo (CF Pages 上传 + deploy) | ~30-60s |
| **单客户 baseline 总耗时** | **~5-8 min** |
| 10 客户批量 (sequential) | ~50-80 min |

---

## 11. 健康检查 · 当前差距

**M3 尚无专门 doctor**。建议未来加 `pl:publish-doctor`:
- `CF_API_TOKEN` + `CF_ACCOUNT_ID` 存在
- wrangler version 检查
- `templates/roofing/families/classic-premium-roftix/reference-site/` 完整 (5 PNG + HANDOFF-BOUNDARIES.md + index.html)
- 上次 publish < 7 天 · `cf-pages-deploy.json` mtime 检查
- live URL spot check (3 个随机 curl 200)

---

## 12. 故障 runbook

| 现象 | 诊断 | 修复 |
|---|---|---|
| `pl:build-from-reference` 卡 / 超时 | `clients/<slug>/v2/concept/reference-adapter/index.html` 没出 | 检查 claude CLI install + `ANTHROPIC_API_KEY` |
| HTML output 不完整 / 截断 | stdout tail 看是否 truncated | 加 `--model claude-sonnet-4-5` (default) 或 retry |
| `pl:publish-demo` wrangler "Invalid commit message" | wrangler 8000111 报错 | 已修 (D28 加 `--commit-message`) · 重跑 |
| project create 401 | `CF_API_TOKEN` 没 Pages:Edit scope | CF dashboard → API tokens → 加 scope |
| deploy 0 file uploaded | stage dir 空 · file copy 没生效 | 检查 `clients/<slug>/v2/concept/reference-adapter/index.html` 是否存在 |
| live URL 404 | wrangler 返了 success 但 CDN 没同步 | 等 30s · DNS propagation |
| 中文 audit 漏出现在 customer page | preamble 没生效 | 检查 `core/reports/generator.js#SYSTEM_PREAMBLES.customer` |
| optimize Round 3 复读 Round 2 | history.json 看 critique 字段 | 已知 bug · low priority · 用 Round 2 输出即可 |

---

## 13. 相关文档

- [M3-PRD.md](./M3-PRD.md) · M3 设计 PRD + deliverables + acceptance
- [OD-HANDOFF-RESEARCH.md](./OD-HANDOFF-RESEARCH.md) · M3 handoff 研究 · approach C 论证
- [WEBSITE-AUTORESEARCH-DESIGN.md](./WEBSITE-AUTORESEARCH-DESIGN.md) · 撤回的 288-variant 方案 (历史档案)
- [DECISIONS-LOG.md](./DECISIONS-LOG.md) · D24 paid-photos · D26 customer English · D28 publish bundle
- [SOP-1-FLOW.md](./SOP-1-FLOW.md) · 上游 intake
- [SOP-2-FLOW.md](./SOP-2-FLOW.md) · 上游 audit
