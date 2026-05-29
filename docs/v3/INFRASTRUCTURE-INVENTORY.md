# INFRASTRUCTURE INVENTORY · ProfitsLocal · v1.0 · 2026-05-29

> **PURPOSE**: every existing module / CLI / skill / data store / publish flow in this repo · with file path · 1-line function · status. Built because re-grepping every session is expensive.
>
> **TRIGGER**: open this file BEFORE proposing any new infrastructure. CLAUDE.md §7 existing-work-discovery 5-look mandatory · this doc is look #0 (do it first).
>
> **MAINTAIN (SOP · codex R80)**: any structural pipeline/tool/provenance change MUST update
> this file in the SAME tranche — record writer, reader, SSOT, cache/output path, and known
> disconnects. Treat it as a phase-seal checklist item. Origin: "lots of work built but not
> connected" — capabilities existed (license lookup) but the data never flowed to the brief.

---

## §1 · Cloudflare Pages publish · ✅ FULLY BUILT

### CLIs (`scripts/cli/pl-publish-*.js` · all use CF API + `wrangler pages deploy`)

| CLI | Purpose | Input | Output URL | Status |
|---|---|---|---|---|
| `pl:publish-demo` | Per-client demo publish | `--slug X` · reads `clients/X/v2/concept/reference-adapter/index.html` | `https://X-dev.pages.dev` | WIRED · brisbane-roof confirmed live 2026-05-13 |
| `pl:ship-customer` | **One-liner: compose→deploy→env→redeploy** | `--slug X --recipient email [--client-name "Name"]` | `https://<slug>-dev.pages.dev` | WIRED · use this for new client sites |
| `pl:publish-dir` | Generic any-dir publish | `--dir <html-dir> --project <name> [--audit-report path] [--with-functions]` | `https://<project>.pages.dev` | WIRED · low-level primitive used by pl:ship-customer |
| `pl:publish-pipeline` | Internal pipeline preview | All clients with `pipeline.html` · or `--slugs a,b,c` | `https://pipeline-preview-dev.pages.dev/` | WIRED · internal use |
| `pl:publish-doctor` | Deploy-record health check | Reads all `cf-pages-deploy.json` | `data/heartbeats/publish-doctor.txt` + Discord alert | WIRED · daily cron |

### Env (`.env.local`)
```
CF_API_TOKEN=cfut_*****     # CF API token · Pages:Edit scope
CF_ACCOUNT_ID=2b67*****     # account ID
```

### Deploy record · `clients/<slug>/v2/concept/reference-adapter/cf-pages-deploy.json`
Schema: `{slug, projectName, deployed_at, demo_url, audit_url, master_md_url, internal_audit_url, master_report_url, stage_dir}` — read by publish-doctor for freshness checks.

### Dev vs Live distinction (GitHub Actions · `.github/workflows/`)
| Workflow | Trigger | Output project |
|---|---|---|
| `deploy-dev.yml` | push to `dev` branch | `<project>-dev` |
| `deploy.yml` | push to `main` branch | `<project>-live` |
| `publish-approved.yml` | manual `workflow_dispatch` (post-Stripe approval) | promotes dev → main → live |

### URL pattern
- **Dev / preview**: `<slug>-dev.pages.dev` (all `pl:publish-*` land here · CF auto-creates project)
- **Live**: `<slug>-live.pages.dev` (only via GitHub main branch push · post-payment)
- **Custom domain** (`*.com.au`): NOT automated · manual setup currently · future enhancement

### Post-publish hooks (`core/funnel/`)
- `lead-thread-sync.js` · sync entity record to Discord thread
- `audit-stage-messages.js` · Stage 7 message + retro-edit Stage 6/8 with live URLs
- `discord_stage_message_ids` field in entity tracks Discord message IDs for stage edits

### Pricing context (commit `29abb866` · 2026-05-XX)
- $399 one-time fee = permanent hosting (CF Pages free tier sustains)
- 80-customer R2 trigger (when to migrate to paid CF tier)

---

## §2 · Email infrastructure · ✅ FULLY WIRED (2026-05-29 R42)

### Cloudflare Pages Functions (`functions/`) · DISCOVERED 2026-05-29

| File | Purpose | Wire status |
|---|---|---|
| **`functions/api/contact.ts`** (330 lines) | **Full lead form handler · Resend email · Cloudinary attachments · UTM/click-ID tracking · client_slug field** | BUILT · NOT WIRED to template forms |
| `functions/api/intake-submit.ts` | Intake form submission | BUILT |
| `functions/api/stripe-webhook.ts` | Stripe payment webhook | BUILT |
| `functions/api/create-checkout-session.ts` | Stripe checkout | BUILT |
| `functions/api/tally-webhook.ts` | Tally form webhook (alt path) | BUILT |
| `functions/api/domain-request.ts` | Domain provisioning request | BUILT |
| `functions/api/domain-status.ts` | Domain status check | BUILT |
| `functions/api/approval-request.ts` | Approval workflow trigger | BUILT |
| `functions/api/revision-submit.ts` | Revision submission | BUILT |
| `functions/api/outreach-provider-event.ts` | Outreach provider events | BUILT |
| `functions/api/_agent-dispatch.ts` | Internal agent dispatch | BUILT |
| `functions/admin/_middleware.ts` + `action.ts` + `lead-note.ts` + `lead-queue-action.ts` | Admin dashboard backend | BUILT |
| `core/funnel/email-template.js` | Resend HTML email renderer | BUILT |
| `core/cloudinary/attachments.js` | Cloudinary attachment upload helper | BUILT |

### Env required by `functions/api/contact.ts`
```
RESEND_API_KEY            # transactional email (already in .env.local)
NOTIFICATION_EMAIL        # default 'hi@profitslocal.com' · set to matthewkiata@gmail.com for testing
FROM_EMAIL                # default 'ProfitsLocal <hi@profitslocal.com>'
CLOUDINARY_CLOUD_NAME     # for attachment upload
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
CLOUDINARY_UPLOAD_PRESET
CLOUDINARY_UPLOAD_FOLDER
CLOUDINARY_UPLOAD_MAX_BYTES
```

### Contact form contract (ContactForm interface in contact.ts)
Fields accepted:
- Required: name · email · message
- Customer: company · phone · website · googleBusiness · businessType · domainPreference
- **Routing**: client_slug · repo · template · preview_url
- Funnel: campaign_id · brief_id · first/last_landing_url · referrer · first/last_seen_at
- Click IDs: utm_source · utm_medium · utm_campaign · utm_term · utm_content · gclid · fbclid · msclkid · ttclid · twclid · li_fat_id · gbraid · wbraid · source · ref
- Attachments: multipart `files` · max 8 files · 12MB total · Cloudinary upload

### Email recipient model
- ALL leads go to `NOTIFICATION_EMAIL` (single inbox · default `hi@profitslocal.com`)
- `reply_to` set to visitor's email · so reply goes back to lead
- **Per-client routing NOT YET BUILT** · all leads currently centralized · works for MVP
- Future: lookup table `slug → client_email` for routing to paying customers' inboxes

### CLIENT WEBSITE form wiring (R42 · WIRED 2026-05-29)
Client websites (the products we sell) use a SEPARATE simpler endpoint:
- **`functions/api/client-contact.ts`** (180 lines · NEW R42) · 5 fields · Resend only · NO Cloudinary · NO tracking
- Form contract: `<form action="/api/client-contact" method="post" data-pl-form>` · `name+email+phone` required · `service+message` optional
- Inline JS attached to `[data-pl-form]` · loading state · success/error messages · graceful no-JS POST fallback
- Both templates (editorial-newsletter + trade-classic) point at this · NOT at official-site `contact.ts`

### Deploy + env wire-up (per client) — ONE COMMAND

```bash
# Full pipeline: generate → deploy → configure → redeploy
npm run pl:compose-editorial -- --slug <slug> --template trade-classic
npm run pl:ship-customer -- --slug <slug> --recipient <client@email> --client-name "<Name>"
```

`pl:ship-customer` (`scripts/cli/pl-ship-customer.js`) wraps the 3-step deploy internally:
1. `pl-publish-dir --with-functions` (first deploy · creates CF Pages project)
2. `pl-cf-env-bootstrap` (sets RESEND_API_KEY + RECIPIENT_EMAIL + FROM_EMAIL + CLIENT_NAME)
3. `pl-publish-dir --with-functions` (redeploy · functions now see env vars)

Optional flags: `--project <name>` · `--from <email>` · `--dry-run`

### Resend send domain
- **`leads@profitslocal.com`** — DEFAULT · verified ✅ 2026-05-29
- `hello@fengtalk.ai` — legacy fallback (still valid but not used by default)
- Override per project via `FROM_EMAIL` env or `--from` flag on `pl:ship-customer`

### Future enhancements (NOT in MVP · deferred)
- SMTP relay (paid-tier upgrade · client uses own domain for FROM · env names already declared in client-contact.ts Env interface)
- Honeypot / CAPTCHA (defer until spam observed)
- Hidden tracking fields (UTM/click-id) · paid-tier upgrade
- `data/registry/client-registry.json` (only needed if multi-client routing from single deploy · current model is per-client deploy)

### `wrangler.toml`
```
name = "webjuice-stack-mvp"
compatibility_date = "2025-05-01"
# Project name overridden per-client via GitHub Actions PAGES_PROJECT_NAME variable
```

### Form wiring in templates (R42 · DONE)
- **trade-classic**: hero form (4 fields) + footer form (5 fields + textarea) · both `action="/api/client-contact"`
- **editorial-newsletter**: single form · `action="/api/client-contact"` · name+email+phone required
- Inline async JS on `[data-pl-form]` elements · loading state · success/error UX · no-JS POST fallback

---

## §3 · Audit pipeline · `scripts/cli/pl-audit-v4.js`

### Currently WIRED (~11 dimensions)
| Tier | Dim | Status |
|---|---|---|
| T1 | 1.1 business_name · 1.2 phone · 1.11 logo refs · 1.13 JSON-LD valid · 1.14 AS-trade-5 form ≤4 fields | WIRED (5/13) |
| T2 | 2.1 var-coverage · 2.2 hex-count · 2.3 type-rule · 2.4 logo-surface · 2.5 palette · BC6 token-depth | WIRED (6 dims) |
| T4d | voice (banned phrases · US spelling · forbidden niche) | WIRED |
| Content richness | D2.14 proof variety · D2.11 facts cross-check · minimum_content_signal | WIRED |
| Mobile gate | M1.1 overflow · M1.2 sticky-CTA · M1.3 tap-target ≥44px | WIRED (mechanical vetos) |

### Standalone audit modules in `core/audit/` (BUILT but NOT WIRED into pl-audit-v4)
| File | Purpose | Wire status |
|---|---|---|
| `pagespeed-insights.js` | Lighthouse + Google CRUX real-user data (LCP/FCP/CLS/INP) · free API | NOT WIRED |
| `ai-geo-checks.js` | GEO 12 checks: llms.txt · structured data · E-E-A-T signals | NOT WIRED |
| `image-optimization.js` | webp/avif · srcset · lazy · alt · width/height (CLS) | NOT WIRED |
| `sitemap-analyzer.js` | sitemap.xml + robots.txt analysis | NOT WIRED |
| `third-party-weight.js` | Third-party script weight (perf drag) | NOT WIRED |
| `form-audit.js` | Form quality audit | NOT WIRED |
| `tech-stack-detector.js` | Detect target site tech stack | NOT WIRED |
| `gbp-extras.js` | GBP data enrichment | PARTIAL (used at enrichment stage) |
| `domain-history.js` | Domain age + WHOIS history | NOT WIRED |
| `contact-extraction.js` | Extract NAP from arbitrary HTML | NOT WIRED |
| `activity-audit.js` | "Is this business still operating" signal | NOT WIRED |
| `multi-page-crawl.js` | Multi-page enrichment crawl | WIRED upstream (enrichment) |
| `site-fetch-full.js` | Full site fetch helper | WIRED upstream |
| `logo-extractor.js` | Logo extraction from competitor sites | WIRED upstream |

**Sales angle (Matthew · 2026-05-29)**: these modules audit the CLIENT'S OLD SITE. After we ship our redesign · the "before vs after" diff becomes a sales story ("we lifted your Lighthouse 32→89 · halved your LCP · added 8 structured-data marks · etc"). Deferred to post-first-customer.

### Audit standard doc
- `docs/v3/SOP-AUDIT-STANDARD-V2.md` (618 lines · canonical · 5 P0 + 7 gates)
- `docs/v3/SOP-TEMPLATE-INVENTORY.md` (v1.0 · template inventory SOP · added 2026-05-29 R38)

---

## §4 · Skills architecture · `skills/`

### Structure (21 top-level)
| Skill | Type | Consumed by |
|---|---|---|
| `pl-au-trade-voice/` | data (SKILL.md + JSON build) | `pl:audit-v4` · `pl:llm-page-copywriter` · `pl:compose-editorial` |
| `pl-audit-rubric/` | data (61 rules · JSON build) | `pl:validate-single-page-brief` (TODO) |
| `pl-local-trade-page-spec/` | data (page structure spec) | `pl:validate-single-page-brief` |
| `image-lead-discovery/` | doc only (SKILL.md) | reference |
| `lead-ops/` | doc only | reference |
| `profitslocal-*/` (10 skills) | doc + workflow | manual reference · agent prompts |
| `site-audit/` · `template-lab/` · `website-copy-audit/` · `website-redesign-preservation/` · `website-ui-audit/` | doc only | reference |

### Build pipeline · `scripts/cli/skills-build.js`
- Extracts JSON from SKILL.md frontmatter + body → emits `<skill>.json` sibling
- Pre-commit check: `npm run skills:build -- --check` exits 1 if drift
- Currently builds: `pl-au-trade-voice` · `pl-audit-rubric` · `pl-local-trade-page-spec`

### Consumption pattern
- **Runtime**: direct JSON file reads at startup (no import statement · no registry)
- **Build**: SKILL.md is human-edited canonical · `.json` is build artifact (do not hand-edit)

### Skill schema
```yaml
name: string
version: semver
kind: voice | audit_rubric | page_spec | workflow
contract: { inputs, outputs }
constants: {}
rules: [{ id, severity, when, then }]
sections: [{ id, rule_refs }]
anti_patterns: [{ id, why }]
```

---

## §5 · Hermes Agent integration · partial

### Current state
- Hermes is the planned outbound automation agent (Discord thread + task hand-off)
- `data/agent-tasks/<client>/*.json` task packets exist (consumable by Hermes/Codex/Claude/OpenClaw)
- Default agent: `codex` · alternatives: `claude`, `opencode`, `hermes`
- Discord integration: `core/funnel/lead-thread-sync.js` · `core/funnel/audit-stage-messages.js`

### Env (from HANDOFF.md)
- `WEBSITE_TASKS_DISCORD_CHANNEL_ID`
- `WEBSITE_AGENT_MENTION`
- `WEBSITE_TASKS_DISCORD_BOT_TOKEN`
- `ai.hermes.gateway-website-agent` plugin

### What's NOT built (gaps)
- No Hermes-callable wrapper for `pl:compose-editorial` / `pl:publish-dir`
- No event-driven (webhook) pipeline · all CLIs are manual
- Modular CLI as Hermes-callable skill: future work · post-first-customer

---

## §6 · Core data flow · per-client `clients/<slug>/v2/`

### Canonical artifacts
| Path | Writer CLI | Purpose |
|---|---|---|
| `entity.json` (or `data/leads/entities/<id>.json`) | `pl:lead-discovery` · `pl:enrich-entity` | Raw GBP + WHOIS + ABN + Tinyfish enrichment |
| `core-extract.json` | `pl:llm-extract-core` (recovered R37) | Fused brief from all sources · narrative + real_facts |
| `customer-brief.md` | `pl:render-customer-brief` | Human-readable canonical brief |
| `single-page-brief.yaml` | manual / `pl:validate-single-page-brief` | Render-input contract |
| `checkpoint.json` | `pl:data-checkpoint` | RED/YELLOW/GREEN verdict |
| `inferred-data.json` | `pl:llm-infer-thin-data` | AI back-fill for YELLOW clients |
| `handoff/od-package/facts.json` | enrichment pipeline | Locked facts subset for composer |
| `handoff/od-package/brand/brand-tokens.css` | `pl:render-brand-kit` | Per-client CSS tokens (R37 a-j fix: must exist at canonical path) |
| `handoff/od-package/brand/brand-spec.json` | brand-kit pipeline | Brand metadata (hex · fonts · personality) |
| `handoff/photos/selected.json` | `core/handoff/classify-images.js` | Vision-LLM curated images |
| **`site-ctx.json`** | **`pl:extract-site-ctx`** (R46 · zero LLM) | **Middle contract: master.md → normalized JSON for all downstream copy tools** |
| `handoff/od-package/content/hero-copy.json` | `pl:enrich-handoff` | LLM-generated hero copy options (3 angles) |
| `handoff/od-package/content/services.json` | `pl:enrich-handoff` | LLM-generated service list + descriptions |
| `handoff/od-package/content/about.md` | `pl:enrich-handoff` | LLM-generated about story paragraphs |
| `handoff/od-package/content/faq.json` | `pl:enrich-handoff` | LLM-generated FAQ items |
| **`handoff/od-package/content/reviews.json`** | **`pl:extract-site-ctx --write-content`** (R46) | **Real Google reviews formatted for composer** |
| **`handoff/od-package/content/coverage.json`** | **`pl:extract-site-ctx --write-content`** (R46) | **Suburb list formatted for composer** |
| `editorial-output/index.html` | `pl:compose-editorial` (v1 canonical) | Rendered website |
| `editorial-output/ctx-snapshot.json` | `pl:compose-editorial` (R44+R46) | Provenance: which source was used for each content area |
| `editorial-output/audit-v4-*.json` | `pl:audit-v4` | Audit results |
| `concept/reference-adapter/cf-pages-deploy.json` | `pl:publish-demo` | Deploy record |

### Composer (`scripts/cli/pl-compose-editorial.js`)
- Two templates supported via `--template <name>` (R38 dispatch)
- Templates: `editorial-newsletter` (default · warm editorial) · `trade-classic` (safe AU trade voice)
- Copy-builders dispatch via `core/handoff/copy-builders.js` (R40 · per profile)
- YELLOW back-fill via `core/handoff/merge-inferred.js` (R37 · provenance-tagged)
- **R44+R46 prepared content priority chain**: reads `handoff/od-package/content/` files first
  - hero: `hero-copy.json` → formula fallback
  - services: `services.json` → core-extract fallback
  - about: `about.md` → formula fallback
  - reviews: `reviews.json` (≥3 items → real, no placeholder) → testimonials → formula
  - coverage: `coverage.json` (≥3 suburbs) → mergeSuburbs formula
- Output: `clients/<slug>/v2/editorial-output/index.html` + `assets/` + `ctx-snapshot.json`

### `pl:extract-site-ctx` (R46 new · `scripts/cli/pl-extract-site-ctx.js`)
- **Zero LLM · deterministic parse · fast**
- Input: `master.md` (YAML frontmatter) + `core-extract.json` (real_facts + brand + ai_extensions)
- Output: `site-ctx.json` — normalized JSON middle contract for all downstream tools
- `--write-content` flag: also writes `reviews.json` + `coverage.json` to `handoff/od-package/content/`
- Skip if < 24 hours old (use `--force` to regenerate)
- Codex R45+R46 consensus: Option B+C hybrid

### Pipeline orchestrator
- `scripts/cli/pl-pipeline-all.js` — runs full pipeline (discovery → enrich → extract → checkpoint → render → audit)
- Skip flags + cached-stage emit for partial runs

---

## §7 · Lead / outreach data (`data/`)

### Existing dirs
- `data/leads/entities/` · raw entity JSONs (one per business · key by place_id)
- `data/qa/` · QA staging dirs for publish-pipeline
- `data/heartbeats/` · daily cron output (intake-doctor · publish-doctor)
- `data/tasks/` · v3-dispatcher task queue + logs
- `data/agent-tasks/` · Hermes/Codex agent task packets
- `data/v2/fixtures/` · test fixtures (reviews · golden e2e contracts)

### NOT yet built
- `data/leads/inbox/` · inbound form submissions staging (task #113)
- `data/registry/client-registry.json` · slug → email mapping (task #113)

### DB / SQLite
- `run_scraper.py` defines `outreach_status` table schema (never populated)
- License Phase 1.3 (`task #56` completed): VBA/QBCC SQLite FTS index used by `pl:data-checkpoint` for license enrichment

---

## §8 · Documentation index

### Canonical docs (`docs/v3/`)
| File | Status | Read order |
|---|---|---|
| `CANONICAL.md` v1.3 | Master state | **First** |
| `SOP-AUDIT-STANDARD-V2.md` | Audit framework | After CANONICAL |
| `SOP-TEMPLATE-INVENTORY.md` v1.0 | Template inventory SOP | When adding new templates |
| `SOP-DATA-CHECKPOINT.md` | Data quality gate | When changing checkpoint logic |
| `CANONICAL-DECISION-RECORD-RENDER-PATH.md` | V1 = canonical decision | Historical |
| `PATH-A-OD-TESTED-NOT-ADOPTED.md` | OD daemon deprecation | Historical |
| `SESSION-2026-05-28-SUMMARY.md` · `SESSION-2026-05-29-SUMMARY.md` | Daily logs | Recent context |
| `HANDOFF-NEXT-SESSION.md` | Tomorrow's mission | End of session |
| **`INFRASTRUCTURE-INVENTORY.md`** (this doc) | **What's built** | **Before proposing new code** |

### Strategy docs (`docs/research/`)
- `cloner-skill-eval/` — Cloudflare Pages migration plan · Hermes integration spec · skill evaluation
- `00-BUSINESS-LOGIC.md` (signed) — pricing + ops contract

### CLAUDE.md (global)
- §6 SSOT writer-check (mandatory)
- §7 existing-work-discovery 5-look (mandatory) ← this doc is "look #0"
- Codex Review Cadence (mandatory · 2026-05-29)
- Communication Style (人话 with Matthew · pro between agents)

---

## §9 · Quick reference · "I want to..."

| I want to... | Use this |
|---|---|
| Render a client website | `npm run pl:compose-editorial -- --slug X [--template trade-classic]` |
| Audit a rendered website | `npm run pl:audit-v4 -- --slug X --output-dir clients/X/v2/editorial-output --tier fast` |
| Publish ANY dir to CF Pages preview | `npm run pl:publish-dir -- --dir <path> --project <name>` |
| Publish a client demo | `npm run pl:publish-demo -- --slug X` |
| Check publish health | `npm run pl:publish-doctor` |
| Run full pipeline (discovery → audit) | `npm run pl:pipeline-all -- --slug X` |
| Check data quality before render | `npm run pl:data-checkpoint -- --slug X` |
| Back-fill thin data with AI | `npm run pl:llm-infer-thin-data -- --slug X` |
| Build skills JSON from SKILL.md | `npm run skills:build` |

---

## §10 · Update log

- **2026-05-29 (this doc)** · Initial · written after missing pl-publish-* in earlier research · captures CF Pages + Resend + skills + audit modules.
- **2026-05-29 (R42 evening)** · Lead-capture E2E wired. NEW: `functions/api/client-contact.ts` · `pl-cf-env-bootstrap.js` · `pl-publish-dir --with-functions` flag. Both templates POST forms to /api/client-contact. Verified: vicwest-roofing-test.pages.dev curl POST → Resend → matthewkiata@gmail.com. SOP-TEMPLATE-INVENTORY §6.5 (Stage 4.5) mandatory checklist for future templates. CANONICAL v1.4.

- **2026-05-29 (R70–R81 · Phase-1 audit-loop + brief builder)** · Major session. Canonical standard consolidated → `docs/v3/SOP-AUDIT-STANDARD-V2.md` (SSOT · §0.1 resolves the "T4 three-meanings" tier collision). NEW modules:
  - `scripts/cli/pl-compose-loop.js` — audit→feedback→fix→re-audit loop (GATE-B/C · dry-run default · backup/rollback · fact-guard · copy_provider_fallback flag). PHASE-1 SEAL: `docs/v3/PHASE-1-SEAL.md`.
  - `core/audit/compose-feedback.js` — audit issue → executable `compose_feedback` routed to the TRUE writer (resolveTrueWriter · never the derived site-ctx). Blocks: source_unlocated/set_level_change/layout_lever_needed.
  - `core/audit/hero-judge.js` · `core/audit/designer-review.js` — LLM hero + T4 designer review (fact-injected · vision_confidence-gated).
  - `scripts/cli/pl-build-single-page-brief.js` — **deterministic** render-contract builder (core-extract.real_facts > master.md frontmatter > null/data_gap · NO LLM · validator hard gate). Fills the missing writer for `single-page-brief.yaml` (was hand-authored · only vicwest).
  - **pl-audit-v4**: LOW_CONFIDENCE_VISION guard (local-fallback vision can't alone SHIP) + D3.7 fold tolerance (≤60px → P2 layout_lever_needed).
  - **DISCONNECTS FIXED**: (1) `entity.license` (official registry · pl-license-lookup) now FLOWS into the brief — brief-builder reads `entity.json.license` (was orphaned in entity layer · a-j licence never reached brief). (2) `pl-license-lookup` confidence-gate (codex R81): only abn_exact/licence_exact/name_exact_normalized write canonical `entity.license`; token_prefix/fts → `_candidates` + `needs_manual_license_confirm` (caught a false "Mark Squire"→"Mark Prain Builders" token match · ABN cross-check added). brief-builder mirrors the read-gate.
  - **STILL DISCONNECTED (open)**: `address → geocode → suburbs-within-radius` is documented ("radius-inferred ~25km") but NOT built (`core/leads/geocode.js` does city→lat/lng only · no haversine · no AU suburb gazetteer). Planned: new `geo_derived` provenance tier (verified > official_registry > geo_derived > ai_inferred). a-j blocked on suburbs (3<8 · needs_enrichment). Spec target: `docs/v3/SPEC-AUDIT-TECH.md` sibling.
  - Flow (license): `state CSV registers → data/licenses/_index.sqlite (pl:license-csv-sync) → pl-license-lookup → entity.json.license (CONFIRMED only) → pl-build-single-page-brief → single-page-brief.yaml → composer footer (brief.abn||licNum.ABN)`.
  - Deferred-tech contract: `docs/v3/SPEC-AUDIT-TECH.md` (pl-audit-tech · Lighthouse/schema/SEO/GEO · advisory · NOT Phase-1 gate).

---

**Sign-off**: this doc is the institutional memory of existing infrastructure. Read FIRST before grepping. Update when discovering new modules or building new ones.
