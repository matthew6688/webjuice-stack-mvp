# Paid Intake Flow

Updated: 2026-05-06

## Goal

Paid ProfitsLocal orders should not create an agent task immediately unless they came from a prepared preview flow. Direct checkout creates a paid intake record first, then asks the customer for structured business details and assets.

This keeps the $399/$799 packages scalable: customers submit information through forms, not open-ended chat. Higher-touch live consulting can be quoted separately.

## State Flow

1. Customer pays through Stripe Checkout.
2. `/api/stripe-webhook` dispatches `route-funnel-event.yml` with `kind=paid_intake`.
3. `routeFunnelSubmission` records:
   - funnel submission
   - revenue ledger entry
   - case event
   - `data/paid-intakes/<client>/<order>.json`
4. Customer receives an email with `/intake?order_id=...&email=...&client_slug=...`.
5. Customer submits structured intake and optional files.
6. `/api/intake-submit` uploads file attachments to Cloudinary when configured, sends an internal notification with asset references, then dispatches `record-paid-intake.yml`.
7. `record-paid-intake.yml` updates the same paid intake JSON and appends a timeline event.
8. `/api/intake-submit` posts a Discord ops notification when `SALES_DISCORD_WEBHOOK_URL` or `PAID_INTAKE_DISCORD_WEBHOOK_URL` is configured.
9. Readiness is recalculated:
   - `intake_needs_more_info`
   - `intake_needs_generation_confirmation`
   - `intake_ready_for_review`

No website agent task is created automatically during paid intake. That handoff should happen only after the intake is reviewed or the future dashboard marks it ready.

## Internal Visibility

The current internal queue is:

```text
/admin/intakes
```

It is generated from `data/paid-intakes` at build time and shows:

- status counts
- customer and lead delivery email
- missing readiness fields
- Cloudinary asset/file counts
- revision count against the package allowance
- repo record path

The repo JSON remains the source of truth. The admin page is an operator view, not a separate database.

Production `/admin/*` is guarded by `functions/admin/_middleware.ts` and requires `ADMIN_ACCESS_TOKEN`. Operators can open `/admin/intakes?token=<ADMIN_ACCESS_TOKEN>` once to set the secure admin cookie.

## Admin Actions

Each paid intake has a detail page:

```text
/admin/intakes/<client_slug>/<order_id>
```

Supported v1 actions:

- request more info
- mark V1 started
- mark V1 delivered
- mark completed
- approve latest revision
- reject latest revision
- mark custom quote needed

The browser posts actions to:

```text
/admin/action
```

Cloudflare Pages dispatches `record-paid-intake-action.yml`. The workflow runs `scripts/funnel/record-paid-intake-action.js`, updates the matching paid intake JSON, and appends a timeline event.

Important limitation: the dashboard is generated from repo data at build time. After an action writes to GitHub, the visible dashboard state updates on the next deploy/build. This is acceptable for v1 because GitHub remains the source of truth.

## Readiness Rules

An intake is ready when these are present:

- checkout email
- business name
- order id
- menu, services, products, or offers
- primary customer action
- address or service area
- at least one file, reference website, or preview URL

Missing items are stored in `readiness.missing` so the dashboard can request specific follow-up details.

## Revision Flow

After V1 exists, customers use:

```text
/revision?order_id=<order>&email=<checkout_email>&client_slug=<client>
```

`/api/revision-submit` uploads files to Cloudinary, dispatches `record-paid-revision.yml`, and posts a Discord ops notification. The workflow appends a revision entry to the matching paid intake JSON.

Default limits:

- one-time website: 3 included revisions
- yearly maintenance: 12 included revision requests per year

Accepted in-scope revisions increment the used count. Requests over the included allowance are recorded with `revision_needs_extra_payment` so the operator can route the customer to an extra revision checkout or custom quote.

## File Handling

Customer file bytes are not committed to the repository. The site uploads files to Cloudinary when configured. The repo stores summaries and Cloudinary references such as:

`logo.png (image/png, 42 KB)`

If Cloudinary is not configured, the current fallback is internal Resend email attachments so the customer submission is not lost. Production should keep `CLOUDINARY_*` secrets configured so GitHub records can reference uploaded assets.

## Deploy Order

1. Merge workflow/script changes into `main`.
2. Confirm GitHub token can dispatch workflows and write repository contents.
3. Deploy Cloudflare Pages.
4. Run Stripe test checkout.
5. Confirm webhook creates paid intake.
6. Confirm intake form submission updates `data/paid-intakes`.
7. Confirm Discord/email notifications are received.
8. Confirm `/admin/intakes` and `/admin/intakes/<client>/<order>` are protected by `ADMIN_ACCESS_TOKEN`.
9. Confirm `/admin/action` dispatches `record-paid-intake-action.yml` and writes a timeline event.

## Deferred Dashboard Work

Variable pricing belongs in the operations dashboard, not hardcoded page edits:

- package prices
- enabled/disabled tiers
- revision allowances
- Stripe price/session mapping
- price change audit log
- paid intake list/detail views
- request-more-info action
