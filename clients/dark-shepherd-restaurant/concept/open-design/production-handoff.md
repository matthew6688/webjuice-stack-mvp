# dark-shepherd-restaurant Production Handoff

Generated: 2026-05-07T23:51:31.609Z

## Concept

- Open Design project: dark-shepherd-restaurant-open-design-1778154549135
- Open Design run: 4e37751c-8336-4849-9bff-1883e6e4359c
- Agent: codex
- Skill: web-prototype
- Concept path: /Users/matthew/Developer/google-map-website/clients/dark-shepherd-restaurant/concept/open-design
- Source URL: https://www.darkshepherd.com.au/

## Source Of Truth

- Evidence: /Users/matthew/Developer/google-map-website/clients/dark-shepherd-restaurant/evidence/evidence.json
- Content: /Users/matthew/Developer/google-map-website/clients/dark-shepherd-restaurant/content.restaurant.json
- Design: /Users/matthew/Developer/google-map-website/clients/dark-shepherd-restaurant/design.restaurant.json
- Survey: /Users/matthew/Developer/google-map-website/clients/dark-shepherd-restaurant/intake/website-survey.json

Rule: business facts come from source-of-truth artifacts; Open Design supplies visual direction.

## Target

- Repo: -
- Branch: dev
- Framework: Webjuice/Astro on Cloudflare Pages

## Concept Pages

- home -> / (concept-section)
- menu -> /menu (concept-section)
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

- targetRepo was not supplied; handoff is tool-agnostic and must be bound before implementation.
- No captured source pages found for source redesign.
