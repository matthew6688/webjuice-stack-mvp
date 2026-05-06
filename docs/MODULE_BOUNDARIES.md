# ProfitsLocal Module Boundaries

Updated: 2026-05-06

## Purpose

This document separates the parts of the system that were easy to blur together:

- the customer's actual website;
- ProfitsLocal's internal sales and fulfillment workflow;
- the portable project memory used by agents;
- niche-specific adapters such as restaurant and roofing.

The boundary matters because most customer sites are simple lead-generation websites. They should not inherit restaurant-only menu behavior or ProfitsLocal-only checkout/revision/approval pages unless the preview/sales workflow needs those pages.

## Correct Top-Level Model

```text
ProfitsLocal Platform
  ├── Client Website Core
  ├── Agent Handoff / Project Capsule
  ├── Internal Sales + Fulfillment Ops
  └── Niche Adapters
      ├── Restaurant
      └── Roofing
```

## 1. Client Website Core

This is the reusable customer website layer.

It is responsible for building a real local business website:

- one-page website by default, with multi-page support when the project explicitly needs it;
- contact form lead generation as the default conversion goal;
- clickable phone, email, address, maps, social, and CTA links;
- real business facts, services, products, photos, brand assets, and source-backed copy;
- responsive design;
- basic SEO metadata and share metadata;
- contact form routing and internal lead notification;
- deployment and domain attachment.

It should not assume:

- checkout;
- paid revision pages;
- approval pages;
- fixed sales footers;
- restaurant menu routes;
- ecommerce behavior;
- complex dashboards, portals, booking systems, or custom apps.

Those belong to other layers unless explicitly requested as a custom project.

## 2. Internal Sales + Fulfillment Ops

This layer is ProfitsLocal's own business workflow. It can appear on preview sites, but it is not part of the customer's final website content.

Current examples:

- fixed preview footer;
- Stripe checkout;
- thank-you page;
- revision form;
- approval page;
- domain setup helper;
- order status lookup;
- entitlement and revision quota;
- customer emails;
- Discord website task threads;
- finance/ROI ledger;
- sales outreach screenshots and demo videos.

Rules:

- Preview sales controls must stay visually outside the customer's website content.
- Final live customer sites can keep utility pages if useful, but they should not change the feel of the customer's public homepage.
- The internal flow should be removable or hidden without breaking the website core.

## 3. Agent Handoff / Project Capsule

This is one of the most important long-term modules.

The goal is that any capable agent can continue the same project without relying on chat memory. The operator may use:

- Discord/Hermes website-agent;
- Codex;
- Claude Code;
- OpenCode;
- Open Design desktop app;
- another IDE or automation runner.

They should all read the same project capsule.

Recommended capsule shape:

```text
data/cases/<client>/<order>/
├── case.json
├── context-packet.json
├── context.md
├── timeline.jsonl
├── decisions.md
├── customer-messages.jsonl
├── agent-runs.jsonl
└── approvals.jsonl

clients/<client>/
├── intake/website-survey.json
├── evidence/evidence.json
├── content.<niche>.json
├── design.<niche>.json
├── brand-spec.md
└── outreach/
```

The capsule should preserve:

- survey and brief;
- evidence and provenance;
- content artifact;
- design brief and brand spec;
- repo and deploy information;
- customer emails and important replies;
- revision history and quota state;
- Discord thread IDs;
- agent run logs;
- decisions, approvals, and launch status.

Agent handoff rule:

```text
Read capsule first, then edit.
```

The task packet should say where the source-of-truth files are and what branch to modify. For customer-facing changes, agents should push to `dev` until approval.

## 4. Niche Adapters

Niche adapters define what information is required, how content is structured, and how quality is checked for a specific industry.

They should plug into the client website core and project capsule. They should not redefine the whole sales workflow.

### Restaurant Adapter

Restaurant is the first niche and has special behavior.

Required/important fields:

- menu evidence;
- official menu page/PDF/image/OCR source;
- opening hours;
- cuisine;
- phone, address, map link;
- reservation/order/delivery links when available;
- real restaurant, dish, or venue photos;
- logo and brand colors when available.

Special routes:

- `website`: official, brand-led, formal, conversion-oriented;
- `menu`: mobile-first, minimal, factual, fast to scan.

Restaurant-specific rules:

- Menu items must come from evidence.
- Menu-only pages should avoid unnecessary marketing content.
- The menu route is special to restaurants and should not become a generic platform assumption.

### Roofing Adapter

Roofing should be the second niche and should be closer to a standard lead-generation website.

Required/important fields:

- services;
- service area;
- license, insurance, warranty, or trust credentials when available;
- inspection/estimate CTA;
- phone and contact form;
- project photos or before/after photos when available;
- Google reviews and rating;
- emergency service availability if offered.

Likely structure:

- hero with service area and estimate CTA;
- service grid;
- trust/proof section;
- process or warranty section;
- reviews;
- contact/estimate form;
- footer with service area and contact links.

Roofing-specific rules:

- Do not invent license numbers, warranty claims, project counts, or emergency availability.
- Before/after and project photos must be real or clearly marked generated placeholders.
- Contact form lead routing is the default conversion goal.

## Design Skill Layer

There should eventually be one high-level ProfitsLocal design skill exposed to agents:

```text
profitslocal-local-business-design
  = Open Design discovery and design-brief flow
  + Huashu Design taste/review protocol
  + ProfitsLocal evidence and lead-generation rules
  + niche adapter requirements
```

Agents should not need to remember five separate design instructions. The high-level skill should tell them when to use Open Design conventions, when to use Huashu review, and which niche adapter applies.

## Next Architecture Work

1. Implement `core/intake/website-survey.js` as the normalized survey/capsule entrypoint.
2. Add `clients/<client>/intake/website-survey.json` to the restaurant pipeline.
3. Add `websiteSurveyPath` to agent task packets and Discord handoff messages.
4. Create a local `profitslocal-local-business-design` skill document.
5. Keep restaurant as the reference adapter.
6. Add roofing as the second adapter only after the restaurant core remains stable.
