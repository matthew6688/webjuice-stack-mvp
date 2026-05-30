# R108 · Generation Architecture — DESIGN (REVISED by Matthew 2026-05-30 · in progress)

> Status: **architecture set by Matthew; implementing steadily with codex.** Earlier draft (deterministic-
> default, LLM opt-in) was REVERSED by Matthew's decision below — quality-first, LLM persona-aware generation
> is the DEFAULT. The deterministic formula becomes the fallback/safety-net. Facts stay deterministic.

## 1 · Decision (Matthew 2026-05-30 · overrides the earlier deterministic-default draft)
**LLM persona-aware generation is the DEFAULT main path; quality is invested UPFRONT.**
The default pipeline: ① LLM extracts client background from `master.md` → ② **LLM writes the copy WELL,
persona-aware (for the target buyer)** → ③ send to build the site. Writing good persona-aware copy upfront
means the audit has less to catch.
- **Default copy path = LLM generation** (`extract-about/services/hero` via cascade), persona-aware, under
  the R93 fact-locked contract. Local fallback = qwen3.6 (+think:false) — Matthew's every-LLM-call-has-a-
  local-fallback rule.
- **`core/handoff/copy-builders.js` (deterministic formula) = FALLBACK / safety-net** when the LLM is
  unavailable, never the default.
- **Facts stay DETERMINISTIC**: `single-page-brief.yaml` fact-lock + the deterministic identity/fact
  cross-check (being renamed `fact-verify` · zero-tolerance · the ship gate).
- **Audits**: `fact-verify` + density = deterministic GATE; copy-quality + persona = ADVISORY.

### Authority ladder (the safety guard · codex 2026-05-30)
```
single-page-brief.yaml locked facts  >  scraped source  >  persona psychology  >  copy style
```
Persona may shape emphasis / order / objections / vocabulary / CTA framing. It is **NOT a source of business
facts** — it may never invent claims, credentials, response times, warranty terms, prices, project counts,
team sizes, awards, locations, or licence facts. Fact violations fail deterministically (`fact-verify`).

## 2 · Default behaviour (explicit · REVISED)
- **Default build path = LLM persona-aware generation**: `pl:enrich-handoff` runs B1/B2/B3 (services/about/
  hero) via the cascade, persona-aware, under the R93 fact-locked contract. This is the main path.
- **Local fallback**: cascade claude → codex → **qwen3.6 (+think:false)**. Every LLM call keeps the local
  fallback (Matthew hard rule).
- **Deterministic formula = safety-net**: `copy-builders` renders only when the LLM path is unavailable/
  fails for a section. Never the default.
- **Facts deterministic**: `single-page-brief.yaml` lock + `fact-verify` cross-check — the LLM phrases
  around locked facts, never owns them (authority ladder §1).
- **CI behaviour**: `fact-verify` + density = deterministic GATE. LLM judges (persona, vision T3/T4) =
  advisory, non-blocking (skipped if no model). CI never fails solely on an LLM judge.

## 3 · Map of every LLM-dependent point + classification
> Scope: R108 is COPY-centric, but per codex it also rules on the OTHER model-backed enrich steps
> (B5 image-classify, E3/design, B7 fix-matrix) — see the §5 added product call. Default = suppress all
> nonessential model steps; `core-extract` (①) is the one mandatory LLM phase.

| Pipeline point | Today | R108 class |
|---|---|---|
| ① `core-extract` (redesign-brief-builder · messy multi-page scrape → facts + BACKGROUND narrative) | LLM | **LLM — UNAVOIDABLE** · one-time per client, not per-section. Can't rule-extract narrative from noise (Matthew). Keep. |
| Structured-fact extraction (name/phone/email/URL) + ABN/licence offline lookup | rules + registries | **deterministic** · keep |
| ④ `build-single-page-brief` (fact lock · ABN/licence/phone) | deterministic | **deterministic** · keep |
| ③ B1 services / B2 about / B3 hero (`extract-*.js` via `llm-cascade`) | LLM | **LLM persona-aware DEFAULT** (under R93 fact-lock contract) · `copy-builders` formula = fallback only |
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

## 4 · Implementation plan (codex 2026-05-30 · launch-sequenced · STEADY)

### 🚀 Quick launch-enablers (do first)
1. **Correct this doc** to the reversed architecture (done).
2. **Rename the deterministic truth gate → `fact-verify`** — extract the identity/fact cross-check out of
   "copy-audit" branding into a `fact-verify` concept (`core/audit/fact-verify.js` + `pl:fact-verify`),
   keep backward-compatible script aliases for launch. Gate report: `fact_verify: pass|fail`,
   `density: pass|fail`, `copy_quality: advisory`.
3. **Internal launch scorecard** — extend `core/reports/internal-audit-html.js` / `audit-v4` summary with ONE
   launch panel: fact-verify · density · mobile · performance · persona-copy (advisory) · human-eyes-needed.
4. **Run existing generation + audits, mark human-eyes items.**

### ⚙️ Steady layer (persona-aware generation · roofing only)
5. **Shared persona prompt block** — new `core/handoff/persona-context.js`: loads primary segment from
   `core/audit/personas/index.js` (roofing default: primary `planned-upgrade`, secondary `urgent-repair`).
   Block includes ONLY buyer psychology: persona id/name · job-to-be-done · decision triggers · risk
   concerns/objections · top trust levers · bounce triggers/forbidden signals · information state · voice.
   Plus the explicit guard: *"Persona context is buyer psychology only. It may shape emphasis, order,
   objections, vocabulary, CTA framing. It is NOT a source of business facts — do not create claims,
   credentials, response times, warranty terms, prices, project counts, team sizes, awards, locations, or
   licence facts from persona data."*
6. **Inject persona into B1/B2/B3** — block placed BELOW the locked facts, ABOVE the task, explicit LOWER
   authority than `single-page-brief.yaml`. B1 services: write to the buyer's pain/objections/trust levers.
   B2 about: answer "why would THIS buyer trust this business?". B3 hero: angle from primary JTBD + bounce
   triggers. Keep the R93 locked-fact contract verbatim.
7. **Compare baseline vs persona-aware** on vicwest/a-j/mark-squire; require: fact-verify pass · density pass
   · no fabricated identity · persona score IMPROVES vs baseline (advisory). Promote to default once the
   deterministic gate still passes.

### 🔭 Deeper (after launch)
8. Wire `persona_copy_quality` into `pl:audit-v4` as advisory (in reports; never flips ship verdict).
9. Multi-persona weighting — primary scores; secondaries = "don't alienate" check (roofing: planned-upgrade
   primary / urgent-repair secondary).
10. Broader non-roofing persona/niche defaults (persona = segment data, trust-signals = niche data · orthogonal).

## 5 · Matthew product decisions — RESOLVED 2026-05-30
- Default = **LLM persona-aware generation** (not deterministic). ✅ Matthew decided.
- LLM judge non-blocking in CI · deterministic fact-verify + density = gate. ✅
- Quality invested UPFRONT (persona-aware writing) so audit pressure drops. ✅

## 6 · Main risk + guard
**Risk**: persona-aware generation over-tailors → invented urgency, fake guarantees, unsupported proof, or
overwrought pain language. **Guard**: the authority ladder (§1) + deterministic `fact-verify` fails on any
fact violation. Persona improves persuasion; it never gets permission to invent business truth.
