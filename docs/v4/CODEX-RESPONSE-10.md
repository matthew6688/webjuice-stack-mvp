# Codex Response 10 · Skill #2 Deep Validation Protocol

**Date**: 2026-05-27  
**Pick**: Run a narrow deep pass on `profitslocal-lead-filter`: filter idempotency, exclusion layers, survivor/archive routing, no-paid-call boundary, and SOP/skill alignment.

## A · Protocol

The deep pass should add **five** checks only:

1. **No-paid-call boundary**
   - Run only synthetic entities and mocks; no Places, ABN, Tinyfish, premium LLM, Discord thread, demo-build task, or client artifact creation.
   - Verify `cheap-audit-queue` calls `cheapAuditV2()` with `fetchPayload: null` and does not perform Stage-2 site fetch.
   - Reason: skill #2 is a cheap gate; paid enrichment starts at skill #3.

2. **Filter idempotency**
   - Run the same entity through `runExclusionFilter()` twice with identical `cheapAudit` and `nicheVerdict`.
   - Assert identical `excluded`, `needs_enrichment`, `layer`, `reason`, `archive_reason`, and sorted `exclusions[].id`.
   - Reason: re-running the batch must not drift lead fate.

3. **Exclusion-layer correctness**
   - Layer 1: no phone/email/website before enrichment => `needs_enrichment=true`, not excluded.
   - Layer 1: no contact after `enrichment_attempted_at` => excluded with `no_contact_after_enrich`.
   - Layer 2: government/school/charity, competitor, too-large review count, and explicit `nicheVerdict.relevant=false` all exclude.
   - Layer 3: too-few real reviews and bad rating exclude/archive; `review_count=0` with rating > 0 must not exclude.
   - Reason: these are the high-leverage false-positive/false-negative controls before spend.

4. **Classification/routing correctness**
   - Assert implemented boundary behavior, not stale wording: excluded entities become predict-D; non-excluded and not `needs_enrichment` become predict-C with `audit_now=true`.
   - Assert `needs_enrichment` leaves `predict_grade` null and does not enqueue detailed audit.
   - Reason: current `cheap-audit-queue.js` no longer hard-predicts A/B here; the deep pass should catch accidental reintroduction.

5. **SOP + skill alignment**
   - Compare `skills/profitslocal-lead-filter/SKILL.md` with `docs/SOP_2_LEAD_DISCOVERY_PIPELINE.md`.
   - The skill may claim cheap audit, exclusion filter, niche match, survivor routing, and archive routing.
   - It must not claim final A/B/C/D sales grade ownership if current code only emits predict-C/D.
   - Reason: operator docs are currently the riskiest source of wrong expectations for skill #2.

Skip provenance `_source` sibling enforcement here. Skill #2 writes grades/filter metadata, not enriched customer-facing facts.

## B · Run Now vs Defer

Run now:

1. Static no-paid-call check of `core/leads/cheap-audit-queue.js`, especially `fetchPayload: null`, exclusion-filter wiring, and detailed-audit enqueue conditions.
2. New synthetic regression for `core/leads/exclusion-filter.js` covering all three layers plus survivor/idempotency.
3. SOP/skill wording check; fix SKILL.md if it still says skill #2 writes final A/B/C/D.
4. Existing relevant suite:
   `npm run leads:test-lead-ops`
   `npm run leads:test-lead-ops-low-info`
   `npm run leads:test-lead-ops-scenarios`

Defer:

- Real website fetch, visual audit, detailed audit score, final A/B/C/D grade, and customer-facing report content.
- Strict `_source` sibling enforcement for paid/enriched facts.
- Performance timing; useful only after paid batch authorization.

## C · First Concrete Edit

First edit: `scripts/test/test-skill02-lead-filter-deep.mjs`

Use synthetic entity inputs:

1. `survivor_roofer`: operational roofer, phone present, website present, rating 4.7, review_count 80, category `roofing contractor`, niche `roofing` => not excluded, `needs_enrichment=false`.
2. `empty_pre_enrich`: no phone/email/website, no `enrichment_attempted_at` => not excluded, `needs_enrichment=true`.
3. `empty_post_enrich`: no phone/email/website, `enrichment_attempted_at` set => Layer 1 excluded.
4. `parked_or_dead_site`: website present but cheapAudit says parked/404; not excluded by exclusion-filter alone.
5. `directory_domain`: website `facebook.com/...` or `yellowpages...`; assert deterministic result and record whether unhandled.
6. `government_school`: category/name includes school/council/church/charity => Layer 2 excluded.
7. `competitor`: category/name includes web design/SEO/digital marketing => Layer 2 excluded.
8. `niche_mismatch`: `nicheVerdict={relevant:false, confidence:0.91}` => Layer 2 excluded.
9. `too_few_reviews`: review_count below niche min with rating 4.5 => Layer 3 excluded.
10. `bad_rating`: rating 2.7 with review_count >= 5 => Layer 3 excluded.
11. `zero_reviews_with_rating`: rating 4.9 and review_count 0 => not excluded by too-few rule.

Expected assertions:

- Each fixture returns the expected layer/result.
- Running each fixture twice produces a stable normalized result.
- Primary exclusion is the lowest layer when multiple rules match.
- No fixture writes outside a temp path.

Likely second edit: `skills/profitslocal-lead-filter/SKILL.md`

Change wording from final A/B/C/D grading to "cheap filter emits predict-C for survivors and predict-D for exclusions; final A/B/C/D is downstream detailed audit/lead grading" unless the code is intentionally changed first.

## D · Stop Criterion + Handoff Template

Skill #2 deep-validation is done when:

1. `docs/v4/skill-audits/02-profitslocal-lead-filter-DEEP.md` exists.
2. It records the five protocol checks with command/output evidence.
3. `scripts/test/test-skill02-lead-filter-deep.mjs` exists and passes directly.
4. Any SKILL/SOP mismatch is fixed or recorded as `blocked_reconsult`.
5. Existing lead-op tests pass or failures are recorded as unrelated pre-existing failures.
6. `npm run ops:skill-cli-validate` passes.
7. Pre-commit remains clean and no paid calls, Discord threads, task-store demo builds, or `clients/` artifacts are created.

Handoff template:

```yaml
skill: profitslocal-lead-filter
status: PASS | PASS_WITH_EXPECTED_EXTERNAL_BLOCKER | FAIL
scope_owner: cheap_filter
commands_run: []
fixtures: []
paid_call_gate: pass | fail | blocked
filter_idempotency: pass | fail
classification_correctness: pass | fail
edge_cases: []
write_integrity: pass | fail | not_applicable
provenance_minimum: not_applicable
sop_alignment: pass | fail
regression_tests_added: []
fixes_applied: []
remaining_risk: []
next_skill_adapter_notes:
  - skill_3 owns paid enrichment spend ledger and strict paid-fact provenance.
```
