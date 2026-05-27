# Phase A Gap Report · vicwest stress-test · 2026-05-28

> **Phase A done definition** (Codex Round 10 Q-X-4 a): architecture is testable against vicwest + produces a gap report. Closing gaps is Phase A.1. Auto-composing single-page is Phase A.2.
> **Render artifact** (Codex R17 Q-Z-1 a): `templates/roofing/brand-grid-experiment/vicwest-roofing/editorial/preview.html` (Phase 3 hand-rendered · NOT auto-composed via pl:compose-site --single-page · that's Phase A.2)
> **Vicwest brief**: `clients/vicwest-roofing/v2/single-page-brief.yaml` · primary_segment=planned-upgrade · secondary=[urgent-repair] · urgency_mix=mixed
> **Validator + audits run**: pl-validate-single-page-brief · pl-audit-v4 fast · manual T5 deterministic gates · anti-slop regex catalog

---

## 1 · Tested cleanly (Phase A architecture verifies)

| Test | Result | Notes |
|---|---|---|
| Brief schema (23 properties) | ✓ PASS | 0 schema errors · 0 cross-field violations · 0 warnings |
| Cross-field state↔license.authority (VIC→VBA) | ✓ PASS | brief declares VBA · matches state=VIC |
| Cross-field primary_segment validity | ✓ PASS | planned-upgrade · not mixed-not-allowed |
| Cross-field secondary≠primary | ✓ PASS | [urgent-repair] ≠ planned-upgrade |
| Cross-field urgency_mix↔emergency_sla | ✓ PASS | mixed + 4hr SLA present |
| Cross-field first-buyer requires indicative_range | n/a | not primary=first-buyer |
| pl-audit-v4 T1 (deterministic mechanical) | ✓ PASS | 0 fails (1.11 logo refs · 1.13 JSON-LD valid · cross-content leak 0) |
| Anti-slop AS-trade-1 (business-name-only hero) | ✓ PASS | H1 = "A Ballarat roof, done properly — and signed off in writing" · not name-only |
| Anti-slop AS-trade-2 (your company for X city) | ✓ PASS | no SEO-stuff hero pattern detected |
| Anti-slop AS-trade-3 (above-your-head specialists) | ✓ PASS | absent |
| Anti-slop AS-trade-6 (operated by parent) | ✓ PASS | absent |
| Anti-slop AS-trade-7 (competitive prices) | ✓ PASS | absent |
| Anti-slop AS-trade-8 (generic CTA) | ✓ PASS | "Request a written quote" · not "Submit" or "Contact Us" |
| T5 deterministic gate · `completed_work_photos in hero` | ✓ PASS | hero figure has real Colorbond plate image |
| T5 deterministic gate · `expertise_named in fold` | ✓ PASS | "Colorbond replacements, terracotta restorations" in subhead |
| T5 deterministic gate · `credibility_stack` | ✓ PASS | VBA-licensed · CDB-U 65938 · 22+ years · 4.1★ trust band |
| H-seg-2 emergency chip (because urgency_mix=mixed) | ✓ PASS | "storm repairs" present in hero/subhead |

**Architecture is testable.** All gates that exist mechanically — including the new T5 deterministic per-segment + AS-trade anti-slop catalog — fire correctly against the hand-rendered Phase 3 artifact.

---

## 2 · Partial / known low scores (deltas worth closing in Phase A.1)

### 2.1 · pl-audit-v4 T2 brand contract: **34/100** Grade D

Source: `audit-v4-full.json` from Phase 3 spike (commit 0c4e009e).

| Dim | Score | Reason | Phase A.1 fix |
|---|---|---|---|
| D2.1 var(--brand-*) coverage | 27% | Hand-rendered HTML uses 22 brand-vars but also 18 hardcoded hex (`#0F1115` `#6D6E71` etc.) | When pl:compose-site --single-page lands (Phase A.2) it composes from brand-tokens.css → expected 80%+ var coverage |
| D2.2 hardcoded hex count | 15 unique non-gray | Same root cause as D2.1 · sub-agent inlined brand colors into style block | Same Phase A.2 fix |
| D2.3 type-rule compliance | null (skipped) | brand-spec.json lacks primary_font field for this client | Phase A.1 · enrich brand-spec.json with primary_font from extracted fonts |
| D2.4 logo variant per surface | null (TODO) | not yet implemented · "detect surface lightness around each <img logos/*>" | Phase A.1 · port detection logic from logo-extractor.js |

**Verdict**: 34/100 is a known architecture gap · not a quality failure of the hand-rendered artifact. The hand-rendered HTML is brand-correct visually but uses hardcoded hex copies of brand-tokens because the sub-agent that rendered it inlined values instead of `var()` references. **Real pl:compose-site --single-page (Phase A.2) reading from brand-tokens.css will fix this mechanically.**

### 2.2 · Phase 3 spike audit composite ~70-72 still stands

Earlier MVP audit (commit 4e65822d): T1 PASS · T2~78 brand voice · T3~70 visual · T4~50 (missing JSON-LD · partial SEO). Phase A.1 fixes:
- Add LocalBusiness JSON-LD `<head>` partial (T4 D4.5 0→100)
- ABN visible in footer of compose output (T1.4 already passes hand-rendered · gate compose-site)
- Wire brand-tokens var() coverage via real compose path

---

## 3 · Skipped (cannot run with current toolchain)

| Test | Why skipped | Required for |
|---|---|---|
| AS-trade-5 (form ≥5 fields above-fold) | regex insufficient · needs DOM parsing | Phase A.1 · cheerio or playwright |
| AS-trade-4 (lifestyle stock photo · guy-with-bucket) | needs vision LLM image analysis | Phase A.2 · pl-audit-vision wiring |
| Cross-page chrome consistency (D3.4) | single-page · not applicable | n/a |
| Audit issue fix-rate (D4.7) | requires audit-r1 history | Phase A.2 · re-run loop |

---

## 4 · Not-yet-testable (Phase A.2 work · TODO markers preserved in rubric)

| Tier | Dim | Reason | Owner of fix |
|---|---|---|---|
| T3 | D3.1 Vision LLM 10-dim | `pl-audit-vision` exists but isn't wired into rubric dispatch | pl-audit-rubric §7.2 → wire vision LLM dispatcher |
| T3 | D3.2 Hallmark 6-axis | hallmark skill not installed (external/skills doesn't have it) | install · Phase A.2 |
| T3 | D3.3 OD critique 5-dim | OD critique skill catalog-only (verified earlier · upstream installation pending) | external/skills upstream resolution |
| T5 | §7.2 vision LLM scoring | per-segment LLM prompt template defined in rubric · executor missing | pl-audit-vision multi-prompt mode |
| Brand contract | D2.BC1/BC2 | `core/audit/brand-contract.js` forward-pointer in rubric · file doesn't exist | create stub during Phase A.2 |

Per Codex R17 Q-Z-2 (a): **NOT substituting subjective scoring** for these · marked TODO Phase A.2 explicitly.

---

## 5 · Top 5 deltas to close (Phase A.1 priority)

Ordered by ratio of (audit impact) / (implementation effort):

1. **Wire `pl:compose-site --single-page` to v2-spec.single-page.json + brand-tokens snapshot** — closes D2.1 (var coverage 27→80+) + ABN-in-footer · ~3 hr · highest leverage
2. **Add LocalBusiness JSON-LD `<head>` partial to compose-site renderer** — closes T4.5 (0→100) · ~30 min
3. **DOM-parsing anti-slop checks** (cheerio · for AS-trade-5 form length) — closes AS-trade-5 gate · ~1 hr
4. **Wire content-validator extension** for AV-1..6 forbidden phrases from pl-au-trade-voice — closes voice-rule deterministic gate · ~1 hr
5. **Persona-overlay voice modifier merge in pl-llm-page-copywriter-site** — closes H-seg-1 voice match check · ~2 hr · enables LLM-gen path

Total Phase A.1: ~7-8 hr. After this: vicwest composite hits 73-78 estimate (T2 lift from brand-vars · T4 lift from JSON-LD).

---

## 6 · Architecture sign-off

Phase A delivered:
- v2.0 SOP with audience-first segments (4 buying-intent personas · jobs-to-be-done documented)
- 3 PL skills (page-spec · voice · audit-rubric) with build-artifact pattern (SKILL.md → JSON)
- Brief-schema validator (orthogonal to page-spec · input-shape only · 12 cross-field constraints)
- Pre-commit doctor 4 (skills:check) prevents SKILL.md ↔ JSON drift
- Niche-aware via personas/*.js + pl-au-trade-voice §Roofing addendum (extensible to plumber/electrician)

Phase A done definition met: **architecture is testable against vicwest + produces gap report**. ✓

**This commit is Phase A complete.** Phase A.1 (closing the 5 top deltas) and Phase A.2 (LLM tier wiring + auto-compose single-page) are forward work · scoped explicitly above.

---

## 7 · Honest assessments (from sub-agent reports across the build)

- **JSON Schema minimal-no-AJV validator** (Codex R17 audit note): full draft 2020-12 compliance partial · sufficient for current consumer set · upgrade to AJV when complex schemas land (e.g. multi-niche union types).
- **T3 vision tier currently mechanical-only**: D3.4-D3.9 work · D3.1-D3.3 stub until vision LLM dispatch.
- **T5 vision tier currently deterministic-only**: §7.1 gates work · §7.2 LLM scoring stub.
- **3-skill collapse** (codex R9 D3) holds clean · roofing addendum inline in voice · anti-slop inline in rubric · neither split prematurely. Phase B re-evaluation: if 3rd niche enters production · split voice to pl-trade-vocab-<niche>.
- **pl-au-trade-voice § Roofing addendum** (8-field niche interface contract) verified against codex R6 spec · clean.
- **`--no-verify` debt**: 5 commits used --no-verify (codex R14 Q-W-4 b) · unrelated SOP_1 ownership cleanup deferred to dedicated commit.

---

## Sidecar JSON (machine-readable)

Per Codex R17 Q-Z-3 (c): `docs/v3/PHASE-A-GAP-REPORT-2026-05-28.json` (parallel · same content · feeds future audit-fix-loop).
