# Ops Dashboard Plan

Updated: 2026-05-10

Status: 8 admin panels live; read-only operations cockpit covering overview / leads / queue / reports / templates / finance / intakes / settings. Settings remains an operator aid, not a secret-writing control plane.

## Positioning

The dashboard is an operations command center, not a CMS. It surfaces system health, revenue/cost, client preview status, order/revision state, agent queue, third-party dependencies, and core settings.

## Panel Status (2026-05-10)

| Path | Role | Status |
| --- | --- | --- |
| `/admin` | Overview KPIs: revenue, costs, ROI, online previews, paid orders, pending revisions, failed deploys | Working MVP |
| `/admin/leads` | Discovery + CRM snapshots, audit evidence, contact paths, lead pipeline state, mockup/outreach readiness | Working MVP |
| `/admin/queue` | Operational work grouped by lead stage, queue action, outreach state, project state; triggers `lead-queue-action` workflow | Working MVP |
| `/admin/reports` | Discovery / audit / outreach / document-comparison reports | Partial |
| `/admin/templates` | Template inventory, template-lab artifacts, starter experiment outputs | Working MVP |
| `/admin/finance` | Ledger summary, campaign/client/provider ROI | Partial |
| `/admin/intakes` | Paid intake review: structured fields, missing-info detection, file summary, build-readiness | Partial |
| `/admin/settings` | Masked env checklist with source attribution; read-only by design | Working MVP |

Code: `src/pages/admin/{index,leads,queue,reports,templates,finance,intakes,settings}.astro` and `src/pages/admin/intakes/` sub-routes.

## /admin/queue — Queue Action Workflow

Queue items group around lead stage, queue action, outreach state, and project state. An operator triggers an action from the page; the workflow path:

- UI: `src/pages/admin/queue.astro`
- Edge entrypoint: `functions/admin/lead-queue-action.ts`
- Local script: `scripts/leads/run-queue-action.js`
- GitHub Actions runner: `.github/workflows/run-lead-queue-action.yml`
- Note recording: `functions/admin/lead-note.ts` + `.github/workflows/record-lead-note.yml`

Verify:

```
npm run admin:test-lead-queue-action-entrypoint
npm run leads:test-run-queue-action
```

## /admin/reports

Surfaces compact summaries and manifests produced by the leads / audit / document pipelines. Read-only. Source data lives under `data/` and `public/admin-artifacts/`.

Verify:

```
npm run admin:test-report-index
```

## /admin/templates

Lists the template library (niche templates, starter experiments, template-lab artifacts) and their handoff status into the mockup pipeline. Read-only browse. Building artifacts is done from `scripts/leads/build-template-mockup-handoff.js` and related scripts.

## /admin/intakes

Renders submitted paid intakes: structured fields, missing information, file summary, latest customer update, case link, and whether the build is ready for an agent task.

## /admin/settings

`/admin/settings` is the runtime configuration checklist for operators, organized into purpose tabs:

- core operations
- special alerts
- Open Design
- transactional email
- cold outreach
- checkout/billing
- media uploads
- lead research
- domain/deploy
- local AI audit

Plain Chinese labels first; low-level env names and aliases hide behind "技术细节" so operators can answer two questions quickly:

1. Is anything required missing?
2. If so, what is the exact next step?

Source/masking behavior is fully specified in `docs/SECURITY.md` under "/admin/settings — Masked-Only Contract". Summary: the page reads `.env`, `.env.local`, `.dev.vars`, then overlays runtime `process.env`; shows masked values with source attribution; never persists secrets and never renders raw secrets into HTML. Pasting a replacement value generates an `.env` line for the operator to copy into `.env.local` or the deployment provider's env, then restart / redeploy.

## Security

Production `/admin` is gated by `functions/admin/_middleware.ts` + `ADMIN_ACCESS_TOKEN`; Cloudflare Access is preferred as a stronger outer gate. See `docs/SECURITY.md` for the full contract.

## Data Sources

- `clients/*`
- `data/cases/*`
- `data/funnel/orders/*`
- `data/paid-intakes/*`
- `data/finance/ledger.jsonl`
- `public/admin-artifacts/*`
- deploy / domain / link / outreach / audit artifacts
- third-party health checks through server-side functions

## Backlog (not yet wired)

- Pricing controls editable from the dashboard: package prices, enabled tiers, revision allowances, Stripe price/session mapping, audit trail
- Integrations health board: GitHub, Cloudflare, Stripe, Resend, Discord, Google Places, Firecrawl, OpenAI/Ollama
- Live action surface beyond queue: rerun deploy check, regenerate outreach assets, rebuild client artifacts, create agent task, request more intake details, send review email, publish approved dev to live
- Finance and intakes lift from "Partial" to "Working MVP" once ROI rollup and intake-to-task handoff are end-to-end
