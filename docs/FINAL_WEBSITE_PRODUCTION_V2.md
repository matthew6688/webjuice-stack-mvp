# Final Website Production V2

Updated: 2026-05-10

This document defines the next version of the ProfitsLocal final website production workflow. It focuses on one problem: generated websites must be strong enough for customer-facing mockups, not merely technically valid.

## Why V2 Exists

The previous workflow could generate pages that passed basic checks but still failed Matthew's customer-delivery bar:

- weak or text-heavy hero sections;
- images used as decoration instead of business proof;
- generic copy that sounds like internal notes;
- layouts that feel like design-system exercises rather than local-business sales pages;
- audit scores that check compliance but miss commercial quality.

V2 treats Open Design as the visual implementation engine, not the strategist, copywriter, researcher, fact source, image curator, and auditor all at once.

## Core Principle

Do not ask Open Design to invent the business, offer, copy, structure, evidence, and visuals from a loose prompt.

Instead:

```text
research the business
  -> write a discovery report
  -> score the gap / opportunity
  -> choose a niche/template direction
  -> create a block-level website production spec
  -> create or select approved assets
  -> hand a mature packet to Open Design
  -> audit the result
  -> revise or reject
```

## Required Lead Artifacts

Each serious lead should converge into one case folder with durable artifacts:

```text
clients/<slug>/
  master-business-record.json
  discovery-report.md
  gap-score.json
  website-production-spec.json
  copy-brief.md
  open-design-handoff.md
  open-design-run-log.jsonl
  final-site-audit.json
  final-site-audit.md
  internal-sales-brief.md
  customer-preview-brief.md
  activity-log.jsonl
```

The `master-business-record.json` is the canonical fact source. Other files may summarize or transform it, but they should not invent new verified facts.

## Model Capability Smoke Test

Smoke test date: 2026-05-10.

## Document Model Comparison Loop

Document generation is now treated as an experiment, not a vibe check.

Command:

```bash
npm run leads:compare-document-models -- --run-id <id> --providers deterministic,ollama:gemma3:27b,ollama:deepseek-r1:14b,codex,claude
```

Test:

```bash
npm run leads:test-document-model-comparison
```

Evidence folders:

```text
data/qa/document-model-comparison/<run-id>/
  input.json
  prompt.txt
  <provider>.raw.txt
  <provider>.result.json
  summary.json
```

Reusable SOP:

```text
docs/AUTORESEARCH_OPTIMIZATION_SOP.md
```

The comparison prompt asks each model to produce:

```text
discoveryReport
gapScore
websiteProductionSpec
copyBrief
riskNotes
```

The evaluator checks:

- parseable JSON;
- verified phone/contact preservation;
- no invented email, URL, or plausible street address;
- evidence and missing evidence are explicit;
- block plan contains the conversion-critical sections;
- asset plan exists;
- copy has a clear contact CTA;
- no customer-facing internal workflow words in the copy plan;
- no reasoning leakage;
- fact lock protects forbidden claims.

Initial smoke evidence:

| Run | Provider | Result | Notes |
|---|---:|---:|---|
| `smoke-cli` | Codex CLI | 100 / A | 44.8s, clean structured output after evaluator was tightened. |
| `smoke-cli` | Claude Code CLI | 95 / A | 35.6s, strong fact discipline; one schema issue where gap sub-scores exceeded expected dimension ranges. |
| `smoke-qwen-think-off` | `qwen3.6:27b` with `think:false` | 95 / A | 230.4s, clean JSON and fact-safe; same gap sub-score range issue. Good offline candidate, too slow for live Discord response. |
| `smoke-deepseek-strict-v2` | `deepseek-r1:14b` with strict prompt | 89 / B | 67.0s, improved from 49/F; still thin evidence/missing-evidence/asset planning. |
| `smoke-local` | `gemma3:27b` | 0 / F | 180s timeout, invalid/empty JSON for this strict document task. |
| `smoke-gemma-long` | `gemma3:27b` | 0 / F | 301.0s, fetch failed / empty output even with longer timeout. |
| `smoke-local` | `deepseek-r1:14b` baseline prompt | 49 / F | Completed in 105.4s but invented an email and produced weak handoff structure. |
| `smoke-local` | deterministic baseline | 100 / A | Guardrail reference output, not a creative model. |

Decision from this smoke:

- Codex is currently the strongest candidate for high-value discovery reports, production specs, and repo-aware document generation.
- Claude is a strong second-opinion reviewer / writer, but score schemas need explicit ranges.
- Qwen can become a local/offline document candidate when called through Ollama API with `think:false`, strict JSON format, and a validation gate. It is currently too slow for synchronous Discord automation.
- DeepSeek is useful after prompt hardening but should stay in critique/draft mode unless a second validation pass fixes thin evidence and asset planning.
- Gemma is not suitable for this strict document task in the current setup.
- Every model comparison run must save raw output, score, duration, provider, model, and findings.

Prompt lesson:

The same `deepseek-r1:14b` model moved from 49/F to 89/B after adding strict completion rules:

- no demo email/address/URL;
- no customer-facing placeholder/internal words;
- no review/testimonial block without real review evidence;
- required six block ids: hero, services, trust, process, faq, contact;
- phone CTA must preserve the verified phone;
- factLock must include exact forbidden-claim categories.

This confirms that document prompts should be optimized through an autoresearch-style loop, not hand-tuned once.

Autoresearch evidence:

```bash
npm run leads:autoresearch-document-models -- --run-id smoke-qwen-deepseek --providers ollama:deepseek-r1:14b,ollama:qwen3.6:27b --variants baseline,strict-v2 --think false --timeout 300000
```

Results:

| Variant | Provider | Score | Duration | Finding |
|---|---|---:|---:|---|
| baseline | `deepseek-r1:14b` | 49 / F | 67.0s | Invented email, weak block plan. |
| strict-v2 | `deepseek-r1:14b` | 89 / B | 57.1s | No invented contact, but thin evidence and asset plan. |
| baseline | `qwen3.6:27b` + `think:false` | 95 / A | 234.8s | Used customer-visible `placeholder` wording. |
| strict-v2 | `qwen3.6:27b` + `think:false` | 95 / A | 189.1s | Removed placeholder wording, but gapScore dimensions exceeded expected ranges. |

Current recommendation:

- Use `strict-v2` as the default document prompt contract.
- Use Codex or Claude for high-value final document generation.
- Use Qwen with `think:false` for offline local document generation or second-pass drafting when time is acceptable.
- Use DeepSeek for cheaper critique or fallback drafting, but require a cleanup/rewrite pass.
- Keep Gemma out of this specific document-generation loop unless the Ollama transport issue is fixed.

Known loop limitation:

- `run-document-autoresearch.js` currently runs variants sequentially. For local LLMs this can take 5-10 minutes. Next hardening step is early-stop, per-provider timeout reporting, and optional parallelism.

## Human-Readable Report Output

The document comparison loop now produces human-readable HTML, not just JSON.

Command:

```bash
npm run leads:build-document-comparison-report
```

Outputs:

```text
data/qa/document-model-comparison/document-model-comparison-report.html
public/admin-artifacts/document-model-comparison/document-model-comparison-report.html
data/qa/document-model-comparison/document-model-comparison-report.summary.json
clients/roofing-restoration-greg-sign/reports/discovery-report-cn.html
clients/roofing-restoration-greg-sign/reports/discovery-report-cn.md
clients/roofing-restoration-greg-sign/reports/discovery-report-cn.json
public/admin-artifacts/roofing-restoration-greg-sign/reports/discovery-report-cn.html
public/admin-artifacts/roofing-restoration-greg-sign/reports/discovery-report-cn.md
public/admin-artifacts/roofing-restoration-greg-sign/reports/discovery-report-cn.json
```

The comparison HTML must show:

- exact prompt;
- exact source payload;
- provider score, duration, and findings;
- raw model output for every compared provider.

The lead report HTML must be:

- Chinese-first;
- easy for an operator or salesperson to read;
- branded as ProfitsLocal internal work;
- explicit about verified facts, missing evidence, opportunity, recommended site direction, forbidden claims, and next steps.

Admin location:

```text
/admin/reports
```

The admin page has four operator tabs:

- Chinese reports;
- model comparison / selected provider;
- exact prompt and source payload;
- reusable autoresearch SOP.

Verification evidence:

```text
data/qa/document-model-comparison/document-model-comparison-report.png
data/qa/document-model-comparison/discovery-report-cn.png
data/qa/document-model-comparison/discovery-report-cn-mobile.png
```

Playwright validation checked:

- HTML title and H1 render;
- report sections exist;
- desktop screenshot renders;
- 390px mobile screenshot renders;
- no horizontal overflow on desktop or mobile.

Billing note:

- Codex CLI usage depends on its authentication mode. ChatGPT sign-in can use plan-based Codex access, while direct API calls use API billing.
- Claude Code CLI usage depends on its authentication mode. In this workspace no `ANTHROPIC_API_KEY` was present in the shell during the smoke check.
- OpenAI Image API calls from scripts use API billing, not ChatGPT subscription image limits.

### Codex CLI

Result: available.

Evidence:

```text
codex-cli 0.128.0
```

Non-interactive smoke output:

```json
{"tool":"codex","usable_for":"strategy_and_spec","ok":true}
```

Saved evidence:

```text
data/qa/model-capability-smoke/codex-smoke.txt
```

Notes:

- Good fit for high-value strategy, structured specs, code changes, and repo-aware audits.
- Startup loads many skills/MCPs and produced noisy warnings. Use it for important work, not cheap batch scoring.
- Token cost can be high; log model, duration, and purpose for every real run.

### Claude Code CLI

Result: available.

Evidence:

```text
Claude Code 2.1.34
```

Notes:

- Good fit for second-opinion strategy, copy/brief critique, and structured review.
- A low-budget smoke test hit budget protection. Future tests must use explicit budget and output logging.
- Use for selected high-value documents, not every cheap lead.

### Local LLM / Ollama

Result: available.

Installed models:

```text
gemma3:27b
deepseek-r1:14b
qwen3.6:27b
qwen3.5:9b
```

Observed behavior:

- `gemma3:27b` returned a simple JSON-like answer for a trivial audit probe.
- `qwen3.6:27b` leaked long reasoning and control characters before final JSON in a simple "JSON only" task.

Decision:

- Local LLMs are useful as low-cost critics, rewrite brainstormers, and first-pass scorers.
- They are not yet trusted as the final source of truth for customer-facing copy, JSON artifacts, or fact-sensitive decisions.
- Any local LLM output used in production must be wrapped by deterministic validation and a parser that can reject non-JSON or reasoning-leaking outputs.

Recommended roles:

| Model/tool | Best role | Avoid |
|---|---|---|
| Codex CLI | repo-aware architecture, production specs, implementation, audit scripts | cheap batch judging |
| Claude Code CLI | second-opinion strategy/copy review, high-value brief critique | uncontrolled low-budget runs |
| `gemma3:27b` | local JSON-ish critic and copy audit experiments | final verified facts |
| `deepseek-r1:14b` | second-opinion reasoning / critique | strict JSON unless parser is robust |
| `qwen3.6:27b` | exploratory critique only until output is controlled | machine-readable pipelines |

### OpenAI Image API

Result: available.

Smoke test:

```text
model: gpt-image-1
size: 1024x1024
quality: low
duration: ~11.6s
output: data/qa/model-capability-smoke/openai-image-roofing-smoke.png
metadata: data/qa/model-capability-smoke/openai-image-smoke-meta.json
```

Quality note:

- The API can generate usable roofing-style assets from Codex.
- The smoke output is not automatically template-approved: it has mild AI-image artifacts and is weaker than the best manually curated family assets.
- Generated images must pass asset QA before entering Open Design seed assets.

## Image Asset Policy

Images should be planned before Open Design, not discovered randomly inside Open Design.

Preferred order:

1. customer-provided photos;
2. current website / Google Business / social images with provenance;
3. operator-approved generated images;
4. licensed/search-sourced niche images with provenance;
5. Open Design substitute imagery only if logged and manually reviewed.

Every image candidate must save:

```json
{
  "prompt": "...",
  "provider": "openai-image-api | chatgpt-image-ui | search | customer | website",
  "source": "...",
  "outputPath": "...",
  "intendedSlot": "hero | service | proof | gallery | material | process | contact",
  "qa": {
    "approved": false,
    "reasons": [],
    "risks": []
  }
}
```

Asset QA must check:

- no text, fake logo, watermark, or fake proof;
- clearly matches the niche and intended slot;
- useful composition and negative space;
- no obvious AI body/tool/hand artifacts;
- good enough for desktop and mobile cropping;
- matches the selected template family.

## Template Library vs Block Library

V2 should build both, but they solve different problems.

### Niche Template Families

Template families define the overall market-facing style and offer pattern:

- premium residential roofing;
- bold commercial roofing;
- emergency repair / restoration;
- productized metal roofing;
- dental practice;
- salon;
- law firm;
- HVAC;
- plumber;
- landscaper.

Use template families when choosing the main direction for a lead.

Each family should contain:

- reference screenshots and/or URLs;
- design language;
- brand kit;
- approved image set;
- section rhythm;
- suitable lead types;
- unsuitable lead types;
- Open Design prompt seed;
- QA screenshots and scores;
- human approval status.

### Block Library

Block modules define reusable site sections:

- hero variants;
- service grid;
- service detail;
- trust bar;
- before/after;
- project gallery;
- process;
- FAQ;
- quote/contact form;
- review/testimonial;
- emergency CTA;
- local SEO service-area block;
- footer.

Use block modules when building `website-production-spec.json`.

### Decision

Do not choose between them.

Use this hierarchy:

```text
niche template family
  -> selects visual language and page rhythm
  -> pulls approved block modules
  -> fills block modules with lead-specific facts, reviews, images, and copy
  -> sends a complete production spec to Open Design
```

Open Design can help generate new candidate templates and new candidate block layouts, but the approved library should live in this repo. The repo is the source of truth; Open Design is the generator and renderer.

## Review Mining

For leads sourced from Google Maps / Place ID, real reviews should become part of market research when available.

Use reviews for:

- customer language: what customers praise or complain about;
- proof strategy: which strengths can be safely emphasized;
- service priorities: emergency response, quality, punctuality, price transparency, cleanup, communication;
- FAQ ideas;
- outreach personalization;
- gap analysis against competitors.

Rules:

- Do not invent reviews as verified proof.
- If real Google reviews are available, store excerpts and sentiment summaries with source metadata.
- If no real reviews exist, AI can create demo/reference review copy for page completeness, but metadata must mark it as generated demo content.
- Customer-facing preview pages should not expose the word `placeholder`; internal audit files must track what is verified, inferred, or generated.

Recommended review artifact:

```text
clients/<slug>/review-research.json
clients/<slug>/review-research.md
```

Fields:

```json
{
  "source": "google_place | website | social | generated_demo",
  "reviewCount": 0,
  "rating": null,
  "themes": [],
  "customerPhrases": [],
  "proofOpportunities": [],
  "risks": [],
  "usableForCopy": []
}
```

## Discovery Report Standard

The discovery report is the most important upstream document. It should feed the website, sales brief, customer preview, outreach, slides, videos, and offer deck.

Minimum sections:

```text
1. Business identity
2. Contact paths
3. Services and likely revenue drivers
4. Current website / online presence summary
5. Google Maps / review findings
6. Competitor and niche context
7. Gap score and opportunity
8. Recommended website angle
9. Recommended template family
10. Required blocks
11. Required images
12. Verified facts
13. Inferred/demo-safe content
14. Forbidden claims
15. Outreach hooks
```

## Production Spec Standard

`website-production-spec.json` should be the construction contract for Open Design:

```json
{
  "schemaVersion": 2,
  "leadSlug": "...",
  "niche": "roofing",
  "pageMode": "one_page_preview | simple_multipage | redesign_preview | paid_build",
  "templateFamily": "...",
  "verifiedFacts": {},
  "reviewResearch": {},
  "gapScore": {},
  "blockPlan": [],
  "assetPlan": [],
  "copyPlan": {},
  "seoPlan": {},
  "contactPlan": {},
  "factLock": {
    "mustKeep": [],
    "mustNotClaim": []
  },
  "auditTargets": {
    "minimumScore": 85,
    "hardFails": []
  }
}
```

## Audit Gate V2

A website cannot move to outreach or customer-facing preview unless it passes:

- fact/contact audit;
- website UI audit;
- website copy audit;
- mobile screenshot audit;
- local SEO audit;
- asset provenance audit;
- Open Design native-finish audit.

Suggested weighting:

| Dimension | Weight |
|---|---:|
| Conversion clarity | 25 |
| Local SEO and service-area fit | 20 |
| Design / trust / industry fit | 25 |
| Copy specificity and readability | 15 |
| Technical / mobile / forms | 10 |
| Fact safety | hard gate |

Hard fail examples:

- wrong phone, email, address, website, or business name;
- weak hero that does not clearly sell the niche;
- no visible CTA path;
- major mobile layout break;
- fake proof presented as real;
- internal workflow language on the customer-facing page;
- Open Design fallback treated as success.

## Open Design Handoff V2

Open Design should receive:

- selected template family and approved design language;
- selected asset pack and intended slots;
- block-level page plan;
- protected facts;
- strong copy brief;
- local SEO requirements;
- contact form behavior;
- forbidden claims;
- audit target.

Open Design should not receive:

- scattered raw notes with no hierarchy;
- unvetted AI claims;
- vague requests like "make a modern roofing website";
- excessive pixel micromanagement that kills design quality.

The best balance is: constrain facts, offer, blocks, assets, and conversion path; leave visual composition and design execution space to Open Design.

## Immediate Implementation Plan

1. Add `master-business-record` generation from existing lead artifacts.
2. Add `website-production-spec` generation for roofing.
3. Add review research as a first-class optional artifact.
4. Add an image generation wrapper for OpenAI Image API with asset QA metadata.
5. Upgrade the final website audit script to V2 gates.
6. Run one controlled lead through:
   - discovery report;
   - gap score;
   - production spec;
   - Open Design handoff;
   - final audit.
7. Compare outputs from:
   - Codex;
   - Claude Code;
   - local LLM critic;
   - deterministic checks.

Do not expand to many niches until roofing can repeatedly produce a customer-worthy result.
