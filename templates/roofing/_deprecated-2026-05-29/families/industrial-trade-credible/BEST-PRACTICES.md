# Best Practices · Australian Local Trade Websites

> Read this BEFORE designing. These are non-negotiable conversion + UX standards for roofing / trade / home-services sites in AU.

## 1. Conversion fundamentals

- **5-second test**: visitor must know business + location + how to contact within 5s of landing
- **Above-the-fold MUST contain**: H1 + sub + phone CTA + 1 real photo
- **Phone visibility**: header top-right (desktop) + sticky bottom (mobile) + footer + every CTA section · minimum 3 `tel:` links per page
- **CTA hierarchy**: primary = phone (highest intent) · secondary = quick-quote-form · tertiary = view work
- **Quick-quote-form in hero**: 4 fields max (name · phone · suburb · service interest) · right column desktop · stacked below mobile
- **Trust within 2 scrolls**: licensing + warranty + rating + years all visible without scrolling past 2 viewport heights

## 2. Information architecture

- 5-8 primary nav items max
- Service hub `/services` + per-service detail pages `/services/<id>`
- One service-area page per suburb/town for long-tail SEO
- Any page reachable ≤3 clicks from home
- Breadcrumbs on all inner pages with schema.org BreadcrumbList
- Mobile: hamburger drawer (right-side) + phone icon stays in header
- Sitemap.xml auto-generated · submitted to Search Console
- robots.txt with explicit sitemap path

## 3. Content strategy

### Page-level copy depth (minimum)

| Page type | Word count |
|---|---|
| Home | 600-1000 |
| Service detail | 600-1000 each |
| About | 800-1200 |
| Service area page | 200-400 each |
| FAQ section | 15-25 Q&A · 50-100 words each answer |

### Hero copy formula

```
H1: [Specific Service] for [Audience] in [Location]
   "Colorbond Roof Replacement for Ballarat Homeowners"

Sub: [Outcome] + [Proof number] + [Risk reversal]
   "Licensed Vicwest crew · 20 years · 10-year workmanship warranty"

Primary CTA: "Call [number]" (tel: link)
Secondary CTA: "Free quote in 24h" (form anchor)
```

### Service detail page · PASTOR framework

Each service page MUST include in order:

1. **Problem** (50 words · what's failing · specific symptoms)
2. **Amplify cost** (80 words · what it costs to delay · with $ ranges)
3. **Story / Proof** (100 words · similar customer case)
4. **Transformation** (80 words · what after looks like)
5. **Offer specifics** (200 words · materials brands · process · timeline · warranty detail)
6. **Response** (50 words · CTA + risk reversal)

= 560+ words per service page minimum.

### About page structure

1. Origin story (180 words)
2. Team narrative (200 words · real names if available)
3. Numbers (years · projects · coverage · warranty stats)
4. Values (3-5 · 50 words each · concrete actions not platitudes)
5. Certifications (logos + verification links)

### FAQ depth

15-25 questions covering: pricing range · licensing detail · timeline · warranty scope · materials brands · process steps · payment terms · insurance · service area · emergency response · disruption to daily life · public liability insurance · industry memberships · evaluation visit detail · cancellation policy · weather impact · complaints handling.

### Forbidden phrases

Never use these cliché phrases in any copy:
- "trusted partner" / "your trusted X"
- "X years of excellence"
- "we pride ourselves on"
- "innovative solutions"
- "tailored to your needs"
- "quality service" / "premium quality"
- "we protect your home"
- "your roofing experts"
- "welcome to [business]"
- "second to none"
- "best in class"

Replace with: specific numbers · named materials · concrete process steps · verifiable claims.

## 4. Visual design

### Hero photography

- **MUST be full-bleed**: 100% width × 80vh+ height
- **NEVER split-hero** (text-left / photo-right pattern)
- **Dark scrim overlay** (linear-gradient 0.7 → 0 right-to-left) for text legibility
- Text overlays photo · bottom-left or center
- Quick-quote-form (when present): card floating bottom-right with brass border

### Forbidden visual patterns

- Photo in side column (small/inset)
- Bordered/framed hero image
- Carousel / auto-rotating hero
- Stock crew handshake photos
- SVG-only "decorative" heroes
- Gradient backgrounds (except dark hero scrim)
- Glassmorphism · drop shadows on hero text · marquee scrolls

### Section rhythm

- Major section spacing: 80-144px vertical between sections
- Internal block spacing: 16-32px
- Alternate `--surface` (white) and `--surface-muted` (light grey) backgrounds
- One photo-dominant section between every 2-3 information-dense sections

### Typography hierarchy

- H1: clamp(40-88px) · weight 700 · 0.94 line-height
- H2: clamp(28-50px) · weight 600 · 1.04 line-height
- H3: clamp(20-26px) · weight 700 · 1.12 line-height
- Body: 16px · 400 · 1.55 line-height
- Mono labels: 12px · 600 · 0.08em tracking · UPPERCASE
- All headings: no trailing periods

## 5. Required modules per page type

### Home (10 sections)

1. Hero with quick-quote-form
2. Trust strip
3. Services grid
4. Why-us / differentiators (3-5 numbers)
5. Process timeline (4-step horizontal)
6. **Proof / reviews strip** (NEW)
7. Gallery (3-6 projects · before/after where available)
8. Service areas
9. FAQ (8-10 questions on home)
10. CTA band → footer

### Service detail (9 sections)

1. Hero full-bleed + quick-quote-form
2. Pain-point band
3. Cost-of-delay band
4. Process timeline (4-step)
5. Materials spec table
6. Gallery (filtered to this service)
7. **Comparison band** (us vs typical crew)
8. FAQ (filtered to this service)
9. Risk reversal + CTA

### About (7 sections)

hero + story + team + numbers + values + certifications + cta

### Gallery (5 sections)

hero + filter bar + edge-to-edge grid + before/after sliders + cta

### Contact (7 sections)

hero + full form + contact details + map embed + service area list + hours · emergency + faq subset

## 6. Forms

- **Quick-quote-form** (hero): 4 fields max · name + phone + suburb + service-interest dropdown
- **Full contact-form** (/contact): 5-7 fields · adds email + message + best time to call
- Field height: ≥44px (mobile tap target)
- Label above input · NEVER inline label
- Submit button: never "Submit" · use "Get my free quote" or "Send my message"
- Privacy line: "We never share your info · auto-reply within 24h"
- Honey-pot spam protection (no reCAPTCHA · too slow)
- Cloudflare Turnstile for bot detection
- Response SLA written next to form
- Destination: customer email + Discord/Slack webhook + CRM

## 7. Trust signals

| Signal | Display location |
|---|---|
| License number | Header trust strip + footer + every service page · real number · link to state authority verify |
| ABN | Footer copyright + about page |
| Public liability insurance | Footer + about · with $ figure + insurer name |
| Workmanship warranty | Hero strip + service detail + footer trust strip |
| Manufacturer warranty | Service detail + footer trust strip |
| Google rating | Header strip + footer + reviews page · real reviews · don't fabricate |
| Years in business | Hero + header + about |
| Industry associations | Footer logos row · Master Builders / HIA / Colorbond Reseller |
| Project gallery | Real photos · before/after pairs · 8+ projects |
| Real customer reviews | About / reviews / footer · schema.org Review markup |

## 8. Reviews · real-or-generated policy

- **If customer has real reviews on GBP/Yelp/FB** → scrape · display with schema.org markup · attribute by first-name + suburb + date · embed GBP review widget
- **If customer has only star-rating (4.1★/18) but no per-review text** → display the aggregate prominently (header strip + footer) · DON'T fabricate individual review quotes
- **If customer is brand new (no reviews)** → omit reviews section entirely OR use a "We're new — read about why customers will say X" placeholder
- **AI-generated review fallback** (only when explicit customer permission):
  - Mark as `[AI-generated · awaiting customer review]` in metadata
  - Use realistic but generic phrasing
  - Provide easy 1-click replace mechanism
  - Default OFF · opt-in only
- **NEVER**: fake customer names + photos · fake exact dollar quotes · fake locations

## 9. Performance

| Metric | Target |
|---|---|
| LCP (Largest Contentful Paint) | <2.5s · hero image must be preloaded with width/height attrs |
| CLS (Cumulative Layout Shift) | <0.1 · all images fixed aspect-ratio · font-display swap |
| INP (Interaction to Next Paint) | <200ms · no main-thread blocking |
| First Paint | <1s · critical CSS inline · defer non-critical |
| Total page weight | <1.5MB · hero <200KB AVIF · gallery lazy load |
| Image format | AVIF > WebP > JPG · no PNG except transparency |

Lazy load all non-above-the-fold images. Brotli compression. HTTP/3.

## 10. Mobile (≥70% of trade customers)

- Tap targets ≥44×44px
- Sticky bottom phone CTA · brass background · always visible
- Hamburger drawer (right-slide) · phone icon stays in header
- No horizontal scroll @ 360/390/430px
- Hero text minimum 28px
- Body minimum 16px
- Form fields full-width · stacked vertically
- Touch-friendly accordion (not hover-only)
- No modal interstitials (Google penalizes)
- Hero image `object-position` to keep subject on mobile crop

## 11. SEO

### On-page

- Title tag: 60 chars max · `[Service] in [City] | [Business]`
- Meta description: 150-160 chars · CTA included
- One H1 per page · contains main keyword + location
- H2-H3 hierarchy not skipped
- Image alt: specific descriptive text · "Aerial view of completed Colorbond roof in Ballarat" not "image"
- Internal linking: home → 3+ service links · service → 2+ related services
- URL slug: kebab-case · short · keyword-bearing

### Schema markup (JSON-LD required)

- LocalBusiness (header · every page)
- Service (per service page)
- FAQPage (where FAQ exists)
- Review / AggregateRating
- BreadcrumbList (every inner page)
- Organization (about page)

### Long-tail

- One service-area page per suburb · localized 200-400 words each
- Examples: `/roofers-ballan` · `/buninyong-roof-restoration` · `/creswick-gutter-replacement`

## 12. Accessibility (WCAG AA)

- Color contrast: body ≥4.5:1 · large text ≥3:1
- Focus indicators on all interactive elements (2px accent outline)
- Skip-to-content link as first tab stop
- Full keyboard navigation
- No skipped heading levels
- Real `<label>` elements (not just placeholder)
- Alt text on all images · alt="" for decorative
- aria-* attributes on accordions/drawers/modals
- Respect `prefers-reduced-motion`

## 13. Legal / compliance (AU)

- Privacy Policy (GDPR-friendly even if non-EU)
- Terms of Service
- Cookie banner (only if using non-essential cookies)
- AU Consumer Law trade-specific disclosures
- License number displayed (Building Code requirement)
- ABN displayed alongside business name
- ACMA spam-act compliance for forms

## 14. Local-trade specifics

- Real Google Maps embed (not screenshot) with real coordinates
- Reviews aggregator: live GBP widget OR star+count linked to GBP
- Service area visualization: actual polygon map · not just text list
- Emergency contact: "24/7 emergency line" if customer truly offers it
- Insurance certificate: downloadable PDF on about page
- Before/after slider: real customer projects · drag-to-reveal · ≥4 pairs
- License verify: clickable link to state authority's verification page
- Pricing transparency: ranges + "what affects price" explainer (never exact dollars)
- Financing information when offered

## 15. Post-launch (ongoing)

- A/B test primary CTA copy (monthly)
- Heatmap (Hotjar / Microsoft Clarity)
- Form field analytics (drop-off per field)
- Speed monitoring (PageSpeed Insights monthly)
- Schema validator (Google Rich Results Test)
- Mobile usability (Search Console)
- Conversion tracking (GA4 events for phone clicks + form submissions)

---

## QA gate (run before declaring done)

- [ ] 5-second test passes
- [ ] Phone visible above-the-fold every page
- [ ] Quick-quote-form in hero of home + every service detail
- [ ] Full contact-form on /contact
- [ ] License number + ABN displayed (real or `[customer to verify]`)
- [ ] Hero is full-bleed (not split)
- [ ] Real photos used (or stock library · never SVG-only)
- [ ] Footer has all 14 categories above
- [ ] 15-25 FAQ questions
- [ ] Per-page word count meets minimums
- [ ] All schema markup present and valid
- [ ] No forbidden phrases
- [ ] No CLS jumping when navigating
- [ ] Header byte-identical across pages
- [ ] No horizontal scroll mobile
- [ ] All tap targets ≥44px
