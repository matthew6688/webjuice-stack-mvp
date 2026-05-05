# Restaurant Launch Runbook

Scope: restaurant website/menu loop only.

## Current Launch Checklist

| Task | Status | Verification |
|---|---|---|
| Customer approval resolves same case/thread | Done | `npm run agent:test-approval-resolution` |
| Template `/api/approval-request/` dry-dispatches publish | Done | `npm run smoke:approval-request` in `webjuice-restaurant` |
| Preview footer shows approve/revise/extra revision controls | Done | `npm run qa:preview-sales-bar -- --dist-dir /Users/matthew/Developer/webjuice-restaurant/dist` |
| Template `/api/revision-request/` dry-dispatches route workflow | Done | `npm run smoke:revision-request` in `webjuice-restaurant` |
| Central revision routing consumes quota and reuses website thread | Done | `npm run hermes:test-website-agent-closure` |
| Customer review email gate requires context/design/QA/dev URL | Done | `npm run agent:test-pre-review-gate` |
| Opa full-loop live simulation | Done | `npm run qa:opa-full-loop-live-sim` |
| Domain/subdomain guidance in page and emails | Done | `npm run funnel:test-domain-email-guidance` and template build |
| `$100` extra revision increments original entitlement | Done | `npm run funnel:test-extra-revision-entitlement` |

## Standard Verification Sequence

Run from `google-map-website`:

```bash
npm run agent:test-approval-resolution
npm run agent:test-pre-review-gate
npm run funnel:test-domain-email-guidance
npm run funnel:test-extra-revision-entitlement
npm run hermes:test-website-agent-closure
npm run qa:opa-full-loop-live-sim
```

Run from `/Users/matthew/Developer/webjuice-restaurant`:

```bash
npm run smoke:approval-request
npm run smoke:revision-request
npm run build
```

For footer QA, first build the template with Opa artifacts:

```bash
WEBJUICE_CHECKOUT_PATH=/Users/matthew/Developer/google-map-website/clients/opa-bar-mezze-restaurant/funnel/checkout.json \
WEBJUICE_CONTENT_PATH=/Users/matthew/Developer/google-map-website/clients/opa-bar-mezze-restaurant/content.restaurant.json \
WEBJUICE_DESIGN_PATH=/Users/matthew/Developer/google-map-website/clients/opa-bar-mezze-restaurant/design.restaurant.json \
npm run build
```

Then run from `google-map-website`:

```bash
npm run qa:preview-sales-bar -- --dist-dir /Users/matthew/Developer/webjuice-restaurant/dist
```

## Customer-Facing Flow

1. Customer pays on preview `/checkout`.
2. Stripe webhook routes paid order to central automation.
3. Central automation creates entitlement, case memory, agent task, Discord website thread, and revenue ledger event.
4. Agent works only on `dev`.
5. Customer reviews the dev preview.
6. Fixed footer shows `Approve site`, `Request revision`, revision usage, and `Buy extra revision`.
7. `/approve` uses `orderId + checkout email` and dispatches `publish-approved.yml`.
8. `/revise` uses `orderId + checkout email`, consumes entitlement, and creates a revision task.
9. `$100` extra revision purchase uses `parent_order_id` and adds `+1` to the original entitlement.
10. Live publish happens only after approval.

## Remaining Backlog

- Complete cold outreach live test to owner-controlled inbox.
- Promote latest `webjuice-restaurant` template changes through generated restaurant repos.
- Run one real Stripe test order through the deployed Opa preview after template promotion.
- Add next restaurant city only after the Brisbane/Opa loop remains stable.
- Dashboard planning can resume after restaurant loop stability.
