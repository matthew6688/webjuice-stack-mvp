# Lead Ops Skill Pressure Test

## Objective

Make the `lead-ops` skill trustworthy enough for business use by exhaustively pressure testing its supported lead sources, niche families, contactability rules, enrichment paths, redesign decisions, ready-to-build gating, outreach brief output, and handoff artifacts.

## Original Request

"安装 goalbuddy skill，穷尽我们的这个 skill 可能使用的不同使用场景，然后 set up goal to pressure test all the scenerios."

## Intake Summary

- Input shape: `specific`
- Audience: ProfitsLocal operators and future agents using the `lead-ops` skill
- Authority: `requested`
- Proof type: `test`
- Completion proof: A GoalBuddy final audit confirms that a documented scenario matrix has been implemented, loopholes found during pressure testing are fixed or explicitly recorded as blocked/deferred, and all required verification commands pass.
- Likely misfire: Treating the existing deterministic tests as enough while missing low-information enrichment, image/OCR/PDF, search, and cross-source edge cases.
- Blind spots considered:
  - Search / scrape / OCR may be available only through existing repo tools or local skills, not live external services.
  - Some scenarios may need fixtures instead of live calls to remain deterministic.
  - "100% confidence" must mean no known loopholes after the defined matrix, not impossible mathematical certainty.
  - The goal must preserve existing code paths and avoid rewriting evidence, preservation, website-ready, or outreach-pack logic.
- Existing plan facts:
  - Existing modules: `lead-intake`, `lead-research`, `redesign-check`, `build-ready`, `outreach-brief`, `lead-ops`.
  - Existing skill: `skills/lead-ops/SKILL.md`.
  - Existing tests include happy path, audit, and synthetic scenario coverage.
  - User explicitly wants scenarios invented when real scenarios are missing.

## Goal Kind

`specific`

## Current Tranche

Complete a pressure-test tranche for the `lead-ops` skill. The tranche is complete only when the matrix includes source, niche, contactability, data-completeness, enrichment, redesign, and downstream handoff dimensions; tests or fixtures cover the matrix; discovered loopholes are fixed or recorded with receipts; and the final audit maps verification back to the original request.

## Non-Negotiable Constraints

- Reuse existing repo code and local skills; do not reinvent evidence, search, OCR, preservation, website-ready, outreach-pack, or email artifact logic.
- Skill/module names stay short and cross-industry.
- Contactability is the hard blocker. If no email, phone, contact form/page, social DM, WhatsApp, or similar reachable path exists, the lead must not become build-ready.
- Placeholder content must be non-empty for demo completeness.
- Placeholder content must not overwrite verified contact facts or pretend to be verified.
- Restaurant is only one starting niche. Pressure tests must include other profitable niche families.
- Prefer deterministic fixtures for repeatable verification. Use live search/scrape/OCR only where already safe and available.
- Do not claim "100% confidence" unless all known loopholes in the defined matrix are either fixed or explicitly tracked as unresolved.

## Stop Rule

Stop only when a final audit proves the full original outcome is complete.

Do not stop after planning, discovery, or Judge selection if a safe Worker task can be activated.

Do not stop after one scenario test passes if broader safe local follow-up slices remain.

## Canonical Board

Machine truth lives at:

`docs/goals/lead-ops-pressure-test/state.yaml`

If this charter and `state.yaml` disagree, `state.yaml` wins for task status, active task, receipts, verification freshness, and completion truth.

## Run Command

```text
/goal Follow docs/goals/lead-ops-pressure-test/goal.md.
```

## PM Loop

On every `/goal` continuation:

1. Read this charter.
2. Read `state.yaml`.
3. Run the bundled GoalBuddy update checker when available and mention a newer version without blocking.
4. Work only on the active board task.
5. Record compact receipts in `state.yaml`.
6. Keep one active task.
7. After every Worker slice, run the task's verification commands.
8. Finish only with a PM or Judge audit receipt that records `full_outcome_complete: true`.

