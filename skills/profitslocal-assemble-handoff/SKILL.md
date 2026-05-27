---
name: profitslocal-assemble-handoff
description: Use after `profitslocal-data-checkpoint` returned GREEN or YELLOW (NEVER RED), to assemble the canonical `handoff/od-package/` directory that downstream compose-site / open-design consume. Pulls facts, brand pack, content (services / about / FAQ / hero-copy), structure (page-map), and resolved photo manifest into one self-contained folder with a locked-facts contract. RED checkpoints exit 1 — no exceptions.
---

# ProfitsLocal · Assemble Handoff

The "compile" step. Takes the per-customer v2 workspace and produces a frozen `od-package/` that downstream builders treat as immutable input.

## When to use

- Right after `profitslocal-data-checkpoint` writes `checkpoint.json` with verdict GREEN or YELLOW
- Before `profitslocal-audit-handoff` (which gates on this folder existing)
- Re-run after any upstream fix (`pl:enrich-handoff`, brand-pack regen, etc.)
- Discord drop: `vicwest checkpoint 过了 · assemble 一下`

Do **not** use this skill for: composing the actual website (that's `[PENDING] profitslocal-compose-site`), running enrichment (`profitslocal-entity-enrichment`), or bypassing a RED checkpoint (the gate is non-negotiable).

## Owner SOP

`docs/v3/SOP-DATA-CHECKPOINT.md` §4 (YELLOW preview rules) and `docs/SOP_HANDOFF_CONTRACT.md` (od-package shape).

## Inputs

| File | Required | Notes |
|------|----------|-------|
| `clients/<slug>/v2/checkpoint.json` | yes | verdict must be GREEN or YELLOW. RED → exit 1. |
| `clients/<slug>/v2/handoff/design/` | yes | brand-spec.json + tokens + logo SVGs from `pl:build-design-handoff` |
| `clients/<slug>/v2/handoff/content/` | yes | services.json, about.md, faq.json, hero-copy.json from `pl:enrich-handoff` |
| `clients/<slug>/v2/handoff/structure/page-map.json` | yes | page list + per-page block recipe |
| `clients/<slug>/v2/handoff/core-facts.json` | yes | locked facts (name/phone/address/license) |
| `clients/<slug>/v2/handoff/photos/source/image-manifest.json` | yes | per-image category + quality from `pl:classify-images` |

## Canonical command

```bash
npm run pl:assemble-handoff -- --slug <slug>
```

Exit codes:
- `0` → `od-package/` written, ready for audit
- `1` → RED checkpoint OR required input missing
- `2` → IO / permissions error

## Workflow

```text
1. GATE      · read checkpoint.json · RED → exit 1
2. RESOLVE   · merge core-facts.json + handoff/* sources into a single self-contained tree
3. FACTS     · write od-package/facts.json with locked_facts + facts_policy block
4. BRAND     · copy brand-spec + tokens + agent-handoff + visual-style-contract + 4 logo SVGs
5. CONTENT   · copy services/about/faq/hero-copy verbatim (no transformation)
6. STRUCTURE · copy page-map.json + verify each page's blocks have a recipe
7. PHOTOS    · resolve image-manifest → fixed asset paths under assets/
8. PREVIEW   · if YELLOW · stamp preview_mode=true + inferred_fields[] on output manifest
```

## Output (canonical paths)

```text
clients/<slug>/v2/handoff/od-package/
├── facts.json                 # { schema, locked_facts, facts_policy }
├── brand/
│   ├── brand-spec.json
│   ├── brand-tokens.css
│   ├── agent-handoff.md
│   ├── visual-style-contract.md
│   ├── logo-light.svg
│   ├── logo-dark.svg
│   ├── logo-mark.svg
│   └── favicon.svg
├── content/
│   ├── services.json
│   ├── about.md
│   ├── faq.json
│   └── hero-copy.json
├── structure/
│   └── page-map.json
├── assets/
│   └── work/                  # resolved photo files
└── DESIGN-HANDOFF.md          # consolidated narrative
```

## Facts policy (locked into facts.json)

```json
{
  "schema": "profitslocal.locked-facts.v1",
  "locked_facts": {
    "business_name": "...",
    "phone": "(XX) XXXX XXXX",
    "phone_tel_link": "tel:...",
    "address": "...",
    "city": "...",
    "state": "...",
    "abn": null,
    "license": null,
    "_source_map": { ... }
  },
  "facts_policy": {
    "ai_may_modify": false,
    "phone_format": "AU national",
    "address_format": "verbatim from GBP"
  }
}
```

`ai_may_modify: false` is the hard contract. Downstream compose-site treats `locked_facts` as immutable.

## YELLOW behaviour

When checkpoint verdict is YELLOW, this skill ADDITIONALLY:

1. Writes `od-package/_preview-banner.json` with the inferred-fields list
2. Stamps `facts.facts_policy.preview_mode = true`
3. Reduces `structure/page-map.json` to single-page if `recommended_pages === "single"`
4. Records the YELLOW rationale in `DESIGN-HANDOFF.md` so the renderer knows to show the banner

## Failure & degrade

| Failure | Behaviour |
|---------|-----------|
| `checkpoint.json` missing | exit 1 · hint: `npm run pl:data-checkpoint -- --slug <slug>` |
| Checkpoint RED | exit 1 · hint: read `checkpoint.json.missing[].fix` |
| `image-manifest.json` missing | exit 1 · hint: `npm run pl:classify-images -- --slug <slug>` |
| `brand-spec.json` missing | exit 1 · hint: `npm run pl:build-design-handoff -- --slug <slug>` |
| Content file empty | proceed with `_warnings[]` entry · let `profitslocal-audit-handoff` decide if it's HARD |

## Downstream consumers

| Skill / CLI | Behaviour |
|---|---|
| `profitslocal-audit-handoff` | reads entire `od-package/` for P1-P7 |
| `[PENDING] profitslocal-compose-site` | reads `od-package/` as immutable input |
| `pl:publish-demo` | reads `_preview-banner.json` to render the YELLOW banner |

## Validation

```bash
# On a known-GREEN fixture
npm run pl:assemble-handoff -- --slug vicwest-roofing
ls clients/vicwest-roofing/v2/handoff/od-package/
# expect: facts.json + brand/ + content/ + structure/ + assets/
```

## Handoff to next skill

`profitslocal-audit-handoff` — invoked automatically when this skill exits 0.

## If something looks wrong

- `od-package/` exists but `image-manifest.json` resolved 0 photos → upstream `pl:classify-images` source-dir mismatch (canonical: `handoff/photos/source/`)
- `locked_facts.phone` not in `(XX) XXXX XXXX` format → upstream extract didn't normalize; do not patch in the package
- YELLOW package without `_preview-banner.json` → assemble ran before checkpoint was YELLOW; re-run after checkpoint refresh
