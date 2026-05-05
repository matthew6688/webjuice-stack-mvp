# Module Status

## Working Prototype

| Module | Status | Notes |
|---|---|---|
| GitHub/Cloudflare deploy | Working | Main/dev deploys work for current restaurant repos. |
| Google Places extraction | Working MVP | `npm run extract:google-places` supports text search, details, evidence writing, and cost logging. |
| Firecrawl official-site scrape | Working MVP | `npm run extract:firecrawl` standardizes official-site scrape artifacts into evidence packs and cost events. |
| Restaurant preview renderer | Working MVP | `webjuice-restaurant` renders from content/design/checkout artifacts; all 5 Brisbane generated dev branches are synced to the current artifact renderer and passed build after sync. |
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
| Menu document extraction | Working MVP | `npm run extract:menu-document` orchestrates MarkItDown, direct text/Markdown, OCRmyPDF, PDF-render+PaddleOCR, image PaddleOCR, and optional Firecrawl Parse fallback attempts, writes an artifact manifest, and feeds selected text into menu evidence. Local runtime is installed and verified against synthetic PDF/image/scanned PDF plus a real Opa Bar + Mezze official menu page. |
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
| Local restaurant AI audit | Working MVP | `npm run audit:restaurant-local-llm` combines deterministic menu/content rules with local Ollama audit. Default model is `qwen3.5:9b` for stable JSON; all 5 Brisbane restaurants passed with score 100 and zero findings. |
| Legacy restaurant migration | Working MVP | `npm run migrate:legacy-restaurant` converts current generated restaurant repos into standard evidence packs. |
| Tally checkout form automation | Blocked | Payment form payloads and MCP prompts can be generated, but live Tally API payment-block creation failed schema validation during testing. Use first-party Stripe checkout until Tally MCP/manual creation is proven. |
| Tally webhook to agent task | Working MVP | Tally orders normalize into revenue events and standard agent tasks. |
| Hermes/OpenClaw task queue | Working MVP | `npm run agent:create-task` and `npm run agent:validate-task` create pending task JSON for external agents; routed funnel tasks include case/context paths, source-of-truth files, allowed files, and Huashu design protocol. |
| Agent execution runner | Working MVP | `npm run agent:run-task` loads case context/source-of-truth files, applies artifacts to an artifact-ready repo, runs build, and appends agent run/timeline records to the case. Push to `dev` is explicit with `--push true`. |
| Agent completion runner | Working MVP | `npm run agent:complete-task` wraps run/build, optional dev deploy check, and optional Resend review email so paid/revision work can reach customer review. |
| Approval publish runner | Working MVP | `npm run agent:publish-approved` publishes an approved dev tree to main without merging unrelated histories, can push live, wait for live deploy, send live email/Discord follow-up, and update case timeline. |
| First-party approval flow | Working MVP | Template/client sites have `/approve` and `/api/approval-request/`; approval dispatches `publish-approved.yml` with mandatory `orderId + checkout email` matching. |
| Order status utility | Working MVP | Template/client sites have `/api/order-status/`; `/revise` displays trusted revision quota only after `orderId + checkout email` matches the central entitlement record. |
| Domain onboarding / DNS verifier | Working MVP | `profitslocal.com` is attached to `profitslocal-live`; DNS CNAME is set; Pages custom-domain verification/validation are active; `domain:inspect`, `domain:pages-status`, and `domain:upsert-cname` record/poll the flow. |
| Security/key handling | Working | `docs/SECURITY.md` documents local `.env.local`, GitHub/Cloudflare secrets, paid workflow checks, and secret scanning before commit. |

## Half Built

| Module | Status | Gap |
|---|---|---|
| Evidence engine | Working MVP | `core/evidence/evidence.js` defines source types, merge rules, restaurant validation, and `npm run evidence:*` CLIs. |
| Restaurant template renderer | Working MVP | `matthew6688/webjuice-restaurant` now reads `content.restaurant.json` and `design.restaurant.json`; generated repos still need migration to the new renderer flow. |
| Client artifact sync | Working MVP | `npm run clients:sync-artifacts` applies content/design/checkout artifacts and optional images to an artifact-ready client repo, then can run build. |
| Design engine | Half built | Huashu-ready restaurant design brief exists; visual scoring still needs work. |
| Cost tracking | Working MVP | Ledger/report exist; Google Places, Google Places photos, Firecrawl, Firecrawl Parse, OpenAI usage, Tally revenue, Stripe revenue, Resend emails, image generation, and agent runtime can write events. Resend/runtime costs are configurable estimates. |
| Outreach pack | Working MVP | Pack JSON plus `outreach:capture-assets` can generate screenshot/video assets for email proof. |
| Customer feedback to revision task | Working MVP | First-party `/revise` submits `orderId + checkout email + requested changes`; review links lock order/email as read-only, show trusted plan/quota after match, and carry attachment summaries into Discord/email/agent routing. Backend router enforces entitlement quota before creating a `revision` task. |
| Central automation trigger | Working MVP | Client Pages Functions can dispatch to the main repo GitHub Actions workflow via `AGENT_GITHUB_TOKEN`; route workflow can auto-run the generated agent task, push dev, wait for deploy, and notify review channels. Verified live by GitHub Actions smoke `25354611737`. |
| Discord case workspace | Working MVP | Funnel Discord sends use `wait=true`, capture message/channel/thread IDs, and persist them to `case.json.discord` plus timeline fields. Website task handoffs now create an explicit `#websites` thread named from the business/order, post the full task packet inside that thread, and reuse `case.json.discord.websiteTaskThreadId` for revisions/review/publish. Live Opa smoke verified thread creation, same-thread revision reuse, website-agent pickup, and Huashu/open-design skill loading. |

## Not Started

| Module | Status |
|---|---|
| PDF extraction / image OCR pipeline | Working MVP |
| PaddleOCR provider | Working wrapper |
| OCRmyPDF provider | Working wrapper |
| Multi-niche framework | Half built |
| Reservation/contact extractors | Not started |
| Live Tally form creation | Blocked on Tally payment block API schema; first-party Stripe checkout is the current production path |
| Resend cold email test | Dry-run working | `npm run outreach:send-cold-email -- --client <slug> --dry true` writes a proof email artifact from the outreach pack. Resend is solid for transactional email; cold outreach should use a separate outreach sender/domain or subdomain to protect transactional reputation. Live send should target an owner-controlled inbox first. |

## Immediate Next Build Order

1. Run one real Stripe test order through the deployed Opa preview, not just the central router.
2. Complete cold outreach live test to owner-controlled inbox with Opa proof assets.
3. Add next restaurant city only after the restaurant loop closes.
4. Plan dashboard after restaurant loop remains stable.

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
