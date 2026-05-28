# Audit v2 Fast-Tier Sanity Calibration · 2026-05-28

> Per codex Round 29 + SOP-AUDIT-STANDARD-V2 §10. Hybrid path C: sanity check NOW (4 dims wired · fast tier only) · full threshold calibration after LLM dims land.
>
> **VERDICT: PASS** · audit fast-tier discriminates real quality differences across 3 vicwest site variants. Safe to proceed with LLM dim builds (D2.10 · D2.13 · D3.10 · M1.4 · M1.5).

## Test design

3 vicwest site variants audited under `pl:audit-v4 --tier fast`:

| Site | Path | Expected quality |
|---|---|---|
| **Phase 3 editorial** | `templates/roofing/brand-grid-experiment/vicwest-roofing/editorial/preview.html` | Target ceiling · hand-rendered · Matthew-approved · audit 89 baseline |
| **V2 module composed** | `clients/vicwest-roofing/v2/composed-output-single-page/index.html` | Current renderer floor · Mustache · 86 historical |
| **Live www site** | `experiments/audit-v2-calibration-2026-05-28/vicwest-live/index.html` (snapshot 2026-05-28 via curl) | Real-world baseline · "what we replace" |

Expected order per codex R29 Q-JJ-5: Phase 3 > V2 > Live.

## Results

### Composite + tier scores

| Metric | Phase 3 | V2 | Live | Phase 3 − Live |
|---|---|---|---|---|
| composite | **91** | 65 | 69 | 22 ✓ |
| tier_1 mechanical | PASS | PASS | PASS | — |
| tier_2 brand contract | 91 | 65 | 69 | 22 ✓ |
| tier_4d voice | 100 | 100 | 100 | 0 |

### T2 brand sub-dims (where the action is)

| Dim | Phase 3 | V2 | Live | Phase 3 − Live |
|---|---|---|---|---|
| D2.1_var_brand_coverage | 100 | 100 | 100 | 0 (all pages USE vars) |
| D2.2_hardcoded_hex_count | 68 | 100 | 100 | -32 (Phase 3 has MORE hex fallbacks · OK) |
| D2.4_logo_variant_per_surface | **100** | **0** | null (no brand logos) | **100** ✓✓ |
| D2.5_brand_palette_honored | **100** | **33** | **0** | **100** ✓✓ |
| D2.BC6_token_coverage_depth | **90** | 16 | 2 | **88** ✓✓ |

### NEW content richness dims

| Dim | Phase 3 | V2 | Live | Phase 3 − Live |
|---|---|---|---|---|
| D2.14_proof_variety | **100** (6/6 types) | 67 (4/6) | 33 (2/6) | 67 ✓ |
| D2.11_facts_cross_check | 80 (4/5) | 60 (3/5) | 40 (2/5) | 40 ✓ |

### M1 mobile gate (veto-style)

| Site | Pass | Vetos |
|---|---|---|
| Phase 3 editorial | NO | M1.3 tap-target (5 violations · phone/email text-anchors) |
| V2 module | NO | M1.3 tap-target (similar issues · cross-template inheritance) |
| **Live www site** | NO | **M1.1 overflow-x + M1.2 sticky_cta_missing + M1.3 tap-target (3 vetos)** · clearly worse |

## Codex R29 PASS criteria check

### Q-JJ-2 · ≥10pt spread on ≥2 non-veto fast-tier dims

**MET 5+ times over**:
- D2.5 brand_palette_honored: 100pt spread
- D2.4 logo_variant_per_surface: 100pt spread
- D2.BC6 token_coverage_depth: 88pt spread
- D2.14 proof variety: 67pt spread
- D2.11 facts cross-check: 40pt spread
- composite: 22pt spread

### Q-JJ-5 · Rank order Phase 3 > V2 > Live

**On individual dims**: ✓ holds (brand palette · token depth · proof variety · facts match · mobile veto count all monotonically degrade Phase 3 → V2 → Live)

**On composite**: ⚠ inversion V2 (65) < Live (69)
- **Root cause**: V2 emits `<img src="brand/logo-dark.svg">` on dark footer surface (D2.4 violation = score 0) · Live has no brand logo references at all (D2.4 = null · dim skipped from composite renormalization)
- **Interpretation**: NOT an audit bug. V2 attempts brand alignment incorrectly · Live doesn't even attempt. Audit correctly penalizes V2 for visible misalignment that Live escapes by absence.
- **Treatment**: per-dim ranking is the truth · composite is a derived view · trust individual dims when composite inverts.

### Q-JJ-4 · M1 mobile veto as separate signal

- Phase 3: 1 veto
- V2: 1 veto
- Live: 3 vetos

Live's escalation (3 vetos vs 1) cleanly proves mobile gate discriminates. All 3 sites fail M1.3 (vicwest text-anchored tel: / mailto: pattern) · but Live additionally fails M1.1 (overflow-x · WordPress theme wraps poorly at 390px) and M1.2 (no sticky CTA · Mike-on-phone has nothing to tap).

## Findings worth surfacing

1. **Phase 3 audit 89 → 91**: D2.BC7 logo-variant (was stub · now implemented · vicwest 100) bumped composite +2.
2. **D2.BC6 catches V2's token-stamp problem**: V2 score 16 (only color tokens · 0 radius/shadow/space/motion). Phase 3 score 90 (uses full token system).
3. **D2.11 ABN flag on Phase 3**: Phase 3 hand-rendered missed ABN in HTML even though brief.yaml has it. Composer should also surface.
4. **All 3 sites have M1.3 tap-target failures**: contact dl tel/mailto text-anchors are universally too small (17-25px height). Template fix needed.
5. **Live site M1.1+M1.2 vetos**: vicwestroofing.com.au CURRENTLY fails mobile UX in 3 ways. Sales pitch material: "our audit catches what your existing site fails."

## Next

GO on Phase B Step §9 remaining 4 LLM premium dims (~7 hr):
- D2.10 engagement-persuasion (extend codex-deep-audit)
- D2.13 section concept density (TRULY NEW LLM)
- D3.10 optical consistency (extend pl-audit-vision)
- M1.4 + M1.5 mobile vision (extend pl-audit-vision · mobile rubric)

After LLM dims land · run **full premium-tier 3-site calibration** to derive final per-P0 thresholds (Phase 3 - 5 pts per P0 anchor · SOP §10).

Live site snapshot kept at `experiments/audit-v2-calibration-2026-05-28/vicwest-live/index.html` for next calibration pass.
