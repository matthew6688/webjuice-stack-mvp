# M3 · 网站生成 + 发布 · PRD (回填 · 2026-05-14)

> **范围**: 从 master.md design-ready 开始 → reference-adapter HTML → CF Pages publish · 出 `<slug>-dev.pages.dev` URL。
> **不在范围**: outreach (M4) · 购后 (M5) · audit (M2)。
> **隔离**: 所有新代码 / 文档在 `v3-modular` branch。
> **status**: ✅ 实装跑通 · 10 个真客户 live · PRD **回填** (此前只有 commit + DECISIONS-LOG 残留)。

---

## 0. Goal (一句话)

master.md design-ready → claude CLI 通过 reference-adapter 适配 → polished HTML → CF Pages publish · 出 demo URL 给销售用。

## 1. Success Criteria · 怎么算 M3 完成

| 验收项 | 状态 |
|---|---|
| **reference-adapter handoff payload** · 从 master.md + entity + reference site 构造给 claude 的 prompt 全部参数 locked | ✅ `core/leads/reference-adapter-handoff.js#buildAdapterPayload` |
| **`pl:build-from-reference` CLI** · 一条命令出 HTML | ✅ `scripts/cli/pl-build-from-reference.js` |
| **客户 audit page (English)** | ✅ `pl:build-customer-audit` · 9KB HTML |
| **CF Pages publish CLI** · auto-create project · auto-deploy | ✅ `pl:publish-demo` · D28 含 master.md + audit assets |
| **10 真客户 live URL** · `<slug>-dev.pages.dev` curl 200 | ✅ 10/10 verified |
| **Optimized internal audit** · 多轮 autoresearch · 中文标题 | ✅ `pl:optimize-internal-report` · brisbane-roof 3 round done |
| **master.md + assets 自动随发布** | ✅ D28 · publish-demo 自动包含 master.md + internal-audit + screenshots + evidence + video |
| **Operator runbook** | ✅ SOP-3-FLOW.md (今天新增) |

## 2. Current State (M3 完成度)

| 已建 | 状态 | 文件 |
|---|---|---|
| reference-adapter-handoff (payload builder) | ✅ | `core/leads/reference-adapter-handoff.js` |
| FAMILY_REGISTRY (1 个 family · classic-premium-roftix · roofing niche) | ✅ | 同上 |
| reference site (1 个 · 5 真图) | ✅ | `templates/roofing/families/classic-premium-roftix/reference-site/` |
| `pl:build-from-reference` CLI | ✅ | `scripts/cli/pl-build-from-reference.js` |
| `pl:build-customer-audit` CLI | ✅ | `scripts/cli/pl-build-customer-audit.js` |
| `pl:build-internal-audit` CLI | ✅ | `scripts/cli/pl-build-internal-audit.js` |
| `pl:optimize-internal-report` CLI | ✅ | `scripts/cli/pl-optimize-internal-report.js` |
| `pl:publish-demo` CLI (CF Pages) | ✅ | `scripts/cli/pl-publish-demo.js` |
| `pl:bulk-publish-demo` | ✅ | `scripts/cli/pl-bulk-publish-demo.js` (10 客户一起发) |
| Auto-trigger on audit done (hook) | ⚠️ 半 | `scripts/cli/pl-auto-build-demo.js` (存在 · 未默认 enabled) |
| Photo classification (vision LLM 标 type) | ❌ NOT STARTED | — |
| Family ≥ 2 (2 个不同设计风格) | ❌ 1 个 only · roofing 专属 | — |

## 3. Architecture

```
M2 出口 · master.md 22 章 + audit assets + phase=DESIGN_READY
        │
        ▼
pl:build-from-reference --slug <customer-slug>
   ├─ buildAdapterPayload(master.md + entity + reference-site files)
   │     ├─ niche → FAMILY_REGISTRY lookup → reference family
   │     ├─ master.md frontmatter → business info
   │     ├─ entity.latest → phone / address / hours / website
   │     └─ reference-site → HANDOFF-BOUNDARIES.md + 5 PNG assets + index.html
   ├─ spawn claude CLI (sonnet-4-5 · ~57k input + 12k output)
   ├─ stream stdout · capture adapted HTML
   └─ write clients/<slug>/v2/concept/reference-adapter/
         ├─ index.html (adapted demo)
         └─ assets/ (5 PNGs from reference · copy not regenerate)
        │
        ▼ (independent · 可并行)
pl:build-customer-audit --slug <customer-slug>
   ├─ 读 master.md + audit data
   ├─ claude CLI · English-only + Australian spelling (D26)
   └─ write clients/<slug>/v2/customer-facing-audit.html
        │
        ▼ (optional · 多轮 polish 内部审计)
pl:optimize-internal-report --slug <customer-slug>
   ├─ 读 internal-audit-report.html
   ├─ 3-5 round autoresearch (critique + rewrite)
   └─ write clients/<slug>/v2/internal-audit-report.optimized.html
        │
        ▼ (publish step)
pl:publish-demo --slug <customer-slug>
   ├─ stage dir 拼装:
   │     ├─ adapter index.html → /
   │     ├─ adapter assets → /assets/
   │     ├─ customer-facing-audit.html → /
   │     ├─ master.md + master.report.html → /
   │     ├─ internal-audit-report.html → /
   │     ├─ internal-audit-report.optimized.html (若存在) → /
   │     └─ screenshots/ evidence/ video/ → 对应子目录
   ├─ CF API · POST projects (idempotent · already exists 跳过)
   ├─ wrangler pages deploy <stageDir>
   │     · --project-name <slug>-dev
   │     · --commit-message "pl-publish-demo <slug> <iso>"
   │     · --commit-dirty=true
   └─ write clients/<slug>/v2/concept/reference-adapter/cf-pages-deploy.json
        │
        ▼
LIVE · https://<slug>-dev.pages.dev
   ├─ /                                   demo HTML (adapted from reference)
   ├─ /customer-facing-audit.html         English audit page (sales 用)
   ├─ /master.md                          internal source-of-truth
   ├─ /master.report.html                 md→html 渲染
   ├─ /internal-audit-report.html         中文 audit
   ├─ /internal-audit-report.optimized.html  (若存在) 多轮优化版
   ├─ /screenshots/<file>.png             现状网站截图
   ├─ /evidence/issue-*.png               annotated 问题截图
   └─ /video/mobile-throttled.webm        移动 + Slow 3G 录屏
```

## 4. Deliverables · M3 已落地

### D1 · reference-adapter-handoff (payload builder)
- **File**: `core/leads/reference-adapter-handoff.js`
- **What**: 锁死所有传给 claude 的参数 (替代 V2 freeform OD prompt)
- **FAMILY_REGISTRY**: `{ roofing: { family: 'classic-premium-roftix', reference: '...' } }`
- **HANDOFF-BOUNDARIES.md**: reference site 内嵌的 "AI 改这些 / 不改这些" 规则

### D2 · pl:build-from-reference CLI
- **File**: `scripts/cli/pl-build-from-reference.js`
- **Usage**: `npm run pl:build-from-reference -- --slug <customer-slug>`
- **Cost**: ~$0.30 (claude-sonnet-4-5 · 57k input + 12k output)
- **Time**: ~3 min
- **Output**: `clients/<slug>/v2/concept/reference-adapter/index.html` + `assets/` (5 PNG copies)

### D3 · pl:build-customer-audit CLI
- **File**: `scripts/cli/pl-build-customer-audit.js`
- **Usage**: `npm run pl:build-customer-audit -- --slug <customer-slug>`
- **Cost**: ~$0.10 (claude · single pass)
- **Output**: `clients/<slug>/v2/customer-facing-audit.html` (~9 KB · English · Australian)
- **D26 enforced**: 0 Chinese characters (Python regex verified)

### D4 · pl:build-internal-audit CLI
- **File**: `scripts/cli/pl-build-internal-audit.js`
- **Usage**: `npm run pl:build-internal-audit -- --slug <customer-slug>`
- **Output**: `clients/<slug>/v2/internal-audit-report.html` (~47 KB · 中文 · 操作员看)

### D5 · pl:optimize-internal-report CLI
- **File**: `scripts/cli/pl-optimize-internal-report.js`
- **Usage**: `npm run pl:optimize-internal-report -- --slug <slug> [--rounds 3]`
- **Cost**: ~$1.50 / round · default 3 round · total ~$4.50
- **Output**:
  - `internal-audit-report.optimized.html` (~38 KB · 多轮 polish)
  - `internal-audit-report.optimized.history.json` (轮次 critique 留底)
- **Known bug**: Round 3 critique 偶尔复读 Round 2 (LLM 静默 · low priority cosmetic)

### D6 · pl:publish-demo CLI (CF Pages)
- **File**: `scripts/cli/pl-publish-demo.js`
- **Usage**: `npm run pl:publish-demo -- --slug <customer-slug>`
- **Cost**: $0 (CF Pages free tier · 1 deploy unit / customer)
- **Env**: `CF_API_TOKEN` (Pages:Edit scope) · `CF_ACCOUNT_ID`
- **Idempotent**: 项目已存在跳过 create
- **D28**: 自动包含 master.md + internal + optimized + screenshots + evidence + video
- **D28 fix**: `--commit-message` 显式传 ISO timestamp · 防 wrangler "Invalid commit message" 报错
- **Output URL**: `https://<slug>-dev.pages.dev`

### D7 · pl:bulk-publish-demo CLI
- **File**: `scripts/cli/pl-bulk-publish-demo.js`
- **Usage**: `npm run pl:bulk-publish-demo -- --all` 或 `--slugs slug1,slug2`
- **效用**: 10 客户一起发 · ~5 min

## 5. 不在 M3 范围

- ❌ 自动选 family (现 1 个 · niche map 写死)
- ❌ photo classification (vision LLM 标 hero / project / about / service)
- ❌ 客户真图替换 reference stock 图 (现 5 PNG = reference 自带 · 不换)
- ❌ A/B variant generation (现 1 个 design only)
- ❌ 自定义域名 (现 `<slug>-dev.pages.dev` only · 购后才上 custom domain)
- ❌ outreach 邮件含 demo URL (M4)

## 6. Architectural decisions (跨 M3)

- **D28** · master.md + audit assets bundle on publish · `pl:publish-demo` 自动包含
- **D26** · customer-facing English / internal Chinese (M2 决策但 M3 enforce)
- **撤回 288-variant autoresearch** · 见 README `已撤回的方案` · 替代 = reference-adapter
- **撤回 freeform OD prompt** · 同上 · 替代 = locked reference payload

## 7. Acceptance Criteria · M3 done

- [x] 10 真客户 live URL · curl 200 verified
- [x] 1 个 reference family (roofing) · 5 真图 · HANDOFF-BOUNDARIES.md
- [x] 4 个核心 CLI 工作 (build-from-reference / build-customer-audit / build-internal-audit / publish-demo)
- [x] CF Pages auto-create + auto-deploy + cf-pages-deploy.json 记录
- [x] D28 publish bundle (master.md + audits + screenshots + evidence + video)
- [x] Optimized internal audit (多轮 · brisbane-roof 3 round)
- [x] D26 English-only customer audit verified (0 Chinese chars)
- [x] Operator runbook (SOP-3-FLOW.md · 新增)
- [ ] photo classification (deferred to V4)
- [ ] ≥2 family (deferred · 跨 niche 扩展)

## 8. Rollback Plan

- `pl:publish-demo` 出问题 → wrangler `pages deployment delete` (CF dashboard)
- `pl:build-from-reference` 出问题 → 删 `clients/<slug>/v2/concept/reference-adapter/` 重跑
- 整 CF Pages account 出问题 → CF API 退到 project list · delete project

## 9. Dependencies

- Anthropic API key (`ANTHROPIC_API_KEY` · sonnet-4-5)
- CF API token (`CF_API_TOKEN` Pages:Edit scope) + `CF_ACCOUNT_ID`
- wrangler CLI (`wrangler@4.76+`)
- Reference site files (`templates/roofing/families/classic-premium-roftix/reference-site/`)
- master.md design-ready (M2 出口)

## 10. Cost

| 步骤 | 单次 | 备注 |
|---|---|---|
| pl:build-from-reference | ~$0.30 | claude-sonnet-4-5 · 大输入 |
| pl:build-customer-audit | ~$0.10 | single pass |
| pl:build-internal-audit | ~$0.20 | single pass · 较长 |
| pl:optimize-internal-report (3 round) | ~$4.50 | 可选 polish |
| pl:publish-demo | $0 | CF Pages free tier |
| **单客户 M3 总成本** | **~$0.60-5.10** | 含 optimized |

10 客户 baseline (无 optimize) = ~$6 一次性。

## 11. Operator runbook

详细操作 / 触发命令 / asset 落盘位置 / Discord 汇报格式 / 故障 runbook → **[SOP-3-FLOW.md](./SOP-3-FLOW.md)**
