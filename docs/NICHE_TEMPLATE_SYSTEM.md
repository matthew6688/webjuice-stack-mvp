# Niche Template System

Updated: 2026-05-10

ProfitsLocal should not ask Open Design to invent every cold-outreach mockup from scratch. The scalable path is a reusable niche template library:

```text
reference screenshots / links
  -> template-lab ingest
  -> extract design signals
  -> generate DESIGN.md contract
  -> image candidate experiment
  -> niche template family
  -> Open Design template project
  -> QA + screenshots
  -> human-approved template
  -> published template library entry
  -> lead-specific customization
```

## Business Priority

The template system is a support system for the core business loop, not the core business by itself.

Core loop:

```text
qualified lead
  -> evidence/profile
  -> template match
  -> lead-specific copy brief
  -> Open Design mockup
  -> QA/audit
  -> outreach
  -> reply / paid handoff
```

Template work is valuable only when it improves speed, quality, and consistency of that loop. If a template task does not help future lead mockups become faster, better, or easier to approve, it should stay lower priority than lead discovery, mockup generation, outreach, and follow-up.

The first implemented bridge from lead work into template work is:

```bash
npm run leads:build-template-mockup-handoff -- --input <lead-input.json> --out clients/<client-slug>/lead --allow-internal
```

It writes three lead-specific artifacts:

| Artifact | Purpose |
|---|---|
| `template-match.json` | Chooses the best template family and records why other families were not chosen. |
| `copy-brief.json` | Separates verified facts, inferred business context, generated demo content, and forbidden claims. |
| `open-design-handoff.json` | Gives Open Design the selected family, copy plan, fact locks, asset policy, and QA requirements. |

Verification:

```bash
npm run leads:test-template-mockup-handoff
```

This test currently proves that a low-info roofing lead with a real phone number and service list selects `roofing/lead-capture-restoration`, keeps the phone exact, hides internal provenance labels from the customer-facing page, and produces a native-finish-required Open Design handoff.

## Roles

| Surface | Responsibility |
|---|---|
| Discord `website-task` | Operator drops lead/task work that should enter lead-ops. |
| Discord `website-templates` | Operator drops screenshots, links, and template-library references that should become reusable families. |
| Codex / Hermes | Runs `template-lab`, writes repo artifacts, triggers Open Design, reports evidence. |
| Repo | Stores template family truth source and QA evidence. |
| Open Design | Generates visual templates and iterations. |
| Admin | Shows template status, preview, QA score, visual risks, approval state, and which leads used it. |

Current Discord template-library forum:

- Channel: `website-templates`
- Channel ID: `1502432818360352910`
- URL: `https://discord.com/channels/1493925728570310756/1502432818360352910`
- Evidence: `data/qa/discord-template-library-channel.json`

Initial forum posts:

- `classic-premium-roftix`: `https://discord.com/channels/1493925728570310756/1502433028885184584`
- `editorial-bold-commercial`: `https://discord.com/channels/1493925728570310756/1502433034048241714`
- `productized-modern-roofing`: `https://discord.com/channels/1493925728570310756/1502433036644520009`
- `lead-capture-restoration`: `https://discord.com/channels/1493925728570310756/1502433040012677133`
- Evidence: `data/qa/discord-template-library-posts.json`

## Template Family Contract

Each template family must include:

```text
templates/<niche>/families/<family-id>/
  references/
  template-manifest.json
  design-language.md
  design-signals.json
  DESIGN.md
  brand-kit.json
  section-patterns.json
  open-design-prompt.md
  qa-rubric.json
  screenshots/
  image-candidates/
  open-design/
```

`template-manifest.json` is the source of truth:

- niche and sub-niche fit
- one-page / multi-page support
- best-fit lead types
- rejected lead types
- required verified facts
- dummy-safe content
- forbidden invented claims
- visual asset requirements
- reference-derived design signals
- DESIGN.md token contract
- brand-kit and default logo policy
- image candidate experiment runs
- Open Design project/run state
- QA result and human approval

## Reference Ingestion

When Matthew provides screenshots or links:

1. Classify each input:
   - home
   - service list
   - service detail
   - project gallery
   - project detail
   - blog list
   - blog detail
   - FAQ
   - appointment/contact
   - 404/utility
2. Extract design language:
   - hero structure
   - typography direction
   - image density and image types
   - color system
   - CTA hierarchy
   - section rhythm
   - footer structure
3. Decide whether it becomes:
   - a new template family
   - a variant inside an existing family
   - a shared section pattern only

### Screenshot-First Input

The current primary input mode for `website-templates` is screenshot-first:

```text
Matthew posts screenshots
  -> thread is created
  -> references are saved
  -> design signals are extracted
  -> template family is created or updated
```

This is the stable path today because screenshots capture the design target directly. They are the visual truth for style, hierarchy, imagery, spacing, and section rhythm.

### Online Website Reference Input

Matthew may also post a real online company website as a reference. This path must be supported, but it is a separate ingestion mode:

```text
reference website URL
  -> crawl/capture pages
  -> save screenshots + HTML + text snapshot
  -> extract design signals
  -> store as template reference evidence
```

Important rules:

- Do not copy a commercial site verbatim.
- Save the reference as evidence and inspiration, not as final source code.
- Extract visual language, layout patterns, image direction, service modules, and CTA structure.
- If the source website has useful copy patterns, store them as reference notes; do not copy protected brand claims.
- Store captured website references under the same family reference system so future template decisions remain traceable.

Future target storage:

```text
templates/<niche>/families/<family-id>/references/
  screenshots/
  source-sites/
    <domain>/
      capture.json
      desktop.png
      mobile.png
      source.html
      text.txt
      design-signals.json
```

This lets us "copy down" the useful learnings from a target website into the template database without confusing reference material with our own approved template output.

## Build Modes

### One-page

For cold outreach, low-information leads, and lower-price entry offers.

Required sections:

- hero
- services
- proof / why choose
- project teaser
- quote or inspection process
- FAQ
- contact / appointment form
- footer

### Multi-page

For redesigns, stronger leads, paid handoff, or mature businesses.

Recommended pages:

- home
- about
- services
- service detail
- projects
- project detail
- FAQ
- blog
- blog detail
- appointment/contact
- utility pages as needed

## Roofing Starter Families

The first niche should be roofing because we already have strong references.

Initial families:

1. `classic-premium-roftix`
   - mature premium roofing company
   - dark photo hero, editorial serif, deep footer, full multi-page system
2. `editorial-bold-commercial`
   - bold commercial / metal / standout contractor
   - poster typography, black/orange palette, collage sections
3. `productized-modern-roofing`
   - modern productized roof systems, materials, metal/solar roofing
   - SaaS/Webflow-like structure, service accordion, product cards
4. `lead-capture-restoration`
   - fast one-page restoration/repair teaser
   - high conversion, fewer pages, strong form and phone CTA

## QA Rubric

A template is not approved just because it has a phone CTA and no internal words.

## Internal Mockup Library vs Public Template Showcase

There are two different libraries:

| Library | Audience | Purpose | Can use unfinished/internal mockups? | Public website eligible? |
|---|---|---|---|---|
| Internal template mockup library | Matthew / operator / admin | Compare families, inspect Open Design output, pick references for lead-specific mockups | Yes | No |
| Public template showcase | Prospects/customers | Show polished examples of what ProfitsLocal can build | No | Yes, only after approval |

Internal admin templates can be deployed live for private review, but they are still internal references. They may contain demo names, generated images, incomplete brand kits, or QA notes in repo metadata. They are not the final public-facing template gallery.

The public website should only show templates that look like real finished local-business websites:

- approved by human review;
- polished desktop and mobile screenshots;
- no internal labels or QA language in the frontend;
- realistic business logo/brand system;
- complete service, proof, FAQ, contact, footer, and conversion path;
- clearly demo-safe but customer-facing copy;
- no fake verified contact facts or fake real proof.

In practice:

```text
Open Design/internal mockup
  -> admin review
  -> revise until commercially strong
  -> attach real/demo business identity and complete data
  -> approve
  -> publish as public showcase
```

Do not publish raw Open Design experiment output directly to the public template showcase.

Important gate:

- `qa-ready` means the generated files passed technical QA: native Open Design finish, no fallback, no question form blocker, no customer-facing internal terms, visible conversion path.
- `approved` means a human has checked visual quality against the reference: image density, photo realism, palette, typography, niche fit, section rhythm, and overall commercial polish.
- `published` means `qa.approved = true` and `status = published`. Only then can the template appear on the public `/templates` page.
- Public website navigation must not expose draft or `qa-ready` template families.

Template QA must score:

- reference fidelity
- first-viewport impact
- image density and relevance
- niche fit
- page-system completeness
- CTA hierarchy
- trust/proof richness
- footer completeness
- mobile polish
- customer-facing copy cleanliness
- verified/demo fact separation

Visual approval must explicitly check:

- Does the first viewport feel like the provided niche reference, not a generic text-first page?
- Are primary visuals photo-quality or strong enough for the niche? If the reference depends on photos, SVG-only hero art is usually not enough.
- Are colors and fonts intentionally chosen from the reference direction rather than a rough accent token?
- Are there enough section types to support one-page and multi-page offers?
- Does the template include real customer-facing module content, not internal audit language?
- Does the template avoid fake proof while still using demo-safe content to make the page feel complete?

Current note from 2026-05-09: the first roofing Open Design runs passed technical QA, but they should remain internal because the visual completeness is not yet at Matthew's reference level. They need stronger image sourcing/generation, better palette extraction, and tighter reference fidelity before approval.

## Open Design Experiment Matrix

When a template looks worse than the reference, do not keep regenerating all families at once. Fix one page and run a controlled experiment.

## Open Design Stable Generation SOP

The template system exists because one-off Open Design prompts were too easy to make unstable: sometimes they finished by fallback, sometimes they ignored the intended images, and sometimes they produced text-heavy pages that technically existed but were commercially unusable. Templates must prevent those failures.

### Required Handoff Packet

Every real template run must give Open Design a complete but not suffocating packet:

- `DESIGN.md` or design-language notes from the provided screenshots/links;
- a chosen template family and one fixed page target;
- approved image pack copied into seed `assets/`;
- business facts and placeholder policy;
- section list and conversion goal;
- local SEO requirements;
- copy guardrails;
- explicit instruction that seeded raster images are primary approved visual assets.

Open Design should get room to compose the page. The prompt should define business, evidence, content modules, image requirements, and rejection rules; it should not micromanage every pixel unless the experiment is deliberately testing strict constraints.

### Image Policy

Images are chosen before the Open Design run when possible.

Preferred order:

1. customer-provided or current-site images;
2. operator-approved generated images;
3. licensed/search-sourced niche images with provenance;
4. Open Design-generated or substitute imagery only when the run clearly marks it and the result passes human review.

For templates, selected images are stored in the family and copied into experiment seed assets. The scoring layer checks that approved images are actually used by hash where possible. If Open Design ignores the approved image pack and creates a generic page, the run is not approved even if the HTML looks clean.

### Local LLM Role

Local LLM usage is an experiment factor, not a requirement and not a fact source.

It can help with:

- hero copy options;
- service phrasing;
- FAQ wording;
- quote/process language;
- local-business tone cleanup;
- post-generation copy audit.

It must not invent:

- phone, email, address, social links, licences, awards, prices, exact years in business, or verified reviews.

The current stable baseline (`home-live-medium-v6-2026-05-09`) did not require local LLM copy mode. Future experiments should compare speed, copy quality, and visual quality with and without local LLM.

### Autoresearch Loop

Use the autoresearch wrapper when more than one roofing family needs to be promoted from prompt/framework into a real candidate:

```bash
npm run template-lab:autoresearch -- \
  --niche roofing \
  --families editorial-bold-commercial,productized-modern-roofing \
  --variant medium-framework-no-llm \
  --target-score 95 \
  --max-rounds 1 \
  --execute
```

If the operator needs to watch the project inside the Open Design Mac app, add:

```bash
--mode app-visible
```

Without `--mode app-visible`, the runner uses isolated Open Design data under `/tmp/profitslocal-open-design-*`. That is safer for automation and reproducibility, but the project will not appear in the normal Open Design app project list.

If Open Design appears stuck after generating files, inspect `open-design-run-state.json` before rerunning. A valid native finish looks like:

```json
{
  "status": "succeeded",
  "nativeCleanFinish": true,
  "completionMode": "native"
}
```

The runner must treat the terminal SSE `event:end` as the real finish signal. It should not wait for the SSE connection itself to close before writing `experiment-score.json` and the autoresearch summary.

The wrapper does not approve templates. It only runs controlled Open Design experiments, reads each `experiment-score.json`, verifies native clean finish for executed runs, and writes a summary under:

```text
data/template-experiments/<niche>/autoresearch-<run-id>/summary.json
```

Only runs that meet the target score and native completion bar should move to human visual review. Older `open-design-generated` family folders are not enough evidence by themselves.

### Hero Quality Gate

Matthew's review on 2026-05-09: the roofing templates technically passed the current gate, but the hero sections were not strong enough for approval. Treat this as a scoring gap, not a taste footnote.

Hero approval requires:

- first viewport is photo-led and unmistakably roofing within 3 seconds;
- hero image is large enough to carry the page, not a small decorative card beside generic copy;
- CTA is obvious without hunting;
- headline has a concrete local-business hook, not a SaaS/brochure headline;
- the visual direction resembles the selected niche reference family;
- the hero alone would make a cold prospect curious enough to open the full preview.

Reject or rerun when:

- the page is technically valid but the hero feels merely "能看";
- a split layout makes the roofing image secondary;
- the hero could belong to a generic agency, SaaS, blog, or consulting site;
- image choice is realistic but composition lacks drama, scale, or trade credibility.

### Accept / Reject Gate

A template run is rejected if:

- it did not reach native clean finish;
- `completionMode` is `artifact_quiet_fallback`;
- it used no approved imagery or replaced photo-dependent sections with SVG-only graphics;
- it contains internal audit/pipeline/skill language;
- it has no clear CTA path;
- it lacks required local SEO basics;
- it invents real-world proof that should be verified;
- it visually fails the reference direction, especially with thin text pages, repeated horizontal bands, or weak local-business credibility.

A candidate can move toward human approval only when it has:

- native clean finish;
- approved image usage;
- screenshot evidence;
- strong first viewport;
- credible service/trust/contact sections;
- complete contact or demo-safe placeholder handling;
- local SEO basics;
- review provenance policy;
- copy that reads like a customer-facing local business site.

### Current Stable Evidence

The best verified roofing template experiment so far is:

```text
run: home-live-medium-v6-2026-05-09
variant: medium-framework-no-llm
score: 96
nativeCleanFinish: true
completionMode: native
approvedImageMatches: 5/5
localBusinessWebsite.totalScore: 94
```

This run passed the stricter map and local SEO checks:

- real Google Maps search URL, not a plain "directions placeholder";
- `LocalBusiness` / `RoofingContractor` JSON-LD;
- one H1 with business type and service area;
- image alt text and lazy loading;
- AI-generated review copy marked as placeholder provenance.

This is now the minimum evidence shape for a reusable template candidate. Human visual approval is still required before publishing.

Default fixed experiment:

```text
niche: roofing
family: classic-premium-roftix
page: home / index.html only
images: approved selectedImages copied into seed/assets
business facts: one fixed demo business
```

Command:

```bash
npm run template-lab:run-experiments -- --niche roofing --family classic-premium-roftix --page home
```

This is dry-run by default. It writes prompts, seed assets, config, and score placeholders under:

```text
data/template-experiments/<niche>/<family>/<page>-<run-id>/
```

Dry-run does not assign a website quality score. It only proves the experiment inputs are ready. Scores and winners are meaningful only after `--execute`.

To actually spend Open Design runtime, pass `--execute`:

```bash
npm run template-lab:run-experiments -- --niche roofing --family classic-premium-roftix --page home --execute --limit 1
```

Run one variant first. Do not run the full matrix until the seed assets and prompt look correct.

Run a specific variant:

```bash
npm run template-lab:run-experiments -- --niche roofing --family classic-premium-roftix --page home --variant medium-framework-no-llm --execute
```

### Experiment Factors

The current matrix varies:

| Variant | Framework / constraint | Copy mode | Purpose |
|---|---|---|---|
| `strong-framework-no-llm` | strict section contract + DESIGN.md | none | Tests whether heavy constraints preserve structure or make the result stiff. |
| `medium-framework-no-llm` | design language + required sections | none | Tests the likely best balance: enough structure, visual freedom. |
| `free-open-design-no-llm` | minimal constraints | none | Tests raw Open Design taste with the same facts and images. |
| `screenshot-style-no-llm` | reference style transfer | none | Tests whether screenshot feel beats JSON contract compliance. |
| `medium-framework-local-brief` | medium framework | local Ollama brief first | Tests whether local copy planning improves page copy without over-controlling design. |
| `free-open-design-local-brief` | minimal constraints | local Ollama brief first | Tests whether Open Design plus local copy brief is fastest and best. |

Local LLM is an experiment factor, not a fact source. It may improve:

- hero headline options
- service phrasing
- FAQ wording
- quote/process copy
- tone notes

It must not invent:

- contact details
- addresses
- licences
- awards
- reviews
- prices
- years in business
- exact project counts

Default local model comes from:

```text
OLLAMA_MODEL=qwen3.5:9b
OLLAMA_URL=http://127.0.0.1:11434
```

If Ollama is not available, the experiment records `localLlmStatus: unavailable` and uses deterministic fallback copy so the matrix can still be compared.

### Evaluation

Each executed variant writes:

```text
prompt.md
experiment-config.json
open-design-command.json
open-design/
experiment-score.json
```

The score is not Open Design's self-score. It combines:

1. `experimentReliability`
   - native clean finish
   - completion mode must be native, not artifact fallback
   - generated HTML exists
   - approved image assets matched by SHA-256
   - no unapproved raster image substitutions
   - minimum image density
   - minimum section depth
   - conversion path exists
   - no customer-facing internal terms
   - no fake proof metrics
   - time cost
2. `localBusinessWebsite`
   - conversion
   - local SEO
   - technical
   - design and trust
   - content relevance

The final experiment score weighs:

```text
25% experimentReliability
75% localBusinessWebsite
```

The visual layer still needs screenshot review. A variant cannot be approved from static checks alone.

### Local Business Website Rubric

Total: 100.

| Dimension | Points | Purpose |
|---|---:|---|
| Conversion | 25 | Make the visitor call, request a quote, book, or get directions. |
| Local SEO | 25 | Make the page legible to Google and aligned with local intent. |
| Technical | 20 | Avoid mobile, speed, HTTPS, and image hygiene issues. |
| Design & Trust | 20 | Look credible for the niche and provide enough proof structure. |
| Content | 10 | Say clearly what they do, where they work, and why choose them. |

Important scoring policy:

- Review/testimonial modules are allowed in templates as **AI-generated demo/reference reviews**.
- Demo reviews are not a critical blocker, but the artifact metadata must mark them as reference placeholders, for example `data-review-provenance="ai-reference-placeholder"` or `review-provenance`.
- Demo reviews must not pretend to be verified real customer proof in approval notes or customer handoff.
- For real leads, prefer Google Maps / Place reviews when a Place ID or Google Maps source is available.
- If no real reviews exist, AI-generated review-style copy can fill the module as a reference placeholder. This is not a critical blocker.
- Before a customer site goes live, demo reviews should be replaced by real reviews supplied by the customer or sourced from Google review evidence.
- NAP consistency is strict for real leads when Google Place/GMB evidence exists.
- Template experiments only check that NAP slots exist; real lead audits compare name/address/phone against Google Place/GMB.
- Open Design prompts must request local SEO implementation basics: one H1 with business type plus service area, a complete `LocalBusiness`/`RoofingContractor` JSON-LD block, a real Google Maps/directions URL placeholder, and meaningful image `alt`/`loading="lazy"` hygiene.
- Map/directions scoring must require an actual Google Maps URL or embedded map URL. Plain text like “directions placeholder” does not count.

Recommended decision rule:

```text
< 80: discard
80-84: useful evidence but not reusable
85-89: candidate for more visual testing
90+: candidate for human approval
```

The winner should optimize the combined result, not just beauty:

```text
website quality + copy quality + fact safety + native finish + runtime cost
```

## Admin Approval Flow

Internal review lives at:

```text
/admin/templates
```

Admin shows:

- template family and niche
- current approval state
- audit score
- generated screenshots
- Open Design run ID and output directory
- visual risks and why it cannot be public yet
- next action: regenerate, request visual approval, approve, or publish

Official `/templates` only reads published templates. A template must not be added to public navigation just because it exists in `templates/<niche>/families`.

## Reference-to-DESIGN.md Extraction

The correct input path is:

```text
provided screenshot or reference URL
-> extract design signals
-> write design-signals.json
-> generate DESIGN.md
-> include both files in Open Design prompt
```

Commands:

```bash
npm run template-lab:extract-signals -- --niche roofing --family classic-premium-roftix --image /absolute/path/reference.png
npm run template-lab:design-md -- --niche roofing --family classic-premium-roftix
```

If no API key is available, `--dry-run` still binds the reference and records that the result is not visually approvable.

`DESIGN.md` follows the Google Labs `design.md` idea: human-readable intent plus machine-readable tokens for colors, typography, spacing, radii, and components. Open Design should receive this contract before generation.

## Image Candidate Experiments

Images are a first-class artifact, not decoration added at the end.

Manual ChatGPT Image prompt pack:

```text
templates/roofing/image-prompts/chatgpt-image2-prompt-pack.md
```

Initial provider:

- OpenAI image generation, default `gpt-image-1`, low quality for cheap exploration.

Command:

```bash
npm run template-lab:image-candidates -- --niche roofing --family classic-premium-roftix --dry-run
```

After rotating any leaked API key and setting a new local key:

```bash
npm run template-lab:image-candidates -- --niche roofing --family classic-premium-roftix --quality low --size 1024x1024
```

Automation notes:

```text
docs/IMAGE_GENERATION_AUTOMATION_NOTES.md
```

Manual ChatGPT Image review outputs should be stored under the relevant template family, for example:

```text
templates/roofing/families/classic-premium-roftix/image-candidates/manual-chatgpt-image/2026-05-09-family-1/
```

Each reviewed run must include:

- source prompt pack path
- image slot
- selected/rejected status
- score or short quality judgment
- recommended use in Open Design
- manifest `selectedImages` entries for assets approved for template generation

## Brand Kit And Missing Logo Rule

If a lead or template family has no real logo, do not ask the client to choose from multiple options during outreach. Choose one sensible demo mark automatically and keep it replaceable.

Default rule:

```text
no client logo
  -> generate brand-kit.json
  -> select exactly one demo logo direction
  -> pass selected mark + palette + typography into Open Design
  -> replace later only if the paying client provides a real logo
```

Command:

```bash
npm run template-lab:brand-kit -- --niche roofing --family classic-premium-roftix --business "Greg Roofing & Restoration"
```

The output must keep:

- `logo.policy = single-default-demo-logo`
- exactly one `logo.options[]` item
- no invented licences, awards, verified reviews, years, prices, or real addresses
- AI-generated review copy is allowed only as reference placeholder content and must be replaced by real or Google reviews before live
- no copied reference logo or paid asset

Gemini can be used as an optional low-cost brand-strategy provider:

```bash
npm run template-lab:brand-kit -- --niche roofing --family classic-premium-roftix --provider gemini
```

The API key is local-only via `GOOGLE_GENERATIVE_AI_API_KEY` or `GEMINI_API_KEY`; it must never be committed or printed in logs.

Each run writes:

```text
templates/<niche>/families/<family>/image-candidates/<timestamp>/image-run.json
```

Generated images still need human approval. A technically generated image can fail because it looks generic, fake, too soft, or unlike the reference.

## Copy Audit

Template copy has two gates:

1. Deterministic audit: internal terms, fake proof, weak contact path, generic phrases, weak niche language.
2. Local LLM / human audit: sales quality, specificity, tone, and whether the page feels like a real local business site.

Current command:

```bash
npm run template-lab:audit-copy -- --niche roofing --all
```

The deterministic audit is necessary but not sufficient. Passing it does not mean the copy is good enough to publish.

## Commands

Create a template scaffold:

```bash
npm run template-lab:init -- --niche roofing --family classic-premium-roftix
```

Validate the scaffold script:

```bash
npm run template-lab:test
```

Create or sync the dedicated Discord template-library forum:

```bash
npm run discord:setup-template-library-channel -- --name website-templates --type forum
```

Run Open Design for a template family:

```bash
npm run template-lab:run-open-design -- --niche roofing --family classic-premium-roftix
```

Dry-run the Open Design handoff without starting a real run:

```bash
npm run template-lab:run-open-design -- --niche roofing --family classic-premium-roftix --dry-run
```

Run a lead-specific template handoff through the business Open Design runner:

```bash
npm run open-design:run-template-handoff -- --client <client>
```

Dry-run a lead-specific handoff and write the run request artifact:

```bash
npm run open-design:run-template-handoff -- --client <client> --dry-run
```

This wrapper reads:

```text
clients/<client>/lead/open-design-handoff.json
```

and writes:

```text
clients/<client>/lead/open-design-run-request.json
clients/<client>/concept/open-design/open-design-run-state.json
clients/<client>/concept/open-design/concept-quality-audit.json
clients/<client>/concept/open-design/index.html
public/admin-artifacts/<client>/open-design/index.html
public/admin-artifacts/<client>/open-design/concept-quality-audit.md
public/admin-artifacts/<client>/open-design/open-design-run-state.json
```

Important defaults:

- `mode=app-visible`, because operators need to see the project in Open Design;
- checkpoint timeout defaults to 30 minutes;
- `artifact_quiet_fallback` is off unless explicitly passed;
- validation requires native clean finish and quality audit before outreach.
- successful runs mirror the generated preview and audit files into `public/admin-artifacts/<client>/open-design/` so the admin template/lead UI can open the preview from the browser.

## Skill

Use local skill:

```text
template-lab
```

Short-term: Codex runs it directly.
Medium-term: Hermes/Discord routes `website-task` template requests into the same workflow.
Long-term: Admin shows template inventory and template-to-lead usage.
