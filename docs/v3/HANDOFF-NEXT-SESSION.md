# HANDOFF · Next Session · ProfitsLocal · 2026-05-29 (after R70–R88)

## ▶ START HERE (first 5 minutes)
1. Read this file fully.
2. Read `docs/v3/INFRASTRUCTURE-INVENTORY.md` (look #0 · what exists · do NOT rebuild).
3. Read `docs/v3/CANONICAL.md` §0 (locked decisions) + §8 (re-test triggers).
4. **Governance (hard rule)**: every structural change → write a codex round first
   (`/tmp/codex-round-NN-<topic>.md` | `codex exec -`), get consensus, implement, submit diff
   for audit. After any structural change → update INFRASTRUCTURE-INVENTORY in the SAME commit.
5. LLM: claude CLI is authed (vision trustworthy). Local fallback = ollama (gemma3 vision /
   deepseek-r1 text). Cost rule for images: contact-sheet overview (local) → detail few (claude).

## STATE (one-liner per area)
- **Phase-1 audit→feedback→fix loop**: SEALED (`PHASE-1-SEAL.md` · codex R77). pl-compose-loop +
  compose-feedback + fact-guard (P0 red line). Audit SSOT = `SOP-AUDIT-STANDARD-V2.md`.
- **P2-0 data**: DONE. `pl:build-single-page-brief` (deterministic) · license entity→brief flow +
  confidence-gate (P0 false-match fixed) · `pl:geo-suburbs` (offline radius · geo_derived tier).
- **P2-1 provenance**: SOP + `pl:provenance-map` + `pl:provenance-annotate` (preview · live-off).
- **P2-1 images**: strategy `SOP-IMAGE-STRATEGY.md` (quality-gated mixed · usage_intent) ·
  `pl:image-decisions` (gate selector) · **render WIRED for vicwest** (Completed Projects grid ·
  real photos · no fake before/after · provenance verified). a-j/mark NOT done (no source photos).

## ⚠️ GOTCHAS (read before touching)
- **Repo has ~3131 uncommitted files** — pre-existing pipeline/data churn (mostly 05-28 · `data/`
  + generated client artifacts), NOT this session's. Do NOT bulk-commit. A clean-up (gitignore
  `data/` + generated artifacts, or commit a baseline) is **Task 0** below — do it deliberately.
- **Two image classifiers exist** (don't make a 3rd): A `core/handoff/classify-images.js` →
  selected.json (contact-sheet · $0.05 · coarse) · B `scripts/cli/pl-classify-images.js` →
  image-manifest.json (per-image · rich quality_score). codex R87: unify to image-manifest.json.
- **91/A on vicwest is FAST tier** (deterministic facts/mechanics only · vision n/a). It does NOT
  certify design or copy quality. Last real vision audit: 79/B claude · 57/REJECT local gemma
  ("generic copy, low-quality imagery"). Do NOT present current renders as good design.
- **a-j `handoff/photos/source/` is EMPTY** — no real photos to classify yet (needs website download).
- composer is Mustache; the simple engine **can't nest dotted sections** ({{#a.b}}{{#a.c}}) — use
  mutually-exclusive arrays instead (see gallery.projects/pairs).

## ✅ NEXT TASKS (ordered · codex-ratified · with commands + acceptance)

### Task 0 · Repo hygiene (independent · do first or defer deliberately)
Decide gitignore vs baseline-commit for `data/` + generated client artifacts (audit-v4-*,
editorial-output regen, _vision-audit, screenshots). Goal: `git status` shows only real source.
→ codex round first (it's structural). Acceptance: clean working tree or a documented ignore list.

### Task 1 · Two-pass cost image classifier (codex R87)
Rewrite `scripts/cli/pl-classify-images.js`: overview contact-sheet (gemma local · thumb 150px ·
bucket + shortlist ≤10 = hero3+gallery4+service2+about/team1) → detail (claude · long-edge 1600px ·
quality_score/brand_fit on shortlist only) → canonical `image-manifest.json`. Mark
`core/handoff/classify-images.js` legacy (merge its category/best_placement/contact_sheet).
Acceptance: one client classified with ≤1 overview call + ≤10 detail calls · manifest has rich fields.

### Task 2 · a-j / mark image backfill (zero Google quota)
`pl-extract-crawl-images` from their REAL website (filter `*.pages.dev`, `/screenshots/`,
`/evidence/` per codex R85) → Task-1 classify → `pl:image-decisions` → `pl:compose-editorial` →
`pl:provenance-map`. Acceptance: a-j/mark gallery shows real website photos OR stays honest stock
if no usable real images (no fakery). GBP photos (pl-places-enrich + pl-download-places-photos)
only if Matthew OKs Google Places quota.

### Task 3 · P2-2 service set fix (was Phase-1-blocked · D2.11 set_level_change)
a-j/mark services still have Chinese draft descs + unverified services (no backbone). Drop
unverified, surface verified from core-extract real_facts.service_list. Keep fact-guard.
Acceptance: provenance-map services → verified or honestly confirm; no Chinese drafts rendered.

### Task 4 · Design + copy QUALITY polish (the real "make it good" work · Phase-2/3)
This is what's actually missing for a sellable site. Run full-tier claude audit, read T3/hero/T4
findings, fix the editorial template's weak spots (text-heavy walls, generic hero copy, layout).
Wire copy skills into the loop. Acceptance: full-tier (claude) composite ≥80 with vision_confidence
ok · hero/T4 ≥ bar · honest before/after of screenshots.

### Task 5 · P2-1c client replace-checklist UI (after reviews/images produce real replace_required)
Human-facing preview overlay listing every replace_required + confirm item per section.

## TEST CLIENTS
- **vicwest-roofing** — richest · hand brief · GREEN · real images RENDERED (reference).
- **a-j-roofing-solutions** — QLD · geo suburbs · QBCC licence · NO source photos yet.
- **mark-squire-roof-restorations** — VIC · licence omit (ABN-only) · 18 verified suburbs · no photos.

## KEY CLIs THIS SESSION ADDED (all `npm run pl:<x>`)
build-single-page-brief · geo-suburbs · provenance-map · provenance-annotate · image-decisions.
Existing reused: license-lookup · license-csv-sync · classify-images · places-enrich · compose-editorial.
