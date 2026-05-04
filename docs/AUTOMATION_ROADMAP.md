# Profits Local Automation Roadmap

> Goal: turn the current restaurant preview prototype into an automated, evidence-backed, design-led local business sales and fulfillment system.

## North Star

The system should run this loop with minimal manual work:

1. Discover local business leads.
2. Build an evidence pack from Google Places, official websites, PDFs, images, and OCR.
3. Select a niche adapter.
4. Generate a brand-aware design system using Huashu Design / open-design principles.
5. Render a high-quality preview site.
6. Generate screenshots, a short demo video, and an outreach pack.
7. Send or prepare outreach.
8. Let the customer purchase through Tally.
9. Convert the purchase into an AI agent task.
10. Let the customer submit feedback.
11. Agent revises the dev branch.
12. Customer approves.
13. Connect domain, deploy live, and record revenue/costs for ROI.

## Architecture

```txt
core/
  evidence/
  extractors/
  ocr/
  brand/
  design-engine/
  render/
  qa/
  outreach/
  funnel/
  agents/
  domain/
  finance/

niches/
  restaurant/
    schema.ts
    adapter.ts
    validators.ts
    design-brief.ts
    renderers/

clients/
  {clientSlug}/
    profile.json
    evidence/
    brand.json
    content.restaurant.json
    design.json
    funnel.json
    domain.json
    finance.json
    outreach/
```

## Phase 0: Baseline Hardening

### Tasks

- [ ] Move secret/API keys out of chat/manual usage into `.env.local` and GitHub/Cloudflare secrets.
- [ ] Add `.env.example` entries for:
  - `GOOGLE_PLACES_API_KEY`
  - `FIRECRAWL_API_KEY`
  - `TALLY_API_KEY`
  - `OPENAI_API_KEY`
  - `CF_API_TOKEN`
  - `CF_ACCOUNT_ID`
  - `RESEND_API_KEY`
- [ ] Add `scripts/check-env.js`.
- [ ] Add `scripts/check-links.js` for deployed previews.
- [ ] Add `scripts/check-deploys.js` for GitHub Actions status.
- [ ] Add a `docs/SECURITY.md` key handling policy.

### Validation

- `node scripts/check-env.js` reports required/missing variables by workflow.
- No API keys are committed.
- `npm run build` passes.
- `git status` clean after generated files are intentionally ignored.

## Phase 1: Evidence Engine

### Purpose

Create one source of truth for every factual claim used on a preview site.

### Tasks

- [x] Create `core/evidence/evidence.js`.
- [x] Create `clients/{clientSlug}/evidence/evidence.json` format.
- [x] Implement `EvidenceItem`:

```ts
type EvidenceItem<T> = {
  key: string;
  value: T;
  sourceType:
    | "google_places"
    | "official_site"
    | "pdf"
    | "image_ocr"
    | "firecrawl"
    | "manual"
    | "generated";
  sourceUrl?: string;
  confidence: number;
  scrapedAt: string;
  extractor: string;
};
```

- [x] Implement merge rules:
  - Official website beats directory sites for menu/brand.
  - Google Places beats website for current phone/address/rating unless website is clearly newer.
  - PDF/HTML menu beats image OCR.
  - Generated content must be explicitly marked `generated`.
- [x] Create evidence validators:
  - Address present.
  - Phone present.
  - At least one CTA: call/reserve/map.
  - Menu source present for restaurant menu pages.
  - Every menu item has a source chain.

### Validation

- Run `node scripts/evidence/build.js --client longwang`.
- Run `node scripts/evidence/validate.js --client longwang`.
- Validation output lists missing/low-confidence fields.
- No renderer can read raw scrape data directly; it reads only content generated from evidence.

## Phase 2: Extractors

### Extractors

- [x] `GooglePlacesExtractor`
  - Text Search
  - Details
  - Cost logging per API call
- [ ] `GooglePlacesPhotoExtractor`
  - Photos download
  - Cost logging per photo call
- [x] `FirecrawlExtractor`
  - Official website scrape
  - Links
  - HTML
  - Markdown
  - Cost logging per scrape
- [ ] `MenuPdfExtractor`
  - Download PDFs
  - Extract text
  - Parse sections/items/prices
  - Store original PDF in evidence documents
- [ ] `MenuImageOCRExtractor`
  - Google Maps photo OCR
  - Website image OCR
  - Confidence scoring
- [ ] `BrandAssetExtractor`
  - Logo candidates
  - Official photos
  - Website palette
  - Font hints
- [ ] `ReservationExtractor`
  - SevenRooms
  - NowBookIt
  - Tock/OpenTable/Resy if needed
- [ ] `ContactExtractor`
  - `tel:`
  - `mailto:`
  - contact page

### Validation

- Each extractor writes:
  - raw artifact
  - normalized evidence
  - cost event
- Each extractor has a dry-run mode.
- Each extractor has at least one real restaurant fixture test.

## Phase 3: Restaurant Niche Adapter

### Purpose

Make restaurant a formal plugin, not custom hand work.

### Tasks

- [ ] Create `niches/restaurant/schema.ts`.
- [ ] Create `RestaurantContent`:

```ts
type RestaurantContent = {
  hero: {
    name: string;
    cuisine: string;
    rating?: number;
    reviewCount?: number;
  };
  contact: {
    phone: string;
    email?: string;
    address: string;
    googleMapsUrl: string;
  };
  booking?: {
    provider: string;
    url: string;
  };
  menu: {
    sourceUrl: string;
    sections: MenuSection[];
  };
  gallery: ImageAsset[];
};
```

- [ ] Implement `niches/restaurant/adapter.ts`.
- [ ] Implement fallback levels:
  - Level A: official website menu + official photos + logo.
  - Level B: PDF menu + Google photos + logo.
  - Level C: Google Places only + photo OCR if menu photos exist.
  - Level D: starter site, no menu claims.
- [ ] Add restaurant validators:
  - Menu page cannot render sample menu if menu source is missing.
  - Call CTA must be `tel:`.
  - Map CTA must be Google Maps URL.
  - Reservation CTA must be official provider or omitted.

### Validation

- Build restaurant content for all 5 Brisbane restaurants from evidence.
- Compare generated content against current manually curated pages.
- Run link validation on deployed pages.

## Phase 4: Design Engine

### Purpose

Design quality is the core moat. Renderer should consume a design brief, not improvise.

### Inputs

- Evidence pack.
- Brand assets.
- Niche content.
- Huashu Design rules.
- open-design references.

### Tasks

- [ ] Create `core/design-engine/schema.ts`.
- [ ] Create `BrandSystem`:

```ts
type BrandSystem = {
  logo: ImageAsset;
  palette: {
    bg: string;
    paper: string;
    ink: string;
    muted: string;
    accent: string;
    accent2?: string;
  };
  typography: {
    heading: string;
    body: string;
  };
  photoStyle: string;
  designDirection: string;
  qualityScore: number;
};
```

- [ ] Implement brand extraction from official sites.
- [ ] Add design levels:
  - `clean-template`
  - `brand-matched`
  - `bespoke-huashu`
- [ ] Create restaurant design directions:
  - `fine-dining-editorial`
  - `greek-island-hospitality`
  - `middle-eastern-fire-kitchen`
  - `riverside-brunch`
  - `asian-night-market`
- [ ] Add visual QA checklist:
  - Desktop screenshot.
  - Mobile screenshot.
  - Text overflow.
  - Tap targets.
  - CTA visibility.
  - Brand/logo visible above fold.
  - Real images used.

### Validation

- Generate screenshots for each preview:
  - desktop home
  - desktop menu
  - mobile home
  - mobile menu
- Store screenshots in `clients/{clientSlug}/outreach/screenshots`.
- Human review score recorded in `design.json`.

## Phase 5: Renderer System

### Tasks

- [ ] Move hardcoded Astro pages into `niches/restaurant/renderers/*`.
- [ ] Renderer input:
  - `RestaurantContent`
  - `BrandSystem`
  - `FunnelConfig`
- [ ] Renderer output:
  - Astro files
  - images
  - `site.ts`
  - routes
- [ ] Add multiple restaurant renderers:
  - `menu-signature`
  - `menu-editorial`
  - `venue-gallery`
  - `quick-booking`

### Validation

- Run `node scripts/render-client.js --client longwang --renderer menu-signature`.
- `npm run build` passes in generated repo.
- Screenshot diff confirms the renderer changed the page.

## Phase 6: QA and Demo Video

### Tasks

- [ ] Add Playwright QA script.
- [ ] Validate:
  - pages return 200
  - no console errors
  - images load
  - `tel:` exists
  - reservation link exists when source exists
  - Google Maps link exists
  - source links exist
- [ ] Generate screenshots:
  - `desktop-home.png`
  - `mobile-home.png`
  - `desktop-menu.png`
  - `mobile-menu.png`
- [ ] Generate demo video:
  - open home
  - scroll hero
  - open menu
  - show reserve CTA
  - show map CTA
  - show claim/purchase CTA
- [ ] Store video as `outreach/demo.mp4`.

### Validation

- QA exits non-zero on broken links/images.
- Video file exists and duration is 20-45 seconds.
- Screenshots are attached to outreach pack.

## Phase 7: Tally Sales Funnel

### Purpose

Preview site should convert directly.

### Tasks

- [ ] Create `core/funnel/tally.ts`.
- [ ] Store Tally API key only as environment variable.
- [ ] Define purchase form fields:
  - package
  - business name
  - contact name
  - email
  - phone
  - domain status
  - feedback/comments
- [ ] Define hidden fields:
  - `previewId`
  - `clientSlug`
  - `repo`
  - `niche`
  - `previewUrl`
  - `package`
  - `price`
- [ ] Add checkout CTA to preview site.
- [ ] Add Tally webhook endpoint:
  - receive paid submission
  - verify payload
  - create `AgentTask`
  - record revenue event
- [ ] Add feedback form:
  - design changes
  - menu/content changes
  - domain info
  - launch approval

### Validation

- Create test Tally form in sandbox/test mode if available.
- Submit test purchase.
- Webhook creates:
  - `clients/{clientSlug}/funnel/submission.json`
  - revenue event
  - agent task
- Preview page hidden fields map to correct client.

## Phase 8: Agent Loop

### Purpose

Hermes/OpenClaw should modify bounded data/models, not randomly edit repo files.

### Tasks

- [ ] Create `core/agents/schema.ts`.
- [ ] Define task types:
  - `activate`
  - `revise`
  - `publish`
  - `domain`
  - `qa-fix`
- [ ] Agent task format:

```ts
type AgentTask = {
  id: string;
  clientSlug: string;
  type: string;
  repo: string;
  branch: "dev" | "main";
  evidencePath: string;
  contentPath: string;
  designPath: string;
  acceptanceCriteria: string[];
  createdFrom: "tally_payment" | "tally_feedback" | "manual";
};
```

- [ ] Add task queue directory:
  - `agent-tasks/pending`
  - `agent-tasks/running`
  - `agent-tasks/done`
- [ ] Add `scripts/agent/create-task.js`.
- [ ] Add `scripts/agent/validate-task-result.js`.

### Validation

- Tally test submission creates an agent task.
- Agent task can be run manually.
- Result push triggers dev deploy.
- QA script verifies dev preview.

## Phase 9: Domain Onboarding

### Tasks

- [ ] Create `core/domain/schema.ts`.
- [ ] Add domain fields to Tally purchase/feedback forms.
- [ ] Implement DNS detection:
  - nameservers
  - A/AAAA
  - CNAME
  - current website
- [ ] Implement Cloudflare Pages domain attach.
- [ ] Implement DNS instruction generator:
  - Cloudflare
  - GoDaddy
  - Namecheap
  - Squarespace
  - Wix
  - generic
- [ ] Implement polling:
  - DNS record detected
  - Cloudflare custom domain active
  - SSL active
- [ ] Record domain status in `domain.json`.

### Validation

- Use a test domain/subdomain.
- Generate instructions.
- Detect DNS.
- Attach Pages custom domain.
- Verify HTTPS 200.

## Phase 10: Finance and ROI Ledger

### Purpose

Track cost per lead, cost per preview, revenue per conversion, and ROI.

### Cost Events

Every paid or value-bearing action writes a ledger entry:

```ts
type LedgerEvent = {
  id: string;
  clientSlug?: string;
  campaignId?: string;
  type: "cost" | "revenue";
  category:
    | "google_places"
    | "firecrawl"
    | "openai"
    | "image_generation"
    | "ocr"
    | "resend"
    | "domain"
    | "cloudflare"
    | "tally"
    | "labor_estimate"
    | "sale";
  units: number;
  unitCost: number;
  amount: number;
  currency: "USD" | "AUD";
  provider: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};
```

### Tasks

- [ ] Add `core/finance/ledger.ts`.
- [ ] Add `data/finance/ledger.jsonl`.
- [ ] Add cost logging to:
  - Google Places calls
  - Firecrawl calls
  - OpenAI calls
  - image generation
  - Resend emails
  - domain purchases
  - Tally revenue events
- [ ] Add `scripts/finance/report.js`.
- [ ] Report:
  - cost per lead
  - cost per preview
  - cost per outreach
  - cost per paid customer
  - revenue
  - gross margin
  - ROI
  - payback period

### Validation

- Run a full test workflow.
- Ledger has both cost and revenue entries.
- Report calculates:
  - total costs
  - total revenue
  - ROI = `(revenue - cost) / cost`

## Phase 11: Outreach Automation

### Tasks

- [ ] Generate `outreach/source-summary.md`.
- [ ] Generate `outreach/audit-summary.md`.
- [ ] Generate screenshots.
- [ ] Generate demo video.
- [ ] Generate email variants:
  - existing bad website
  - no website / Google Maps only
  - menu/booking improvement
- [ ] Integrate Resend.
- [ ] Log email cost and delivery status.

### Validation

- Dry-run email produces HTML preview.
- Email includes:
  - preview URL
  - screenshot
  - demo video link
  - claim CTA
- Ledger records outreach cost.

## Phase 12: Scale to More Niches

### Candidate Niches

- Roofing
- Plumbing
- Dental
- Beauty clinics
- Fitness studios
- Trades

### Tasks Per Niche

- [ ] Define required evidence.
- [ ] Define conversion CTAs.
- [ ] Define design directions.
- [ ] Define renderer templates.
- [ ] Define validators.
- [ ] Run 5 real local-business pilots.
- [ ] Compare ROI against restaurant.

## Execution Order

1. Phase 0: Baseline hardening.
2. Phase 1: Evidence schema and validation.
3. Phase 2: Google Places + Firecrawl extractors with ledger events.
4. Phase 3: Restaurant adapter.
5. Phase 10: Finance ledger minimum viable report.
6. Phase 6: QA screenshots and video.
7. Phase 7: Tally funnel.
8. Phase 8: Agent tasks.
9. Phase 9: Domain onboarding.
10. Phase 11: Outreach automation.
11. Phase 12: More niches.

## Definition of Done for Complete Loop

- A new restaurant lead can be processed from Google Places query to preview site without manual editing.
- Evidence pack exists and validates.
- Menu is sourced from official website/PDF/OCR or omitted honestly.
- Brand assets are real or marked generated.
- Preview site deploys.
- Desktop/mobile screenshots are generated.
- Demo video is generated.
- Tally checkout is linked and carries hidden client fields.
- Paid Tally submission creates an agent task.
- Feedback submission creates a revision task.
- Agent pushes dev branch.
- QA validates dev preview.
- Customer approval triggers live deploy.
- Domain onboarding status is tracked.
- Revenue and all provider costs are recorded.
- ROI report can be generated per client and campaign.
