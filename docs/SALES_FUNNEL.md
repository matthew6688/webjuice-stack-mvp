# Sales Funnel Closed Loop

## Funnel Shape

1. Preview site shows a fixed footer sales bar.
2. Buyer chooses:
   - `$399` one-time website with 3 revisions
   - `$799/year` website with monthly maintenance
3. Tally payment form collects:
   - business name
   - email
   - phone
   - preferred domain or subdomain
   - launch notes or requested changes
   - payment
   - hidden `client_slug`, `repo`, `template`, `preview_url`, `tier`, `amount`, `currency`
4. Tally redirects to the client preview site's `/thank-you` page with hidden context in the URL.
5. Tally webhook posts to `/api/tally-webhook`.
6. Client site webhook sends a Discord notification:
   - sale submissions -> `SALES_DISCORD_WEBHOOK_URL`
   - revision submissions -> `REVISE_DISCORD_WEBHOOK_URL`
7. Automation repo routes the same payload with:
   - `npm run funnel:route-tally -- --input payload.json`
8. Router writes:
   - normalized submission JSON
   - revenue ledger event for sales
   - agent task JSON with target repo and `dev` branch
9. Agent applies changes on `dev`, deploys preview, and posts the updated review link back to the Discord thread.
10. After approval, live/domain automation can attach the customer domain.

## Required Secrets

Do not commit these values.

- `TALLY_API_KEY`
- `TALLY_WEBHOOK_URL`
- `SALES_DISCORD_WEBHOOK_URL`
- `REVISE_DISCORD_WEBHOOK_URL`

Each generated client Pages project also needs:

- `SALES_DISCORD_WEBHOOK_URL`
- `REVISE_DISCORD_WEBHOOK_URL`

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
