# Open Design 上游深度调研 · 2026-05-13

Repo root: `/Users/matthew/Developer/open-design/` (fork of `nexu-io/open-design`, Apache 2.0).
All path/line references are real and re-verifiable.

---

## 1. Architecture 顶层

Top-level dirs (from `ls -la /Users/matthew/Developer/open-design/`):

| Dir | 用途 |
|---|---|
| `apps/daemon/` | Node/Express daemon (port 7466). Spawns agent CLIs, serves `/api/*`, composes system prompt. `src/server.ts` 5400+ LOC. |
| `apps/web/` | Next.js 16 App Router UI. Top-bar pickers: mode / skill / design-system / agent. |
| `apps/desktop/` | Electron shell (optional). |
| `apps/landing-page/` · `apps/packaged/` | Marketing site + packaged build. |
| `packages/contracts` · `platform` · `sidecar` · `sidecar-proto` | Shared TS contracts + tools-dev sidecar. |
| `skills/` | **74 skills** (front-mattered `SKILL.md` directories). |
| `design-systems/` | **140 `DESIGN.md` files** (1 per brand/style). |
| `craft/` | **9 brand-agnostic craft rulebooks** (typography, color, anti-ai-slop, etc.). |
| `templates/` | 2 files: `deck-framework.html`, `kami-deck.html` (slide stages, not landing pages). |
| `story/` | **EMPTY** — `STORY.md` and `STORY.zh-CN.md` are 0 bytes (placeholders). |
| `prompt-templates/` | Only `image/` and `video/` subdirs — media generation prompt blocks, not web design. |
| `docs/` | `spec.md`, `architecture.md`, `modes.md`, `skills-protocol.md`, `agent-adapters.md`, `craft/`, `roadmap.md`. |
| `scripts/` | Mostly importers (`sync-design-systems.ts`, `bundle-skills.ts`). |

**Spec summary** (`docs/spec.md` §1, line 26): "A web app that turns natural-language briefs into editable, previewable design artifacts (prototypes, decks, templates, design systems) by orchestrating the code agent already installed on the user's machine."

OD's stated identity (`docs/spec.md` line 38): "**an integration shell that refuses to own the agent, the model, or the skill catalog**". → 它故意做薄。智能 / 品味 / 约束都靠 skill + design-system + craft 三层注入到 system prompt 里。

**Prompt composition** (`QUICKSTART.md` ~line 158 + `apps/daemon/src/server.ts:3937` `composeSystemPrompt(...)`):

```
BASE_SYSTEM_PROMPT
  + active design-system body   (DESIGN.md)
  + active craft sections       (from craft/, only those skill opts into)
  + active skill body           (SKILL.md)
```

每次 send 这三层重新拼。这就是我们在 daemon `/api/chat` 拿到的 prompt 结构。

---

## 2. web-prototype skill 全析 (★ 我们用的)

### 2.1 文件清单

```
skills/web-prototype/
├── SKILL.md                  97 LOC
├── assets/
│   └── template.html         338 LOC  (the "seed")
├── example.html              81 LOC
└── references/
    ├── checklist.md          (P0/P1/P2 self-review)
    └── layouts.md            (8 paste-ready section skeletons + class inventory)
```

### 2.2 SKILL.md 给 codex 的核心指令 (`SKILL.md:27-87`)

> "Produce a single, self-contained HTML prototype **using the bundled seed and layout library — not by writing CSS from scratch**. The seed already encodes good defaults (typography, spacing, accent budget). Your job is to compose it."

Workflow (line 45+):
1. **Step 0 Pre-flight** — read `template.html` end-to-end, read `layouts.md`, read active DESIGN.md.
2. **Step 1 Copy seed** → `index.html`, replace 6 `:root` tokens with DESIGN.md's, replace `<title>` + brand text.
3. **Step 2 Plan section list** — 4 default rhythms (Landing / Marketing / Pricing / Docs). State the list to user **before** writing.
4. **Step 3 Paste & fill** — copy a `<section>` from `layouts.md`, replace `[REPLACE]` strings with brief content. "**No filler** — if a slot is empty, the section is the wrong choice; pick a different layout."
5. **Step 4 Self-check** against `checklist.md` (every P0 must pass).
6. **Step 5 Emit** wrapped in `<artifact>` tags.

### 2.3 The seed (`assets/template.html`)

Contains, all in one file:
- **6-variable design token block** (line 24-29): `--bg`, `--surface`, `--fg`, `--muted`, `--border`, `--accent`. Comment: "Six variables. Bind them to the active DESIGN.md and stop. Do not introduce raw hex anywhere else in this file."
- **Type scale** (`--fs-h1` clamp 44-76px, etc.), **spacing 8-pt grid**, container 1120px.
- **~40 named classes** pre-styled: `topnav`, `hero`, `hero-center`, `hero-split`, `eyebrow`, `lead`, `btn` + variants, `card-flat`, `feature`, `stat`, `quote`, `pill`, `ds-table`, `log-row`, `grid-2/3/4`, `grid-2-1`, `grid-1-2`, `ph-img` (+ `.square` / `.portrait` / `.wide` aspect modifiers).
- **`.ph-img` placeholder** (line 257): tinted gradient block, never a broken `<img>` — uses `var(--accent-soft)` + `var(--fg-soft)` derived via `color-mix()`.
- A scaffolded `<main>` containing one hero section as a starting point.
- Mobile reflow baked in at `@media (max-width: 920px)`.

### 2.4 layouts.md — 8 section skeletons (verified `references/layouts.md`)

1. Hero centered
2. Hero split (text + visual placeholder)
3. Feature triplet (`grid-3` of `.feature.card-flat` with inline-SVG monoline marks)
4. Stat row ("Don't invent metrics. If you don't have a number, use a different layout.")
5. Pull quote
6. CTA strip (closing)
7. Log list (changelog / blog index)
8. Comparison table (pricing)

每个都是 paste-ready HTML 块；layouts.md 顶部还有一份 **Class inventory** (line 16) 列出 `template.html` 必须 ship 的全部 class — agent 想加新 class 必须先去 `<style>` block 加定义。

### 2.5 checklist.md — quality 自检 (verified)

- **P0 (must)** 10 项: 颜色只用 `var(--*)`, 标题必用 `--font-display`, accent ≤2/screen, 无 purple gradient, 无 emoji-as-icon, 无 invented metrics, 无 filler copy, 每个 `<section>` 有 `data-od-id`, 移动 reflow, 不能用 `scrollIntoView()`.
- **P1 (should)** 8 项: 一个 decisive flourish, section 节奏交替, 标题 ≤14 词, lead ≤56ch, CTA 文案具体, hover state, 数字用 `.num` mono, 一页一种 image style.
- **P2 + Anti-slop 启发式**: gut check — "looks like every Cursor/Linear/Vercel ripoff" → 重做一个 feature cell, 删一个 accent.

### 2.6 自由度 vs 约束度 — 严约束

- 类是固定的 (~40 个)。
- Section 类型是固定的 (8 个 layout)。
- Token 是固定的 (6 个 :root 变量)。
- "**Don't write sections from scratch — pick the closest layout, paste, swap copy**" (layouts.md:3).
- "**Don't fight the seed**" (SKILL.md:80).

Codex 这里的"创造力"只剩三件事: (a) 选哪几个 layout (b) 写什么文案 (c) 用哪个 design system token。**这是非常 opinionated 的 skill，远比"开放生成"严**。

### 2.7 Image 处理 (web-prototype 内部)

- **Hard rule** (SKILL.md:84): "**Image placeholders, not external URLs.** Use the `.ph-img` class — never link to a stock photo CDN."
- 在 `craft/anti-ai-slop.md:51` 也把这做成 P1 软规则: 禁用 `unsplash.com`, `placehold.co`, `placekitten.com`, `picsum.photos`。
- `.ph-img` 自身只是个 tinted CSS block — 显示 `[ Hero visual · 16:9 ]` 之类的占位文本 (layouts.md:56)。
- **没有图片生成、没有 stock 调用、没有 logo fetch**。

---

## 3. 140 design-systems 分类

### 3.1 是什么 (`design-systems/README.md` + `airbnb/DESIGN.md` 实读)

每个 system = **一个 `DESIGN.md` 文件**，遵循 [awesome-claude-design](https://github.com/VoltAgent/awesome-design-md) 的 9-section schema (Visual Theme / Color Palette / Typography / Layout / Components / Motion / Imagery / Voice / Anti-patterns).

**Format**: 散文 + 数据。例如 `airbnb/DESIGN.md:8`:

> "Airbnb's 2026 design feels like a travel magazine that happens to be an app — pristine white canvases give way to full-bleed photography, and the interface itself disappears so the listings can breathe. The signature Rausch coral-pink (`#ff385c`) is used sparingly but unmistakably..."

接 hex 表 + CSS variable name list + gradient spec. **不是 token JSON, 不是组件库, 不是模版** —— 是 LLM-readable 风格描述。

### 3.2 大小差距很大

```
default/DESIGN.md       62 LOC   (starter, minimal)
agentic/DESIGN.md       71 LOC
atelier-zero/DESIGN.md  316 LOC  (hand-authored, magazine-grade)
airbnb/DESIGN.md        393 LOC  (从 npm getdesign 同步, 最详尽一档)
```

### 3.3 来源 (`design-systems/README.md`)

- **2 hand-authored starters**: `default` (Neutral Modern), `warm-editorial`.
- **2 magazine-grade**: `atelier-zero`, `kami` (paired with specific landing skills).
- **57 design skills** ← `bergside/awesome-design-skills` (风格化美学如 brutalism · glassmorphism · claymorphism · doodle · dithered).
- **70 product systems** ← VoltAgent/awesome-design-md / getdesign npm (airbnb · linear · stripe · cursor · ferrari etc.).

类别 (README 表) 9 类: AI&LLM / DevTools / Productivity / Backend / Design / Fintech / E-Commerce / Media / Automotive.

### 3.4 Codex 怎么用

**1 个 / 次**。Web UI 顶栏 "Design system" dropdown 选 1 个，daemon 把它整个 body 拼进 system prompt (架构图见 §1 末)。没有 mix-match。SKILL.md 显式说 (line 49): "Map its colors to the six `:root` variables in the seed; **don't introduce new tokens**."

→ DESIGN.md 充当**风格大脑** (告诉 codex "Airbnb 是这种气质")，seed 充当**结构骨架** (告诉 codex "这是 HTML 长这样")。

---

## 4. 74 skills 分类

`ls skills/ | wc -l = 74`. 网站相关 11 个 (其余 63 个是 deck / mobile / dashboard / email / 视频 / 海报 / pptx 变体 / orbit-* email-style):

| Skill | mode | 用途 |
|---|---|---|
| **`web-prototype`** | prototype | 通用 landing (我们用的) |
| `web-prototype-taste-brutalist` | prototype | Swiss Industrial Print 风 (Leonxlnx/taste-skill 移植) |
| `web-prototype-taste-editorial` | prototype | Editorial minimalist |
| `web-prototype-taste-soft` | prototype | Apple-tier soft |
| `saas-landing` | prototype | Hero + features + social proof + pricing + CTA |
| `pricing-page` | prototype | 价格页 |
| `docs-page` | prototype | 文档首页 |
| `dashboard` | prototype | 后台 / 分析 |
| `waitlist-page` | prototype | 等待名单 |
| `kami-landing` | prototype | Kami DS pair |
| `open-design-landing` | prototype | OD 自家落地页 |
| `flowai-live-dashboard-template` | template | 模版型 dashboard |

辅助型 (可考虑组合):
- `critique` — 五维度评审 skill (philosophy/hierarchy/detail/function/innovation 各 0-10 分)。**OD 自带的 quality check**。
- `blog-post` — 给客户写 blog 文章可用。
- `email-marketing` — 邮件营销。
- `image-poster` · `magazine-poster` — 静态海报。

剩下 50+ 个是 deck (html-ppt-* 22 个变体 / guizang-ppt / kami-deck / replit-deck …) + 单文件其他场景。**与多页网站基本无关**。

---

## 5. templates / craft / story

### 5.1 `templates/`

仅 2 个文件，都是**幻灯片**框架，不是网页:
- `deck-framework.html` — 1920×1080 deck stage with `transform: scale(--deck-scale)` centering pattern.
- `kami-deck.html` — verbatim copy 套 kami theme tokens.

→ **OD 的 "Template mode"** 在 spec/modes.md 中是规划过的概念 (modes.md 表头 "Template — Populated copy of a curated template"), 但 `templates/` 现在只有 deck，**没有任何 landing-page template**。这是一个潜在 contribution 点。

### 5.2 `craft/` (verified `craft/README.md`)

9 个 brand-agnostic rulebook (这是 OD 的 "第三轴"):

| 文件 | 何时 requires |
|---|---|
| `typography.md` | 所有 typed content (~ 全部 skill) |
| `color.md` | 所有 styled output |
| `anti-ai-slop.md` | Marketing / landing / decks |
| `state-coverage.md` | Stateful UI (dashboard / form / table) |
| `animation-discipline.md` | 任何带 motion 的 skill |
| `accessibility-baseline.md` | 任何 interactive |
| `rtl-and-bidi.md` | 多语言 |
| `form-validation.md` | 有交互表单的 |
| `laws-of-ux.md` | 涉及命名认知极限的 (Hick / Fitts / Zeigarnik...) |

**重点**: `craft/anti-ai-slop.md` 7 cardinal sins **被 daemon 的 `apps/daemon/src/lint-artifact.ts` 自动 lint**！ (980 LOC 文件，verified)。 P0 hits:
1. Default Tailwind indigo (`#6366f1` 等列表) 作 accent
2. Two-stop "trust" gradient on hero
3. Emoji-as-feature-icon
4. Sans-serif on display text
5. Rounded card + 左 colored border 的 "AI dashboard tile" 形状
6. Invented metrics
7. Filler copy

Lint 结果通过 `renderFindingsForAgent()` (line 512) 反馈给 agent 作 self-correction reminder。**这是 OD 主动 quality 控制的核心**。

### 5.3 `story/`

`STORY.md` 和 `STORY.zh-CN.md` **都是 0 bytes**。占位文件，不是已建成的能力。可忽略。

---

## 6. Image 处理真相

综合 `skills/web-prototype/*`, `craft/anti-ai-slop.md`, `apps/daemon/src/lint-artifact.ts`, `docs/architecture.md`:

| 维度 | 现状 |
|---|---|
| **图片生成** | 无内置图片生成 API。`prompt-templates/image/` 存在但只是 prompt 文本块，给媒体生成 skill (e.g. image-poster) 用，不参与 web-prototype 流程。 |
| **Stock 集成** | **被显式禁止**。Unsplash / placehold.co / placekitten / picsum 列入 P1 anti-slop tells (`craft/anti-ai-slop.md:51`)。 |
| **Logo fetch** | 无。codex 自己决定，OD 不主动抓客户站点。 |
| **占位策略** | `.ph-img` CSS 块 (tinted gradient + aria-label + 内文 `[ Hero visual · 16:9 ]`)。永远不是 `<img>` 标签，永远不会显示 broken image icon。 |
| **客户能注入图片吗** | 可以，但要在 codex 完工**之后**人工替换 `.ph-img` block — 没有自动 fetch、没有 prompt 槽让你说 "use this image"。 |
| **Export 时的资产** | `docs/architecture.md` HTML 自包含导出说: "Inline all CSS, **rewrite asset URLs to data: URIs**"。意味着如果你确实塞了本地图片，OD 会把它内嵌进 HTML。 |

→ **结论: OD 完全把图片留给下游 (我们) 解决。它的设计哲学是 "no broken images, no theft, no fake stock" → 占位永远美 → 客户/我们再换真图**。

---

## 7. Quality / checklist (verified 真实存在)

OD 有 **三层** quality 防线:

1. **Skill-level**: `skills/web-prototype/references/checklist.md` (上文 §2.5)。Codex 写完自查，写在 system prompt 里。
2. **Lint-level**: `apps/daemon/src/lint-artifact.ts` (980 LOC)。Artifact 落盘前/后跑，把发现回灌成 system reminder 让 agent self-correct。规则列表与 anti-ai-slop.md P0 同步 (line 22 注释)。
3. **Critique skill**: `skills/critique/SKILL.md` — 五维度评审 (Philosophy / Visual hierarchy / Detail / Functionality / Innovation 各 0-10 + Keep/Fix/Quick-wins 列表)，输出独立 HTML 报告。**可以在 agent 自己产出后跑一遍作 self-review，再再生成**。Daemon 有 `apps/daemon/src/critique/` 模块化了 orchestrator + parser + persistence + scoreboard，且 `server.ts:3937` 的 `composeSystemPrompt({ critique, critiqueBrand, critiqueSkill })` 支持把 critique 配置 thread 进运行流。

→ **OD 知道 codex 会 slop，并主动 lint + critique**。但目前两层质量门都是建议性的 (lint-artifact.ts 不 hard-block 落盘 — craft/README.md:55 "Artifact persistence is not currently hard-blocked on P0 hits")。

---

## 8. 关键洞察 (8 个)

1. **OD 是 prompt 编排器，不是渲染器**。智能完全来自三层 prompt 拼接 (BASE + DESIGN.md + craft + SKILL.md) + 它启动的 codex CLI 本身。换掉 codex / 换模型 / 改三层任何一个，输出质量都会变 — OD 本身不会因为升级而"更聪明"。
2. **web-prototype 是 highly opinionated**。8 个固定 section layout + ~40 个固定 class + 6 个固定 token + 一长串 P0/P1 lint rule。**这不是开放生成，这是"高约束 templating"**。Matthew 看到的"AI 觉得能交付我不满意"很可能是: codex 选错了 layout 顺序、文案空洞、或忽略了 P1 项 (而 lint 只挡 P0)。
3. **140 个 design-system 都是 prose-style DESIGN.md**。**不是 tokens.json，不是 component library**。它们是给 LLM 看的"风格灵魂描述"，由 codex 翻译成 6 个 `:root` 变量。质量天花板取决于 codex 把散文翻成 token 的能力 — 对一些 system (Airbnb 393 LOC) 信息丰富，对 default (62 LOC) 单薄。
4. **OD 没有 "components" 概念**。Skills 是 "artifact shape"，design-systems 是 "brand visual"，craft 是 "universal rules"。三轴里**没有第四轴 components**。 web-prototype 的 ~40 个 class 是 "hardcoded into one HTML seed"，不是可重用的 library。
5. **OD 没有 landing-page template**。`templates/` dir 真实存在但只有 deck 模板。Spec 里 Template mode "Populated copy of a curated template" 是规划但未实施。
6. **OD 显式禁止 stock photo CDN**。`.ph-img` 永远是占位 CSS 块；codex 永不输出真图 URL。这意味着所有 hero visual / product shot 都得我们 post-process。
7. **OD 自带 critique skill + 自动 lint**。但 lint 只挡 7 个 hard sin (主要是 indigo accent / emoji icon / invented metric / filler copy)，**抓不到布局糟糕 / 文案空洞 / 节奏单调 / 信息层级混乱**。 critique skill 默认不在主流程跑，要单独触发。
8. **`web-prototype-taste-*` 三个变体是真实 alternatives** (brutalist / editorial / soft)。如果通用 `web-prototype` 输出感觉模板化，换 taste-* 等于切到另一套 seed + checklist。我们的 wrapper 现在硬编码 `--skill web-prototype`，**没用到 taste 变体**。

---

## 9. OD 真实能扩展的接口 (我们能 hook 进去 · 不改 OD 代码)

| Hook | 怎么用 |
|---|---|
| **新增 design-system** | `mkdir design-systems/profitslocal-<niche>/` + 写 `DESIGN.md` (9-section schema, 70-300 LOC). 自动出现在 dropdown。**我们可以为常见 niche (restaurant / dental / clinic / boutique) 各做一个**。 |
| **新增 skill** | `mkdir skills/profitslocal-local-business/` + 写 `SKILL.md` (front-matter + 工作流) + `assets/template.html` + `references/{layouts,checklist}.md`。完全照搬 web-prototype 形态。**我们可以做 niche-specific landing skill**。 |
| **新增 craft 文件** | `craft/profitslocal-local-seo.md` + 在 skill front-matter `od.craft.requires` 加 slug。 |
| **传 prompt** | 我们 wrapper `run-concept.js:472 buildPrompt()` 已经在做。可以 thread 进任意 brief / 约束 / 锚定 facts。 |
| **跑 critique skill** | 给 daemon 多发一个 chat 请求，skill=critique，绑前一次的 artifact dir。能得到分数 + Keep/Fix/Quick-wins。 |
| **读 daemon lint findings** | `lint-artifact.ts` 的 `lintArtifact(html)` 返回结构化 findings，daemon API 应该已经暴露 (待查 server.ts 路由)。 |

---

## 10. OD 不能 / 不该改的部分

- **不要改 `apps/daemon/src/server.ts`、`composeSystemPrompt`、`lint-artifact.ts`**。这是上游热路径，会被 git pull 覆盖 / 引发 merge 冲突。所有"加约束"都应通过新加 skill / craft / DESIGN.md 实现，不要改它现有的。
- **不要改 `skills/web-prototype/*`**。同上 — 它是上游 sourced，我们的 skill 应是 sibling (`skills/profitslocal-*`) 而非 fork。
- **不要试图加 "components" 第四轴**。OD 显式选择三轴 (skills + design-systems + craft)，加一个新轴会逼我们 fork daemon。要复用组件，把它们打进 skill 的 `assets/template.html` 即可。
- **不要靠 OD 处理图片**。它做了立场清晰的选择 (no broken / no stock / no generation)。要图片，post-process 我们自己加 (Cloudinary + Flux / Replicate / 客户上传)。

---

## 11. 给 Matthew 4 个问题的暂答 (基于代码证据)

### A. 宽松 vs 严格 — OD 当前是哪种?

**OD 默认就是严约束**。证据:
- web-prototype SKILL.md "Don't write CSS from scratch, paste skeletons" (SKILL.md:29).
- 8 个固定 layout (layouts.md), 不在列表里的 section 类型不让做.
- ~40 个固定 class, 不在 inventory 里的要先去 `<style>` 加.
- 6 个固定 token, "Don't introduce new tokens" (SKILL.md:49).
- 10 条 P0 checklist + 7 条 hard lint sin, 写完必须自检.

→ Matthew 的 pain 不是因为"OD 给 codex 太自由"，**是因为 codex 即便在这个约束下，仍然会生成节奏单调 / 文案空洞 / layout 选错 / 信息层级混乱的页面 — 而 OD 现有 lint 抓不到这些**。

**建议**: 不是再加约束，是把 critique skill 接进主流程 (生成 → critique → 若分数 <X 自动 regenerate),或者写一个 ProfitsLocal-specific checklist (本地商家落地页特有要求: 地址块 / 营业时间 / 真实电话 / Google 地图嵌入 / 真实 review 引用 etc.) 作 P0 加进我们自己的 skill。

### B. 模版 — OD 自身有模版机制吗?

**部分有**。
- `templates/` dir 真实存在但**只有 deck**，没有 landing template.
- Spec 里规划过 Template mode (modes.md:11) "Populated copy of a curated template", 但 v1 没实施.
- **`design-systems/` 不是模版** — 是风格描述，不是 HTML scaffold.
- **`skills/<x>/assets/template.html` 是 seed-template** — web-prototype 那一个就是 (`skills/web-prototype/assets/template.html` 338 LOC). 这是 OD 现存最接近"模版"的东西.

**建议**: 我们应该**做 niche-specific template seeds** (`skills/profitslocal-restaurant/assets/template.html`, `skills/profitslocal-dental/assets/template.html`, …)，每个 seed 已经摆好"hero + 菜单/服务 + 地址 + 营业时间 + 评价 + 地图 + CTA"骨架，codex 只填字 + 选 design-system。质量上限会立刻拉高。

### C. 组件 — OD 有 component lib 概念吗?

**没有第四轴**。Components 在 OD 里 = "已在 skill seed 的 `<style>` 里定义并在 layouts.md 列出的 class"。复用粒度是 **section layout**，不是 **component**。
- 例: `.feature.card-flat` 就是一个组件，但只能通过整个 Layout 3 paste 来用，不能单挑.
- 没有 `<Card>` / `<Button>` JSX 抽象 (web-prototype 输出是 HTML, 不是 JSX).

**建议**: 想"组件复用" → 我们自己的 skill seed 里多加 class + 在 layouts.md 多 ship layout (e.g. `local-hours-block`, `local-review-card`, `local-map-embed`, `local-service-grid`)。Niche skill = bigger class inventory + bigger layout catalog. 这比改 OD 干净.

### D. 图片 — OD 自己处理 vs 等外部?

**OD 等外部 (而且明确不掺和)**。
- 无 image gen API, 无 stock 集成, 无 logo fetch.
- `.ph-img` 永远是 CSS tinted block, 不是 `<img>`.
- 反规则: `unsplash.com` 等 CDN 被 P1 anti-slop 列名禁用.
- Export 时只内嵌 *已存在的* 本地 asset 为 data URI.

**建议**: 图片完全是我们的事。可选方案:
1. **Niche stock 库** — 为每个 niche (restaurant / dental / pet / fitness) 预先建 20-40 张 royalty-free 图，按 brief 关键词匹配后塞进 `clients/<slug>/concept/open-design/assets/` 让 codex 引用 — 但要先告诉它图存在 (prompt 加 "Use ./assets/hero.jpg" 指令).
2. **生图 (Flux / DALL·E / Replicate)** — wrapper 在 codex 完工后 post-process: 找到所有 `.ph-img`, 根据其 `aria-label` 自动跑生图 API，替换为 data URI 或 Cloudinary URL.
3. **客户手填** — 在 brand-spec 阶段就让客户传图，注入路径到 prompt.
4. **Niche-specific Google Photos / Yelp 抓取** — 客户已有 GMB / Yelp 页时直接拉对方的真图 (附 attribution).

我会推 **方案 3 + 方案 2 兜底**: 真图永远赢；缺图时 Flux 生 niche-appropriate stand-in；prompt 占位写文案让客户最终替换。

---

(end of report — 行数 ≤ 600)
