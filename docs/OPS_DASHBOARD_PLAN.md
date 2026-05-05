# Ops Dashboard Plan

Updated: 2026-05-06

Status: deferred until the restaurant closed loop is stable.

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

## Security

Use Cloudflare Access for `/admin`. Do not build custom password auth for MVP. Never display API keys; only show configured/missing/failing.

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
