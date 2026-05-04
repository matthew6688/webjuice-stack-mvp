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
8. The automation repo routes the same Stripe event with:
   - `npm run funnel:route-stripe -- --input stripe-event.json`
9. Router writes:
   - normalized submission JSON
   - Stripe revenue ledger event
   - agent task JSON with target repo and `dev` branch

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
- `STRIPE_WEBHOOK_SECRET`
- `SALES_DISCORD_WEBHOOK_URL`
- `REVISE_DISCORD_WEBHOOK_URL`

Each generated client Pages project also needs:

- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_ONE_TIME`
- `STRIPE_PRICE_YEARLY`
- `STRIPE_WEBHOOK_SECRET`
- `SALES_DISCORD_WEBHOOK_URL`
- `REVISE_DISCORD_WEBHOOK_URL`

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
- All five Brisbane client repos build with `/checkout`.
- Stripe event routing writes a revenue ledger entry and agent task in dry-run and fixture tests.
- Live paid activation needs Stripe env vars configured in Cloudflare Pages.

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

## Revision Repo Lookup

The feedback form and payment form both carry hidden fields. The router uses this order:

1. `repo`
2. `client_slug`
3. `preview_url`

The generated task always targets:

```json
{
  "branch": "dev",
  "repo": "matthew6688/<client_slug>"
}
```

The agent must push only to `dev` for customer review. Final live deployment happens only after approval.
