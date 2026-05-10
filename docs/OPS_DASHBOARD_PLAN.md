# Ops Dashboard Plan

Updated: 2026-05-09

Status: partially implemented. The admin shell now has overview, leads, templates, projects, finance, queue, and settings pages; settings is still an operator aid, not a secret-writing control plane.

## Positioning

The dashboard should be an operations command center, not a CMS. It should show system health, revenue/cost, client preview status, order/revision state, agent queue, third-party dependencies, and core settings.

## Priority

Do not implement this before the restaurant loop is complete:

1. Real menu evidence → preview.
2. Local AI audit.
3. Outreach screenshot/video proof.
4. Cold email dry-run/live test.
5. Paid order → agent task → dev preview → approval → live publish.

## P0 Read-Only Dashboard

- Overview: revenue, costs, ROI, online previews, paid orders, pending revisions, failed deploys.
- Clients: repo, preview URL, menu evidence, screenshots/video, deploy status, QA status.
- Orders/Revisions: order ID, masked email, tier, revisions used/remaining, task, case, Discord thread.
- Paid Intake: submitted structured intake, missing information, file summary, latest customer update, case link, and whether the build is ready for an agent task.
- Agent Queue: pending/running/completed/failed, source-of-truth files, allowed file scope, case context.
- ROI: campaign/client/provider revenue and cost summary.
- Integrations: GitHub, Cloudflare, Stripe, Resend, Discord, Google Places, Firecrawl, OpenAI/Ollama health.
- Settings: non-secret pricing, revision limits, provider unit costs, default niche, prompt/design protocol version.
- Pricing Controls: dashboard-editable package prices, enabled/disabled tiers, revision allowances, Stripe price/session mapping, and an audit trail for price changes.

## Current Settings Page

`/admin/settings` is the runtime configuration checklist for operators. It groups configuration into purpose-based tabs:

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

The page intentionally uses plain Chinese labels first. Low-level environment variable names, aliases, and detailed implementation notes are hidden behind “技术细节” so operators can answer two practical questions quickly:

1. Is anything required missing?
2. If something is missing, what exact next step should I take?

Local development reads `.env`, `.env.local`, and `.dev.vars`, then overlays runtime `process.env`. The UI shows the source of configured values, for example `.env.local` or `runtime`, without exposing raw secrets. Secret values are masked and secret inputs are blank by design; pasting a replacement value only generates an `.env` line for copying.

Important: `/admin/settings` does not persist secrets by itself. To make a change real, copy the generated line into local `.env.local` or the deployment provider's environment variables, then restart/redeploy the affected service.

## Security

Production `/admin` remains protected by admin middleware and `ADMIN_ACCESS_TOKEN`; Cloudflare Access is still preferred for a stronger outer gate. Never display API keys. The settings page may show masked values and source files, but must not render raw secret values into HTML.

## Data Sources

- `clients/*`
- `data/cases/*`
- `data/funnel/orders/*`
- `data/paid-intakes/*`
- `data/finance/ledger.jsonl`
- deploy/domain/link/outreach/audit artifacts
- third-party health checks through server-side functions

## Later Actions

Only after read-only status is trustworthy:

- rerun deploy check
- regenerate outreach assets
- rebuild client artifacts
- create agent task
- request more structured intake details
- adjust non-secret package pricing and revision allowances
- send review email
- publish approved dev to live
