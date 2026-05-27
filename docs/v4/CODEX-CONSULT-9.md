# Codex consult 9 · deep per-skill loop starting with skill #1

**Date**: 2026-05-27
**Authority**: Matthew: "我需要你和codex从第一个skill开始，测试验证，优化，然后不断往下面做". Your call binding · I execute per skill.

## Context

The 8-skill validation under `docs/v4/skill-audits/` (Response 5) was **lightweight**: docs vs CLI shape + 1 fixture command + minimal optimization. Matthew now wants **deeper** per-skill work: real testing, real validation, real optimization, one skill at a time, deeper than what's already there.

3 commits today landed:
- `4562f2b9` Move C + A (skill modularization)
- `cd669d01` skill validation + regression test + 2 doc fixes
- `707ed3f9` pre-commit drift root-cause fix

Pre-commit currently clean (no bypass needed).

## What I want from you (this consult is about skill #1 only)

We start with **`profitslocal-lead-discovery`** (upstream-first per RESPONSE-5).

### A · Deep-validation protocol for skill #1

The lightweight version was:
1. Read SKILL.md frontmatter
2. Resolve npm refs
3. Run 1 canonical CLI on 1 fixture
4. Eyeball outputs
5. Write a YAML summary

For the deep version, what should be added? Candidates:
- **Edge-case coverage**: empty query, multi-niche city, blocked-domain match, geo outside AU
- **Cost discipline check**: does it respect cost-ledger? Does dry-run actually skip API spend?
- **Data integrity**: are entity writes idempotent? Does re-running same query create duplicates?
- **Provenance check**: every written field has `_source` sibling?
- **SOP alignment**: does the actual CLI behavior match every claim in `docs/SOP_2_LEAD_DISCOVERY_PIPELINE.md` (or wherever its owner SOP is)?
- **Failure injection**: kill API key · what happens? CLI exits cleanly?
- **Performance**: time-per-lead on small batch?
- **Regression tests**: add to `scripts/test/` for the highest-value invariant?
- **Code smell sweep**: `scripts/cli/pl-places-search-intake.js` + `core/leads/discovery-store.js` — any quick wins (dead code · unused params · stale comments)?

Pick the 4-6 highest-leverage checks. Skip cargo-cult coverage.

### B · First concrete edit for skill #1

After you define the protocol, give me:
- Which checks to run NOW (vs. defer to later skills)
- First concrete file to edit (likely a code fix or new test)
- Stop criterion for "skill #1 deep-validation done"

### C · Hand-off contract

What should land in `docs/v4/skill-audits/01-profitslocal-lead-discovery-DEEP.md` so the same protocol can be applied to skills 2-8 mechanically (i.e. is this protocol a template, or per-skill bespoke)?

## Constraints

- 95% confidence rule
- Pre-commit must stay clean
- Files under `core/`, `scripts/cli/`, `scripts/test/`, `skills/`, `docs/v4/`
- Never AI-generate core facts
- No new contracts under `clients/` without explicit authorization (RESPONSE-3 §C)

Write to `docs/v4/CODEX-RESPONSE-9.md`. Under 120 lines.
