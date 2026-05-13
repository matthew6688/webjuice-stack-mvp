# V3 网站 autoresearch · 设计文档 · 2026-05-13

> Matthew reframe: "我们不知道哪种组合好 · 才需要 autoresearch + 截图判断"
> 我之前**全错方向** · 在 prescribing framework · 应该 EXPLORE

## 0. 核心思想

**Vision-based autoresearch · 不是 text-based**

```
传统 (我们 reports 用的):
  generate text → text-critic 读 text → score
  
V3 (网站用):
  generate HTML → Playwright screenshot → Vision LLM 读截图 → score + reasoning
```

让 vision LLM (Claude Opus vision 或 GPT vision) **看着布局判断** · 不是猜。

## 1. 现状 · 4 roofing families 不是 "framework 没建" · 是 "没人决定哪个赢"

`templates/roofing/families/` 4 套真有 HTML + 截图 + DESIGN.md + brand-kit + qa-rubric · 都过得去:

- **classic-premium-roftix** · 深绿 · 高端修复 ('Ridge & Hearth')
- **lead-capture-restoration** · 米橘 · 中端实用 ('tired roof back')
- **productized-modern-roofing** · 米绿 · 模块产品化 ('Ridgeline')
- **editorial-bold-commercial** · 黑橘 · 商业杂志感 ('Roofs built for business')

问题不是"质量不够" · 是 **per-entity 匹哪个不知道** + **怎么填 audit 内容不知道**。

→ 让 autoresearch 跑 + vision critic 判 · 发现 winning 组合 · **不要我猜**。

## 2. 组合空间 · 5 维

| # | 维度 | 取值 (起步 · 后期扩) |
|---|---|---|
| 1 | Family / Design system | 4 现有 roofing family + 后续加 |
| 2 | Section 组合 | A 5-section · B 6-section · C alt 5-section · etc. |
| 3 | Image source | a GMB only · b AI-stock (OpenAI Image 2 niche lib) · c 混合 · d source-URL scrape |
| 4 | Copy tone | trust-heavy / urgent / warm / professional |
| 5 | Audit banner | strong audit-fix mapping / 无 banner (control) |

完全空间: 4 × 3 × 4 × 3 × 2 = **288 variant**

每 entity 不跑全 · **smart sampling** N=6-8 · per-entity cost ~$3。

## 3. 架构 · OD 不动 · 我们 wrapper 加

```
core/website-autoresearch/
├── combinator.js          # 5 维笛卡尔 · smart sample
├── renderer.js            # HTML → desktop + mobile screenshot (Playwright)
├── vision-critic.js       # 截图 → 0-10 score + reasoning
│                          # 内置 10 条 rubric:
│                          #  1. 布局舒适 (留白 · 节奏)
│                          #  2. hero 抓眼
│                          #  3. CTA 显著
│                          #  4. 文字层级清晰
│                          #  5. 图片合适 (无 generic / mismatch)
│                          #  6. 视觉一致 (色 / 字)
│                          #  7. 信息密度 (不太空不太挤)
│                          #  8. mobile graceful
│                          #  9. 关键信息易找 (phone / address)
│                          # 10. 反 AI-slop (purple grad · emoji icon · etc.)
└── reporter.js            # 跨 entity 跨 variant 聚合 · 找 winner 模式

scripts/website-autoresearch/
└── run-roofing-experiment.js
   #  输入: N 真 entity
   #  per entity × M variant
   #  跑全 · screenshot · vision-critic · 评分
   #  输出 ranked variants + 跨 entity 模式分析
```

## 4. 运行 round 1 · 5 entity × 6 variant = 30 网站

**Sample entity** (从 roofing v2/ 真客户挑):
- brisbane-roof-restoration-experts (有 master.md + audit + video)
- brisbane-roofing-solutions-roof-restoration-repairs
- gutter-and-roof-repairs
- roof-space-renovators
- weatherproof-restorations

**Smart sample 6 variant per entity** (从 288 抽 6 · 跨维度 diversity):
- v1: family=classic-premium · section=A · image=GMB · tone=warm · banner=strong
- v2: family=lead-capture · section=B · image=AI-stock · tone=trust · banner=strong
- v3: family=productized · section=C · image=mixed · tone=professional · banner=strong
- v4: family=editorial · section=A · image=source-scrape · tone=urgent · banner=strong
- v5: family=classic-premium · section=B · image=AI-stock · tone=warm · banner=no (control)
- v6: family=lead-capture · section=A · image=mixed · tone=trust · banner=strong

(随机种 + 经验偏置 · 等数据来再调)

## 5. Acceptance · 你给的 4 数转化

| 你的 spec | 我的 acceptance |
|---|---|
| 30-50 lead/day | batch < 30 min/lead · 4-6 hr/day GPU 跑得动 |
| 操作员只看结果放行 | < 30 秒/lead · ✅ / 🔁 / ❌ |
| Reject 率 (未知) | round 1 target ≤ 30% · 实际从数据看 |
| 强 audit banner | banner 是 default · 不 dim |

## 6. 7-10 day 计划

| Day | 内容 | 输出 |
|---|---|---|
| 0 | 4 families 截图 review · F0 决定都保留 | 我看完 · 同意 |
| 1-2 | 建 autoresearch loop (combinator + renderer + vision-critic + reporter) | code in `core/website-autoresearch/` |
| 3-4 | 跑 round 1 · 5 entity × 6 variant · ~$15 vision API | report.md · 30 截图 |
| 5-6 | iteration · 砍 loser 维度 · 加新维度 · round 2 | refined report |
| 7 | Lock winner · 输出 `design-systems/profitslocal-roofer/DESIGN.md` + `skills/profitslocal-roofer/SKILL.md` + copy template + banner template | framework locked |
| 8-9 | Batch 30 真 entity 验证 · 操作员盲过 | reject rate metric |
| 10 | Production cutover · daily 30/day batch | live |

## 7. Cost 估

| 阶段 | API cost |
|---|---|
| Round 1 · 30 网站 + vision critic | $15 |
| Round 2 · 30 网站 | $15 |
| Batch validation · 30 真 entity | $45 (OD generate $1/lead × 30 + vision $0.5/lead × 30) |
| **总** | **~$75 · framework lock** |
| Production · 1500 lead/month (50/day) | ~$2250/月 · $1.50/lead |

## 8. 我撤回我之前所有"我猜"的方案

| 我之前说 | 撤 |
|---|---|
| F1 elvissun mega-prompt 跑 5 aesthetic · 你挑 1 | ❌ autoresearch 会自己发现 winner |
| F2 我帮你锁 8 layout 餐厅-friendly | ❌ autoresearch 跑 section 维度 |
| F4 我设计 audit-driven copy template | ❌ 仍要 · 但 copy 内容由 autoresearch 优选 |
| restaurant 先 | ❌ roofing 先 (你纠正了) |

## 9. 实话 · 这是为啥比我之前方案对

我之前 5 实验是: 我**先决定 winner** (e.g. "锁单一 design system") · 然后实验**验证我的选择**。

你 reframe: **我们不知道 winner · 让系统 explore**。

→ autoresearch 真用 vision · 真在数据上决策 · 不靠我审美 · 也不靠你审美 (主观偏置太大)。

输出的 framework 是**数据 backed** · 不是 prescription。

## 10. 我现在 do 什么

回我一句:
- **"开干 Day 1-2"** → 我建 autoresearch loop (~2 day · code only · 不真跑)
- 或反对哪条
- 或问问题

接下来不再发新方案文档 · 直接 code。
