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

## Half Built

| Module | Status | Gap |
|---|---|---|
| Evidence engine | Half built | Data exists, but no normalized `evidence.json`, source confidence, or validators. |
| Restaurant niche adapter | Half built | Restaurant logic exists in practice, but no `niches/restaurant/adapter.ts`. |
| Design engine | Half built | Brand colors/logos/photos used, but no Huashu/open-design decision engine or scoring. |
| Cost tracking | Not yet wired | Need ledger events around every paid API call and every revenue event. |
| Outreach pack | Not yet wired | Need screenshots, video, email, source summary, audit summary in one artifact. |

## Not Started

| Module | Status |
|---|---|
| Tally checkout form automation | Not started |
| Tally webhook to agent task | Not started |
| Customer feedback form to dev branch revision | Not started |
| Hermes/OpenClaw task queue | Not started |
| Domain onboarding / DNS verifier | Not started |
| PDF extraction / image OCR pipeline | Not started |
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
