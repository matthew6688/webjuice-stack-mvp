# OD Skills Inventory · 139 skills × ProfitsLocal pipeline

**Date**: 2026-05-27
**Source**: <https://github.com/nexu-io/open-design/tree/main/skills> (mirror at `/tmp/open-design/skills/`)
**Status**: V1 inventory · per-skill triage based on SKILL.md frontmatter · 待逐个深度测试
**为什么这份文档存在**: OD repo 是宝藏 · 但 139 skills 大部分跟我们业务无关 · 需要策展菜单 · 不能 black-box 全调 · 这份是策展的 v1。

---

## 0 · 我们的 pipeline 阶段 (锚点)

| # | 阶段 | 目的 |
|---|---|---|
| **S1** | Lead discovery | 找 AU 本地客户 (Google Maps / 牌照库 / Yellow Pages) |
| **S2** | Lead enrichment | scrape 网站 · reviews · 牌照查询 · 信号打分 |
| **S3** | Brand brief / direction | 从 entity → 调性/tier/buyer 档案 |
| **S4** | Design / build website | T1-T5 模板 · slot-filler · OD design-systems |
| **S5** | Audit | 4-tier audit (T1 hard + T2/T3/T4 0-100 + composite ≥73) |
| **S6** | Proposal / pitch | master.md → customer-facing audit HTML + sample sites |
| **S7** | Outreach | email / SMS / phone / WhatsApp · 加 hook |
| **S8** | Internal docs | master.md · INFRASTRUCTURE-MAP · audit reports · SOP |

---

## 1 · Tier 总览 · 139 → 23 P0/P1 · 其余降级或 skip

| Tier | 数 | 含义 |
|---|---:|---|
| **P0** · 立刻进库 | 8 | 直接用 · 已有或正在用 · 解决核心需求 |
| **P1** · 短期接入 | 15 | 1-2 周内值得测试 + wrapper · 真补我们短板 |
| **P2** · 备选 / 单点 | 22 | 偶发需求 · 单 ticket 调用 · 不需 wrapper |
| **Skip · 不相关** | 94 | 视频 / 音频 / 海报 / 跨平台 cards / 装饰特效 · 不在我们业务 |

---

## 2 · P0 · 立刻进库 (8 skills · 已用或正在用)

| Skill | 阶段 | 我们怎么用 | 当前状态 |
|---|---|---|---|
| **design-md** | S3+S4 | DESIGN.md SSOT · brand 方向 · tokens 文档 · 每客户一份 | 已经在用 (huashu-design 内置) |
| **design-review** | S4+S5 | "Designer Who Codes" 视觉 audit + atomic commits + before/after | 已用 · 这次 V0-V4 的 OD-REVIEW.md 出处 |
| **plan-design-review** | S5 | Senior 设计师 0-10 评分 + AI-slop 检测 | 已用 · OD-REVIEW-SUMMARY 评分维度参考 |
| **design-brief** | S3 | I-Lang 协议解析模糊 brief → 显式 palette/typo/density/mood | 还没用 · **应该接入** (brief inference 上游) |
| **design-consultation** | S3 | 从零建 design system + 真实 mockup | 还没用 · 用在 brand-from-zero 客户 |
| **taste-skill** | S4 | DESIGN_VARIANCE + MOTION + DENSITY 三 dial · 反 AI default | 已用 · V2/V4 出处 |
| **brand-guidelines** | S3 | Anthropic-style brand token 文档约束 · 给我们做 brand-tokens.css 模板 | 还没用 · **应该参考其格式** |
| **theme-factory** | S4 | 10 个预设 theme 套用 slides/docs/HTML | 还没用 · **slot-filler 落地的最近邻** |

---

## 3 · P1 · 短期接入 (15 skills · 真补短板)

| Skill | 阶段 | 我们怎么用 | 接入成本 |
|---|---|---|---|
| **frontend-design** | S4 | Anthropic frontend-design SKILL 直接套 · landing 页核心 | 1 hr (wrap 调用) |
| **frontend-skill** | S4 | OpenAI 风格 frontend playbook · 备选 advisor | 1 hr |
| **web-design-guidelines** | S4 | Vercel 的 layout/typo/color/motion/a11y 规范 · 给我们 audit 加规则 | 30 min · 抄成 SOP |
| **ui-skills** | S4 | 跨组件一致性约束清单 · 反 LLM 漂移 | 1 hr |
| **ui-ux-pro-max** | S4 | catalog-only · 但 trigger 词可以提示 | 0 · 单独看 |
| **copywriting** | S4+S6 | landing copy / ad copy / hero 副本重写 · 直接接管 hero/CTA 文案生成 | 2 hr (套入 slot-filler) |
| **marketing-psychology** | S4+S6+S7 | hook/framing/pricing 心理学 · 加进 audit T3 维度 + outreach hook | 1 hr |
| **creative-director** | S4 | 20+ 方法论 (SIT/TRIZ/SCAMPER) + Cannes 评分 · 给最高 tier 客户 | 2 hr · 仅 luxury tier 触发 |
| **paywall-upgrade-cro** | S6 | upsell/upgrade screen 设计 · 我们 future "客户转付费" 提案页用 | 1 hr |
| **enhance-prompt** | S4 | 把模糊 brief 转成有 design vocab 的强 prompt · brief inference 上游补强 | 30 min |
| **competitive-ads-extractor** | S2+S7 | 抓竞争对手 ad library · 给客户看"你 niche 同行在 Google 投什么" → 转化 hook | **3 hr · S7 outreach 真的有用** |
| **ad-creative** | S7 | headline + description + primary text 生成 · email/SMS hook 用 | 1 hr |
| **research-decision-room** | S5+S6 | 杂乱研究笔记 → 单 HTML artifact (evidence ledger + heatmap + decision memo) · 给客户 audit HTML 用 | 2 hr · audit report 可换格式 |
| **shadcn-ui** | S4 | accessible 组件 + Stitch loop · 提高 audit T2 a11y 分 | 2 hr (需 React stack) |
| **artifacts-builder** | S6 | React + Tailwind + shadcn 复杂 HTML artifact · proposal 页用 | 2 hr |

---

## 4 · P2 · 备选 / 单点调用 (22 skills · 不需 wrapper · 偶发用)

### S4 · Design / build 单点

| Skill | 用法 |
|---|---|
| **faq-page** | FAQ accordion section · slot-filler 模块化时可调 |
| **login-flow** | 客户 dashboard 登录 (远期 v5 才会用) |
| **apple-hig** | iOS 风格规范 · 看到 luxury tier 客户做 mobile-first 调 |
| **wpds** | Washington Post Design System · editorial 兜底参考 |
| **color-expert** | tokens.css 设计阶段的 color advisor |
| **stitch-loop** | shadcn 配套设计循环 · 短 ticket 用 |
| **canvas-design** | 通用 canvas-style design · 单次海报/banner |
| **frontend-dev** | cinematic 动画 + MiniMax 媒体 · 高端 hero · 偶用 |
| **web-artifacts-builder** | claude.ai artifact (React+Tailwind) · 给 internal demo 用 |
| **figma-use** + **figma-generate-design** | 如果未来跟 Figma 衔接 · 现在没需求 |

### S6 · Proposal / pitch 单点

| Skill | 用法 |
|---|---|
| **release-notes-one-pager** | "本次升级 highlights" 一页式 · 给 returning 客户 |
| **data-report** | CSV → 可视化报告 · 给客户看 audit metrics 时 |
| **d3-visualization** | D3 图表 · audit dashboard · 单 ticket |
| **article-magazine** | huashu-md-html magazine 长文 · master.md 转 HTML 备选格式 |
| **mockup-device-3d** | iPhone × MacBook 立体展架 · proposal "你的网站长这样" 视觉 |
| **screenshots-marketing** | Playwright marketing 截图 · proposal hero 用 |
| **full-page-screenshot** | CDP 全页截图 · 我们已有 self-hosted 版本 (audit) |
| **screenshot** | 基础 screenshot · 已有 |

### S7 · Outreach 单点

| Skill | 用法 |
|---|---|
| **domain-name-brainstormer** | demo 站点 domain 选 · `<biz>-demo.profitslocal.au` |
| **brainstorming** | outreach hook 头脑风暴 · 单次激发 |

### S8 · Internal docs

| Skill | 用法 |
|---|---|
| **doc** / **docx** / **pdf** | 内部 SOP/audit 转 Word/PDF · 给客户发 |
| **minimax-docx** / **minimax-pdf** | 同上 备选引擎 |

---

## 5 · Skip · 不相关 (94 skills · 不进库)

### 视频 / 音频 / 海报 / 装饰 (54)

```
8-bit-orbit-video-template · ai-music-album · algorithmic-art · 
hand-drawn-diagrams · hatch-pet · poster-hero · ppt-keynote · 
weread-year-in-review-video-template · vfx-text-cursor · 
remotion · sora · speech · slack-gif-creator · gif-sticker-maker · 
video-downloader · video-hyperframes · youtube-clipper · 
venice-audio-music · venice-audio-speech · venice-image-edit · 
venice-image-generate · venice-video · 
frame-glitch-title · frame-light-leak-cinema · frame-liquid-bg-hero · 
frame-logo-outro · frame-macos-notification · frame-flowchart-sticky · 
frame-data-chart-nyt · shader-dev · threejs · flutter-animating-apps · 
swiftui-design · 
deck-guizang-editorial · deck-open-slide-canvas · deck-swiss-international · 
nanobanana-ppt · html-ppt-retro-quarterly-review · pptx · pptx-generator · 
pptx-html-fidelity-audit · slides · frontend-slides · 
gsap-core · gsap-frameworks · gsap-performance · gsap-plugins · 
gsap-react · gsap-scrolltrigger · gsap-timeline · gsap-utils · 
swiss-creative-mode-template · swiss-user-research-video-template · 
resume-modern
```
理由：我们做的是本地 trade 单页/多页 · 不需要视频生成 / 海报 / slide deck / 3D shader / GSAP 动画 (taste-skill 已有更克制的 motion 控制)。GSAP 8 个 sub-skill 整套先 skip · 真要 motion 用 taste-skill 的 dial。

### 社交 cards / 跨平台分享 (4)

```
card-twitter · card-xiaohongshu · social-reddit-card · social-spotify-card · social-x-post-card
```
理由：本地 trade 不投 social card。

### Fal AI / Replicate / Pixelbin · 媒体生成 API (16)

```
fal-3d · fal-generate · fal-image-edit · fal-kling-o3 · fal-lip-sync · 
fal-realtime · fal-restore · fal-train · fal-tryon · fal-upscale · 
fal-video-edit · fal-vision · replicate · pixelbin-media · 
image-enhancer · imagen · imagegen
```
**例外 1**: `fal-generate` / `imagen` / `imagegen` 可以用 · 但已经有 stock library + Cloudinary pipeline · 优先用 stock · 远期补 hero 兜底再考虑。
**例外 2**: `fal-upscale` / `image-enhancer` 现在 stock library 1024×768 够用 · skip。

### Figma 链路 (6)

```
figma-code-connect-components · figma-create-design-system-rules · 
figma-create-new-file · figma-generate-design · figma-generate-library · 
figma-implement-design · figma-use
```
理由：我们没 Figma 工作流 · 全 code-first。**未来如果做客户协作可启用 figma-use + figma-implement-design**。

### Editorial template skills · 跟 OD design-systems 重复 (5)

```
editorial-burgundy-principles-template · field-notes-editorial-template · 
digits-fintech-swiss-template · after-hours-editorial-template · 
doc-kami-parchment
```
理由：这些是单 template prompt · 我们已经用 OD `design-systems/editorial` + `warm-editorial` 等覆盖 · 重复。

### 其他 (9)

```
platform-design · agent-browser · figma-use · 
```
等不在我们当前阶段需要的。

---

## 6 · 怎么用 · 集成方案

### 6.1 · Vendor SKILL 不直接 copy · symlink + 锁版本

每个 P0/P1 skill 用法：
```bash
# 在 ~/.claude/skills/ 下 symlink 进 OD 子目录
ln -s /Users/matthew/Developer/google-map-website-v3/external/open-design/skills/<skill> \
      ~/.claude/skills/od-<skill>
```
- `external/open-design/` 是 git submodule (锁特定 commit)
- 升级时 `git submodule update --remote` + 跑回归 audit
- 每个 skill 进库前必须过 4-tier audit (T1 hard) 一次

### 6.2 · Wrapper 层 · 不让 OD skill 直接 mutate 客户文件

OD skills 默认行为可能写文件到任意路径 · 我们必须 wrap:
```js
// scripts/cli/pl-skill-wrap.js
//   pl-skill-wrap od-design-review --target clients/<slug>/v2/concept/
// Wrapper 强制:
//   - cwd 锁到 clients/<slug>/v2/
//   - skill 写入只允许 concept/ / audit/ / proposal/ 三个目录
//   - 自动 git add + commit "skill: <name> run <date>"
```

### 6.3 · Pipeline 触发点 (建议)

```
S3 brand brief
  → enhance-prompt → design-brief → design-md (canonical SSOT)

S4 design / build
  → 5-8 个 curated OD design-systems (data 注入)
  → frontend-design + ui-skills + web-design-guidelines (三件套 advisor)
  → taste-skill (DENSITY/MOTION dial)
  → copywriting (hero copy)

S5 audit
  → design-review + plan-design-review (扩 audit T3 dim)

S6 proposal
  → mockup-device-3d (iPhone × MacBook 展架)
  → research-decision-room (audit HTML)
  → release-notes-one-pager (升级提案)
  → article-magazine (master.md 转长文)

S7 outreach
  → competitive-ads-extractor (查竞品 ad)
  → ad-creative (写 email/SMS hook)
  → marketing-psychology (cold hook framing)
  → domain-name-brainstormer (demo 站 domain)
```

---

## 7 · 风险 / 反约束 (吸取 V6 bento 教训)

| 风险 | 反约束 |
|---|---|
| 直接全量 black-box LLM 调 OD skill | ❌ 禁止 · 必须策展菜单 · skill 进库前过 audit |
| skill 写文件到任意路径 | ❌ wrapper 强制 cwd + 白名单目录 |
| skill 上游升级破坏我们 contract | submodule 锁 commit · 每次升级跑 vicwest 回归 audit |
| 多个 skill 互相矛盾 (e.g. taste-skill 反 AI-default vs frontend-dev 加 GSAP) | 每客户只选 1 advisor + 1 executor + 1 enforcer · 不超过 3 个 skill 同时活 |
| skill 用未来废弃的 API key (fal-* / venice-*) | 不接 P0/P1 · 远期再说 |
| skill 让 LLM "凭感觉" 给客户选 design-system | style-router 是 **rules-based** · 不是 LLM (memory lesson) |

---

## 8 · 下一步 · 建议测试顺序

按"补我们最大短板"排:

| # | 测试 OD skill | 用我们哪个客户 | 验证 | 投入 |
|---|---|---|---|---|
| 1 | **design-brief** (I-Lang 协议) | vicwest 已有 brief | 看是否能比我们当前 brand-brief 更结构化 | 30 min · $0.05 |
| 2 | **copywriting** | vicwest hero/CTA | 测能否给出比手写更紧凑的 hero copy · 比对 A/B | 1 hr · $0.10 |
| 3 | **competitive-ads-extractor** | vicwest niche (Ballarat roofing) | 真的能抓 Meta ad library 数据 → 给 outreach 加 hook | 2 hr · $0.20 |
| 4 | **research-decision-room** | 任何客户的 audit 数据 | 看能否替代我们手写 audit HTML 格式 | 1 hr · $0.10 |
| 5 | **mockup-device-3d** | vicwest preview.html | proposal "你的新网站长这样" 截图升级 | 1 hr · $0.10 |
| 6 | **theme-factory** | vicwest brand-tokens | 测 theme override 跟我们 tokens contract 是否兼容 | 1 hr · $0 |
| 7 | **ad-creative** | vicwest outreach | 自动生成 email subject + body hook | 1 hr · $0.10 |

**总**: 7 个 skill 测试 · ~7 hr · ~$0.65 · 出整套 P0/P1 落地评估。

---

## 9 · 维护

- 这份文档每月 review 一次 · 看 OD repo 有没有新 skill
- 每个 P0/P1 skill 进库时 · 在 `external/open-design/COMMIT.lock` 记锁定的 commit hash
- 重大升级 (P0 skill 改 SKILL.md 行为) 跑 vicwest 全 8 dim audit 验证不退化
- 测试结果累积到 `docs/v3/OD-SKILL-TEST-LOG.md`

---

## 参考

- 8-variant design comparison: `templates/roofing/single-page-library/_compare/COMPARISON-REPORT-V2.md`
- OD integration strategy (memory lesson): `~/.claude/projects/-Users-matthew-profitslocal/memory/project_od_integration_strategy.md`
- OD mirror: `/tmp/open-design/` · `git clone https://github.com/nexu-io/open-design`
- Upstream: <https://github.com/nexu-io/open-design/tree/main/skills>
