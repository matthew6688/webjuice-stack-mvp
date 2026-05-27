# ProfitsLocal · Business Logic (canonical · 2026-05-27)

> **Top of docs/v4** — every architecture decision must serve this. Matthew signed.

## The whole loop · one sentence

**Find local businesses on Google Maps that either have NO website or have a redesignable website, build them a better one via AI (single-page first, multi-page if data supports), self-audit + auto-fix, publish to Cloudflare Pages preview, then cold-outreach by email / SMS / phone / WhatsApp.**

## The 7 stages

```
┌──────────────────────────────────────────────────────────────────────────┐
│  1. DISCOVERY · find target customers from Google Maps                   │
│       primary:  pl:scrape-docker (gosom · $0)                            │
│       fallback: pl:places-search-intake / leads:maps-scrape              │
│       image:    pl:ingest-image (OCR business card / ad photo)           │
│       refine:   pl:single-enrich (signal-driven manual)                  │
│       output:   data/leads/entities/*.json                               │
├──────────────────────────────────────────────────────────────────────────┤
│  2. FILTER · cheap gate · decide which leads are worth paying for        │
│       - has_website? website_404? parked_domain?                         │
│       - operational? in-niche? not-gov / not-competitor?                 │
│       - review activity / rating thresholds                              │
│       output:   entity.predict_grade ∈ {C survivor, D archive}           │
├──────────────────────────────────────────────────────────────────────────┤
│  3. ENRICHMENT · pull paid signals only for survivors                    │
│       Google Places Details (hours, photos, types)                       │
│       ABN/ABR (legal entity name, GST, trading_names[])                  │
│       WHOIS/RDAP (domain age, registrar)                                 │
│       Wayback (first/last snapshot, redesign_detected)                   │
│       Tinyfish (external mentions, homepage signals)                     │
│       output:   entity.enrichment.* + ~60 fields                         │
├──────────────────────────────────────────────────────────────────────────┤
│  4. DESIGN.md · CANONICAL BRAND CONTRACT (the heart of this system)      │
│       MUST contain (locked · never AI-modify):                           │
│         · business_name                                                  │
│         · phone (AU format)                                              │
│         · address                                                        │
│         · business_scope / services list                                 │
│         · brand colors / logo (use logo-extractor; or our logo-gen)      │
│       MAY contain (AI may fill · marked _source: ai-completed):          │
│         · about narrative                                                │
│         · FAQ                                                            │
│         · service descriptions (long form)                               │
│         · hero copy                                                      │
│         · stock images                                                   │
│       gate: data-checkpoint (GREEN multi / YELLOW single / RED refuse)   │
│       output: clients/<slug>/v2/handoff/od-package/                      │
├──────────────────────────────────────────────────────────────────────────┤
│  5. BUILD · website via conversation-driven AI                           │
│       NOT: monolithic pl:compose-site mustache renderer                  │
│       INSTEAD: one Claude/Codex/Open-Design conversation per customer    │
│         · loads design-skill stack (huashu-design, frontend-design,      │
│           design-brief, design-review, web-prototype, saas-landing)      │
│         · reads DESIGN.md + handoff/od-package as immutable input        │
│         · single-page first · multi-page if data score qualifies         │
│       output: rendered HTML in clients/<slug>/v2/build/                  │
├──────────────────────────────────────────────────────────────────────────┤
│  6. AUDIT + AUTO-FIX · ship gate                                         │
│       4-tier audit (T1 binary facts · T2 visual · T3 content · T4 cross) │
│       + Agentic-SEO audit (https://github.com/Bhanunamikaze/             │
│         Agentic-SEO-Skill) for SEO dimension                             │
│       + design-review 5-dim Hermes skill                                 │
│       loop: audit → issue-fix-matrix → re-build → re-audit (max 3)       │
│       ship threshold: composite ≥ 73 (or ≥90 per future canonical bar)   │
│       output: clients/<slug>/v2/build/_tier-audit.{json,md}              │
├──────────────────────────────────────────────────────────────────────────┤
│  7. PUBLISH + OUTREACH                                                   │
│       deploy: Cloudflare Pages preview (cf-pages-deploy.json drives it)  │
│       outreach materials (from same data pipeline):                      │
│         · slides / presentation HTML (via huashu-design)                 │
│         · audit-findings report                                          │
│         · "here's what we'd fix" pitch                                   │
│       channels: email · SMS · phone call · WhatsApp                      │
└──────────────────────────────────────────────────────────────────────────┘
```

## What's NOT in scope (yet)

- Payment / billing automation (Stripe handled separately · `funnel:record-paid-intake*`)
- Production hosting (we ship preview only · production after customer pays)
- Multi-tenant infrastructure (one repo · one ProfitsLocal account)

## Non-negotiable rules

1. **Never AI-generate core facts**: business_name · phone · address · ABN · license · review counts · years in business · owner_name. Source from real APIs or omit.
2. **DESIGN.md is the brand contract**: customer logo + colors + locked facts. Build step reads it; never overrides it.
3. **RED data-checkpoint blocks build**: parked domains / empty services / no contact → re-intake upstream, do NOT proceed to build.
4. **YELLOW = single-page + preview banner**: explicitly mark AI-inferred fields.
5. **No emojis in customer-facing output** (master.md / audit reports / proposal HTML).
6. **Cost ladder is locked**: T0 free (Docker / local) → T1 subscription (Tinyfish) → T2 metered (Places) → T3 premium (LLM rotation). Every paid call appends to `data/finance/ledger.jsonl`.
7. **Provenance via `_source` sibling fields**, NOT `_meta.sources` centralized map (signed 2026-05-17).

## Skill stack inventory (what we have to compose this with)

### ProfitsLocal canonical skills (8, in `skills/profitslocal-*`)
1. lead-discovery — multi-input intake ladder
2. lead-filter — cheap pre-paid-gate
3. entity-enrichment — paid signal pull
4. build-research-pack — orchestrator
5. data-checkpoint — GREEN/YELLOW/RED gate
6. assemble-handoff — od-package compile
7. audit-handoff — P1-P7 pre-build audit
8. quality-audit — 4-tier post-build ship gate

### Hermes website-agent skills (37, in `~/.hermes/profiles/website-agent/skills/`)
- **Design**: huashu-design · frontend-design · design · design-brief · design-review · web-prototype · saas-landing
- **Orchestration**: devops/kanban-orchestrator · devops/kanban-worker
- **Engineering**: software-development/{tdd, systematic-debugging, subagent-driven-development, requesting-code-review, plan, spike}
- **GitHub/MCP/Email**: github/* · mcp/* · email/himalaya
- **Research**: research/{image-lead-discovery, blogwatcher, polymarket, arxiv, llm-wiki}

### External skills to integrate
- **Open Design** (https://github.com/nexu-io/open-design) — conversation-driven website builder; already partially wired via `pl:build-od-seed` + `pl:compose-from-template`
- **Agentic-SEO-Skill** (https://github.com/Bhanunamikaze/Agentic-SEO-Skill) — NEW · add as T4 SEO sub-audit
- **Our logo-gen skill** (location TBD) — for clients with no extractable brand mark

## How we get from current state to this vision

Current state (2026-05-27 commits `4636f6a6` · `19e574a2` · `beb5a55c` · `cd669d01` · `707ed3f9`):
- Stages 1-4 mostly built (paid pipeline works · data-checkpoint with service_content gate works · 39 regression tests on skills 1-3)
- Stage 5 broken (compose-site is mustache · no design intelligence · vicwest stuck at 56)
- Stage 6 partial (4-tier audit works · SEO audit missing · iterate-fix loop OPEN: compose doesn't read issue-fix-matrix.json)
- Stage 7 partial (Cloudflare deploy code exists for paid path · not wired to preview-from-handoff path)

The discussion below (`docs/v4/CODEX-CONSULT-12.md` / `RESPONSE-12.md`) plans the step-by-step modular path from here to there.
