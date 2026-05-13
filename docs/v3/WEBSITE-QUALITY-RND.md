# V3 · 网站质量 R&D 报告 · 2026-05-13

> Matthew: 我们要么做不出好的网站 · 要么质量不稳定 · 排版+图片是核心痛
> 试过: template 参考 · niche sample 图 · autoresearch 优化 · 都没找到稳定流程
> 我研究我们代码 + OD 上游 · 给假设 + 实验

---

## 0. TL;DR · 我之前完全猜错方向

**之前以为**: OD 太自由 · 需要锁骨架 · 加约束
**真相**: **OD 已经非常严格** (338 LOC template + 7 anti-slop lint + 10 P0 + 8 P1) · 我们没用足

**真 bottleneck**:
1. 🔥 **图片** · 192 entity 中 1 个有 GMB photo (0.5%) · OD 拒绝 Unsplash · 我们没填占位
2. 🔥 **没 website-level critic loop** · OD 内置 `critique/` 我们没接
3. **codex single-rhythm output** in 通用 `web-prototype` skill (无 niche-specific)

研究证据: `data/qa/website-quality-research-2026-05-13.md` (我们代码) + `data/qa/open-design-upstream-research-2026-05-13.md` (OD 上游)

---

## 1. 我们试过的 (实测)

### ❌ Template 实验 — 实际**没真用过**
- `templates/restaurant/` 不存在
- `templates/roofing/families/` 有 4 个 (1 个手工补 6 张图 · 3 approved)
- 3 真客户 (opa-bar-mezze / rich-and-rare ×2) **全 bypass templates/** · 用 OD source-URL crawl 模式
- 没有写明 "abandoned" 的决策 doc · 但**实际没产出**

### ❌ Sample image per niche — 1 次手工 · 失败
- 2026-05-09 · gpt-image-1 跑过 1 次 (roofing · 6 张 · 3 approved 90-92)
- 全 dry-run 之后
- 没建 library · 没 fallback 链
- 192 entity 中 GMB photo 覆盖 1/192 = **0.5%**

### ❌ Autoresearch 优化 — **只有 report level · 没有 website level**
- `core/reports/autoresearch-loop.js` 存在但只跑 audit-report HTML
- Website QA 只是 single-pass compliance gate (`scripts/open-design/audit-generated-concept.js`)
- `qa-rubric.json` 写了无代码用
- 没有任何代码跑 `runAutoresearchLoop` 针对网页

### ❌ Pattern A (restaurant adapter) + Pattern B (master.md) — **都没喂给 OD**
- `niches/restaurant/adapter.js` 写 `content.restaurant.json`
- `core/reports/master-md-builder.js` 写 `master.md`
- OD 读 source URL · **不读以上任一**

---

## 2. OD 上游真相

### OD 是 3-axis prompt composition
`apps/daemon/src/server.ts:3937 composeSystemPrompt`:
```
BASE_SYSTEM_PROMPT + DESIGN.md + craft + SKILL.md
```
OD 本身是"薄胶水" · quality 完全靠这三层 + agent CLI

### `web-prototype` (我们用的 skill) 是高度约束 · 不松
- `skills/web-prototype/assets/template.html` **338 LOC** · 6 CSS vars · ~40 classes 固定
- `references/layouts.md` · **8 个 section skeleton · paste-only** ("don't write from scratch")
- `references/checklist.md` · **10 P0 + 8 P1 自检规则**
- `craft/anti-ai-slop.md` · **7 P0 sins · lint 自动抓** (indigo accent · emoji icons · invented metrics · filler copy · etc.)

### 140 design-systems = prose DESIGN.md
- 不是 tokens.json · 不是 component lib · 不是 HTML scaffold
- 每个 62-393 LOC prose · codex 翻译成 6 CSS variables
- 例如 `agentic/` `apple/` `arc/` `brutalism/` · 各种风格 prose 描述

### OD **没**:
- 没 landing-page template (`templates/` 只 2 deck stages)
- 没 components axis (复用粒度 = section · 不是组件)
- **不调任何图片 API** · 不 fetch logo · 不调 Unsplash/Pexels/Flux
- 反 · Unsplash / placehold.co / picsum 在 P1 anti-slop 黑名单
- 只画 `.ph-img` CSS 占位 · **等我们填**

### OD **有但我们没用**:
- `web-prototype-taste-{brutalist,editorial,soft}` 风格变体 (我们 hardcoded `web-prototype`)
- `skills/critique/` + `apps/daemon/src/critique/` orchestrator · default 不跑
- `story/` 目录占位 · empty

---

## 3. 真 bottleneck 重排 (基于实证)

### 🥇 1. 图片 · 占据视觉 100%
- 当前: 1/192 entity 有 GMB photo · 0.5% 覆盖
- OD 设计的 HTML 默认 `.ph-img` 占位 · 我们 wrapper 没替换
- **没图就什么都崩** · hero 空 / section 没视觉 / 商业感为零

### 🥈 2. 无 website critic loop
- OD 自带 `critique/` skill · 默认不跑
- 跑也只是 single-pass · 不 retry
- `qa-rubric.json` 存在但无打分代码
- 操作员看完不满 = 整个 8 min 跑白费

### 🥉 3. 通用 `web-prototype` 通吃 niche
- 餐厅缺 menu/address/hours/reviews/map · roofer 缺 photo gallery/service tiers · 牙医缺 booking widget
- 一套 skill 没法都做到
- 没 `skills/profitslocal-<niche>/` 衍生 skill

### 4. master.md content 不喂 OD
- audit 第五章"漏水"列了 5 个具体问题 (hero 对比度 · form 字段多 · 等)
- OD 完全不知 · 自己读 source URL 复刻
- 没**针对性 fix**

---

## 4. 5 个实验 · 推荐顺序

### E1 🔥 · GMB photo 批拉 (1 day · $0)

**假设**: 192 entity 中只 1 个有 GMB photo · 跑批量 → 192/192 · 解 80% 图片问题

**怎么做**:
```bash
# 已有 CLI · 没批跑过
npm run pl:download-places-photos -- --all-entities --min-rating 3.5
```

**验收**:
- ≥ 80% entity 有 ≥ 3 张 GMB photo (logo / 店面 / 产品)
- 落 `data/leads/entities/<key>/places-photos/` 或类似路径
- master.md frontmatter `assets.gmb_photo_urls[]` 填

**Cost**: $0 (Places API details endpoint 已含 photo_reference · 我们之前没批 fetch)

**Risk**: 部分 entity 真没 GMB photo (新店或 GBP 未优化) · 那部分 entity 后续走 E4 fallback

---

### E4 🔥 · 后处理 image replacement pass (2 days · $50)

**假设**: OD 给 `.ph-img` 占位 · 我们后处理替图 = OD 不抱怨 + 真图填进

**怎么做**:
1. 新 `core/leads/image-fill.js` (~150 LOC)
   - 读 OD 生成的 `concept/open-design/index.html`
   - 找所有 `.ph-img` block (每个标注 hint: hero / about / gallery / section-break)
   - 替图 tier:
     - Tier 1: `entity.latest.places_enrichment.photo_urls` (GMB · E1 已填)
     - Tier 2: per-niche stock library (新建 · 见下)
     - Tier 3: AI gen (Flux/Replicate · 暂不上 · cost-prohibitive)
   - 写回 index.html
2. Build per-niche stock library:
   - 5 主 niche (restaurant / roofer / plumber / dentist / cafe)
   - 每 niche ~30 张 (hero · interior · staff · product · process · before-after · etc.)
   - **手动 curate from Unsplash** (人挑 · 不 LLM 决)
   - 存 `data/v2/stock-library/<niche>/<usage>/*.jpg`
   - Manifest `data/v2/stock-library/manifest.json` 标 license

**验收**:
- 跑 5 real lead × audit + concept generate
- Final HTML 0 `.ph-img` 残留
- 操作员盲评 "图合适不合适" ≥ 4/5

**Cost**: $50 (Unsplash Plus subscription? · 或者免费 API rate-limited)

**注意**: OD anti-slop 黑名单是 codex 跑期间 lint 检查的 · **我们后处理替图 OD 看不见** · 不冲突。

---

### E3 · Wire OD critique skill + autoresearch retry (1 day · $30)

**假设**: 用 OD 已有 `critique/` skill · 给 < 7 score 强制 retry 最多 3 轮 · 收敛到 ≥ 8

**怎么做**:
1. 改 `scripts/open-design/run-concept.js` 第 4 stage (audit + critique):
   - 跑完 generate 后调 `critique/` skill (OD 已有)
   - Parse score
   - if score < 7 · retry generate (max 3 轮)
2. 喂 `qa-rubric.json` 作 critic input (扩展我们 IP)
3. 记 history 到 `concept/open-design/critique-history.json`

**验收**:
- 10 lead × 跑 autoresearch · 最终平均 ≥ 8/10 · stddev < 1.5
- 平均 2 轮收敛 (1.5 = baseline · 多余消耗高时间)

**Cost**: $30 (10 lead × max 3 跑 × $1/跑)

---

### E2 · Niche-specific skill seed (2 days · $30)

**假设**: 写 `skills/profitslocal-restaurant/` (OD 同模式 sibling skill) · 锁住 niche-specific sections · 比通用 web-prototype 稳

**怎么做**:
1. 复制 OD 自己的 `skills/web-prototype/` 到我们 fork · 改名 `profitslocal-restaurant/`
2. 修改 `SKILL.md` · 加 restaurant-specific 要求:
   - 必出 sections: hero / menu / about / address+hours+map / reviews / contact
   - 必有 elements: dining hour table / booking link / phone-prominent CTA
3. 修改 `references/layouts.md` · 8 layouts 改成餐厅-friendly variants
4. 修改 `references/checklist.md` · 加 restaurant P0 (有 menu link · 有 booking · 有 address)
5. 同步 `design-systems/profitslocal-restaurant/DESIGN.md` · 餐厅 brand voice 默认 (warm but premium · 看 rating)
6. 改 `scripts/open-design/run-concept.js` · 根据 entity.niche 选 skill

**验收**:
- 5 真 restaurant lead 跑 OD · 都含必出 6 section
- 操作员盲评 vs 通用 web-prototype version · ≥ 4/5 更好

**Cost**: $30 (5 lead × $5/run)

**Risk**: niche 数 7+ · 一个个写费工程。先 restaurant + roofer 2 个 · 后续按 lead 量加。

---

### ~~E5~~ · 3 variants 早期 picker · **撤回** · E1-E4 后再说

如果 E1-E4 后仍 variance 大 · 再加。

---

## 5. 推荐顺序 + 时间表

```
Day 1 · E1 (GMB photo 批拉)              · 192 entity 全 fetch
Day 2-3 · E4 (image replacement + stock 库) · 不依赖 E2/E3
Day 4 · E3 (critic loop wire)              · 不依赖 E4
Day 5-6 · E2 (restaurant skill seed)       · 用 E1-E4 出的 base 上锁 niche
Day 7 · 综合 5 真 lead 验证 · operator subjective rating
```

**6-7 工程日 · ~$110 API cost · acceptance gate 客观**。

---

## 6. 跟 V3 M3 PRD 关系

M3 PRD 还没写。这份 R&D 报告**就是 M3 PRD 的前置研究**。

实验完成后:
- 把 winning 实验固化进 M3 PRD
- 写 M3 实装 deliverable
- Push v3-modular

**不**先写 M3 PRD · 实验出结果再写 · 否则 PRD 都是猜的。

---

## 7. 给 Matthew 的 4 个 Q 暂答 (基于代码证据)

| Q | 答 |
|---|---|
| A. OD 宽松 vs 严格 | **OD 已严格** · pain 不是缺约束 · 是约束内 codex 仍出无聊 layout · 我们需 niche-skill + critic loop |
| B. 模版 | OD per-skill `template.html` 就是模版机制 · 我们应**复制改成 niche-specific** (E2) |
| C. 组件 | OD 没组件 axis · 复用粒度是 section layout · 加更多 section layout in skill (E2) · 不是新组件库 |
| D. 图片 | OD **明确拒绝处理图** (Unsplash 都黑名单) · 我们必须后处理 · GMB → niche stock → 别想生成 (E1+E4) |

---

## 8. 还在 Matthew 那的 1 件事 · niche-tone map

之前 M2-D7 我说"OD 自推断" · 现在看 Agent 2 报告 · `design-systems/<system>/DESIGN.md` 就是给 codex 的 niche-tone 文档。我们可以写:

- `design-systems/profitslocal-restaurant/DESIGN.md` · 餐厅默认 tone
- `design-systems/profitslocal-roofer/DESIGN.md` · 罗夫 tone

这跟 E2 是同一件事的两面。统一 to `profitslocal-<niche>` 命名。

---

## 9. 我现在 do 什么

等 Matthew 看完决:
1. 接受 5 实验顺序 (E1 → E4 → E3 → E2)?
2. 时间 6-7 工程日 OK?
3. $110 API cost OK (大头是 Unsplash · 可换免费 tier 但慢)?
4. Restaurant + roofer 优先 niche · OK?

回 OK 即开 E1。

或反对哪条改之。

---

## Appendix · 文件 ref

- `data/qa/website-quality-research-2026-05-13.md` · 我们代码 236 行
- `data/qa/open-design-upstream-research-2026-05-13.md` · OD 上游 345 行
- `/Users/matthew/Developer/open-design/` · OD fork repo
- `/Users/matthew/Developer/open-design/skills/web-prototype/` · 当前用的 skill
- `/Users/matthew/Developer/open-design/skills/critique/` · 现成 critic skill (我们没用)
- `/Users/matthew/Developer/open-design/design-systems/` · 140 个 prose DESIGN.md
