# SPEC · Technical / SEO / Performance / GEO Audit · `pl-audit-tech` (BACKLOG)

> **Status**: BACKLOG SPEC (codex R74 · 2026-05-29) · not yet implemented.
> **Owner**: Matthew · **Canonical standard**: `docs/v3/SOP-AUDIT-STANDARD-V2.md` (§0 marks
> raw performance / SEO / AI-GEO as **P1 deferred** — out of the 5-P0 quality gate).
> **Relationship to `pl-audit-v4`**: SEPARATE CLI. Does NOT merge into `pl-audit-v4` and does
> NOT contribute to the Phase-1 composite/ship gate. Keeps the quality/aesthetic gate and the
> publish-technical-health check cleanly apart (avoids re-introducing the "T4 three-meanings"
> tier-name collision).

---

## Why separate

`pl-audit-v4` answers *"is this site good quality (correct · persuasive · on-brand · consistent)?"*
`pl-audit-tech` answers *"is this site technically healthy to publish and rankable?"* — speed,
structured data, crawlability, GEO/AI-answer readiness. Different question, different cadence
(runs **post-render / pre-publish & post-publish**), different consumers (ops/SEO, not the
editorial loop). Mixing them would let a slow-but-correct site block on aesthetics, or a
pretty-but-broken-schema site ship.

## Scope — dimensions

| Code | Dimension | Source | Severity tier |
|---|---|---|---|
| TECH.perf.lcp | LCP < 2.5s (mobile) | Lighthouse / PageSpeed API | **advisory** |
| TECH.perf.cls | CLS < 0.1 | Lighthouse | **advisory** |
| TECH.perf.score | PageSpeed mobile ≥ 85 | Lighthouse | **advisory** |
| TECH.schema.valid | JSON-LD parses + LocalBusiness subtype matches niche | deterministic parse + schema validate | **BLOCKER** (invalid JSON-LD) |
| TECH.schema.nap | schema NAP == site NAP == GBP | deterministic cross-check | advisory |
| TECH.img.format | images served AVIF/WebP | deterministic (file/headers) | advisory |
| TECH.img.alt | every content `<img>` has non-empty alt | deterministic | advisory (alt) · BLOCKER if 0 alt site-wide |
| TECH.crawl.robots | robots.txt present + not blocking | deterministic | advisory |
| TECH.crawl.sitemap | sitemap.xml present + valid | deterministic | advisory |
| TECH.meta.og | OG + Twitter card tags present | deterministic | advisory |
| TECH.links.http | 0 outbound 4xx/5xx · 0 broken critical assets | fetch/cache | **BLOCKER** |
| TECH.gbp.consistency | site NAP/hours/services == Google Business Profile | GBP data + deterministic | advisory |
| TECH.geo.readiness | AI-answer readiness: clear entity, Q&A blocks, fact density, citable claims | deterministic + optional LLM | advisory |

## Blocker vs advisory (hard rule)

Only **"broken-site"** problems flow back as publish blockers:
- 4xx/5xx outbound links · broken critical assets (logo/hero/CSS 404)
- invalid / unparseable JSON-LD
- zero alt text site-wide

Everything else (LCP/CLS/PageSpeed score/SEO meta/GEO readiness) is **advisory** — reported in
`audit-tech-report.json`, surfaced to ops, but does NOT gate Phase-1 ship. These become a
tunable gate only after calibration on real shipped sites.

## CLI contract (proposed)

```
node scripts/cli/pl-audit-tech.js --slug <slug> [--url <live-url>] [--json]
  # static mode (default): audit the rendered editorial-output HTML + assets
  # --url: also run live Lighthouse + GBP cross-check against the published URL
```

Outputs (one writer · no overlap with pl-audit-v4 files):
- `clients/<slug>/v2/editorial-output/audit-tech-report.json`  (full · advisory + blocker)
- `clients/<slug>/v2/editorial-output/audit-tech-blockers.json` (machine · only publish blockers)

## SSOT / writer check (CLAUDE.md §6)

- New writer: `audit-tech-*.json` only. Does NOT write any `audit-v4-*` file.
- Reads: rendered HTML/assets (writer = composer), GBP data (writer = enrichment), live URL.
- No new copy of facts — cross-checks against existing `core-extract.json` / `single-page-brief.yaml`.

## Build order (when scheduled)

1. Deterministic-only first (schema validate · links · alt · robots/sitemap · OG · img format) — $0, no external API.
2. Lighthouse/PageSpeed (needs API key or local lighthouse) — advisory.
3. GBP consistency (needs GBP data wiring).
4. GEO readiness (deterministic heuristics first · LLM optional later).

Phase-1 stays copy/design quality only. This is a post-launch tranche per Matthew's
original framing ("上线后另一套 audit 进 to-do").
