---
name: lead-ops
description: Use when a user wants to take a business lead from raw input to a ready-to-act decision. Handles lead intake, research, redesign evaluation, ready-to-build gating, and outreach brief generation for local businesses across multiple industries. Use this for Google Maps leads, manual leads, inbound leads, redesign opportunities, and outreach prep.
---

# Lead Ops

Run the smallest useful lead pipeline without reinventing existing project logic.

## When to use

Use this skill when the task is to:

- normalize a new lead from Google Maps, manual entry, inbound, paid intake, or provider reply
- decide whether the lead should become a starter preview, redesign preview, teaser, or outreach-only case
- gather verified facts, inferred facts, and placeholder candidates
- generate redesign value points and outreach-ready angles
- prepare a ready-to-build decision and outreach brief

Do not use this skill to build the website itself. Stop at the handoff / outreach layer.

## Core workflow

Run these modules in order:

1. `lead-intake`
2. `lead-research`
3. `redesign-check`
4. `build-ready`
5. `outreach-brief`

If you need the whole chain, prefer:

```bash
npm run leads:lead-ops -- --client <slug>
```

## Key rules

- Reuse existing code paths. Do not rewrite qualification, evidence, preservation, or website-ready logic.
- A lead is blocked only when it has no reachable contact path.
- Placeholder content must be filled, not left empty.
- Placeholder content may be AI-generated for demo completeness, but must not replace verified contact facts.
- Generated/dummy evidence must never make an unreachable lead look reachable. Real contactability needs email, phone, official contact page/form, or social DM from a non-generated source.
- `build-ready` is the public module name. It currently wraps the implementation that writes `ready-to-build.json`.

## Main commands

```bash
npm run leads:intake -- --input /tmp/lead.json --output /tmp/lead-intake.json
npm run leads:research -- --client <slug>
npm run leads:redesign-check -- --client <slug>
npm run leads:build-ready -- --client <slug>
npm run leads:outreach-brief -- --client <slug>
npm run leads:lead-ops -- --client <slug>
```

## Main outputs

```text
clients/<slug>/lead/lead-intake.json
clients/<slug>/lead/lead-research.json
clients/<slug>/lead/redesign-check.json
clients/<slug>/lead/ready-to-build.json
clients/<slug>/outreach/outreach-brief.json
clients/<slug>/lead/lead-ops.json
```

## Validation

Run the focused tests before claiming the skill is safe:

```bash
npm run leads:test-intake
npm run leads:test-research
npm run leads:test-redesign-check
npm run leads:test-build-ready
npm run leads:test-outreach-brief
npm run leads:test-lead-ops
npm run leads:test-lead-ops-audit
npm run leads:test-lead-ops-scenarios
npm run leads:test-lead-ops-low-info
npm run funnel:test-lead-registry
npm run funnel:test-lead-outreach-index
npm run outreach:test-pack-brief
npm run outreach:test-email-brief
```

Use the smoke artifact if you need a concrete end-to-end example:

```text
data/qa/lead-ops-smoke/
```

For broader synthetic coverage across industries and contact paths, also inspect:

```text
data/qa/lead-ops-scenarios/summary.json
```

For low-information completion coverage, inspect:

```text
data/qa/lead-ops-low-info/summary.json
```

That fixture matrix simulates Google Places enrichment, official-site scrape/search text, PDF evidence, image OCR evidence, generated placeholders, and business-name-only leads without calling live APIs.

## If something looks wrong

- If contactability looks wrong, inspect `lead-intake` and `lead-research` first.
- If redesign feels too optimistic or too strict, inspect `redesign-check`.
- If outreach wording or recommended channel looks wrong, inspect `outreach-brief`.
- If admin truth source is stale, inspect `lead-registry` and `lead-outreach-index`.
