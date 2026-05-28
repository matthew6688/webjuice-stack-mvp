# ProfitsLocal Autoresearch Optimization SOP

Updated: 2026-05-10

This SOP defines how ProfitsLocal should repeatedly improve prompts, reports, copy, audits, Open Design handoffs, and website generation quality without relying on one-off intuition.

The rule is simple:

```text
same input
-> multiple model/prompt variants
-> saved raw outputs
-> fixed rubric
-> comparison report
-> selected winner
-> reusable lesson
```

## Where This Applies

Use this loop for any step where quality matters and a bad output can hurt the business:

- lead discovery report;
- gap score / sales diagnosis;
- website production spec;
- copy brief;
- Open Design handoff;
- generated website audit;
- customer preview brief;
- cold outreach message;
- video / slide / offer deck script.

Do not use it for cheap deterministic tasks such as formatting a known JSON file or copying an artifact.

## Required Artifacts

Every autoresearch run must save:

```text
data/qa/<workflow>/<run-id>/
  input.json
  prompt.txt
  variant-<name>.prompt.txt
  <provider>.raw.txt
  <provider>.result.json
  summary.json
  report.html
```

For customer/lead-related work, also write the selected business-facing/internal report into:

```text
clients/<client-slug>/reports/
  <report-name>.html
  <report-name>.md
  <report-name>.json
```

If the report needs to be visible in admin, copy a public-safe version into:

```text
public/admin-artifacts/<client-slug>/reports/
```

Never write secrets, API keys, private webhook URLs, cookies, or raw credentials into these reports.

## Step 1: Lock The Input

The input must be frozen before comparing models.

For a lead report, the payload should include:

- `verifiedFacts`: business name, phone, email, address, website, Google Place ID, services, source text;
- `evidence`: screenshots, source URLs, OCR text, website crawl text, Google/Maps facts;
- `missingEvidence`: what we do not know yet;
- `constraints`: what cannot be invented;
- `desiredOutputs`: exact report/spec/copy sections.

Facts must be labeled:

- `verified`: safe to show exactly;
- `inferred`: reasonable but not proven;
- `generatedDemoContent`: acceptable for preview completeness, but not a factual claim;
- `forbidden`: cannot be fabricated.

## Step 2: Define The Rubric Before Running

The evaluator must be written before running model variants.

Minimum rubric for lead-to-website documents:

- parseable JSON;
- preserves verified phone/email/address exactly;
- does not invent email, URL, address, license, award, review, warranty, or price;
- states missing evidence clearly;
- includes gap score and reasons;
- includes website production spec;
- includes copy brief;
- includes asset plan;
- includes Open Design handoff intent;
- avoids internal terms in customer-facing copy;
- avoids reasoning leakage;
- produces actionable next steps.

Scores should map to business decisions:

- `95-100`: can become default winner if cost/time is acceptable;
- `85-94`: usable with cleanup or second pass;
- `70-84`: critique or draft only;
- `<70`: reject for production.

## Step 3: Run Variants

Run at least two of these dimensions when quality is uncertain:

- model: Codex, Claude, Qwen local, DeepSeek local, deterministic baseline;
- prompt: baseline, strict JSON, strict fact-lock, copy-heavy, design-heavy;
- thinking mode: local model thinking on/off when supported;
- timeout: normal vs long for local models;
- output schema: relaxed vs strict.

Current document comparison commands:

```bash
npm run leads:compare-document-models -- --run-id <id> --providers deterministic,codex,claude
npm run leads:compare-document-models -- --run-id <id> --providers ollama:qwen3.6:27b,ollama:deepseek-r1:14b --prompt-variant strict-v2 --think false --timeout 300000
npm run leads:autoresearch-document-models -- --run-id <id> --providers ollama:deepseek-r1:14b,ollama:qwen3.6:27b --variants baseline,strict-v2 --think false --timeout 300000
```

## Step 4: Compare

The comparison report must show:

- exact source payload;
- exact prompt;
- provider/model;
- duration;
- score and grade;
- findings;
- raw model output;
- final selected provider;
- reason for selection.

Admin location:

```text
/admin/reports
```

The operator should be able to answer:

- What did we give the model?
- What did each model say?
- Which model won?
- Why did it win?
- What risks remain?
- Which report is now being used downstream?

## Step 5: Select And Freeze Winner

Selection should not be based on score alone.

Prefer the output that best balances:

- factual safety;
- usefulness for the next workflow step;
- Chinese/operator readability;
- customer-safe copy;
- Open Design handoff completeness;
- speed;
- cost;
- repeatability.

For high-value reports, Codex/Claude can be worth the cost. For batch or offline drafting, local Qwen may be acceptable if validation passes. Local DeepSeek can be used for critique/fallback but should not bypass cleanup.

## Step 6: Convert To Human Report

Machine JSON is not enough.

Every selected output should become a human-readable report:

- Chinese-first for internal operator/sales;
- clear verdict;
- verified facts;
- missing evidence;
- opportunity/gap;
- recommended website direction;
- copy direction;
- asset plan;
- forbidden claims;
- next steps.

The current generator:

```bash
npm run leads:build-document-comparison-report
```

Outputs:

```text
data/qa/document-model-comparison/document-model-comparison-report.html
clients/roofing-restoration-greg-sign/reports/discovery-report-cn.html
public/admin-artifacts/roofing-restoration-greg-sign/reports/discovery-report-cn.html
```

## Step 7: Feed The Next Stage

The selected report should become input to the next stage:

```text
discovery report
-> copy brief
-> template match
-> Open Design handoff
-> Open Design run
-> generated website audit
-> outreach draft
```

Never hand Open Design a loose prompt when a mature report/spec exists.

## Lessons From 2026-05-10 Smoke

- Codex produced the strongest structured document output in the first test.
- Claude was strong but needed stricter score-range constraints.
- Qwen with thinking off can produce strong local JSON, but it is slow.
- DeepSeek improved significantly after strict fact-lock rules.
- Gemma was not reliable for strict JSON document generation in the current setup.
- The prompt contract matters as much as the model.

## Definition Of Done

An autoresearch loop is complete only when:

- raw outputs are saved;
- evaluator scores are saved;
- comparison HTML exists;
- selected output is turned into a human report;
- admin can show the report and comparison;
- SOP/docs record the lesson;
- tests verify the index can load the artifacts.
