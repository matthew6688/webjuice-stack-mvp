# Session Summary · 2026-05-29 · R37 · 2 blocker recoveries · 3 SHIP clients

> **TL;DR**: 2 SHIP clients (vicwest 91 · a-j 83) → 3 SHIP clients (+ mark-squire 93). 2 upstream blockers fixed: (1) recovered lost `buildCoreExtract` from stash@{0}; (2) wired shared `merge-inferred.js` helper into V1 composer. 1 codex round (R37). 1 commit (`95aa0373`). CANONICAL bumped to v1.1.

## Read this first if you're a new agent

1. **`docs/v3/CANONICAL.md`** (v1.1 · master index · §0 master state + §4 client roster + §9.5 today's highlights)
2. **`CLAUDE.md §7`** (existing-work-discovery rule · prevents wheel-rebuilding)
3. **`CLAUDE.md Communication Style`** (NEW 2026-05-29 · 和 Matthew 用人话 · agent 之间专业)
4. **This doc** for what happened today + what's queued next

## What got fixed today

### Blocker B · pl-llm-extract-core was broken
**Symptom**: `SyntaxError: does not provide an export named 'buildCoreExtract'` · CLI imported a function that didn't exist.

**Root cause**: `buildCoreExtract` + `saveCoreExtract` + `DEEP_PROMPT_TEMPLATE` + `runAiSingle` were implemented 2026-05-18 alongside vicwest's core-extract.json (provider=codex_cli, 2026-05-18T08:36:44Z) but NEVER committed. They were sitting in `stash@{0}` ("phaseA-step0-temp-stash-unrelated-dirty-tree"). The CLI was committed; the library was stashed and forgotten.

**Fix (codex Q-RR-1 b · surgical extract)**: ported the 4 missing symbols into `core/audit/redesign-brief-builder.js` without touching the existing `buildRedesignBrief`/`saveBrief`. Also refactored `runAiCascade` to delegate to `runAiSingle` (600s codex / 900s claude / 25min ollama timeouts · old 240s caused mark-squire to time out on the 70KB deep prompt).

### Blocker A · inferred-data.json wasn't reaching the canonical composer
**Symptom**: `pl:llm-infer-thin-data` wrote `inferred-data.json` with suburbs / testimonials / owner_name back-fill · but `pl:compose-editorial` (V1 canonical) didn't read it. The YELLOW back-fill mechanism only worked on the deprecated OD path via `pl-build-od-seed`.

**Fix (codex Q-RR-3 b · shared helper)**: created `core/handoff/merge-inferred.js` with provenance-tagged merges:
```js
mergeSuburbs(real, inferredData, { minReal: 10, cap: 18 })
mergeTestimonials(real, inferredData, { minReal: 3, cap: 4 })
mergeOwnerName(real, inferredData)
hadInference(inferredData)  // → drives PREVIEW banner
```
Wired into `pl-compose-editorial.js` after `coreExtract` load.

### Side-effect · empty mailto/tel anchors caused M1.3 tap-target vetos
mark-squire has no email · template was rendering `<a href="mailto:"></a>` (0×44px empty anchor) which the M1.3 critical-tap-target check correctly vetoed. Wrapped both contact-row and footer email entries in `{{#client.email}}…{{/client.email}}` guards.

## Anti-gaming preserved (codex Q-RR-4 a)

a-j composite stayed at 83 SHIP · checkpoint stays YELLOW + PREVIEW banner · we did NOT promote a-j to GREEN by counting inferred-as-real. The whole point of the N/A_BLOCKED rule (R35 Q-PP-5) was to prevent audit-gaming · we honor it.

The render is now substantially richer:
- 17 Cairns-area suburbs (was 3)
- 3 Cairns-local testimonials (was 3 Ballarat-area placeholders · wrong region for Cairns client)
- Same `Google review · AI placeholder` source label · same banner

## 4-client status (snapshot)

| Client | Verdict | Composite | Movement |
|---|---|---|---|
| vicwest-roofing | SHIP | 91 A | unchanged (baseline holds after recovery) |
| a-j-roofing-solutions | SHIP | 83 B | unchanged · render quality improved |
| mark-squire-roof-restorations | **SHIP** | **93 A** | **N/A_BLOCKED → SHIP** (was missing customer_brief · upstream recovered) |
| abc-roof-restoration-brisbane | BLOCKED | N/A_BLOCKED | unchanged · genuine data gap (no phone/address) |

## Key insights (R37)

### Lost work hides in stashes
The 2026-05-18 phaseA-step0 stash contained 265 lines of working code that was assumed lost. Always check `git stash list` and `git show 'stash@{N}:path'` when a CLI references a symbol that doesn't exist. Codex Q-RR-1 forced surgical recovery rather than full overwrite — important when stash and current have diverged on other functions.

### Empty hrefs are tap-target vetos
Templates that render `<a href="mailto:{{email}}">{{email}}</a>` produce a 0×44px anchor when `email` is empty. The M1.3 mobile gate correctly flags this. Add `{{#field}}…{{/field}}` guards around EVERY contact-row anchor.

### Anti-gaming > "promote to GREEN"
The handoff doc misframed Task 1 as "promote a-j YELLOW → GREEN". The real success is "rendered HTML has Cairns-local content with provenance disclosure". Composite stays 83 · banner stays ON · ship path remains valid. Codex Q-RR-4 (a).

## Today's commits (in order)

```
1673a1aa  v4 · HANDOFF-NEXT-SESSION · tomorrow's 3 tasks · canonical-conformant
42f9a0fa  v4 · audit loop 2026-05-29 · baselines verified · 2 blockers surfaced
95aa0373  v4 · R37 · Blocker A+B fixes · 3 SHIP clients (was 2)
(this commit)  v4 · CANONICAL v1.1 + SESSION 2026-05-29 + handoff refresh
```

## What MUST be true on next session start

- `docs/v3/CANONICAL.md` v1.1 exists (don't re-litigate locked decisions)
- 4-client audit baselines unchanged: vicwest 91 · a-j 83 · **mark-squire 93** · abc N/A_BLOCKED
- `core/handoff/merge-inferred.js` is the shared writer for YELLOW back-fill merges (don't duplicate)
- `buildCoreExtract` exported from `core/audit/redesign-brief-builder.js` (don't re-stash)
- Template email rows wrapped in `{{#client.email}}` guards (don't unwrap)
- `~/.claude/CLAUDE.md` Communication Style rule pointed (人话 with Matthew · pro with agents)

## What's queued next (deferred · NOT blocking)

1. **abc-roof-restoration-brisbane** · genuine BLOCKED (phone + address missing) · needs MANUAL data input from Matthew before pipeline can run. Decision: do not force.
2. **Premium-tier audit** on vicwest + mark-squire (~$3 total · D2.10 engagement-persuasion + leak-quote + hallucination LLM check). Optional · CANONICAL.md §0 says fast/premium scores never mix · this is a separate question.
3. **Phase B Step 6 · wire pl-audit-rubric** (61 rules currently doc-only) into audit-v4 runtime config. ~2hr work · planned for next session.
4. **Phase B Step 7 · pl:site-report** CLI (9-section provenance · sales material). Builds atop existing audit output.
5. **Lead pipeline orchestration consolidation** (Matthew Q from 2026-05-28 · "我们筛选的标准是什么"). Multi-CLI orchestrator for Hermes Agent. Deferred · canonical first.

## Session end · 2026-05-29 · 1 codex round (R37) · 1 functional commit · 1 doc commit · CANONICAL v1.1

Don't drift. Read CANONICAL.md v1.1 first. Don't re-stash recovered work.
