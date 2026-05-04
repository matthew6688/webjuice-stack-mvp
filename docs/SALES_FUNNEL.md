# Sales Funnel Closed Loop

## Funnel Shape

1. Preview site shows a fixed footer sales bar.
2. Buyer chooses:
   - `$399` one-time website with 3 revisions
   - `$799/year` website with monthly maintenance
3. Current production fallback uses the preview site's own `/checkout` page and Stripe Checkout. The form collects:
   - package
   - business name
   - email
   - preferred domain or subdomain
   - launch notes or requested changes
   - hidden `client_slug`, `repo`, `template`, `preview_url`, `tier`, `amount`, `currency`
4. Stripe success redirects to the client preview site's `/thank-you` page with context in the URL.
5. The checkout endpoint can send a checkout-started notification to Discord.
6. Stripe sends `checkout.session.completed` to `/api/stripe-webhook`.
7. The client webhook verifies the Stripe signature and sends a sales Discord notification.
8. The client webhook dispatches the raw Stripe event to the main repo automation runner when `AGENT_GITHUB_TOKEN` is configured.
9. The automation repo routes the same Stripe event with:
   - `npm run funnel:route-event -- --input stripe-event.json --provider auto`
10. Router writes:
   - normalized submission JSON
   - Stripe revenue ledger event
   - order entitlement with revision quota
   - agent task JSON with target repo and `dev` branch
   - case memory under `data/cases/<clientSlug>/<orderId>/`

Tally remains supported as a provider, but live API creation of the payment block was blocked by Tally's opaque block schema during verification. Keep the provider boundary so Tally can be used manually/MCP later without changing the downstream order/task contracts.

Legacy Tally shape:

1. Tally payment form collects:
   - business name
   - email
   - phone
   - preferred domain or subdomain
   - launch notes or requested changes
   - payment
   - hidden `client_slug`, `repo`, `template`, `preview_url`, `tier`, `amount`, `currency`
2. Tally redirects to the client preview site's `/thank-you` page with hidden context in the URL.
3. Tally webhook posts to `/api/tally-webhook`.
4. Client site webhook sends a Discord notification:
   - sale submissions -> `SALES_DISCORD_WEBHOOK_URL`
   - revision submissions -> `REVISE_DISCORD_WEBHOOK_URL`
5. Automation repo routes the same payload with:
   - `npm run funnel:route-tally -- --input payload.json`
6. Router writes:
   - normalized submission JSON
   - revenue ledger event for sales
   - agent task JSON with target repo and `dev` branch
7. Agent applies changes on `dev`, deploys preview, and posts the updated review link back to the Discord thread.
8. After approval, live/domain automation can attach the customer domain.

## Required Secrets

Do not commit these values.

- `TALLY_API_KEY`
- `TALLY_WEBHOOK_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_ONE_TIME`
- `STRIPE_PRICE_YEARLY`
- `STRIPE_PRICE_EXTRA_REVISION`
- `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `FROM_EMAIL`
- `SALES_DISCORD_WEBHOOK_URL`
- `REVISE_DISCORD_WEBHOOK_URL`
- `AGENT_GITHUB_TOKEN`
- `AGENT_REPO`
- `AGENT_WORKFLOW_ID`
- `AGENT_REF`

Each generated client Pages project also needs:

- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_ONE_TIME`
- `STRIPE_PRICE_YEARLY`
- `STRIPE_PRICE_EXTRA_REVISION`
- `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `FROM_EMAIL`
- `SALES_DISCORD_WEBHOOK_URL`
- `REVISE_DISCORD_WEBHOOK_URL`
- `AGENT_GITHUB_TOKEN`
- `AGENT_REPO`
- `AGENT_WORKFLOW_ID`
- `AGENT_REF`

`AGENT_GITHUB_TOKEN` should be a narrowly scoped token that can dispatch Actions workflows on `matthew6688/webjuice-stack-mvp`. The defaults are:

```text
AGENT_REPO=matthew6688/webjuice-stack-mvp
AGENT_WORKFLOW_ID=route-funnel-event.yml
AGENT_REF=main
```

## First-Party Stripe Checkout

The current generated preview sites use fixed footer checkout links like:

```text
https://<client>-dev.pages.dev/checkout?tier=one_time&client_slug=...
```

The `/checkout` page posts to:

```text
/api/create-checkout-session
```

That Cloudflare Pages Function creates a Stripe Checkout Session and redirects successful payment to:

```text
/thank-you?session_id={CHECKOUT_SESSION_ID}&client_slug=...
```

The webhook endpoint is:

```text
/api/stripe-webhook
```

Validation status:

- Template build passes with `/checkout` and `/thank-you`.
- All five Brisbane client repos build with `/checkout` and `/revise`.
- 5 dev Pages deploys verified `completed/success`.
- Longwang live test created Stripe Checkout Sessions for `$399` and `$100 extra_revision`.
- Longwang `$399` test payment completed and redirected to `/thank-you`.
- Stripe event routing writes a revenue ledger entry and agent task in dry-run and fixture tests.
- Stripe/Resend runtime secrets are configured on the 5 dev Pages projects.
- Central runner local verification wrote sale entitlement, sale task, revision task, and ledger records under `/tmp/central-runner-state`.
- Main repo GitHub Actions secrets are configured for sales Discord, revision Discord, and Resend; dry-run workflow dispatch passes with notification flags enabled.
- `AGENT_GITHUB_TOKEN` is configured and verified on the 5 Brisbane dev/live Pages projects and template dev/live Pages projects.
- Case memory verification wrote sale/revision/denied cases, timeline events, customer messages, context packets, and task case/design protocol fields under `/tmp/case-memory-test`.

## Create Tally Forms

Dry run:

```bash
npm run funnel:create-tally-client-forms -- --client longwang-restaurant-restaurant --dry-run true --publish true
```

Live:

```bash
npm run funnel:create-tally-client-forms -- --client longwang-restaurant-restaurant --publish true
```

The script defaults each form's redirect URL to:

```text
https://<client>-dev.pages.dev/thank-you
```

with query params for `client_slug`, `repo`, `preview_url`, `tier`, and `amount`.

## Route Webhook Payloads

Dry-run sale/revision classification:

```bash
npm run funnel:route-event -- --input /tmp/stripe-event.json --provider auto --dry-run true
npm run funnel:route-event -- --input /tmp/revision.json --provider auto --dry-run true
npm run funnel:route-tally -- --input /tmp/tally-submission.json --dry-run true
```

Write ledger + task:

```bash
npm run funnel:route-tally -- --input /tmp/tally-submission.json
```

Send Discord too:

```bash
npm run funnel:route-tally -- --input /tmp/tally-submission.json --send-discord true
```

GitHub Actions dispatch:

```bash
gh workflow run route-funnel-event.yml --repo matthew6688/webjuice-stack-mvp \
  -f provider=auto \
  -f payload="$(cat /tmp/stripe-event.json)" \
  -f send_discord=false \
  -f send_email=false \
  -f dry_run=true
```

## First-Party Revision Form

The current revision path is not Tally. The fixed footer `Request changes` link points to:

```text
https://<client>-dev.pages.dev/revise?client_slug=...&repo=...
```

The `/revise` page posts to:

```text
/api/revision-request/
```

Mandatory customer fields:

- `order_id`: Stripe Checkout Session ID from `/thank-you`
- `email`: same email used at checkout
- `requested_changes`

Context fields:

- `client_slug`
- `repo`
- `template`
- `preview_url`
- optional `reference_url`

The client endpoint sends a receipt email and Discord notification, then dispatches to the central automation runner when `AGENT_GITHUB_TOKEN` is configured. It still supports `AGENT_WEBHOOK_URL` as a fallback for a future central HTTP endpoint.

## Revision Repo Lookup

The first-party revision form carries hidden context fields, but these are not proof of ownership. The backend match requires:

1. `orderId`
2. checkout `email`

After that match succeeds, `repo`, `client_slug`, and `preview_url` determine the work target.

The generated task always targets:

```json
{
  "branch": "dev",
  "repo": "matthew6688/<client_slug>"
}
```

The agent must push only to `dev` for customer review. Final live deployment happens only after approval.

## Case Memory

Every routed sale, accepted revision, and denied revision maintains a private case folder in the main automation repo:

```text
data/cases/<clientSlug>/<orderId>/
  case.json
  context-packet.json
  timeline.jsonl
  decisions.jsonl
  customer-messages.jsonl
  agent-runs.jsonl
  artifacts/
```

`case.json` is the current state. `timeline.jsonl` is the audit trail. `customer-messages.jsonl` preserves customer wording from checkout/revision forms. `decisions.jsonl` is reserved for human approvals and locked decisions. `agent-runs.jsonl` is where execution agents should append what they read, changed, verified, and pushed.

Routed agent tasks include:

- `case.contextPath`
- `requiredContext` for evidence/content/design/brand/checkout files
- `designProtocol.requiredSkill = huashu-design`
- `allowedFiles`
- constraints that prevent unverified menu/address/phone/hour changes

Regenerate or inspect an agent context packet:

```bash
npm run case:context -- --case data/cases/<client>/<order>/case.json
```

Run a queued task against a local client repo:

```bash
npm run agent:run-task -- \
  --task data/agent-tasks/<client>/<task>.json \
  --repo-dir /tmp/profitslocal-repos/<client> \
  --execute true
```

Push to the customer review branch only when ready:

```bash
npm run agent:run-task -- \
  --task data/agent-tasks/<client>/<task>.json \
  --repo-dir /tmp/profitslocal-repos/<client> \
  --execute true \
  --checkout true \
  --push true
```

Complete the customer review handoff in one command:

```bash
npm run agent:complete-task -- \
  --task data/agent-tasks/<client>/<task>.json \
  --repo-dir /tmp/profitslocal-repos/<client> \
  --execute true \
  --checkout true \
  --push true \
  --check-deploy true \
  --send-email true
```

After customer approval, publish the reviewed dev tree to live:

```bash
npm run agent:publish-approved -- \
  --task data/agent-tasks/<client>/<task>.json \
  --repo-dir /tmp/profitslocal-repos/<client> \
  --execute true \
  --push true \
  --check-deploy true \
  --send-email true
```

This does not merge `dev` into `main`. Some generated client repos have separate `dev` and `main` histories, so the publisher creates a new `main` commit whose tree matches approved `dev`, preserving main history without force-pushing.

The customer-facing approval page is:

```text
https://<client>-dev.pages.dev/approve?order_id=cs_...&email=owner@example.com
```

It posts to `/api/approval-request/`, which dispatches the main repo `publish-approved.yml` workflow. The workflow resolves the case by `client_slug + order_id`, verifies the submitted checkout email, then publishes the latest task recorded on that case.

## Revision Entitlements

Paid orders create an entitlement record under:

```text
data/funnel/orders/<clientSlug>/<orderId>.json
```

Current policy:

- `one_time`: 3 lifetime revision requests after purchase.
- `yearly_maintenance`: 1 maintenance request per monthly period.
- Extra revision: `$100` per additional revision request.
- Checkout launch notes are activation scope and do not consume a revision.
- A revision request must match an active entitlement with both `orderId` and checkout `email`; `client_slug` and `repo` are context, not proof.

When a revision request arrives:

1. Router requires both `orderId` and checkout `email`.
2. Router finds the matching active entitlement.
3. If quota remains, it increments `revisionUsed`, appends a `revisionEvents[]` audit entry, and creates a `revision` agent task.
4. If quota is exhausted, it writes a `revision_denied` submission record and does not create an agent task.

## Customer Email Notifications

Use Resend for customer-facing state changes. Do not rely only on Discord.

Email nodes:

- Payment completed: send order ID, package, preview link, and revision form link. Implemented in `/api/stripe-webhook`.
- Revision form received: send receipt of submission and explain that order ID + email will be matched. Implemented in `/api/revision-request/`.
- Revision accepted by backend: send `revisionUsed/revisionLimit`, dev-preview expectation, and order ID. Implemented in router when `--send-email true`; central runner can execute it when workflow secrets are configured.
- Revision denied: send the reason and a `$100` extra revision checkout link. Implemented in router when `--send-email true`; central runner can execute it when workflow secrets are configured.
- Agent dev preview ready: send dev review link after build/QA passes. Implemented in `npm run agent:complete-task` when `--send-email true`.
- Domain/live launch ready: send DNS/live-domain instructions. Not built.
- Live published: send live site link after approved `dev` tree is published to `main`. Implemented in `npm run agent:publish-approved` when `--send-email true`.

The customer-facing pages can remain available on our preview/domain even when the customer points their own domain at the live site. They should be treated as account/order utility pages, not restaurant content pages.

Verification command:

```bash
npm run funnel:route-tally -- --input /tmp/revision.json --entitlements-dir /tmp/orders --dry-run true
```
