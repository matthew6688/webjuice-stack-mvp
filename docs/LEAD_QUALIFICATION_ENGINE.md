# Lead Qualification Engine

Updated: 2026-05-06

## Purpose

The Lead Qualification Engine decides whether a local business is worth moving into deeper collection and preview-build work.

This is the money filter before the Collect Skill:

```text
Maps scraper / Google Places / manual lead
-> Lead Qualification
-> Collect Skill
-> Ready-to-Build Gate
-> Build Handoff
-> Delivery QA
-> Customer review / launch
```

The goal is not to build a website for every lead. The goal is to find businesses where a truthful preview has a real chance to turn into revenue.

## Cost-Aware Discovery Funnel

At scale, do not start with Google Places API for every possible local business.

Default funnel:

```text
Maps scraper discovery
-> cheap field-only scoring
-> discovery store dedupe/status/events
-> selected candidates only
-> cheap site-audit when website quality matters
-> Tinyfish / enrichment only after cheap audit still says there is an opportunity
-> Google Places API verification only before official evidence/build/outreach
```

Rules:

- `npm run leads:maps-scrape` is the broad discovery tool.
- It should run without Google Places API, without email extraction, and without `-extra-reviews`.
- The workflow strips review/email payloads before analysis storage. Use `rating` and `review_count`, not review body text, for first-pass scoring.
- Every run updates `data/leads/discovery-index.json`, `data/leads/entities/<entity-key>.json`, `data/leads/queues/queues.json`, and `data/leads/reports/discovery-report.json`.
- Google Places API is for official verification and evidence, not broad scraping.
- Cheap site audit runs with `npm run leads:audit-discovery-sites -- --limit 3` and saves screenshots, HTML/text, and JSON/Markdown reports under `data/leads/audits/<entity-key>/`.
- Tinyfish/site-audit enrichment is for candidates that pass cheap audit, not every listing.
- `npm run leads:plan-discovery-enrichment -- --limit 3` creates dry-run Tinyfish and Google Places commands for selected candidates.
- `npm run leads:build-discovery-outreach-briefs -- --limit 2` creates local offer-angle drafts before contact extraction.
- Raw discovery leads appear in `/admin/leads`; `npm run leads:maps-promote` or `npm run leads:promote-discovery-store` is still required to create a full `clients/<client>/lead/*` workflow.

## Two Main Lead Types

### 1. No Website

The business has no official website listed on Google Places.

Good signs:

- phone number exists;
- Google Maps URL exists;
- strong rating and review count;
- enough photos or public evidence to build a truthful starter site;
- the business category is suitable for a simple lead-generation website.

Default winning action: `build_starter_preview`.

### 2. Bad Existing Website

The business has a website, but it looks like an obvious redesign opportunity.

Good signs:

- phone/email/contact path exists;
- current website is thin, stale, broken, template-heavy, slow, or missing conversion paths;
- business value is high enough to justify a custom preview;
- public evidence can support a better first version.

Default winning action: `build_redesign_preview`.

### Not A Build Target

If the existing website is already good, the engine should not automatically spend build time. It can be kept for manual review or skipped.

## Scores

The engine outputs five scores from 0 to 100:

| Score | What It Measures |
|---|---|
| `contactability` | Can we contact the business by phone, website, email, Maps, or social? |
| `businessValue` | Does public demand look worthwhile from rating, reviews, hours, and niche? |
| `websiteOpportunity` | Is there a meaningful website gap or redesign opportunity? |
| `assetAvailability` | Are there enough photos, content, menu/service details, or brand clues? |
| `buildFeasibility` | Can we build a truthful first preview without inventing core facts? |

Weighted score:

```text
contactability      25%
businessValue       20%
websiteOpportunity  25%
assetAvailability   15%
buildFeasibility    15%
```

## Grades

| Grade | Meaning |
|---|---|
| `A` | Build candidate. Move into Collect and first preview work. |
| `B` | Promising, but collect more information first. |
| `C` | Outreach/manual contact only; do not build yet. |
| `D` | Skip for now. |

## Recommended Actions

| Action | Meaning |
|---|---|
| `build_starter_preview` | No-website lead is strong enough to build a starter preview. |
| `build_redesign_preview` | Weak-website lead is strong enough to build a redesign preview. |
| `collect_more_info` | More evidence is needed before a build decision. |
| `outreach_only` | Contact first; do not build yet. |
| `manual_review` | Human review before deciding. |
| `skip` | Do not continue now. |

## CLI

Run synthetic tests:

```bash
npm run leads:test-qualification
```

Qualify a real Google Places result:

```bash
npm run leads:qualify -- \
  --lead data/collect-smoke/google-places-west-end.json \
  --index 0 \
  --website-scan data/collect-smoke/rich-and-rare/firecrawl-home.json \
  --client rich-and-rare-restaurant \
  --niche restaurant \
  --output data/collect-smoke/rich-and-rare/lead-qualification.json
```

## Output Contract

The qualification output includes:

- `leadType`
- `qualification`
- `recommendedAction`
- weighted score and five component scores
- contact fields
- Google Places signals
- website assessment
- reasons
- blockers
- next steps

The next module should read `recommendedAction`, not guess from raw scores.

## Real Smoke Result

Real Brisbane restaurant smoke used `Rich & Rare Restaurant`.

Result:

```text
leadType: good_website
qualification: D
recommendedAction: skip
weightedScore: 74
```

Interpretation:

Rich & Rare has strong public business signals and enough data to build, but the official website appears solid enough that it is not an automatic redesign target. That is the expected behavior: the engine protects build time.
