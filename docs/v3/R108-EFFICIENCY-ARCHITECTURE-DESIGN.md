# R108 · Efficiency Architecture — DESIGN (ratified by codex 2026-05-30 · NOT yet implemented)

> Status: **DESIGN-ONLY · awaiting Matthew green-light to implement.** codex ran this as a design round
> (it changes the pipeline's operating contract, so ratify before code). Origin: `/tmp/codex-round-108-...md`.

## 1 · Decision (codex 2026-05-30)
**Deterministic by default; LLM by exception.**
- **Default copy path = `core/handoff/copy-builders.js`** (deterministic, facts→templated prose, $0, no
  hallucination, instant). The composer already falls back to it when LLM copy is absent.
- **LLM generation (the R93 contract builders) = explicit OPT-IN** ("flagship"), used only when the caller
  asks or a product path needs exploratory/generative copy.
- **Audits deterministic-first**: the deterministic checks are the pass/fail authority; **LLM judge output
  is ADVISORY**, never a blocking source of truth.
- **Compatibility flag** keeps the current LLM-default available for ONE transition phase, then removed.

Why: the LLM is least reliable on the things that matter most (facts) and noisy on taste; it is slow +
costly at batch. The bake-off (R93) proved the fact-locked CONTRACT fixed copy, not the generation strategy
— so for batch, deterministic formula copy (built from the same locked facts) is good enough, and the LLM
becomes a per-flagship polish, not the per-client default.

## 2 · Default behaviour (explicit)
- **Default build path**: `pl:enrich-handoff` does NOT run B1/B2/B3 (the LLM copy builders) by default →
  the composer renders from `copy-builders` formula (reads `single-page-brief.yaml` locked facts +
  `core-extract` narrative). Hero/services/about all come from the formula.
- **Opt-in LLM generation**: `--copy-mode flagship` (CLI) / `COPY_MODE=flagship` (env) → runs B1/B2/B3 with
  the R93 fact-locked contract (and `aboutStyle:flagship`). Reserved for Matthew-reviewed flagship clients.
- **No-LLM fallback**: with deterministic-default, a missing/rate-limited LLM does NOT break the batch — the
  formula path needs no model. (Today's LLM-default fails to deepseek/qwen and can produce weak copy; that
  failure mode disappears.) The mandatory exception is **step ① `core-extract`** (LLM synthesis of messy
  scraped text → narrative) — see §3; with no LLM, a client without a prior core-extract cannot be built.
- **CI behaviour**: deterministic audits gate (pass/fail). LLM judges (persona, vision T3/T4) run advisory
  when a model is available, are skipped (non-blocking) otherwise. CI never fails solely on an LLM judge.

## 3 · Map of every LLM-dependent point + classification
> Scope: R108 is COPY-centric, but per codex it also rules on the OTHER model-backed enrich steps
> (B5 image-classify, E3/design, B7 fix-matrix) — see the §5 added product call. Default = suppress all
> nonessential model steps; `core-extract` (①) is the one mandatory LLM phase.

| Pipeline point | Today | R108 class |
|---|---|---|
| ① `core-extract` (redesign-brief-builder · messy multi-page scrape → facts + BACKGROUND narrative) | LLM | **LLM — UNAVOIDABLE** · one-time per client, not per-section. Can't rule-extract narrative from noise (Matthew). Keep. |
| Structured-fact extraction (name/phone/email/URL) + ABN/licence offline lookup | rules + registries | **deterministic** · keep |
| ④ `build-single-page-brief` (fact lock · ABN/licence/phone) | deterministic | **deterministic** · keep |
| ③ B1 services / B2 about / B3 hero (`extract-*.js` via `llm-cascade`) | LLM | **deterministic-DEFAULT** (`copy-builders`) · **LLM opt-in** (flagship). About formula reshapes ①'s narrative. |
| ⑤ `compose-editorial` render (Mustache + formula fallback) | deterministic | **deterministic** · keep (formula becomes the primary content source) |
| `pl-copy-audit` identity cross-check + density | deterministic | **deterministic GATE** · keep |
| `pl-copy-audit` generic/puffery passage judge | LLM | →**advisory** · R106 demoted LOW-sev; but HIGH/critical LLM findings + local-fallback `needs_human_review` can STILL flip the verdict today → R108 makes fully advisory |
| `pl-audit-v4` T1/T2/T4d/grid_balance/facts_cross_check/mobile | deterministic | **deterministic GATE** · keep |
| `pl-audit-v4` T3 vision / T4 designer / hero_judge / t2_copy_quality_llm | LLM | currently FEED composite/verdict in `full` tier (fast tier already excludes them) → R108 makes **advisory** (non-gating) |
| `pl-persona-copy-audit` (buyer-POV quality) | LLM | **advisory** (already · CLI-only) |
| ③ B5 image classification (vision LLM · `classify-images`) | LLM | **opt-in** (suppress by default; runs in flagship/media mode) |
| ③ E3 / `design_*` page-section design (`llm-cascade`) | LLM | **opt-in** (page-planning · not default) |
| ③ B7 fix-matrix LLM-fill (legacy · deprecated template family) | LLM | **opt-in / retire** (not in canonical editorial flow) |
| `--validate` gold-set (tier_a/identity/density deterministic; acceptable-pass uses judge) | mixed | gate metrics deterministic; **judge = advisory** |
| enrich-handoff → builder facts (thin entity facts) | n/a | **UNRESOLVED** — only matters for the LLM opt-in path; if flagship copy is used, pass rich facts (suburbs/services/licence) from brief/site-ctx. Deterministic formula already reads brief directly. |

## 4 · Implementation plan (small commits · codex-ordered · for Matthew to approve/green-light)
1. **`copyMode` resolution + run-summary labeling** — add `--copy-mode deterministic|flagship|llm-legacy`
   (+ `COPY_MODE` env) to `pl:enrich-handoff`; default = `deterministic`; print the resolved mode in the run summary.
2. **Deterministic SOURCE ISOLATION** (codex amendment) — NOT enough to just skip B1/B2/B3: the composer
   today PREFERS existing `handoff/od-package/content/{services.json,hero-copy.json,about.md}` if present, so
   STALE old LLM artifacts would silently win. In `deterministic` mode the composer must IGNORE prepared
   B-copy (use `copy-builders` sources only) OR honour a mode marker. Only `flagship`/`llm-legacy` use prepared LLM copy.
3. **Default task profile for `pl:enrich-handoff`** — define EXACTLY which steps run per mode, including the
   other model-backed steps: `deterministic` suppresses B1/B2/B3 (copy) + **B5 (image-classify) + E3/design +
   B7 (fix-matrix)**; keeps the non-LLM steps (B4 page-map, etc.). `core-extract` (①) stays mandatory LLM for
   new clients. `flagship` re-enables copy (+ optionally media/page-planning).
4. **Audit authority + schema labels + CI** — assert deterministic dims are the gate; LABEL every LLM judge
   output `advisory` in the report schema (persona + pl-audit-v4 T3/T4/hero_judge/t2_copy_llm + pl-copy-audit
   HIGH/critical LLM findings). No verdict flips on an LLM judge alone; LLM judge = non-blocking in CI.
5. **Calibration test** — deterministic compose path uses `copy-builders` sources (assert via
   `ctx-snapshot.json` _source tags) AND clears the gate: `pl:copy-audit` APPROVE + `pl:audit-v4` ≥ ship on
   vicwest/a-j/mark-squire.
6. **Docs + deprecation** — name the model in CANONICAL §0 ("deterministic-default, LLM-exception"); update
   INVENTORY; `llm-legacy` deprecation note (one transition phase, then remove).

## 5 · Matthew product calls (narrow — only these need his decision)
1. **Default for client-facing/demo workflows**: deterministic builders for ALL, or keep flagship-LLM as
   the default for demos (perceived quality)? — *codex rec: deterministic everywhere by default.*
2. **CI**: is it acceptable for LLM-judge failures to be NON-blocking when deterministic audits pass? —
   *codex rec: yes, LLM judge non-blocking.*
3. **Compat flag**: keep old LLM-default behind `--copy-mode llm-legacy` for a transition period, then
   remove? — *codex rec: yes, one phase only.*
4. **Scope of suppression**: does deterministic default suppress ONLY the copy LLMs (B1/B2/B3), or ALL
   nonessential model-backed enrich steps (B5 image-classify, E3/design, B7 fix-matrix)? — *codex rec:
   suppress all nonessential model steps by default; keep `core-extract` as the one mandatory LLM phase;
   make media/page-planning enrichment opt-in alongside flagship.*

## 6 · Out of scope / unresolved (deferred)
- enrich-handoff rich-facts wiring — only needed for the flagship LLM path; deterministic formula reads
  brief directly. Revisit after this lands.
- Whether `copy-builders` needs per-section quality lift to match flagship for the few sections where
  formula reads flat — measure with `pl:persona-copy-audit` after the default flip.

**Next**: Matthew green-lights (and answers §5) → implement §4 as small commits. No code until then.
