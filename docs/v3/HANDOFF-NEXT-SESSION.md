# HANDOFF · Next Session · 2026-05-28 → 2026-05-29

> **Full path**: `/Users/matthew/Developer/google-map-website-v3/docs/v3/HANDOFF-NEXT-SESSION.md`
>
> **Opening line for new agent**: "Read `docs/v3/CANONICAL.md` first · then this handoff · then start."

---

## ⏱ First 5 minutes · sanity check

Run these commands to verify session integrity:

```bash
cd /Users/matthew/Developer/google-map-website-v3

# 1. State of canonical docs (must exist)
ls docs/v3/CANONICAL.md \
   docs/v3/SOP-AUDIT-STANDARD-V2.md \
   docs/v3/CANONICAL-DECISION-RECORD-RENDER-PATH.md \
   docs/v3/SESSION-2026-05-28-SUMMARY.md

# 2. 4-client audit baselines (must match)
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
#   mark-squire-roof-restorations: N/A_BLOCKED · BLOCKED · GATE 1 RED
#   abc-roof-restoration-brisbane: N/A_BLOCKED · BLOCKED · GATE 1 RED

# 3. Verify vicwest editorial output still clean
node scripts/cli/pl-audit-v4.js --slug vicwest-roofing \
  --output-dir clients/vicwest-roofing/v2/editorial-output --tier fast 2>&1 | tail -3

# 4. Check git state
git log --oneline -5
# Last commit should be: 3a0d1d68 SESSION-2026-05-28 summary
```

If any of above fails · STOP · investigate before proceeding.

---

## 🎯 Tomorrow's mission · 3 tasks · ~3 hr total

### Task 1 · Promote a-j YELLOW → GREEN (~45 min)

**Why**: Codex R35 Q-PP-4 (b) · 3 GREEN clients > 2 for canonical evidence strength.

**Steps**:
```bash
# 1. Check current a-j checkpoint state
cat clients/a-j-roofing-solutions/v2/checkpoint.json | python3 -m json.tool | head -30

# 2. Run thin-data infer (existing CLI · fills testimonials + suburbs_served + owner_name)
npm run pl:llm-infer-thin-data -- --slug a-j-roofing-solutions

# 3. Re-checkpoint · expect verdict = GREEN
npm run pl:data-checkpoint -- --slug a-j-roofing-solutions

# 4. Re-render
npm run pl:compose-editorial -- --slug a-j-roofing-solutions

# 5. Re-audit
npm run pl:audit-v4 -- --slug a-j-roofing-solutions --output-dir clients/a-j-roofing-solutions/v2/editorial-output --tier fast

# Success bar (codex R36 Q-QQ-3 b):
#   verdict = GREEN
#   composite ≥ 83 (no regression from current baseline)
#   M1 mobile PASS · T4d ≥ 90 · D2.14 ≥ 60
```

**If FAIL**: don't force · investigate. a-j may have limits.

---

### Task 2 · mark-squire upstream try (~30 min · single attempt)

**Why**: Codex R35 Q-PP-3 (b) · try once · skip if thin.

**Steps**:
```bash
# 1. Try third-party mention enrichment (~$0.20)
npm run pl:summarize-external-mentions -- --slug mark-squire-roof-restorations

# 2. Re-extract core
npm run pl:llm-extract-core -- --slug mark-squire-roof-restorations

# 3. Re-render brief
npm run pl:render-customer-brief -- --slug mark-squire-roof-restorations

# 4. Re-checkpoint · target YELLOW or GREEN
npm run pl:data-checkpoint -- --slug mark-squire-roof-restorations

# Decision:
#   If checkpoint = YELLOW or GREEN → proceed compose-editorial + audit
#   If checkpoint = RED → genuinely thin client · SKIP · mark "deferred · needs manual data"
```

**Don't force it**: mark-squire has no website + 3 reviews. If external mentions don't lift it · move on.

---

### Task 3 · Phase B Step 6 · wire pl-audit-rubric into audit-v4 (~2 hr · if Tasks 1+2 finish early)

**Why**: SOP-AUDIT-STANDARD-V2 §6 mandate · 61 rules in `skills/pl-audit-rubric/pl-audit-rubric.json` are currently **doc-only** · zero CLI consumes them. Wire as runtime config.

**Steps**:
```bash
# 1. Read current rubric structure
cat skills/pl-audit-rubric/pl-audit-rubric.json | python3 -c "
import json, sys
d = json.load(sys.stdin)
print('rules count:', len(d.get('rules', [])))
print('sections:', [s.get('id') for s in d.get('sections', [])])
print('sample rule:', d['rules'][0] if d.get('rules') else 'empty')
"

# 2. Build runtime loader in audit-v4
# - Read rubric on startup · validate schema (codex R26 Q-GG-5)
# - For each rule_id · dispatch to existing module (T1.1 → check function · etc.)
# - Emit rubric_hash + audit_version in every output (CANONICAL §7 hash schema)

# 3. Update SOP-AUDIT-STANDARD-V2 §6 status: "WIRED" not "doc-only"

# 4. Re-audit vicwest to verify · expect composite 91 unchanged
npm run pl:audit-v4 -- --slug vicwest-roofing --output-dir clients/vicwest-roofing/v2/editorial-output --tier fast
```

---

## ⚠️ Things NOT to do tomorrow (canonical anti-drift)

| Don't | Why |
|---|---|
| Propose new render path | V1 locked · re-test triggers in CANONICAL §8 must be met first |
| Re-litigate OD or Path C | Already tested · already lost · evidence in `experiments/3path-experiment-2026-05-28/` |
| Build new audit dim | 8 dims wired · 3 deferred (D2.13/D3.10/M1.4-5) · don't add unless 3-path experiment retest produces ambiguous winner (codex R30 Q-KK-5) |
| Multi-page rendering | Phase B = single-page only · Matthew lock 2026-05-28 |
| Expand to electrician/plumber niche | Phase B = roofing only · need 5+ live paying roofers first |
| --skip-checkpoint for production renders | Dev/debug only · GATE 1 must pass for ship |
| Mix fast-tier and premium-tier composite | SOP §5 separation · different questions |
| Average D2.10 across pages | Single-page focus · 1 score |

---

## 📋 If Matthew drops new images overnight

Per V3 prompts dispatched today (`templates/roofing/stock-library/IMAGE-PROMPTS-V3.md`):
- 15 prompts · 18 expected files
- Drop location: `templates/roofing/stock-library/` root
- Workflow:
  1. Move files to subdirs (hero/service/about/detail/equipment/gallery) per filename prefix
  2. Update `_manifest.json` with `added_v3: 2026-05-29` flag
  3. Cross-reference IMAGE-PROMPTS-V1/V2 manifest to avoid duplicates
  4. Commit batch
  5. Send V4 prompts if Phase B Step 5 reveals more gaps

---

## 📌 Open questions from Matthew (deferred · NOT blocking)

These need codex consultation when Phase B Step 5+ completes. Don't address tomorrow unless Matthew explicitly asks.

1. **Lead pipeline orchestration consolidation**
   - Matthew Q (2026-05-28): "我们筛选的标准是什么 · 客户从不同渠道进来 · license · DB integration · photo curation"
   - Multiple CLIs exist · need unified orchestrator + explicit thresholds
   - Goal: modular CLI callable from Hermes Agent
   - When: after V1 canonical proven on 3+ live clients

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

**Yesterday (2026-05-28) summary**: 37 commits · 12 codex consensus rounds (R26-R36) · canonical v1.0 locked. V1 `pl:compose-editorial` proven on 2 SHIP clients (vicwest + a-j) · audit 7-gate hierarchy with N/A_BLOCKED rule prevents audit-gaming. Path A (OD) + Path C (LLM whole-page) both archived with re-test triggers.

**Key empirical insight**: less LLM freedom = better quality. Template encodes design SYSTEM · LLM constrained to copy fields. Whole-page LLM render loses -71pt token coverage · 11pt variance · 50% mobile veto rate.

**Audit anti-gaming**: empty content (abc 0 services) was scoring composite 99 via absence-of-bad. N/A_BLOCKED rule now prevents that. Checkpoint GATE is the true filter · not composite alone.

**Read order**: CANONICAL.md → CLAUDE.md §7 → this doc → start.

---

## ✅ Done-of-tomorrow definition

Session is successful if at end of day:
- **a-j is GREEN with composite ≥83 SHIP** (3rd GREEN client · canonical evidence strengthened)
- **mark-squire either GREEN/YELLOW SHIP OR explicitly skipped with reason logged**
- **(stretch) pl-audit-rubric wired into audit-v4** · 61 rules dispatched · rubric_hash in output

If reach those · close session · update CANONICAL.md §4 client roster · write next handoff.

If hit blockers · don't force · document blocker · stop · brief Matthew.

---

## 🎬 Session start prompt (paste this as new agent input)

```
Read /Users/matthew/Developer/google-map-website-v3/docs/v3/HANDOFF-NEXT-SESSION.md
then start Task 1 (promote a-j YELLOW → GREEN). 
Discuss with codex if anything is ambiguous. 
Don't drift back to deprecated paths (CANONICAL.md §1).
```

Last update: 2026-05-28 23:50 AET · session close · canonical v1.0 locked · 37 commits · 12 rounds.
