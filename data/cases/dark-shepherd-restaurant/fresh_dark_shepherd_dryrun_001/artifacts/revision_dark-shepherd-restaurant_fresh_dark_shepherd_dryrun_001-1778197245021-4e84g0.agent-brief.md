# Agent Brief: revision_dark-shepherd-restaurant_fresh_dark_shepherd_dryrun_001-1778197245021-4e84g0

Client: dark-shepherd-restaurant
Repo: matthew6688/dark-shepherd-restaurant
Branch: dev
Mode: revision

## Required Read Order

1. data/cases/dark-shepherd-restaurant/fresh_dark_shepherd_dryrun_001/context-packet.json
2. data/cases/dark-shepherd-restaurant/fresh_dark_shepherd_dryrun_001/timeline.jsonl
3. data/cases/dark-shepherd-restaurant/fresh_dark_shepherd_dryrun_001/build-packet.md
4. clients/dark-shepherd-restaurant/intake/website-survey.json
5. clients/dark-shepherd-restaurant/evidence/evidence.json
6. clients/dark-shepherd-restaurant/content.restaurant.json
7. clients/dark-shepherd-restaurant/design.restaurant.json
8. clients/dark-shepherd-restaurant/brand-spec.md
9. clients/dark-shepherd-restaurant/concept/open-design/concept-manifest.json
10. clients/dark-shepherd-restaurant/concept/open-design/production-handoff.json

## Customer Request

Please update the hero supporting copy to emphasize steakhouse dining and late-night reservations, and add a short private dining note near the reservation CTA. This is a real revision smoke for the Dark Shepherd fresh project.

## Design Protocol

Required skill: huashu-design
Open Design project: dark-shepherd-restaurant-open-design-1778154549135
Open Design dataDir: /Users/matthew/Developer/open-design/.od
Open Design rule: Use this exact local Open Design project for design concept changes. Do not start a separate Open Design project unless the operator explicitly asks.
Continue command: npm run open-design:continue-concept -- --client dark-shepherd-restaurant --prompt "<change request>"
Sync command: npm run open-design:sync-from-app -- --client dark-shepherd-restaurant
- Official website work must look like a real formal website with brand hierarchy, not a data dump.
- Menu work must stay minimal, mobile-first, and content-focused.
- Preserve the existing design language unless the task explicitly asks for redesign.
- Use real restaurant photos and verified brand assets whenever available.

## Constraints

- Read the case context packet before planning edits.
- Website and menu are separate products; classify the request before editing.
- Use evidence/content/design/brand files as source of truth.
- Do not invent or overwrite menu prices, hours, address, phone, reservation links, or photos without evidence.
- Do not overwrite locked decisions from the case file.
- Push only to dev until customer approval.
