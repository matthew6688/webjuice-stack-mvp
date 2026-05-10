# Website Build Packet: Dark Shepherd

Generated: 2026-05-07T11:48:52.470Z
Client: dark-shepherd-restaurant
Niche: restaurant
Route: website
Readiness: website_ready_to_build
Next action: Create or continue the website task thread and build on dev.

## Build Contract

- Template/framework: matthew6688/webjuice-restaurant (Astro + Cloudflare Pages + artifact-driven content/design JSON)
- Target repo: matthew6688/dark-shepherd-restaurant
- Working branch: dev
- Build command: npm run build
- Deploy route: Cloudflare Pages dev preview first, live publish after explicit approval
- Agent handoff: Discord website-tasks thread backed by local Hermes website-agent; other tools may edit the repo if they preserve this packet.

## Required Read Order

1. clients/dark-shepherd-restaurant/intake/website-survey.json
2. clients/dark-shepherd-restaurant/evidence/evidence.json
3. clients/dark-shepherd-restaurant/content.restaurant.json
4. clients/dark-shepherd-restaurant/design.restaurant.json
5. clients/dark-shepherd-restaurant/brand-spec.md
6. case file when present

## Business Facts

- Name: Dark Shepherd
- Address/service area: The Star Brisbane, The Terrace, Level 4/33 William St, Brisbane City QLD 4000, Australia
- Phone: (07) 2111 6869
- Email: missing
- Website: https://www.darkshepherd.com.au/
- Reservation/contact link: tel:0721116869

## Offer / Content

- Primary: Restaurant
- Menu/source: https://www.darkshepherd.com.au/menu
- Sections/services: 6

## Design Direction

- Required skill: huashu-design / open-design design protocol
- Direction: Editorial Menu System
- Palette: #112233, #112255, #151515, #f8f3ea, #fffdf8
- Logo: https://images.squarespace-cdn.com/content/v1/659f48a97a40b977345eec2d/62184b06-bbd3-40f0-b5de-84ba52b4d7b7/DSH1_DS_Logo_Primary_White.png?format=1500w
- Primary photo: http://static1.squarespace.com/static/659f48a97a40b977345eec2d/t/6750feef78771d72dcf68f37/1733188125035/Dark+Shepard+-+Markus+Ravik+-+071.jpg?format=1500w

## Guardrails

- Website and menu are different products. Build a formal website only when route=website.
- Use real evidence for address, phone, hours, menu, reservation links, logo, and photos.
- Do not invent menu prices or business facts. Generated images are visual assets, not evidence.
- Keep customer/order/payment/internal notes out of the public website repo.
- Push implementation changes to dev first; publish live only after approval.
- If work happens in Open Design, Codex, Claude Code, OpenCode, or another IDE, sync the final repo changes back before Discord/Hermes continues.

## Missing / Decisions

- Missing: none

