# Website Ready Engine

Updated: 2026-05-06

## Purpose

The website-ready layer turns messy project inputs into one normalized build state before an agent starts website work.

Inputs can come from:

- outbound Google Places / Google Maps research;
- official website scraping;
- PDFs, menu documents, images, and OCR;
- manual notes;
- paid intake submissions;
- customer contact form uploads.

The goal is not to build the website directly. The goal is to answer:

```text
Do we have enough verified source-of-truth information to start the first website version?
```

## Outputs

The engine writes two files:

```text
clients/<client>/intake/website-survey.json
data/cases/<client>/<order>/build-packet.md
```

If no case path is supplied, the build packet is written to:

```text
clients/<client>/intake/build-packet.md
```

## Commands

Build a real client packet:

```bash
npm run intake:build-website-ready -- --client opa-bar-mezze-restaurant --case data/cases/opa-bar-mezze-restaurant/<order>/case.json --source outbound
```

Run the test suite:

```bash
npm run intake:test-website-ready
```

Confirm a paid intake from the admin workflow:

```bash
npm run funnel:record-paid-intake-action -- --input /tmp/paid-intake-action.json
```

with payload:

```json
{
  "client_slug": "opa-bar-mezze-restaurant",
  "order_id": "cs_test_...",
  "action": "confirm_website_ready",
  "actor": "profitslocal-admin"
}
```

That action writes the survey/build packet and stores the readiness result back on the paid-intake record before V1 can be started.

## Readiness States

| State | Meaning |
|---|---|
| `website_ready_to_build` | Evidence is sufficient and the project can enter the build queue. |
| `needs_customer_confirmation` | Paid/inbound project has enough data, but customer/operator confirmation is required before first build. |
| `needs_more_info` | Core fields are missing or evidence validation fails. |
| `blocked_conflicting_evidence` | High-confidence facts conflict and need a human decision. |

## Required Core Fields

The generic website gate checks:

- business name;
- address or service area;
- at least one business contact method;
- primary offer/content;
- design direction or brand context.

Restaurant currently also depends on restaurant evidence validation:

- address;
- phone;
- at least one CTA;
- menu source or menu sections before menu rendering.

## Framework Contract

The build packet explicitly tells every builder to use the existing ProfitsLocal route:

- `webjuice-restaurant` for restaurant;
- Astro + Cloudflare Pages;
- content/design artifacts as source of truth;
- `dev` branch for customer review;
- live publish only after approval;
- Discord `#website-tasks` as the internal project thread;
- Huashu/open-design protocol for visual decisions.

This is what lets Codex, Hermes, Open Design, Claude Code, OpenCode, or another tool work on the same project without drifting away from our framework.

## Important Boundary

Customer/order emails are not business contact facts.

The survey keeps restaurant/business facts under `contact`. Customer payment or intake identity stays in the case file and should not be rendered as the restaurant's public email or phone.
