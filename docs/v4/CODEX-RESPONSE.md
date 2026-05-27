# Codex Response · Modularize Stable V3 Layers

**Date**: 2026-05-27  
**Scope**: stable layers only: discovery/scrape, filtering/scoring, enrichment, data checkpoint, handoff assembly/audit, post-build audit, Master.md lineage. The unstable website-build instruction layer stays `[PENDING]`.

## Executive Recommendation

Create **9 canonical skills** plus one explicit pending stub. Do not split every CLI into a skill. The skill layer should wrap already-owned CLIs, declare file contracts, and route the LLM/operator to the right command. It should not restate SOP rule tables, because the single-owner rule requires each concept to live in exactly one owner SOP (`docs/SOP_OWNERSHIP_REGISTRY.md:10-13`, `docs/SOP_MAINTENANCE_RULES.md:23-28`).

Important correction to the inventory: several audit modules listed as “0 importers” are now imported by `core/audit/site-fetch-full.js` (`core/audit/site-fetch-full.js:24-32`) and used in the fetch payload (`core/audit/site-fetch-full.js:99-113`). Treat those as wired into the detailed-audit fetch layer unless `run-audit-pipeline.js` no longer calls `siteFetchFull`.

## A · Modular Skill List

| Skill | Trigger | Input Contract | Output Contract | Owner CLI | Upstream | Downstream | Failure Mode |
|---|---|---|---|---|---|---|---|
| `profitslocal-lead-discovery` | User asks to find/map-scrape leads for niche/city, or run gosom Docker scrape | Reads scrape query args; writes through `core/leads/discovery-store.js`; source entity schema owned by SOP-X-Handoff (`docs/SOP_OWNERSHIP_REGISTRY.md:83-95`) | `data/leads/entities/<entityKey>.json`; schema sketch: `{schemaVersion, entityKey, latest, identifiers, discovery_runs[], sourceQuery, promotedClientSlug?}` | `npm run pl:scrape-docker`; secondary: `pl:places-search-intake`, `pl:ingest-image` (`package.json:102`) | none | `profitslocal-lead-filter` | Exit nonzero on scraper/API failure; no invented fields; thin-contact entities proceed only as partial entities |
| `profitslocal-lead-filter` | Entity exists and needs hard-gate / opportunity grading | `data/leads/entities/<entityKey>.json`; `entity.latest`, `cheap_audit?`, `niche_relevance?` | Updates same entity with `cheap_audit`, `predict_grade`, exclusion report; schema sketch: `{cheap_audit:{action,reason,gbp_quality,final_score}, predict_grade:{predict_grade,audit_now,reasons,priority}, exclusion_filter:{excluded,layer,reason}}` | `npm run pl:run-enrichment-batch` for queued flow, with `cheap-audit-queue` doing the filter; `exclusion-filter` is actually imported at `core/leads/cheap-audit-queue.js:149-156` | `profitslocal-lead-discovery` | `profitslocal-entity-enrichment` or archive | Excluded leads become D / terminal archive; bad entity JSON exits/logs and does not promote |
| `profitslocal-entity-enrichment` | Entity is dedup-clean but missing Places/ABN/photos/search context | `data/leads/entities/<entityKey>.json`; optional Places IDs; cost ladder is locked by `docs/v4/INFRASTRUCTURE-MAP.md:13-20` | Updates entity enrichment fields; writes photos/GBP sidecars where applicable; schema sketch: `{enrichment:{abn,whois,wayback,tinyfish_search}, latest:{places_enrichment}, _source siblings}` | `npm run pl:enrich-entity`, `pl:places-enrich`, `pl:download-places-photos`, `pl:summarize-external-mentions` (`package.json:80`, `package.json:111-117`) | `profitslocal-lead-filter` | `profitslocal-research-pack` | Missing upstream API keys or blocked providers should mark field missing/partial and ledger calls; never synthesize name/phone/address/license/services |
| `profitslocal-research-pack` | User asks to build the research/handoff package for a qualified slug | Reads `data/leads/entities/<entityKey>.json`, optional `data/leads/handoffs/<key>.lead-to-research.json`; validates handoff before running (`scripts/cli/pl-research-pack.js:118-138`) | `clients/<slug>/v2/handoff/` plus run summary; schema sketch: `{core-facts.json, content/*, structure/*, design/*, photos/source/*}` | `npm run pl:research-pack` (`package.json:362`); internally chains `pl:build-handoff`, `pl:enrich-handoff`, `pl:build-design-handoff`, `pl:assemble-handoff`, `pl:validate-handoff` (`scripts/cli/pl-research-pack.js:171-184`) | `profitslocal-entity-enrichment` | `profitslocal-core-brief` or `profitslocal-data-checkpoint` | Exit 1 on contract errors; writes `data/leads/errors/<entityKey>.handoff-missing-field.json` on missing critical handoff fields (`scripts/cli/pl-research-pack.js:121-131`) |
| `profitslocal-core-brief` | User needs the verified core extract and long customer brief before checkpoint/build | Reads `clients/<slug>/v2/master.md`, entity, crawl, Tinyfish mentions, data coverage, brand spec, reviews, image manifest (`scripts/cli/pl-llm-extract-core.js:34-43`) | `clients/<slug>/v2/core-extract.json` with `{brief:{real_facts,ai_extensions,narrative,data_gaps}, _meta:{provider,model,sources_consumed}}` (`scripts/cli/pl-llm-extract-core.js:75-94`); `clients/<slug>/v2/customer-brief.md` and `.meta.json` (`scripts/cli/pl-llm-customer-brief.js:199-212`) | `npm run pl:llm-extract-core`; add/restore package script for `pl:llm-customer-brief` because the file exists but package script is absent (`scripts/cli/pl-llm-customer-brief.js:1-14`) | `profitslocal-research-pack` | `profitslocal-data-checkpoint` | Exit 1 if `core-extract.json`/brief input missing or LLM returns no parseable JSON (`scripts/cli/pl-llm-extract-core.js:65-72`); any AI extension must be labeled, not promoted to verified fact |
| `profitslocal-data-checkpoint` | Immediately after research pack/core brief, before assemble/compose | Reads `clients/<slug>/v2/core-extract.json`, `customer-brief.md`, `handoff/od-package/facts.json`, inferred entity (`skills/profitslocal-data-checkpoint/SKILL.md:23-31`) | `clients/<slug>/v2/checkpoint.json`; schema sketch: `{verdict:"GREEN|YELLOW|RED", recommended_pages, hard_fields[], rich_fields[], missing[], inferred[], fix_commands[]}` (`skills/profitslocal-data-checkpoint/SKILL.md:59-73`) | `npm run pl:data-checkpoint` (`package.json:396`) | `profitslocal-core-brief` | `profitslocal-assemble-handoff` | Exit 0 for GREEN/YELLOW, exit 1 for RED (`skills/profitslocal-data-checkpoint/SKILL.md:38-40`); RED halts downstream |
| `profitslocal-assemble-handoff` | Checkpoint is GREEN/YELLOW and OD/composer package needs canonical structure | Reads `clients/<slug>/v2/checkpoint.json`, `clients/<slug>/v2/handoff/{design,content,structure,core-facts.json,photos}` (`scripts/cli/pl-assemble-handoff.js:3-7`, `scripts/cli/pl-assemble-handoff.js:60-82`) | `clients/<slug>/v2/handoff/od-package/`; schema sketch: `{facts.json:{schema,locked_facts,facts_policy}, brand/*, content/*, structure/*, assets/*}` (`scripts/cli/pl-assemble-handoff.js:116-149`) | `npm run pl:assemble-handoff` (`package.json:379`) | `profitslocal-data-checkpoint` | `profitslocal-audit-handoff` | Exit 1 if handoff dir/checkpoint missing or checkpoint RED (`scripts/cli/pl-assemble-handoff.js:55-82`); YELLOW proceeds single-page/preview-aware |
| `profitslocal-audit-handoff` | Pre-build package must be audited before any expensive build attempt | Reads `clients/<slug>/v2/handoff/od-package/` or explicit `--dir`; required files listed in CLI (`scripts/cli/pl-audit-handoff.js:41-58`) | `handoff-audit.json`; schema sketch: `{pass, layers:[{layer,gate,pass,failures,detail}], summary}`; CLI promises file + console + exit code (`scripts/cli/pl-audit-handoff.js:16-19`) | `npm run pl:audit-handoff` (`package.json:376`) | `profitslocal-assemble-handoff` | `[PENDING] profitslocal-compose-site` | Exit 0 only if hard layers pass; exit nonzero on missing structural/brand/content/fact files |
| `profitslocal-quality-audit` | A site output exists and must be judged against the 4-tier ship standard | Reads rendered HTML output dir, `clients/<slug>/concept/open-design-seed/facts.json`, `clients/<slug>/v2/customer-brief.md` (`scripts/cli/pl-audit-tier.js:30-38`) | `<out>/_tier-audit.json` and `.md`; schema sketch: `{T1:{pass,checks,fails}, T2:{score}, T3:{score}, T4:{score}, composite, grade}`. T1 + composite rule is in code header (`scripts/cli/pl-audit-tier.js:3-11`) | `npm run pl:audit-tier` (`package.json:398`) | `[PENDING] profitslocal-compose-site` | publish / fix loop | Exit nonzero or fail verdict when T1 fails or composite < 73; T1 fact failures block publish |
| `[PENDING] profitslocal-compose-site` | **Do not canonicalize yet.** Only call explicitly for experiments until build layer reliably scores >=90 across customers | Reads `handoff/od-package/`, `checkpoint.json`, later `handoff/issue-fix-matrix.json` once fixed | Rendered site output plus future `compose-result.json`; current package has `pl:compose-site` (`package.json:382`) but quality is unstable per request | `npm run pl:compose-site`; `pl:iterate-site` remains experimental | `profitslocal-audit-handoff` | `profitslocal-quality-audit` | Treat failures as build-layer defects, not data-layer defects. Do not present as canonical skill until the audit/fix loop closes |

## B · Retire List

| Module | Recommendation | Reason |
|---|---|---|
| `core/leads/reference-adapter-handoff.js` | **Delete after one archived snapshot or move to docs/v4 as historical note** | Its only live caller is behind `pl-build-from-reference`, but that CLI exits before imports and says V2 composer is the only path (`scripts/cli/pl-build-from-reference.js:3-19`). Keeping an executable-looking module invites accidental resurrection. |
| `core/audit/form-audit.js` | **Keep wired** | Inventory said orphan, but `site-fetch-full` imports and calls it (`core/audit/site-fetch-full.js:29`, `core/audit/site-fetch-full.js:99-100`). |
| `core/audit/pagespeed-insights.js` | **Keep wired, but verify API-key fallback** | Imported by `site-fetch-full` (`core/audit/site-fetch-full.js:28`). If no caller consumes `payload.pagespeed` later, add a TODO in `site-fetch-full`, not a skill. |
| `core/audit/tech-stack-detector.js` | **Keep wired** | Imported and assigned to `payload.tech_stack` (`core/audit/site-fetch-full.js:24`, `core/audit/site-fetch-full.js:99`). |
| `core/audit/third-party-weight.js` | **Keep wired** | Interceptor attaches before navigation and finalizes into payload (`core/audit/site-fetch-full.js:69-72`, `core/audit/site-fetch-full.js:112-113`). |
| `core/audit/ai-geo-checks.js` | **Keep wired with TODO to confirm downstream consumption** | Imported by `site-fetch-full` (`core/audit/site-fetch-full.js:27`). Do not delete without reading the rest of `site-fetch-full` and `detailed-audit.js`. |
| `core/audit/activity-audit.js` | **Keep wired with TODO to confirm downstream consumption** | Imported by `site-fetch-full` (`core/audit/site-fetch-full.js:26`). |
| `core/audit/domain-history.js` | **Keep as future-stub or merge owner into enrichment** | It is imported by `site-fetch-full` (`core/audit/site-fetch-full.js:30`) but overlaps with `core/enrichment/whois-rdap.js`; ownership registry already gives enrichment/tooling ownership for external tooling and entity enrichment (`docs/SOP_OWNERSHIP_REGISTRY.md:38-56`, `docs/SOP_OWNERSHIP_REGISTRY.md:96-107`). Decide one owner before expanding. |
| `core/audit/image-optimization.js` | **Keep wired** | Called as pure HTML parse and assigned to payload (`core/audit/site-fetch-full.js:31`, `core/audit/site-fetch-full.js:102-103`). |
| `core/handoff/design-header-footer-cta.js` | **Keep as future-stub with TODO, not canonical** | It exports useful Phase E4-E6 design specs (`core/handoff/design-header-footer-cta.js:1-8`) but is not imported by `pl-enrich-handoff`, whose header says B1-B6 and code runs B tasks (`scripts/cli/pl-enrich-handoff.js:3-15`, `scripts/cli/pl-enrich-handoff.js:149-220`). Wire later only if `pl:compose-site` actually reads these specs. |
| `core/leads/exclusion-filter.js` | **Keep wired** | Inventory claim is stale. `cheap-audit-queue` imports and runs it (`core/leads/cheap-audit-queue.js:149-156`). |
| `core/llm/key-rotation.js` | **Keep as future-stub TODO or implement under `core/llm/` before claiming support** | File is absent; inventory says docs reference it but repo has no file (`docs/v4/INFRASTRUCTURE-MAP.md:410-414`). Do not create outside allowed dirs. |
| `core/llm/perplexity.js` | **Keep as future-stub TODO or implement under `core/llm/` before claiming support** | File is absent even though the locked ladder references Perplexity as T2 fallback (`docs/v4/INFRASTRUCTURE-MAP.md:13-20`, `docs/v4/INFRASTRUCTURE-MAP.md:410-414`). Until implemented, skills must say Perplexity fallback is unavailable. |

## C · Architectural Decisions To Flag

### 1. `_source` siblings vs centralized `_meta.sources`

Keep `_source` sibling fields. This is already the signed rule: current state says provenance is `_source` siblings, not `_meta.sources` (`docs/CURRENT-STATE-2026-05-27.md:100-103`), and SOP-3 ownership also assigns provenance schema and `_source` binding to SOP-3 (`docs/SOP_OWNERSHIP_REGISTRY.md:195-197`). A centralized `_meta.sources` map may be tidier for analytics, but migrating now would violate the current owner decision and increase risk to the anti-fabrication contract.

If a centralized index is needed later, make it derived/read-only from sibling `_source` fields, not the authoring source of truth.

### 2. Skill discoverability

Use both:

- **Frontmatter `description`** for automatic LLM invocation. The data-checkpoint skill is a good model: it says exactly when to use it and what it gates (`skills/profitslocal-data-checkpoint/SKILL.md:1-4`, `skills/profitslocal-data-checkpoint/SKILL.md:10-17`).
- **Slash/CLI command names** for operator determinism and logs. Package scripts are the stable executable surface (`docs/v4/INFRASTRUCTURE-MAP.md:261-285`).

Do not rely on skill names alone. Each SKILL.md should include: owner SOP, inputs, canonical command, output contract, downstream consumers, and failure/degrade behavior, matching the checkpoint shape (`skills/profitslocal-data-checkpoint/SKILL.md:19-31`, `skills/profitslocal-data-checkpoint/SKILL.md:32-44`, `skills/profitslocal-data-checkpoint/SKILL.md:75-91`).

### 3. Where audit→fix loop closes

It does not close cleanly yet. `pl:iterate-site` writes `fix-instructions.md` for the next iteration (`scripts/cli/pl-iterate-site.js:3-12`, `scripts/cli/pl-iterate-site.js:122-180`), while handoff enrichment already writes/mentions `issue-fix-matrix` as B7 in the infrastructure map (`docs/v4/INFRASTRUCTURE-MAP.md:370-390`). The compose/build path must explicitly read the matrix and previous audit output before the loop can be considered canonical.

Recommended closure:

1. Keep `profitslocal-quality-audit` canonical because audit standard is stable.
2. Keep `pl:iterate-site` experimental.
3. Add a narrow bridge inside `scripts/cli/pl-compose-site.js` or its input loader: read `handoff/issue-fix-matrix.json` and latest `fix-instructions.md`, then emit a `compose-result.json` with which fixes were consumed.
4. Only then promote a `profitslocal-iterate-fix` skill.

### 4. Eventual website-build skill accommodation

The modular plan leaves a single slot after `profitslocal-audit-handoff` and before `profitslocal-quality-audit`:

```text
profitslocal-audit-handoff
  -> [PENDING] profitslocal-compose-site
  -> profitslocal-quality-audit
  -> publish or experimental fix loop
```

That slot should graduate only when:

- `pl:compose-site` reads all canonical handoff inputs, including issue-fix matrix.
- It writes `compose-result.json` with input hashes/provenance.
- `pl:audit-tier` passes T1 and composite >=73 on at least the agreed customer set, and the target for canonical build skill should be >=90 if Matthew keeps that as the build-quality bar.
- The skill explicitly refuses RED checkpoints and enforces YELLOW preview constraints.

## D · What I Would Refuse Without More Info

I would not:

- Create or bless `profitslocal-compose-site` as canonical today. The request says vicwest is 89, vip is 0, and a-j is blocked; that is not stable enough for a build skill.
- Migrate `_source` sibling provenance to `_meta.sources` without a signed SOP-3/SOP-X-Handoff decision and migration plan.
- Delete the “0 importer” audit modules solely from `INFRASTRUCTURE-MAP.md`; the current code shows most are wired through `site-fetch-full`.
- Redesign the T0/T1/T2/T3 cost ladder. The ladder is locked and already cataloged (`docs/v4/INFRASTRUCTURE-MAP.md:13-20`).
- Add files outside `core/`, `scripts/cli/`, `skills/`, or `docs/v4/` for this modularization without explicitly flagging the deviation.
- Let any skill AI-generate core facts: business name, phone, address, ABN/license, real services, suburbs, opening hours, testimonials. Missing source data must produce RED/YELLOW, TODOs, or labeled `ai-inferred` non-core copy.
- Add new JSON contracts like `compose-result.json` or `validate-result.json` as mandatory until their schema owner is recorded in the ownership registry and validated by `ops:skill-cli-validate` / schema smoke tests.

## Implementation Order

1. Update existing skill docs for `profitslocal-lead-discovery`, `profitslocal-research-pack`, and `profitslocal-data-checkpoint` to the contract table above.
2. Add five new stable SKILL.md files: `profitslocal-lead-filter`, `profitslocal-entity-enrichment`, `profitslocal-assemble-handoff`, `profitslocal-audit-handoff`, and `profitslocal-quality-audit`.
3. Add `profitslocal-core-brief` only after deciding whether `pl:llm-customer-brief` should be restored as a package script or folded into `pl:research-pack`.
4. Mark `profitslocal-compose-site` and `profitslocal-iterate-fix` as pending/experimental in docs/v4, not skills.
5. Run the three required doctors before committing skill/docs changes: `npm run ops:sop-audit`, `npm run ops:doc-freshness-audit`, `npm run ops:skill-cli-validate` (`docs/SOP_MAINTENANCE_RULES.md:50-55`, `docs/SOP_MAINTENANCE_RULES.md:131-143`).
