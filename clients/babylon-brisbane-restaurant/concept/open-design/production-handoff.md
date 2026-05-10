# babylon-brisbane-restaurant Production Handoff

Generated: 2026-05-07T07:24:47.589Z

## Concept

- Open Design project: babylon-brisbane-restaurant-open-design-1778138142858
- Open Design run: 94a3a5f2-b4af-47c0-a8bc-129447d4c9ad
- Agent: codex
- Skill: web-prototype
- Concept path: /Users/matthew/Developer/google-map-website/clients/babylon-brisbane-restaurant/concept/open-design
- Source URL: https://babylonbrisbane.com.au/

## Source Of Truth

- Evidence: /Users/matthew/Developer/google-map-website/clients/babylon-brisbane-restaurant/evidence/evidence.json
- Content: /Users/matthew/Developer/google-map-website/clients/babylon-brisbane-restaurant/content.restaurant.json
- Design: /Users/matthew/Developer/google-map-website/clients/babylon-brisbane-restaurant/design.restaurant.json
- Survey: /Users/matthew/Developer/google-map-website/clients/babylon-brisbane-restaurant/intake/website-survey.json

Rule: business facts come from source-of-truth artifacts; Open Design supplies visual direction.

## Target

- Repo: /Users/matthew/Developer/webjuice-generated/babylon-brisbane-restaurant
- Branch: dev
- Framework: Webjuice/Astro on Cloudflare Pages

## Concept Pages

- home -> / (concept-section)
- functions -> /private-dining (concept-section)
- contact -> /contact (concept-section)

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

## Warnings

- No captured source pages found for source redesign.
