# Codex consult 12 · step-0 forward plan from real-state architecture

**Date**: 2026-05-27
**Authority**: Matthew. Binding decision. Step 0 → step N.

## Mandatory reading before answering

You must actually read these (not skim, not assume):

1. `docs/v4/00-BUSINESS-LOGIC.md` — Matthew's canonical 7-stage vision, signed today
2. `docs/v4/INFRASTRUCTURE-MAP.md` — code inventory (corrections from earlier consults applied)
3. `docs/v4/CODEX-RESPONSE.md` through `RESPONSE-11.md` — 11 prior consults
4. `docs/v4/skill-audits/01-DEEP.md` / `02-DEEP.md` / `03-DEEP.md` — 3 deep-validated skills
5. `docs/HERMES_WEBSITE_AGENT.md` — explains the design-skill stack we're SUPPOSED to use
6. The 4 deep-discovery reports just produced (enrichment / audit / grading / compose) — summarized in this consult below

If you skip the reading, you'll repeat the shallow generic answers of consults 9-11 and Matthew will reject.

## What Matthew added today (new, beyond V4 docs)

1. **Build step is conversation-driven, not monolithic**. He wants:
   > "我们是否可以装一堆的 design skill 然后再 codex 或者 claude code 里面，不同的对话（每个客户一个对话中）根据已有的信息来做网站（单个页面 或者多个页面）然后发布到 cloudflare pages?"
   - One Claude/Codex conversation per customer
   - That conversation loads a stack of design skills (huashu-design, frontend-design, design-review, design-brief, web-prototype, saas-landing)
   - Reads handoff/od-package + DESIGN.md as immutable input
   - Outputs HTML → publishes to Cloudflare Pages preview
   - Open Design (https://github.com/nexu-io/open-design) is one of many possible builders, NOT the only path

2. **Add Agentic-SEO-Skill** (https://github.com/Bhanunamikaze/Agentic-SEO-Skill) as a T4 sub-audit. New dimension we don't currently cover.

3. **DESIGN.md is the brand contract**:
   - LOCKED: business_name, phone, address, business_scope, brand colors, logo
   - AI may fill: about narrative, FAQ, service long-form, hero copy, stock images
   - Must be the single source of truth for both the build conversation AND the audit

4. **Outreach materials reuse the same pipeline**: slides / presentations / proposal HTML produced from collected customer info + audit findings + solutions. Channels: email · SMS · phone · WhatsApp. We don't need to build channel automation today, just the materials.

## Real architecture state (from 4 deep-discovery sub-agents · 2026-05-27)

### Enrichment signal dictionary (6 sources · ~60 fields)
- WHOIS/RDAP, Wayback, ABN/ABR, Tinyfish-Search, Tinyfish-Homepage, Google Places extractor
- All soft-fail (`safeRun` wraps each)
- `_source` siblings via `domain_age_source` / `fetched_at` / `_meta.trace`

### Audit signal dictionary (14 modules · 89+ signals)
- `site-fetch-full` orchestrates: form-audit, tech-stack-detector, pagespeed-insights, third-party-weight, domain-history, activity-audit, ai-geo-checks, image-optimization, sitemap-analyzer, trust-signals, contact-extraction, logo-extractor
- T1 binary / T2 visual / T3 content / T4 cross-page splits exist
- **140+ extracted signals don't feed grading** — only review_count / rating / audit_score / business_status / niche_match do
- 2 orphan signals: payload.mobileHtml, payload.sitemap.hasRobots

### Grading pipeline (3 stages · concrete gaps)
- Stage 1: cheap-audit-queue → predict_grade ∈ {C, D} only
- Stage 3: lead-grading.js → entity.grade with A/B/C/D
- **Gap 1**: hard-coded global thresholds (`A_AUDIT_MAX=40, A_REVIEWS_MIN=100`) — NOT niche-parametrized (niche-config.json exists but lead-grading doesn't read it)
- **Gap 2**: `cheap_audit.final_score` is computed but lead-grading ignores it
- **Gap 3**: Layer 4 signals (trust, blog, sophistication, ads) only affect product_tier (T1/T2/T3 price), NOT investment_level (A/B/C/D)

### Compose black box (why vicwest=56)
- `pl:compose-site` is template-driven mustache (NOT LLM, NOT huashu-design)
- Does NOT read `issue-fix-matrix.json` (iterate-fix loop is OPEN)
- Does NOT read weatherproof dissection templates (uses flat module library)
- vicwest=56 root cause:
  - T2=29: word_count 1033 < 1500 threshold · single-page squeeze of 23 blocks (should be multi-page · OD generated wrong shape)
  - T4=50: 0 LocalBusiness JSON-LD pages + audit incorrectly flags meta/title/h1 as failing (audit parser bug · HTML has them)
- iterate-fix loop OPEN: `pl-iterate-site` writes FIX-INSTRUCTIONS.md, compose-site doesn't consume it

### Hermes skill stack (37 SKILL.md installed)
- Design: huashu-design, frontend-design, design, design-brief, design-review, web-prototype, saas-landing
- Orchestration: devops/kanban-orchestrator, devops/kanban-worker
- Engineering: software-development/{tdd, systematic-debugging, subagent-driven-development, requesting-code-review, plan, spike}
- **`docs/HERMES_WEBSITE_AGENT.md` says we're SUPPOSED to load these for visual edits**. We don't.

## What I want from you

### A · Architecture decision (1 paragraph)

Given everything above, is the right move to:
- (i) **Wire Hermes website-agent profile** as the build orchestrator · each customer = one Hermes thread · the thread loads huashu-design + design-review + frontend-design · ProfitsLocal canonical skills feed it data
- (ii) **Skip Hermes** and build a thin "design-skill loader" inside Claude Code conversations directly · use kanban-worker pattern manually
- (iii) **Both** in parallel during transition

State your pick + 1-paragraph rationale citing the 4 deep reports.

### B · Step 0 (the first concrete step we should do tomorrow)

Pick exactly ONE of:
1. Fix the 3 vicwest-specific audit bugs (single-page squeeze · JSON-LD missing · audit meta-tag false-fail) — unblocks an existing customer from 56 to >73 without architecture work
2. Build the DESIGN.md contract (the file format + writer + reader · everyone downstream reads it)
3. Wire one Hermes design-skill (huashu-design) into one canonical skill (probably profitslocal-quality-audit since design-review fits there)
4. Add Agentic-SEO-Skill as T5 audit dimension
5. Fix the 3 grading gaps (niche-parametrize thresholds · use cheap_audit.final_score · Layer 4 → investment_level)
6. Stand up the conversation-per-customer build flow as a spike (one customer end-to-end · prove the model)
7. Something else

For your pick:
- First concrete file + 3-bullet description
- Why this before the others
- Stop criterion (how do we know it's done)
- What comes after as step 1, 2, 3 (give 3 next steps so we don't reconsult between each)

### C · 8-skill audit pause

I have 5 more deep-validation rounds queued (skills #4-#8). Should I:
- (i) Pause that work entirely and pivot to your step 0
- (ii) Continue the audit in parallel (it's locked in protocol)
- (iii) Convert remaining 5 audits into something shaped by 00-BUSINESS-LOGIC.md (different protocol)

### D · Reading verification

In your response, cite at least 3 specific file paths + line numbers from my mandatory reading list. If you don't, I'll know you skimmed and won't trust the rest.

## Constraints

- 95% confidence rule
- Allowed paths: `core/`, `scripts/cli/`, `scripts/test/`, `skills/`, `docs/v4/`, plus `clients/<slug>/v2/master.md` and `clients/<slug>/v2/handoff/*` per RESPONSE-6 and RESPONSE-8 narrow authorizations
- Never AI-generate core facts
- Pre-commit must stay clean (it's clean now)
- DO NOT propose another consult round before delivering step 0

Write your answer to `docs/v4/CODEX-RESPONSE-12.md`. Under 200 lines. Cite file:line liberally.
