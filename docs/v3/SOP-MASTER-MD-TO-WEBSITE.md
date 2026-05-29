# SOP · master.md → Website Content Pipeline (Layer 2)

> 2026-05-29 · Matthew sign-off ("这个很清楚 · 记下来")
> Companion to `SOP-MASTER-MD-DATA-LINEAGE.md` (Layer 1: how master.md is produced) and
> `INFRASTRUCTURE-INVENTORY.md` §6 (per-client artifact table).
>
> **What this answers**: "Do we have an SOP that extracts website-building content from master.md,
> and what is the current flow?" YES — this doc maps it end to end.

---

## Two layers

### Layer 1 · data + old-site audit → master.md   (see SOP-MASTER-MD-DATA-LINEAGE.md)
```
Stage 1 抓客户 (GBP/scraper)        → entity (name/phone/rating/review_count/website…)
Stage 2 排除筛选                     → entity.exclusion_filter
Stage 3 审老网站 (Playwright·12-dim) → detailed_audit
Stage 4 视觉审计 (Vision LLM)        → visual_audit
Stage 5 打分定级                     → entity.grade (A/B/C/D + tier + pricing)
Stage 6 → master.md                 ← internal audit report / rich narrative research doc
```
`master.md` = **Stage 6 output**. It is the research/narrative source of truth, fusing Stage 1-4 data.

### Layer 2 · master.md → website content → rendered site   (THIS doc)
```
① core-extract.json          core/audit/redesign-brief-builder.js (buildCoreExtract)
   (fused brief · LLM)        fuses multi-page crawl + GBP + reviews + tinyfish + master.md
                              → brief.real_facts (locked facts) + brief.narrative
                              ★ the FACTS source-of-truth

② pl:extract-site-ctx         reads master.md YAML frontmatter + core-extract.real_facts
   (ZERO LLM · deterministic) → site-ctx.json  (the "middle contract" all copy tools read)
                              --write-content → handoff/od-package/content/reviews.json + coverage.json
                              ★ THIS is the "extract website content from master.md" tool (codex R46)

③ pl:enrich-handoff           LLM (claude · ~$0.10-0.20/client · B1-B6)
   (LLM · COPY)               → handoff/od-package/content/hero-copy.json · services.json ·
                                about.md · faq.json   (+ page-map · image classify · bindings)
                              ★ the website COPY is written HERE — and this is the weak link
                                (source of the "500 roofs" fabrication + the 790-word About wall)

④ pl:build-single-page-brief  reads core-extract.real_facts (master.md frontmatter = fallback)
   (ZERO LLM · deterministic) → single-page-brief.yaml  (render contract: ABN/licence/phone =
                                locked verified facts · validator hard-gate · NO LLM)

⑤ pl:compose-editorial        reads single-page-brief.yaml + site-ctx.json + prepared content
   (template + Mustache · $0)  (③④ outputs · formula fallback via copy-builders.js)
                              → clients/<slug>/v2/editorial-output/index.html  (the website)
```

---

## The key split (facts vs copy)

| Concern | Path | Trust | Writer |
|---|---|---|---|
| **Facts** (ABN · licence · phone · rating · review count · service suburbs · warranty) | ② + ④ deterministic | reliable · fact-locked · validator-gated | extract-site-ctx / build-single-page-brief |
| **Copy** (hero · service descriptions · about story) | ③ LLM (enrich-handoff) | **weak link** · can pad/invent/bloat | pl-enrich-handoff (B1 services · B2 about · B3 hero) |

**Implication for the copy-quality work (R93+):** the A/B/C/D/E copy bake-off is fundamentally about
**replacing or improving step ③** (the enrich-handoff LLM copy), gated by `pl:copy-audit` (the
calibrated auditor) and protected by the step-④ fact locks so the LLM cannot reintroduce false
claims.

---

## "Extraction" is already solved · "good copy" is not

- **Extracting build content from master.md is DONE and reliable** — `pl:extract-site-ctx` (②) is
  deterministic, zero-LLM, runs before compose, skips if <24h old. Facts flow cleanly through ②④.
- **What is NOT solved** = step ③ turning those facts into *good* copy. That is the open work
  (R93 copy-quality gate + bake-off). Don't confuse "we can extract the content" with "the copy is
  good" — different steps, different maturity.

---

## Quick commands

```bash
npm run pl:extract-site-ctx -- --slug <slug> [--write-content] [--force]   # ② master.md → site-ctx
npm run pl:enrich-handoff   -- --slug <slug> [--only B1,B3]                 # ③ LLM copy (hero/services/about/faq)
npm run pl:build-single-page-brief -- --slug <slug>                        # ④ deterministic render contract
npm run pl:compose-editorial -- --slug <slug> [--template editorial-newsletter]  # ⑤ render site
npm run pl:copy-audit -- --slug <slug>                                     # gate ③'s copy (R93)
```

---

**Cross-refs**: `SOP-MASTER-MD-DATA-LINEAGE.md` (Layer 1) · `INFRASTRUCTURE-INVENTORY.md` §6 (artifact
table + composer priority chain) · `CANONICAL.md` §0 (site-ctx / composer-content-priority locks).
