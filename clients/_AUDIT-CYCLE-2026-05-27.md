# Audit cycle · 2026-05-27 · 3 customers

Command: `npm run pl:audit-handoff -- --dir clients/<slug>/v2/handoff/od-package`

## Snapshot

| Client | Verdict | Hard | Soft | Blocker(s) |
|---|---|---|---|---|
| vicwest-roofing | ✅ PASS | 0 | 1 | meta-language leakage in about/services/faq |
| vip-roofing-brisbane | ❌ FAIL | 1 | 2 | `content/services.json` is empty — scrape hit a parked domain ("Book Your Own Appointment Online" / "Gutter Replacement Cost Estimate" filler). Real data unavailable. Data-checkpoint should have caught this. |
| a-j-roofing-solutions | ❌ FAIL | 3 | 1 | brand pack never generated (missing `brand-spec.json`, `brand-tokens.css`, `agent-handoff.md`, `visual-style-contract.md`), image-manifest missing (`pl:classify-images` not run). Phone format fixed inline (`(07)40356187` → `(07) 4035 6187`, P6 now ✅). |

## Required next actions (upstream, LLM-cost-bearing — needs Matthew's go)

1. **vip**: re-run intake against the real business URL (not parked domain), or RED-gate and refuse. The current handoff cannot ship.
2. **a-j**: `npm run pl:classify-images -- --slug a-j-roofing-solutions` then brand-pack generator (find canonical CLI). After that, P2 and P3 should pass.
3. **vicwest**: scrub meta-language tokens (`verified:scraped`, `handoff`, `niche typical`) from `content/about.md`, `services.json`, `faq.json`. Soft failure only — does not block ship.

## Loop log

- iter 1 (2026-05-27 this turn): ran audit on all 3; fixed a-j phone format; saved this report.
- iter 2+: blocked on (a) Matthew approval to spend LLM on classify-images/brand-pack regen for a-j, (b) re-intake decision for vip.
