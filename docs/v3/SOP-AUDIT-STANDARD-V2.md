# SOP · Audit Standard v2 · ProfitsLocal · 2026-05-28

> **Status**: canonical · sign-off via codex Rounds 26 + 27 + 28 (25 questions / 0 unresolved · ≥95% consensus).
> **Replaces (as primary forward doc)**: `docs/v3/SOP-AUDIT-STANDARD.md` (v3 · now frozen as legacy_baseline · DO NOT EDIT · reference only for regression / calibration lineage).
> **Subsumes**: `docs/v3/ADR-AUDIT-V4.md` experimental notes.
> **Audience**: every CLI that audits a customer website · every agent that touches audit logic · every Phase B step.

---

## §0 · Vision

ProfitsLocal ships single-page roofing websites that convert AU homeowners into paying leads. The audit decides ship / fix-loop / reject. **Without a correct audit · everything downstream is theater.** This SOP is the contract.

### Matthew's 5 P0 priorities (verbatim · canonical)

1. **文案质量** (copy quality · positive prose · persuasion · NOT just absence of bad)
2. **内容准确性** (content accuracy · facts match SSOT · 0 fabrication · legal-safe)
3. **内容丰富度** (content richness · density · proof variety · concept depth)
4. **设计风格统一性** (design style consistency · typography · spacing · cross-page)
5. **品牌保持度** (brand fidelity · real logo · brand-tokens honored · palette match)

Out of scope (P1 · deferred): raw performance numbers · SEO ranking · AI-GEO crawler ranking.

---

## §1 · Pipeline placement

```
DISCOVERY → ENRICHMENT → BRIEF → WIREFRAME → RENDER → ⛳ AUDIT v2 (THIS SOP) → OUTREACH
```

Audit v2 runs **post-render** · **pre-publish** · **gates outreach**. The audit IS the ship/no-ship contract.

---

## §2 · 5 P0 capability framework + composite formula

### Composite (codex R28 Q-II-5 weights)

```
T1 PASS required (any T1 FAIL → composite = 0 · ship_verdict = BLOCKED)

composite_v2 = (
    0.25 * P0_content_accuracy +
    0.25 * P0_copy_quality +
    0.20 * P0_brand_fidelity +
    0.15 * P0_content_richness +
    0.15 * P0_design_consistency
)
```

**Mobile veto layer** (§4) sits OUTSIDE composite · veto trumps any score.

### Per-P0 score derivation (which dims feed which P0)

```
P0_copy_quality       = weighted_avg(
    D2.4_codex_factual,           # existing codex-deep-audit D1
    D2.5_codex_voice,              # existing codex-deep-audit D2
    D2.6_codex_specificity,        # existing codex-deep-audit D3
    D2.10_engagement_persuasion,   # NEW · extends codex-deep-audit with D6 positive signal
    T4d_voice_deterministic        # existing · banned phrases · AU spelling
)

P0_content_accuracy   = T1_PASS_required AND (
    D2.9_hallucinations_count = 0 AND
    D2.11_facts_cross_check    >= 90    # NEW · HTML-extracted facts vs brief.yaml exact match
    # D2.12_facts_upstream_validation deferred · gates first paying client (§13)
)

P0_content_richness   = weighted_avg(
    D2.1_per_section_word_count,   # extends T2 D2.1 from page-total to per-section
    D2.7_cross_page_uniqueness,    # existing
    D2.13_section_concept_density, # TRULY NEW · LLM lists distinct idea/section
    D2.14_proof_variety            # NEW · CSS-selector counts of {review, stat, case_study, quote, cert, photo} ≥3 types
)

P0_design_consistency = weighted_avg(
    D3.4_chrome_consistency,       # existing byte-diff
    D3.6_typography_hierarchy,     # existing (≥4 tiers · ≥30% size diff)
    D3.8_layout_rhythm,            # existing (8px grid · variance ≤16px)
    D3.10_optical_consistency,     # NEW · LLM vision · baseline alignment + micro-spacing + hero shape
    M1_mobile_hero_readability,    # NEW · scored mobile (hybrid · §4)
    M1_mobile_above_fold_trust_cta # NEW · scored mobile
)

P0_brand_fidelity     = weighted_avg(
    D2.BC1_var_coverage_brand,     # existing v4 D2.1 (var coverage all colors)
    D2.BC2_hex_count,              # existing v4 D2.2 (hardcoded hex ≤ N)
    D2.BC3_font_compliance,        # existing v4 D2.3
    D2.BC5_palette_honored,        # existing v4 D2.5 (brand-spec hex matches CSS)
    D2.BC6_token_coverage_depth,   # NEW · extends D2.1 · splits radius/shadow/spacing/motion
    D2.BC7_logo_variant_per_surface # NEW · implements existing v4 D2.4 TODO (line 315)
)
```

### Ship verdict logic

```
if T1.fail:
    composite = 0
    verdict = "BLOCKED · T1 hard fail"

elif mobile_veto.any:
    composite = computed_score  # show what could have been
    verdict = "BLOCKED · mobile veto (" + veto_reason + ")"

elif all 5 P0 hard gates pass AND composite >= 80:
    verdict = "SHIP"

elif composite >= 60:
    verdict = "FIX_LOOP"   # pl:iterate-site · max 3 rounds

else:
    verdict = "REJECT"     # re-do brief / re-render from scratch
```

---

## §3 · Per-P0 hard gates (calibration-anchored · §10)

**Provisional thresholds** (to be replaced by calibrated values · §10):

| P0 | Hard gate | Note |
|---|---|---|
| copy_quality | ≥ 75 AND T4d_voice ≥ 80 | T4d as compound check |
| content_accuracy | T1 PASS AND D2.9 = 0 AND D2.11 ≥ 90 | accuracy is binary-ish · facts either match or don't |
| content_richness | ≥ 70 AND D2.14 ≥ 3 proof types | richness has minimum diversity |
| design_consistency | ≥ 70 AND D3.4 PASS | chrome byte-diff is hard constraint |
| brand_fidelity | ≥ 80 AND D2.BC7 PASS | logo on wrong surface = brand fail |

**Calibration override** (per §10): final thresholds = `Phase3_vicwest_baseline - 5 pts` per P0. Provisional values are placeholders pending calibration runs.

---

## §4 · Mobile veto rules (hybrid · codex R27 Q-HH-2 + R28 Q-II-3)

Mobile is NOT a 6th P0 capability. Mobile is a hybrid:

- **Mechanical mobile checks → VETO (hard ship blocker)**
- **Vision mobile quality checks → SCORED into design_consistency P0**

### Veto list (mechanical · deterministic · any single failure = SHIP BLOCKED)

| Check | Method | Veto trigger |
|---|---|---|
| M1.1 viewport overflow-x at 390px | Playwright render · scroll width > 390 | ANY overflow > 0px |
| M1.2 sticky CTA visible at mobile | Playwright + CSS scan for `position:fixed/sticky` + bottom CTA | ABSENT |
| M1.3 critical tap target ≥ 44×44px | CSS computed-style scan of `.btn-primary`, `nav a`, form inputs · `<a href="tel:">`, `<a href="mailto:">` | ANY critical target < 44px |

**Tap target nuance** (codex R28 Q-II-3): only **critical CTA/nav/form/contact** controls veto. Incidental UI elements < 44px → warning · not veto. Critical list locked in `core/audit/mobile/critical-selectors.json` (read at audit time).

### Scored list (vision LLM · feeds design_consistency P0 score)

| Check | Method | Score range |
|---|---|---|
| M1.4 hero readability at 390px | LLM vision: line height · font size · contrast | 0-100 |
| M1.5 above-fold trust + CTA presence at 390px | LLM vision: first 600px height contains ≥1 trust signal + ≥1 CTA | 0-100 |

---

## §5 · Audit tier separation (codex R26 Q-GG-6 + R28 Q-II-7)

**Two audit tiers · their scores NEVER mixed as equivalent.**

### Fast tier · $0 · deterministic only · CI / pre-commit / iteration loop

- T1 hard mechanical checks
- T2 brand contract (D2.BC1-BC5)
- D2.BC6 token coverage depth
- D2.BC7 logo variant per surface
- D2.11 facts cross-check
- D2.14 proof variety
- T4d voice deterministic (AV-1/4/6)
- M1.1 / M1.2 / M1.3 mobile mechanical vetos
- D3.4 / D3.6 / D3.8 design mechanical

Output: `audit-v4-fast-{full,issues,summary}.json` · ~200ms total · $0

### Premium tier · ~$1.5 LLM · ship gate / outreach approval / sales review

- All fast-tier dims (re-run)
- D2.4 / D2.5 / D2.6 codex-deep-audit LLM dims (existing)
- D2.10 engagement-persuasion (NEW · extends codex)
- D2.13 section concept density (TRULY NEW)
- D3.10 optical consistency (NEW · extends pl-audit-vision)
- M1.4 / M1.5 mobile vision scored

Output: `audit-v4-premium-{full,issues,summary,trace}.json` · ~3-5 min · ~$0.50-$1.50 · includes evidence spans (§8)

### Composite separation rule

```
composite_fast    = derived from fast-tier dims only
composite_premium = derived from premium-tier dims (which include fast)
```

**Never report a single "composite" without tier label**. JSON output schema:

```json
{
  "audit_tier": "fast" | "premium",
  "audit_version": "v2.0.0-<rubric-hash>",
  "composite_fast": 82,
  "composite_premium": 89,  // only present if premium ran
  "p0_scores": { "copy": 78, "accuracy": 95, "richness": 72, "design": 81, "brand": 88 },
  "verdict": "SHIP" | "FIX_LOOP" | "REJECT" | "BLOCKED",
  ...
}
```

---

## §6 · Rubric runtime config + schema validation

### Source of truth

`skills/pl-audit-rubric/pl-audit-rubric.json` (Phase A.1 Step 3.2 · 845 lines · currently doc-only) becomes **runtime config source**:

```
pl-audit-v4 startup:
  1. read skills/pl-audit-rubric/pl-audit-rubric.json
  2. validate schema (codex R26 Q-GG-5)
  3. for each rule_id · dispatch to module via enforced_by[]
  4. compute rubric_hash (§7) · embed in every output
```

### Schema validator (mandatory · CI must pass)

`core/audit/rubric-schema-validator.js` (NEW · ~150 lines):

```javascript
validateRubric(rubric) → {
  rule_id_uniqueness: every rule has unique id
  enforced_by_resolvability: every enforced_by[] path resolves to existing CLI/module
  weight_map_completeness: every P0 has weights summing to 1.0
  scoring_anchors_present: every premium dim has anchor text
  llm_prompts_present: every premium LLM dim has prompt template
}
```

Fail → exit 1 · audit refuses to run.

### Versioned hash composition (§7)

Any edit to rubric / weights / anchors / prompts / models = new audit version.

---

## §7 · Audit version + hash schema (codex R28 Q-II-1)

Every audit output stamps `audit_version` for forensics + comparison.

### Hash inputs (sorted · deterministic)

```json
{
  "rubric_hash_inputs": {
    "schema_version": "audit-v4/0.2",
    "rule_ids": ["T1.1", "T1.2", "...", "D2.13", "M1.5"],  // sorted alphabetical
    "weight_map": {
      "copy_quality": 0.25, "content_accuracy": 0.25,
      "brand_fidelity": 0.20, "content_richness": 0.15, "design_consistency": 0.15
    },
    "scoring_anchors_md5": "<md5 of all scoring_anchors yaml>",
    "llm_dim_prompts_md5": "<md5 of all premium LLM prompts concat>",
    "models": {
      "premium_copy": "claude-sonnet-4-5",
      "premium_vision": "claude-sonnet-4-5"
    }
  },
  "rubric_hash_output": "sha256:<short-12char>"
}
```

### Audit version string

```
audit_version = "v2.0.0-" + rubric_hash_output  // e.g. "v2.0.0-a1b2c3d4e5f6"
```

Changing ANY hash input → version bumps · old vs new audits non-comparable without explicit normalization.

---

## §8 · Evidence spans + confidence (codex R28 Q-II-2)

### Premium LLM dims MUST emit structured output

```json
"D2.10_engagement_persuasion": {
  "score": 78,
  "confidence": 0.85,
  "model": "claude-sonnet-4-5",
  "evidence": [
    {
      "span_id": "hero-h",
      "selector": "#hero-h",
      "snippet": "A Ballarat roof, done properly — and signed off in writing.",
      "weight": 0.4,
      "note": "strong opening hook + em-dash + period = editorial confidence · Mike persona signal"
    },
    {
      "span_id": "cta-primary",
      "selector": "section#contact .btn-primary",
      "snippet": "Request a written quote",
      "weight": 0.3,
      "note": "Mike-specific CTA · benefit-not-feature framing"
    },
    {
      "span_id": "trust-bar",
      "selector": ".trust-bar",
      "snippet": "10-year written warranty",
      "weight": 0.3,
      "note": "preempts 'will it last' objection · proof-density signal"
    }
  ]
}
```

### Evidence count constraint

- **Minimum 2** · **target 3** · **maximum 5** per premium dim
- Fewer than 2 → LLM refused / page too sparse → flag for human review
- More than 5 → trim to top 5 by weight (LLM-self-ranked)
- Forcing exactly 3 creates fake evidence on sparse pages (codex R28 Q-II-2 pushback)

### Confidence score interpretation

| Confidence | Action |
|---|---|
| ≥ 0.85 | Trust score · no review |
| 0.70 - 0.85 | Trust but flag in trace |
| < 0.70 | Trigger human review · score advisory only |

---

## §9 · 8 NEW dimensions full spec

Per existing-work research (§7 CLAUDE.md): 1 TRULY NEW · 7 extend existing.

### D2.10 · engagement-persuasion (EXTEND `core/eval/codex-deep-audit.js`)

- **Type**: LLM premium · positive signal · 0-100
- **Prompt template**: scores opening hook strength · benefit-vs-feature ratio · objection-preempt depth · CTA persuasion · emotional resonance for Mike persona
- **Build**: add `D6` to existing codex-deep-audit dim list (~150 lines)
- **Effort**: 2 hr

### D2.11 · facts cross-check (EXTEND T1 + `core/audit/contact-extraction.js`)

- **Type**: deterministic · HTML DOM parse vs brief.yaml exact match · 0-100
- **Logic**: extract phone/email/license/address/abn from rendered HTML · diff vs `clients/<slug>/v2/single-page-brief.yaml` · score = % fields exact match
- **Build**: new module `core/audit/facts-cross-check.js` · reuse contact-extraction parser (~200 lines)
- **Effort**: 2 hr

### D2.13 · section concept density (TRULY NEW)

- **Type**: LLM premium · positive · 0-100
- **Prompt template**: lists distinct idea per section · scores % non-filler · narrative arc coherence
- **Build**: new module `core/audit/section-concept-density.js` (~200 lines)
- **Effort**: 2 hr

### D2.14 · proof variety (EXTEND with CSS selector counts)

- **Type**: deterministic · cheerio block-class detection · count by type
- **Logic**: count blocks per type `{review, stat, case_study, expert_quote, certification, photo}` · score = min(types_present, 5) * 20 (cap 100)
- **Build**: new module `core/audit/proof-variety.js` (~100 lines)
- **Effort**: 1 hr

### D3.10 · optical consistency (EXTEND `pl-audit-vision.js` D8)

- **Type**: LLM vision premium · 3 sub-checks via vision prompts · 0-100
- **Sub-checks**:
  - baseline alignment cross-section
  - micro-spacing ratio (padding/margin multiples of token scale)
  - cross-page hero shape consistency (if multi-page · single-page → skip)
- **Build**: extend `pl-audit-vision.js` D8 prompt + add D10 (~100 lines)
- **Effort**: 1.5 hr

### D2.BC6 · token coverage depth (EXTEND v4 T2 D2.1)

- **Type**: deterministic · CSS scan · split by token category
- **Categories tracked**: `--radius-*` · `--shadow-*` · `--space-*` · `--motion-*` (in addition to existing color tracking)
- **Logic**: for each category · count `var(--category-*)` references / count of related CSS properties · score = avg of 4 category coverages
- **Build**: extend `pl-audit-v4.js` T2 D2.1 split logic (~50 lines)
- **Effort**: 0.5 hr

### D2.BC7 · logo variant per surface (IMPLEMENT existing TODO line 315)

- **Type**: deterministic · CSS surface lightness inference + filename match
- **Logic**: for each `<img src="brand/logo-*.svg">` · compute parent section bg color · light bg requires `logo-dark` · dark bg requires `logo-light` or `logo-mono-light` · mismatch = fail
- **Build**: implement v4 D2.4 (line 315 TODO) + extend `core/audit/logo-extractor.js` with surface detection (~150 lines)
- **Effort**: 1.5 hr

### M1 · Mobile hard gate (NEW assembly · reuse 3 existing modules)

- **Type**: hybrid (mechanical veto + scored vision)
- **Components**:
  - M1.1 viewport overflow-x · Playwright at 390px · veto
  - M1.2 sticky CTA visible · Playwright + CSS scan · veto
  - M1.3 critical tap target ≥44px · CSS computed-style scan via `core/audit/form-audit.js` extended · veto
  - M1.4 hero readability at 390px · LLM vision new prompt · scored
  - M1.5 above-fold trust + CTA at 390px · LLM vision new prompt · scored
- **Build**: new module `core/audit/mobile-gate.js` glue (~300 lines)
- **Effort**: 3 hr

### D2.12 · facts upstream validation (DEFERRED · gates first paying client · §13)

- **Type**: external API · GMB / ABN register / address geocode · 0-100
- **Trigger**: before ANY paying client goes live · NOT before audit standard ships
- **Build deferred**: ~3-4 hr · external API costs ($0.05/lookup)

### Total build effort

| Dim | Hr | Build type |
|---|---|---|
| D2.10 | 2 | extend codex-deep-audit |
| D2.11 | 2 | new module · reuse contact-extraction |
| D2.13 | 2 | TRULY NEW LLM scorer |
| D2.14 | 1 | new module · CSS selector counts |
| D3.10 | 1.5 | extend pl-audit-vision |
| D2.BC6 | 0.5 | extend v4 D2.1 |
| D2.BC7 | 1.5 | implement v4 D2.4 TODO |
| M1 | 3 | new glue · reuse form-audit + vision |
| **TOTAL** | **13.5 hr** | mostly extend |

D2.12 deferred · trigger §13.

---

## §10 · Calibration procedure (codex R27 Q-HH-1 + R28 Q-II-4)

### Sequence

```
1. Build all 8 dims (§9 · 13.5 hr)
2. Run audit v2 (both fast + premium tiers) on:
   - Phase 3 vicwest (ceiling · target quality · target audit score)
   - V2 vicwest module-library output (current renderer floor)
   - vicwest existing live site https://vicwestroofing.com.au/ (real-world baseline · "before/after" sales narrative)
3. Capture per-P0 scores · per-dim raw values · composite (fast + premium separate)
4. Derive thresholds: SHIP gate = Phase3_score - 5 pts PER P0 (not just composite)
5. Document calibration baselines in `docs/v3/AUDIT-V2-CALIBRATION-RESULTS.md`
```

### Drift tolerance (codex R28 Q-II-4 + R27 Q-HH-4 refined)

For dims that overlap between v3 (pl-audit-tier) and v4 (pl-audit-v2):

| Metric | Tolerance | Action if exceeded |
|---|---|---|
| composite drift | ±3 pts | Rebalance weights · not single-dim |
| per-P0 drift | ±5 pts | Investigate specific dim scoring · adjust anchor |
| NEW dims (truly new) | report separately | NO drift requirement · these are intentional v4 signal |

**Codex R28 pushback noted**: drift tolerance applies ONLY to overlapping dimensions. Don't force weights to hide legitimate v4 signal. NEW dims report as fresh data.

### Calibration site selection (codex R28 Q-II-4 final)

```
Site 1: Phase 3 vicwest editorial preview  → quality target ceiling
Site 2: V2 vicwest composed-output         → current renderer baseline
Site 3: https://vicwestroofing.com.au/     → real-world live baseline · "what we replace"
```

Skip V2 mark-squire for first pass (codex R28 correction · 3 sites not 4).

---

## §11 · v3 legacy + backward compatibility

### v3 status

- `docs/v3/SOP-AUDIT-STANDARD.md` (v3) → **FROZEN** · DO NOT EDIT · legacy_baseline
- `scripts/cli/pl-audit-tier.js` → tagged "v3 LEGACY · regression baseline only" · keep working · do not extend
- `pl-audit-v4.js` → renamed conceptually to "v2 audit" (file name stays for backward compat git history) · this SOP is v2

### Migration plan

```
Phase B Step (a): build 8 dims (§9) + write SOP v2 (this doc) [DONE this step]
Phase B Step (b): calibration runs (§10) · 3 sites
Phase B Step (c): pl:audit-v2 CLI (rename from pl-audit-v4 · clearer)
Phase B Step (d): pl:e2e prefer audit-v2 over audit-tier · keep tier wrapper for legacy
Phase B Step (e): nightly regression runs both v3 + v2 on calibration set · alert on drift > ±3 composite or ±5 per-P0
```

---

## §12 · A/B LLM calibration protocol (codex R28 Q-II-8 + Q-II-9)

### Initial calibration · before locking single provider

For each of 4 premium LLM dims (D2.4 · D2.5 · D2.6 · D2.10 · D2.13 · D3.10 · M1.4 · M1.5):
- run 1 vicwest under Claude (claude-sonnet-4-5)
- run 1 vicwest under codex (default model)
- compare scores per dim
- 4 LLM dims × 2 LLMs = 8 calibration runs · ~$3 · 1 hour

### Model disagreement fail states (codex R28 Q-II-9)

```
trigger_human_review IF (
    abs(claude_score - codex_score) > 10 ON SAME DIM
    OR
    contradictory_pass_fail ON ANY P0 OR P1 RULE
)
```

Otherwise · lock to **single provider** (the one that scores closer to human-judged quality on initial calibration · TBD post calibration runs).

### Post-lock policy

- 1 LLM only in production audit
- Re-run A/B calibration when:
  - changing rubric (new hash · §7)
  - changing models (new audit version)
  - audited 10-15 sites · gather signal · revisit niche thresholds (§14)

---

## §13 · D2.12 deferred upstream facts validation

### Trigger (codex R28 Q-II-6 (b))

Before **ANY paying client goes live** · D2.12 must ship. ABN/business-identity mismatch on a live customer = legal + credibility nightmare.

### Build spec

- ~3-4 hr · ~150-200 lines
- Reads facts.json + brief.yaml
- Calls 3 external APIs:
  - ABN Lookup (https://abr.business.gov.au/ABRXMLSearchRPC/) · verify ABN matches business_name
  - Google Place API Details · verify phone + address match Place
  - Geocoding API · verify address resolves to declared city/suburb
- Output: per-field PASS/FAIL · overall score · `_source` provenance flags

### Integration

- Phase B Step before Stripe link · gates `pl:publish` CLI
- Adds `D2.12_facts_upstream_validation` to P0 content_accuracy hard gate (replaces TODO)

---

## §14 · Anti-patterns + niche thresholds + final notes

### Anti-patterns (don't do · per codex R26-28 + CLAUDE.md §6+§7)

1. **Mix fast/premium scores** · they answer different questions · never average
2. **Lower thresholds to make a render pass** · calibration anchors · don't move goalposts
3. **Build new audit dim** without 5-look discovery (CLAUDE.md §7)
4. **Skip rubric schema validation** · unvalidated runtime config silently corrupts
5. **A/B 2 LLMs in production** · post-calibration · lock 1 · save tokens
6. **Per-niche thresholds today** · collect metadata · revisit at 10-15 audited sites
7. **Use only composite as ship gate** · per-P0 floor is required · composite hides bad copy
8. **Treat mobile as 6th P0** · mobile is hybrid veto · NOT score blend

### Pre-commit hook (codex R28 Q-II-7 (b))

```
pre-commit:
  pl:fixture-check --fixture vicwest    # cheap regression contract · 12 assertions · ~50ms
  
NOT:
  pl:audit-v4 --tier fast                # belongs in CI / on demand · not pre-commit
```

### CI runs (nightly + per-PR)

```
nightly:
  pl:audit-v2 --tier fast on all checkpoint=GREEN clients
  emit drift report against v3 legacy baseline
  alert on |drift composite| > 3 OR any per-P0 drift > 5

per-PR (if audit code changed):
  pl:audit-v2 --tier premium on vicwest (full · ~$1.50)
  regression check vs last known-good audit version
```

### Niche metadata collection (codex R28 Q-II-6 / R26 Q-GG-7)

Every audit emits `niche: "roofing"` (Phase B) · later `niche: "electrician|plumber|..."`. Collect into `audit-history.jsonl`. Revisit per-niche thresholds after 10-15 audited sites.

### What `audit-history.jsonl` contains

```json
{
  "audit_version": "v2.0.0-abc123",
  "slug": "vicwest-roofing",
  "niche": "roofing",
  "audit_tier": "premium",
  "composite_premium": 89,
  "p0_scores": {...},
  "mobile_veto_passed": true,
  "client_metadata": { "primary_segment": "planned-upgrade", "brand_kit_file_count": 18 },
  "audited_at": "2026-05-28T..."
}
```

---

## §15 · Sign-off

**Codex consensus rounds**:
- R26 (audit standard v2 framework · 8/8)
- R27 (final polish · 7/7 · 3 sharp追加: rubric hash composition · evidence spans · A/B sample size limit)
- R28 (tactical lock · 10/10 · refinements: evidence min/target/max · mobile veto specifics · weight rebalance accept · model disagreement trigger)

**Total**: 25 questions · 0 unresolved · ≥95% consensus achieved.

**Matthew approvals**: 5 P0 priorities verbatim · audit-first-before-experiment mandate · build over guess · mobile as primary AU local-trade UX (not P1 performance).

**Codex final GO**: "Write SOP v2 now with explicit sections for canonical score ownership, v3 legacy calibration, fast vs premium tier separation, per-P0 gates, mobile veto rules, rubric validation, versioned hashing, and calibration procedure." All 8 sections delivered.

**Document version**: SOP-AUDIT-STANDARD-V2.md · v2.0.0 · 2026-05-28 · primary forward audit doc.

**Next**: build 8 dims (§9 · 13.5 hr) → calibration runs (§10 · 3 sites) → derived thresholds → lock SOP v2 final thresholds → unblock Phase B 3-path experiment.
