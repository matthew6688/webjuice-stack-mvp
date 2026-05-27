# Codex Response 12 · Step-0 Forward Plan

**Date**: 2026-05-27

## A · Architecture Decision

Pick **(iii) both, during transition**: make **Hermes website-agent the durable orchestrator** for customer workstreams, while allowing a thin direct Claude/Codex conversation spike to prove the per-customer build loop before all Discord/Hermes wiring is mandatory. The target architecture is already conversation-driven: one Claude/Codex/Open-Design conversation per customer, loading the design stack and reading `DESIGN.md` plus handoff as immutable input (`docs/v4/00-BUSINESS-LOGIC.md:50-57`). Hermes is the right durable owner because its website profile already defines one thread/case as the workstream, requires local design skills before visual edits, and posts preview links before publish (`docs/HERMES_WEBSITE_AGENT.md:24-32`, `docs/HERMES_WEBSITE_AGENT.md:214-220`, `docs/HERMES_WEBSITE_AGENT.md:224-231`). But the deep reports show the build/composition layer is the broken part, not discovery/enrichment: enrichment has 6 soft-fail sources, audit has many unused signals, grading has downstream gaps, and `pl:compose-site` is mustache, does not consume the fix matrix, and caused vicwest's 56 score via wrong page shape and missing/false audit signals (`docs/v4/CODEX-CONSULT-12.md:40-68`). So use Hermes as the intended orchestration shell, but prove the new build contract in one direct conversation first so we do not entangle build-quality debugging with Discord/profile reliability.

## B · Step 0

Pick **2. Build the `DESIGN.md` contract**.

First concrete file: **`core/contracts/design-contract.js`**

- Define the v1 `DESIGN.md` schema: locked fields, AI-fillable fields, provenance/source rules, GREEN/YELLOW/RED readiness, and parse/validate helpers.
- Export `loadDesignContract()`, `writeDesignContract()`, and `validateDesignContract()` so both CLI writers and build/audit readers use one contract.
- Enforce that locked fields cannot be AI-filled: `business_name`, `phone`, `address`, `business_scope/services`, `brand colors`, and `logo`.

Why this before the others:

- It is the canonical stage-4 heart of the system, not a side document: the signed business logic says `DESIGN.md` must contain locked facts and may contain AI-completed narrative/copy/image fields, then gates build readiness (`docs/v4/00-BUSINESS-LOGIC.md:34-48`).
- The build stage explicitly reads `DESIGN.md` and handoff as immutable input (`docs/v4/00-BUSINESS-LOGIC.md:50-57`), and the non-negotiables say the build step must never override it (`docs/v4/00-BUSINESS-LOGIC.md:84-92`).
- Hermes already expects separate source-of-truth files like `design.restaurant.json` and `brand-spec.md`, and requires the Huashu/Open Design skill stack for website UI changes (`docs/HERMES_WEBSITE_AGENT.md:24-30`). `DESIGN.md` is the missing ProfitsLocal-normalized version of that contract.
- Fixing vicwest-specific bugs is useful, but it only repairs one output. The deeper failure is that the builder has no single brand/fact contract and the current composer is template-driven, not design-skill-driven (`docs/v4/CODEX-CONSULT-12.md:58-68`).
- Adding SEO or fixing grading now improves scoring, but the build conversation still lacks the immutable facts it must obey; grading is also known to ignore `cheap_audit.final_score` and Layer 4 investment signals today (`docs/v4/CODEX-CONSULT-12.md:51-57`).
- Prior responses deliberately kept the build skill pending until canonical inputs, provenance, audit thresholds, and RED/YELLOW behavior were settled (`docs/v4/CODEX-RESPONSE.md:73-89`, `docs/v4/CODEX-RESPONSE-5.md:8-12`).

Stop criterion:

- `core/contracts/design-contract.js` exists and has focused tests under `scripts/test/` proving locked fields, AI-fillable fields, provenance/source requirements, and readiness verdicts.
- A writer CLI exists under `scripts/cli/` that can create `clients/<slug>/v2/DESIGN.md` from existing handoff/od-package inputs without inventing locked facts.
- A reader path exists for the next build/audit layer to consume `DESIGN.md`; no build path may silently fall back to generic business facts when `DESIGN.md` is RED.
- One fixture run produces a valid `DESIGN.md` for a GREEN/YELLOW customer and refuses a RED customer with a concrete missing-facts report.
- `npm run ops:skill-cli-validate` and the relevant narrow test pass; pre-commit stays clean.

Step 1 after that:

Wire `pl:assemble-handoff` or a new narrow CLI to write `DESIGN.md` from the existing od-package, then update `profitslocal-assemble-handoff` docs to name it as the downstream brand contract. The existing pipeline already has assemble/audit package steps (`docs/v4/INFRASTRUCTURE-MAP.md:273-278`).

Step 2:

Run one conversation-per-customer build spike using that `DESIGN.md` as immutable input. Use Hermes if the profile is healthy; otherwise use a direct Codex/Claude thread but keep the same input/output contract. The Hermes doc already validates pickup, threading, and Huashu/Open Design skill loading (`docs/HERMES_WEBSITE_AGENT.md:285-296`).

Step 3:

Close the audit-to-fix loop: make the builder consume `issue-fix-matrix.json` / fix instructions and emit a build result with consumed inputs. Prior guidance already identified this as the bridge needed before promoting the compose/build skill (`docs/v4/CODEX-RESPONSE.md:62-71`).

## C · 8-Skill Audit Pause

Pick **(iii) convert the remaining 5 audits into the 00-BUSINESS-LOGIC shape**.

Do not pause entirely: skills 4-8 are still the canonical path from research pack through quality audit, and the validation protocol already expects one audit file per skill plus a summary (`docs/v4/CODEX-RESPONSE-5.md:14-32`). But do not continue the old protocol unchanged, because the canonical loop now inserts `DESIGN.md` as stage 4 and changes build from monolithic compose to conversation-driven design-skill execution (`docs/v4/00-BUSINESS-LOGIC.md:34-66`).

Concrete conversion:

- Skill #4 `profitslocal-build-research-pack`: validate that its output contains enough sourced facts to write `DESIGN.md`, not just an od-package.
- Skill #5 `profitslocal-data-checkpoint`: validate GREEN/YELLOW/RED against `DESIGN.md` locked fields and AI-fillable fields.
- Skill #6 `profitslocal-assemble-handoff`: validate it writes or preserves `DESIGN.md` and refuses to overwrite locked facts.
- Skill #7 `profitslocal-audit-handoff`: validate it audits the `DESIGN.md` contract before build.
- Skill #8 `profitslocal-quality-audit`: validate it reads the built output against `DESIGN.md`, adds Agentic SEO later as a T5/T4 SEO dimension, and does not confuse scoring bugs with brand-contract failures.

Why: skills 1-3 are already deep-validated for intake/filter/enrichment boundaries, with skill #3 explicitly handing off enriched sourced facts to skill #4 (`docs/v4/skill-audits/01-profitslocal-lead-discovery-DEEP.md:5-38`, `docs/v4/skill-audits/02-profitslocal-lead-filter-DEEP.md:5-44`, `docs/v4/skill-audits/03-profitslocal-entity-enrichment-DEEP.md:27-33`). The remaining audits should now validate the canonical business loop, not just the pre-`DESIGN.md` skill docs.

## D · Reading Verification

I read the mandatory set and grounded the plan in these points:

- Canonical loop: find local businesses, build better AI sites, self-audit/fix, publish Cloudflare preview, then outreach (`docs/v4/00-BUSINESS-LOGIC.md:5-8`).
- `DESIGN.md` is the signed brand contract and build input (`docs/v4/00-BUSINESS-LOGIC.md:34-57`, `docs/v4/00-BUSINESS-LOGIC.md:84-92`).
- Infrastructure map shows the existing command surface for handoff, gates, build/compose, OD experiments, and publish (`docs/v4/INFRASTRUCTURE-MAP.md:261-280`).
- Prior responses kept `profitslocal-compose-site` pending until compose reads canonical inputs, refuses RED, writes provenance, and passes audit thresholds (`docs/v4/CODEX-RESPONSE.md:73-89`).
- Response 6/8 narrowed client-file authorization and focused pre-commit recovery; that does not authorize broad client edits for this step (`docs/v4/CODEX-RESPONSE-6.md:8-11`, `docs/v4/CODEX-RESPONSE-8.md:15-22`).
- Deep skill audits prove skill #1 and #2 are clean PASS, while skill #3 still has external-blocked ledger/live-provider risks that downstream skills must respect (`docs/v4/skill-audits/01-profitslocal-lead-discovery-DEEP.md:91-99`, `docs/v4/skill-audits/02-profitslocal-lead-filter-DEEP.md:86-94`, `docs/v4/skill-audits/03-profitslocal-entity-enrichment-DEEP.md:66-72`).
- Hermes website-agent is already designed for per-thread customer execution and local design-skill loading (`docs/HERMES_WEBSITE_AGENT.md:20-32`, `docs/HERMES_WEBSITE_AGENT.md:214-220`, `docs/HERMES_WEBSITE_AGENT.md:285-296`).
