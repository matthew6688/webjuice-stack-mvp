# Website Build Packet: Rich & Rare Restaurant

Generated: 2026-05-06T06:39:16.259Z
Client: rich-and-rare-collect-smoke
Niche: restaurant
Route: website
Readiness: website_ready_to_build
Next action: Create or continue the website task thread and build on dev.

## Build Contract

- Template/framework: matthew6688/webjuice-restaurant (Astro + Cloudflare Pages + artifact-driven content/design JSON)
- Target repo: matthew6688/rich-and-rare-collect-smoke
- Working branch: dev
- Build command: npm run build
- Deploy route: Cloudflare Pages dev preview first, live publish after explicit approval
- Agent handoff: Discord website-tasks thread backed by local Hermes website-agent; other tools may edit the repo if they preserve this packet.

## Required Read Order

1. data/collect-smoke/rich-and-rare/client/intake/website-survey.json
2. data/collect-smoke/rich-and-rare/evidence.json
3. data/collect-smoke/rich-and-rare/client/content.restaurant.json
4. data/collect-smoke/rich-and-rare/client/design.restaurant.json
5. data/collect-smoke/rich-and-rare/client/brand-spec.md
6. case file when present

## Business Facts

- Name: Rich & Rare Restaurant
- Address/service area: 97 Boundary St, West End QLD 4101, Australia
- Phone: (07) 3638 8888
- Email: missing
- Website: https://www.richandrare.com.au/
- Reservation/contact link: https://www.sevenrooms.com/explore/richandrarerestaurant/reservations/create/search?date=2026-05-10&venues=richandrarerestaurant%2Cpompetteau%2Cdarkshepherd%2Cyamasgreekdrink%2Cstilts%2Cfatcowrestaurant%2Clongwangchopstickhouse%2Copabarmezze%2Cmassimorestaurantandbar%2Cfoshbarrestaurant

## Offer / Content

- Primary: Restaurant in Brisbane
- Menu/source: https://www.richandrare.com.au/menus
- Sections/services: 3

## Design Direction

- Required skill: huashu-design / open-design design protocol
- Direction: Editorial Menu System
- Palette: #112233, #112255, #151515, #f8f3ea, #fffdf8
- Logo: https://images.squarespace-cdn.com/content/v1/645aeb6e5e03ca278fcc244b/cc41bc60-4e56-4535-97b8-ba1ee763d87a/Rich+and+Rare_Type+Logo_CMYK_White.png?format=1500w
- Primary photo: http://static1.squarespace.com/static/645aeb6e5e03ca278fcc244b/t/6678c0d2407be66f5c957acc/1719189714919/Rich+%26+Rare+-+Markus+Ravik+106.jpg?format=1500w

## Guardrails

- Website and menu are different products. Build a formal website only when route=website.
- Use real evidence for address, phone, hours, menu, reservation links, logo, and photos.
- Do not invent menu prices or business facts. Generated images are visual assets, not evidence.
- Keep customer/order/payment/internal notes out of the public website repo.
- Push implementation changes to dev first; publish live only after approval.
- If work happens in Open Design, Codex, Claude Code, OpenCode, or another IDE, sync the final repo changes back before Discord/Hermes continues.

## Missing / Decisions

- Missing: none

