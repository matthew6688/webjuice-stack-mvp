# Codex Response 11 · Skill #3 Deep Validation Protocol

**Date**: 2026-05-27  
**Pick**: Run a no-spend deep pass on `profitslocal-entity-enrichment`: paid-call gate, strict paid-fact provenance, quota-guard behavior, idempotency, and ledger integrity.

## A · Protocol

Skill #3 is the first paid-call layer, so the deep pass should add **five** checks only:

1. **Paid-call gate**
   - Assert `--dry-run` paths never call Places API, ABN lookup, RDAP/whois, Wayback, Tinyfish, Cloudinary, or photo download.
   - Assert missing API key exits before any paid provider call or entity mutation.
   - Assert quota-exceeded behavior is handled through `places-quota-guard.js`, not ad hoc retries.
   - Reason: this is the first point where a CLI mistake can spend real money or burn quota.

2. **Strict `_source` sibling enforcement**
   - For every paid-write field under `places_enrichment`, `abn`, `whois`, `wayback`, and `tinyfish_search`, require a sibling source record.
   - The source record must identify at least `provider`, `fetched_at` or equivalent timestamp, and the source key/query used.
   - Do not accept only broad entity-level provenance for paid/enriched facts.
   - Reason: downstream report and handoff facts must be traceable field-by-field.

3. **Quota-guard rotation**
   - Use synthetic/mocked key results to prove multi-key fallover rotates on quota exhaustion.
   - Assert hard provider failures do not mark healthy keys as exhausted.
   - Assert dry-run reports planned provider/key behavior without hitting Google.
   - Reason: quota fallover is a reliability boundary and can silently turn into repeated paid failures.

4. **Enrichment idempotency**
   - Run the same synthetic entity twice with stable mocked enrichment payloads.
   - Assert no duplicate paid-write sections, no duplicate photo entries, and no duplicate cost-ledger lines for the same already-satisfied enrichment.
   - Assert richer second payloads merge missing fields without overwriting non-null facts to null.
   - Reason: re-running enrichment should be safe after interruptions and should not double-spend.

5. **Ledger format integrity**
   - Inspect `data/finance/ledger.jsonl` read-only and test temp-ledger appends.
   - Every paid-call ledger line must be valid JSON and include `entity_key`, `provider`, `cost_usd`, and `response_time_ms`.
   - Assert dry-run creates no ledger line; mocked paid-call paths append exactly one line per paid provider call.
   - Reason: cost accounting is the enforcement mechanism for the paid layer.

Do not include live API correctness, real photo downloads, Cloudinary transforms, or performance timing in this pass. Those need authorization or later workflow coverage.

## B · Run Now vs Defer

Run now:

1. Static paid-call-gate check across `scripts/cli/pl-enrich-entity.js`, `scripts/cli/pl-places-enrich.js`, `scripts/cli/pl-download-places-photos.js`, and `core/enrichment/index.js`.
2. Add `--dry-run` support to `pl-enrich-entity` if the CLI still lacks it; without that, the skill doc cannot be validated cleanly.
3. New synthetic regression for dry-run/no-spend, `_source` sibling enforcement, idempotency, quota-guard mocked rotation, and temp-ledger format.
4. Read-only inspection of `data/finance/ledger.jsonl` for parseability and required fields where enrichment ledger entries already exist.
5. SOP alignment check against `skills/profitslocal-entity-enrichment/SKILL.md`, SOP-1, and SOP-X-Tooling cost-ladder language.

Defer:

- Any live Places, ABN, Tinyfish, Wayback, RDAP, Cloudinary, or photo-download call.
- Any a-j Places chain run covered by `AJ-DECISION.md`.
- Any check that requires real billing/quota state; record it as `blocked_paid_authorization`.
- Visual audit, final grading, report content, masterMD, and client handoff validation.

If a check cannot reach 95% confidence with static analysis, mocks, dry-run, and existing ledger inspection, do not fake confidence. Mark the exact subcheck `blocked_paid_authorization` and keep the no-spend boundary intact.

## C · First Concrete Edit

First edit: `scripts/test/test-skill03-entity-enrichment-deep.mjs`

Expected assertions:

- `pl-enrich-entity --dry-run` exits successfully for a synthetic entity and does not call provider modules, mutate entity JSON, append ledger lines, or create photo/Cloudinary artifacts.
- Missing required provider key in non-dry planning exits before writes and before any network-capable provider call.
- Mocked `places-quota-guard.js` rotates from an exhausted key to a healthy key and stops cleanly when all keys are exhausted.
- Synthetic enrichment output rejects or reports paid-write fields that lack required `_source` siblings.
- Re-running the same mocked enrichment does not duplicate paid sections or cost ledger lines.
- Temp-ledger lines are valid JSON and include `entity_key`, `provider`, `cost_usd`, and `response_time_ms`.

Likely second edit: `scripts/cli/pl-enrich-entity.js`

Add first-class `--dry-run` behavior if absent:

- parse the flag in the CLI entrypoint;
- load and validate the target entity;
- print the planned providers/actions and estimated ledger categories;
- return before importing or invoking network-capable provider calls where feasible;
- never write entity files, ledger lines, photos, Cloudinary assets, or queue artifacts.

Likely third edit: `skills/profitslocal-entity-enrichment/SKILL.md`

Ensure the skill says paid/enriched facts require strict `_source` siblings and that dry-run is the default validation path unless a human authorizes spend.

## D · Stop Criterion + Adapter Notes for Skill #4

Skill #3 deep-validation is done when:

1. `docs/v4/skill-audits/03-profitslocal-entity-enrichment-DEEP.md` exists.
2. It records the five protocol checks with command/output evidence.
3. `scripts/test/test-skill03-entity-enrichment-deep.mjs` exists and passes directly.
4. `pl-enrich-entity --dry-run` exists and is proven no-spend/no-write.
5. Any live-provider-only checks are recorded as `blocked_paid_authorization`, not silently skipped.
6. SOP/SKILL cost-ladder and provenance mismatches are fixed or recorded as `blocked_reconsult`.
7. `npm run ops:skill-cli-validate` passes.
8. Pre-commit remains clean and no paid API calls, Cloudinary mutations, Discord threads, or `clients/` artifacts are created.

Handoff template:

```yaml
skill: profitslocal-entity-enrichment
status: PASS | PASS_WITH_EXPECTED_EXTERNAL_BLOCKER | FAIL
scope_owner: paid_entity_enrichment
commands_run: []
fixtures: []
paid_call_gate: pass | fail | blocked_paid_authorization
source_sibling_enforcement: pass | fail
quota_guard_rotation: pass | fail | blocked_paid_authorization
enrichment_idempotency: pass | fail
ledger_integrity: pass | fail | not_applicable
sop_alignment: pass | fail
regression_tests_added: []
fixes_applied: []
remaining_risk: []
next_skill_adapter_notes:
  - skill_4 should consume enriched facts only when paid fields have strict `_source` siblings.
  - skill_4 should treat missing enrichment as a routing/degrade condition, not as evidence for final grade.
  - skill_4 owns detailed audit/report inputs; skill_3 only proves paid enrichment integrity and cost traceability.
```
