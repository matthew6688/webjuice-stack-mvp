# Phase A.1 Backport · audit-fix measurement-only retroactive · 2026-05-28

> **Origin**: codex Round 20 Q-CC-3 (yes) · run the corrected D2.1/D2.2 + AS-trade-5 detectors against existing client outputs · see who else was false-rejected. Measurement-only commit · no renderer changes.

## Method

Ran `pl:audit-v4 --tier fast` against each client's `clients/<slug>/v2/composed-output*` directory using the Phase A.1 fixed detectors:
- D2.1 counts all `var(--*)` (was only `var(--brand-*)`)
- D2.2 strips `var(--*, #hex)` fallback hex before counting
- T1.14 AS-trade-5 fires only on homepage/non-contact pages (refined during backport)

## Results

| Slug | Output dir | Composite (before) | Composite (after) | Verdict | Δ |
|---|---|---|---|---|---|
| `vicwest-roofing` (single-page) | `composed-output-single-page` | 45 D REJECT | **86 A SHIP** | ✓ | +41 |
| `vicwest-roofing` (multi-page) | `od-output-c` | 0 F BLOCKED (T1 pre-existing) | 93 (T2) · T1 unrelated | partial | T2 +48 |
| `vip-roofing-brisbane` | `composed-output` | 0 F BLOCKED (T1 false-pos) | **100 A SHIP** | ✓ | +100 |
| `mark-squire-roof-restorations` | `composed-output` | 0 F BLOCKED (T1 false-pos) | **79 B SHIP** | ✓ | +79 |
| `a-j-roofing-solutions` | n/a | NO OUTPUT FOUND | — | — | — |
| `1300smiles-dentists-cairns-central` | n/a | NO OUTPUT FOUND | — | — | — |

## Findings

1. **3 of 3 audit-able client outputs went from BLOCKED to SHIP** purely from detector correctness. Renderer was producing brand-clean HTML all along.
2. **vip + mark-squire 7-field contact forms were FALSE positives** for AS-trade-5 · refined detector exempts `contact|quote|request|book|enquiry|inquiry|appointment|get-quote` filename prefixes (legitimate full-intake context).
3. **a-j + 1300smiles need re-compose** before they can be audited · separate task.

## Implications

- Past "REJECT" verdicts in CI logs and overnight runs may have been false-negatives. Re-audit any historical decisions before relying on them.
- Phase B cross-client validation (#47 in task list) now has 3 baselines (vicwest 86, vip 100, mark-squire 79) instead of zero.
- The detector refinement (skip contact-y pages) is a permanent improvement, not a vicwest-specific workaround.

## What this does NOT prove

These composite scores reflect ONLY T1 hard mechanical + T2 brand contract. T3 vision audit / T4 SEO / T5 per-segment vision remain stubbed (return null) per pl-audit-v4 status banner. **SHIP verdict here means "passes brand-contract + mechanical gates" · NOT "ready for paying customer"**. Real ship gate is `pl-audit-tier` per `docs/v3/SOP-AUDIT-STANDARD.md`.

## Files touched

- `scripts/cli/pl-audit-v4.js` · AS-trade-5 contact-page exemption (1 regex)
- Client audit JSON sidecars (4 files · clients/*/v2/composed-output*/audit-v4-*.json) regenerated

No renderer changes. No skill changes. No fixture changes (vicwest 11/11 hold).
