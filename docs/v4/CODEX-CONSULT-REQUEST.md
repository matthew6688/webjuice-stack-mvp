# Codex consult · modularize the stable layers of V3

**Date**: 2026-05-27
**Asking on behalf of**: Matthew (sole operator)

## Business in one paragraph

ProfitsLocal finds local Australian businesses (currently roofers) on Google Maps that **either have no website OR have a low-quality website we can redesign**. We then use AI to (re)build the site for them. Two input branches:

- **No-website lead** → background research via Search (Tinyfish / DDG / Dokobot / Perplexity ladder) + Google Places + ABN/license registries to assemble facts.
- **Has-website lead** → all of the above PLUS crawl + audit the existing site to feed the redesign brief.

**Hard constraint**: core facts (business name, phone, address, license, service list, suburbs) must NEVER be wrong or invented. Provenance is tracked via `_source` sibling fields (decided 2026-05-17).

## What is stable today (modularize these)

1. **Discovery + scrape** — `pl:scrape-docker` (gosom Docker, free) → `data/leads/entities/*.json`
2. **Lead filtering / scoring** — 4-layer (contact hard gate → active-business hard gate → Type A/B/C/D opportunity → conversion soft score)
3. **Enrichment** — Places API, ABN, GBP photos, Tinyfish search-ladder, autoresearch — produces `core-extract.json` + `customer-brief.md` (≥3000 words)
4. **Data checkpoint gate** — GREEN/YELLOW/RED decides multi-page / single-page-preview / refuse
5. **Handoff assembly** — `pl:assemble-handoff` produces `handoff/od-package/` (facts.json, content/*, brand/*, structure/*)
6. **Handoff audit** — `pl:audit-handoff` 7 layers (P1 structural → P7 design-md)
7. **Post-build audit** — 4-tier standard (T1 binary zero-tolerance / T2-T4 0-100, composite ≥73 to ship)
8. **Master.md** — per-customer single source of truth; HTML/video/slides all derive from it

## What is NOT stable (PENDING — exclude from this modularization)

- The actual **website-build instruction layer** — i.e. converting a green handoff package into a 90+ scoring multi-page site reliably and in batch. Current state: vicwest 89, vip 0, a-j blocked. We have many CLIs (`pl:compose-site`, `pl:llm-site-architect`, `pl:iterate-site`, OD pipeline) but none of them stably produce ≥90 across customers. **Leave this layer as a stub in the modular plan**; don't propose it as a canonical skill yet.

## Inventory you should read first

These three docs are the source of truth for what exists today. **Read them before proposing anything.**

1. `docs/v4/INFRASTRUCTURE-MAP.md` (477 lines) — exhaustive file inventory across all `core/*` layers + 188 npm commands + 6 data-flow diagrams + known gaps section
2. `docs/V4_ARCHITECTURE.md` (339 lines) — earlier V4 draft, **biased toward lead-discovery only**, written before the inventory. Use it as evidence of what's been proposed but don't trust its scope.
3. `docs/CURRENT-STATE-2026-05-27.md` (206 lines) — onboarding brief for the next agent; SOP matrix, 4 orphan stages, 14 architecture rules

Also useful:
- `docs/SOP_OWNERSHIP_REGISTRY.md` — single-ownership rule per concept
- `docs/SOP_MAINTENANCE_RULES.md` — 5-question pre-write checklist + 3-doctor pre-commit
- `skills/profitslocal-data-checkpoint/SKILL.md` — example of the canonical skill shape we want

## What we want back from you

A concrete proposal (markdown, sectioned) covering:

### A · Modular skill list (stable layers only)

For each proposed skill, give:
- **Name** (matches `skills/profitslocal-<kebab>` convention)
- **Trigger** (what user/CLI input causes the LLM to invoke it)
- **Input contract** — file paths it reads (with schemaVersion if applicable)
- **Output contract** — file paths it writes + JSON schema sketch
- **Owner CLI** — which `npm run pl:*` it wraps
- **Upstream skill** (if any) and **Downstream skill** (if any)
- **Failure mode** — what verdict / exit code on bad input

Aim for **6–10 skills**, not 20. Merge anything that can be merged. Mark the website-build layer as `[PENDING — not a canonical skill yet]`.

### B · Retire list

From the orphan modules called out in `INFRASTRUCTURE-MAP.md §4`:
- `reference-adapter-handoff.js`
- 6+ audit modules with 0 importers (form-audit / pagespeed-insights / tech-stack-detector / third-party-weight / ai-geo-checks / activity-audit / domain-history / image-optimization)
- `design-header-footer-cta.js` + `exclusion-filter.js` (claim "canonical replacement" but unwired)
- Non-existent files referenced by `ENRICHMENT_ROUTING.md` (`core/llm/key-rotation.js`, `core/llm/perplexity.js`)

For each, recommend: **(a) wire it in / (b) delete it / (c) keep as future-stub with TODO**.

### C · Open architectural decisions you'd flag for Matthew

Specifically:
- Should `_source` sibling fields stay, or migrate to centralized `_meta.sources` map? (Currently decided: stay as siblings)
- Skill discoverability — how does the LLM know which skill to call? Slash-command, frontmatter `description`, or both?
- Where does audit→fix loop close? (Currently broken: compose doesn't read `issue-fix-matrix.json`)
- How does the modular plan accommodate the eventual website-build skill once it stabilizes?

### D · What you'd refuse to do without more info

Be explicit. Don't over-propose.

## Format

Write your response as markdown directly to `docs/v4/CODEX-RESPONSE.md` so we can iterate on it. Keep it under 800 lines. Use tables for the skill list. Cite specific file paths and line numbers when you reference existing code.

## Hard rules you must follow

- Never propose creating new files outside `core/`, `scripts/cli/`, `skills/`, or `docs/v4/` without flagging the deviation.
- Never propose AI-generating core facts (name/phone/address/license/services). Those come from real sources only.
- Don't redesign the cost ladder (T0 free → T1 subs → T2 metered → T3 premium). It's locked.
- Don't propose anything that violates single-ownership-per-concept.
