---
name: website-ui-audit
description: Use when auditing an AI-generated or existing local-business website UI for Open Design/template approval, redesign QA, hero quality, visual hierarchy, industry fit, conversion clarity, mobile usability, and AI slop. Produces evidence-backed findings, JSON-ready scores, and revision instructions for Open Design.
---

# Website UI Audit

Audit local-business website UI before approval or outreach. The goal is not generic taste criticism; the goal is to decide whether the page can credibly sell a local business and whether Open Design should revise, rerun, or pass.

## Use When

- Reviewing an Open Design output.
- Scoring a template candidate.
- Checking whether a mockup is good enough for cold outreach.
- Comparing a generated page with reference screenshots or a template family.
- Deciding whether to send revision instructions back to Open Design.

## Inputs

Use as many as available:

- desktop and mobile screenshots;
- generated HTML/project files;
- lead profile or template manifest;
- `design-language.md`;
- reference screenshots or reference URLs;
- approved image family / asset list;
- Open Design run metadata: native finish, duration, question form rounds, output files;
- copy/SEO audit results when available.

## Source Order

1. Screenshots are the visual truth.
2. DOM/HTML explains what screenshots cannot show: links, headings, alt text, forms.
3. Template family/reference files define intended style.
4. Lead/profile facts define business correctness.
5. Local LLM or vision critique is a critic, not source of truth.

## Rubric

Read `references/ui-audit-rubric.json` for the scoring contract. Default total is 100.

Primary dimensions:

- Hero and first viewport.
- Industry fit and reference fidelity.
- Visual hierarchy and composition.
- Imagery and asset quality.
- Conversion affordance.
- Mobile/responsive quality.
- Technical UX hygiene.
- AI slop and professionalism.

## Hard Fail Rules

Return `hard_fail` if any of these are true:

- Hero is visually weak, text-heavy, or does not clearly show the business category.
- Page looks like a blog/article/wireframe when it should sell a local service.
- No clear CTA above the fold.
- Contact path is missing or broken.
- Internal terms leak into customer-facing UI: audit, prompt, Open Design, generated, placeholder, readiness, artifacts.
- Uses fake factual claims as real proof: reviews, awards, licenses, years, projects, guarantees.
- Major mobile layout break, overlapping text, unreadable content, or horizontal overflow.
- Generated page did not reach native clean finish but was treated as approved.
- Reference family was ignored in a way that changes the intended template direction.

## Decision

Use this decision ladder:

- `approve`: no hard fail, score >= 85, no high severity issues.
- `revise`: score 70-84, or high issues are specific and fixable within one Open Design continuation.
- `rerun`: hard fail caused by wrong design direction, broken hero, missing assets, or generic low-quality layout.
- `human_review`: confidence is low, evidence conflicts, or two revision rounds failed.

## Required Output

Produce machine-readable JSON and a short human summary.

```json
{
  "schemaVersion": 1,
  "auditType": "website-ui-audit",
  "score": 0,
  "decision": "approve | revise | rerun | human_review | hard_fail",
  "confidence": "high | medium | low",
  "hardFailReasons": [],
  "dimensions": {
    "hero": { "score": 0, "max": 25, "findings": [] },
    "industryFit": { "score": 0, "max": 15, "findings": [] },
    "visualHierarchy": { "score": 0, "max": 15, "findings": [] },
    "imagery": { "score": 0, "max": 15, "findings": [] },
    "conversion": { "score": 0, "max": 10, "findings": [] },
    "mobile": { "score": 0, "max": 10, "findings": [] },
    "technicalUx": { "score": 0, "max": 5, "findings": [] },
    "aiSlop": { "score": 0, "max": 5, "findings": [] }
  },
  "topFixes": [],
  "openDesignRevisionBrief": "",
  "evidence": []
}
```

Each finding must include:

```json
{
  "severity": "critical | high | medium | low",
  "category": "hero | hierarchy | spacing | color | imagery | mobile | conversion | accessibility | ai_slop | reference_fidelity",
  "message": "specific problem",
  "evidence": "screenshot region, selector, text, file, or measured behavior",
  "suggestedFix": "specific fix"
}
```

## Revision Brief Rules

When decision is `revise`, create direct Open Design instructions:

- say exactly what failed;
- list required changes;
- list protected facts that must not change;
- name approved images or image style;
- forbid internal/audit/placeholder text;
- keep it short enough for a continuation prompt.

When decision is `rerun`, explain why continuation is not enough.

## Local-Business Bias

Prefer useful, credible, conversion-focused websites over decorative novelty.

Good local business pages usually have:

- business category visible in 5 seconds;
- strong hero visual relevant to the niche;
- phone/quote/contact CTA near the top;
- service area and service list;
- trust proof or clearly marked demo proof;
- contact form or direct contact path;
- mobile readability;
- no fake exact claims.

## Notes

Third-party audit skills are references only. Do not install or trust unreviewed third-party skill code inside the production workflow. Fold useful principles into this repo-owned rubric and scripts.
