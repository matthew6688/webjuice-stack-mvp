# Module Status

## Working Prototype

| Module | Status | Notes |
|---|---|---|
| GitHub/Cloudflare deploy | Working | Main/dev deploys work for current restaurant repos. |
| Google Places extraction | Working MVP | `npm run extract:google-places` supports text search, details, evidence writing, and cost logging. |
| Firecrawl official-site scrape | Working MVP | `npm run extract:firecrawl` standardizes official-site scrape artifacts into evidence packs and cost events. |
| Restaurant preview renderer | Working MVP | `webjuice-restaurant` can render from content/design/checkout artifacts; generated repos still need full migration to this flow. |
| Link QA | Working MVP | `npm run qa:links` validates `tel:`, Google Maps, menu source, reservation, email, and menu item source chains from content artifacts. |
| Screenshot QA | Working MVP | `npm run outreach:capture-assets` captures desktop/mobile screenshots and a scroll demo video from an outreach pack preview URL. |
| Environment checker | Working | `npm run check:env` reports missing workflow secrets. |
| Deployed preview link checker | Working | `npm run check:links -- --all clients --internal-links false` verified all 5 Brisbane preview URLs return HTTP 200. |
| GitHub Actions deploy checker | Working | `npm run check:deploys -- --all clients` verified the latest Actions run for all 5 generated restaurant repos is `completed/success`. |
| Finance ledger MVP | Working | `npm run finance:add` and `npm run finance:report` support local ROI tracking. |
| OpenAI usage cost logger | Working MVP | `npm run finance:add-openai-usage` records OpenAI token costs into the ledger using caller-provided pricing rates. |
| Google Places extractor MVP | Working | `npm run extract:google-places` can extract leads/details, write evidence, and log cost events with configurable SKU costs. |
| Google Places photo extractor MVP | Working | `npm run extract:google-places-photos` downloads Place photos or dry-run fixtures, writes media manifests, can append `media.photos` evidence, and logs per-photo cost events. |
| Brand asset extractor MVP | Working | `npm run extract:brand-assets` extracts logo candidates, official image candidates, palette colors, and font hints from official-site HTML/URL, writes a manifest, and can append brand evidence. |
| Firecrawl extractor MVP | Working | `npm run extract:firecrawl` can scrape official pages, save raw artifacts, detect menu/reservation/contact evidence, and log cost events. |
| Firecrawl Parse provider | Working MVP | `npm run extract:firecrawl-parse` uploads local/private documents, captures parse output, writes menu evidence, and logs Firecrawl parse costs. |
| Menu text parser MVP | Working MVP | `npm run extract:menu` parses text/markdown menu artifacts into `menu.sections`; PDF requires local `pdftotext` or prior text extraction. |
| Tally order normalization | Working MVP | Tally webhook emits normalized order/revenue events; `npm run funnel:record-tally` writes payloads into the finance ledger. |
| Checkout artifact builder | Working MVP | `npm run funnel:build-checkout` creates provider-agnostic Tally/Stripe checkout links with hidden client fields for $399 one-time or $799 yearly-maintenance tiers. |
| First-party Stripe checkout | Working MVP | `webjuice-restaurant` has `/checkout` plus `/api/create-checkout-session`; generated client artifacts now point fixed footer purchase buttons to the client preview checkout page. Stripe test price IDs and Pages runtime secrets are configured on the 5 dev projects. |
| Stripe paid activation webhook | Working MVP | `webjuice-restaurant` has `/api/stripe-webhook` with signature verification; `npm run funnel:route-stripe` normalizes `checkout.session.completed` into revenue ledger and agent task outputs. |
| Central automation runner | Working MVP | `npm run funnel:route-event` routes Stripe/Tally/first-party revision payloads; `.github/workflows/route-funnel-event.yml` can persist generated funnel state and commit it back to main. |
| Case file memory | Working MVP | Funnel routing maintains `data/cases/<client>/<order>/case.json`, timeline, customer messages, context packet, decisions log, and agent run log so agents do not lose order/thread context. |
| Revision entitlement ledger | Working MVP | Paid sales create `data/funnel/orders/<client>/<order>.json`; revision requests consume quota before agent task creation and denied over-limit attempts are recorded without creating tasks. |
| Customer email notifications | Working MVP | Client Pages Functions and automation router can send Resend customer emails for payment receipt, revision receipt, accepted quota usage, and denied/extra-revision paths when `RESEND_API_KEY` is configured. |
| Extra revision checkout | Working MVP | Stripe test price exists for `$100` extra revisions; checkout supports `extra_revision` and revision pages link to purchase more. |
| Tally payment form builder | Working MVP | `npm run funnel:create-tally-payment-forms` builds stable Tally payment form payloads, MCP prompts, or live forms/webhooks when `TALLY_API_KEY` is set in `.env.local` or runtime env. Current product tiers: $399 one-time website with 3 revisions; $799 yearly website with monthly maintenance. |
| Tally feedback form builder | Working MVP | `npm run funnel:create-tally-feedback-form` builds a feedback form payload/MCP prompt that submits revision requests into the same webhook. |
| Checkout URL updater | Working MVP | `npm run funnel:update-checkout-urls` rewrites client checkout artifacts with real Tally form URLs while preserving hidden fields. |
| Tally MCP setup docs | Working MVP | `docs/TALLY_MCP_SETUP.md` explains remote MCP setup, current runtime limitation, payment form shape, API fallback, and verification commands. |
| Restaurant niche adapter MVP | Working MVP | `npm run restaurant:build-content` converts evidence into `content.restaurant.json`; validator blocks menu rendering without real menu sections. |
| Restaurant design brief MVP | Working MVP | `npm run design:restaurant-brief` creates Huashu-ready `design.restaurant.json` and `brand-spec.md` from validated restaurant content. |
| Client artifact pipeline | Working MVP | `npm run pipeline:build-client` builds content, design brief, brand spec, and artifact manifest from validated evidence. |
| Niche registry | Working MVP | `npm run niches:list` exposes registered niches; pipeline now routes through `core/niches/registry.js` instead of hardcoding restaurant logic. |
| Outreach pack MVP | Working MVP | `npm run outreach:build-pack` creates outreach pack JSON with QA status, proof points, screenshot targets, and demo video target; `npm run outreach:validate-pack` verifies pack usability. |
| Legacy restaurant migration | Working MVP | `npm run migrate:legacy-restaurant` converts current generated restaurant repos into standard evidence packs. |
| Tally checkout form automation | Blocked | Payment form payloads and MCP prompts can be generated, but live Tally API payment-block creation failed schema validation during testing. Use first-party Stripe checkout until Tally MCP/manual creation is proven. |
| Tally webhook to agent task | Working MVP | Tally orders normalize into revenue events and standard agent tasks. |
| Hermes/OpenClaw task queue | Working MVP | `npm run agent:create-task` and `npm run agent:validate-task` create pending task JSON for external agents; routed funnel tasks include case/context paths, source-of-truth files, allowed files, and Huashu design protocol. |
| Agent execution runner | Working MVP | `npm run agent:run-task` reads a pending task, applies artifacts to an artifact-ready repo, and runs build; dry-run is default. |
| Domain onboarding / DNS verifier | Working MVP | `npm run domain:inspect` checks NS/CNAME/A/AAAA and prints customer DNS instructions; `domain:attach-pages` supports Cloudflare Pages attach/dry-run. |
| Security/key handling | Working | `docs/SECURITY.md` documents local `.env.local`, GitHub/Cloudflare secrets, paid workflow checks, and secret scanning before commit. |

## Half Built

| Module | Status | Gap |
|---|---|---|
| Evidence engine | Working MVP | `core/evidence/evidence.js` defines source types, merge rules, restaurant validation, and `npm run evidence:*` CLIs. |
| Restaurant template renderer | Working MVP | `matthew6688/webjuice-restaurant` now reads `content.restaurant.json` and `design.restaurant.json`; generated repos still need migration to the new renderer flow. |
| Client artifact sync | Working MVP | `npm run clients:sync-artifacts` applies content/design/checkout artifacts and optional images to an artifact-ready client repo, then can run build. |
| Design engine | Half built | Huashu-ready restaurant design brief exists; visual scoring still needs work. |
| Cost tracking | Half built | Ledger/report exist; Google Places, Google Places photos, Firecrawl, Firecrawl Parse, OpenAI usage, and Tally revenue can write events; Resend and image generation still need direct wiring. |
| Outreach pack | Working MVP | Pack JSON plus `outreach:capture-assets` can generate screenshot/video assets for email proof. |
| Customer feedback to revision task | Working MVP | First-party `/revise` submits `orderId + checkout email + requested changes`; backend router enforces entitlement quota before creating a `revision` task. |
| Central automation trigger | Working MVP | Client Pages Functions can dispatch to the main repo GitHub Actions workflow via `AGENT_GITHUB_TOKEN`; main repo notification secrets are configured, and Pages secrets are present on current dev/live client projects. |

## Not Started

| Module | Status |
|---|---|
| PDF extraction / image OCR pipeline | Half built |
| PaddleOCR provider | Working wrapper |
| OCRmyPDF provider | Working wrapper |
| Multi-niche framework | Half built |
| Reservation/contact extractors | Not started |
| Live Tally form creation | Blocked on Tally payment block API schema; first-party Stripe checkout is the current production path |
| Resend cold email test | Ready to test; Resend domain `fengtalk.ai` is verified and Pages secrets are configured |

## Immediate Next Build Order

1. Agent dev-branch execution loop that loads case context before editing.
2. `/api/order-status/` plus revision-count display on `/revise`.
3. Discord thread workspace with order/thread id mapping.
4. Agent preview-ready/domain-ready customer emails.
5. Domain attach/polling for `profitslocal.com`.
6. Menu PDF extractor and image OCR pipeline.
7. Resend cold outreach dry-run and live test.
8. Add next city or niche pilot after the restaurant loop closes.

## Verification Rules

Every module must ship with a validation command. Examples:

```bash
node scripts/check-env.js
node scripts/evidence/validate.js --client longwang
node scripts/finance/report.js --campaign brisbane-restaurants
node scripts/qa/preview.js --client longwang
node scripts/outreach/generate-demo.js --client longwang
npm run pipeline:build-client -- --client longwang
```

If a module cannot be validated with a command or screenshot artifact, it is not done.
