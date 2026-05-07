# Module Status

## Working Prototype

| Module | Status | Notes |
|---|---|---|
| GitHub/Cloudflare deploy | Working | Main/dev deploys work for current restaurant repos. Main repo and all 5 generated restaurant repos now use Node 24-hardened deploy workflows, and the latest generated dev/live deploys completed success. |
| Google Places extraction | Working MVP | `npm run extract:google-places` supports text search, details, evidence writing, and cost logging. |
| Firecrawl official-site scrape | Working MVP | `npm run extract:firecrawl` standardizes official-site scrape artifacts into evidence packs and cost events. |
| Restaurant preview renderer | Working MVP | `webjuice-restaurant` renders from content/design/checkout artifacts; all 5 Brisbane generated dev branches are synced to the current artifact renderer and passed build after sync. Opa also has a deployed mobile menu polish on `dev`. |
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
| ProfitsLocal demo funnel chrome | Working MVP | `webjuice-restaurant`, Rich & Rare dev, and the five Brisbane restaurant dev repos use a dedicated `FunnelLayout` for `/demo-faq`, `/checkout`, `/contact-us`, `/thank-you`, `/revise`, `/approve`, `/domain-setup`, and `/domain-help`, keeping ProfitsLocal sales/support pages separate from customer website content. The current banner uses the official ProfitsLocal logo/link, one-line preview pricing/actions, no pre-purchase revision upsell, and context-preserving checkout/contact links. `npm run qa:funnel-pages` validates homepage sales footer, official logo link, contact path, utility chrome, checkout source context, pricing, after-payment copy, revision/approval/domain controls, support email, no template leakage, and live HTTP 200. |
| Stripe paid activation webhook | Working MVP | `webjuice-restaurant` has `/api/stripe-webhook` with signature verification; `npm run funnel:route-stripe` normalizes `checkout.session.completed` into revenue ledger and agent task outputs. |
| Central automation runner | Working MVP | `npm run funnel:route-event` routes Stripe/Tally/first-party revision payloads; `.github/workflows/route-funnel-event.yml` can persist generated funnel state, commit it back to main, auto-run the agent, and skip duplicate webhook payloads by idempotency key/submission path. |
| Case file memory | Working MVP | Funnel routing maintains `data/cases/<client>/<order>/case.json`, timeline, customer messages, context packet, decisions log, and agent run log so agents do not lose order/thread context. |
| Revision entitlement ledger | Working MVP | Paid sales create `data/funnel/orders/<client>/<order>.json`; revision requests consume quota before agent task creation and denied over-limit attempts are recorded without creating tasks. |
| Customer email notifications | Working MVP | Client Pages Functions and automation router can send Resend customer emails for payment receipt, revision receipt, accepted quota usage, denied/extra-revision paths, review ready, live publish, and domain setup status. Opa production-like review email and live email sent successfully to `matthew6688@gmail.com`. |
| Extra revision checkout | Working MVP | Stripe test price exists for `$100` extra revisions; checkout supports `extra_revision` and revision pages link to purchase more. |
| Tally payment form builder | Working MVP | `npm run funnel:create-tally-payment-forms` builds stable Tally payment form payloads, MCP prompts, or live forms/webhooks when `TALLY_API_KEY` is set in `.env.local` or runtime env. Current product tiers: $399 one-time website with 3 revisions; $799 yearly website with monthly maintenance. |
| Tally feedback form builder | Working MVP | `npm run funnel:create-tally-feedback-form` builds a feedback form payload/MCP prompt that submits revision requests into the same webhook. |
| Checkout URL updater | Working MVP | `npm run funnel:update-checkout-urls` rewrites client checkout artifacts with real Tally form URLs while preserving hidden fields. |
| Tally MCP setup docs | Working MVP | `docs/TALLY_MCP_SETUP.md` explains remote MCP setup, current runtime limitation, payment form shape, API fallback, and verification commands. |
| ProfitsLocal paid intake dashboard | Working MVP | Protected `/admin/intakes` and `/admin/intakes/<client>/<order>` are deployed on Cloudflare Pages with `ADMIN_ACCESS_TOKEN`; detail pages now expose repo/dev/live/revise/approve/domain/Discord links plus capsule paths; `/admin/action` dispatches GitHub Actions to record request-more-info, confirm website-ready, V1 started/delivered, completion, revision approval/rejection, and custom quote actions back into `data/paid-intakes`. |
| Restaurant niche adapter MVP | Working MVP | `npm run restaurant:build-content` converts evidence into `content.restaurant.json`; validator blocks menu rendering without real menu sections. |
| Restaurant design brief MVP | Working MVP | `npm run design:restaurant-brief` creates Huashu-ready `design.restaurant.json` and `brand-spec.md` from validated restaurant content. |
| Open Design integration decision | Documented | `docs/OPEN_DESIGN_INTEGRATION.md` defines Open Design as the primary high-fidelity concept engine for redesign work. ProfitsLocal wraps/imports concept output, enforces evidence/QA, translates to Webjuice/Astro, deploys, and handles customer workflow instead of rebuilding Open Design's design loop. |
| Open Design headless orchestration | Working MVP | `docs/OPEN_DESIGN_HEADLESS_ORCHESTRATION.md` documents the daemon/API flow. `npm run open-design:run-concept` starts the daemon on Node 24, creates a project, launches an agent run, streams events, exports files, and writes a concept manifest. `npm run open-design:validate-concept` validates the exported concept folder before production import. Rich & Rare real concept output is stored under `clients/rich-and-rare-restaurant/concept/open-design/`. |
| Open Design project sync | Working MVP | `docs/OPEN_DESIGN_PROJECT_SYNC.md` defines Open Design as the visual concept source, with repo `dev` as development preview source. `npm run open-design:sync-from-app` pulls manual Open Design app edits back into `clients/<client>/concept/open-design/`; task/Discord payloads include the bound local Open Design `projectId`, `dataDir`, manifest, production handoff, continue command, and sync command. |
| Open Design production port | Working MVP | `npm run open-design:port-production-handoff` imports structured handoff data, design tokens, and Open Design assets into a Webjuice/Astro customer repo without deploying standalone concept HTML. Verified with `npm run open-design:test-port-production-handoff`; Rich & Rare repo dev commit `22ad957` deployed successfully in GitHub Actions run `25469570815`, and both the dev page and copied asset URL returned HTTP 200. |
| Website intake survey standard | Working MVP | `docs/WEBSITE_INTAKE_SURVEY.md` maps Open Design discovery fields into ProfitsLocal fields; `npm run intake:build-website-ready` writes `clients/<client>/intake/website-survey.json` plus a case `build-packet.md` with readiness state, framework contract, and source-of-truth paths. |
| Module boundary standard | Documented | `docs/MODULE_BOUNDARIES.md` separates customer website core, ProfitsLocal sales/fulfillment ops, portable project capsule, and niche adapters so restaurant-only behavior does not leak into other niches. |
| Client artifact pipeline | Working MVP | `npm run pipeline:build-client` builds content, design brief, brand spec, and artifact manifest from validated evidence. |
| Niche registry | Working MVP | `npm run niches:list` exposes registered niches; pipeline now routes through `core/niches/registry.js` instead of hardcoding restaurant logic. |
| Lead Search Runner | Working MVP | `npm run leads:search-runner` loops through Google Places results or an input leads file, runs lead qualification, and writes a `collectionQueue` containing only A/B build/collect leads with a contact path. Verified with `npm run leads:test-search-runner` and a Google Places dry-run smoke that wrote `/tmp/profitslocal-lead-runner-smoke.json`. |
| Outreach pack MVP | Working MVP | `npm run outreach:build-pack` creates outreach pack JSON with QA status, proof points, screenshot targets, and demo video target; `npm run outreach:validate-pack` verifies pack usability. |
| Local restaurant AI audit | Working MVP | `npm run audit:restaurant-local-llm` combines deterministic menu/content rules with local Ollama audit. Default model is `qwen3.5:9b` for stable JSON; all 5 Brisbane restaurants passed with score 100 and zero findings. |
| Legacy restaurant migration | Working MVP | `npm run migrate:legacy-restaurant` converts current generated restaurant repos into standard evidence packs. |
| Tally checkout form automation | Blocked | Payment form payloads and MCP prompts can be generated, but live Tally API payment-block creation failed schema validation during testing. Use first-party Stripe checkout until Tally MCP/manual creation is proven. |
| Tally webhook to agent task | Working MVP | Tally orders normalize into revenue events and standard agent tasks. |
| Hermes/OpenClaw task queue | Working MVP | `npm run agent:create-task` and `npm run agent:validate-task` create pending task JSON for external agents; routed funnel tasks include case/context paths, source-of-truth files, website survey path, build packet path, allowed files, Huashu design protocol, Open Design binding, and a guarded repo bootstrap command for new customer repo/Pages setup. |
| Agent execution runner | Working MVP | `npm run agent:run-task` loads case context/source-of-truth files, optional website survey/build packet, applies artifacts to an artifact-ready repo, runs build, and appends agent run/timeline records to the case. Push to `dev` is explicit with `--push true`. |
| Agent completion runner | Working MVP | `npm run agent:complete-task` wraps run/build, optional dev deploy check, automatic Playwright desktop/mobile screenshots, Delivery QA report validation, and optional Resend review email so paid/revision work can reach customer review only after evidence is present. Opa passed the pre-review gate with real QA screenshots and sent review email `73281496-4628-449a-8ff1-89cb6f81a5fd`; temp auto-QA smoke passed without manually supplied screenshots. Delivery QA gate validation passed with `npm run qa:test-delivery-qa`, `npm run agent:test-pre-review-gate`, `npm run contracts:validate-core`, and `npm run hermes:test-website-agent-closure`. |
| Approval publish runner | Working MVP | `npm run agent:publish-approved` publishes an approved dev tree to main without merging unrelated histories, can push live, wait for live deploy, send live email/Discord follow-up, and update case timeline. Opa pushed main commit `418519767e480bf0bd0b8948e515851528f658d9`, Deploy Live run `25382781613` succeeded, and live email `7f832951-4d8b-4ed8-8d25-627f5d0a2129` was sent. |
| First-party approval flow | Working MVP | Template/client sites have `/approve` and `/api/approval-request/`; approval dispatches `publish-approved.yml` with mandatory `orderId + checkout email` matching. |
| Order status utility | Working MVP | Template/client sites have `/api/order-status/`; `/revise` displays trusted revision quota only after `orderId + checkout email` matches the central entitlement record. |
| Revision attachment storage | Working MVP | Template/client sites have `/api/upload-attachment/` for server-side Cloudinary uploads with signed or unsigned-preset Cloudinary mode; local smoke passes in template/generated repos, Pages runtime secrets are configured on template plus 5 generated dev/live projects, and deployed Opa returned a real Cloudinary URL from `/api/upload-attachment/`. |
| Domain onboarding / DNS verifier | Working MVP | `profitslocal.com` is attached to `profitslocal-live`; DNS and Pages custom-domain status are active; template/generated sites include `/domain-setup`, `/api/domain-request/`, and `/api/domain-status/`; central `domain-request.yml` can provision ProfitsLocal subdomains or wait on customer DNS and send domain status emails; `domain:cleanup` removes smoke-only DNS/Pages bindings with dry-run and guardrails. Validated with `domain:test-launch-route`, `domain:test-request`, template smoke, live Opa domain smoke, and cleanup verification. |
| Security/key handling | Working | `docs/SECURITY.md` documents local `.env.local`, GitHub/Cloudflare secrets, paid workflow checks, and secret scanning before commit. |

## Half Built

| Module | Status | Gap |
|---|---|---|
| Evidence engine | Working MVP | `core/evidence/evidence.js` defines source types, merge rules, restaurant validation, and `npm run evidence:*` CLIs. |
| Restaurant template renderer | Working MVP | `matthew6688/webjuice-restaurant` now reads `content.restaurant.json` and `design.restaurant.json`; generated repos still need migration to the new renderer flow. |
| Client artifact sync | Working MVP | `npm run clients:sync-artifacts` applies content/design/checkout artifacts and optional images to an artifact-ready client repo, then can run build. |
| Design engine | Half built | Huashu-ready restaurant design brief exists; visual scoring still needs work. |
| Website ready engine | Working MVP | `core/intake/website-ready.js` normalizes evidence/content/design/case context into `website_ready_to_build`, `needs_customer_confirmation`, `needs_more_info`, or `blocked_conflicting_evidence`; Opa generated a real ready packet successfully, and the paid-intake admin `confirm_website_ready` action writes the survey/build packet before V1 starts. |
| Cost tracking | Working MVP | Ledger/report exist; Google Places, Google Places photos, Firecrawl, Firecrawl Parse, OpenAI usage, Tally revenue, Stripe revenue, Resend emails, image generation, and agent runtime can write events. Resend/runtime costs are configurable estimates. |
| Outreach pack | Working MVP | Pack JSON plus `outreach:capture-assets` can generate screenshot/video assets for email proof. |
| Customer feedback to revision task | Working MVP | First-party `/revise` submits `orderId + checkout email + requested changes`; review links lock order/email as read-only, show trusted plan/quota after match, upload attachments to Cloudinary when configured, and carry attachment URLs into Discord/email/agent routing. Backend router enforces entitlement quota before creating a `revision` task. |
| Central automation trigger | Working MVP | Client Pages Functions can dispatch to the main repo GitHub Actions workflow via `AGENT_GITHUB_TOKEN`; route workflow can auto-run the generated agent task, push dev, wait for deploy, notify review channels, and skip duplicate webhook retries. Verified live by GitHub Actions smoke `25354611737`, Opa deployed checkout `cs_test_b1NsMZTui0nhviPT4xGh6r5orYmCzLQjeDQCc5qnKgYe3BDUb0bb7etXY7`, and the Opa production-like review/live publish rehearsal. |
| Discord case workspace | Working MVP | Funnel Discord sends use `wait=true`, capture message/channel/thread IDs, and persist them to `case.json.discord` plus timeline fields. Website task handoffs post the full task packet into `#website-tasks`, including build packet and website survey paths, and prefer Hermes auto-threading for the same text-channel thread display used by human-started Hermes tasks; explicit message-thread creation remains as fallback. Later revisions/review/publish reuse `case.json.discord.websiteTaskThreadId`. Live Opa smoke verified thread creation, same-thread revision reuse, website-agent pickup, and Huashu/open-design skill loading. |
| Local Hermes Discord SOP | Working MVP | `docs/HERMES_LOCAL_DISCORD_SOP.md` defines local `website-agent` setup, sender/worker bot split, `#website-tasks` thread rules, project capsule contract, admin dashboard relationship, smoke tests, and troubleshooting. Dedicated `ProfitsLocal Handoff` sender bot is configured locally and in GitHub secrets; live smoke posted to `website-tasks`, created thread `1501743599585460284`, and `website-agent` replied `website-agent handoff smoke ok`. VPS is deferred. |

## Not Started

| Module | Status | Notes |
|---|---|---|
| PDF extraction / image OCR pipeline | Working MVP | See `docs/OCR_MENU_PIPELINE.md`. |
| PaddleOCR provider | Working wrapper | Local runtime verified. |
| OCRmyPDF provider | Working wrapper | Local runtime verified. |
| Roofing niche adapter | Not started | Planned second niche. Should reuse the customer website core and project capsule, with service-area/contact-form/estimate-form rules instead of restaurant menu routes. |
| Reservation/contact extractors | Not started | Still needed for richer restaurant evidence. |
| Live Tally form creation | Blocked | Tally payment-block API schema is unstable; first-party Stripe checkout is the production path. |
| Resend cold email test | Owner-inbox live smoke done | `npm run outreach:send-cold-email -- --client opa-bar-mezze-restaurant --to matthew6688@gmail.com --dry false` returned Resend id `1ad4a572-be28-4103-8717-be674ccfa9ce` from a validated outreach pack with desktop/mobile screenshots and `demo.mp4`. Use a separate outreach sender/domain before sending to real prospects. |

## Immediate Next Build Order

1. Configure `RESEND_EMAIL_UNIT_COST` and `AGENT_RUNTIME_COST_PER_MINUTE` or pass per-run runtime cost so ROI reports include email and agent labor estimates.
2. Configure `qa:funnel-pages` into generated repo deploy workflows or the central post-deploy checker so future funnel regressions fail automatically.
3. Harden the admin dashboard with automatic rebuild after actions, operator audit filters, and email drafting/sending.
4. Start the roofing adapter only after the restaurant capsule path stays stable.

## Verification Rules

Every module must ship with a validation command. Examples:

```bash
node scripts/check-env.js
node scripts/evidence/validate.js --client longwang
node scripts/finance/report.js --campaign brisbane-restaurants
node scripts/qa/preview.js --client longwang
node scripts/outreach/generate-demo.js --client longwang
npm run pipeline:build-client -- --client longwang
npm run intake:build-website-ready -- --client longwang
```

If a module cannot be validated with a command or screenshot artifact, it is not done.
