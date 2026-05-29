# SOP · Content Provenance (real vs AI) · ProfitsLocal · codex R83 · 2026-05-29

> **PURPOSE**: ONE canonical provenance vocabulary so every rendered piece of content can be
> classified real / derived / AI / placeholder — and the client knows exactly what to replace.
> This is Matthew's core requirement (真实素材 vs AI 生成 必须标清楚·供客户替换).
>
> **STATUS**: 1a (this SOP · canonical enum) + 1b (`pl-provenance-map` normalizer) BUILT.
> 1c (rendering layer) is CONTRACT-LOCKED here but NOT yet built (codex R83 #4).
>
> **WHY**: provenance was tracked in 4+ ad-hoc dialects (core-extract real_facts_sources,
> merge-inferred, services `[niche typical]`, brief REAL/AI_PLACEHOLDER, this-session
> official_registry/geo_derived). This SOP unifies them; do NOT invent a 5th dialect.

---

## §1 · Canonical tier ladder (truth level)

`verified > geo_derived > ai_inferred > ai_placeholder > stock_placeholder`

| tier | meaning | replace_policy |
|---|---|---|
| **verified** | sourced from a real signal about THIS business (GBP / their website / ABR / licence register / WHOIS / customer intake) | `none` |
| **geo_derived** | computed fact (suburb centroid within service radius) — real geography, not a service claim | `none` (copy must say "nearby / within radius", never "servicing X") |
| **ai_inferred** | LLM-suggested or niche-typical content, plausible but unconfirmed for this business | `confirm` |
| **ai_placeholder** | AI-generated stand-in that is NOT true (fabricated review/quote, filler) — must be swapped | `replace_required` |
| **stock_placeholder** | generic/stock image standing in for a real photo | `replace_required` |

`tier` = truth level. `source_kind` = WHERE it came from (a subtype, not a separate tier —
codex R83 #1: `official_registry` is `verified`+`source_kind:official_registry`, NOT its own tier).

## §2 · source_kind subtypes (the "where")

| source_kind | tier |
|---|---|
| `gbp` (Google Business Profile) | verified |
| `website_crawl` (their own site) | verified |
| `abn_register` (ABR) | verified |
| `official_registry` (VBA/QBCC/Fair Trading licence lookup · confirmed tier) | verified |
| `directory_mention` (tinyfish/external directory) | verified |
| `whois` · `wayback` | verified |
| `customer_intake` (master.md / customer-extract / customer_provided) | verified |
| `centroid_radius` (geo gazetteer) | geo_derived |
| `llm` · `llm_completed` (ai-inferred / ai-completed / ai-completed:ollama:model) | ai_inferred |
| `niche_template` (services `[niche typical]`) | ai_inferred |
| `llm_fabricated` (ai-fabricated testimonials) | ai_placeholder |
| `placeholder` (AI_PLACEHOLDER) | ai_placeholder |
| `stock` (STOCK_PLACEHOLDER) | stock_placeholder |

## §3 · Dialect → canonical mapping (normalizer table · what pl-provenance-map applies)

| raw_source (existing dialect) | tier | source_kind |
|---|---|---|
| `GBP` | verified | gbp |
| `website-crawl` | verified | website_crawl |
| `abn` | verified | abn_register |
| `official_registry` / license confidence=confirmed | verified | official_registry |
| `tinyfish-mention` | verified | directory_mention |
| `whois` / `wayback` | verified | whois / wayback |
| `master.md` / `master-md` / `customer-extract` / `customer_provided` | verified | customer_intake |
| `verified` / `REAL` | verified | unspecified |
| `geo_derived(...)` / `radius-inferred` | geo_derived | centroid_radius |
| `ai-inferred` / `ai-completed` / `ai-completed:ollama:*` | ai_inferred | llm |
| `[niche typical]` | ai_inferred | niche_template |
| `ai-fabricated` | ai_placeholder | llm_fabricated |
| `AI_PLACEHOLDER` | ai_placeholder | placeholder |
| `STOCK_PLACEHOLDER` | stock_placeholder | stock |
| (unknown / missing) | ai_inferred | unknown (conservative · `confirm`) |

## §4 · replace_policy (client action · codex R83)

- `none` — verified / geo_derived → keep (geo_derived: keep but radius-phrased)
- `confirm` — ai_inferred → client should confirm/adjust (plausible, not fabricated)
- `replace_required` — ai_placeholder / stock_placeholder → MUST swap with real content before launch

## §5 · Rendering contract (1c · CONTRACT-LOCKED · NOT yet built)

When 1c is built:
- **`data-provenance="<tier>"` + `data-replace="<policy>"`** attributes on rendered sections/elements (machine · audit + overlay).
- **Preview-only "replace checklist"** for the client: every `replace_required` + `confirm` item, grouped by section, "what to swap".
- **LIVE hard-off**: none of these markers/overlays render on the published (live) site. Preview/demo only.

## §6 · Writer check (CLAUDE.md §6)

- `pl-provenance-map` is a READER of existing `_source`/`source`/`_provenance` fields. It does
  NOT modify core-extract / brief / hero-copy / services / selected. SOLE writer of the new
  `clients/<slug>/v2/provenance-map.json`. Deterministic + repeatable.
- Upstream artifacts keep their native `_source` fields; this SOP normalizes at READ time.
  (Future: upstream writers SHOULD emit `{tier, source_kind}` natively — migration tracked
  in INFRASTRUCTURE-INVENTORY, but not required for 1b.)
