# INFRASTRUCTURE INVENTORY · ProfitsLocal · v1.0 · 2026-05-29

> **PURPOSE**: every existing module / CLI / skill / data store / publish flow in this repo · with file path · 1-line function · status. Built because re-grepping every session is expensive.
>
> **TRIGGER**: open this file BEFORE proposing any new infrastructure. CLAUDE.md §7 existing-work-discovery 5-look mandatory · this doc is look #0 (do it first).
>
> **MAINTAIN**: anytime you build / discover / deprecate a module · update the relevant section.

---

## §1 · Cloudflare Pages publish · ✅ FULLY BUILT

### CLIs (`scripts/cli/pl-publish-*.js` · all use CF API + `wrangler pages deploy`)

| CLI | Purpose | Input | Output URL | Status |
|---|---|---|---|---|
| `pl:publish-demo` | Per-client demo publish | `--slug X` · reads `clients/X/v2/concept/reference-adapter/index.html` | `https://X-dev.pages.dev` | WIRED · brisbane-roof confirmed live 2026-05-13 |
| `pl:publish-dir` | **Generic any-dir publish** | `--dir <html-dir> --project <name> [--audit-report path]` | `https://<project>.pages.dev` | WIRED · use this for editorial-output |
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

### Deploy + env wire-up (per client · option A from R41)
- `pl-publish-dir --with-functions` · whitelist-copies `functions/api/client-contact.ts` + `wrangler.toml` (NOT contact.ts NOT cloudinary NOT admin/)
- `pl-cf-env-bootstrap --recipient <client@email> --client-name "Name"` · PATCHes CF Pages env (RESEND_API_KEY+RECIPIENT_EMAIL+FROM_EMAIL+CLIENT_NAME) on production + preview environments
- Two-step deploy needed: (1) publish-dir creates project + uploads files (2) cf-env-bootstrap sets env (3) publish-dir again so functions see env

### Future enhancements (NOT in MVP · deferred)
- SMTP relay (paid-tier upgrade · client uses own domain for FROM · env names already documented in client-contact.ts)
- Honeypot / CAPTCHA (defer until spam observed)
- Hidden tracking fields (UTM/click-id) · paid-tier upgrade
- `data/registry/client-registry.json` (only needed if multi-client routing from single deploy · current model is per-client deploy)
- profitslocal.com Resend domain verification (DNS records added 2026-05-29 · pending Resend verification · then switch FROM default from `hello@fengtalk.ai` → `leads@profitslocal.com`)

### `wrangler.toml`
```
name = "webjuice-stack-mvp"
compatibility_date = "2025-05-01"
# Project name overridden per-client via GitHub Actions PAGES_PROJECT_NAME variable
```

### Existing form code (templates)
- Current `action="#"` · `onsubmit="event.preventDefault(); alert('Demo · form would submit');"`
- Lines: editorial-newsletter ~487 · trade-classic 645 + 869
- `run_scraper.py` has `outreach_status` DB table schema (email/email_sent_at/email_status/demo_url/proposal_url) · NEVER POPULATED · future inbound lead tracking

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
| `editorial-output/index.html` | `pl:compose-editorial` (v1 canonical) | Rendered website |
| `editorial-output/audit-v4-*.json` | `pl:audit-v4` | Audit results |
| `concept/reference-adapter/cf-pages-deploy.json` | `pl:publish-demo` | Deploy record |

### Composer (`scripts/cli/pl-compose-editorial.js`)
- Two templates supported via `--template <name>` (R38 dispatch)
- Templates: `editorial-newsletter` (default · warm editorial) · `trade-classic` (safe AU trade voice)
- Copy-builders dispatch via `core/handoff/copy-builders.js` (R40 · per profile)
- YELLOW back-fill via `core/handoff/merge-inferred.js` (R37 · provenance-tagged)
- Output: `clients/<slug>/v2/editorial-output/index.html` + `assets/`

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

---

**Sign-off**: this doc is the institutional memory of existing infrastructure. Read FIRST before grepping. Update when discovering new modules or building new ones.
