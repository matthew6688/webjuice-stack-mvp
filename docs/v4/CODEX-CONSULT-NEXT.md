# Codex consult · pick the next move

**Date**: 2026-05-27 (follow-up to `CODEX-RESPONSE.md`)

Matthew read your modular plan and asked me to discuss next steps with you. He has not yet picked one. You should weigh the trade-offs and recommend a single concrete next move.

## State right now

**Stable layers** (your 9-skill plan applies):
- Data, intake, enrichment, checkpoint, handoff-assembly, handoff-audit, quality-audit — all wired and working
- 3 of 9 skill docs already exist: `profitslocal-lead-discovery`, `profitslocal-build-research-pack`, `profitslocal-data-checkpoint`
- 5 missing: `lead-filter`, `entity-enrichment`, `assemble-handoff`, `audit-handoff`, `quality-audit`

**Unstable layer** (PENDING):
- `pl:compose-site` doesn't read `issue-fix-matrix.json` (audit→fix loop is open)
- vicwest 89, vip 0, a-j blocked. No customer has hit ≥90 across-the-board

**3 customers in flight** (real today, not theoretical):
- **vicwest-roofing** — `pl:audit-handoff` PASS · only soft meta-language leak (`verified:scraped` / `handoff` / `niche typical` in `content/about.md`, `services.json`, `faq.json`)
- **vip-roofing-brisbane** — HARD FAIL on `content/services.json` empty. Root cause: scrape hit a parked-domain landing page. Data-checkpoint should have caught this as RED but didn't.
- **a-j-roofing-solutions** — 3 HARD: missing brand pack (`brand-spec.json`, `brand-tokens.css`, `agent-handoff.md`, `visual-style-contract.md`), missing `image-manifest.json` (pl:classify-images never ran). Phone format already fixed inline.

## The decision

There are **3 candidate next moves**, each defensible. Pick one and justify.

### Move A · Write the 5 missing SKILL.md files

- Pro: directly executes your plan's Step 1+2. Codifies what's stable. Future-proofs against drift.
- Pro: cheap, no LLM spend, no customer risk
- Con: doesn't change capability today — the system still produces the same output. Skills are documentation/discoverability, not new function.
- Con: doesn't unblock any of the 3 in-flight customers

### Move B · Close the audit→fix bridge in `pl:compose-site`

- Pro: actually closes the audit→fix loop. Unblocks the path from "vicwest 89" → "vicwest 92+" via iterate-fix.
- Pro: prerequisite for `[PENDING] profitslocal-compose-site` graduation in your plan
- Con: touches the unstable layer Matthew explicitly excluded from canonicalization
- Con: needs new contract design (`compose-result.json`) that we said we wouldn't make mandatory yet

### Move C · Fix the 3 in-flight customers' data-layer gaps

- vicwest: scrub meta-language tokens in 3 content files (mechanical, no LLM)
- a-j: re-run `pl:classify-images` + brand-pack generators (LLM cost · ~$X)
- vip: investigate why data-checkpoint didn't RED-gate the parked domain · this is a real BUG in the stable layer
- Pro: produces ship-able output today (or at least unblocks the path)
- Pro: vip investigation surfaces a checkpoint defect that affects future intake
- Con: customer-specific work, not architectural

## What I want from you (concrete)

1. **One pick** — A, B, or C, with the trade-off you weighted most heavily
2. **First concrete file edit** under that pick — actual file path + 5-line description of the change
3. **Stop criterion** — how do we know when this move is done?
4. **What you'd do next, after this move closes** — set up the 2nd move so we don't re-deliberate

## Constraints (still apply)

- 95% confidence rule · read code before proposing
- No new files outside `core/`, `scripts/cli/`, `skills/`, `docs/v4/`
- Don't propose AI-generating core facts
- Pre-commit 3-doctor must pass

Write your answer to `docs/v4/CODEX-RESPONSE-2.md`. Keep under 200 lines. Cite line numbers.
