# fixtures/e2e/vicwest · golden regression contract

**Phase A.1 Step 6** · created 2026-05-28 · codex R20 Q-CC-2 (a) smoke-level.

## What this protects

After Phase A.1 Steps 1+2, vicwest single-page hit:

- **Composite 86 · Grade A · SHIP** verdict (up from 45/D/REJECT)
- T1 PASS all mechanical gates (incl. 1.13 JSON-LD valid)
- T2 86/100 brand contract (D2.1 96% var coverage · D2.2 0 hardcoded hex)
- LocalBusiness `RoofingContractor` JSON-LD with aggregateRating 4.1/18
- R-BA-6 draggable-slider DOM signature intact (`.ba-slider`/`.ba-divider`/`.ba-handle`)

This fixture is the regression contract for those wins. Any future change (Phase A.1 Steps 3-5, Phase B work, audit-rubric tweaks) must keep all 10 assertions GREEN.

## What this is NOT

**This contract is not approval of content quality.** It locks regression safety, not Matthew's taste bar for persona voice. Step 5 persona-overlay voice merge is judged separately by human review, not by this fixture.

Don't relax the contract to "make tests pass" when changing voice/copy. If voice work breaks an assertion, the change is wrong — not the fixture.

## How to run

```bash
# Full pipeline (compose + audit + assertions) — ~3 sec
npm run pl:fixture-check -- --fixture vicwest

# Just re-check assertions on existing output (skip recompose+audit) — ~50ms
npm run pl:fixture-check -- --fixture vicwest --skip-pipeline

# Machine-readable
npm run pl:fixture-check -- --fixture vicwest --json
```

## Exit codes

- `0` · all assertions PASS
- `1` · one or more assertions FAILED (regression detected)
- `2` · pipeline step failed (cannot reach assertion phase)
- `3` · fixture / file missing

## Regression policy

On failure: **halt CI / pre-commit · do NOT auto-update baseline**. Investigate root cause. Update `contract.json` baseline only with explicit Matthew approval + codex sign-off.

This contract is the load-bearing wall protecting Steps 1+2 wins through the rest of A.1 and into Phase B.

## Schema

See `contract.json` · schema_version `e2e-contract/0.1`.

## Future fixtures

Same pattern for mark-squire (28-field rich data) + a-j (17-field minimum) + vip (RED-gated · should produce checkpoint refusal, not render). Drop a `fixtures/e2e/<slug>/contract.json` and the same CLI runs.
