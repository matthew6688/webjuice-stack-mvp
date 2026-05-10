---
name: profitslocal-collect
description: Use when collecting messy local-business website inputs and turning them into ProfitsLocal source-of-truth artifacts. Handles Google Places, official sites, PDFs, images/OCR, customer notes, uploads, Discord discussion, and manual research. Produces evidence.json, website-survey.json, content/design/brand artifacts, a Ready-to-Build decision, and a QA contract for later delivery checks. Restaurant menu handling is restaurant-specific and optional.
---

# ProfitsLocal Collect

Turn messy local-business inputs into a buildable project capsule.

This skill does not build the website. It prepares the source-of-truth package and decides whether the project is ready to enter the build workflow.

## Inputs

Accept any mix of:

- Google Places / Google Maps details
- official website URL
- existing bad website
- PDFs, menu files, brochures, image menus, screenshots
- logo, photos, product/service images
- customer form submission
- Discord notes or uploaded assets
- manual operator notes
- agent research results

## Required Outputs

Write or update these files:

```text
clients/<client>/evidence/evidence.json
clients/<client>/intake/website-survey.json
clients/<client>/content.<niche>.json
clients/<client>/design.<niche>.json
clients/<client>/brand-spec.md
```

If an order/case exists, also write:

```text
data/cases/<client>/<order>/build-packet.md
```

## Workflow

1. Normalize identity:
   - client slug
   - niche
   - target product: `website`, `menu`, or `website_plus_optional_menu`
   - customer/source type: `outbound`, `manual`, `inbound`, or `paid_intake`

2. Extract evidence:
   - every public fact must have source type, source URL when available, confidence, extractor, and timestamp.
   - do not put customer/order email into public business contact facts.
   - generated images are visual assets only, never factual evidence.

3. Follow the source ladder:
   - Google Places first for identity, address, phone, map URL, rating, hours, and photo references.
   - official website scrape next for reservation links, menu candidates, brand language, and page copy.
   - brand asset extraction next for logo, colors, fonts, and official images.
   - menu/PDF/image OCR only when restaurant menu is needed and normal official-site text is insufficient.
   - customer/manual confirmation for anything that remains business-critical.

4. Fill gaps:
   - ask the human/customer when the gap is business-critical and cannot be verified.
   - if no more human information is available, agent may search/scrape/OCR.
   - record missing fields and conflicts instead of guessing.

5. Build niche artifacts:
   - restaurant: use restaurant adapter; menu route is optional and only enabled when real menu evidence exists or customer asks for it.
   - roofing: use service/area/estimate rules when adapter exists.
   - generic website core: never assume restaurant menu behavior.

6. Produce QA contract inside `website-survey.json`:
   - `mustVerify`
   - `mustNotInvent`
   - `nicheRequired`
   - `designExpectation`
   - `copyExpectation`
   - `technicalExpectation`

7. Run Ready-to-Build Gate:
   - `ready_to_build`
   - `needs_customer_confirmation`
   - `needs_more_info`
   - `blocked_conflicting_evidence`

## Ready-to-Build Meaning

Ready-to-Build means the project has enough verified or customer-confirmed information to start the first website version.

It does not mean the finished website is ready for customer review. That is decided later by Delivery QA.

## Restaurant Menu Rule

Menu is restaurant-niche-specific and optional.

Enable menu only when:

- target product is `menu` or `website_plus_optional_menu`, and
- real menu evidence exists, or the customer specifically asks for a menu and provides/verifies menu data.

Do not put menu requirements into generic website core.

## Google Places Reality

Google Places is excellent for lead identity but usually incomplete for final website build.

Usually present:

- business name
- address
- phone
- website
- Google Maps URL
- rating/review count
- hours
- photo references
- business types

Usually missing:

- logo
- real brand palette
- design language
- menu sections and prices
- email
- final reservation URL quality
- customer preferences

So Google Places alone usually creates `needs_more_info` or a lead-ready evidence pack. It becomes `ready_to_build` only after official-site/brand/menu/customer confirmation fills the missing contract.

## Minimum Survey Shape

```json
{
  "schemaVersion": 1,
  "clientSlug": "opa-bar-mezze-restaurant",
  "niche": "restaurant",
  "targetProduct": "website",
  "sourceType": "outbound",
  "business": {
    "name": "Opa Bar & Mezze",
    "addressOrServiceArea": "123 Eagle St, Brisbane City QLD 4000",
    "phone": "+61 7 2111 5155",
    "email": "",
    "website": "https://www.opabar.com.au"
  },
  "content": {
    "primaryOffer": "Greek restaurant and mezze bar in Brisbane",
    "primaryCta": "Reserve",
    "primaryCtaUrl": "https://example.com/reserve",
    "menuNeeded": false,
    "menuSource": ""
  },
  "brand": {
    "logo": "/images/logo.png",
    "colors": ["#063e52", "#fbf6ef"],
    "designDirection": "formal hospitality website"
  },
  "evidenceStatus": {
    "missing": [],
    "conflicts": [],
    "unverifiedClaims": []
  },
  "qaContract": {
    "mustVerify": ["business.name", "business.addressOrServiceArea", "business.phone", "content.primaryCtaUrl"],
    "mustNotInvent": ["menu prices", "hours", "reviews", "license claims"],
    "nicheRequired": ["restaurant reservation/contact CTA"],
    "designExpectation": "formal official website, not a menu-only page",
    "copyExpectation": "specific local-business copy with no fake claims",
    "technicalExpectation": "build passes, links work, mobile has no horizontal overflow"
  }
}
```

## Handoff Rule

When ready, create or update the build packet. The build packet must tell every builder:

- repo
- branch `dev`
- framework/template
- files to read first
- target product
- niche rules
- QA contract
- after-work commands

The same packet should work in Discord/Hermes, Codex, Open Design, Claude Code, and OpenCode.
