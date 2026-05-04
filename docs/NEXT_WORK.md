# Next Work

Updated: 2026-05-05

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
- `AGENT_GITHUB_TOKEN` is configured on 5 Brisbane dev/live Pages projects plus `webjuice-restaurant` dev/live, and `wrangler pages secret list` verifies the secret exists.
- Funnel routing now writes per-order case memory under `data/cases/<clientSlug>/<orderId>/` and agent tasks include case/context/design protocol fields.
- Agent execution/completion/publish runners can load case context, push reviewed work to `dev`, send review email, and publish approved `dev` trees to `main/live`.
- 5 generated restaurant repos plus the `webjuice-restaurant` template include `/approve` and `/api/approval-request/` for customer approval.
- `webjuice-restaurant` and the 5 generated restaurant repos include `/api/order-status/`; `/revise` can show trusted revision quota state after `orderId + checkout email` match.
- Funnel Discord sends now request webhook responses, try `thread_name`, can use `DISCORD_BOT_TOKEN` to create true threads from webhook messages in text channels, and persist returned channel/thread/message IDs into case memory.
- Menu document extraction now handles MarkItDown, direct text/Markdown, OCRmyPDF, PDF render + PaddleOCR, image PaddleOCR, and optional Firecrawl Parse fallback.
- Real business menu verification completed with Opa Bar + Mezze official menu: MarkItDown selected and generated 10 sections / 73 menu items from the live official menu page.
- Opa Bar + Mezze was regenerated from real-menu evidence into the artifact renderer, pushed to the client `dev` branch, deployed successfully, and screenshot-QA'd locally/remotely: `/` and `/menu` return 200 on desktop/mobile; menu renders 52 cleaned items across 7 sections; no console errors or horizontal overflow.
- Local Ollama restaurant audit is available as `npm run audit:restaurant-local-llm`; all 5 Brisbane restaurants passed with `qwen3.5:9b`, score 100, zero findings. Use this as a local AI quality gate before outreach.
- Opa outreach pack was regenerated from the refreshed remote preview; desktop/mobile screenshots and `demo.mp4` validate successfully.
- Cold outreach dry-run is working from outreach packs: `clients/opa-bar-mezze-restaurant/outreach/email/01-opa-bar-mezze.json` includes preview link, official menu source, local AI audit result, and screenshot/video proof.
- Sale routing smoke test wrote a temporary case/task/entitlement/ledger under `/tmp/webjuice-smoke`; Discord case-thread dry-run generated the expected sale thread payload.
- Agent runner execute smoke passed against the temporary Opa sale task: case context loaded, source-of-truth artifacts applied, build passed, and case run record was updated.
- Approval publish runner dry-run smoke passed against the same task, covering preflight, dev build, target checkout, tree copy, and live commit plan.
- No known API keys are committed.

## Highest Priority Remaining Work

### 1. Domain Onboarding For `profitslocal.com`

Goal: customers can keep utility pages while their own domain/subdomain points to live production.

Working now:

- `profitslocal.com` nameservers resolve to Cloudflare.
- `profitslocal.com` is attached to Cloudflare Pages project `profitslocal-live`.
- DNS CNAME is set to `profitslocal-live.pages.dev`.
- Pages custom-domain verification and validation are active.
- `https://profitslocal.com/` returns HTTP 200.
- `data/domain/profitslocal.com.json` stores DNS inspection output.
- `data/domain/profitslocal.com.pages-status.json` stores Pages custom-domain status.
- `npm run domain:pages-status` can poll custom-domain verification/certificate state.
- `npm run domain:upsert-cname` can create/update the CNAME when the token has Zone DNS Edit.
- ROI ledger now records Resend email costs when `RESEND_EMAIL_UNIT_COST` is configured.
- Agent completion can record runtime estimates when `AGENT_RUNTIME_COST_PER_MINUTE` or `--runtime-cost-per-minute` is set.
- Image generation costs can be recorded with `npm run finance:add-image-generation`.

Remaining:

- Deferred by owner: `profitslocal.com` page/design work will be handled later.

Validation:

```bash
npm run domain:inspect -- profitslocal.com --project profitslocal-live
npm run domain:pages-status -- --project profitslocal-live --domain profitslocal.com
npm run domain:upsert-cname -- --zone <zone-id> --name profitslocal.com --target profitslocal-live.pages.dev --proxied true
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
  - `data/cases/...`
  - `data/finance/ledger.jsonl`
- `webjuice-restaurant` has `functions/api/_agent-dispatch.ts`.
- Stripe webhook dispatches raw Stripe events.
- First-party revision form dispatches normalized revision payloads.

Remaining hardening:

- Optional: add `EXTRA_REVISION_CHECKOUT_URL` repo variable once the global extra-revision purchase URL is decided.
- Optional: replace the temporary PAT with a narrower GitHub App token if we want stricter production hardening.

Validation:

```bash
npm run funnel:route-event -- --input /tmp/stripe-event.json --provider auto --dry-run true
npm run funnel:route-event -- --input /tmp/revision.json --provider auto --dry-run true
npm run case:context -- --case data/cases/<client>/<order>/case.json
gh workflow run route-funnel-event.yml --repo matthew6688/webjuice-stack-mvp \
  -f provider=auto \
  -f payload="$(cat /tmp/stripe-event.json)" \
  -f send_discord=false \
  -f send_email=false \
  -f dry_run=true
```

### 3. Customer Utility / Status Pages

Goal: `/revise` and future account utility pages should show trusted backend state, not guessed frontend state.

Working now:

- Added `/api/order-status/` to the template and 5 generated restaurant repos.
- Requires `orderId + checkout email + clientSlug`.
- Reads the main automation repo through `AGENT_GITHUB_TOKEN`.
- Returns:
  - tier
  - revision limit
  - revisions used
  - remaining revisions
  - next monthly reset date for yearly plan
  - extra revision checkout URL
- Renders status on `/revise`.

Remaining hardening:

- Keep these utility pages available on preview/our domain even after customer live domain is connected.
- Add a read-only `/account` or `/order` page if customers need one place for revise/approve/domain links.

Validation:

```bash
curl -X POST https://<client>-dev.pages.dev/api/order-status/ \
  -H 'Content-Type: application/json' \
  --data '{"order_id":"cs_test_...","email":"owner@example.com"}'
```

### 4. Discord Thread Workspace

Goal: every paid order and revision should have a durable internal Discord workspace so the agent can post the right preview/review/live links without losing context.

Working now:

- Funnel Discord sends use `wait=true`.
- Discord payloads include order ID, task path, and case path.
- Webhook sends try `thread_name`; if Discord rejects thread creation, the sender falls back to normal webhook posting.
- When `DISCORD_BOT_TOKEN` is configured, fallback messages create a true Discord thread from the webhook message.
- Returned channel/thread/message IDs are persisted in `case.json.discord`.
- Timeline events include Discord channel/thread/message metadata.
- `npm run discord:case-thread` can dry-run payloads from an existing case file.

Remaining hardening:

- Live local Discord test requires webhook/bot values in `.env.local`, or use the already-configured GitHub Actions secrets. Do not put raw Discord tokens in commands/docs.
- Add follow-up message helpers for agent-complete and live-published events.

Validation:

```bash
npm run discord:case-thread -- --case data/cases/<client>/<order>/case.json --dry-run true
npm run funnel:route-event -- --input /tmp/stripe-event.json --provider auto --send-discord true --dry-run true
```

### 5. Email Completion Nodes

Goal: every key customer-facing state change sends a clear email.

Already working:

- Payment receipt email path in client webhook.
- Revision received email path in client revision endpoint.
- Router-level accepted/denied email path when `--send-email true` is used.
- Cold outreach dry-run proof generation from outreach pack.

Still needed:

- Agent dev preview ready email.
- Domain/live launch ready email.
- Extra revision purchase completed email.
- Email delivery/cost ledger events.
- Cold outreach live test to owner-controlled inbox with screenshot/video proof.

Validation:

```bash
npm run funnel:route-stripe -- --input /tmp/stripe-event.json --send-email true --dry-run true
npm run finance:report -- --campaign brisbane-restaurants
npm run outreach:send-cold-email -- --client opa-bar-mezze-restaurant --to <owner-email> --dry true
```

### 6. Menu PDF And Image OCR

Goal: handle restaurants whose menu is a PDF, scanned document, or Google Maps photo.

Working now:

- `npm run extract:menu-document` is the unified document menu entrypoint.
- Attempts MarkItDown first when available.
- Falls back to direct `.txt/.md` parsing for already-extracted menu text.
- Falls back to OCRmyPDF for PDFs.
- Falls back to PaddleOCR for image inputs when configured.
- Can use Firecrawl Parse as an optional fallback with `--firecrawl true`.
- Writes `manifest.json` with every attempt and the selected provider.
- Converts selected text into `menu.sections` evidence with source chains.
- MarkItDown, OCRmyPDF, Poppler, Tesseract/Ghostscript, PaddleOCR, and PaddlePaddle are installed locally.
- Text PDF, image menu, scanned PDF, Firecrawl fallback dry-run, and Opa Bar + Mezze real official menu flows have been verified locally.

Remaining:

- Add a stricter confidence/QA report for complex banquet/share menus before outreach.

Validation:

```bash
npm run ocr:pdf -- --input <menu.pdf> --output <searchable.pdf>
npm run extract:menu -- --input <text-or-markdown> --client <slug> --write-evidence
npm run extract:menu-document -- --input <menu.pdf> --client <slug> --source-url <url>
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

### 8. Local AI Audit

Goal: use local Ollama models as a cheap scale QA pass before outreach.

Working now:

- `npm run audit:restaurant-local-llm -- --client <slug>` reads `content.restaurant.json` and evidence.
- Deterministic checks catch missing phone/address/source chains, menu noise, duplicate item-price pairs, oversized sections, and generated menu items.
- Ollama checks the compressed content/menu against restaurant principles:
  - website and menu are different products
  - menu facts must be evidence-backed
  - phone/map/reservation should be mobile actionable
  - obvious CMS/OCR noise should be flagged
- Default model is `qwen3.5:9b` because it returns stable JSON locally. `qwen3.6:27b` can be used manually for deeper review, but its thinking mode may break strict JSON.

Validation:

```bash
npm run audit:restaurant-local-llm -- --client opa-bar-mezze-restaurant --fail-on high
```

## Suggested Build Order

1. Cold outreach live test to owner-controlled inbox using the regenerated Opa proof assets.
2. Full paid → agent → dev preview → approval → live publish dry-run/live-sim.
3. Migrate the remaining restaurant repos through the real-menu/artifact/audit/outreach flow.
4. More restaurant cities only after the Brisbane restaurant loop is stable.
5. Dashboard implementation only after the core restaurant loop is done; see `docs/OPS_DASHBOARD_PLAN.md`.

## Blocking Inputs

- Decision on where central automation should persist production state long term:
  - Git repo JSON files for MVP
  - Cloudflare D1 / Supabase / Neon for production
- Confirm whether extra revision purchases should add `+1` to the original entitlement or create a separate one-revision entitlement. Current checkout can sell `$100` extra revisions; entitlement increment wiring still needs a final policy choice.
