---
name: profitslocal-quality-audit
description: Use AFTER a website has been built (by the still-experimental `pl:compose-site` / OD pipeline) and BEFORE deciding whether to ship it. Runs the canonical 4-tier audit standard — T1 zero-tolerance binary checks · T2/T3/T4 0-100 dimension scores · composite ≥ 73 to ship. T1 fact failures (wrong name/phone/address/wrong-state authority) block publish regardless of how high the other tiers score. Owns the ship/no-ship verdict for built sites.
---

# ProfitsLocal · Quality Audit

The 4-tier ship gate. The only audit allowed to say "this is good enough to send to a customer".

## When to use

- After `pl:compose-site` (or any builder) produces a rendered site directory
- Before publishing to Cloudflare Pages / sending to customer
- During the iterate-fix loop (with `max 3 iterations` policy)
- Discord drop: `vicwest 这次 build 出来分多少？`

Do **not** use this skill for: pre-build sanity (that's `profitslocal-audit-handoff`), data-readiness check (that's `profitslocal-data-checkpoint`), or per-page SEO scans of live URLs (`pl:audit-website-output`).

## Owner SOP

`docs/v3/SOP-AUDIT-STANDARD.md` (canonical · v3 · 2026-05-21) — 4-tier definitions, T1 binary list, T2-T4 dimensions, composite formula, ship threshold.

## Inputs

| File | Required | Notes |
|------|----------|-------|
| Built site directory | yes | rendered HTML/CSS/assets; default `clients/<slug>/v2/build/` or `--out` |
| `clients/<slug>/concept/open-design-seed/facts.json` | yes | for T1 fact cross-check (built site must NOT contradict locked facts) |
| `clients/<slug>/v2/customer-brief.md` | yes | for T3 content fidelity dimension |

## Canonical command

```bash
npm run pl:audit-tier -- --slug <slug> --out <build-dir>
```

Exit codes:
- `0` → composite ≥ 73 AND T1 PASS → ship-eligible
- `1` → any T1 fail OR composite < 73 → no-ship · fix loop
- `2` → IO / parse error

## The 4 tiers

| Tier | Type | Pass criterion | Examples |
|---|---|---|---|
| **T1** Binary facts | zero-tolerance | every check PASS | name appears verbatim · phone matches `tel:` link · address matches GBP · license number not invented · wrong-state authority ban (VIC→VBA / QLD→QBCC / NSW→Fair Trading / WA→Building Commission) |
| **T2** Visual / UX | 0-100 | dimension score | hero quality · typography hierarchy · spacing · color contrast · CTA prominence |
| **T3** Content fidelity | 0-100 | dimension score | service list completeness · about-page narrative match · no AI-generated core facts · no clichés ("trusted partner" / "years of excellence") |
| **T4** Cross-page consistency | 0-100 | dimension score | nav/footer parity · brand-token reuse · meta-tag completeness · no orphan pages |

**Composite** = weighted average of T2/T3/T4 (T1 is a gate, not a score). Default ship threshold: **composite ≥ 73** AND T1 PASS.

If Matthew's target is ≥ 90 (canonical-build graduation criterion · `docs/v4/CODEX-RESPONSE.md §C.4`), set `--ship-threshold 90`.

## T1 examples (zero-tolerance · any single fail blocks ship)

- Business name on hero ≠ facts.business_name → FAIL
- Phone in header ≠ phone_tel_link → FAIL
- "Licensed by ABCC" when state is QLD (QBCC is the real authority) → FAIL
- ABN written but `facts.abn === null` → FAIL (invented)
- Review count printed but `facts.google_review_count === 0` → FAIL

## Output

```text
<build-dir>/_tier-audit.json
{
  "T1": { "pass": true, "checks": [...], "fails": [] },
  "T2": { "score": 78, "dimensions": {...} },
  "T3": { "score": 81, "dimensions": {...} },
  "T4": { "score": 74, "dimensions": {...} },
  "composite": 77.8,
  "grade": "ship-eligible",
  "verdict": "PASS"
}

<build-dir>/_tier-audit.md
# Human-readable companion report (no emojis · Matthew rule)
```

## Iterate-fix loop (max 3 iterations)

If composite is 60-72 (close but not shipping), `pl:iterate-site` reads `_tier-audit.json` + builds a `fix-instructions.md` + re-runs compose. After 3 iterations without crossing 73, halt — base regression goes upstream (data / brief / DESIGN family), not in the fix loop. Reference: user-memory `feedback_audit_4tier_standard.md` + `feedback_audit_feedback_loop.md`.

## Failure & degrade

| Failure | Behaviour |
|---------|-----------|
| Build dir missing | exit 2 · hint: pass `--out` or run `pl:compose-site` first |
| `facts.json` missing | exit 2 · cannot run T1 without locked facts |
| T1 fails AND T2-T4 score high | still verdict FAIL · T1 is non-negotiable |
| Composite borderline (71-72) | verdict FAIL · enter iterate-fix loop |

## Provenance / never-invent contract

T3 has a dedicated dimension for AI-fabricated core facts. If the built site shows a service that's NOT in `facts.json.locked_facts` or `core-extract.json.real_facts.service_list`, that's a T3 deduction AND likely a T1 fail too (depending on the field).

## Downstream consumers

| Skill / CLI | Behaviour |
|---|---|
| `pl:publish-demo` | refuses to publish if `_tier-audit.json.verdict !== PASS` |
| `pl:iterate-site` | reads `_tier-audit.json` for the fix-instructions.md generator |
| `pl:build-od-seed` (RED gate) | reads `composite` to decide demo readiness |

## Validation

```bash
# Run on a known-good rendered site
npm run pl:audit-tier -- --slug vicwest-roofing --out clients/vicwest-roofing/v2/build
# Current state: vicwest ≈ 89 · target ≥ 90 for canonical-build graduation
```

## Handoff to next step

- `verdict === PASS` → `pl:publish-demo`
- `verdict === FAIL` with composite ≥ 60 → `pl:iterate-site` (max 3 loops)
- `verdict === FAIL` with composite < 60 → upstream regression · go back to brief / DESIGN family, NOT another build iteration

## If something looks wrong

- T1 says phone fails but visually it looks correct → check `tel:` href, not just display text
- Composite high (85+) but T1 fails → that's correct behaviour · ship gate is T1 AND composite, not OR
- "wrong-state authority" T1 fail keeps recurring → DESIGN template hard-codes a state-specific authority somewhere; do not patch per-customer, fix the template
- Audit times out on a 10-page site → `core/audit/site-fetch-full.js` may be hitting headless-Chrome contention; reduce parallelism, do not bypass the audit
