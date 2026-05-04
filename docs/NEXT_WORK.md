# Next Work

Updated: 2026-05-04

## Current State

The Brisbane restaurant MVP is no longer an empty-site prototype. The system now has evidence packs, restaurant content artifacts, Huashu-ready design briefs, checkout artifacts, outreach screenshots/videos, deployment checks, and ROI ledger plumbing.

Verified live state:

- 5 generated restaurant previews return HTTP 200.
- 5 generated restaurant repos have latest GitHub Actions `completed/success`.
- Tally payment/feedback payloads are stable across dry-runs.
- Google Places photo extraction has dry-run validation, media manifests, evidence append support, and cost ledger logging.
- No known API keys are committed.

## Highest Priority Remaining Work

### 1. Live Tally Checkout

Goal: customer can pay `$399` or `$799` from a preview site.

Tasks:

- Put `TALLY_API_KEY` into local `.env.local`.
- Verify Tally workspace payment provider settings.
- Run live Tally payment form creation for one client.
- Create/update feedback form.
- Update checkout URLs in all client artifacts.
- Sync checkout artifacts into generated repos.
- Verify a test/sandbox purchase payload creates:
  - revenue ledger event
  - `activate` agent task
  - correct hidden fields

Validation:

```bash
npm run check:env -- --workflow funnel
npm run funnel:create-tally-payment-forms -- --client longwang-restaurant-restaurant --publish true
npm run funnel:create-tally-feedback-form -- --client longwang-restaurant-restaurant --publish true
npm run funnel:record-tally -- --input <fixture-or-webhook-payload>
npm run agent:create-task -- --tally <fixture-or-webhook-payload>
```

### 2. Brand Asset Extractor

Goal: every preview uses real logo/photos/colors when available.

Tasks:

- Extract logo candidates from official website HTML.
- Extract image candidates from official website and Google Places photos.
- Detect palette from official website/logo/image assets.
- Store assets under `clients/<slug>/evidence/media`.
- Append `brand.logo`, `brand.colors`, and `media.photos` evidence.
- Make design brief prefer official assets over generated assets.

Validation:

```bash
npm run extract:google-places-photos -- --client <slug> --dry-run
npm run evidence:validate -- --client <slug>
npm run design:restaurant-brief -- --client <slug>
```

### 3. Menu PDF And Image OCR

Goal: handle restaurants whose menu is a PDF, scanned document, or Google Maps photo.

Tasks:

- Implement `MenuPdfExtractor`.
- Download and store original PDF evidence documents.
- Try text extraction first.
- Fall back to OCRmyPDF for scanned PDFs.
- Fall back to PaddleOCR/image OCR for image menus.
- Convert extracted text into `menu.sections` with source chains.
- Mark OCR confidence clearly.

Validation:

```bash
npm run ocr:pdf -- --input <menu.pdf> --output <searchable.pdf>
npm run extract:menu -- --input <text-or-markdown> --client <slug> --write-evidence
npm run evidence:validate -- --client <slug>
```

### 4. Renderer Integration

Goal: generated client repos consume artifacts consistently instead of hand-edited pages.

Tasks:

- Make `webjuice-restaurant` the canonical renderer for:
  - `content.restaurant.json`
  - `design.restaurant.json`
  - `checkout.json`
  - synced images
- Migrate all 5 generated repos to the renderer flow.
- Add build verification after sync.
- Add screenshot QA after each sync.

Validation:

```bash
npm run clients:sync-artifacts -- --client <slug> --repo <local-client-repo> --build
npm run check:links -- --client <slug>
npm run check:deploys -- --client <slug>
```

### 5. Agent Loop End-To-End

Goal: a paid customer or feedback form automatically creates bounded work for Hermes/OpenClaw.

Tasks:

- Finalize task schema documentation.
- Add `validate-task-result`.
- Ensure runner can update dev branch artifacts safely.
- Run one local execute test against a generated repo.
- Push dev branch and verify preview.

Validation:

```bash
npm run agent:create-task -- --tally <payload>
npm run agent:validate-task -- --task <task.json>
npm run agent:run-task -- --task <task.json> --execute
npm run check:deploys -- --client <slug>
npm run check:links -- --client <slug>
```

### 6. Domain Onboarding For `profitslocal.com`

Goal: user-owned domain can point to the production site.

Tasks:

- Confirm `profitslocal.com` is in the same Cloudflare account as the API token.
- Attach domain to Pages project.
- Generate customer DNS instructions for apex/subdomain.
- Poll DNS and SSL status.
- Write `clients/<slug>/domain.json` or global domain status.

Validation:

```bash
npm run domain:inspect -- profitslocal.com --project profitslocal-live
npm run domain:attach-pages -- --domain profitslocal.com --project profitslocal-live --dry-run
```

### 7. Outreach Automation

Goal: email contains proof, screenshot, demo video, and purchase CTA.

Tasks:

- Configure Resend sender/domain.
- Generate HTML email variants for:
  - bad existing website
  - no website / Google Maps only
  - menu/booking improvement
- Attach screenshot and video links.
- Log email cost/delivery events.

Validation:

```bash
npm run check:env -- --workflow outreach
node scripts/send-cold-email.js --dry true
npm run finance:report -- --campaign brisbane-restaurants
```

## Blocking Inputs

- Local `.env.local` with real keys. Do not commit it.
- Tally workspace payment settings verified.
- Cloudflare token/account that can see `profitslocal.com`.
- Resend sender/domain configuration for live outreach.

## Suggested Build Order

1. Live Tally checkout for one client.
2. Brand asset extractor.
3. Menu PDF/image OCR.
4. Renderer migration for all 5 restaurant repos.
5. Agent loop execute test.
6. Domain attach and polling.
7. Resend outreach test.
8. Add next niche.
