# SOP · Single-Page AU Local-Trade Website Standard

> **Owner**: Matthew (待签字) · **Author**: Claude (synthesis 2026-05-27) · **Reviewer**: Codex gpt-5.5 (7-question independent review · 3 corrections accepted)
> **Status**: v0.2 · DRAFT post-codex · awaiting Matthew sign-off → v1.0 canonical
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

## 1 · Target persona (我们服务谁 · 5-second test)

```
访客类型         · AU residential 业主 / 商业物业经理 (60% / 40%)
搜索来源         · Google Maps + Google Search ("roofer ballarat" / "emergency plumber brisbane")
设备            · 70% mobile (Android > iOS · 30% desktop)
意图阶段         · 比较 3-5 家 · 找一家打电话 · NOT browse
扫读时间         · 8 seconds 决定留下/退出
决策驱动         · 1. 看起来正经 (license badge · 真照片) 2. 能立刻联系 3. 服务覆盖我所在 suburb
失败的访客行为   · 退出后再也不回 · 不会"再看一眼"
```

每条 single-page 规则都问自己: **8 秒之内能让该访客决定"打电话"吗？**

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

### 4.4 · No-obligation quote pattern (AU 文化降 friction)

```
form area sentence   · "no obligation · usually quoted within 24 hours"
hero副本               · 可含 "free quote" / "no obligation"
NEVER "starting from $X" · 真实 trade 价格 site-by-site · 写死会 misrepresent
```

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

niche: roofing | plumbing | electrical | ...
niche_detail:
  urgency_mix: emergency-heavy | mixed | scheduled-heavy   # → audit §4.5 tone
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
