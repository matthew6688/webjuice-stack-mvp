# Sales Funnel Closed Loop

## Funnel Shape

1. Preview site shows a fixed footer sales bar.
2. Buyer chooses:
   - `$399` one-time website with 3 revisions
   - `$799/year` website with monthly maintenance
3. The preview sales bar sends all buyer actions to the official ProfitsLocal funnel on `https://profitslocal.com`. The customer demo site does not host our checkout, FAQ, approval, revision, or domain funnel pages.
4. The official `/checkout` page creates the Stripe Checkout Session. The form collects:
   - package
   - business name
   - email
   - preferred domain or subdomain
   - launch notes or requested changes
   - hidden `client_slug`, `repo`, `template`, `preview_url`, `tier`, `amount`, `currency`
   - hidden attribution fields such as `utm_source`, `utm_medium`, `utm_campaign`, `gclid`, `fbclid`, `msclkid`, `ttclid`, `twclid`, `li_fat_id`, `gbraid`, and `wbraid`
5. Stripe success redirects to the official `/thank-you` page with context in the URL.
6. The checkout endpoint can send a checkout-started notification to Discord.
7. Stripe sends `checkout.session.completed` to `/api/stripe-webhook`.
8. The official webhook verifies the Stripe signature and sends a sales Discord notification.
9. The official webhook dispatches the raw Stripe event to the main repo automation runner when `AGENT_GITHUB_TOKEN` is configured.
10. The automation repo routes the same Stripe event with:
   - `npm run funnel:route-event -- --input stripe-event.json --provider auto`
11. Router writes:
   - normalized submission JSON
   - Stripe revenue ledger event
   - order entitlement with revision quota
   - agent task JSON with target repo and `dev` branch
   - case memory under `data/cases/<clientSlug>/<orderId>/`
12. Agent works on `dev`, not `main/live`.
13. Customer reviews the dev preview URL and clicks either `Approve site` or `Request revision`. Those post-payment controls also point to official `profitslocal.com` pages.
14. Approval publishes the reviewed `dev` tree to `main/live`; revision creates a new dev task if quota remains.

Tally remains supported as a provider, but live API creation of the payment block was blocked by Tally's opaque block schema during verification. Keep the provider boundary so Tally can be used manually/MCP later without changing the downstream order/task contracts.

## Customer Review Surface

The customer-facing review surface is the generated `dev` preview site, not Discord and not an internal dashboard.

Example:

```text
https://<client>-dev.pages.dev/
```

The preview site must keep sales/account controls in a fixed footer/banner. Do not insert checkout, approval, revision, or internal workflow controls into the restaurant's official content, menu, hero, gallery, or brand copy.

Fixed footer/banner buttons:

- `How it works` -> `https://profitslocal.com/checkout?client_slug=<client>&repo=<repo>&preview_url=<preview>#pricing`
- `FAQ` -> `https://profitslocal.com/checkout?client_slug=<client>&repo=<repo>&preview_url=<preview>#faq`
- `Contact` -> `https://profitslocal.com/contact?client_slug=<client>&repo=<repo>&preview_url=<preview>`
- ProfitsLocal logo -> `https://profitslocal.com/` in a new tab
- `$399 one-time` -> `https://profitslocal.com/checkout?...tier=one_time&amount=399`
- `$799/yr` -> `https://profitslocal.com/checkout?...tier=yearly_maintenance&amount=799`
- `Checkout` -> the one-time official checkout URL by default, preserving `client_slug`, `repo`, `template`, `preview_url`, `tier`, `amount`, `currency`, and traffic attribution params.
- After payment only: `Approve site` -> `https://profitslocal.com/approve?order_id=<orderId>&email=<checkoutEmail>&client_slug=<client>&repo=<repo>&preview_url=<preview>`
- After payment only: `Request revision` -> `https://profitslocal.com/revision?order_id=<orderId>&email=<checkoutEmail>&client_slug=<client>&repo=<repo>&preview_url=<preview>`
- After payment only: `Buy extra revision` -> official `$100` Stripe extra revision checkout when needed.

Pre-purchase preview banners must not show `$100 extra revision` or `Request changes`. Those are customer account/review actions and only become visible after the preview URL has a matched `orderId + checkout email`.

Utility pages:

- Official `profitslocal.com` pages use ProfitsLocal branded chrome: official logo, cream/paper/coral/mint palette, hard black borders, and the shared ProfitsLocal header/footer.
- `/checkout` is both the offer/FAQ/pricing page and the Stripe entry. It preserves preview source context through URL params, cookie/localStorage, and hidden fields, so a paid order maps back to the correct demo, repo, and client project.
- `/contact` lets the customer ask a question while preserving the same preview context and attribution.
- `/approve` requires `orderId + checkout email`, then posts to `/api/approval-request/`.
- `/revision` requires `orderId + checkout email`, then posts to `/api/revision-submit`.
  - `/revise` is an official redirect alias for compatibility.
  - When opened from a review email or preview footer, `orderId` and checkout email are prefilled and locked as read-only fields.
  - The page shows trusted plan/revision usage after the backend matches the order.
  - The form accepts multiple attachment selections, uploads them server-side to Cloudinary when Cloudinary env is configured, and forwards Cloudinary URLs to Discord/email/agent routing.
- `/api/order-status/` returns trusted revision usage only after the same match.
- `/domain-help` explains fast ProfitsLocal-hosted launch options plus customer-owned DNS steps.

Customer repo cleanup rule:

- Generated customer repos should only contain the customer website routes, niche routes such as restaurant `/menu`, customer lead forms such as `/contact`, and the fixed preview banner.
- Generated customer repos should not contain ProfitsLocal sales/support routes: `/demo-faq`, `/checkout`, `/thank-you`, `/contact-us`, `/revise`, `/approve`, `/domain-setup`, or `/domain-help`.
- If old links are already circulating, customer repos may include `_redirects` entries that send those paths to official `profitslocal.com` pages. They should not serve local ProfitsLocal funnel HTML.
- Generated customer repos should not contain Stripe, approval, revision, domain, order-status, Tally, or Cloudinary attachment Pages Functions. Those belong to the official ProfitsLocal site and central automation repo.
- `npm run qa:funnel-pages` checks that the customer preview root has the official banner links and that removed local funnel routes are either absent or redirected to official ProfitsLocal pages.

Context handoff rules:

- The demo preview must append project params to every official funnel link: `client_slug`, `repo`, `preview_url`, `template`, `campaign_id`, `tier`, `amount`, and `currency` when available.
- The demo preview should also preserve traffic source params: `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `gclid`, `fbclid`, `msclkid`, `ttclid`, `twclid`, `li_fat_id`, `gbraid`, `wbraid`, `source`, and `ref`.
- The official site stores those values in `pl_funnel_context` plus localStorage, then writes them into hidden fields on checkout/contact/revision/approval/domain forms.
- Stripe metadata and contact notifications include the same context so the sale can be traced back to the exact preview, campaign, repo, and lead source.

The customer may reach these pages from either the review email or the fixed footer/banner on the dev preview.

## Domain Options

Default strategy:

- If the customer leaves the domain blank, use `<client>.profitslocal.com` as the default free hosted domain.
- If the customer asks for `*.profitslocal.com`, use that requested ProfitsLocal subdomain. We create DNS and attach the custom domain; the customer does not touch DNS.
- If the customer asks for their own subdomain, such as `menu.customer.com`, send one CNAME record and attach it in Cloudflare Pages after DNS resolves.
- If the customer asks for their root domain, such as `customer.com`, inspect existing DNS/email first. Use Cloudflare flattened CNAME, ALIAS/ANAME, or `www` fallback depending on their provider.
- If the customer asks for `profitslocal.com/<client>`, treat it as a future directory/router option, not the current production launch path.

Fastest to slowest:

1. `<client>.profitslocal.com` subdomain: fastest production path because we control DNS.
2. Customer subdomain such as `menu.customer.com`: good when they already have a website and want a menu/campaign page. Requires customer DNS access.
3. Customer root domain such as `customer.com`: most official, but slowest because it can affect the existing website and email setup.
4. `profitslocal.com/<client>` subpage: future directory/router path only. Do not present it as an active production launch URL until the root-site router exists.

Example verified on 2026-05-05:

- Requested domain: `opa-controlled.profitslocal.com`.
- DNS: CNAME in the `profitslocal.com` Cloudflare zone to `opa-bar-mezze-restaurant-live.pages.dev`.
- Cloudflare Pages project: `opa-bar-mezze-restaurant-live`.
- Pages custom domain status: `active`.
- Public DNS resolves to Cloudflare edge IPs and forced-resolution HTTP check returns 200.

Keep the dev preview utility pages available after launch so the customer can still approve, request revisions, and buy extra revisions without mixing those controls into the public restaurant site.

Customer-facing automation:

- `/thank-you` links to `/domain-setup` with the order, email, requested domain, and client slug already filled from checkout context.
- `/domain-setup` lets the customer choose free ProfitsLocal subdomain, their own subdomain, or their root domain.
- `/api/domain-request/` dispatches the central `domain-request.yml` workflow.
- `/api/domain-status/` reads central request state from `data/domain/requests/<client>/<requestId>.json`.
- For our free subdomain route, the workflow can create/update DNS and attach Cloudflare Pages automatically. For customer subdomains, it shows the exact CNAME target and waits until DNS is correct. For root domains, it requires manual audit before launch.
- The workflow polls Cloudflare Pages after attach before writing state, so the customer status page is less likely to stay stuck on a stale `pages_pending` result.
- If a request is still `pages_pending` and stale, `/api/domain-status/` dispatches a refresh run and returns `refreshing:true`; the next successful refresh can update the central status to `active`.

Validation:

```bash
npm run domain:test-launch-route
npm run domain:test-request
npm run domain:inspect -- --domain profitslocal.com --project profitslocal-live
npm run domain:pages-status -- --project profitslocal-live --domain profitslocal.com
npm run domain:upsert-cname -- --zone <zone-id> --name <client>.profitslocal.com --target <client>-live.pages.dev --proxied true
npm run domain:attach-pages -- --project <client>-live --domain <client>.profitslocal.com
npm run domain:cleanup -- --domain <smoke-domain>.profitslocal.com --project <client>-live
```

Smoke cleanup:

- Use `npm run domain:cleanup -- --domain <smoke-domain>.profitslocal.com --project <client>-live` for dry-run.
- Add `--execute true` only after the plan shows the expected Pages custom domain and DNS CNAME.
- The script refuses non-smoke domains by default; keep that guard for customer production domains.

## Discord Website Threads

`#website-tasks` is a text channel. Each executable website task is posted as a parent message that mentions `website-agent`; Hermes then auto-creates a thread from that message.

This matches the display behavior of the other Hermes text channels: the thread is visible under the channel, while the task packet stays tied to the parent message. If Hermes auto-threading does not create a thread within the wait window, automation falls back to explicit Discord message-thread creation. Later revisions reuse `case.json.discord.websiteTaskThreadId`.

## Resend For Cold Outreach

Resend is suitable for transactional customer emails after payment/revision/approval. For cold outreach, it can work technically, but deliverability risk is higher.

Recommendation:

- Keep transactional mail on a trusted domain such as `fengtalk.ai`.
- Use a separate outreach domain/subdomain and sender identity for cold email so experiments do not hurt transactional reputation.
- Warm up volume gradually and send first live tests only to owner-controlled inboxes.
- Include proof assets: screenshot, short demo video, preview link, and a clear opt-out line.
- Track costs and replies separately in the ROI ledger.

Legacy Tally shape:

1. Tally payment form collects:
   - business name
   - email
   - phone
   - preferred domain or subdomain
   - launch notes or requested changes
   - payment
   - hidden `client_slug`, `repo`, `template`, `preview_url`, `tier`, `amount`, `currency`
2. Tally redirects to the official `https://profitslocal.com/thank-you` page with hidden context in the URL.
3. Tally webhook posts to the official ProfitsLocal webhook endpoint.
4. ProfitsLocal webhook sends a Discord notification:
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
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_UPLOAD_FOLDER`
- `CLOUDINARY_UPLOAD_MAX_BYTES`

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
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_UPLOAD_FOLDER`
- `CLOUDINARY_UPLOAD_MAX_BYTES`

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

- Template build passes with customer pages only; ProfitsLocal utility pages are not present in the customer template.
- Customer preview banner points to official `profitslocal.com` checkout/contact/FAQ/approval/revision/domain pages.
- Customer demo QA verifies the removed local routes `/demo-faq`, `/checkout`, `/thank-you`, `/contact-us`, `/revise`, `/approve`, `/domain-setup`, and `/domain-help` are not served.
- All five Brisbane client repos previously built with the legacy local utility pages; new generated repos should follow the official-funnel-only cleanup rule.
- 5 dev Pages deploys verified `completed/success`.
- Longwang live test created Stripe Checkout Sessions for `$399` and `$100 extra_revision`.
- Longwang `$399` test payment completed and redirected to `/thank-you`.
- Opa deployed preview `$399` Stripe test payment completed and redirected to `/thank-you` with order, email, preview, domain, approve, and revision context.
- Stripe event routing writes a revenue ledger entry and agent task in dry-run and fixture tests.
- Route workflow is idempotent by dedupe key and submission path; duplicate Opa Stripe payload verification returned `duplicate: true`, skipped agent task/email/Discord/ledger, and committed no new state.
- Stripe/Resend runtime secrets are configured on the 5 dev Pages projects.
- Central runner local verification wrote sale entitlement, sale task, revision task, and ledger records under `/tmp/central-runner-state`.
- Main repo GitHub Actions secrets are configured for sales Discord, revision Discord, and Resend; dry-run workflow dispatch passes with notification flags enabled.
- `AGENT_GITHUB_TOKEN` is configured and verified on the 5 Brisbane dev/live Pages projects and template dev/live Pages projects.
- Case memory verification wrote sale/revision/denied cases, timeline events, customer messages, context packets, and task case/design protocol fields under `/tmp/case-memory-test`.
- Rich & Rare real demo proof on 2026-05-07: the customer repo now keeps the banner only; local ProfitsLocal utility routes were removed and official `profitslocal.com` receives the funnel traffic with context.
- Funnel QA is now repeatable with `npm run qa:funnel-pages`. It checks the homepage sales footer, official ProfitsLocal links, context params, no local order-status dependency, no pre-purchase revision actions, and removed local funnel routes.

Funnel QA commands:

```bash
npm run qa:funnel-pages -- \
  --dist-dir /Users/matthew/Developer/webjuice-generated/rich-and-rare-restaurant/dist \
  --client "Rich & Rare Restaurant"

npm run qa:funnel-pages -- \
  --base-url https://rich-and-rare-restaurant-dev.pages.dev \
  --client "Rich & Rare Restaurant"
```

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
https://profitslocal.com/thank-you
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
  --send-email true \
  --send-discord true
```

After customer approval, publish the reviewed dev tree to live:

```bash
npm run agent:publish-approved -- \
  --task data/agent-tasks/<client>/<task>.json \
  --repo-dir /tmp/profitslocal-repos/<client> \
  --execute true \
  --push true \
  --check-deploy true \
  --send-email true \
  --send-discord true
```

This does not merge `dev` into `main`. Some generated client repos have separate `dev` and `main` histories, so the publisher creates a new `main` commit whose tree matches approved `dev`, preserving main history without force-pushing.

The customer-facing approval page is:

```text
https://<client>-dev.pages.dev/approve?order_id=cs_...&email=owner@example.com
```

It posts to `/api/approval-request/`, which dispatches the main repo `publish-approved.yml` workflow. The workflow resolves the case by `client_slug + order_id`, verifies the submitted checkout email, then publishes the latest task recorded on that case.

Approval must always resolve back to the same central case and website task thread. If the order cannot be matched by both `orderId + checkout email`, the approval request must fail closed and not publish.

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
- Agent dev preview ready: send dev review link after build/QA passes. Implemented in `npm run agent:complete-task` when `--send-email true`; if screenshot paths are not provided, the runner captures desktop/mobile QA screenshots before the pre-review gate. Discord follow-up is available with `--send-discord true`.
- Customer approve/revise links: email should point to the dev preview utility pages, not to Discord or an internal operator page.
- Domain setup status: send `active`, `waiting_for_customer_dns`, or `needs_root_domain_review` instructions from `npm run domain:request -- --send-email true`; `domain-request.yml` can send this after central domain state updates.
- Live published: send live site link after approved `dev` tree is published to `main`. Implemented in `npm run agent:publish-approved` when `--send-email true`; Discord follow-up is available with `--send-discord true`.

The customer-facing pages can remain available on our preview/domain even when the customer points their own domain at the live site. They should be treated as account/order utility pages, not restaurant content pages.

Verification command:

```bash
npm run funnel:route-tally -- --input /tmp/revision.json --entitlements-dir /tmp/orders --dry-run true
```
