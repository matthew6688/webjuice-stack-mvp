# Reference-site handoff boundaries · classic-premium-roftix · 2026-05-13

> 给 OD 的"能动什么 · 不能动什么"边界 · 用来 round 1 跑 approach C (reference HTML adapter)

## Demo customer (虚构 · 用作 reference)

- 商家: **Brisbane Premium Roof Co**
- 电话: (07) 3185 2440 · tel:0731852440
- 地址: 12 Doggett St, Newstead QLD 4006
- 邮箱: hello@brisbanepremiumroof.com.au
- 服务: 屋顶 restoration · replacement · leak/storm repair
- 服务区: Brisbane 内北/内西 + Moreton Bay
- 资质: QBCC 15234567 · 10-year guarantee · 600+ roofs since 2014
- 价位指示: $4,800–$8,500 typical restoration (写在 FAQ)
- 评价 (3 条 mock): Sarah M. Wilston / David L. Ashgrove / Helen&Mark P. Paddington

→ round 1 OD adapter 任务: 把以上每一处 swap 成真客户对应数据。

## LOCKED · OD 不能改

1. **Color tokens** (CSS `:root` 里所有 `--bg / --surface / --fg / --muted / --border / --accent / --primary / --warm / --ink`)
2. **Font families** (display = Playfair Display · body = Inter · mono = JetBrains Mono)
3. **Type scale** (`--fs-h1` 到 `--fs-meta`)
4. **Spacing scale** (`--gap-xs` 到 `--gap-2xl` · `--container` · `--gutter` · `--radius`)
5. **Section 内 styling**: hero gradient · service-card 形态 · quote-card 形态 · form 字段样式 · button 形状 · footer 排版
6. **`.topnav` 和 `.pagefoot`** 整段 (标 `data-od-locked="true"`) · OD 只 swap 文字内容 · 不动结构
7. **Mobile breakpoint @ 920px** 和 mobile-call-bar 出现机制
8. **Audit banner 视觉** (黑底 · 米橘 tag · 米橘 CTA underline) · OD 只换文字内容

## FLEXIBLE · OD 看真客户数据自由调

每个 section 都标了 `data-od-id="..."` · 标 `data-od-flexible="content"` 的明确允许:

| Section (data-od-id) | OD 能做什么 |
|---|---|
| `audit-banner` | 完全换内容 (audit score · 3 个 finding · CTA target) · 客户没 audit 则**删掉整个 banner** |
| `hero` | 改 eyebrow / H1 / lead / 2 个 CTA / 3 个 proof-cell · 图片 swap 为客户对应 hero · **不改 layout** |
| `services` | 卡片数 3-6 · 每张卡 (img + h3 + p + 3-4 list 项) 内容自由 · 卡片样式不改 |
| `trust` | 引用 3 条客户真评价 (来自 reviewVoice) · 没评价则**删掉整个 trust section** · 仍想用则改成"为什么选我们"3 卡 |
| `projects` | 1 张项目图 + 1 段 case study + 4 bullet · 客户没 case study 则换成 "what we typically do" generic 但不编造 |
| `process` | 步骤数 3-5 (默认 4) · 每步 h3 + p |
| `service-area` | 4-12 个 suburb pill · 没区域数据**删掉整段** |
| `faq` | 3-6 条 Q&A · OD 应基于客户业务 + auditPainPoints 生成相关问题 |
| `contact` | form 字段固定 (name/phone/suburb/service/message) · `<select>` 的 service options 可改 · 联系信息块 swap |

## ADD-ABLE · OD 真碰到新场景才加

如果客户业务 reference site 没覆盖 (e.g. 24/7 emergency hotline · 商业屋顶 · 太阳能集成) · OD 可新建 section · **但必须**:

1. 用 LOCKED 里的 tokens · 不发明新颜色/字号/间距
2. 复用已有 building block (card / quote-card / process-card / suburb-pill 之一) · 不发明新组件类型
3. 在 `<section>` 上标 `data-od-new="true" data-od-new-reason="..."` (e.g. `data-od-new-reason="customer has 24/7 emergency line not covered by reference"`)
4. 放在 services 和 trust 之间 (默认插入点) · 除非 reason 说明该放其它位置

## OD 不许做的事 (失败模式黑名单)

- ❌ 改 `:root` 任何 token · 包括"我觉得这家客户该用蓝色"
- ❌ 把 Playfair Display 换成 SaaS 风字体 (Geist / Inter display 等)
- ❌ 加 hero 上的紫色渐变 / 任何 AI-slop 视觉
- ❌ 把图片换成 SVG placeholder / picsum / placehold.co / unsplash 链接
- ❌ 编造客户的 license number · review · address · price · year
- ❌ 用通用文案: "trusted partner" · "your roof deserves better" · "X years of excellence" · "quality you can count on" · "welcome to"
- ❌ 删 `data-od-locked="true"` 的 section
- ❌ 拆 mobile-call-bar (这是 conversion 关键)

## Round 1 提示词 (给 OD · 等 reference 截图过审后再用)

```
You are adapting a reference roofing website to a specific real customer.

Reference site: [paste reference-site/index.html source]
Boundary rules: [paste HANDOFF-BOUNDARIES.md]

Real customer data:
- ownerVoice: [from master.md]
- reviewVoice: [3-8 review snippets from audit]
- auditPainPoints: [from internal audit]
- verifiedFacts: [business name / phone / address / services / suburbs / license]

Your task:
1. Swap Brisbane Premium Roof Co → real customer everywhere
2. Adapt copy to real customer's tone, services, and suburbs (use ownerVoice quotes where natural)
3. Replace trust quotes with reviewVoice (or remove section if no reviews)
4. Update audit-banner to real customer's audit findings (or remove if no audit)
5. Add data-od-new section ONLY if real customer has business type not covered (24/7 emergency / commercial / solar)
6. Output one complete index.html

Do not change LOCKED tokens, fonts, spacing, or section internal styling.
Do not invent: license numbers, review quotes, addresses, prices, years in business.
Do not use any phrase from the failure-mode blacklist.
```

## Images we have vs need (告 Matthew)

**Have (current 5 .jpg in `assets/`)**:
- `hero-premium-roof-blue-hour.jpg` — 用作 hero · 实际看是个 US Victorian 法律事务所 · **不够好 · 需要 swap**
- `service-roof-repair-flashing-detail.jpg` — service 1 · 还行
- `service-roof-installation-detail.jpg` — service 2 · 还行
- `about-roofer-working-roof-frame.jpg` — service 3 · 还行
- `project-before-after-roof-transformation.jpg` — projects · 不是 before/after · 是单张材料图 · **不够好**

**Need from Matthew (ChatGPT Image / midjourney · 5 张)**:

1. **Hero** (1600×900 desktop · 1080×1350 mobile crop · 真 Australian Queenslander 房子 · 黄昏 blue hour · 屋顶 restored 状态 · 红 terracotta tile 或 Colorbond)
2. **Service 1 · 屋顶 restoration 特写** (re-pointing 或 ridge capping work · 800×600)
3. **Service 2 · Colorbond 安装** (crew 装新铁皮屋顶 · 800×600 · 已有一张可能够用 · Matthew 看)
4. **Service 3 · Storm leak inspection** (roofer 拿手电检查瓦片下漏点 · 800×600)
5. **Project before-after** (split 左右真 before/after · 同一个屋顶 · 1200×800)

或者: Matthew 你说不需要新图 · round 1 用现有 5 张跑 · 看出来效果决定要不要重做。我倾向先用现有跑 · 别把 round 0 卡在等图上。

## 文件清单

```
reference-site/
├── index.html              (这次产出 · 约 350 行 · 完整 polished demo)
├── HANDOFF-BOUNDARIES.md   (本文件)
└── assets/                 (copy 自 open-design/assets/ · 5 张 .jpg)
```

## 下一步

1. **Matthew 看 reference-site 截图** · 决定 "够 demo-grade 了 / 还要改 X / 图必须换"
2. 通过后 → round 1 跑 A/B/C 比较 (脚本 + 3 客户截图比较)
3. 不通过 → 改 reference · 再看
