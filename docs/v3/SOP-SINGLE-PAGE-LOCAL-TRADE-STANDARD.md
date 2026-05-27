# SOP · Single-Page AU Local-Trade Website Standard

> **Owner**: Matthew (canonical sign-off pending) · **Author**: Claude (synthesis 2026-05-27) · **Reviewer**: Codex gpt-5.5 (7-question independent review · 3 corrections accepted) · **PM-approved**: Codex 2026-05-28 v1.0-RC
> **Status**: **v1.0-RC** (codex-approved · proceed with implementation · Matthew sign for final canonical)
> **Scope**: 单页面 (single .html) 给 AU 本地 trade 商家 (roofing / plumbing / electrical / etc.)
> **Parent**: `SOP-AUDIT-STANDARD.md` v3 · 此 SOP 不替换 · 仅添加 single-page 专属规则
> **Sibling**: `V2-PIPELINE-RECIPE-2026-05-21.md` 管 multi-page recipe · 此 SOP 管 single-page

---

## 0 · 为什么需要单独的 single-page 标准

现有 v3 框架是 **multi-page-first** (home 12 blocks · service detail 9 · about 12 · contact 6)。Single-page 在我们 pipeline 里出现于:
- 数据 YELLOW 的客户 (data-checkpoint 不到 multi 门槛)
- 客户预算 < $2k 的 entry tier
- Emergency-niche (24/7 trades · 内容深度低于 multi 门槛但 conversion 需求高)

把 multi-page 标准压扁到单页 = **3 个失败模式**：
1. 字数 (multi 总 ≥4400 字 → 单页全塞 = 视觉灾难)
2. Section sequence (multi 跨 4 页分散 trust signals → 单页必须前 200vh 集中)
3. Conversion architecture (multi 用 contact.html 收 form → 单页必须 sticky mobile CTA + ≥3 个 phone tel:)

⇒ Single-page 是不同物种 · 需要自己 SOP。

---

## 1 · Audience reframe · we serve the trade owner's customer (4 buying-intent segments)

> **Canonical insight (Codex Round 11 · 2026-05-28)**: **Template quality is judged by the trade owner · website performance is judged by the trade owner's customer.** Both judgements must pass · they are NOT the same audit.

Earlier drafts of this SOP described "AU residential 业主 / 商业物业经理" as one persona. That collapses four very different jobs-to-be-done into a single fold and produces sites that serve nobody well (see `AU-ROOFER-MARKET-MEDIOCRITY-NOTES.md` §2 · market floor 2.7-5.0/10 across segments). We split the audience into **4 buying-intent segments** and treat each as a first-class audit target.

### 1.1 · The 4 segments

Full per-segment 15-field spec (demographic · triggers · timing · information state · 5-second + 30-second signals · decision triggers · bounce triggers · time-to-decide · comparison set · job value · info sources · risk concerns · trust levers · forbidden signals · AU quirks · required/optional sections · signal weights · voice modifiers · secondary-mode representation) lives in `core/audit/personas/<segment>.js` (one file per segment · ES module · single source of truth).

| Segment id | Persona | Job-to-be-done | 5-second top-3 signals | Primary bounce reason | Time-to-decide | Job value (AUD) | Comparison set |
|---|---|---|---|---|---|---|---|
| `urgent-repair` | Sarah (35-65 · mobile-first · outer-suburban) | Stop this leak today | phone visible · same-day / emergency availability · local suburb proof | quote form required before phone · "we respond within 48 hours" | minutes to same day | $600-4.5k typical · $5-12k extended | 2-4 tabs · first credible wins |
| `planned-upgrade` | Mike (40-70 · desktop + mobile · established/acreage) | Replace / restore the roof properly | completed-work photos · restoration/replacement expertise named · credibility (licence + warranty + years + reviews) | cheap patch-repair positioning · no warranty detail · amateur photos | 3 days to 3 weeks · 48h pre-sale | $8-35k common · $40k+ large/premium | 3-5 quotes |
| `commercial-maintenance` | Karen (property mgr / facilities / strata · desktop · business hours) | Add a reliable roofer to an approved supplier list / dispatch a job | commercial / strata / real-estate work named · ABN + licence + insurance visible · quote / report pathway | residential-only emotional copy · no ABN · no email contact | 1-7 business days (small) · 2-6 weeks (panels) | $1-8k initial · $10-100k+ annual LTV | 2-4 approved candidates |
| `guided-first-time-buyer` | Tom (25-38 · mobile-heavy · growth suburbs first-home) | Figure out what's wrong · whether it's urgent · roughly what it costs | plain-language help (no jargon) · free / clear quote pathway · price reassurance ("no surprise costs") | long technical form · no price anchor · aggressive emergency tone · luxury feel | 1-5 days | $500-3.5k initial · $5-15k extended | 3-6 tabs · low confidence |

### 1.2 · Universal cross-segment requirements (Codex Q-P-3)

Two requirements every single-page MUST satisfy regardless of `primary_segment`:

1. **Visible working contact path within 5 seconds**: mobile click-to-call MUST be tappable above-fold on mobile · the audit verifies a real `tel:` link inside the first 100vh on a 390px viewport.
2. **Proof of a real local legitimate contractor**: suburb / city name + ABN + licence (state authority) + insurance + real reviews + real job photos. Missing any one of these → T1 FAIL (existing rule · not new).

### 1.3 · Scope notes

- **`insurance-claim` is a 5th segment** identified in earlier rounds (storm-damage insurance pathway · loss adjuster vocabulary · ESM photos · IAG / Suncorp partner status). Deferred to **Phase B** · do not model in personas/*.js yet.
- **`landlord-investor` · `pre-sale-staging` · `referral-warm-lead`** are **modifiers**, not segments. They overlay onto a primary segment via brief fields (e.g. `modifier_pre_sale_window_days: 14`) · do not get their own persona file.
- **Mixed-segment hierarchy** (Codex Q-P-5): see new section "Mixed-segment hierarchy" below for the chip + sticky + below-fold band protocol.

Every single-page rule from §2 onwards is judged against the `primary_segment` declared in the brief · with `secondary_segments` getting restrained representation per the mixed-segment hierarchy.

---

## 2 · Section sequence · canonical single-page flow

不是 V2-RECIPE 的压扁 · 是单页 conversion architecture:

```
┌─ HERO FOLD (0-100vh · 100% 必看) ─────────────────────────────┐
│ 1. Sticky header  (logo · tel: link · "Quote" CTA)           │
│ 2. Hero            (H1 ≤8 词 + 副本 ≤25 词 + 2 CTA + trust)  │
└──────────────────────────────────────────────────────────────┘
┌─ TRUST FOLD (100-200vh · 95% 滚到) ───────────────────────────┐
│ 3. Trust bar       (4-6 chip: years · rating · license · ABN)│
│ 4. Service list    (≥4 service tiles · each ≤15 词)          │
└──────────────────────────────────────────────────────────────┘
┌─ PROOF FOLD (200-400vh · 70% 滚到) ───────────────────────────┐
│ 5. About / story   (owner-photo · founder copy · ≤120 词)    │
│ 6. Reviews         (3-5 reviews · ≥1 mentions location)      │
│ 7. Before/After    (≥1 pair · captioned)                     │
└──────────────────────────────────────────────────────────────┘
┌─ COVERAGE FOLD (400-500vh · 50% 滚到) ────────────────────────┐
│ 8. Service area    (suburb chips ≥8 · "we cover" 句)         │
│ 9. Process / "How" (3-4 step diagram · ≤8 词 / step)         │
└──────────────────────────────────────────────────────────────┘
┌─ CTA FOLD (500-600vh · 30% 滚到 · 最后吸尾) ─────────────────┐
│ 10. FAQ            (4-6 Q · accordion · 每 A ≤40 词)         │
│ 11. CTA-band       (phone + form · "no obligation" 句)       │
│ 12. Footer         (ABN · license · 24/7 line if applicable)│
└──────────────────────────────────────────────────────────────┘
SITE-WIDE: sticky mobile bottom-bar (phone+CTA) appears @scroll>200px
```

**12 sections · 总字数 1200-1600 字** · 每 section 80-150 字 · hero 例外 (≤100 字)

---

## 3 · Hero-fold non-negotiables (8-second rule)

这是单页规则的核心 · 写进 audit T2 + T3。每条都可机械验证或用 vision LLM 验证。

| # | Rule | Threshold | Check method |
|---|---|---|---|
| **H1** | Headline 字数 (visible viewport) | **≤10 词 strict** · ≤11 仅当 owner-operator voice 触发 (含 owner name OR personal accountability copy) | grep + char count on first `<h1>` + owner-voice regex |
| **H2** | Subheadline 字数 | **≤25 词 / ≤180 chars** | grep on `<p>` next-sibling-of-h1 |
| **H3** | Trust signal in fold | **≥1**: VBA/QBCC/NSW-FT 牌号 OR ≥10yr OR ≥30 reviews OR 4.5+★ | regex match patterns |
| **H4** | Primary CTA above fold | **≥1 `<a href="tel:">` AND ≥1 quote-CTA visible <100vh** | DOM position check via vision OR semantic regex |
| **H5** | Headline contains location OR niche | **必须含 city OR service** | grep city/niche keywords (existing local_seo_present) |
| **H6** | No "we are passionate" / "leading provider" / "premium quality" | **0 命中** existing 53-forbidden + 新 9 个 single-page 专项 | content-validator extension |
| **H7** | Headline:body 字号比 | **≥1.6×** (rendered) | parse CSS `font-size` or vision |
| **H8** | Hero image present OR strong typographic mark | **EITHER `<img>` in hero OR display-serif H1 ≥56px** | DOM check |
| **H9** | First phone visible without scroll | **header `tel:` link** | DOM x-y check |

### 3.1 · Segment-aware hero overlay (Phase A Step 0 addition · 2026-05-28)

H1-H9 above are universal. The following two rules layer on top once `primary_segment` is declared:

| # | Rule | Threshold | Check |
|---|---|---|---|
| **H-seg-1** | Hero copy MUST match `primary_segment` voice | `voice_modifiers.tone` in persona file is enforced · `voice_modifiers.forbidden_phrases_extra` add to the ban list for that page only | content-validator + vision LLM tone check |
| **H-seg-2** | Emergency-availability chip above-fold when `urgency_mix` ∈ {emergency-heavy, mixed} | A restrained chip such as "Emergency leak repairs available" MUST sit above-fold even if `primary_segment` ≠ `urgent-repair` · prevents the "we only do restorations" misread for Sarah | DOM presence check + position ≤ 100vh |

H-seg-2 is the mechanism that makes mixed-mode sites still serviceable to urgent-repair traffic without disrupting the primary segment's hero dominance (see Mixed-segment hierarchy section).

**新增的 9 个 single-page-specific forbidden phrases** (扩展现有 53 ban list):
```
"we pride ourselves"
"family-owned and operated" (太泛 · 必须有具体年数代之)
"quality workmanship" (空话 · 必须有 warranty 年数代之)
"competitive prices"
"customer satisfaction guaranteed"
"no job too big or small"
"established reputation"
"trusted name"
"your local"  (单独 · 没具体 suburb)
```

---

## 4 · AU local-trade specific patterns (这是 niche specificity)

不是空泛 best-practice · 是 AU 本地 trade 实战 pattern:

### 4.1 · Phone-first conversion architecture (mobile 70% → phone > form)

```
位置                  · 内容
sticky header tel:    · 一键拨 · all-page · 跨 fold 永远 visible
hero secondary CTA    · "Call <number>" 副 button
sticky mobile bottom  · ≥200px scroll 出现 · phone+"Quote" 双 button
CTA-band before footer· phone + form 并列 · phone first
footer                · phone repeat
```
→ **phone 出现 ≥6 次** · form CTA 出现 ≥2 次 · phone:form 比 ≥ 3:1

### 4.2 · License / authority callout (AU 法律敏感)

```
显式 callout         · "VBA-licensed · CDB-U 65938" (VIC) 等
位置                  · trust bar (chip) + footer (full)
NEVER fabricate      · 没就 OMIT · per memory "license 没 highlight 不提"
state authority      · VIC=VBA · QLD=QBCC · NSW=NSW Fair Trading · WA=Building Commission
ABN                   · footer · 永不省略
```

### 4.3 · Suburb-list specificity (Google local SEO · 反 generic)

```
suburb chips ≥ 8     · 显式列 (e.g. Ballarat Central · Sebastopol · Wendouree...)
"we cover" 句        · 含 city + 半径 km
NOT "all of Victoria"· 太泛 · 反 conversion
```

### 4.4 · No-obligation quote pattern + indicative pricing (AU 文化降 friction)

```
form area sentence   · "no obligation · usually quoted within 24 hours"
hero副本               · 可含 "free quote" / "no obligation"
```

**Price disclosure (relaxed 2026-05-28 · supersedes earlier "NEVER starting from $X" hard ban):**

No fake teaser pricing. A truthful indicative range with a disclaimer IS allowed (and is REQUIRED when `primary_segment = guided-first-time-buyer`, optional otherwise). Example: "typical roof restoration: $4-12k depending on size, material, access · written quote after free inspection."

Brief schema requires explicit `pricing_disclosure_mode` (see §6) · valid values:

- `hidden` — no price hints anywhere · default for `urgent-repair` and `commercial-maintenance` primaries
- `indicative_range` — truthful $low-$high range with disclaimer · REQUIRED for `guided-first-time-buyer` primary
- `per_quote_only` — explicit "per-quote · varies by site" copy without numbers · OK for `planned-upgrade` primary

Banned regardless of mode: "starting from $X" without a stated ceiling · single-anchor pricing that misrepresents the realistic range.

### 4.5 · Emergency vs scheduled distinction (niche 决定调性)

```
emergency-heavy (storm/leak/blocked-drain) → hero 写紧迫 · 24/7 line 突出
scheduled-heavy (restoration/renovation)   → hero 写质感 · warranty 突出
```
→ data-checkpoint 时 extract `urgency_mix` field · brief 用之 · audit 用之。

---

## 5 · Single-page word budget · 跟现有 SOP-AUDIT T2 兼容

现 SOP-AUDIT T2 假设 multi-page · single-page 用此覆盖:

| 维度 | Single-page 目标 |
|---|---|
| 整页总字数 | **1000-1400 字** (≤1000 SEO-content 嫌疑 · ≥1400 mobile 疲劳 · single-page sweet spot) |
| Hero section 字数 | H1 ≤10 词 + 副本 ≤25 词 + 2 chip + 2 CTA = **≤80 词** |
| 每非-hero section | 80-150 字 (≥80 = 实质 content · ≤150 = mobile 不挤) |
| Section 数 | 9-12 (per §2 sequence · 不能跳 hero / trust / cta) |
| Reading time (Flesch) | **≥70** (容易读 · 本地业主 ≠ technical 受众) |
| Paragraph 句数 | **≤4 句** (现 content-validator 已 enforce) |
| 一句字数 | **≤24 词** (mobile 行宽限制 · 新增规则) |
| CTA 词数 | **≤5 词** (现 content-validator 已 enforce) |

---

## 6 · Input contract (brief intake → 这就是 audit 要验的)

为了让 audit 跟 brief 用同 vocab · 每个 single-page 客户 brief 必须含:

```yaml
# clients/<slug>/v2/single-page-brief.yml
business_name: ...
phone: ...                        # → audit H4 (sticky tel:)
phone_display: "0403 554 592"     # → render tel: link
address: ...                      # → audit T1.3
abn: "XX XXX XXX XXX"             # → audit footer · niche compliance
state: VIC                         # → audit T1.5 state authority
license:
  authority: VBA | QBCC | NSW-FT | ...   # → audit H3
  number: "CDB-U 65938"                  # → audit H3 + footer
  status: active | grey-zone | omit      # → audit T1.5 fabrication ban

# --- Buyer-segment fields (Phase A Step 0 · 2026-05-28) ---
primary_segment: planned-upgrade  # REQUIRED · enum [urgent-repair · planned-upgrade · commercial-maintenance · guided-first-time-buyer · mixed-not-allowed]
                                  # · mixed-not-allowed means "we tried but the business genuinely serves multiple equally · pick one as primary"
                                  # · Default when brief is ambiguous: planned-upgrade (codex Q-P-1)
secondary_segments:               # OPTIONAL · array<enum> excluding mixed-not-allowed · each gets restrained representation (mixed-segment hierarchy)
  - urgent-repair                 # · Default secondary alongside default planned-upgrade primary: [urgent-repair]
pricing_disclosure_mode: hidden   # REQUIRED · enum [hidden · indicative_range · per_quote_only]
                                  # · indicative_range REQUIRED if primary_segment = guided-first-time-buyer
emergency_response_sla_hours: 2   # PRESENT_OR_ABSENT (number · null when scheduled-heavy)
                                  # · When present + ≤24 → enables H-seg-2 chip + emergency hero variants

niche: roofing | plumbing | electrical | ...
niche_detail:
  urgency_mix: emergency-heavy | mixed | scheduled-heavy   # → audit §4.5 tone · drives H-seg-2 chip requirement
  service_radius_km: 50
  years_in_business: 22                                    # → audit H3
  warranty_years: 10                                       # → audit H6 (replaces "quality workmanship")

trust_signals:                    # → audit H3 ≥1 required
  - "VBA-licensed since 2003"
  - "4.1★ on Google (18 reviews)"
  - "22+ years in Ballarat"

suburbs_covered:                  # → audit §4.3 ≥8 required
  - Ballarat Central
  - Sebastopol
  - ...

services:                         # → audit §2 service list ≥4 tiles
  - { name: "Colorbond replacement", short: "...", icon: ... }
  - ...

reviews:                          # → audit §2 reviews ≥3 · ≥1 mentions location
  - { name: "Sarah K.", location: "Sebastopol", text: "..." }
  - ...

hero:                             # ← 这里就是 hero-fold spec
  headline: "A Ballarat roof, done properly — and signed off in writing."  # → audit H1 ≤8 词
  subhead: "VBA-licensed roofers covering Colorbond ... Ballarat since 2003."  # → audit H2 ≤25 词
  primary_cta: { label: "Request a written quote", href: "#quote" }
  secondary_cta: { label: "Call 0403 554 592", href: "tel:+61403554592" }
  trust_chips: ["VBA Licensed", "22+ Years", "10-Year Warranty", "4.1★ Google"]

emergency_phone: null | "1300..."  # → audit §4.5 if urgency-heavy 必有

photos:                           # → audit §2 before/after ≥1 pair
  - { type: "before-after", before: "...", after: "..." }
  - ...

forbidden_keywords_audit_overrides: []   # 客户允许的"family-owned"豁免
```

**Pre-render gate** (新 CLI): `pl:validate-single-page-brief --slug X` · 校验 brief 满足 §3 H1-H9 数据要求 · fail → 不让进 render。

---

## 7 · Audit extension · 单页专属 T2 dims

现 T2 9 dims 兼容 · 加 4 个 single-page 专属:

| Dim | 权重 | Threshold | Check |
|---|---|---|---|
| **D2.S1 Single-page section sequence** | 8% | 12 sections 缺 ≤2 · sequence 顺序对 | DOM section-by-section |
| **D2.S2 Hero-fold 9 rules** (§3 H1-H9) | 12% | 9 条 ≥7 pass | 机械 + vision |
| **D2.S3 Phone:form ratio + count** (§4.1) | 5% | phone ≥6 · form ≥2 · ratio ≥3:1 | regex `tel:` + form attr |
| **D2.S4 AU pattern compliance** (§4.2-4.5) | 5% | license callout + suburb ≥8 + no-obligation + urgency-correct tone | regex + niche keyword |

D2.S2 是最重要的 · 单独可让站 PASS/FAIL gate (≥7/9 才 ship)。

---

## 8 · 与现有 SOP / code 的对账 (writer ownership)

| 概念 | Single source-of-truth | This SOP 引用方式 |
|---|---|---|
| 4-tier audit framework | `SOP-AUDIT-STANDARD.md` | reference · don't duplicate |
| Multi-page block flow | `V2-PIPELINE-RECIPE-2026-05-21.md` | reference · 此 SOP 管 single-page · sibling |
| Hard data fields | `SOP-DATA-CHECKPOINT.md` | reference · §6 input contract 引用 |
| Forbidden phrases | `core/eval/content-validator.js` FORBIDDEN_PHRASES | extend · §3 加 9 项 single-page-specific |
| License rules | `scripts/cli/pl-license-lookup.js` + memory entry | reference · §4.2 引用 |
| Audience profile | `M2-D9-CUSTOMER-AUDIENCE-REPORT.md` | reference · §1 persona 借鉴 customer audience |
| Visual audit dims | `core/llm/visual-audit-prompt.js` | extend · §7 D2.S2 vision-LLM 部分用现有 dim |
| Brief intake schema | (new) `core/handoff/single-page-brief-schema.js` | new SSOT · §6 是规范 |

**没新 writer** · 全部 extend / reference 现有 owner · 符合 CLAUDE.md §6 SSOT-Writer rule。

---

## 9 · Validation plan (在 sign off 之前)

把这个 SOP 应用回 vicwest / mark-squire / a-j (我们已渲染的 3 个 single-page):

| Site | Audit 跑 §7 D2.S1-S4 | 预期 fail 项 (验证我 SOP 真的诊断问题) |
|---|---|---|
| vicwest | T2 single-page audit | H1 = 10 词 (fail · need ≤8) · forbidden "signed off" 可能 ban · section sequence 缺 process/service-area |
| mark-squire | 同上 | H1 = 11 词 (fail) · "the man whose name is on the truck" 是 good copy 但超 8 词 → 可能要 H1 调整规则 (兼顾 voice) |
| a-j | 同上 | H1 = 11 词 + italic 副词 (fail) · suburb list ≤ 8 (fail · INFERRED 不应补假 suburb · 该 OMIT 而非 fabricate) |

跑完 3 站 audit · 真发现规则有缺漏:
- 也许 H1 应该是 **≤10 词** · 而不是 ≤8 (Matthew 实际感受是"字多了" 不是"字限死")
- 也许 italic accent in headline 应该是 exception (mark-squire / a-j 都用了 · 是 voice 而非 violation)
- 也许 suburb chip 没 8 个时 · INFERRED 站点不该硬补 · 应触发 brief-fix-instruction 而非 violation

**iterate to v0.2 后** · Matthew 签字 · 进 canonical。

---

## 10 · 不做什么 (反约束)

- ❌ 不重写 SOP-AUDIT-STANDARD v3 · 那是 multi-page parent · 此 SOP 单子专项
- ❌ 不为 single-page 单独建一套 audit-tier CLI · pl:audit-v4 + 新增 dims 即可
- ❌ 不让 LLM 决定 brief 该有什么字段 · §6 schema 是 hard contract
- ❌ 不允许 "single-page 灵活 · 标准可绕" · 这条标准就是为了 batch 交付时不每个客户重新 design
- ❌ 不引入 mobile-specific 跟 desktop-specific 不同标准 (mobile-first · desktop 兼容)
- ❌ 不让 audit fix loop 替代 brief 补强 (brief 没数据 = 不该上 audit · pre-render gate 截)

---

## 11 · 文件清单 / 落地动作

实施这个 SOP 需要:

1. **(this file)** `docs/v3/SOP-SINGLE-PAGE-LOCAL-TRADE-STANDARD.md` ← 此 SOP 本身
2. `core/handoff/single-page-brief-schema.js` ← §6 schema (JS or YAML validator)
3. `scripts/cli/pl-validate-single-page-brief.js` ← pre-render gate
4. `scripts/cli/pl-audit-v4.js` 扩展 ← §7 4 dims (D2.S1-S4)
5. `core/eval/content-validator.js` 扩展 ← §3 加 9 forbidden phrases
6. Validation runs ← §9 跑 3 站 · 拿真 audit 输出 · iterate SOP 到 v0.2

---

## 12 · Decisions (v0.2 · post-codex review · awaiting Matthew sign-off)

Codex (gpt-5.5 · independent review) 跟我 review 后所有 7 题确定。3 处 codex 比我更严更对 · 已采纳。

| Q | Decision | Rationale | Risk if wrong |
|---|---|---|---|
| **Q1 H1 字数** | **≤10 词 strict · ≤11 仅 owner-operator voice exception** (含 owner name OR personal accountability copy 如 "name is on the truck") | ≤8 会把 mark-squire 这种 owner-led trades 扁平成 generic SEO headline · ≤10 保留 memorability 但仍快 scan | 太严 = 好 copy 被砍 · 太松 = mobile 8s 决定时间崩 |
| **Q2 Italic H1** | **允许 · 仅高亮 1 个 scannable 概念** (season name / suburb / trade name / owner name) · 禁止装饰性 italic | Italic 作 visual anchor 加速 meaning · 装饰性 italic 才慢 scan | 全禁 = 失 brand texture · 全允 = AI default 又出来 |
| **Q3 Suburb chips** | **hard fail upstream** · 不容忍 fabrication · INFERRED 客户必须 onboarding 补 | 编造 suburb = 破坏 anti-fabrication SOP 核心 · 让 pipeline 学会"低 trust lead-gen spam"形态 | 软 render = preview 含未验证 local 声明 · 法律 + 商誉 双风险 |
| **Q4 Emergency phone** | **required + nullable in brief schema** · `urgency_mix` 决定 null 是否合法 (scheduled-heavy 可 null · emergency/mixed 必须填) | 每客户必须显式答 · 但 scheduled trade 不被迫扯 24/7 | niche-only 自动会 misclassify (roof restoration 也偶有 storm 事) |
| **Q5 Phone ≥6** | **≥6** (sticky header + mobile bottom + hero secondary + CTA-band + footer + contact area) | AU mobile-first trade · phone-led · 6 不多 | ≥4 = 视觉精美但 buying action 被埋 |
| **Q6 总字数** | **1000-1400 字** | <1000 SEO-content 嫌疑 · >1400 mobile 疲劳 · 1000-1400 是 single-page sweet spot (codex 纠 v0.1 的 1200-1600) | 太短 = generic · 太长 = SEO content 而非 call-ready trade profile |
| **Q7 Pre-render gate** | **hard fail pipeline** (memory hard rule "数据不够直接 skip" 一致) | license + suburbs + urgency + phone + ABN + authority 是 source-of-truth · 不让 renderer / audit-loop 编 | soft warn = INFERRED 渗进 preview · normalize 上线 unverifiable local claims |

**v0.3 落地清单 (Matthew 签字后)**:
1. `core/handoff/single-page-brief-schema.js` — §6 schema · `emergency_phone` required+nullable · `urgency_mix` enum · suburbs ≥8
2. `scripts/cli/pl-validate-single-page-brief.js` — hard-fail gate · `--slug` mode
3. `scripts/cli/pl-audit-v4.js` 扩展 D2.S1-S4 (含 H1 owner-voice exception 检测)
4. `core/eval/content-validator.js` 加 9 new forbidden + 1 句 ≤24 词 rule
5. Validation: 跑 3 站 · 看真分 · iterate
6. Update memory: 加 lesson "OD skills/ 全是 catalog-only · 不是 bundled · upstream-only" 防下次再误判

---

## 13 · T5 audit dim · Per-Segment Serviceability (Phase A Step 0 · 2026-05-28)

T1/T2/T3/T4 from `SOP-AUDIT-STANDARD.md` v3 are unchanged. **T5 is new** · it asks the question: **does the fold actually serve `primary_segment`'s job-to-be-done in 5 seconds?**

### 13.1 · Hybrid scoring (Codex Q-Z-2 · deterministic + vision)

T5 runs in two passes:

**Pass 1 — Deterministic gates (0 LLM · CI-cheap)**

For the declared `primary_segment`, every `critical_signals_5_second[].deterministic_check` (defined in `core/audit/personas/<segment>.js`) MUST pass. Each is a presence / regex / DOM-position check. Examples:

| primary_segment | Hard deterministic gate (above-fold) |
|---|---|
| `urgent-repair` | `emergency_response_sla_hours` visible OR "24/7" / "same-day" / "emergency" in fold |
| `commercial-maintenance` | ABN visible in fold (text or chip) · "commercial" / "strata" / "real estate" / "property manager" in fold |
| `guided-first-time-buyer` | `pricing_disclosure_mode = indicative_range` rendered as visible range OR "no surprise" / "upfront pricing" copy in fold |
| `planned-upgrade` | Genuine completed-work photo in or adjacent to hero (NOT lifestyle stock · NOT generic suburb home) · "restoration" OR "replacement" OR "re-roof" in fold |

Plus the universal cross-segment gates (§1.2): `tel:` link tappable on a 390px viewport within first 100vh, real-trade-context image, ABN + licence + insurance + suburb proof somewhere on page.

Failing any primary-segment deterministic gate → **T5 FAIL for that page** · no T5 score is computed · the audit reports the missing gate + the persona file line that defines it.

**Pass 2 — Vision LLM (tone / fit · ~$0.05/page)**

When all deterministic gates pass, a single vision-LLM call scores per-segment fold serviceability 0-100. Prompt asks: *"Imagine you are <persona display_name>, <demographic short-form>, with the job-to-be-done '<job_to_be_done>'. You see this fold for 5 seconds on a 390px mobile screen. Does it serve your job? Score 0-100 using these weights: <signal_weights from persona file>. Cite which signals you saw / didn't see."* The prompt embeds `signal_weights` from the persona file as the rubric · so the LLM is grading against the persona spec, not its own taste.

### 13.2 · Composite + ship gate

```
primary_segment score weight       · 50%
each declared secondary_segment    · 15% each
unrepresented (other 2-3) segments · 5% each (anti-pattern detector · not aspirational)
```

**Final ship gate (codex Round 12 pin · supersedes earlier "composite ≥73" alone):**

```
T1 PASS
+ T2/T3/T4 composite ≥73
+ T5 primary_segment ≥75
+ all declared secondary_segments ≥50
→ ALLOW SHIP
```

A page that scores T2/T3/T4 composite = 80 but T5 primary = 60 does NOT ship · we have a beautifully audited page that does not serve its declared buyer. That is the bug T5 catches.

### 13.3 · Persona file is the SSOT for this dim

`core/audit/personas/<segment>.js` is the single source of truth for:
- which deterministic gates exist for each segment
- which sections are required vs optional for each segment (`required_sections` / `optional_sections`)
- which signals are weighted how much by the vision LLM (`signal_weights`)
- which forbidden phrases extend the global ban list when the segment is primary (`voice_modifiers.forbidden_phrases_extra`)
- secondary-mode chip / sticky / band copy (`secondary_representation`)

T5 implementation MUST NOT redefine these · only read them. Writer ownership stays in `personas/*.js`.

---

## 14 · Mixed-segment hierarchy (Codex Q-P-5)

Some trade businesses genuinely serve a mixed audience — e.g. ~60% planned-upgrade + ~30% urgent-repair + ~10% commercial. The site MUST commit to one **primary** but represent secondaries in restrained, hierarchy-controlled ways. We never run tabbed switchers or multiple hero variants.

### 14.1 · The three secondary surfaces

For each segment listed in `secondary_segments[]`, the page renders that segment's `secondary_representation` block from its persona file across three controlled surfaces:

| Surface | Position | Source | Constraint |
|---|---|---|---|
| **Fold chip** | Trust-bar row (top of trust fold · ≤120vh) | `secondary_representation.fold_chip` | One chip per secondary segment · max 2 secondary chips in fold · primary visual weight dominates |
| **Mobile sticky CTA** | Sticky bottom bar (appears @ scroll > 200px) | `secondary_representation.mobile_sticky` (neutral copy · no urgency dominance) | When secondaries include `urgent-repair`, mobile sticky stays neutral ("Call roofer") · never "CALL NOW EMERGENCY" |
| **Below-fold dedicated band** | Between service-list and reviews (or after process · before cta-band) | `secondary_representation.below_fold_band` | One band per secondary segment · ≤80 words · sits below primary's content territory · never above the primary's call-to-action |

### 14.2 · Hard rules

- **Hero dominates for the primary**: the hero (H1 / subhead / primary CTA / hero image) is single-purpose, single-segment. No A/B in the hero · no carousel · no tabbed switcher. The primary persona's `signal_weights` set the hero composition.
- **Never multiple hero variants**: not even seasonal variants. One hero · the primary.
- **No "switcher" affordance**: do not invite the visitor to declare their segment. The site identifies the primary and serves secondaries through restrained ambient signals.
- **Emergency overlay still applies**: H-seg-2 (§3.1) ensures urgent-repair-style traffic is not abandoned when `urgency_mix` ≠ scheduled-heavy, regardless of whether `urgent-repair` is in `secondary_segments[]`. The emergency chip is the floor · the secondary band is the additional surface.
- **Three secondaries max** (because four would render the four segments equally and contradict "primary dominates"). If a brief lists three, the third gets ONLY the below-fold band — no fold chip — to preserve fold visual weight.

### 14.3 · Audit consequence

Mixed-mode sites are scored exactly like single-primary sites under T5 (§13.2 composite formula). Adding a secondary does not relax the primary's threshold · it only allocates 15 weighted points to that secondary's 5-second serviceability check.

---

## 15 · Additional LBP rules (Phase A Step 0 · from market mediocrity browse)

Extension of the existing Local Business Patterns (LBP-1..10). Numbers picked up from `AU-ROOFER-MARKET-MEDIOCRITY-NOTES.md` §3.

| # | Rule | Threshold | Notes |
|---|---|---|---|
| **LBP-11** | Supplier / material partner logo wall | `present_or_absent` · 3-6 logos when applicable (e.g. BlueScope · Colorbond · iFOLD for roofing) | Trust-by-association · proves real trade supply chain (not backyard). Skip cleanly if not applicable to niche · do not fabricate. |
| **LBP-12** | Real-trade-context photo in hero | Hero image MUST be authentic trade context (real worker / real completed roof / real site) · NOT lifestyle stock · NOT generic suburb home shot | This is the rule iFix Roofing gets right and the rest of the market floor fails. Honest placeholder per banner protocol if no real photo available. |
| **LBP-13** | Testimonial date or recency reference | Each visible review carries a date OR a relative recency phrase ("April 2024" / "earlier this year") | Strengthens LBP-10 (name + suburb + service). Recency = anti-fabrication signal. |
| **LBP-14** | GBP-website hours consistency | `openingHoursSpecification` JSON-LD MUST match the Google Business Profile hours · audit fetches GBP hours and diffs | Especially load-bearing for `urgent-repair` primaries claiming "24/7" — if GBP says 9-5, the site is lying. |

---

## 16 · Additional anti-patterns (AS-trade-1..8 · market floor catalogue)

Tonight these live here as canonical references. They are wired into the executable detector when `pl-anti-slop-catalog` skill is built (Step 3 · not this sub-task). Until then, audit can grep for them as a soft warning.

| ID | Anti-pattern | Source |
|---|---|---|
| **AS-trade-1** | Hero copy = business name only (e.g. just "iFix Roofing" · no value prop) | iFix Roofing observed 2026-05-28 |
| **AS-trade-2** | "Your company for [niche] [city]" SEO-stuff hero | Roof Repairs Brisbane observed 2026-05-28 |
| **AS-trade-3** | "The above your head specialists" vague-clever tagline pattern (any niche-equivalent vague metaphor) | iFix Roofing observed 2026-05-28 |
| **AS-trade-4** | Service tile with dramatic lifestyle stock photo (guy-with-bucket caught-leak shot · etc.) | Roof Repairs Brisbane / Mr Roof observed 2026-05-28 |
| **AS-trade-5** | Form with ≥5 fields above-fold AND Address field required before lead capture | Roof Repairs Brisbane observed 6 fields |
| **AS-trade-6** | "Operated by [parent company]" hero subtitle leak (B2B template residue) | observed across template-share sites |
| **AS-trade-7** | "Competitive prices" in any hero copy | Roof Repairs Brisbane observed 2026-05-28 |
| **AS-trade-8** | "Get in Touch" / "Contact Us" / "Call Us Today" as primary CTA text (already banned regex · explicitly catalogued here) | all 3 market floor sites observed |
