# HANDOFF → codex · Copy-quality + layout session · 2026-05-30

> Long session by the Claude agent. Latter half ran SOLO (Matthew put a 2-hour no-codex hold due to codex
> rate-limiting). codex now takes over. Everything below is **on branch `phase1-audit-detectors`, UNCOMMITTED**.
> Several changes need codex review/ratification (flagged ⚠️). Nothing here was committed.

## TL;DR (current verified state)
- **vicwest ships**: `pl:audit-v4 --tier fast` = **Composite 91 · Grade A · SHIP**; `pl:copy-audit --slug
  vicwest-roofing` = **APPROVE** (0 hardfails). About rewritten (790w wall → ~230w, real facts). Reviews 2×2.
- **Copy gate recalibrated + STABLE** (`--validate` 3/3 pass: tier_a 1.0 / identity 1.0 / density 1.0 /
  acceptable 8/8). Identity/licence + density are now DETERMINISTIC (no LLM-noise swings).
- **Two NEW audit capabilities built**: deterministic **grid-balance** (no lone-orphan rows) + persona-POV
  **copy-quality** judge (`pl:persona-copy-audit`).

## Session arc + codex rounds (consensus already obtained)
- **R99** bake-off design · **R102** results (contract>strategy; A/B/C/D/E ≈ once facts locked; E skill-stack
  net-negative) · **R103** vicwest=A-flagship, builder default=B-safe + `aboutStyle` flag.
- **R104→R107** the GATE recalibration (codex co-implemented in workspace-write):
  - R105 **demo-honesty policy** (Matthew): SOLE honesty hardfail = `fabricated_license_or_identity`;
    project counts / reviews / AI testimonials / puffery = ALLOWED demo placeholders (advisory).
  - R106 generic/puffery = advisory-only; verdict gated ONLY by fabricated-identity + density.
  - R107 **deterministic identity check**: rendered licence/ABN/phone/name/address cross-checked vs
    `single-page-brief.yaml` (match=never flag, mismatch=hardfail). Fixed both false-neg AND false-pos.
- **R108** (DRAFTED, NOT run — `/tmp/codex-round-108-efficiency-architecture.md`): "deterministic default
  (copy-builders), LLM exception (flagship); audit deterministic-first; LLM judge advisory." **Needs codex.**
- **R109** page architecture: fixed skeleton + DATA-driven conditional modules + AI writes content NOT
  architecture (OD-failure evidence). Action list: name model · `module-render-policy.json` (externalize
  thresholds) · reconcile suburbs ≥3-vs-≥5 drift · keep wireframe opt-in. **Not yet implemented.**
- **R110** sequencing + per-surface contracts (services short-card, drop $ ranges; hero H1 5-9w/sub 10-25w).
- **R100/R101** lead-pipeline selection (cost/speed tiers + license-in-initial-screen) — **OUTLINE ONLY,
  no code** (Matthew: decide then discuss). Outline: `/tmp/lead-selection-funnel-outline-DRAFT.md`.

## CODE CHANGES this session (review these)
**Copy gate** `scripts/cli/pl-copy-audit.js` + `skills/website-copy-audit/{SKILL.md,references/*}` — codex
  co-edited R105/R106; the Claude agent then added: low-severity copy findings → advisory (not verdict),
  and verified `--validate` 3/3 stable. *(codex already touched these; re-confirm.)*
**Builders** (route through `llm-cascade.js`):
  - `core/handoff/extract-about.js` — R93 fact-locked contract; `style` param `safe`(default)/`flagship`;
    rich factsBlock (services/suburbs/licence/radius); count-must-match guard; no-source-boast; no-generic-
    closer; demo-placeholder policy; 4-hour SLA moved out of About.
  - `core/handoff/extract-services.js` — `cost_of_delay` $ ranges → non-dollar consequences; `urgency_close`
    fake-scarcity → honest when-to-call; short_desc fact-locked; licence-as-source, no boast-echo. (R110)
  - `core/handoff/extract-hero-copy.js` — H1 5-9w, subhead 10-25w (was 8-14/18-32, blew the ≤25w density);
    relaxed forced business-name+number; identity sacred. (R110) ✅ smoke-verified 6-7w/18-19w.
**Cascade** `core/autoresearch/llm-cascade.js` — copy backups deepseek-r1:14b → **qwen3.6:27b** + `think:false`
  (the 2026-05-17 "qwen broken w/ format=json" was a thinking-mode bug; fixed + verified clean JSON). Added
  `eval_persona_copy` task.
**Grid balance** ⚠️NEW NEEDS-REVIEW:
  - `core/audit/grid-balance.js` (NEW) — deterministic: any item-grid with `items % cols == 1` (lone orphan)
    flagged; parses cols from page CSS; respects a center-last CSS safety rule (no false positives).
  - `scripts/cli/pl-audit-v4.js` — wired `grid_balance` as P1 dim.
  - `scripts/cli/pl-compose-editorial.js` — reviews + services adaptive columns (4→2×2, keep ALL real items,
    Matthew's "fluid layout, never fabricate/drop"); REMOVED magazine eyebrow "File No.·Journal·Vol." (old
    template residue, flagged by persona-copy-audit) → "City · State · {Auth}-licensed"; removed orphaned
    `toRoman`/`issueNo`/`volNo`.
  - `templates/roofing/editorial-newsletter/template.html` — `.reviews-grid--2col`, `.story-grid--2col`,
    center-last-orphan CSS safety net, `{{services.grid_modifier}}` / `{{reviews.grid_modifier}}`.
**Persona copy-quality audit** ⚠️NEW NEEDS-REVIEW:
  - `core/audit/persona-copy-judge.js` (NEW) — mirrors hero-judge; reads page copy, judges from the client's
    primary buyer persona (`core/audit/personas/*.js`) on 8 criteria (job_fit/decision_enablement/
    objection_handling/trust_levers/bounce_avoidance/information_level/voice_fit/clarity_next_step) → 0-100
    persona-fit + concrete gaps. Honesty-guarded (won't reward fabrication). ADVISORY (subjective → not a
    batch gate). ✅ verified vicwest 67-74/100, consistent, found the real "Journal·Vol." residue bug.
  - `scripts/cli/pl-persona-copy-audit.js` (NEW) + `package.json` script — N-run averaged CLI.

## VERIFIED (hard evidence)
- copy gate `--validate` 3/3 stable; vicwest `--slug` APPROVE; vicwest `pl:audit-v4 fast` 91/A/SHIP.
- grid-balance: synthetic 4/7-in-3col flagged, 5/6 pass, vicwest 0 orphans, reviews 2×2 (screenshot-checked).
- hero builder smoke: H1 6-7w, subhead 18-19w (compliant).
- persona-copy-audit: vicwest 70±3 → eyebrow fix → journal flag gone (audit→fix→re-audit loop works).

## OPEN / NEEDS CODEX
1. ⚠️ **Review the solo work**: grid-balance (module + audit wiring + composer/template adaptive layout);
   persona-copy-judge (module + CLI + rubric weights + whether to wire into pl-audit-v4 as a dim); the
   services/hero prompt hardening; the eyebrow change.
2. **R108 efficiency architecture** — never ratified. Decide: make `copy-builders` the DEFAULT (LLM=flagship
   opt-in), audit deterministic-first, LLM judge advisory? (`/tmp/codex-round-108-...md`)
3. **R109 action list** — `module-render-policy.json` (externalize render thresholds incl. the grid
   column rules + suburbs ≥3-vs-≥5 drift between composer/audit); name the architecture model in canonical.
4. **Lead pipeline (task 2)** — outline ready (`/tmp/lead-selection-funnel-outline-DRAFT.md`), Matthew to
   approve before any code. Key: only NEW primitive = `url-probe`; rest is reuse (cheapAuditV2 etc.) +
   license-in-initial-screen + shadow-calibrate thresholds.
5. **enrich-handoff → rich facts**: B2/B1/B3 get thin entity facts; for reproducible good copy on OTHER
   clients, pass suburbs/services/licence (from site-ctx/brief) into the builders.
6. **gallery** 4→2×2 composer modifier (currently CSS-net + audit-detection cover it).
7. **COMMIT** — everything uncommitted. Pre-commit hook blocked by pre-existing ace-roofing churn
   (`test-cycle26-three-report-consistency`); prior session used `-c core.hooksPath=/dev/null` / `--no-verify`.

## New tools
```
npm run pl:copy-audit -- --slug <slug>            # honesty/density gate (deterministic-first)
npm run pl:persona-copy-audit -- --slug <slug> [--runs 3] [--segment <id>]   # buyer-POV copy quality
npm run pl:audit-v4 -- --slug <slug> --tier fast  # design/brand + grid_balance + voice (batch gate)
```

---
## UPDATE 2026-05-30 (codex took over, reviewed, 5 fixes applied, COMMITTED)
codex reviewed the solo work and required 5 fixes (all applied + verified): reviews never-drop · grid
detector dedupe removed · persona score 0-10 clamp · hero/services prompt contradictions · cascade backup
scope (design tasks reverted to deepseek, qwen3.6 copy-only). Plus: excluded `index.preview-annotated.html`
from `pl-audit-v4` (deterministic, index.html first) — fixed the stale-preview false orphan.
Committed on `phase1-audit-detectors` (NOT pushed): `f1d49f89` (A render/grid) · `412fca59` (B copy builders
+ persona audit) · `8e5e4dac` (C gate recalibration). Verified green: vicwest 91/A/SHIP · grid 0 orphans ·
copy-audit APPROVE · --validate CALIBRATED 3/3 · persona-copy 73/100 YES.
**Next (codex direction): R109 — module-render-policy.json + reconcile suburbs ≥3-vs-≥5 drift. Hold push until done.**
