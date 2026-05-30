---
name: website-copy-audit
description: Use when auditing or improving local-business website copy before Open Design handoff, template approval, outreach preview, or production launch. Scores conversion clarity, local SEO copy, trust, factual safety, readability, and produces AI-safe rewrite briefs.
---

# Website Copy Audit

Audit and improve local-business website copy before it reaches a demo, outreach email, Open Design, or production site. The goal is not prettier writing. The goal is copy that helps a real visitor understand the business, trust the offer, and contact the business without leaking fake claims or internal workflow language.

R105 demo-honesty policy: these sites are demos shown to prospects. The customer edits placeholder proof before go-live. The only honesty hard fail is fabricated or wrong licence/identity information: licence authority/number/status, business name, ABN, phone, or address.

## Use When

- Reviewing an Open Design output for weak or generic copy.
- Preparing a one-page or small multi-page local-business site brief.
- Optimizing a template family before approval.
- Turning sparse lead evidence into safe placeholder copy.
- Running autoresearch-style copy experiments.
- Checking whether customer-facing copy is accurate enough to send.

## Inputs

Use as many as available:

- lead profile: business name, category, city, service area, email, phone, address, website, social accounts;
- evidence: official website text, Google Business/Profile data, reviews, screenshots, OCR, PDF, prior audit;
- target page type: teaser preview, one-page site, simple multi-page site, redesign;
- template family and design direction;
- current HTML/DOM text, headings, CTA labels, footer/contact content;
- SEO audit and UI audit results when available;
- Open Design run metadata and output files.

## Source Order

1. Verified business facts and contact details.
2. Preserved website/profile evidence.
3. Lead/operator notes.
4. Niche best practices and common-sense filler.
5. Local LLM or external LLM suggestions.

LLM output is a critic and draft generator, not the source of truth. Never let an LLM override verified contact details, service area, business name, or evidence.

## Rubric

Read `references/copy-audit-rubric.json` for the scoring contract. Default total is 100.

Primary dimensions:

- Conversion clarity.
- Specificity and customer problem.
- Trust and proof honesty.
- Service coverage and offer structure.
- Local SEO copy.
- Tone and readability.
- Differentiation and outreach angle.
- Factual safety.

## Hard Fail Rules

Return `hard_fail` only if this is true:

- Fabricated or wrong legal/identity information: licence authority/number/status, business name, ABN, phone, or address.

Other issues can still require revision, but are not honesty hard fails:

- No contact path or CTA.
- Visitor cannot identify the business category within 5 seconds.
- Internal workflow language appears in customer-facing copy: audit, artifact, Open Design, prompt, generated, placeholder, readiness, lead ops.
- Copy conflicts with preserved evidence outside the Tier A identity fields.
- Page is mostly generic filler and could fit any industry.
- Unsupported guarantees or commitment-style promises, such as guaranteed response times, when source supports only a target.

Project/job counts, review counts, years-in-business estimates, AI-generated testimonials, and other soft marketing stats are allowed as demo placeholders. Flag them as `demo_placeholder` at low severity when useful, and require provenance/customer replacement before production. A marked placeholder can still be approved. If a placeholder is dressed as verified proof ("we have completed 500 roofs", "verified 120 reviews") revise the framing or provenance, but do not hard-fail unless it fabricates licence/identity.

AI-generated review, testimonial, FAQ, process, or proof copy is allowed as demo/reference content when clearly tracked in metadata or notes. Before production launch, replace it with real Google/customer proof or remove the claim.

## Decision

Use this decision ladder:

- `approve`: no hard fail, score >= 85, no high severity findings.
- `revise_copy`: score 70-84, or high findings are specific and fixable.
- `revise_evidence`: missing facts block responsible copy, but the opportunity may be real.
- `rerun_design_with_copy_brief`: UI depends on copy structure and current page layout cannot absorb the needed rewrite.
- `human_review`: facts conflict, claims are risky, or LLM judges disagree.
- `hard_fail`: any hard fail rule is triggered.

## Required Output

Produce machine-readable JSON and a short human summary.

```json
{
  "schemaVersion": 1,
  "auditType": "website-copy-audit",
  "score": 0,
  "decision": "approve | revise_copy | revise_evidence | rerun_design_with_copy_brief | human_review | hard_fail",
  "confidence": "high | medium | low",
  "hardFailReasons": [],
  "dimensions": {
    "conversion": { "score": 0, "max": 20, "findings": [] },
    "specificity": { "score": 0, "max": 15, "findings": [] },
    "trustProof": { "score": 0, "max": 15, "findings": [] },
    "serviceOffer": { "score": 0, "max": 15, "findings": [] },
    "localSeo": { "score": 0, "max": 10, "findings": [] },
    "toneReadability": { "score": 0, "max": 10, "findings": [] },
    "differentiation": { "score": 0, "max": 10, "findings": [] },
    "factualSafety": { "score": 0, "max": 5, "findings": [] }
  },
  "topFixes": [],
  "factLock": {
    "mustKeep": [],
    "mustNotClaim": [],
    "placeholderAllowed": []
  },
  "rewriteBrief": "",
  "openDesignCopyBrief": "",
  "evidence": []
}
```

Each finding must include:

```json
{
  "severity": "critical | high | medium | low",
  "category": "conversion | specificity | trust | service | seo | tone | factual_safety",
  "message": "specific problem",
  "evidence": "selector, text quote, source path, or screenshot region",
  "suggestedFix": "specific copy or brief-level fix"
}
```

## Autoresearch Copy Loop

For experiments, do not ask one model for a final answer and trust it. Run a small loop:

1. Extract current copy from HTML and structured lead facts.
2. Run deterministic checks: contact facts, CTA existence, headings, internal terms, forbidden claims.
3. Ask a local LLM to score and propose a rewrite brief using `references/local-llm-copy-optimizer-prompt.md`.
4. Generate 2-4 variants:
   - `direct-response-local`: plain, conversion-focused, phone/quote first.
   - `seo-service-area`: service list and city/service-area coverage stronger.
   - `trust-proof-careful`: proof/process focused without fake claims.
   - `premium-template`: more editorial language for high-end visual templates.
5. Score each variant with the rubric and deterministic checks.
6. Use a second judge only for high-stakes or close calls.
7. Pick the best variant or send the strongest `openDesignCopyBrief` back to Open Design.
8. Save prompts, model, score JSON, selected variant, and rejected reasons.

## Local LLM Rules

Preferred local model for JSON audit: `gemma3:27b`. Use `deepseek-r1:14b` as a second opinion when needed. Avoid models that hide useful output inside reasoning unless the parser handles it.

Local LLM must:

- return JSON only;
- list uncertain claims separately;
- preserve verified facts exactly;
- mark placeholder/demo content as placeholder;
- avoid polished but empty corporate language.

## Open Design Handoff

Open Design should receive:

- protected facts;
- approved hero angle;
- section-by-section copy intent;
- CTA text and contact path;
- service list and service-area wording;
- placeholder policy;
- forbidden internal terms and unsupported claims.

Do not over-constrain microcopy when the design direction needs room to breathe. Constrain facts, intent, conversion path, and claim safety; let Open Design shape final line breaks and layout copy.
