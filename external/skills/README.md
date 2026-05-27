# external/skills · Upstream skill repos

## What this is

Cloned skill repositories from the actual authors (not OD catalogue stubs).

**Why**: OD repo (`github.com/nexu-io/open-design`) `skills/` directory holds **139 catalogue stubs** (43-line `SKILL.md` each · trigger words + upstream URL · NO actual methodology). The real skill content lives in upstream author repos. This directory clones those upstreams so we have the methodology, prompts, evals, and supporting code.

## File layout

```
external/skills/
├── README.md            ← this file (skill → pipeline mapping)
├── LOCKFILE.md          ← upstream SHAs · update procedure
├── PULL.sh              ← idempotent re-clone (uses LOCKFILE SHAs)
├── INTEGRATION-MAP.md   ← (future) which skills we'll wire into pl:audit-v4 + brief-intake
├── OUR-USAGE.md         ← (future) per-skill notes · what we changed · gotchas
├── .gitignore           ← excludes cloned content (regen via PULL.sh)
│
├── marketingskills/             ← github.com/coreyhaines31/marketingskills · 42 skills
├── gstack/                       ← github.com/garrytan/gstack · 58 skills
├── taste-skill/                  ← github.com/Leonxlnx/taste-skill · 13 skills
├── anthropics-skills/            ← github.com/anthropics/skills · 18 skills
├── openai-skills/                ← github.com/openai/skills · 44 skills (.curated/.system)
├── vercel-skills/                ← github.com/vercel-labs/skills · 1 skill (find-skills meta)
└── creative-director-skill/      ← github.com/smixs/creative-director-skill · 1 skill
```

**Total clone size**: ~89 MB · gitignored · materialize via `bash PULL.sh`

## Getting started

```bash
# First time setup
bash external/skills/PULL.sh

# Update to latest upstream (manual SHA refresh after)
bash external/skills/PULL.sh --update

# Force re-clone (e.g. corrupted local)
bash external/skills/PULL.sh --force
```

---

## Skill → ProfitsLocal pipeline mapping (P0/P1 only · ~30 skills)

> **Pipeline stages** (cross-ref `docs/v3/OD-SKILLS-FULL-INVENTORY.md`):
> S1 Lead discovery · S2 Enrichment · S3 Brand brief · S4 Build website · S5 Audit · S6 Proposal · S7 Demo · S8 Outreach · S9 Retainer assets

### S3 · Brand brief / direction

| skill (real path) | what it gives us | replacement for |
|---|---|---|
| `taste-skill/skills/brandkit/SKILL.md` (798 lines) | Full brand-kit workflow · tokens + 8 logo variants + QA checklist | Our Phase 1 hand-crafted brand SOP (mark-squire pattern) |
| `anthropics-skills/skills/brand-guidelines/SKILL.md` | Anthropic-style brand-token discipline | Reference for our brand-tokens.css schema |
| `marketingskills/skills/customer-research/SKILL.md` | Persona + ICP definition methodology | Augments §1 persona in SOP-SINGLE-PAGE-LOCAL-TRADE |

### S4 · Build / design

| skill | what it gives us | replacement for |
|---|---|---|
| `taste-skill/skills/taste-skill/SKILL.md` | DENSITY/MOTION/VARIANCE 3-dial · anti AI-slop | We already use philosophically · now have real prompts |
| `taste-skill/skills/redesign-skill/SKILL.md` | Redesign methodology · before/after | Replaces our ad-hoc redesign-brief.json |
| `taste-skill/skills/brutalist-skill` + `soft-skill` + `minimalist-skill` | Stylistic dial variants | Cross-style template generation |
| `taste-skill/skills/imagegen-frontend-web/SKILL.md` (987 lines) | LLM prompts for hero image generation | Replaces ad-hoc fal-image-edit calls |
| `taste-skill/skills/image-to-code-skill/SKILL.md` (1228 lines) | Screenshot → HTML/CSS | Reverse-engineer competitor sites |
| `gstack/design-html/SKILL.md` | HTML scaffold methodology | Reference for slot-filler CLI design |
| `anthropics-skills/skills/frontend-design/SKILL.md` | Anthropic frontend playbook | Our default fallback |
| `anthropics-skills/skills/theme-factory/SKILL.md` | 10 preset themes · CSS tokens | brand-tokens contract validation |

### S5 · Audit

| skill | what it gives us | replacement for |
|---|---|---|
| `gstack/design-review/SKILL.md` | Designer-Who-Codes · iterative atomic fixes · before/after screenshots | Currently we use this CONCEPT · now have real workflow |
| `gstack/plan-design-review/SKILL.md` | Senior designer 0-10 per dim · AI-Slop detection | T4 in our audit-v4 ADR |
| `gstack/design-consultation/SKILL.md` | From-scratch design system · creative risks | Reference for design-from-zero clients |
| `creative-director-skill/creative-director/` | 20+ methodologies (SCAMPER · TRIZ · SIT · Bisociation) · Cannes-calibrated scoring | T5 in audit-v4 ADR · premium tier only |
| `gstack/careful/SKILL.md` + `canary/SKILL.md` + `freeze/SKILL.md` | Production gates · regression prevention | Our pre-commit hooks |

### S6 · Proposal / pitch decks

| skill | what it gives us | replacement for |
|---|---|---|
| `anthropics-skills/skills/pptx/SKILL.md` | Real .pptx generation | Slide decks for prospects |
| `anthropics-skills/skills/docx/SKILL.md` | Word doc generation | Quote / proposal docs |
| `anthropics-skills/skills/pdf/SKILL.md` | PDF generation | Sealed proposals |
| `anthropics-skills/skills/web-artifacts-builder/SKILL.md` | React + Tailwind artifact | Interactive proposal previews |

### S7 · Demo video / screenshots

| skill | what it gives us | replacement for |
|---|---|---|
| `anthropics-skills/skills/canvas-design/SKILL.md` | Marketing graphic generation | Hero / social card design |
| `anthropics-skills/skills/algorithmic-art/SKILL.md` | Generative art for brand assets | Visual interest in INFERRED brand kits |

### S8 · Outreach (cold email · SMS · WhatsApp · ad creative)

| skill | what it gives us | replacement for |
|---|---|---|
| `marketingskills/skills/marketing-psychology/SKILL.md` (455 lines) | Mental models (JTBD · First Principles · Inversion · 5 Whys · anchoring · social proof · scarcity · loss aversion · framing) | Outreach hook framing |
| `marketingskills/skills/copywriting/SKILL.md` | Landing/ad copy methodology | Hero copy generation |
| `marketingskills/skills/ad-creative/SKILL.md` | Headline + description + primary text | Email subject + body templates |
| `marketingskills/skills/cro/SKILL.md` | Conversion rate optimization tactics | Audit T2 hero CRO rules |
| `marketingskills/skills/customer-research/SKILL.md` | ICP + buyer persona | Per-niche outreach segmentation |
| `marketingskills/skills/competitor-profiling/SKILL.md` | Competitor analysis | Outreach hook: "your competitor X does Y" |
| `marketingskills/skills/sales-enablement/SKILL.md` | Sales collateral | Proposal materials |
| `anthropics-skills/skills/internal-comms/SKILL.md` | Internal messaging tone | Outreach voice consistency |

### S9 · Retainer assets (paid clients · monthly deliverables)

| skill | what it gives us | replacement for |
|---|---|---|
| `marketingskills/skills/analytics/SKILL.md` | GA4 / pixel implementation guidance | Customer report dashboards |
| `marketingskills/skills/ai-seo/SKILL.md` | LLM-era SEO playbook | Content strategy for retainer clients |
| `marketingskills/skills/pricing/SKILL.md` | Pricing psychology / strategy | Tier upgrade conversations |
| `marketingskills/skills/churn-prevention/SKILL.md` | Retention tactics | Lost-client follow-up |
| `marketingskills/skills/onboarding/SKILL.md` | Customer onboarding flows | New-client welcome sequence |
| `marketingskills/skills/popups/SKILL.md` | Exit-intent / scroll-trigger popups | Lead-gen on client sites |
| `marketingskills/skills/lead-magnets/SKILL.md` | Lead-magnet design | Free-quote-with-bonus offers |

### S5 + S2 · Audit infrastructure

| skill | use case |
|---|---|
| `anthropics-skills/skills/webapp-testing/SKILL.md` | Playwright test patterns · our pre-deploy gate |
| `anthropics-skills/skills/skill-creator/SKILL.md` | Build new ProfitsLocal skills cleanly |
| `anthropics-skills/skills/mcp-builder/SKILL.md` | If we add MCP servers (Discord / Hermes etc) |

---

## What we DON'T use (not pipeline-relevant · gitignored but not curated)

These exist in the upstreams but aren't on our P0/P1 list. They're available if the niche evolves:

**gstack** (58 skills · ~50 not curated for us): autoplan, ios-qa, ios-design-review, pair-agent, benchmark, cso, learn, plan-tune, make-pdf, unfreeze, context-save, setup-deploy · etc.

**openai-skills** (44 · 0 curated): `.curated/render-deploy · gh-fix-ci · notion-spec-to-implementation · cli-creator · yeet · sentry · playwright-interactive · transcribe · gh-address-comments · security-ownership-map · figma-* (4) · migrate-to-codex · security-threat-model`. None match our pipeline.

**marketingskills** (42 · 26 curated): rest are revops · social · prospecting · cold-email tactics specific to SaaS (not local trade).

**taste-skill** (13 · 6 curated): rest are platform-specific (gpt-tasteskill · stitch-skill · taste-skill-v1 deprecated).

**anthropics-skills** (18 · 10 curated): rest are doc tools (xlsx · skill-creator · skill-installer · plugin-creator · openai-docs).

**vercel-skills** (1): only `find-skills` meta-tool · skip.

---

## Important caveats

1. **All upstream skills are SKILL.md prompts · NOT runnable code**. They're written for an LLM agent (Claude · GPT) to consume. We integrate by reading the SKILL.md and embedding the methodology into our prompts / our pl:audit-v4 dim definitions / our slot-filler templates.

2. **No automatic invocation**. We don't have a skill runtime that auto-picks the right SKILL.md. We make conscious choices about which to integrate per pipeline stage.

3. **Upstream licenses vary**. Check each upstream's LICENSE before redistributing in customer deliverables. Most are MIT / CC.

4. **Update discipline**. Don't auto-pull upstreams. Pin SHAs in LOCKFILE.md · only update when we've reviewed the diff.

5. **OD repo is still useful** for `design-systems/` (152 tokens.css · those ARE real assets · we use V5 OD editorial / V7 OD warm-editorial). Skills/ are catalogue-only.

---

## Errata for `docs/v3/OD-SKILLS-FULL-INVENTORY.md`

The 139-skill inventory file at `docs/v3/OD-SKILLS-FULL-INVENTORY.md` assigned P0-P3 tiers based on OD's SKILL.md descriptions. **That tier scoring is approximately right but the "how to use it" is wrong**: I implied we could invoke OD skills directly. Reality: we must clone upstreams (this directory) to get the real methodology, then embed it into our prompts.

To-fix in OD-SKILLS-FULL-INVENTORY.md: add a header banner pointing readers to this directory for actual content. Action item tracked in `task #65`.
