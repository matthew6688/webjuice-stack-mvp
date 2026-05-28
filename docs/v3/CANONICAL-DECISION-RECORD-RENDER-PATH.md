# Canonical Decision Record · Render Path · 2026-05-28

> **Status**: LOCKED · canonical · primary forward render path for ProfitsLocal websites.
> **Codex sign-off**: 8 rounds (R26-R33) · 33+ questions · ≥95% consensus.
> **Replaces**: implicit Path A (OD) + Path C (LLM whole-page) experimentation.
> **Audience**: every agent · every CLI · every future render decision.

---

## Decision

**Canonical render path = V1 · `pl:compose-editorial` (Path B · template + Mustache + skill-driven data injection).**

**Opt-in fallback** = V5 hybrid · `pl:compose-editorial --use-wireframe` (reads `clients/<slug>/v2/wireframes/wireframe-home-<llm>.json` as PRIMARY hero copy source · narrative fallback for missing fields).

**Deprecated** = Path A (OD app · `pl-od-run` · Mac daemon) and Path C (LLM whole-page · `pl:render-llm-page` · codex CLI fresh HTML).

---

## Empirical evidence

### 3-path A/B/C experiment · 2026-05-28 · vicwest editorial

Per codex Round 28 design rule (≥5pt lead = win · per-P0 hard gates · cost tiebreaker).

| Variant | Path | composite | M1 mobile | D2.14 proof | D2.BC6 tokens | T4d voice | $/render | variance |
|---|---|---|---|---|---|---|---|---|
| **V1 composer** | B (template+Mustache) | **91** | PASS | 100 | 90 | 90 | $0 | 0 (deterministic) |
| V3 LLM no-template (run1) | C pure | 91 | PASS | 83 | 19 | 100 fast / 20 premium leak | ~$0.30 | 11pt spread (run2: 80) |
| V3 LLM no-template (run2) | C pure | 80 | FAIL (1) | 67 | 17 | 100 fast / — | ~$0.30 | — |
| V4 LLM+template inspiration | C+template | 83 | FAIL (2) | 83 | 11 | 100 | ~$0.30 | unknown (N=1) |
| V5 hybrid (composer+wireframe) | B+wireframe | 91 (tied V1) | PASS | 100 | 90 | 90 | $0 | 0 |

### V3 premium audit (codex R32 follow-up) · reveals fast-tier voice 100 was MISLEADING

V3-test1 premium D2.10 engagement = 70 (SAME as V1). V3 D2.X leak-free = **20** (V1 = 100). V3's "fast-tier voice 100" was surface · premium D5 leak-free caught 5 leak quotes V1 doesn't have.

**Decisive lesson** (codex R33 Q-NN-6): fast-tier voice scores insufficient for production decisions · require premium leak-free validation.

### Cross-client smoke (codex R33 Q-NN-3) · 2026-05-28 · a-j-roofing-solutions

V1 composer transfers cleanly:
- vicwest: composite 91 (target ceiling)
- a-j: composite 83 (8pt drop · within tolerance · grade B · SHIP)
- a-j T4d voice 100 (cleaner narrative than vicwest) · M1 PASS · D2.14 100 · D2.BC6 90 · D2.4 logo 100

V1 = NOT overfit to vicwest. Generalizes.

---

## Why V1 won (codex R32 Q-MM-6 verdict)

1. **Composite + stability**: V1 91 / variance 0 (deterministic) · V3 mean 85.5 / 11pt spread · V4 83
2. **All P0 hard gates pass on V1** · V3 fails M1 mobile veto in 50% of runs · V4 fails M1 (2 vetos)
3. **Cost**: V1 $0 deterministic · V3/V4 ~$0.30 + 130-204s per render · at 50 sites/month = V1 $0 vs V3 $15
4. **CSS architecture preservation**: V1 D2.BC6 90 (deep token usage radius/shadow/space/motion) · V3 19 / V4 11 (LLM doesn't replicate template's deep CSS)
5. **Premium voice validation**: V3 leak-free 20 vs V1 100 · fast-tier voice scores misleading

---

## When to use V5 wireframe opt-in (--use-wireframe flag)

Use V5 ONLY when:
- Upstream narrative.about_us_draft is known-poor (LLM output has factual errors · banned phrases · weak tone)
- AND wireframe-home-<llm>.json exists for the client (Step 5 LLM copywriter has been run)
- AND audit of V1 render shows D2.10 engagement < 70 OR T4d voice violations from narrative-derived copy

Currently V5 tied V1 on vicwest · no audit signal recommends V5 over V1. Treat as informational fallback.

---

## Re-test triggers for archived paths

**Path C (`pl:render-llm-page`) could be reconsidered IF**:
1. New LLM model demonstrates ≥10pt average D2.10 engagement gain over current codex CLI in side-by-side audit
2. AND new model produces consistent ≥80 D2.BC6 token coverage (i.e. respects deep CSS architecture in generated HTML)
3. AND variance across 5 runs ≤3pt composite spread
4. Without all 3 · don't reactivate · Path B + skill-driven narrative is canonical

**Path A (OD) could be reconsidered IF**:
1. OD daemon becomes cloud-portable (no Mac dependency)
2. AND OD vicwest baseline ≥85 composite (currently 72)
3. AND cross-client recipe holds within ±5 pts (currently collapses 21 pts)
4. See `docs/v3/PATH-A-OD-TESTED-NOT-ADOPTED.md` for full record

---

## Composer canonical contract (V1)

`scripts/cli/pl-compose-editorial.js` is the primary render CLI:

**Inputs (SSOT chain per SOP-AUDIT-STANDARD-V2 §3)**:
1. `clients/<slug>/v2/single-page-brief.yaml` (canonical claims · validated upstream)
2. `clients/<slug>/v2/core-extract.json` `.brief.real_facts` + `.narrative`
3. `clients/<slug>/v2/handoff/od-package/facts.json` `.locked_facts`
4. `clients/<slug>/v2/handoff/od-package/brand/brand-tokens.css`
5. `clients/<slug>/v2/handoff/photos/selected.json` (vision-classified)
6. `core/audit/personas/<primary_segment>.js`
7. `skills/pl-au-trade-voice/pl-au-trade-voice.json` (banned phrases · voice rules)
8. `templates/roofing/editorial-newsletter/template.html` (canonical template)

**Optional V5 hybrid input**:
9. `clients/<slug>/v2/wireframes/wireframe-home-<llm>.json` (when `--use-wireframe` set)

**Output**:
- `clients/<slug>/v2/editorial-output/index.html`
- `clients/<slug>/v2/editorial-output/assets/{brand,stock}/`
- (Phase B Step 8 will add `skills-usage-trace.json` + `site-report.html`)

---

## Audit gates (SOP-AUDIT-STANDARD-V2 §3 · canonical)

Every V1 render must satisfy:
- T1 mechanical: PASS (all hard checks)
- T2 brand contract: ≥80
- T4d voice: ≥90
- D2.14 proof variety: ≥3 of 6 types AND score ≥60
- D2.11 facts cross-check (when brief.yaml exists): ≥90
- M1 mobile: PASS (all 3 mechanical vetos clear)
- Composite (fast-tier): ≥80
- Composite (premium-tier): ≥85 for ship gate

Vicwest baseline: 91 composite (GREEN). a-j baseline: 83 (YELLOW with placeholder reviews).

---

## Anti-patterns (don't do)

1. **Don't propose new render path** without 5-look discovery (CLAUDE.md §7) AND empirical evidence beating V1 by ≥5pts on calibration set
2. **Don't relax audit thresholds** to make new render path pass · move the renderer · not the gate
3. **Don't bypass `pl:compose-editorial`** for production renders · use opt-in flags only
4. **Don't treat V3/V4 archived outputs as production** · they're experimental evidence only
5. **Don't average fast-tier voice scores with premium leak-free scores** · SOP §5 tier separation

---

## Codex round transcript (audit trail)

| Round | Topic | Verdict |
|---|---|---|
| R26 | Audit standard v2 framework | 5 P0 primary · T1-T5 internal |
| R27 | Polish | Calibration sequence locked |
| R28 | Tactical lock | Composite weights · veto rules · hash schema |
| R29 | Fast-tier sanity calibration | PASS · audit discriminates Phase 3 > V2 > Live |
| R30 | Drop drift | Build only D2.10 · fix ABN+tap-target · 3-path experiment |
| R31 | Experiment kickoff | 4 variants · codex CLI only · lock inputs |
| R32 | Verdict | V1 composer winner · stop runs |
| R33 | Close + cross-client | V1 canonical · --use-wireframe opt-in · a-j cross-client PASS |

---

## Next steps (codex R33 Q-NN-4 (ii) · upstream voice fix)

1. **Strip banned phrases from `pl:rewrite-narrative`** · close V1 T4d 90→100 voice gap (~1hr)
2. **Phase B Step 5 batch progression**: 
   - a-j (YELLOW · DONE smoke test composite 83/B/SHIP)
   - mark-squire (RED · upstream enrichment first · ~1hr)
   - abc (RED · same · ~1hr)
3. **Phase B Step 6**: pl-audit-rubric wire-up into audit-v4 (61 rules · ~2hr)
4. **Phase B Step 7**: pl:site-report CLI (9-section provenance + audit + skills trace · ~3hr)

---

## Sign-off

This is the canonical decision. Don't re-litigate without new empirical evidence meeting the re-test trigger criteria above.

Last reviewed: 2026-05-28 · codex Rounds 26-33 · Matthew approvals throughout.
