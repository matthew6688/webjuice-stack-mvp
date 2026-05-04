# Tally MCP + Payment Forms

## Current Decision

Tally supports a remote MCP server at:

```text
https://api.tally.so/mcp
```

This repository does not depend on MCP being available inside the current agent runtime. Instead, it supports two paths:

1. MCP-assisted setup: generate a precise prompt and run it in an MCP-capable client.
2. API setup: create payment form payloads or live forms with `TALLY_API_KEY`.

This keeps the funnel portable across Codex, Claude Code, Cursor, Hermes, OpenClaw, or any later agent runtime.

## Why The Current Codex Session Cannot Directly Use Tally MCP

The Tally MCP server exists, but this Codex session only exposes the MCP servers/connectors that are preconfigured for the workspace. Tally is not in the active connector list, so the agent cannot call Tally MCP tools directly from this session.

That is a runtime/tooling limitation, not a Tally product limitation.

## Recommended Tally Form Shape

Create one Tally payment form per price tier:

| Tier | Price | Copy |
|---|---:|---|
| `one_time` | `$399` | One-time website with 3 revisions |
| `yearly_maintenance` | `$799` | Website plus monthly maintenance for one year |

Each form should include:

- Business name, required
- Email, required
- Phone, optional
- Preferred domain, optional
- Launch notes or requested changes, optional
- Payment block with the exact static amount
- Hidden fields:
  - `client_slug`
  - `repo`
  - `template`
  - `preview_url`
  - `campaign_id`
  - `tier`
  - `amount`
  - `currency`

The webhook endpoint should be:

```text
https://<your-pages-domain>/api/tally-webhook
```

## Generate The MCP Prompt

```bash
npm run funnel:create-tally-payment-forms -- \
  --client longwang-restaurant-restaurant \
  --mcp-prompt true \
  --webhook-url https://profitslocal.com/api/tally-webhook \
  --thank-you-url https://profitslocal.com/thank-you
```

Paste the generated prompt into a client that has Tally MCP connected.

## Dry-Run API Payloads

```bash
npm run funnel:create-tally-payment-forms -- \
  --client longwang-restaurant-restaurant \
  --dry-run true
```

This writes:

```text
clients/<clientSlug>/funnel/tally-payment-form-payloads.json
```

Use this to inspect the exact Tally `PAYMENT` and `HIDDEN_FIELDS` blocks before creating live forms.

## Live API Creation

When ready, put the key in local env first:

```bash
cp .env.example .env.local
```

Then edit `.env.local`:

```text
TALLY_API_KEY=tly-...
TALLY_WEBHOOK_URL=https://profitslocal.com/api/tally-webhook
TALLY_THANK_YOU_URL=https://profitslocal.com/thank-you
TALLY_TIER_PRICES={"one_time":399,"yearly_maintenance":799}
```

Validate the funnel env:

```bash
npm run check:env -- --workflow funnel
```

Create live forms:

npm run funnel:create-tally-payment-forms -- \
  --client longwang-restaurant-restaurant \
  --publish true \
  --webhook-url https://profitslocal.com/api/tally-webhook \
  --thank-you-url https://profitslocal.com/thank-you
```

Notes:

- Tally API can create the form and webhook.
- Payment collection still requires the Tally workspace payment settings to be correctly configured.
- Do not commit `.env.local` or `TALLY_API_KEY`.

## Verification

```bash
npm run funnel:record-tally -- \
  --input /tmp/tally-payment-submission.json \
  --ledger /tmp/webjuice-ledger.jsonl \
  --campaign brisbane-restaurants

npm run agent:create-task -- \
  --tally /tmp/tally-payment-submission.json \
  --queue /tmp/webjuice-agent-tasks \
  --campaign brisbane-restaurants
```

Expected result:

- Revenue event is recorded in the finance ledger.
- A standard agent task is created in `pending`.

## Update Checkout Artifacts With Real Tally URLs

After MCP/API returns the public form URLs, update the client checkout artifacts:

```bash
npm run funnel:update-checkout-urls -- \
  --all clients \
  --one-time-url https://tally.so/r/<one-time-form> \
  --yearly-url https://tally.so/r/<yearly-form> \
  --feedback-url https://tally.so/r/<feedback-form>
```

The script preserves each preview site's hidden fields, so every URL still carries `client_slug`, `repo`, `preview_url`, `tier`, `amount`, and `currency`.
