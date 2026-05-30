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
| ⑤ `compose-editorial` render (Mustache + formula fallback) | deterministic | **deterministic** · keep · renders the LLM-generated sections (B1/B2/B3); `copy-builders` formula is the FALLBACK only |
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
> Progress log appended 2026-05-30 (Rounds 109–112). Steps 1–6 DONE + codex-reviewed. Step 7 spec'd, pending stable cloud tiers.

### 🚀 Quick launch-enablers (do first)
1. ✅ **Correct this doc** to the reversed architecture (done).
2. ✅ **Rename the deterministic truth gate → `fact-verify`** — `core/audit/fact-verify.js` + `pl:fact-verify`.
   Committed 5e87f198. Round 110: license-number check changed from brittle exact-token-match to a
   CONTAINMENT model (rendered must contain the brief number; a different licence-shaped number still hard-
   fails; status phrases like "QBCC Licensed" are not number claims). Regression test `npm run test:fact-verify`.
3. ✅ **Internal launch scorecard** — `scripts/cli/pl-launch-scorecard.js` + `pl:launch-scorecard` (994e9304,
   hardened 480444ca). ONE operator gate: hard {fact-verify, density, mobile} · info {audit-v4} · advisory
   {persona-copy, performance} · verdict READY_FOR_SIGNOFF/HUMAN_REVIEW/HOLD + human-eyes list. Fail-closed
   (missing mobile_gate / refresh failure / missing audit JSON never read as pass).
4. ✅ **Run existing generation + audits, mark human-eyes (step 4).** 4 clients scored. Surfaced + fixed TWO
   bugs: (a) audit-v4 was auditing report artifacts (launch-scorecard.html / audit-v4-report.html) as client
   pages → false mobile veto + P0; fixed by ALLOWLIST page selection (index.html + published-pages.json).
   (b) fact-verify false positive on a-j (honest "QBCC 1161095") → containment fix above. Final step-4 state:
   vicwest HUMAN_REVIEW · mark-squire HUMAN_REVIEW · a-j HUMAN_REVIEW (after fix) · abc HOLD (no brief + real
   32×20px tap-target mobile veto). Recurring buyer gaps → fed into step 5: process/timeline, residential
   framing, verifiable specifics over praise, real review quotes.

### ⚙️ Steady layer (persona-aware generation · roofing only)
5. ✅ **Shared persona prompt block** — `core/handoff/persona-context.js` (0c17691b, fixes 10e257c0).
   `resolvePersona()` + `buildPersonaContextBlock()`. Buyer psychology only (JTBD, decision/bounce triggers,
   risk concerns, trust levers, information state, voice) + section lens + authority-ladder guard verbatim.
   Emits NO business facts. `time_to_decide`/`comparison_set_size`/`job_value` deliberately EXCLUDED (codex
   R111: invite fake urgency/price/quote-counts). Test `npm run test:persona-context` (29 pass).
6. ✅ **Inject persona into B1/B2/B3** (19a84e86) — block placed below each generator's highest-authority
   facts/source, above its OUTPUT CONTRACT; env-gated `PERSONA_CONTEXT=1`, DEFAULT OFF; R93 contract verbatim;
   `brief.primary_segment` threaded via `pl-enrich-handoff`. **Finding+fix**: the "process sequence" buyer-need
   fought the About contract's no-process-paragraph rule (weak model failed validation) → buyer-needs are now
   SECTION-SPECIFIC (process only in services; About/hero get residential-framing + verifiable-proof). After
   fix, persona-on B2 passes and beats baseline (0 "largest" boasts · residential-first · 122w · identity correct).
7. 🔨 **Compare baseline vs persona-aware** (`pl:compare-persona` · BUILT 2b7f434f · codex R113 fixes
   e6635116/31c76754). For each client+variant: regenerate B1/B2/B3 → **bridge content into od-package/content**
   → re-compose → audit the RENDERED index.html (fact-verify · density · word counts/section · identity
   fields · persona-copy). Backup/restore keeps the live client clean. `--rescore` re-audits snapshots cheaply.
   **codex R113 caught a P0**: composer renders from `handoff/od-package/content`, harness had only regenerated
   `handoff/content` → both variants rendered identical HTML, the "+3" was auditor noise. Fixed (bridge step) +
   guarded (rendered-md5 identity check → NEEDS_REVIEW if identical). Also: require valid baseline · buyer-
   critical no-regression (clarity_next_step/trust_levers/decision_enablement) · split
   `persona_context_candidate` vs `page_contract_clean`.
   **Verified on vicwest (single run · PROVISIONAL)**: md5 now DIFFERS (707d4dee vs e99a017d · content consumed) ·
   baseline persona 73 / persona 76 · both fv PASS · density PASS · 0 contract violations · CANDIDATE.
   ⏳ **REMAINING (deferred · codex R112/R113)**: the AUTHORITATIVE run = repeated paired runs across ≥2/3 of
   vicwest/a-j/mark-squire, mean delta ≥ +3, on the real cloud tier path (not the local fallback). Do NOT flip
   `PERSONA_CONTEXT` default-on from a single flaky-tier run. PERSONA_CONTEXT stays default-OFF until then.
   For each of vicwest/a-j/mark-squire, both variants: sandbox-copy the handoff dir → generate B1/B2/B3 into the
   sandbox only → **re-compose the full page → audit the RENDERED index.html** (fact-verify + density + copy-
   audit + persona-copy-audit). Intermediates preserved for debug but NOT the authoritative gate.
   Scorecard fields: `default_on_candidate` · exact failure reasons per client/section/variant · rendered word
   counts by section · identity fields detected (name/address/phone/ABN/licence) · persona delta by section +
   aggregate · contract violations (separate from soft copy notes) · promotion decision {block|needs_review|candidate}.
   **Default-on bar (high)**: fact-verify PASS · density PASS · no fabricated identity · no regression in
   required source facts · no per-section contract violations · no new cross-section repetition · persona score
   improves MEANINGFULLY (not noise). codex R112: do NOT promote default-on from a single run while cloud tiers
   are flaky — require a reproducible pass on the real intended tier path (not only the local qwen fallback).

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
