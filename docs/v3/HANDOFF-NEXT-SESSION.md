# HANDOFF · Next Session · 2026-05-29 → next

> **Full path**: `/Users/matthew/Developer/google-map-website-v3/docs/v3/HANDOFF-NEXT-SESSION.md`
>
> **Opening line for new agent**: "Read `docs/v3/CANONICAL.md` v1.1 first · then `SESSION-2026-05-29-SUMMARY.md` · then this handoff · then start."

---

## ⏱ First 5 minutes · sanity check

```bash
cd /Users/matthew/Developer/google-map-website-v3

# 1. Canonical docs (must exist · v1.1)
ls docs/v3/CANONICAL.md \
   docs/v3/SOP-AUDIT-STANDARD-V2.md \
   docs/v3/CANONICAL-DECISION-RECORD-RENDER-PATH.md \
   docs/v3/SESSION-2026-05-28-SUMMARY.md \
   docs/v3/SESSION-2026-05-29-SUMMARY.md \
   core/handoff/merge-inferred.js
head -1 docs/v3/CANONICAL.md   # must say v1.1

# 2. 4-client audit baselines (must match · mark-squire now SHIP)
for slug in vicwest-roofing a-j-roofing-solutions mark-squire-roof-restorations abc-roof-restoration-brisbane; do
  python3 -c "
import json
try:
  d=json.load(open('clients/$slug/v2/editorial-output/audit-v4-full.json'))
  print('$slug:', d.get('composite'), '·', d.get('grade'), '·', d.get('ship_verdict','')[:60])
except: print('$slug: NO AUDIT')
"
done

# Expected:
#   vicwest-roofing: 91 · A · SHIP
#   a-j-roofing-solutions: 83 · B · SHIP
#   mark-squire-roof-restorations: 93 · A · SHIP        ← NEW (was N/A_BLOCKED)
#   abc-roof-restoration-brisbane: N/A_BLOCKED · BLOCKED · GATE 1 RED

# 3. Verify recovered exports still load
node -e "import('./core/audit/redesign-brief-builder.js').then(m => console.log(Object.keys(m).sort().join('·')))"
# Expected: buildCoreExtract·buildRedesignBrief·saveBrief·saveCoreExtract

node -e "import('./core/handoff/merge-inferred.js').then(m => console.log(Object.keys(m).sort().join('·')))"
# Expected: hadInference·inferredFieldNames·loadInferred·mergeExperience·mergeOwnerName·mergeServices·mergeSuburbs·mergeTestimonials

# 4. Git state
git log --oneline -5
# Recent: doc-refresh · 95aa0373 R37 blocker fixes · 42f9a0fa audit loop · 1673a1aa handoff
```

If any of above fails · STOP · investigate before proceeding.

---

## 🎯 Next session priorities (ranked · pick one or more)

### Priority 1 · Phase B Step 6 · wire pl-audit-rubric (~2 hr)

61 rules in `skills/pl-audit-rubric/pl-audit-rubric.json` are currently **doc-only** · audit-v4 doesn't consume them. Per SOP-AUDIT-STANDARD-V2 §6 mandate · this needs wiring.

```bash
# Inspect current rubric structure
cat skills/pl-audit-rubric/pl-audit-rubric.json | python3 -c "
import json, sys
d = json.load(sys.stdin)
print('rules count:', len(d.get('rules', [])))
print('sections:', [s.get('id') for s in d.get('sections', [])])
print('sample rule:', d['rules'][0] if d.get('rules') else 'empty')
"

# Build runtime loader in audit-v4
# - Read rubric on startup · validate schema (codex R26 Q-GG-5)
# - For each rule_id · dispatch to existing module
# - Emit rubric_hash + audit_version in every output (CANONICAL §7 hash schema)

# Update SOP-AUDIT-STANDARD-V2 §6 status: "WIRED" not "doc-only"

# Re-audit vicwest to verify · expect composite 91 unchanged
npm run pl:audit-v4 -- --slug vicwest-roofing --output-dir clients/vicwest-roofing/v2/editorial-output --tier fast
```

### Priority 2 · Premium-tier audit on 3 SHIP clients (~$5 · ~30min)

Fast-tier composite is necessary but not sufficient per CANONICAL §3 GATE 6. Premium-tier adds LLM-driven D2.10 engagement-persuasion + leak-quote detection + hallucination check.

```bash
for slug in vicwest-roofing a-j-roofing-solutions mark-squire-roof-restorations; do
  npm run pl:audit-v4 -- --slug $slug \
    --output-dir clients/$slug/v2/editorial-output --tier premium
done
```

Expected: vicwest stays ≥85 · a-j and mark-squire show D2.10 LLM scoring. **Don't mix** with fast composite (SOP §5).

### Priority 3 · Phase B Step 7 · pl:site-report CLI (~3 hr)

9-section provenance report · what was real vs AI · which skills consumed · sales material. Builds atop existing audit output. Spec in `docs/v3/SOP-AUDIT-STANDARD-V2.md` §11.

### Priority 4 · abc-roof-restoration-brisbane manual unblock (depends on Matthew)

abc is genuinely BLOCKED — missing phone + address means no crawl is possible. Decision deferred to Matthew. If unblocked, the pipeline is: manual `single-page-brief.yaml` edit → `pl:llm-extract-core` → `pl:render-customer-brief` → `pl:data-checkpoint` → `pl:compose-editorial` → `pl:audit-v4`.

---

## ⚠️ Things NOT to do (canonical anti-drift)

| Don't | Why |
|---|---|
| Re-stash `buildCoreExtract` | Recovered today (R37) · CANONICAL §0 locked · was lost once already |
| Add another reader of `inferred-data.json` outside `merge-inferred.js` | Helper is the shared writer · per codex Q-RR-3 (b) |
| Render `<a href="mailto:{{email}}">` without `{{#client.email}}` guard | M1.3 tap-target veto · today's side-effect fix |
| Promote a-j or mark-squire to GREEN by counting inferred-as-real | Anti-gaming · CANONICAL §3 GATE 1 · codex Q-RR-4 (a) |
| Force abc through pipeline without manual data | Genuine blocker · not a pipeline gap |
| Propose new render path | V1 locked · re-test triggers in CANONICAL §8 must be met first |
| Re-litigate OD or Path C | Already tested · already lost · evidence in `experiments/3path-experiment-2026-05-28/` |
| Build new audit dim | 8 dims wired · 3 deferred (D2.13/D3.10/M1.4-5) · don't add unless 3-path experiment retest produces ambiguous winner (codex R30 Q-KK-5) |
| Multi-page rendering | Phase B = single-page only · Matthew lock 2026-05-28 |
| Expand to electrician/plumber niche | Phase B = roofing only · need 5+ live paying roofers first |
| `--skip-checkpoint` for production renders | Dev/debug only · GATE 1 must pass for ship |
| Mix fast-tier and premium-tier composite | SOP §5 separation · different questions |

---

## 📋 If Matthew drops new images overnight

Per V3 prompts dispatched 2026-05-28 (`templates/roofing/stock-library/IMAGE-PROMPTS-V3.md`):
- 15 prompts · 18 expected files
- Drop location: `templates/roofing/stock-library/` root
- Workflow:
  1. Move files to subdirs (hero/service/about/detail/equipment/gallery) per filename prefix
  2. Update `_manifest.json` with `added_v3: 2026-05-29+` flag
  3. Cross-reference IMAGE-PROMPTS-V1/V2 manifest to avoid duplicates
  4. Commit batch
  5. Send V4 prompts if any of next-session priorities reveal more gaps

---

## 📌 Open questions from Matthew (deferred · NOT blocking)

These need codex consultation when current priorities complete. Don't address unless Matthew explicitly asks.

1. **Lead pipeline orchestration consolidation**
   - Matthew Q (2026-05-28): "我们筛选的标准是什么 · 客户从不同渠道进来 · license · DB integration · photo curation"
   - Multiple CLIs exist · need unified orchestrator + explicit thresholds
   - Goal: modular CLI callable from Hermes Agent
   - When: after V1 canonical proven on 5+ live clients (currently 3 SHIP-ready)

2. **V4 client funnel** (Matthew mentioned · needs re-investigation)
   - Different scoring tiers (A/B/C/D qualification)
   - Database integration for industry-database leads
   - Photo curation pipeline (high-quality customer photo vs template fallback)
   - Where stored: investigate `core/leads/` + `core/funnel/` + skills/lead-ops

3. **Upstream voice-fix CLI generalization**
   - Currently 1-off regex on vicwest narrative
   - Codex R34 Q-OO-1 (B) approved extending `pl:rewrite-narrative` with banned-phrase enforcement + strict factual context
   - Build when 2+ clients have banned-phrase issue (currently only vicwest)

---

## 🧠 Context · if you need it

**2026-05-28 (yesterday)**: 37 commits · 12 codex consensus rounds (R26-R36). Canonical v1.0 locked. V1 `pl:compose-editorial` proven on 2 SHIP clients (vicwest + a-j). N/A_BLOCKED anti-gaming rule (R35 Q-PP-5).

**2026-05-29 (today)**: 1 codex round (R37) · 2 functional commits + doc refresh. Recovered `buildCoreExtract` from stash · wired `merge-inferred.js` helper · fixed empty-mailto template bug. **3 SHIP clients** (vicwest 91 · a-j 83 · mark-squire 93). abc still genuinely BLOCKED.

**Read order**: CANONICAL.md v1.1 → SESSION-2026-05-29-SUMMARY.md → this doc → start.

---

## ✅ Done-of-next-session definition

Session is successful if at end of day:
- **Priority 1 done**: pl-audit-rubric 61 rules wired into audit-v4 dispatch · rubric_hash in output · vicwest re-audit holds 91
- **OR Priority 2 done**: premium-tier audit on 3 SHIP clients · D2.10 LLM scoring captured · scores logged separately from fast composite
- **OR Priority 3 done**: pl:site-report CLI shipping 9-section provenance per CANONICAL.md §3

If reach those · close session · update CANONICAL.md §4 client roster · write next handoff.

If hit blockers · don't force · document blocker · stop · brief Matthew (人话 · per CLAUDE.md Communication Style).

---

## 🎬 Session start prompt (paste this as new agent input)

```
Read /Users/matthew/Developer/google-map-website-v3/docs/v3/CANONICAL.md (v1.1)
then /Users/matthew/Developer/google-map-website-v3/docs/v3/HANDOFF-NEXT-SESSION.md.
Pick a priority from §"Next session priorities"
Discuss with codex if anything is ambiguous.
Don't drift back to deprecated paths (CANONICAL §1).
Don't re-stash recovered work (CANONICAL §0 · the merge-inferred + buildCoreExtract rows).
```

Last update: 2026-05-29 · session close · CANONICAL v1.1 · 1 codex round (R37) · 3 SHIP clients.
