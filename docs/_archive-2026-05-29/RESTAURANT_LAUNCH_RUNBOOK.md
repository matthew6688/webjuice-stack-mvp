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
| Customer review email gate requires context/design/QA/dev URL/delivery QA | Done | `npm run agent:test-pre-review-gate` and `npm run qa:test-delivery-qa` |
| Opa full-loop live simulation | Done | `npm run qa:opa-full-loop-live-sim` |
| Domain/subdomain guidance in page and emails | Done | `npm run funnel:test-domain-email-guidance` and template build |
| `$100` extra revision increments original entitlement | Done | `npm run funnel:test-extra-revision-entitlement` |
| Live Discord website task thread pickup | Done | `npm run hermes:smoke-website-agent-handoff -- --send true --client opa-bar-mezze-restaurant --repo matthew6688/opa-bar-mezze-restaurant --company "Opa Bar & Mezze"` |
| Controlled Opa paid/revision route with Resend + Discord | Done | Temp run using `matthew6688@gmail.com`, `/tmp/profitslocal-opa-controlled`, and Stripe test order `cs_test_controlled_opa_1777978600` |
| Revision UX locks order/email and carries attachment summary | Done | `npm run smoke:revision-request`, template build, and Opa revise page QA screenshot |
| Generated Brisbane repos synced from latest template | Done | All 5 generated repos passed `npm run smoke:revision-request`, `npm run smoke:approval-request`, and `npm run build` locally; all 5 `Deploy Dev` GitHub Actions completed success |
| Cloudinary revision attachment upload path | Done | `npm run smoke:upload-attachment` in template/generated repos; deployed endpoints return safe 503 until Cloudinary secrets are configured |
| Deployed Opa Stripe checkout and thank-you handoff | Done | Stripe test session `cs_test_b1NsMZTui0nhviPT4xGh6r5orYmCzLQjeDQCc5qnKgYe3BDUb0bb7etXY7` paid/succeeded and redirected to `/thank-you` |
| Deployed Opa attachment + revision route | Done | Opa deployed `/api/upload-attachment/` returned a Cloudinary URL; revision request consumed quota to `1/3`, routed to website thread `1501197070319616011`, and sent Resend email `1ca45453-2d6e-4184-9ca8-8a62dd112531` |
| Cold outreach owner-inbox live send | Done | `npm run outreach:validate-pack -- --client opa-bar-mezze-restaurant`; `npm run outreach:send-cold-email -- --client opa-bar-mezze-restaurant --to matthew6688@gmail.com --dry false` returned Resend id `1ad4a572-be28-4103-8717-be674ccfa9ce` |
| Approval publish live-safe dry run | Done | `npm run agent:test-approval-resolution`; `npm run agent:publish-approved -- --task data/agent-tasks/opa-bar-mezze-restaurant/revision-rev_1777985753467.json ... --execute false --push false` wrote `data/agent-runs/opa-approval-publish-dry-run.json` |
| Funnel route idempotency | Done | `npm run funnel:test-route-idempotency`; duplicate Opa workflow run `25376342058` returned `duplicate: true` and skipped task/email/Discord/ledger |
| ProfitsLocal launch route resolver | Done | `npm run domain:test-launch-route`, `npm run domain:inspect`, `npm run domain:pages-status`, and `https://profitslocal.com/` HTTP 200 |
| Opa free hosted domain | Done | `opa-controlled.profitslocal.com` CNAME created and attached to `opa-bar-mezze-restaurant-live`; Pages custom domain status `active`; forced-resolution HTTPS returns 200 |
| Domain smoke cleanup | Done | `npm run domain:cleanup` dry-run guard rejects non-smoke domains; `opa-live-smoke*.profitslocal.com` Pages custom domains and DNS CNAMEs were deleted; `opa-controlled.profitslocal.com` and `menu.feng-talk.com` still return HTTP 200 |
| Opa mobile menu polish | Done | Opa `dev` commit `8501ac1`; `Deploy Dev` success; deployed `/menu/` and `/revise/` return HTTP 200 |
| Production-like Opa review and live publish | Done | QA screenshots attached; review email Resend id `73281496-4628-449a-8ff1-89cb6f81a5fd`; live commit `418519767e480bf0bd0b8948e515851528f658d9`; Deploy Live run `25382781613` success; live email Resend id `7f832951-4d8b-4ed8-8d25-627f5d0a2129`; live `/` and `/menu/` HTTP 200 |
| Automatic review screenshots | Done | Temp Opa auto-QA smoke ran `agent:complete-task --send-email true` without `--qa-screenshots`; captured 2 screenshots, 0 console errors, and pre-review gate passed |
| Domain status emails | Done | `npm run domain:test-request` asserts active, waiting DNS, and root-domain-review email text; `domain-request.yml` passes Resend env and can send status emails |
| Main repo Node 24 workflow hardening | Done | No remaining `actions/checkout@v4`, `actions/setup-node@v4`, or `node-version: 22` in `.github/workflows` |
| Generated repo Node 24 workflow hardening | Done | 5 generated restaurant repos updated on `dev` and `main`; all 10 `Deploy Dev` / `Deploy Live` runs completed success |
| Two-restaurant repeat verification | Done | Babylon Brisbane and Chu The Phat dev/live `/`, `/menu/`, `/revise/`, `/domain-help/` return HTTP 200; outreach packs validate; Playwright screenshots captured with 0 console errors; local Ollama audits pass score 100 |

## Standard Verification Sequence

Run from `google-map-website`:

```bash
npm run agent:test-approval-resolution
npm run agent:test-pre-review-gate
npm run funnel:test-domain-email-guidance
npm run funnel:test-extra-revision-entitlement
npm run funnel:test-route-idempotency
npm run domain:test-launch-route
npm run domain:test-request
npm run hermes:test-website-agent-closure
npm run qa:opa-full-loop-live-sim
```

## Domain Launch Paths

Use these paths in this order unless the customer explicitly needs something else:

1. Free ProfitsLocal subdomain, such as `<client>.profitslocal.com`.
   This is the fastest path because we control DNS. `/domain-setup` dispatches `domain-request.yml`; the workflow upserts the CNAME, attaches the Pages custom domain, polls Pages status, and writes central state.
2. Customer subdomain, such as `menu.customer.com`.
   The customer adds one CNAME to `<client>-live.pages.dev`. Our status flow waits until DNS points at the Pages target, then attaches Cloudflare Pages.
3. Customer root domain, such as `customer.com`.
   Do not auto-change this. Root domains can affect existing websites and email. Run DNS/email audit first, then choose flattened CNAME/ALIAS/ANAME, `www`, or another provider-specific path.
4. `profitslocal.com/<client>` subpage.
   Future router only. Do not sell this as a production launch URL until the root ProfitsLocal router exists.

Useful commands:

```bash
npm run domain:request -- --client <client> --order <order> --email <email> --domain <domain> --project <client>-live --execute false --write false
npm run domain:pages-status -- --project <client>-live --domain <domain>
npm run domain:cleanup -- --domain <smoke-domain> --project <client>-live
npm run domain:cleanup -- --domain <smoke-domain> --project <client>-live --execute true
```

Cleanup safety:

- `domain:cleanup` defaults to dry-run.
- It refuses to clean domains that do not include `smoke` unless `--allowNonSmoke true` is supplied.
- Always verify a real production domain after cleanup with `domain:pages-status` and an HTTP `200` check.
- `domain-request.yml` can send customer status emails when `send_email` is true and `RESEND_API_KEY` is configured. The email covers `active`, `waiting_for_customer_dns`, and `needs_root_domain_review`.

Run from `/Users/matthew/Developer/webjuice-restaurant`:

```bash
npm run smoke:approval-request
npm run smoke:revision-request
npm run smoke:upload-attachment
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

## Latest Deployed Checkout Smoke

Date: 2026-05-05.

- Client: Opa Bar & Mezze.
- Test email: `matthew6688@gmail.com`.
- Paid order: `cs_test_b1NsMZTui0nhviPT4xGh6r5orYmCzLQjeDQCc5qnKgYe3BDUb0bb7etXY7`.
- Stripe status: `paid`, payment intent `succeeded`, amount `$399`.
- Redirect: `https://opa-bar-mezze-restaurant-dev.pages.dev/thank-you/` with order, email, domain, preview, approve, and revision context.
- Central workflow wrote production case/order/task/ledger state to `main`.
- Duplicate workflow verification: run `25376342058` returned `duplicate: true`, did not create a second task, did not append a second ledger event, and did not send email/Discord.

## Latest Generated Repo Sync

Date: 2026-05-05.

Synced `webjuice-restaurant` revision/domain/funnel/attachment UX and Cloudinary unsigned-upload support to generated dev branches:

- Template `webjuice-restaurant`: `26a81a5`
- Babylon Brisbane: `12f9952`
- Chu The Phat: `e3295bc`
- Joey's: `97a54f3`
- Longwang Restaurant: `ba59139`
- Opa Bar & Mezze: `67e9d0f`

Verification:

- Each repo passed `npm run smoke:upload-attachment`.
- Each repo passed `npm run smoke:revision-request`.
- Each repo passed `npm run smoke:approval-request`.
- Each repo passed `npm run build`.
- Each repo's `Deploy Dev` workflow completed with `success`.
- Deployed `/revise/` and `/domain-help/` pages return HTTP 200 on all 5 dev previews.
- Opa deployed `/menu/` returns HTTP 200 after mobile menu navigation polish.
- Cloudinary runtime secrets are present on template dev/live and all 5 generated dev/live Pages projects: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_UPLOAD_PRESET`, `CLOUDINARY_UPLOAD_FOLDER`, and `CLOUDINARY_UPLOAD_MAX_BYTES`.
- `/domain-help` is now explicit about the four address routes: free ProfitsLocal subdomain, customer subdomain, customer root domain, and future ProfitsLocal subpage/router. It displays current requested domain/query params and exact Pages target when launched from thank-you/review links.

## Latest Live Attachment/Revision/Outreach Smoke

Date: 2026-05-05.

- Opa deployed upload endpoint: `https://opa-bar-mezze-restaurant-dev.pages.dev/api/upload-attachment/`.
- Upload result: HTTP 200 with Cloudinary raw asset URL under `profitslocal/revision-attachments/opa-bar-mezze-restaurant/<order>/`.
- Order used: `cs_test_b1NsMZTui0nhviPT4xGh6r5orYmCzLQjeDQCc5qnKgYe3BDUb0bb7etXY7`.
- Order status before revision: `used: 0`, `limit: 3`, `remaining: 3`.
- Revision result: accepted, `used: 1`, `limit: 3`, `remaining: 2`.
- Revision task: `data/agent-tasks/opa-bar-mezze-restaurant/revision-rev_1777985753467.json`.
- Website task thread reused: `1501197070319616011`.
- Revision route workflow: GitHub Actions run `25377652995`, `completed/success`.
- Customer route email: Resend id `1ca45453-2d6e-4184-9ca8-8a62dd112531`.
- Agent completion: pushed dev and notified Discord; review email was intentionally skipped by the pre-review gate because the smoke task had no QA screenshots.
- Cold outreach pack validation: `Status: ok`, desktop screenshot, mobile screenshot, and `outreach/demo.mp4` present.
- Cold outreach owner-inbox live send: Resend id `1ad4a572-be28-4103-8717-be674ccfa9ce`.
- Approval resolution: `orderId + checkout email` resolved to the same case, latest revision task, website thread, `sourceBranch: dev`, and `targetBranch: main`.
- Approval publish dry run: `data/agent-runs/opa-approval-publish-dry-run.json`, `dryRun: true`, `pushed: false`, all publish planning steps ok.

## Latest Production-Like Review/Live Publish

Date: 2026-05-06 Brisbane time.

- Client: Opa Bar & Mezze.
- Test email: `matthew6688@gmail.com`.
- Order: `cs_test_b1NsMZTui0nhviPT4xGh6r5orYmCzLQjeDQCc5qnKgYe3BDUb0bb7etXY7`.
- Revision task: `data/agent-tasks/opa-bar-mezze-restaurant/revision-rev_1777985753467.json`.
- QA screenshots: `data/cases/opa-bar-mezze-restaurant/cs_test_b1NsMZTui0nhviPT4xGh6r5orYmCzLQjeDQCc5qnKgYe3BDUb0bb7etXY7/artifacts/review-desktop.png` and `review-mobile.png`.
- Review email run: `data/agent-runs/opa-review-email-live-smoke.json`; pre-review gate `ok: true`; Resend id `73281496-4628-449a-8ff1-89cb6f81a5fd`.
- Live publish run: `data/agent-runs/opa-live-publish-smoke.json`; pushed `main` commit `418519767e480bf0bd0b8948e515851528f658d9`.
- Deploy Live: GitHub Actions run `25382781613`, `completed/success`.
- Live email Resend id: `7f832951-4d8b-4ed8-8d25-627f5d0a2129`.
- Live URL checks: `https://opa-controlled.profitslocal.com/` HTTP 200 and `https://opa-controlled.profitslocal.com/menu/` HTTP 200.
- Domain status: `npm run domain:pages-status -- --project opa-bar-mezze-restaurant-live --domain opa-controlled.profitslocal.com` returns `active`.
- Cost note: these two Resend sends returned `ledgerEvent: null` because `RESEND_EMAIL_UNIT_COST` was not configured for this run. Configure email/runtime cost estimates before the next ROI run.

## Latest Auto-QA Screenshot Smoke

Date: 2026-05-06 Brisbane time.

- Ran `agent:complete-task --send-email true` against a temporary copy of the Opa repo and temporary case root.
- Did not pass `--qa-screenshots`.
- Set `RESEND_API_KEY=` for the smoke so no real customer email was sent.
- Result: task build `ok`, automatic QA capture `ok`, 2 screenshots generated, 0 console errors, and pre-review gate passed with no missing fields.

## Latest Generated Repo Node 24 Hardening

Date: 2026-05-06 Brisbane time.

Updated these generated repos on both `dev` and `main`:

- Babylon Brisbane: dev `92f5ec6`, main `dc5ad00`
- Chu The Phat: dev `3e59275`, main `4ae786b`
- Joey's: dev `0d172f1`, main `3850547`
- Longwang Restaurant: dev `d724122`, main `3605311`
- Opa Bar & Mezze: dev `232f380`, main `1f38991`

Verification:

- No generated repo workflow still references `actions/checkout@v4`, `actions/setup-node@v4`, `node-version: 22`, or `cloudflare/wrangler-action`.
- All 5 repos passed local `npm run build`.
- All 5 `Deploy Dev` runs completed success:
  - Babylon `25384915647`
  - Chu `25384918127`
  - Joey's `25384923325`
  - Longwang `25384926883`
  - Opa `25384930832`
- All 5 `Deploy Live` runs completed success:
  - Babylon `25384915591`
  - Chu `25384920204`
  - Joey's `25384923485`
  - Longwang `25384928412`
  - Opa `25384931904`

## Latest Two-Restaurant Repeat Verification

Date: 2026-05-06 Brisbane time.

Restaurants:

- Babylon Brisbane
- Chu The Phat

Verification:

- Dev and live URLs for `/`, `/menu/`, `/revise/`, and `/domain-help/` all returned HTTP 200.
- `npm run outreach:validate-pack -- --client babylon-brisbane-restaurant` returned `Status: ok`.
- `npm run outreach:validate-pack -- --client chu-the-phat-restaurant` returned `Status: ok`.
- Playwright desktop/mobile screenshot capture passed for both restaurants with 2 screenshots each and 0 console errors.
- Local Ollama audit passed for both:
  - Babylon: `qwen3.5:9b`, score 100, 0 findings, 3 sections / 11 items.
  - Chu: `qwen3.5:9b`, score 100, 0 findings, 3 sections / 12 items.

## Remaining Backlog

- Add dedicated `ProfitsLocal Handoff` sender Discord app/token later so `WEBSITE_TASKS_DISCORD_BOT_TOKEN` is not the website-agent bot itself.
- Configure Resend/runtime cost estimates before the next ROI smoke.
- Add next restaurant city only after the Brisbane/Opa loop remains stable.
- Dashboard planning can resume after restaurant loop stability.
