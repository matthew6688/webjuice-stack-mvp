# Reference-site handoff boundaries · classic-premium-roftix · 2026-05-13 (v2)

> Matthew 纠正 v2: 客户素材少时 · **不是删 section · 是 AI 补 sample data + 标可改** ·
> M3 是 demo · 必须看着完整 · 客户买后 M5 revision flow 改真值。

## Demo customer (虚构 · reference 用)

- 商家: **Brisbane Premium Roof Co**
- 电话: (07) 3185 2440
- 地址: 12 Doggett St, Newstead QLD 4006
- 邮箱: hello@brisbanepremiumroof.com.au
- 资质: QBCC 15234567 · 600+ roofs since 2014 · 10-year guarantee

→ round 1 OD 任务: swap 以上每处成真客户对应数据 (来自 master.md verifiedFacts)。

## 数据分两类 · 关键

### A. **REAL · 必须真 · 不许编**

| 字段 | 来源 |
|---|---|
| 商家名 / phone / email / address / website | master.md verifiedFacts |
| License / ABN / 年份具体数字 | master.md verifiedFacts (有才用 · 没有不显示该 line) |
| 引用客户业主自己的话 (about/hero copy) | ownerVoice (GMB description / 现网 about) |
| 引用真客户评价 (姓名+suburb+原话) | reviewVoice (来自 audit reviews fixture) |
| Audit findings 数字 (score + 痛点) | internal-audit-report.html |

### B. **SAMPLE · AI 推断 · 标 `data-od-sample="true"`**

客户没数据时 · OD 基于 **niche typical** + **商家地址** + **商家服务关键词** 推断:

| 字段 | AI infer 怎么做 |
|---|---|
| 服务列表 (客户只列 1 个) | 同 niche 同区域 typical 3-5 服务补 · roofing 默认 restoration/replacement/repair/storm/gutter |
| 评价 (0 条) | 写 3 条 plausible 同 niche 语气评价 · 用 "Sarah M." / "David L." 这种局部姓名 + 邻近 suburb · 不编完整身份 |
| Case study (无) | "1960s terracotta restoration" / "Colorbond replacement" 这种 niche typical 项目 |
| Service area (只有总部) | 商家地址 5km/10km radius suburb · ABS 数据 / Google geocode |
| FAQ | 同 niche 4-6 个最常见买家问 |
| Process | 4 步 standard (call → inspect → quote → schedule) · 可加 niche 特有步骤 |
| Trust/proof 数字 | "200+ five-star reviews" · "10-year guarantee" 等 plausible 但用 vague 量词 · 不编 "exactly 247 reviews" |

**UI 标记**: 每个 `data-od-sample="true"` 的 section · eyebrow 后加小角标 `<span class="sample-tag">Sample · editable after sign-up</span>`:
- 米橘色 · 9px mono · 不抢眼但能看见
- 客户看 demo 时知道哪些是占位
- M5 revision flow: 客户编辑这些 section 不算 revision count (鼓励改真)

### C. **不许 AI 编的具体东西** (即使标 sample 也不行)

- ❌ 具体 license / ABN 号 (没有 → 不显示 license line)
- ❌ 具体 review 姓名+完整身份 ("Sarah Mitchell, owner of Mitchell Plumbing" 不行 · "Sarah M., Wilston" 可以)
- ❌ 具体 award / certification name
- ❌ 具体 price ("$4,800–$8,500" 不行 · "Free fixed-price quote within 48 hours" 可以)
- ❌ 具体 years ("since 2014" 不行 · "established Brisbane operators" 可以) · 除非有 verifiedFacts
- ❌ 客户没有的 phone/email/address (即使标 sample 也不能编)

## LOCKED · OD 不能改

1. **Color tokens** (`:root` 里 `--bg / --surface / --fg / --muted / --border / --accent / --primary / --warm / --ink`)
2. **Font families** (Playfair Display / Inter / JetBrains Mono)
3. **Type scale** (`--fs-h1` 到 `--fs-meta`)
4. **Spacing scale** (`--gap-xs` 到 `--gap-2xl` + container/gutter/radius)
5. **Section 内部 styling** · hero gradient / service-card / quote-card / form / button / footer
6. `.topnav` + `.pagefoot` (标 `data-od-locked="true"`) · 只 swap 文字
7. **Mobile breakpoint @ 920px** + mobile-call-bar 出现机制
8. **Audit banner 视觉** · 只换文字

## FLEXIBLE · 看真客户数据自由调

每 section 标 `data-od-id="..."` · 大多数还标 `data-od-sample="true"`:

| Section | OD 能做 | Sample fallback |
|---|---|---|
| `audit-banner` | swap audit score + 3 finding | 客户无 audit → 删整个 banner (这个**确实**删 · 因为是销售 overlay · 没 audit 没意义) |
| `hero` | 改 eyebrow/H1/lead/CTA/3 proof cell · 图片 swap | 必须有 · 用 ownerVoice + niche typical hero angle |
| `services` | 卡片 3-6 · 内容自由 | 客户只列 1 → AI 补到 3-5 · 标 sample |
| `trust` | 真 reviewVoice (姓名+suburb+原话) | 客户无 review → AI 写 3 条 plausible · 标 sample |
| `projects` | 真 case study | 客户无 → niche typical case · 标 sample |
| `process` | OD 自由生成 4 步 | 同上 |
| `service-area` | 真 suburb list | 客户无 → 地址 radius 推断 · 标 sample |
| `faq` | 真 FAQ + auditPainPoints 转化 | 客户无 → niche typical 4-6 Q |
| `contact` | form 结构固定 · service options 可改 | — |

## ADD-ABLE · 真碰到新场景

客户业务 reference 没覆盖 (24/7 emergency / 商业屋顶 / solar 集成) · OD 可新建 section · 必须:

1. 用 LOCKED tokens · 不发明
2. 复用已有 building block (card / quote-card / process-card / suburb-pill)
3. 标 `data-od-new="true" data-od-new-reason="..."`
4. 默认插在 services 和 trust 之间

## OD 失败模式黑名单

- ❌ 改 `:root` 任何 token
- ❌ 换字体到 SaaS 风 (Geist / Inter display only / etc.)
- ❌ 加紫色渐变 / 任何 AI-slop 视觉
- ❌ 图片换成 SVG placeholder / picsum / placehold.co / unsplash
- ❌ 编 license / 完整 review 身份 / 具体 award / 具体 price / 具体 years
- ❌ 通用文案: "trusted partner" / "your roof deserves better" / "X years of excellence" /
  "quality you can count on" / "welcome to" / "we are committed to"
- ❌ 删 `data-od-locked="true"` 的 section
- ❌ 拆 mobile-call-bar
- ❌ 标 `data-od-sample="true"` 的 section 没在 UI 显示 sample-tag (客户看不出哪些可改)

## Round 1 提示词草稿

```
You are adapting a reference Brisbane roofing website to a specific real customer.

REFERENCE: [paste reference-site/index.html]
BOUNDARIES: [paste this file]

REAL DATA (use everywhere applicable · do not invent these):
  verifiedFacts: { businessName, phone, email, address, website, license? }
  ownerVoice: [GMB description + current site about (if any)]
  reviewVoice: [3-8 review snippets with name initials + suburb]
  auditPainPoints: [audit findings with severity]
  servicesListed: [explicit services customer mentions]
  suburbsListed: [explicit service area suburbs]

SAMPLE DATA (AI infer when customer data missing · mark data-od-sample="true" + sample-tag):
  servicesInferred: [niche typical for roofing in customer's region]
  reviewsInferred: [3 plausible same-niche reviews]
  caseStudyInferred: [niche typical project]
  suburbsInferred: [5-15km radius from customer address]
  faqInferred: [4-6 niche typical buyer questions]

OUTPUT: one complete index.html
  - REAL data wherever available
  - SAMPLE data filling all other sections (NEVER empty sections · NEVER omit)
  - sample-tag visible on every data-od-sample section
  - LOCKED tokens unchanged
  - No phrases from failure-mode blacklist
```

## 图片清单 (告 Matthew)

**Have (`assets/` 5 张)**:
- `hero-premium-roof-blue-hour.jpg` — US Victorian + 脚手架 · **该换** · 要 Australian Queenslander/brick 黄昏屋顶
- `service-roof-repair-flashing-detail.jpg` — 屋脊瓦特写 · 还行
- `service-roof-installation-detail.jpg` — 材料铺装特写 · 还行
- `about-roofer-working-roof-frame.jpg` — 工人在屋架上 · 还行
- `project-before-after-roof-transformation.jpg` — 单张材料图 · **该换** · 要真 before/after split

**v2 改的 hero gradient 减淡 30%** · 现有 hero 图能看见了 · 但内容仍是错的 (US 建筑 vs Brisbane 屋顶)。

→ round 1 跑之前 · Matthew 决定: 用现有跑 (我倾向 · 别等图) · 或先换 hero + project 2 张再跑。

## 文件清单

```
reference-site/
├── index.html              · v2 · 加 sample-tag + 减淡 hero overlay
├── HANDOFF-BOUNDARIES.md   · v2 · 这份 · sample data 哲学
├── desktop.png · mobile.png · 待重截
└── assets/                 · 5 .jpg
```
