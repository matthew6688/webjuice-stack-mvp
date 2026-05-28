# PRD · ProfitsLocal Pipeline · v1.0 · 2026-05-28

> **Audience**: Claude (next agent) + codex + Matthew. **Status**: signed off by codex Round 24.
> **Purpose**: stop the wheel-rebuilding + orphan-skill pattern. This doc is the durable SSOT for *what we are building*, *which pipeline stage owns what*, *which skill plugs into which stage*, *which artifact has which writer*, and *what defines done*.
>
> **Failure mode this doc prevents**: agent builds X · 2 weeks later builds Y that should have read X · X stays orphan. Already happened twice in May 2026 (Phase A.1 Step 5 wireframe never read; Phase B Step 2 composer ignored 3 Phase A skills).
>
> **Enforcement**: every Phase B step references this doc by section. New artifact types prohibited (CLAUDE.md §7). Composer/audit emit `skills-usage-trace.json` (§6) so orphan regression is machine-detectable.

---

## §1 · Vision

ProfitsLocal turns 1 Australian roofing-business GBP lead into 1 paying $399 single-page editorial-newsletter website, automated · audit-gated · skill-driven · scaling to 50/month.

**Out of scope (Phase B)**: multi-page sites · cross-niche (plumber/electrician) · outreach automation (Phase D).

**In scope (Phase B)**: roofing niche only · 4 candidate clients (vicwest GREEN · a-j YELLOW · mark-squire + abc RED).

---

## §2 · Pipeline (7 canonical stages)

```
DISCOVERY → ENRICHMENT → BRIEF → WIREFRAME → RENDER → AUDIT → OUTREACH
```

Each stage has **canonical writer CLI** (single writer · CLAUDE.md §6) and **canonical artifact** (single SSOT file or directory). Multiple readers OK.

```
1 DISCOVERY     leads/<batch>.jsonl              writer: pl:scrape-docker + places-search-intake
                                                  reader: pl:lead-discovery + lead-filter

2 ENRICHMENT    data/leads/entities/<id>.json    writer: pl:enrich-entity + places-enrich + tinyfish
                + clients/<slug>/v2/multi-page-crawl/    writer: tinyfish core/leads/enrichment.js
                + clients/<slug>/v2/handoff/photos/source/  writer: pl:places-enrich photo pull
                + clients/<slug>/v2/handoff/photos/selected.json  writer: core/handoff/classify-images.js (vision LLM)

3 BRIEF         clients/<slug>/v2/core-extract.json    writer: pl:llm-extract-core
                + clients/<slug>/v2/master.md          writer: pl:core-extract-to-md (derived · NOT canonical)
                + clients/<slug>/v2/single-page-brief.yaml  writer: manual + pl:enrich-handoff
                + clients/<slug>/v2/checkpoint.json    writer: pl:data-checkpoint (RED/YELLOW/GREEN gate)

4 WIREFRAME     clients/<slug>/v2/wireframes/wireframe-<page>-<llm>.json   writer: pl:llm-page-copywriter
                                                  persona-aware · reads pl-au-trade-voice + personas/<primary>.js

5 RENDER        clients/<slug>/v2/editorial-output/index.html               writer: pl:compose-editorial
                + editorial-output/skills-usage-trace.json                  writer: pl:compose-editorial (NEW per codex R24)
                + editorial-output/assets/{brand,stock}/                    copied from handoff/ + stock-library/

6 AUDIT         clients/<slug>/v2/editorial-output/audit-v4-{full,issues,summary}.json   writer: pl:audit-v4
                + editorial-output/site-report.html                         writer: pl:site-report (NEW · Phase B Step 7)

7 OUTREACH      Phase C · out of scope for Phase B
```

**Hard rule**: each canonical artifact has 1 writer. Anything claiming "I'll also write to this" is rejected (CLAUDE.md §6 SSOT writer-check).

---

## §3 · Artifact Contracts (per codex R24 Q-EE-6)

For every canonical artifact: writer · reader(s) · path · required fields · failure mode.

### 3.1 · `clients/<slug>/v2/single-page-brief.yaml`

| Field | Value |
|---|---|
| **Writer** | manual edit OR `pl:enrich-handoff` (post-extraction · pre-LLM) |
| **Schema validator** | `pl:validate-single-page-brief` (uses `core/handoff/single-page-brief-schema.js` 250 lines · AJV minimal · 12 cross-field constraints) |
| **Required fields** | business_name · phone · address · state · abn · license{authority,number,status} · niche · primary_segment · urgency_mix · pricing_disclosure_mode · suburbs_covered · services · brand_tokens_path |
| **Readers** | `pl:compose-editorial` (canonical claim source · § 3.4) · `pl:llm-page-copywriter` (persona+segment context · §3.5) |
| **Failure mode** | schema invalid → exit 1 · downstream blocked |
| **Provenance convention** | each field optionally `_source: "verified" / "ai-inferred" / "ai-placeholder" / "needed-client-supplied" / "forbidden"` |

### 3.2 · `clients/<slug>/v2/checkpoint.json`

| Field | Value |
|---|---|
| **Writer** | `pl:data-checkpoint` (7 hard fields + 6 rich fields scored) |
| **Required** | verdict ∈ {RED, YELLOW, GREEN} · hard{n_passed,n_total} · rich{n_passed,n_total} · missing[] · pages ∈ {single, multi} |
| **Readers** | `pl:compose-editorial` (refuses RED) · `pl:assemble-handoff` (refuses RED) · `pl:audit-v4` (informational) |
| **Failure mode** | RED → all downstream renderers refuse · YELLOW → render with PREVIEW banner · GREEN → no restriction |

### 3.3 · `clients/<slug>/v2/wireframes/wireframe-home-<llm>.json` (CANONICAL LLM COPY · §4 fixes orphan)

| Field | Value |
|---|---|
| **Writer** | `pl:llm-page-copywriter` (reads `core/audit/personas/<primary>.js` + `skills/pl-au-trade-voice/pl-au-trade-voice.json` · persona-overlay merged into LLM system prompt · Phase A.1 Step 5) |
| **Required blocks** | hero · trust-bar · services-grid · why-us · proof-strip · gallery · service-areas · reviews · cta-band (9 minimum) |
| **Required per block** | type · content (per canonical schema · pl-llm-page-copywriter.js R5) |
| **Readers** | `pl:compose-editorial` (PRIMARY COPY SOURCE per §3.4 · currently ORPHAN · Phase B Step 4 fixes) |
| **Failure mode** | missing → composer falls back to narrative.about_us_draft + hardcoded template (current state · not desired) |

### 3.4 · `clients/<slug>/v2/editorial-output/index.html`

| Field | Value |
|---|---|
| **Writer** | `pl:compose-editorial` |
| **Inputs (priority order)** | (1) brief.yaml canonical claims (license/year/suburbs) · (2) wireframe-home-<llm>.json LLM copy · (3) core-extract.brief.narrative fallback for missing wireframe fields · (4) facts.json (rating/review_count/google_maps_url) · (5) handoff/photos/selected.json (image best_placement) · (6) brand-tokens.css · (7) pl-au-trade-voice constants for banned-phrase strip · (8) personas/<primary>.js for voice_modifiers · (9) editorial-newsletter/template.html |
| **Template** | `templates/roofing/editorial-newsletter/template.html` (579 lines · 103 Mustache fields) |
| **Failure mode** | checkpoint RED → exit 3 · brief invalid → exit 2 · template missing → exit 1 |

### 3.5 · `clients/<slug>/v2/editorial-output/skills-usage-trace.json` (NEW per codex R24)

| Field | Value |
|---|---|
| **Writer** | `pl:compose-editorial` (every render emits) |
| **Required fields** | skills_consumed[] · skills_orphan[] · artifacts_read[] · artifacts_skipped[] · provenance_breakdown{verified, ai-inferred, ai-placeholder, needed, forbidden} · audit_score · audit_grade |
| **Readers** | `pl:site-report` (Phase B Step 7) · CI/regression check |
| **Failure mode** | trace must list ≥3 skills · ≥7 artifacts · or composer exits 4 (orphan regression detection) |

### 3.6 · `clients/<slug>/v2/editorial-output/audit-v4-full.json`

| Field | Value |
|---|---|
| **Writer** | `pl:audit-v4` |
| **Reads** | rendered index.html · skills-usage-trace.json · brief.yaml (cross-field) · pl-au-trade-voice.json (banned phrases) · pl-audit-rubric.json (61 rule IDs · Phase B Step 8) · personas/<primary>.js (critical_signals_5_second) |
| **Required tiers** | tier_1 (mechanical PASS/FAIL · 14+ checks) · tier_2 (brand 5 dims · 0-100) · tier_4d_voice (3 sub-dims · 0-100) |
| **Ship gate** | composite ≥85 · T1 PASS · T2 ≥80 · T4d ≥90 |

---

## §4 · Skill × Stage Matrix

19 skills × 7 stages. ✓ = production wired · ⚠ = partial/conditional · ❌ = orphan (must fix per Phase B step).

| Skill | DISCOVERY | ENRICHMENT | BRIEF | WIREFRAME | RENDER | AUDIT | OUTREACH |
|---|---|---|---|---|---|---|---|
| profitslocal-lead-discovery | ✓ | | | | | | |
| profitslocal-lead-filter | ✓ | | | | | | |
| profitslocal-collect | ✓ | ✓ | | | | | |
| image-lead-discovery | ⚠ | | | | | | |
| lead-ops | ⚠ doc only | | | | | | |
| profitslocal-entity-enrichment | | ✓ | | | | | |
| profitslocal-build-research-pack | | ✓ | ✓ | | | | |
| profitslocal-data-checkpoint | | | ✓ | | | | |
| website-redesign-preservation | | | ⚠ | | | | |
| **pl-local-trade-page-spec** | | | ❌→✓ Step 9 | | ❌→✓ Step 4 | ❌→✓ Step 8 | |
| **pl-au-trade-voice** | | | | ✓ (copywriter) | ❌→✓ Step 4 strip | ⚠ (T4d wired · need rubric ref) | |
| **personas/*.js** (4 files) | | | | ✓ (copywriter · 1/4 used) | ❌→✓ Step 4 voice merge | ❌→✓ Step 8 critical_signals | |
| profitslocal-assemble-handoff | | | | | ⚠ V2 only · legacy fallback | | |
| profitslocal-audit-handoff | | | | | ✓ pre-build P1-P7 | | |
| template-lab | | | | ⚠ catalog | ⚠ (OD path · legacy) | | |
| website-copy-audit | | | | | | ⚠ (separate · not main audit) | |
| website-ui-audit | | | | | | ⚠ | |
| **pl-audit-rubric** | | | | | | ❌→✓ Step 8 (61 rule IDs) | |
| profitslocal-quality-audit | | | | | | ✓ pl:quality-audit | ✓ ship gate |
| site-audit | | | | | | ⚠ cold-outreach | |

**6 ORPHAN skills (all rooting in last 2 weeks · all Phase A or persona work)**:
1. pl-au-trade-voice (render-time strip + audit T4d wired but rubric link missing)
2. pl-audit-rubric (zero consumer)
3. pl-local-trade-page-spec (zero consumer)
4. personas/{urgent-repair, commercial-maintenance, guided-first-time-buyer}.js (3/4 unused)
5. selected.json image curation (composer uses stock-library/ not selected.json)
6. wireframe-home-<llm>.json (composer ignores · §3.3 contract violated)

---

## §5 · Phase B Execution Plan (6 steps · enforced)

Each step has: input gate · code work · output artifact · acceptance gate · estimated hours · status.

### Step 0 ✓ COMPLETE (commit `391a046c` + `5a4ce39c` + `723597ae`)
Parity checklist `docs/v3/PHASE3-PARITY-CHECKLIST.md` + editorial-newsletter template extract + composer v0 (Vicwest 89/A/SHIP · partial — orphans not wired yet).

### Step 4 (NEW · P0 · ~3 hr) · Wire ORPHANS into composer
- Input: existing pl-au-trade-voice.json · personas/*.js · wireframe-home-codex.json · selected.json
- Code:
  - compose-editorial reads `wireframes/wireframe-home-<llm>.json` if exists · uses as PRIMARY copy source (hero/services/about/why-us/reviews) · narrative fallback only for missing fields
  - apply pl-au-trade-voice banned-phrases strip on every copy source before insertion
  - read personas/<primary>.js voice_modifiers · annotate template-derived strings (proof chip ordering · CTA labels)
  - read selected.json best_placement map · prefer customer-extract images over stock-library/ for hero/about/gallery
  - emit `skills-usage-trace.json` (§3.5 schema)
- Output: re-rendered Vicwest editorial-output/index.html + skills-usage-trace.json
- **Acceptance gate** (codex R24 Q-EE-2):
  - audit composite ≥89 (same as Step 0 baseline)
  - T4d voice = 100 (0 banned phrases · no "quality workmanship")
  - skills-usage-trace.skills_consumed includes ALL 4: pl-au-trade-voice + personas + selected.json + wireframe
  - hero subhead matches wireframe-home-codex.json text (not composer fallback)
  - composer exits 4 if any of the 4 missing (orphan regression detector)

### Step 5 (batch progression · per-client gates · ~4 hr · codex R24 Q-EE-1 refinement)
Take a-j (YELLOW) · mark-squire (RED) · abc (RED) through stages they need.

Per-client gate sequence:
```
checkpoint != GREEN → 
  if YELLOW: pl:llm-infer-thin-data (existing CLI) · fill 3 fields → recheck
  if RED: pl:enrich-entity + pl:llm-extract-core + pl:summarize-external-mentions → recheck
  
checkpoint = GREEN → pl:validate-single-page-brief (must exist · regression-write if missing) → 
  pl:llm-page-copywriter --slug X --page home (wireframe generation · ~120s · ~$0.30/page) → 
  pl:compose-editorial → 
  pl:audit-v4 (gate composite ≥85 · T4d ≥90) → 
  pl:fixture-check (per-slug fixture under fixtures/e2e/<slug>/) [Phase A.1 Step 6 pattern]
  
Any gate fail = stop · do NOT proceed to next client.
```

Estimated per-client: YELLOW ~30min · RED ~90min (upstream enrich heavy).

### Step 6 · pl:audit-rubric wire-up into audit-v4 (~2 hr)
- audit-v4 reads pl-audit-rubric.json 61 rule IDs · map check IDs back to rules · emit `audit-v4-issues.json` with proper rubric refs
- New skills-usage-trace assertion: audit-rubric must be consumed

### Step 7 · pl-local-trade-page-spec wire-up into brief validator + audit (~2 hr)
- pl:validate-single-page-brief reads 11 section rules · validates brief covers them
- audit-v4 cross-checks rendered HTML against page-spec mandatory sections

### Step 8 · pl:site-report CLI (~3 hr)
- Reads audit-v4 + brief + checkpoint + selected.json + skills-usage-trace
- Output: 9-section HTML (per earlier Matthew design conversation)
- Surfaces orphan/placeholder/forbidden artifacts to outreach team

### Step 9 · V2 module library deprecation (~1 hr · codex R24 Q-EE-4 a)
- Tag `pl:compose-site` README as "legacy fallback for RED clients only"
- Update `pl:e2e` to prefer compose-editorial when checkpoint != RED
- Keep V2 code · do NOT delete

**Phase B total remaining: ~15 hr cross 2-3 days.** Step 4 is hard P0 gate before any others.

---

## §6 · Skills Usage Trace Schema (orphan regression detector · codex R24 Q-EE-6)

Every `pl:compose-editorial` run emits `skills-usage-trace.json`:

```json
{
  "schema_version": "skills-usage-trace/0.1",
  "slug": "vicwest-roofing",
  "generated_at": "2026-05-28T...",
  "skills_consumed": [
    {"name": "pl-au-trade-voice", "version": "1.0.0", "use_count": 3, "paths_used": ["banned_phrases", "us_spelling", "forbidden_niche_claims_roofing"]},
    {"name": "personas/planned-upgrade", "use_count": 2, "paths_used": ["voice_modifiers.tone", "trust_levers_top_3"]},
    {"name": "wireframe-home-codex", "use_count": 9, "paths_used": ["blocks.hero", "blocks.services", "blocks.about", ...]}
  ],
  "skills_orphan_in_this_render": [],
  "artifacts_read": ["brief.yaml", "checkpoint.json", "core-extract.json", "facts.json", "selected.json", "brand-tokens.css", "wireframe-home-codex.json", "template.html"],
  "provenance_breakdown": {"verified": 14, "ai-inferred": 3, "ai-placeholder": 0, "needed-client-supplied": 0, "forbidden_stripped": 1},
  "audit_score": 89,
  "audit_grade": "A",
  "ship_verdict": "SHIP"
}
```

**Hard rule**: any of the 4 P0 skills (pl-au-trade-voice + personas + selected.json + wireframe) missing → composer exits 4 with orphan-regression error. Prevents future "wireframe sat there 6 months ignored" scenario.

---

## §7 · Anti-Patterns (don't do)

1. **Build new artifact type** when existing serves (CLAUDE.md §7 5-look mandatory)
2. **Reference skill in docstring without `import`** (Phase A.1 Step 5 → Phase B Step 2 trap)
3. **Default fallback in renderer** that bypasses skill (composer's narrative fallback eating wireframe input)
4. **"Done" without skills-usage-trace assertion** (orphans = uncaught regression)
5. **Generalize before vicwest parity** (codex R23 EE-1 hard gate · still in force for Step 4)
6. **Brief.yaml + v2-spec.json dual write** (codex R19 Q-BB-2 b · brief is INPUT canonical · v2-spec deprecated post Step 4)

---

## §8 · Sign-off + Maintenance

- **Codex Rounds approved**: R10 (audience), R13 (4 personas), R15 (3-skill collapse), R16 (brief hybrid), R17 (gap report), R18 (Phase A.1 12hr cap), R19 (audit-bug pivot), R20 (sequencing + fixture scope), R21 (memo + 4 personas generic load), R22 (γ enrichment), R23 (template extract + parity), R24 (this PRD framework)
- **Matthew approvals**: scale-first override (R10), R-BA-6 draggable-slider hard rule, single-page focus, roofer-only niche scope (B), Phase 3 editorial = quality target
- **Next review**: when Step 4 completes (skills wired · vicwest re-rendered · parity gate re-passed)
- **Update policy**: every Step done · update §5 status + §4 matrix · NEVER add new step without codex round

This is the spine. Stop drifting.
