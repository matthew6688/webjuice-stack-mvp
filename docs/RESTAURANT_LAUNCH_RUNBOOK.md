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
| Live Discord website task thread pickup | Done | `npm run hermes:smoke-website-agent-handoff -- --send true --client opa-bar-mezze-restaurant --repo matthew6688/opa-bar-mezze-restaurant --company "Opa Bar & Mezze"` |
| Controlled Opa paid/revision route with Resend + Discord | Done | Temp run using `matthew6688@gmail.com`, `/tmp/profitslocal-opa-controlled`, and Stripe test order `cs_test_controlled_opa_1777978600` |
| Revision UX locks order/email and carries attachment summary | Done | `npm run smoke:revision-request`, template build, and Opa revise page QA screenshot |
| Generated Brisbane repos synced from latest template | Done | All 5 generated repos passed `npm run smoke:revision-request`, `npm run smoke:approval-request`, and `npm run build` locally; all 5 `Deploy Dev` GitHub Actions completed success |

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
4. Website task handoff is written to a dedicated `#website-tasks` thread named from the business name and order ID.
5. Revision/approval/publish updates reuse that same website task thread.
6. Agent works only on `dev`.
7. Customer reviews the dev preview.
8. Fixed footer shows `Approve site`, `Request revision`, revision usage, and `Buy extra revision`.
9. `/approve` uses `orderId + checkout email` and dispatches `publish-approved.yml`.
10. `/revise` uses read-only prefilled `orderId + checkout email`, consumes entitlement, carries attachment summaries, and creates a revision task.
11. `$100` extra revision purchase uses `parent_order_id` and adds `+1` to the original entitlement.
12. Live publish happens only after approval.

## Latest Controlled Smoke

Date: 2026-05-05.

- Client: Opa Bar & Mezze.
- Test email: `matthew6688@gmail.com`.
- Paid order: `cs_test_controlled_opa_1777978600`.
- Website task thread: `Opa-Bar-Mezze-sale-cs_test_controlled_opa_1777978600`.
- Result: payment route created entitlement `0/3`, temp revenue ledger `$399`, case memory, Resend receipt, and a dedicated website task thread.
- Revision result: same `orderId + email` consumed quota to `1/3`, sent Resend revision email, and reused the same website task thread.
- Agent pickup: `website-agent` replied in-thread, read case/task files, and loaded Huashu/open-design skills.
- Isolation: state was written under `/tmp/profitslocal-opa-controlled`, not production `data/`.
- Discord UI note: `#website-tasks` is a text channel. Website automation now lets Hermes auto-create threads from the parent task message, matching the thread display used by the other Hermes text channels.

## Latest Generated Repo Sync

Date: 2026-05-05.

Synced `webjuice-restaurant` revision/domain/funnel UX to generated dev branches:

- Babylon Brisbane: `66191fd`
- Chu The Phat: `7fffc83`
- Joey's: `82ac954`
- Longwang Restaurant: `723b4e1`
- Opa Bar & Mezze: `15da964`

Verification:

- Each repo passed `npm run smoke:revision-request`.
- Each repo passed `npm run smoke:approval-request`.
- Each repo passed `npm run build`.
- Each repo's `Deploy Dev` workflow completed with `success`.
- Deployed `/revise/` and `/domain-help/` pages return HTTP 200 on all 5 dev previews.

## Remaining Backlog

- Run one real Stripe test order through the deployed Opa preview after template promotion.
- Complete cold outreach live test to owner-controlled inbox.
- Add next restaurant city only after the Brisbane/Opa loop remains stable.
- Dashboard planning can resume after restaurant loop stability.
