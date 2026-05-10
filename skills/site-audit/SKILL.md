---
name: site-audit
description: Use when evaluating an existing business website before deciding whether a redesign mockup is worth building. Captures evidence, audits conversion/trust/SEO, and produces a business decision for cold outreach.
---

# Site Audit

Use this skill for existing-website leads. The goal is not to criticize a site for trivia; the goal is to decide whether we can show clear value with a redesign mockup and outreach angle.

## When to use

Use this when:

- a lead already has an official website
- the operator asks whether the site is worth redesigning
- the admin card needs proof before moving to `可做 Mockup`
- a cold outreach message needs a specific, evidence-backed observation

Do not use this as a generic SEO report only. SEO is one layer; the business decision is whether the lead has a real conversion, trust, proof, mobile, or local search opportunity.

## Workflow

1. Capture the current website, preferably the homepage first.
2. Preserve evidence:
   - desktop screenshot
   - mobile screenshot
   - HTML snapshot
   - text snapshot
   - audit JSON
   - audit Markdown
3. Audit three layers:
   - conversion: contact path, quote/booking path, service clarity, proof above the fold
   - trust: contact page, service area, social/proof channels, privacy/terms hygiene
   - SEO: title, meta description, H1, canonical, word count, internal links, image alt, JSON-LD, OG/Twitter preview
4. Decide:
   - `build_mockup`: score is below 60
   - `human_review`: score is 60 to 80
   - `skip_or_monitor`: score is above 80
5. Feed the admin pipeline and Open Design handoff. Do not auto-build from a weak audit.

## Command

```bash
npm run leads:audit-current-sites -- --client <slug>
```

## Outputs

```text
clients/<slug>/audit/current-site-desktop.png
clients/<slug>/audit/current-site-mobile.png
clients/<slug>/audit/current-site.html
clients/<slug>/audit/current-site-text.txt
clients/<slug>/audit/current-site-audit.json
clients/<slug>/audit/current-site-audit.md
public/admin-artifacts/<slug>/current-site-desktop.png
public/admin-artifacts/<slug>/current-site-mobile.png
public/admin-artifacts/<slug>/current-site-audit.md
```

## Audit JSON contract

The audit must include:

```json
{
  "schemaVersion": 2,
  "verdict": "clear_redesign_opportunity | moderate_redesign_opportunity | weak_redesign_opportunity",
  "score": 0,
  "salesDecision": "build_mockup | human_review | skip_or_monitor",
  "opportunityConfidence": "high | medium | low",
  "summary": "",
  "outreachHook": "",
  "openDesignDirection": "",
  "findings": [],
  "priorityActions": [],
  "nextStepInput": {}
}
```

## Quality rules

- Never use low-impact hygiene issues as the main outreach hook.
- If score is above 80, set `salesDecision` to `skip_or_monitor` and explain that no strong hook was found.
- If score is 60 to 80, set `salesDecision` to `human_review`; the operator decides whether the gap is worth a mockup.
- If score is below 60, set `salesDecision` to `build_mockup`; the site has enough clear problems to justify a mockup without extra debate.
- Keep evidence specific and observable. Do not invent screenshots, reviews, ratings, awards, licenses, years in business, or service areas.
- Placeholder copy can help a mockup feel complete after a human approves it, but placeholder evidence cannot justify the lead.
- Preserve the existing site’s strong parts. Redesign value means solving a clear business problem, not changing style for its own sake.
- The Open Design direction is internal handoff input, not customer-facing copy.

## Validation

Run:

```bash
npm run leads:test-site-audit
npm run funnel:test-lead-registry
npm run funnel:test-lead-outreach-index
```

For a live proof client:

```bash
npm run leads:audit-current-sites -- --client radiant-roof-repairs
```

Then confirm `/admin/leads/` shows the audit evidence, decision, screenshots, report, and text snapshot.
