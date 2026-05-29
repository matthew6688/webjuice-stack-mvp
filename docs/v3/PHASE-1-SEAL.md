# Phase-1 SEAL · audit → feedback → fix loop

> **Verdict (codex R77 · 2026-05-29): Phase-1 PASS · connected copy-only · scoped blocks.**
> Note: `D3.7` deferred to a Phase-2 layout lever — NOT an unresolved copy defect.

Canonical standard: `docs/v3/SOP-AUDIT-STANDARD-V2.md`. Loop: `scripts/cli/pl-compose-loop.js`.
Feedback mapping: `core/audit/compose-feedback.js`. Sign-off chain: codex R70→R77.

## What "Phase-1" delivered

An audit → executable-feedback → auto-fix → re-audit → regression-rollback loop that
repairs a built site's **copy/facts** safely, with the P0 red line (core info 100% correct)
enforced deterministically, not by prompt hope.

- `pl-audit-v4` produces issues + `compose_feedback` routed to the TRUE upstream writer
  (never the derived `site-ctx.json`).
- `pl-compose-loop` (dry-run default · `--write` applies): backup → apply → recompose →
  re-audit (fast/$0) → resolution + regression check → rollback on regression.
- **fact-guard**: any number / brand / geo / licence / warranty in rewritten copy must
  resolve to the verified corpus, else rejected. Caught "regional Victoria" over-broad geo.
- Vision tiers degrade-aware: local fallback → `vision_confidence:low` → cannot alone SHIP.

## GATE-C result (claude vision · R75 layered run)

Judgment = fast tier (R71 metrics). Full tier = vision observation only.

**Connected-resolved (codex R76: exclude unwired + Phase-2-blocked from denominator):**

| client | connected resolved | rollback | copy_provider_fallback | P0 |
|---|---|---|---|---|
| vicwest | **3/3** (ABN · mech-H-2 · D3.7→P2) clean claude | none | no | 1→0 |
| a-j | C-H-7 ✓ (service-set lacks backbone → Phase-2) | none | no | — |
| mark | C-H-7 ✓ (service-set lacks backbone → Phase-2) | none | no | — |

- **a-j full-tier −2 / T3 69**: rerun confirmed **visual variance** (composite 74, T3 84, SHIP) — not real damage.
- **vicwest D3.7**: copy shortened CTA 1035px → 911px; residual 11px over the 900px fold is
  **marginal → P2 `layout_lever_needed`** (cta_y=911, fold=900, delta=11, subhead at 14w min).
  A layout lever (headline size / hero spacing), not a copy edit — Phase-2.

## Scoped blocks deferred to Phase-2 (NOT Phase-1 failures)

| item | reason |
|---|---|
| `D2.9b_instruction_leak` | source_unlocated — rendered About leak not in the render-read writer; needs trace |
| `D2.11_service_accuracy` | set_level_change — drop/surface/reorder services (≈ add/remove block) |
| `D2.13` service cards w/o verified backbone | only verified `service_list` items filled (no fabrication) |
| `unresolved_placeholder` / facts→core-extract ABN / `AV-4` | appliers not yet wired (P2-0) |
| `D3.7` marginal | layout lever, not copy |

## Phase-2 order (codex R76 #5 / R77 #4)

1. **P2-0 · applier completion**: wire `core-ABN` / `unresolved_placeholder` / `AV-4`
   appliers (or explicit block contract). Service-set: keep filling verified backbone only.
2. **P2-1 · real-vs-AI label system**: `real / AI-generated / unknown / client-provided`
   provenance fields + render markers + fact-guard linkage. (Matthew's core ask.)
3. **P2-2 · service/about set expansion**: once backbone is sufficient.
