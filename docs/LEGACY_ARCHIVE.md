# Legacy Archive

Updated: 2026-05-06

## Purpose

This file keeps older experiments visible without letting them steer new agent work.

Nothing listed here should be deleted by default. The rule is:

```text
Preserve history, but do not treat legacy paths as the current product architecture.
```

When an agent is deciding what to do next, read `docs/P0_P1_TODO.md`, `docs/MODULE_BOUNDARIES.md`, and the project capsule first. Use this file only to understand why old artifacts exist.

## Current Mainline

```text
Collect / qualify
  -> Ready-to-Build Gate
  -> Open Design concept
  -> Webjuice/Astro production import
  -> Delivery QA
  -> customer review / approve / revise
  -> domain launch
  -> case memory update
```

## Archived / Deprioritized Areas

### Tally-First Payment Flow

Status: legacy

Why archived:

- Tally's built-in payment flow is useful, but the current mainline uses our own form + Stripe path so order IDs, emails, revision quotas, Discord tasks, customer emails, and case memory stay under our control.
- Tally can still be useful later for simple lead forms or quick experiments.

Keep:

- `docs/TALLY_MCP_SETUP.md`
- `core/funnel/tally*.js`
- `functions/api/tally-webhook.ts`
- existing payload samples under `clients/*/funnel/`

Do not use as default:

- new paid website checkout;
- mandatory revision flow;
- customer-facing project memory.

### Early Restaurant Preview Experiments

Status: legacy unless backed by current evidence + QA contracts

Why archived:

- Some early pages were too generic, too empty, or menu-incomplete.
- The current rule is evidence first, then design/build.

Keep:

- old screenshots and QA under `data/qa/`
- generated client artifacts for comparison

Do not use as default:

- unsourced menu content;
- one-page restaurant pages that omit official menu/contact/reservation facts;
- designs that do not pass delivery QA.

### Rich & Rare Pre-Open-Design Redesign Attempts

Status: legacy comparison artifacts

Why archived:

- The stronger direction is to use Open Design's native design loop and import the resulting concept into production.
- Earlier local variants are useful as failure examples and regression references.

Keep:

- `data/qa/rich-and-rare-design-compare/`
- `data/qa/rich-and-rare-redesign/`
- `data/qa/rich-and-rare-redesign-v2/`
- `docs/RICH_AND_RARE_REDESIGN_SMOKE.md`

Current source of truth for the concept:

- `clients/rich-and-rare-restaurant/concept/open-design/`

### Generic OCR / Menu Experiments

Status: niche-specific tool shelf

Why archived from the core:

- OCR is a restaurant adapter capability, not a universal website requirement.
- Many local-business websites do not need menu extraction.

Keep:

- `docs/OCR_MENU_PIPELINE.md`
- `scripts/ocr/`
- menu extraction samples

Use only when:

- the restaurant adapter needs menu data from PDF/image;
- official web menu extraction is incomplete;
- QA requires menu evidence reconstruction.

### Dashboard Planning

Status: deferred P1

Why archived from P0:

- Dashboard is useful for system observability, but it does not create the first revenue loop by itself.
- Local Hermes + Discord remains the main operating workspace for each project.

Keep:

- `docs/OPS_DASHBOARD_PLAN.md`
- current admin pages under `src/pages/admin/`

Do not block:

- collection;
- Open Design concept generation;
- production import;
- QA;
- customer review;
- launch.

## Re-Activation Rule

A legacy item can return to mainline only when it has:

- a clear owner in `docs/P0_P1_TODO.md`;
- a current verification command;
- hard evidence paths;
- no contradiction with `docs/MODULE_BOUNDARIES.md`.
