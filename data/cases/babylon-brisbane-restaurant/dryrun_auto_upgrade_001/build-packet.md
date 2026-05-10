# Website Build Packet: Babylon Brisbane

Generated: 2026-05-07T07:15:42.697Z
Client: babylon-brisbane-restaurant
Niche: restaurant
Route: website
Readiness: website_ready_to_build
Next action: Create or continue the website task thread and build on dev.

## Build Contract

- Template/framework: matthew6688/webjuice-restaurant (Astro + Cloudflare Pages + artifact-driven content/design JSON)
- Target repo: matthew6688/babylon-brisbane-restaurant
- Working branch: dev
- Build command: npm run build
- Deploy route: Cloudflare Pages dev preview first, live publish after explicit approval
- Agent handoff: Discord website-tasks thread backed by local Hermes website-agent; other tools may edit the repo if they preserve this packet.

## Required Read Order

1. clients/babylon-brisbane-restaurant/intake/website-survey.json
2. clients/babylon-brisbane-restaurant/evidence/evidence.json
3. clients/babylon-brisbane-restaurant/content.restaurant.json
4. clients/babylon-brisbane-restaurant/design.restaurant.json
5. clients/babylon-brisbane-restaurant/brand-spec.md
6. data/cases/babylon-brisbane-restaurant/dryrun_auto_upgrade_001/case.json

## Business Facts

- Name: Babylon Brisbane
- Address/service area: 145 Eagle St, Brisbane City QLD 4000, Australia
- Phone: +61 7 3186 6655
- Email: info@babylonbrisbane.com.au
- Website: https://babylonbrisbane.com.au/
- Reservation/contact link: https://www.sevenrooms.com/explore/babylonbrisbane/reservations/create/search?tracking=babylon-brisbane-widget&venues=babylonbrisbane%2Cfridaysbrisbane%2Cregattahotel%2Ctheboatshed%2Cdeathandcobris%2Ctheboundaryhotelaus%2Cportoffice%2Cjimmysonthemall%2Cpignwhistleriverside%2Criverlandbrisbane

## Offer / Content

- Primary: Restaurant in Brisbane
- Menu/source: https://babylonbrisbane.com.au/wp-content/uploads/2026/01/BABB_0625_Restaurant-Menu-1.pdf
- Sections/services: 3

## Design Direction

- Required skill: huashu-design / open-design design protocol
- Direction: Editorial Menu System
- Palette: #1a1710, #f1e4cf, #21190f, #9d7044, #d6a85f, #806f55
- Logo: /images/logo.png
- Primary photo: /images/official-1.jpg

## Guardrails

- Website and menu are different products. Build a formal website only when route=website.
- Use real evidence for address, phone, hours, menu, reservation links, logo, and photos.
- Do not invent menu prices or business facts. Generated images are visual assets, not evidence.
- Keep customer/order/payment/internal notes out of the public website repo.
- Push implementation changes to dev first; publish live only after approval.
- If work happens in Open Design, Codex, Claude Code, OpenCode, or another IDE, sync the final repo changes back before Discord/Hermes continues.

## Missing / Decisions

- Missing: none

