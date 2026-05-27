---
name: profitslocal-audit-handoff
description: Use after `profitslocal-assemble-handoff` produced `od-package/` and BEFORE any expensive website build attempt. Runs 7 layered pre-build checks (P1 structural · P2 image-manifest · P3 brand-pack · P4 content · P5 meta-language · P6 facts · P7 design-md) and either passes or blocks build with concrete fix hints. Catches input bugs that would waste LLM/compose spend if discovered post-build.
---

# ProfitsLocal · Handoff Audit

The last cheap gate before expensive build runs. P1-P7 in one pass · halts on any HARD failure.

## When to use

- Right after `profitslocal-assemble-handoff` exits 0
- Before any `pl:compose-site` / OD pipeline / `pl:publish-demo`
- Re-run after fixing any P-layer failure
- Discord drop: `vicwest 这单能 build 了吗？`

Do **not** use this skill for: scoring the built site (that's `profitslocal-quality-audit` on the rendered output), enforcing publish rules (`pl:publish-demo` owns those), or live-site SEO checks (`pl:audit-website-output`).

## Owner SOP

`docs/v3/SOP-AUDIT-STANDARD.md` §2 (pre-build P-layers). T1 zero-tolerance + provenance contract.

## Inputs

| File | Required | Notes |
|------|----------|-------|
| `clients/<slug>/v2/handoff/od-package/` | yes | self-contained package from `profitslocal-assemble-handoff` |
| `--dir <path>` | optional | override default location (CI fixtures, alt batches) |

## Canonical command

```bash
npm run pl:audit-handoff -- --dir clients/<slug>/v2/handoff/od-package
```

Exit codes:
- `0` → all HARD layers PASS (SOFT may have warnings)
- `1` → any HARD layer FAIL · build BLOCKED
- `2` → IO / config error

## The 7 layers

| Layer | Gate | What it checks | On fail |
|---|---|---|---|
| **P1** structural-completeness | HARD | all 16 required files exist (DESIGN-HANDOFF.md, facts.json, brand/*, content/*, structure/*) | exit 1 · list missing paths |
| **P2** image-manifest | HARD | `image-manifest.json` exists · every role mapped to a real photo (not a logo) · ≥ 4 gallery items · 1 homepage-hero | exit 1 · suggest `pl:classify-images` |
| **P3** brand-pack | HARD | `brand-spec.json` valid · 4 logo SVGs · tokens CSS parses · all 8 role slots filled | exit 1 · suggest `pl:build-design-handoff` |
| **P4** content | HARD | services count ≥ 2 · about.md word count threshold · faq ≥ 3 · hero-copy non-empty | exit 1 · suggest `pl:enrich-handoff` |
| **P5** meta-language | SOFT | forbidden tokens (`concept`, `preserve`, `placeholder`, `template`, `seed`, `handoff`, `niche typical`, `verified:scraped`) in customer-facing files (provenance metadata stripped before scan) | soft warn |
| **P6** facts | HARD | `business_name/phone/phone_tel_link/city/state` present · phone matches AU regex · `tel:` prefix · address recommended | exit 1 · concrete field name |
| **P7** design-md | SOFT | `DESIGN-HANDOFF.md` exists · points to a family or override that resolves | soft warn |

P5 detector now strips internal provenance metadata (`_source` / `_meta_*` / HTML comments / JSON `source`/`notes`/`generator` keys) before scanning — so `verified:scraped` in a `_source` field does NOT trigger a leak (fixed 2026-05-27 with Codex Move C).

## Output

```text
clients/<slug>/v2/handoff/od-package/_handoff-audit.json
{
  "pass": true,
  "layers": [
    {"layer": "P1 · structural-completeness", "gate": "HARD", "pass": true, "failures": 0, "detail": []},
    ...
  ],
  "summary": { "hard_fail": 0, "soft_fail": 0 }
}
```

Plus console output with ✅/⚠️/❌ per layer + 1-line "OVERALL: ✅ PASS (0 hard · 0 soft)".

## Failure & degrade

| Failure | Behaviour |
|---------|-----------|
| `od-package/` missing | exit 1 · hint: `npm run pl:assemble-handoff -- --slug <slug>` |
| Hard layer fails | exit 1 with explicit field list · no partial-pass |
| Multiple hard fails | report all, not just the first · operator-friendly |
| Soft layer fails | log + continue · audit JSON still written |

## Downstream consumers

| Skill / CLI | Behaviour |
|---|---|
| `[PENDING] profitslocal-compose-site` | refuses to run if `_handoff-audit.json.pass !== true` |
| `pl:publish-demo` | reads `_handoff-audit.json.summary` for the publish gate |

## Provenance & never-invent contract

Audit reads facts but NEVER modifies them. If a fact looks wrong, this skill flags it — does not "fix" it. Core facts (name/phone/address/license/abn/services) must come from real sources; AI-inferred core facts are a P4/P6 hard fail regardless of how good they look.

## Validation

```bash
# Known-good baseline
npm run pl:audit-handoff -- --dir clients/vicwest-roofing/v2/handoff/od-package
# expect: 0 hard · 0 soft after Move C (2026-05-27)
```

## Handoff to next skill

When `pass === true`, the next step in the pipeline is the **PENDING** website-build layer (not yet a canonical skill — see `docs/v4/CODEX-RESPONSE.md §C.4`). After build, `profitslocal-quality-audit` takes over.

## If something looks wrong

- P5 flags `verified:scraped` despite the strip — check if the token appears in customer-visible copy (not in `_source` keys); the strip only covers metadata
- P2 says `gallery only has 0 items` — `pl:classify-images` ran but quality_score threshold rejected all sources; check `image-manifest.json` per-photo `usable` flags
- P6 phone format fail — handoff/od-package/facts.json phone must be `(XX) XXXX XXXX` / `XXXX XXX XXX` / `04XX XXX XXX`. Inline-edit only if upstream extractor is broken AND you'll file a fix upstream.
