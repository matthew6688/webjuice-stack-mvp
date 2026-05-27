# Experiment Plan · Logo + Brand-Design-System → Website Integration

**Date**: 2026-05-27
**Trigger**: 8-variant test 验证 OD design-systems 可用 · 但所有 variant 都用 generic palette · 没用真客户 brand-tokens · 没接 logo → site 链路。要把"客户独特性"真正注入设计。
**核心问题**: 同一个 OD design-system (e.g. `editorial`) · 喂不同客户的 logo + brand color · 能不能保持哲学一致同时呈现客户独特性？

---

## 0 · 已有的资产 (Step 0 · 调研先于建设)

### 0.1 · 仓库里已有的 brand 基础设施

| 资产 | 路径 | 状态 |
|---|---|---|
| Logo extractor (3-layer fallback) | `core/audit/logo-extractor.js` | 可用 · favicon → header → og:image |
| 现存 logo kit 范例 | `experiments/brand-preview/_stage/mark-squire-roof-restorations/` | **完整 · 8 logo variants + brand-tokens.css + spec + QA** |
| Per-customer brand-tokens.css | `experiments/v2-compare/<slug>/brand/brand-tokens.css` | vicwest / vip / wc 已有 |
| brand-spec.json/md | `experiments/template-render/<slug>/brand/brand-spec.json` | 已有 schema |

### 0.2 · `mark-squire` 是 canonical 范例 · 必读

完整 brand kit 长这样 (来自 mark-squire-roof-restorations):
```
brand-spec.json              ← schema source-of-truth
brand-tokens.css             ← --brand-primary / --brand-accent / --surface 等
logo-mark.svg                ← 方形 mark · favicon source
logo-wordmark.svg            ← 文字 logo
logo-horizontal.svg          ← 横版 (header 用)
logo-dark.svg + logo-light.svg ← 主色变体
logo-mono-dark.svg + logo-mono-light.svg ← 单色 (适配深/浅背景)
favicon.svg + favicon.preview.png
social-avatar.svg + .preview.png
visual-style-contract.md     ← 视觉规则文字版
logo-qa-checklist.md         ← QA 清单
logo-review.md               ← review 结果
agent-handoff.md             ← 下游 agent 怎么消费
preview.html                 ← 端到端验证
```

**目标**: 把这套结构 + workflow 变成可重复的 SOP · 让任何客户都能 1 命令出全套 brand kit + 喂任意 OD design-system 出网站。

---

## 1 · 实验范围 · 3 客户 × 5 design-systems × 2 logo 来源 = 30 variants

### 1.1 · 3 个测试客户 (代表 3 种 brand 起点)

| 客户 | Brand 起点 | 现有 logo | Brand 强度 | 测什么 |
|---|---|---|---|---|
| **vicwest-roofing** | **已有真 brand** | yes (favicon + header img) | 中等 (navy + amber 主色) | 提取 → 注入是否保真 |
| **mark-squire-roof-restorations** | **已有完整 brand kit** (canonical) | yes (8 variant SVG) | 强 (heritage palette · 已 QA) | brand kit 跨多 design-system 一致性 |
| **vip-roofing-brisbane** | **几乎无 brand** | weak (基础 GBP photo) | 弱 (data-checkpoint signal 极低) | 生成 brand kit from scratch · 验证 brand-from-zero 路径 |

### 1.2 · 5 个 design-systems (来自 OD repo)

基于 8-variant 结果挑：
| Design system | 哲学 | Tier 定位 |
|---|---|---|
| `editorial` | Magazine cover · Monocle | T1-spec (commercial / architect-buyer) |
| `warm-editorial` | 暖纸杂志 · italic accent | T1-luxe (premium owner-operator) |
| `clean` | minimalist · neutral | T3-safe (mid-trade baseline) |
| `atelier-zero` | extreme restraint | T1-niche (heritage / slate) |
| `bento` (control) | 圆角 card grid (AI default) | T-anti-pattern · 看 brand-tokens 能否救回来 |

### 1.3 · 2 种 logo 来源 · 验证 fallback 链

- **Path A**: `logo-extractor.js` 从现有网站提取 (vicwest / mark-squire 真站)
- **Path B**: `logo-design` skill (huashu / OD frontend-design / design-consultation) 生成 (vip · 无 logo)

→ Total: 3 客户 × 5 design-systems = **15 variants 渲染** · 每个跑 brand-tokens 注入对比 (= 15 × 2 baseline/branded = 30 截图)

---

## 2 · 实验阶段 (5 phases · 总 ~6 hr · ~$1.50)

### Phase 1 · Brand kit 生成 · 3 客户 全套 (~1.5 hr · $0.40)

**目标**: 3 个客户都到 mark-squire 同级别完整度。

每客户产出：
```
clients/<slug>/v2/brand/
├── brand-spec.json
├── brand-tokens.css
├── logo-{mark,wordmark,horizontal,dark,light,mono-dark,mono-light}.svg
├── favicon.svg + .preview.png
├── social-avatar.svg + .preview.png
├── visual-style-contract.md
├── logo-qa-checklist.md (filled)
├── logo-review.md
└── agent-handoff.md
```

**步骤**:
1. **vicwest**: `logo-extractor.js` 跑真站 → 拿到 raw logo → 用 imagegen/fal-image-edit 衍生 8 variant
2. **mark-squire**: 已完整 · 复用
3. **vip**: 没 logo → 触发 OD `design-consultation` skill 从 entity data + niche → 生成 brand-spec.json → imagegen 出 8 variant

**验证 (硬证据)**:
- 每客户 brand-tokens.css 包含至少 9 个 CSS vars (primary/secondary/accent/surface/surface-muted/text/text-muted/border/+1 niche)
- 每客户 8 logo SVG 都能渲染 · 用 Playwright 截 preview · 进入 logo-qa-checklist 全过
- `logo-review.md` 给每客户写一份独立 review

### Phase 2 · OD design-system + brand-tokens contract 测试 (~1 hr · $0.20)

**目标**: 验证 OD 的 5 个 design-systems 是否真的尊重 brand-tokens.css 覆盖 · 还是 hard-code 自己的颜色。

**做法**: 单测 — 把 vicwest brand-tokens.css 注入每个 design-system 的 base preview · 截图 · 对比 baseline。

**5 维度评分** (0-10 each):
1. **Token override fidelity** — `--brand-primary` 真的被用了吗 · 还是 OD 漏 hard-code 了 navy？
2. **Hierarchy preservation** — design-system 的视觉层级 (e.g. editorial 的 serif headline) 还在吗
3. **Logo placement** — 我们的 logo 放进 OD header 不变形 / 不被覆盖
4. **Mono/dark variant 用对了吗** — depth/depth-on-color 上 mono-light 自动切对
5. **Accent token 注入到 OD 的 secondary surface** — `--brand-accent` 出现在 OD CTA / hover / underline

**5 个 design-system × 5 维 = 25 分 grid** · 写到 `BRAND-CONTRACT-COMPLIANCE.md`。

**Decision**: <15/25 的 design-system 进 retire list · 不进我们 curated 菜单。

### Phase 3 · 3 客户 × 5 systems · 全 grid 渲染 (~2 hr · $0.50)

**目标**: 真实场景跑 — 每客户 5 个 design-system 出 preview.html · brand-tokens + 8 logo variants 全注入。

**Output**: 
```
templates/roofing/brand-grid-experiment/
├── vicwest-roofing/
│   ├── editorial/preview.html + DESIGN-NOTES.md + screenshot.png
│   ├── warm-editorial/...
│   ├── clean/...
│   ├── atelier-zero/...
│   └── bento/...
├── mark-squire-roof-restorations/
│   └── (same 5)
└── vip-roofing-brisbane/
    └── (same 5)
```

**总产出**: 15 个 preview.html · 15 screenshot · 15 DESIGN-NOTES。

### Phase 4 · 客观 audit + 主观 review (~1 hr · $0.30)

**对每个 variant 跑**:
- `pl:audit-tier vision` 4-tier composite score (T1 hard / T2-T4 0-100)
- design-review skill 给出 5-dim subjective score (跟 V0-V7 比较)
- "Brand-as-customer" recognizability test: 看 4 个不同 design-system 渲染 vicwest · 用户能不能一眼认出"这 4 个都是 vicwest"

**写**: `BRAND-GRID-AUDIT-REPORT.md` · 15 行 grid · 每行 (客户/系统/T1/T2/T3/T4/composite/subjective) + 一段判断。

### Phase 5 · Style-router 规则提取 (~30 min · $0)

**输入**: Phase 4 audit grid
**目标**: 从 15 个数据点 → 规则化"哪个客户档案 → 哪个 design-system"

预期产出 `core/brand/style-router.js`:
```js
function pickDesignSystem({ brandTokens, logoMode, niche, tier, buyerProfile }) {
  // 规则不是 LLM · 是显式 if/else
  if (tier === 'luxury' && niche === 'heritage') return 'atelier-zero';
  if (tier === 'luxury') return 'warm-editorial';
  if (tier === 'premium' && commercial) return 'editorial';
  if (tier === 'mid') return 'clean';
  return 'clean'; // safe default · NOT bento (anti-pattern)
}
```

---

## 3 · 验证 gate (硬证据 · 不写 doc 算 done)

| Gate | 必过条件 |
|---|---|
| **G1 Brand kit 完整** | 3 客户每个 ≥9 个文件 (8 logo + tokens.css + spec) · QA checklist 全过 |
| **G2 Token contract 通过** | OD design-systems 至少 3/5 拿 ≥20/25 token-compliance 分 |
| **G3 Cross-system 一致性** | "Brand-as-customer" test · 用户在 4 design-system 截图里认出同一客户 ≥3/4 |
| **G4 Audit composite** | 15 variant 平均 composite ≥70 · 单点不破 60 |
| **G5 Router 规则** | style-router.js 跑 3 客户都返回正确 design-system (人工标注 vs router 输出 ≥ 80% 一致) |

每 gate 不过 · 不进下一 phase。

---

## 4 · 风险 / 反约束

| 风险 | 反约束 |
|---|---|
| OD design-system hard-code 颜色 · brand-tokens 不生效 | Phase 2 单测 G2 · 不过的系统直接退役 |
| logo 生成质量参差 · 同客户 8 variant 调调不一致 | logo-qa-checklist 强制 · imagegen seed 锁定 |
| brand-tokens 注入破坏 design-system 哲学一致性 (editorial 失去 serif feel) | Phase 4 design-review 必须给每 variant 单独"哲学保真度"分 |
| vip 无信号 brand 是"假数据" · 跟 V6 bento 一样产 AI-slop | Phase 1 step vip 之前必须先跑 data-checkpoint · YELLOW 才能上 generated logo · RED 直接退出 |
| router 规则被 LLM "误学" · 后期飘走 | 永远 rules-based · 不让 LLM 跑 style-router · 改规则需手动 PR |

---

## 5 · 实施顺序 · 我推荐

| # | Phase | 谁做 | 何时 |
|---|---|---|---|
| 1 | Phase 1 · brand kit 三客户 | 1 sub-agent 跑 vicwest + 1 跑 vip · mark-squire 复用 | 立刻 (sub-agent 并行) |
| 2 | Phase 2 · token contract | 1 sub-agent · 5 design-system 单测 | Phase 1 完后 |
| 3 | Phase 3 · 15-variant grid | 3 sub-agent (1 per 客户 · 各跑 5 system) | Phase 2 完后 · 并行 |
| 4 | Phase 4 · audit | 1 sub-agent · 跑 vision audit · 写 report | Phase 3 完后 |
| 5 | Phase 5 · router 规则 | Matthew + 我 一起手工提取 | Phase 4 完后 |

**总**: ~6 hr 真实时间 · ~$1.50 LLM · 出 15 variants + 完整 brand 流水线 + style-router v1。

---

## 6 · 我的具体建议

**今晚 / 下次开工启动 Phase 1 · 3 sub-agent 并行**:
- A: 生成 vicwest 完整 brand kit (从现有 logo 衍生)
- B: 生成 vip 完整 brand kit (from-zero · 先验 data-checkpoint)
- C: 把 mark-squire 移到 `clients/<slug>/v2/brand/` canonical 位置 (现在还在 experiments/)

3 个 sub-agent ~1.5 hr 出活 · 给我们后面 Phase 2-5 的 input。

---

## 参考

- 现存 canonical brand kit 范例: `experiments/brand-preview/_stage/mark-squire-roof-restorations/`
- Logo extractor: `core/audit/logo-extractor.js`
- 8-variant baseline (no brand-tokens): `templates/roofing/single-page-library/_compare/COMPARISON-REPORT-V2.md`
- OD skills inventory (即将): `docs/v3/OD-SKILLS-FULL-INVENTORY.md` (sub-agent 跑中)
- OD skills curation v1: `docs/v3/OD-SKILLS-INVENTORY.md`
- OD design systems curation strategy: `~/.claude/projects/-Users-matthew-profitslocal/memory/project_od_integration_strategy.md`
