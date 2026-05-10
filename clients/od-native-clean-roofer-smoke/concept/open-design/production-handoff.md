# od-native-clean-roofer-smoke Production Handoff

Generated: 2026-05-08T20:37:08.677Z

## Concept

- Open Design project: od-native-clean-roofer-smoke-open-design-1778272265798
- Open Design run: e9f5705f-49c9-451d-ad1f-82d54fcedffc
- Agent: codex
- Skill: web-prototype
- Concept path: /Users/matthew/Developer/google-map-website/clients/od-native-clean-roofer-smoke/concept/open-design
- Source URL: -

## Source Of Truth

- Evidence: -
- Content: -
- Design: -
- Survey: -

Rule: business facts come from source-of-truth artifacts; Open Design supplies visual direction.

## Target

- Repo: -
- Branch: dev
- Framework: Webjuice/Astro on Cloudflare Pages

## Concept Pages


## Required Preservation Checks

- business name
- phone
- address
- primary CTA
- brand/logo
- navigation/sitemap intent

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
- content artifact not found; importer must not trust concept text as final business data.
- Open Design brand-spec.md missing; production builder must manually extract tokens from index.html.
- No local concept image assets found.
