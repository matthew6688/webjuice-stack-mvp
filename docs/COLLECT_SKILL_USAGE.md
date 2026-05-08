# Collect Skill Usage

Updated: 2026-05-06

## What This Skill Does

`profitslocal-collect` turns messy local-business information into a standard project package.

It runs after lead qualification. Qualification decides whether the lead is worth deeper collection or a preview build.

```text
Lead Qualification
-> Collect Skill
-> Ready-to-Build Gate
-> Build Handoff
-> Delivery QA Gate
-> Customer Communication
-> Publish / Revision
```

Do not use the Collect Skill on every Google Maps result. First classify the lead:

| Lead type | Meaning | Default action |
|---|---|---|
| `no_website` | Google Places has no official website. | Build a starter preview only when contactable and enough public evidence exists. |
| `bad_website` | Existing site is weak, stale, thin, broken, or low-conversion. | Build a redesign preview when contactable and business value is high. |
| `good_website` | Existing site is already solid. | Skip or keep for manual review; do not spend build time automatically. |

Qualification command:

```bash
npm run leads:qualify -- --lead data/collect-smoke/google-places-west-end.json --index 0 --website-scan data/collect-smoke/rich-and-rare/firecrawl-home.json --client rich-and-rare-restaurant --niche restaurant --output data/collect-smoke/rich-and-rare/lead-qualification.json
```

The Collect Skill starts only when `recommendedAction` is one of:

```text
build_starter_preview
build_redesign_preview
collect_more_info
```

## Who Uses It

Humans use it by providing as much raw material as possible.

Agents use it by extracting, verifying, and normalizing that material.

## Human Input Checklist

Provide any available items:

- business name
- Google Maps link or place name
- official website
- current bad website
- menu/product/service PDF
- photos/logo/screenshots
- phone/email/address/service area
- booking/reservation/contact links
- notes from customer conversation
- preferred domain
- examples of design style the customer likes

It is okay if the input is messy. The skill decides what is useful.

## Agent Responsibilities

The agent must:

- extract source-backed facts;
- ask for missing business-critical facts when needed;
- scrape/search/OCR when humans cannot provide more;
- mark conflicts instead of guessing;
- separate customer/order data from public business facts;
- keep restaurant menu logic inside the restaurant niche;
- produce a QA contract before build starts.

## Recommended Collection Ladder

1. Google Places: identity, address, phone, map URL, rating, hours, photo references.
2. Official site scrape: reservation links, menu candidates, brand copy, page structure.
3. Brand assets: logo, colors, fonts, official images.
4. Menu/PDF/image OCR: only when restaurant menu is needed and not available as text.
5. Human/customer confirmation: for remaining business-critical gaps.

Google Places alone is normally not enough for restaurant build readiness because it does not provide logo/design language/menu sections.

## Expected Outputs

```text
clients/<client>/evidence/evidence.json
clients/<client>/intake/website-survey.json
clients/<client>/content.<niche>.json
clients/<client>/design.<niche>.json
clients/<client>/brand-spec.md
data/cases/<client>/<order>/build-packet.md
```

## Example Prompt For Discord / Codex

```text
Use the profitslocal-collect skill.

Client: Opa Bar & Mezze
Niche: restaurant
Target product: website
Source type: outbound

Inputs:
- Google Maps: <url or place name>
- Official site: https://www.opabar.com.au/
- Menu page: https://www.opabar.com.au/menu
- Notes: create a formal official website. Menu route is optional; do not turn the whole website into a menu page.

Output:
- update evidence/content/design/brand files
- write clients/opa-bar-mezze-restaurant/intake/website-survey.json
- write data/cases/<client>/<order>/build-packet.md if case exists
- tell me the Ready-to-Build status and blockers
```

## Ready-to-Build Status

Use these exact statuses:

| Status | Meaning |
|---|---|
| `ready_to_build` | Enough verified/customer-confirmed information exists to start first version. |
| `needs_customer_confirmation` | Enough information exists, but customer-originated data needs confirmation. |
| `needs_more_info` | Missing business-critical information. |
| `blocked_conflicting_evidence` | High-confidence facts conflict. |

## Relationship To QA

Collect creates the `qaContract`.

Delivery QA later checks the finished dev preview against that contract.

```text
Collect: What must be true?
QA: Did the delivered website satisfy it?
```
