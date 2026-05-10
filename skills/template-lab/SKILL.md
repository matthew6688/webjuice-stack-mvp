---
name: template-lab
description: Use when turning screenshots, website links, or niche references into a reusable local-business website template family. Handles reference ingestion, niche/sub-niche template planning, Open Design prompt preparation, QA criteria, and template matching for cold outreach.
---

# Template Lab

Build reusable niche template families before customizing individual lead mockups.

## When to use

Use this skill when the user:

- provides screenshots or links as website design references
- asks how to turn a niche into reusable website templates
- wants one-page or multi-page local business templates
- wants Open Design to imitate a reference style without copying brand, code, or paid assets
- wants to match a lead to an existing template family

Do not use this skill to copy a commercial template verbatim. Extract patterns, then create original ProfitsLocal templates.

## Workflow

1. Ingest references:
   - classify each screenshot/link by page type
   - identify niche, sub-niche, style family, and best-fit lead types
   - preserve source paths/URLs in the template manifest
2. Plan the template family:
   - decide whether this is a new family or a variant of an existing family
   - choose `one-page`, `multi-page`, or both
   - define required facts, dummy-safe content, and forbidden invented claims
3. Create the repo scaffold:

```bash
npm run template-lab:init -- --niche <niche> --family <family-id>
```

4. Fill the scaffold:
   - `template-manifest.json`
   - `design-language.md`
   - `section-patterns.json`
   - `open-design-prompt.md`
   - `qa-rubric.json`
5. Run Open Design only after the reference brief is specific enough.
6. QA the generated template against the reference family, not only against compliance gates.
7. Publish a template only when screenshots, QA score, and human approval are recorded.

## Template Library Layout

```text
templates/<niche>/
  shared/
    image-keywords.json
    service-taxonomy.json
    trust-signals.json
  families/<family-id>/
    references/
    template-manifest.json
    design-language.md
    section-patterns.json
    open-design-prompt.md
    qa-rubric.json
    screenshots/
    open-design/
```

## Matching Rules

Template matching must explain:

- why this template fits the lead
- why other families were rejected
- which facts must be verified before customer-facing use
- which sections can use rich demo content
- whether the recommended build is a one-page teaser, standard site, or premium multi-page site

## Quality Rules

- Prefer real niche imagery. Search/download usable images when allowed; use AI generation only when search or source assets are insufficient.
- A visual asset plan must name image types, not just "use photos".
- Do not let Open Design average multiple incompatible references into one generic template.
- Keep verified facts and demo content separate.
- Customer-visible pages must not expose internal workflow terms.
- A template passing compliance audit is not enough; it must look like a sellable industry template.

## Validation

Run:

```bash
npm run template-lab:test
```

For generated Open Design templates, also run:

```bash
npm run open-design:audit-concept -- --client <template-client> --fail-below 85
npm run open-design:validate-concept -- --client <template-client> --require-quality-audit true
```
