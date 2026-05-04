# Next Work

Updated: 2026-05-04

## Current State

The Brisbane restaurant MVP now has a first-party sales funnel instead of a Tally-dependent checkout.

Verified live state:

- 5 generated restaurant previews return HTTP 200.
- 5 generated restaurant repos have latest dev GitHub Actions `completed/success`.
- Fixed footer sales bar is preview-only and links to first-party `/checkout` and `/revise` utility pages.
- Stripe test checkout works for `$399`, `$799/year`, and `$100` extra revision.
- Stripe test payment for Longwang completed and redirected to `/thank-you`.
- Stripe webhook signature verification is implemented.
- Resend domain `fengtalk.ai` is verified and dev Pages projects have Resend secrets configured.
- Revision requests require mandatory `orderId + checkout email` matching before quota is consumed.
- Central funnel runner exists: `npm run funnel:route-event` plus GitHub Actions `route-funnel-event.yml`.
- `webjuice-restaurant` Pages Functions can dispatch Stripe/revision payloads to the main automation workflow with `AGENT_GITHUB_TOKEN`.
- Main repo workflow notification secrets are configured for Discord + Resend; dry-run workflow dispatch with notification flags passes.
- No known API keys are committed.

## Highest Priority Remaining Work

### 1. Agent Dev-Branch Execution Loop

Goal: accepted paid/revision tasks should produce a dev branch update and a customer review link.

Tasks:

- Finalize task schema for `sale`, `revision`, `domain`, and `publish`.
- Teach runner to execute against `/tmp/profitslocal-repos/<client>`.
- For activation with no launch notes: run QA only and mark activation ready.
- For revision tasks: apply bounded content/design/artifact changes, not arbitrary edits.
- Push only to `dev`.
- Wait for dev deploy.
- Send internal Discord update and customer review email.

Validation:

```bash
npm run agent:validate-task -- --task <task.json>
npm run agent:run-task -- --task <task.json> --execute
npm run check:deploys -- --client longwang-restaurant-restaurant --branch dev
npm run check:links -- --client longwang-restaurant-restaurant --internal-links false
```

### 2. Central Automation Runner Hardening

Goal: Stripe and revision webhooks should trigger the main automation repo without manual file export.

Working now:

- Main repo has `npm run funnel:route-event`, a provider-agnostic router entrypoint.
- Main repo has `.github/workflows/route-funnel-event.yml` for `workflow_dispatch`.
- Workflow can write:
  - `data/funnel/submissions/...`
  - `data/funnel/orders/...`
  - `data/agent-tasks/...`
  - `data/finance/ledger.jsonl`
- `webjuice-restaurant` has `functions/api/_agent-dispatch.ts`.
- Stripe webhook dispatches raw Stripe events.
- First-party revision form dispatches normalized revision payloads.

Remaining hardening:

- Configure each Pages project with a narrowly scoped `AGENT_GITHUB_TOKEN`.
- Optional: add `EXTRA_REVISION_CHECKOUT_URL` repo variable once the global extra-revision purchase URL is decided.

Validation:

```bash
npm run funnel:route-event -- --input /tmp/stripe-event.json --provider auto --dry-run true
npm run funnel:route-event -- --input /tmp/revision.json --provider auto --dry-run true
gh workflow run route-funnel-event.yml --repo matthew6688/webjuice-stack-mvp \
  -f provider=auto \
  -f payload="$(cat /tmp/stripe-event.json)" \
  -f send_discord=false \
  -f send_email=false \
  -f dry_run=true
```

### 3. Customer Utility / Status Pages

Goal: `/revise` and future account utility pages should show trusted backend state, not guessed frontend state.

Tasks:

- Add `/api/order-status/`.
- Require `orderId + email`.
- Return:
  - tier
  - revision limit
  - revisions used
  - remaining revisions
  - next monthly reset date for yearly plan
  - extra revision checkout URL
- Render that status on `/revise`.
- Keep these utility pages available on preview/our domain even after customer live domain is connected.

Validation:

```bash
curl -X POST https://<client>-dev.pages.dev/api/order-status/ \
  -H 'Content-Type: application/json' \
  --data '{"order_id":"cs_test_...","email":"owner@example.com"}'
```

### 4. Domain Onboarding For `profitslocal.com`

Goal: customers can keep utility pages while their own domain/subdomain points to live production.

Tasks:

- Confirm `profitslocal.com` is in the same Cloudflare account as the API token.
- Decide route:
  - customer root domain -> live website
  - customer subdomain like `preview.customer.com` or our preview URL -> utility/revision flow
- Attach domain to Pages project.
- Generate DNS instructions for apex/subdomain.
- Poll DNS and SSL status.
- Write `clients/<slug>/domain.json` or global domain status.

Validation:

```bash
npm run domain:inspect -- profitslocal.com --project profitslocal-live
npm run domain:attach-pages -- --domain profitslocal.com --project profitslocal-live --dry-run
```

### 5. Email Completion Nodes

Goal: every key customer-facing state change sends a clear email.

Already working:

- Payment receipt email path in client webhook.
- Revision received email path in client revision endpoint.
- Router-level accepted/denied email path when `--send-email true` is used.

Still needed:

- Agent dev preview ready email.
- Domain/live launch ready email.
- Extra revision purchase completed email.
- Email delivery/cost ledger events.
- Cold outreach email test with screenshot/video proof.

Validation:

```bash
npm run funnel:route-stripe -- --input /tmp/stripe-event.json --send-email true --dry-run true
npm run finance:report -- --campaign brisbane-restaurants
```

### 6. Menu PDF And Image OCR

Goal: handle restaurants whose menu is a PDF, scanned document, or Google Maps photo.

Tasks:

- Implement `MenuPdfExtractor`.
- Download and store original PDF evidence documents.
- Try text extraction first.
- Fall back to OCRmyPDF for scanned PDFs.
- Fall back to PaddleOCR/image OCR for image menus.
- Convert extracted text into `menu.sections` with source chains.
- Mark OCR confidence clearly.

Validation:

```bash
npm run ocr:pdf -- --input <menu.pdf> --output <searchable.pdf>
npm run extract:menu -- --input <text-or-markdown> --client <slug> --write-evidence
npm run evidence:validate -- --client <slug>
```

### 7. Renderer / Design Quality Pass

Goal: every generated repo stays artifact-driven while the output looks like a real official website, not a data dump.

Tasks:

- Keep website route and menu route separate:
  - website = formal, brand/design-heavy official site
  - menu = minimal mobile menu utility
- Keep Huashu/open-design design briefs in the generation loop.
- Add screenshot-based design QA before outreach.
- Add visual regression artifacts to outreach pack.

Validation:

```bash
npm run clients:sync-artifacts -- --client <slug> --repo-dir <local-client-repo> --build
npm run outreach:capture-assets -- --client <slug>
```

## Suggested Build Order

1. Agent dev-branch execution loop with one Longwang paid activation/revision test.
2. Configure live Pages `AGENT_GITHUB_TOKEN`.
3. `/api/order-status/` and revision-count display on `/revise`.
4. Agent preview-ready and domain-ready customer emails.
5. Domain attach/polling for `profitslocal.com`.
6. Menu PDF/image OCR.
7. More cities: Sydney/Melbourne restaurants.
8. Next niche pilot: roofing/plumbing/dental.

## Blocking Inputs

- A narrowly scoped GitHub token or GitHub App path for workflow dispatch from Pages Functions. Do not use the local broad `gh auth token` unless deliberately accepted as a temporary shortcut.
- Decision on where central automation should persist production state long term:
  - Git repo JSON files for MVP
  - Cloudflare D1 / Supabase / Neon for production
- Confirm whether extra revision purchases should add `+1` to the original entitlement or create a separate one-revision entitlement.
