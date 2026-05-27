# Skill #2 deep audit · profitslocal-lead-filter

**Date**: 2026-05-27 (Codex Response 10 protocol)

```yaml
skill: profitslocal-lead-filter
status: PASS
scope_owner: cheap_filter
commands_run:
  - node scripts/test/test-skill02-lead-filter-deep.mjs
fixtures:
  - 11 synthetic entities exercising 3 layers + survivor + idempotency + layer priority
  - static check on core/leads/cheap-audit-queue.js (runExclusionFilter wired · cheapAuditV2 with fetchPayload null)
paid_call_gate: pass
filter_idempotency: pass
classification_correctness: pass
edge_cases:
  - empty_pre_enrich: needs_enrichment=true, NOT excluded ✓
  - empty_post_enrich: Layer 1 no_contact_after_enrich ✓
  - business_status CLOSED_PERMANENTLY: Layer 1 not_operational ✓
  - test name: Layer 1 test_name ✓
  - gov / school / charity: Layer 2 gov_school_charity ✓
  - competitor (web design/SEO/marketing): Layer 2 competitor ✓
  - nicheVerdict.relevant=false: Layer 2 niche_mismatch_llm ✓
  - too_large (>200 reviews for roofing): Layer 2 too_large ✓
  - too_few_reviews (<5): Layer 3 too_few_reviews ✓
  - bad_rating (<3.0 with ≥5 reviews): Layer 3 bad_rating ✓
  - cycle-23b · review_count=0 + rating>0: NOT excluded (data missing not real 0) ✓
write_integrity: pass (pure-function · no fs/network)
provenance_minimum: not_applicable
sop_alignment: pass (after narrowing edit)
regression_tests_added:
  - scripts/test/test-skill02-lead-filter-deep.mjs (16/16 pass)
fixes_applied:
  - SKILL.md description: "A/B/C/D opportunity grade" → "predict_grade (predict-C survivors · predict-D exclusions)"
  - SKILL.md "Canonical command" section: A/B/C/D → predict_grade + clarify final grade is downstream
  - SKILL.md rules table: split into "predict_grade (this skill)" vs "Final A/B/C/D (downstream)"
remaining_risk:
  - cheapAuditV2 itself not tested in this pass (deep test for it could land later); skill #2 covers the EXCLUSION-FILTER path
  - niche-config thresholds (roofing min=5, max=200) hard-coded · regression would catch threshold drift
next_skill_adapter_notes:
  - skill_3 owns paid enrichment spend ledger and strict paid-fact provenance
  - skill_3 + skill_5 jointly own the FINAL A/B/C/D grade (this skill only pre-filters)
```

## §1 · No-paid-call boundary

Static check on `core/leads/cheap-audit-queue.js`:
- `runExclusionFilter` imported + called (line ~149-156) ✓
- `cheapAuditV2` is the T0 local-only audit (no Stage-2 site fetch) ✓
- No `places-enrich`, `ABN`, `tinyfish`, `Discord post`, `demo_build` invocations in this path ✓

## §2 · Filter idempotency

Test `idempotent · same input → identical normalized result` passes. `runExclusionFilter` is a pure function over `{entity, cheapAudit, nicheVerdict}` — no side effects, no random ordering.

## §3 · Exclusion-layer correctness (3 layers)

All 9 layer assertions pass:
- **Layer 1** (data quality): empty post-enrich · not_operational · test_name
- **Layer 2** (business type): gov/school/charity · competitor · niche_mismatch · too_large
- **Layer 3** (timing): too_few_reviews · bad_rating

Cycle-23b edge case (Matthew 2026-05-15): `review_count=0 + rating>0` correctly passes through (data missing ≠ truly 0).

## §4 · Classification/routing correctness

Confirmed via `core/leads/cheap-audit-queue.js`:
```js
predict.predict_grade = 'D';  // only when excluded
predict.predict_grade = 'C';  // only when survived all 3 layers
```
**No 'A' or 'B' is ever written here.** Final A/B/C/D landed downstream by detailed-audit + `core/leads/grade-router.js`. SKILL.md narrowing reflects this.

Layer priority: `exclusions.sort((a,b) => a.layer - b.layer)[0]` → lowest layer wins as primary reason. Test "layer priority" confirms gov-keyword (Layer 2) + too_few_reviews (Layer 3) → primary layer 2.

## §5 · SOP + skill alignment

Before edit: SKILL.md said it writes "A/B/C/D opportunity grade".
After edit:
- Description: "writes a `predict_grade` (predict-C for survivors · predict-D for exclusions) ... Final A/B/C/D sales grade is decided downstream"
- Rules table: split into "predict_grade (this skill emits)" vs "Final A/B/C/D (decided downstream)"

Owner SOP `docs/SOP_2_LEAD_DISCOVERY_PIPELINE.md` § hard triggers + niche-relevance regex remains the source of truth · this SKILL.md links not restates.

## Done criterion check (Response 10 §D)

1. ✅ This file exists
2. ✅ 5 protocol checks recorded
3. ✅ test-skill02-lead-filter-deep.mjs 16/16 pass
4. ✅ SOP boundary mismatch fixed (final grade ownership clarified)
5. ⏳ `ops:skill-cli-validate` to be re-run before commit
6. ⏳ Pre-commit to be re-run before commit
7. ✅ No `clients/` artifacts · no paid calls · no Discord posts
