# rich-and-rare-restaurant Production Handoff

Generated: 2026-05-06T11:34:14.943Z

## Concept

- Open Design project: rich-and-rare-restaurant-open-design-1778065212163
- Open Design run: 2a69100b-a214-4488-ad6c-0a58277b00b5
- Agent: codex
- Skill: web-prototype
- Concept path: /Users/matthew/Developer/google-map-website/clients/rich-and-rare-restaurant/concept/open-design
- Source URL: https://www.richandrare.com.au/

## Source Of Truth

- Evidence: /Users/matthew/Developer/google-map-website/data/collect-smoke/rich-and-rare/evidence.json
- Content: /Users/matthew/Developer/google-map-website/data/collect-smoke/rich-and-rare/client/content.restaurant.json
- Design: /Users/matthew/Developer/google-map-website/data/collect-smoke/rich-and-rare/client/design.restaurant.json
- Survey: /Users/matthew/Developer/google-map-website/data/collect-smoke/rich-and-rare/client/intake/website-survey.json

Rule: business facts come from source-of-truth artifacts; Open Design supplies visual direction.

## Target

- Repo: /Users/matthew/Developer/webjuice-generated/rich-and-rare-restaurant
- Branch: dev
- Framework: Webjuice/Astro on Cloudflare Pages

## Concept Pages

- home -> / (concept-section)
- home-hero -> / (concept-section)
- menus -> /menu (concept-section)
- experience -> /experience (concept-section)
- functions -> /private-dining (concept-section)
- contact -> /contact (concept-section)
- banquet -> /menu (captured-source-page)
- lunch-dinner -> /menu (captured-source-page)
- location -> /contact (captured-source-page)
- bookings -> /contact (captured-source-page)
- menu -> /menu (captured-source-page)

## Required Preservation Checks

- business name
- phone
- address
- primary CTA
- brand/logo
- navigation/sitemap intent
- menu source
- reservation link when available

## Implementation Plan

1. Validate the Open Design concept folder before implementation.
2. Read the project capsule, evidence artifact, content artifact, design artifact, and survey/build packet.
3. Port visual tokens, imagery direction, layout rhythm, and page hierarchy from the Open Design concept.
4. Build production routes/components in the Webjuice/Astro repo instead of shipping the standalone concept HTML directly.
5. Preserve official business facts from source-of-truth artifacts even when the concept has nicer copy.
6. For redesigns, preserve old URL intent and add permanent redirects where route names change.
7. Run build, link QA, visual QA screenshots, and delivery QA before customer review email.
8. Push to the dev branch only until customer approval.
