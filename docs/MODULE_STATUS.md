# Module Status

## Working Prototype

| Module | Status | Notes |
|---|---|---|
| GitHub/Cloudflare deploy | Working | Main/dev deploys work for current restaurant repos. |
| Google Places manual extraction | Working manually | Used successfully for 5 Brisbane restaurants, not yet a reusable extractor module. |
| Firecrawl official-site scrape | Working manually | Used successfully for official sites/menu pages, not yet standardized into evidence packs. |
| Restaurant preview renderer | Working manually | Real menu pages deployed with logo/photos/CTA, but renderer is still embedded in generated repos. |
| Link QA | Working MVP | `npm run qa:links` validates `tel:`, Google Maps, menu source, reservation, email, and menu item source chains from content artifacts. |
| Screenshot QA | Working MVP | `npm run outreach:capture-assets` captures desktop/mobile screenshots and a scroll demo video from an outreach pack preview URL. |
| Environment checker | Working | `npm run check:env` reports missing workflow secrets. |
| Finance ledger MVP | Working | `npm run finance:add` and `npm run finance:report` support local ROI tracking. |
| OpenAI usage cost logger | Working MVP | `npm run finance:add-openai-usage` records OpenAI token costs into the ledger using caller-provided pricing rates. |
| Google Places extractor MVP | Working | `npm run extract:google-places` can extract leads/details, write evidence, and log cost events with configurable SKU costs. |
| Firecrawl extractor MVP | Working | `npm run extract:firecrawl` can scrape official pages, save raw artifacts, detect menu/reservation/contact evidence, and log cost events. |
| Firecrawl Parse provider | Working MVP | `npm run extract:firecrawl-parse` uploads local/private documents, captures parse output, writes menu evidence, and logs Firecrawl parse costs. |
| Menu text parser MVP | Working MVP | `npm run extract:menu` parses text/markdown menu artifacts into `menu.sections`; PDF requires local `pdftotext` or prior text extraction. |
| Tally order normalization | Working MVP | Tally webhook emits normalized order/revenue events; `npm run funnel:record-tally` writes payloads into the finance ledger. |
| Checkout artifact builder | Working MVP | `npm run funnel:build-checkout` creates provider-agnostic Tally/Stripe checkout links with hidden client fields for $399 one-time or $799 yearly-maintenance tiers. |
| Tally payment form builder | Working MVP | `npm run funnel:create-tally-payment-forms` builds Tally payment form payloads, MCP prompts, or live forms/webhooks when `TALLY_API_KEY` is set. Current product tiers: $399 one-time website with 3 revisions; $799 yearly website with monthly maintenance. |
| Tally MCP setup docs | Working MVP | `docs/TALLY_MCP_SETUP.md` explains remote MCP setup, current runtime limitation, payment form shape, API fallback, and verification commands. |
| Restaurant niche adapter MVP | Working MVP | `npm run restaurant:build-content` converts evidence into `content.restaurant.json`; validator blocks menu rendering without real menu sections. |
| Restaurant design brief MVP | Working MVP | `npm run design:restaurant-brief` creates Huashu-ready `design.restaurant.json` and `brand-spec.md` from validated restaurant content. |
| Client artifact pipeline | Working MVP | `npm run pipeline:build-client` builds content, design brief, brand spec, and artifact manifest from validated evidence. |
| Outreach pack MVP | Working MVP | `npm run outreach:build-pack` creates outreach pack JSON with QA status, proof points, screenshot targets, and demo video target; `npm run outreach:validate-pack` verifies pack usability. |
| Legacy restaurant migration | Working MVP | `npm run migrate:legacy-restaurant` converts current generated restaurant repos into standard evidence packs. |
| Tally checkout form automation | Working MVP | Payment form payloads and MCP prompts can be generated; live API creation is available when `TALLY_API_KEY` is configured. |
| Tally webhook to agent task | Working MVP | Tally orders normalize into revenue events and standard agent tasks. |
| Hermes/OpenClaw task queue | Working MVP | `npm run agent:create-task` and `npm run agent:validate-task` create pending task JSON for external agents. |
| Agent execution runner | Working MVP | `npm run agent:run-task` reads a pending task, applies artifacts to an artifact-ready repo, and runs build; dry-run is default. |
| Domain onboarding / DNS verifier | Working MVP | `npm run domain:inspect` checks NS/CNAME/A/AAAA and prints customer DNS instructions; `domain:attach-pages` supports Cloudflare Pages attach/dry-run. |

## Half Built

| Module | Status | Gap |
|---|---|---|
| Evidence engine | Working MVP | `core/evidence/evidence.js` defines source types, merge rules, restaurant validation, and `npm run evidence:*` CLIs. |
| Restaurant template renderer | Working MVP | `matthew6688/webjuice-restaurant` now reads `content.restaurant.json` and `design.restaurant.json`; generated repos still need migration to the new renderer flow. |
| Design engine | Half built | Huashu-ready restaurant design brief exists; visual scoring still needs work. |
| Cost tracking | Half built | Ledger/report exist; Google Places, Firecrawl, and Tally revenue write events; OpenAI still needs wiring. |
| Outreach pack | Working MVP | Pack JSON plus `outreach:capture-assets` can generate screenshot/video assets for email proof. |
| Customer feedback to revision task | Half built | Tally normalizer can infer feedback tasks, but a dedicated feedback form artifact and dev-branch revision runner are not implemented yet. |

## Not Started

| Module | Status |
|---|---|
| PDF extraction / image OCR pipeline | Half built |
| PaddleOCR provider | Working wrapper |
| OCRmyPDF provider | Working wrapper |
| Multi-niche framework | Not started |

## Immediate Next Build Order

1. Baseline environment and security hardening.
2. Finance ledger MVP.
3. Evidence schema and validators.
4. Google Places extractor with cost logging.
5. Firecrawl extractor with cost logging.
6. Restaurant adapter from evidence to content.
7. Playwright QA screenshots and demo video.
8. Tally checkout + webhook.
9. Agent task queue.
10. Domain onboarding.

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
