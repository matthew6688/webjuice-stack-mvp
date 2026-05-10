# Website Build Packet: Opa Bar & Mezze

Generated: 2026-05-07T06:46:23.401Z
Client: opa-bar-mezze-restaurant
Niche: restaurant
Route: website
Readiness: website_ready_to_build
Next action: Create or continue the website task thread and build on dev.

## Build Contract

- Template/framework: matthew6688/webjuice-restaurant (Astro + Cloudflare Pages + artifact-driven content/design JSON)
- Target repo: matthew6688/opa-bar-mezze-restaurant
- Working branch: dev
- Build command: npm run build
- Deploy route: Cloudflare Pages dev preview first, live publish after explicit approval
- Agent handoff: Discord website-tasks thread backed by local Hermes website-agent; other tools may edit the repo if they preserve this packet.

## Required Read Order

1. clients/opa-bar-mezze-restaurant/intake/website-survey.json
2. clients/opa-bar-mezze-restaurant/evidence/evidence.json
3. clients/opa-bar-mezze-restaurant/content.restaurant.json
4. clients/opa-bar-mezze-restaurant/design.restaurant.json
5. clients/opa-bar-mezze-restaurant/brand-spec.md
6. data/cases/opa-bar-mezze-restaurant/dryrun_1778136383212/case.json

## Business Facts

- Name: Opa Bar & Mezze
- Address/service area: 123 Eagle St, Brisbane City QLD 4000, Australia
- Phone: +61 7 2111 5155
- Email: missing
- Website: https://www.opabar.com.au/
- Reservation/contact link: https://www.sevenrooms.com/explore/opabarmezze/reservations/create/search?venues=opabarmezze,pompetteau,darkshepherd,yamasgreekdrink,stilts,richandrarerestaurant,fatcowrestaurant,longwangchopstickhouse,massimorestaurantandbar,foshbarrestaurant

## Offer / Content

- Primary: Restaurant in Brisbane
- Menu/source: https://www.opabar.com.au/menu
- Sections/services: 7

## Design Direction

- Required skill: huashu-design / open-design design protocol
- Direction: Editorial Menu System
- Palette: #063e52, #fbf6ef, #112832, #26b9c8, #f7a7b8, #5c737b
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

