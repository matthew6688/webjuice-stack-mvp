# 3-Path Experiment Results · vicwest editorial · 2026-05-28

> **WINNER**: V1 · `pl:compose-editorial` (Path B · template + Mustache + skill data injection)
>
> **Decision**: codex Round 32 verdict 6/6 · close now · V5 hybrid + V3 premium audit follow up Round 33.

## Test design (codex Rounds 26-31)

- **Target**: vicwest-roofing (GREEN checkpoint · brand kit · facts · 3-site sanity calibration baseline)
- **Audit**: SOP-AUDIT-STANDARD-V2 fast tier (8 dims) · D2.10 premium tier validation
- **Decision rule** (codex R28 Q-II-5): ≥5pt lead = win · per-P0 hard gates mandatory · cost tiebreaker if <3pt

## Variants run

| Variant | Path | Runs | Cost/run | Method |
|---|---|---|---|---|
| V1 | Path B · `pl:compose-editorial` (template + Mustache) | 1 (deterministic) | $0 | already-built composer |
| V3 | Path C pure · `pl:render-llm-page --no-template` | 2 | ~$0.30 + 130-204s | codex CLI fresh HTML |
| V4 | Path C template · `pl:render-llm-page --template-inspiration editorial-newsletter` | 1 | ~$0.30 + 191s | codex CLI with template as reference |

V2 dropped (per codex R31 Q-LL-1 · identical to V1 in current state).
V5 (hybrid · use existing wireframe-home-codex.json) follow-up · Round 33.

## Empirical scores (fast-tier audit)

| Metric | V1 composer | V3 run1 | V3 run2 | V4 run1 |
|---|---|---|---|---|
| **composite** | **91** | 91 | 80 | 83 |
| T1 mechanical | PASS | PASS | PASS | PASS |
| T2 brand contract | 91 | 91 | 80 | 83 |
| T4d voice | 90 | **100** | **100** | **100** |
| M1 mobile | **PASS** | PASS | FAIL (1) | FAIL (2) |
| D2.14 proof variety | **100** | 83 | 67 | 83 |
| D2.11 facts cross-check | **100** | **100** | **100** | **100** |
| D2.BC6 token coverage | **90** | 19 | 17 | 11 |
| D2.4 logo variant | **100** | **100** | 50 | 50 |

V3 mean: 85.5 · V3 variance: 11pt spread (91 → 80) · V4 mean: 83.

## Why V1 won

### Composite + stability
- V1 91 · zero variance (deterministic)
- V3 mean 85.5 · 11pt spread · sometimes ships sometimes fails M1 veto
- V4 83 · fails M1 + D2.4

### Per-P0 hard gates
- V1 passes ALL P0 hard gates
- V3 fails M1 mobile in 50% of runs (veto = ship blocker)
- V4 fails M1 mobile + D2.4 logo

### Cost + speed
- V1 · $0 · ~2s deterministic
- V3/V4 · ~$0.30/render + 130-204s LLM call
- For 50 sites/month · V1 = $0/month · V3 = ~$15/month + 2.5hr LLM time

### CSS architecture preservation
**Key insight**: V1 wins on D2.BC6 token coverage (90 vs 11-19 for LLM variants). LLM whole-page render doesn't replicate template's deep CSS architecture (radius/shadow/space/motion tokens). Composer + Mustache preserves it natively.

### LLM advantage (voice cleanliness)
V3/V4 hit T4d voice 100 vs V1 90. LLM strips banned phrases ("quality workmanship") that come from upstream narrative data. Composer inherits the violation.

**Tradeoff**: V1 90 → V3 100 voice = +10pt voice gain · V1 90 → V3 19 BC6 = -71pt token gain. Voice fix is achievable upstream (clean enrichment narrative) · token depth gap is path-level architectural.

## Production implication

**`pl:compose-editorial` (V1) is the canonical render path for ProfitsLocal.** Path C (whole-page LLM) is not the answer · token-architecture preservation matters more than LLM voice cleanliness.

**Composer upstream fix** (P1): pl:llm-extract-core + pl:rewrite-narrative should strip banned phrases (e.g. "quality workmanship") from narrative.about_us_draft before composer reads. This closes the voice gap (90→100) without touching renderer.

**V5 hybrid follow-up** (Round 33): test composer reading wireframe-home-codex.json (LLM-generated persona-aware copy) as PRIMARY source vs current narrative.about_us_draft. May combine V1 structural strength + V3 voice cleanliness.

## Cost analysis · scale

| Path | Cost / site | 50 sites/month | 500 sites/month | Variance |
|---|---|---|---|---|
| V1 composer | $0 | $0 | $0 | 0 (deterministic) |
| V3 LLM pure | $0.30 | $15 | $150 | high (11pt spread) |
| V4 LLM+template | $0.30 | $15 | $150 | unknown (N=1) |
| V5 hybrid (proposed) | $0 (composer) + $0 (uses existing wireframe data · already paid) | $0 | $0 | TBD |

V1 + upstream voice fix dominates on cost AND quality.

## What this experiment proves

1. ✅ Template-based render (Mustache) preserves design-token architecture that LLM cannot replicate consistently
2. ✅ LLM voice cleanliness is a real (small) gain but offset by token-depth loss
3. ✅ LLM variance is significant (11pt spread in 2 runs) · production needs determinism
4. ✅ All 3 paths pass T1 mechanical · brand fidelity is path-dependent
5. ❌ V5 hybrid (composer + wireframe) untested · Round 33

## What this experiment does NOT prove

- Cross-client transfer (vicwest only · per codex R32 Q-MM-5 · need follow-up smoke)
- D2.10 engagement comparison (V1 only · V3/V4 premium audit pending Round 33)
- Mobile vision sub-scores (M1.4/M1.5 deferred per codex R30)
- LLM model variation (only codex CLI · Claude not tested · intentional · path-not-model focus)

## Phase B continues

**Phase B Step 4+ direction**: pl:compose-editorial is primary · expand with:
1. Upstream narrative voice cleanup (banned phrase strip in pl:rewrite-narrative)
2. V5 hybrid validation (Round 33)
3. Cross-client gate (a-j YELLOW → mark-squire RED) after V5
4. Template family expansion (editorial-portrait from mark-squire Phase 3) when 2nd client validates

V3/V4 retired to experiment archive. Path A (OD) already deprecated.

## Codex round transcript

R26: Audit standard framework · R27: polish · R28: tactical lock · R29: sanity calibration · R30: drop drift · R31: experiment kickoff · R32: VERDICT V1 winner.
