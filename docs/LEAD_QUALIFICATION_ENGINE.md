# Lead Qualification Engine

Updated: 2026-05-06

## Purpose

The Lead Qualification Engine decides whether a local business is worth moving into deeper collection and preview-build work.

This is the money filter before the Collect Skill:

```text
Google Places / manual lead
-> Lead Qualification
-> Collect Skill
-> Ready-to-Build Gate
-> Build Handoff
-> Delivery QA
-> Customer review / launch
```

The goal is not to build a website for every lead. The goal is to find businesses where a truthful preview has a real chance to turn into revenue.

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
