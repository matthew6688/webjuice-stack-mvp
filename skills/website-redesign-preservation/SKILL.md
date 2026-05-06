---
name: website-redesign-preservation
description: Use before redesigning an existing business website. Produces a preservation-first redesign packet that protects current URLs, sitemap, SEO, brand assets, core business facts, header/footer/nav, important content, and niche-specific requirements. Generic across local business types, with optional niche adapters such as restaurant and roofing.
---

# Website Redesign Preservation

Redesign means preserve first, improve second.

Do not start visual design until the existing website has been crawled, mapped, and classified. A beautiful redesign that drops phone numbers, booking links, service pages, menu data, legal pages, or old URLs is a failed redesign.

This skill does not build the website. It prepares the source-of-truth redesign packet that Codex, Hermes, Open Design, Claude Code, OpenCode, or another builder must obey.

## Inputs

Accept any mix of:

- official website URL;
- Google Places / Google Maps listing;
- existing sitemap.xml or robots.txt;
- Firecrawl crawl output;
- Dokobot browser-read output;
- brand asset extraction;
- PDFs, images, service menus, product catalogs, screenshots;
- customer notes or Discord discussion;
- current repo artifacts, if a preview already exists.

## Non-Negotiable Rule

For pages that are themselves the customer-facing content product, preservation means full content, not highlights.

Examples:

- a restaurant menu page must preserve the complete official menu;
- a salon service/pricing page must preserve the full service list and prices;
- a roofing services page must preserve all listed services and service-area claims;
- a catalog/product page must preserve all products or explicitly mark missing products as blocked.

Do not turn a complete page into "selected highlights" unless the user explicitly asks for a teaser or summary page.

## Tool Strategy

Use the tools in this order:

1. **Firecrawl as primary crawler**
   - best for scalable crawl, sitemap/page discovery, markdown, links, and repeatable automation.

2. **Dokobot as browser truth check**
   - use for JS-heavy sites, Google search/business panels, social/logged-in pages, pages Firecrawl extracts poorly, and dynamic booking/menu pages.

3. **TinyFish Fetch as extraction fallback / comparator**
   - use when Firecrawl returns section headings without item bodies, short/truncated content, or misses dynamic page text.
   - compare probe terms against Firecrawl; if TinyFish captures more complete content, prefer TinyFish as the content source.

4. **Brand asset extractor**
   - use for logo, favicon candidates, colors, fonts, hero/gallery images, and OG image.

5. **OCR/document extractors**
   - use only when critical content lives in PDFs, image menus, catalogs, or screenshots.

6. **Playwright**
   - use for final visual QA, screenshots, link checks, mobile overflow, and browser console errors.

7. **Local LLM/Ollama**
   - use as a critic/auditor, not source of truth. Ask it what disappeared, what conflicts, and what looks risky.

## Required Output

Write:

```text
clients/<client>/redesign/preservation-packet.json
clients/<client>/redesign/preservation-packet.md
```

If an order/case exists, also reference the packet in:

```text
data/cases/<client>/<order>/build-packet.md
```

## Required Packet Sections

The packet must include:

1. `currentSitemap`
   - URL, title, page type, importance, extraction source, status.

2. `proposedSitemap`
   - URL, title, page type, source old URLs, action: `keep`, `rewrite`, `merge`, `redirect`, or `drop_with_reason`.

3. `urlPreservation`
   - `keepSameUrl`, `redirects301`, `needsManualRedirectReview`, `droppedUrls`.

4. `coreBusinessFacts`
   - business name, address/service area, phone, email, hours, CTA URLs, map URL, social links, critical claims.

5. `brandAssets`
   - logo, favicon, colors, fonts, primary images, social/OG images, assets needing confirmation.

6. `contentPreservationMap`
   - old content block, importance, new destination, treatment, risk.

7. `seoPlan`
   - title/meta policy, canonical URLs, sitemap.xml, robots.txt, structured data, image alt text, old URL redirect policy.

8. `headerFooterNavigation`
   - nav links to preserve, nav links to add/remove, footer links, legal/contact/social links.

9. `nicheAdapter`
   - niche, additional required facts, niche-specific pages, schema, QA.

10. `readiness`
   - `ready_for_redesign`, `needs_more_crawl`, `needs_customer_confirmation`, or `blocked`.

## Critical Facts

These are always important:

- business name;
- logo and favicon;
- address or service area;
- phone;
- email or contact form target;
- hours when shown;
- primary CTA and CTA URL;
- Google Maps/directions link;
- social links;
- important products/services/menu/pricing;
- credentials, awards, licenses, warranties, testimonials, or legal claims;
- current footer links;
- current SEO title/description when useful.

Never invent these. Preserve, verify, or mark as missing.

## SEO Rules

For redesign, SEO is part of preservation.

Required:

- keep existing URLs when possible;
- create permanent `301` redirects when URLs change;
- generate `sitemap.xml`;
- generate `robots.txt`;
- preserve or improve per-page title and meta description;
- set canonical URLs;
- set Open Graph title/description/image;
- add structured data when applicable:
  - `LocalBusiness`;
  - `Organization`;
  - niche schema such as `Restaurant`;
  - `BreadcrumbList`;
  - `FAQPage` only when real FAQ exists;
- add useful image alt text;
- preserve internal links or redirect them;
- prevent accidental `noindex`;
- run broken-link checks.

URL priority:

1. Keep the same URL if the page purpose still exists.
2. Merge weak pages only when their important content is preserved elsewhere.
3. If a URL changes, create a `301` redirect.
4. If content is dropped, document why.
5. Never silently drop important old URLs.

## Content Importance

Classify every page and major content block:

- `must_keep`: critical business, legal, SEO, product/service, trust, or conversion content.
- `should_keep`: useful brand or trust content.
- `can_merge`: useful but does not need its own page.
- `can_rewrite`: meaning must stay but wording/layout can improve.
- `low_value`: repetitive, stale, boilerplate, or weak SEO filler.
- `needs_confirmation`: conflicting or unclear.

## Stop Conditions

Do not redesign if:

- crawl found fewer pages than the visible nav suggests;
- business name or primary contact info cannot be verified;
- logo/favicon cannot be identified or intentionally replaced;
- important pages cannot be read;
- service/menu/product/pricing data is unclear;
- a menu/service/product page has section headings but missing item bodies;
- extracted content fails obvious probe terms from the official rendered page;
- current site and Google Places conflict on address, phone, hours, or booking;
- sitemap/URL preservation plan is missing;
- the proposed sitemap drops important pages without a reason.

Output `blocked` or `needs_customer_confirmation` and list what is needed.

## Generic Niche Adapter Contract

Every niche can add:

- required facts;
- pages that must be preserved;
- structured data;
- CTA expectations;
- claims that must not be invented;
- QA checks.

Examples:

- restaurant: complete official menu, reservation, delivery/order, private dining, opening hours, `Restaurant` schema.
- roofing: services, service areas, license/insurance/warranty claims, quote CTA, emergency service claims, `LocalBusiness` schema.
- clinic: practitioners, booking, services, compliance language, insurance/payment notes.
- salon: service menu, pricing, booking, staff, gallery.
- law firm: practice areas, attorney bios, disclaimers, consultation CTA.

If no adapter exists, use generic local-business rules and mark niche gaps.

## Build Handoff

The packet must tell builders:

- source website URL;
- source crawl paths;
- preservation packet paths;
- proposed sitemap;
- URL redirects;
- framework/template constraints;
- niche adapter rules;
- QA checklist;
- commands to run after build.

Builders must read the packet before editing and must push customer-facing changes to `dev` first.
