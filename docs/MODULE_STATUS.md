# Module Status

## Working Prototype

| Module | Status | Notes |
|---|---|---|
| GitHub/Cloudflare deploy | Working | Main/dev deploys work for current restaurant repos. |
| Google Places manual extraction | Working manually | Used successfully for 5 Brisbane restaurants, not yet a reusable extractor module. |
| Firecrawl official-site scrape | Working manually | Used successfully for official sites/menu pages, not yet standardized into evidence packs. |
| Restaurant preview renderer | Working manually | Real menu pages deployed with logo/photos/CTA, but renderer is still embedded in generated repos. |
| Link QA | Partial | `tel:`, reservation, source, and Google Maps links were checked manually/scripts ad hoc. |
| Screenshot QA | Partial | Desktop/mobile screenshots generated manually with Playwright. |
| Environment checker | Working | `npm run check:env` reports missing workflow secrets. |
| Finance ledger MVP | Working | `npm run finance:add` and `npm run finance:report` support local ROI tracking. |
| Google Places extractor MVP | Working | `npm run extract:google-places` can extract leads/details, write evidence, and log cost events with configurable SKU costs. |
| Firecrawl extractor MVP | Working | `npm run extract:firecrawl` can scrape official pages, save raw artifacts, detect menu/reservation/contact evidence, and log cost events. |
| Firecrawl Parse provider | Working MVP | `npm run extract:firecrawl-parse` uploads local/private documents, captures parse output, writes menu evidence, and logs Firecrawl parse costs. |
| Menu text parser MVP | Working MVP | `npm run extract:menu` parses text/markdown menu artifacts into `menu.sections`; PDF requires local `pdftotext` or prior text extraction. |
| Tally order normalization | Working MVP | Tally webhook emits normalized order/revenue events; `npm run funnel:record-tally` writes payloads into the finance ledger. |
| Restaurant niche adapter MVP | Working MVP | `npm run restaurant:build-content` converts evidence into `content.restaurant.json`; validator blocks menu rendering without real menu sections. |

## Half Built

| Module | Status | Gap |
|---|---|---|
| Evidence engine | Working MVP | `core/evidence/evidence.js` defines source types, merge rules, restaurant validation, and `npm run evidence:*` CLIs. |
| Restaurant niche adapter | Working MVP | JS adapter/schema exist; still needs real 5-client migration and renderer integration. |
| Design engine | Half built | Brand colors/logos/photos used, but no Huashu/open-design decision engine or scoring. |
| Cost tracking | Half built | Ledger/report exist; Google Places, Firecrawl, and Tally revenue write events; OpenAI still needs wiring. |
| Outreach pack | Not yet wired | Need screenshots, video, email, source summary, audit summary in one artifact. |

## Not Started

| Module | Status |
|---|---|
| Tally checkout form automation | Not started |
| Tally webhook to agent task | Half built |
| Customer feedback form to dev branch revision | Not started |
| Hermes/OpenClaw task queue | Not started |
| Domain onboarding / DNS verifier | Not started |
| PDF extraction / image OCR pipeline | Half built |
| PaddleOCR provider | Working wrapper |
| OCRmyPDF provider | Working wrapper |
| Demo video generator | Not started |
| ROI report | Not started |
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
```

If a module cannot be validated with a command or screenshot artifact, it is not done.
