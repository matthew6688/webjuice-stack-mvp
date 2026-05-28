# Path A · Open Design (OD) · Tested · Not Adopted · 2026-05-28

> **Status**: legacy / reference only · NOT primary path for ProfitsLocal website production.
> **Decision owner**: Matthew, codex Round 24, empirical evidence 2026-05-18 → 2026-05-20.
> **What this doc is**: institutional record so future agents know OD was tried, why we kept it, why it's not main path. Prevents re-litigating the same investigation.

---

## Summary

Open Design (OD · `/Users/matthew/Developer/open-design/`) is a Mac-daemon-based design rendering app. We ran 13 overnight variants across 4 phases (image strategy · taste skill · cross-client transfer · variance). **0/13 variants hit our ship threshold (audit composite ≥85)**. We kept the code · we don't use it as default path.

## What we tried

`/experiments/od-master-2026-05-20T01-56-51-270/` (final master run · 2hr 19min · ~$14)

| Phase | What we varied | Best vicwest composite | Cross-client (vip / west-coast) |
|---|---|---|---|
| A · Variance | Same input · 3 LLM seeds | 72 | — |
| B · Image strategy | I_mixed vs I_brand vs I_stock | 66 | — |
| C · Taste skill | web-prototype-taste-editorial recipe | 67 | — |
| D · Cross-client | Locked recipe applied to vip + west-coast | — | 51 · 56 |

Plus earlier dev sprints across 5 design recipes via `pl:od-run` and `pl:od-overnight`.

## Why we stopped using it as main path

| Failure mode | Evidence |
|---|---|
| Audit composite gap | OD vicwest best 72 vs Pure-prompt vicwest 89 = **−17 points (-19%)** |
| Brand fidelity gap | OD output uses generic palette (not brand-tokens injected) · D2.5 brand_palette_honored ≈ 0 vs Pure-prompt 100/100 |
| Cross-client collapse | OD locked recipe (vicwest 72) applied to vip → 51 · west-coast → 56 · **−16 to −21 point drop on transfer** |
| Mac daemon dependency | Required `/open-design/workspace.js` localhost daemon · not cloud-portable · breaks CI/CD |
| Cost | $14 / 2hr-overnight = ~$1.08/variant vs Pure-prompt $0.12/variant · **9× more expensive** |
| Time | 500–625s per variant + daemon overhead vs Pure-prompt ~180s · **3× slower** |
| Determinism | 3 same-input variance runs spanned 51–72 = **21-point spread** · not stable |
| Skill consumption | Skill catalog has 139 entries · most are upstream-only catalog stubs · actual rendering logic locked inside OD app · we can't extend |

## Why we kept the code

- `/core/open-design/workspace.js` + `pl:od-run` + `pl:od-overnight` + experiment scripts (~4 weeks of work)
- OD design-system catalog (139 skills) is still **useful as reference** when designing pure-prompt templates (we read OD recipes for inspiration · we just don't invoke OD daemon to render)
- If a future use case demands it (e.g. iterating 100s of variants on 1 client overnight for a high-value pitch deck) · we can re-enable

## Status

- **PRIMARY path**: Path C · pure-prompt + design-skill (proven on Phase 3 brand-grid · 3 clients · 89/87/81)
- **Path A · OD**: **DEPRECATED for main pipeline** · keep code · keep recipes · keep README · do NOT use as compose default
- **`pl:od-run` README**: should be updated to label "EXPERIMENTAL · legacy fallback only" (Phase B Step 9)
- **`pl:e2e`**: should NOT call OD by default (will be updated Phase B Step 9)

## Don't re-litigate without new evidence

If a future agent considers reactivating OD as main path · they must produce:
1. ≥3 vicwest renders that hit audit ≥85
2. ≥2 cross-client renders that hold ≥80 with same recipe
3. Cost ≤ pure-prompt path ($0.12/variant)
4. Cloud-portable OR explicit deployment plan for Mac-daemon dependency

Until then · this doc is the answer: OD was tested · OD was not the answer · move on.

## References

- `/docs/v3/PRD-PROFITSLOCAL-PIPELINE.md` (canonical pipeline doc)
- `/experiments/od-master-2026-05-20T01-56-51-270/` (final OD overnight run · raw data)
- `/docs/v3/PHASE3-PARITY-CHECKLIST.md` (pure-prompt quality bar)
- `/templates/roofing/brand-grid-experiment/{vicwest,mark-squire,a-j}/editorial/preview.html` (pure-prompt outputs)
- `/core/open-design/workspace.js` (OD daemon binding · kept · not called by default)
