/**
 * V3 cycle-26 (2026-05-15 · Matthew sign-off) · Single source of truth for
 * everything that surfaces in Discord (#website-leads + #website-projects +
 * #lead-discovery-runs + #website-tasks).
 *
 * Why: cycle-21..25 fixed scattered string literals in 7 emit sites and kept
 * leaving stragglers. Every "we forgot to update file X" failure is a missing
 * import from this file.
 *
 * Rules (enforced by scripts/ops/lint-message-literals.js + pl-cycle-doctor.js):
 *   - All cross-file concept strings MUST live here.
 *   - Emit sites import these constants. Literal duplication is a lint fail.
 *   - DEPRECATED_TERMS must NOT appear anywhere (except inside this file).
 *
 * When the contract changes:
 *   - Bump CONTRACT_VERSION
 *   - Update DEPRECATED_TERMS to ban the prior form
 *   - Update pl-discord-snapshot.js assertions in the same commit
 *   - Rerun pl:cycle-doctor — must exit 0
 */

export const CONTRACT_VERSION = '26.0.0';

// ─── 9-stage audit pipeline labels · 1-indexed (Stage 1-9 of 9) ────────────
// cycle-26 update (2026-05-15 · Matthew test): renamed 0/8..8/8 → 1/9..9/9
// so "9 stages" intro matches denominator and "Stage 1/9" reads naturally.
// Stage 1 was Stage 0 (intake/scraper) · Stage 9 was Stage 8 (publish).
//
// Used by: run-audit-pipeline.js · audit-stage-messages.js · lead-grading.js ·
//          pl-build-from-reference.js · pl-publish-demo.js · cheap-audit-queue.js
export const STAGE_LABELS = Object.freeze({
  1: 'Stage 1/9 · 抓客户',                         // docker scraper · entity 入库
  2: 'Stage 2/9 · 排除筛选',                       // 3-layer + LLM niche-judge
  3: 'Stage 3/9 · 网站审计',                       // Playwright 单页 fetch · DOM rules · screenshots
  4: 'Stage 4/9 · 视觉审计',                       // Vision LLM 看截图
  5: 'Stage 5/9 · 打分定级',                       // 综合 → A/B/C/D
  6: 'Stage 6/9 · 内部审计报告 (本地)',           // master.md + customer audit HTML
  7: 'Stage 7/9 · 资格复核',                       // Firecrawl multi-page + 7 hard gates + scorecard
  8: 'Stage 8/9 · 建 demo',                        // build-from-reference (本地 Cloudflare Pages build)
  9: 'Stage 9/9 · 发布上线',                       // wrangler publish → live URL + graduate
});

export const PIPELINE_INTRO = '**Audit pipeline 启动** · 9 stages · 预计 2-5 min';

// ─── Profile card sections (cycle-20 ━━━ format) ────────────────────────────
// Used by: core/funnel/profile-card.js
export const PROFILE_SECTIONS = Object.freeze([
  '基本信息',
  '联系方式',
  '审计结论',
  '在线资源',     // post-publish: Demo + 4 docs
  '现状证据',     // screenshots / video / evidence PNG (always, pre & post)
  '线索来源',
  '销售进程',
]);

// ─── Phase title prefix tags ────────────────────────────────────────────────
// thread title = `[<niche>] [<state>] [<grade>] <business name>`
// state ∈ STATE_TAGS, grade ∈ GRADE_TAGS
export const STATE_TAGS = Object.freeze({
  auditing:        '[审中]',   // Stage 0-3 进行中 (or Stage 4 just done · grade 未稳定)
  ready_to_build:  '[待建]',   // Stage 6 pass scorecard ≥ 60
  qa_pending:      '[待补]',   // Stage 6 fail scorecard < 60 · operator 补字段
  pending_publish: '[待发]',   // Stage 7 done · Stage 8 进行中 (projects channel)
  published:       '[已发]',   // Stage 8 done · sales_stage 推进
});

export const GRADE_TAGS = Object.freeze({
  A: '[A]',
  B: '[B]',
  C: '[C]',
  D: '[D]',
  // cycle-23 ELIMINATED predict-grade · no more [预A] [预B] [预C]
});

// ─── Entity phase enum (cycle-26 · design-ready → audit-ready) ──────────────
// Source of truth for entity.phase values. discovery-store.js MUST import.
export const ENTITY_PHASE = Object.freeze({
  AWAITING:        'awaiting',
  AUDIT_READY:     'audit-ready',     // cycle-26 (was design-ready) · audit 完成 · 等 design start
  QA_PENDING:      'qa-pending',      // scorecard < 60 · operator 补
  READY_TO_BUILD:  'ready-to-build',  // scorecard ≥ 60 · 触发 build
  OUTREACH_ACTIVE: 'outreach-active',
  REPLIED:         'replied',
  PROPOSAL_SENT:   'proposal-sent',
  NURTURE:         'nurture',
  PAID:            'paid',
  ARCHIVED:        'archived',
  NEEDS_HUMAN:     'needs-human',
});

// Map phase → STATE_TAGS key (used by buildThreadTitle)
export const PHASE_TO_STATE = Object.freeze({
  'awaiting':        'auditing',
  'audit-ready':     'auditing',       // audit 完 · 等资格复核 · 仍审中
  'qa-pending':      'qa_pending',
  'ready-to-build':  'ready_to_build',
  'outreach-active': 'pending_publish',  // when in projects channel
  'replied':         'published',
  'proposal-sent':   'published',
  'nurture':         'published',
  'paid':            'published',
  'archived':        null,             // archived 不在 STATE_TAGS · title 显示 [D]
  'needs-human':     'qa_pending',
});

// ─── Discord channels ───────────────────────────────────────────────────────
export const CHANNELS = Object.freeze({
  leads:     'WEBSITE_LEADS_DISCORD_CHANNEL_ID',
  projects:  'WEBSITE_PROJECTS_DISCORD_CHANNEL_ID',
  discovery: 'LEAD_DISCOVERY_RUNS_DISCORD_CHANNEL_ID',
  tasks:     'WEBSITE_TASKS_FORUM_CHANNEL_ID',
  botlog:    'BOT_LOG_DISCORD_CHANNEL_ID',
});

// ─── Deprecated terms — MUST NOT appear in code or in live Discord messages ─
// lint-message-literals.js + pl-cycle-doctor.js both check.
// To re-allow a term: remove from this list (and re-deploy).
export const DEPRECATED_TERMS = Object.freeze([
  // cycle-23 · predict-grade replaced by exclusion-filter
  'predict-grade',
  'Predict grade',
  '预A 阈值',
  '预B 阈值',
  '[预A]',
  '[预B]',
  '[预C]',

  // cycle-23 · exclusion-filter survived → immediate audit · not cold backlog
  'cold backlog',
  '销售触发或周期任务再 audit',

  // cycle-26 · 9-stage pipeline · old "N stages" intro labels banned (verbatim phrase)
  '· 4 stages',
  '· 5 stages',
  '· 7 stages',
  '· 8 stages',
  // old 0-8 numbered labels (cycle-26 mid-flight rename to 1-9)
  'Stage 0/8',
  'Stage 1/8',
  'Stage 2/8',
  'Stage 3/8',
  'Stage 4/8',
  'Stage 5/8',
  'Stage 6/8',
  'Stage 7/8',
  'Stage 8/8',
  'Stage 1/4',
  'Stage 1/5',
  'Stage 2/4',
  'Stage 2/5',
  'Stage 3/4',
  'Stage 3/5',
  'Stage 4/5',
  'Stage 5/5',
  'Stage 6/7',
  'Stage 7/7',
  'Stage 0/7',
  'Stage 1/7',
  'Stage 2/7',
  'Stage 3/7',
  'Stage 4/7',
  'Stage 5/7',

  // cycle-21 · section renamed
  '本地资产',

  // cycle-23 · cheap-audit verdict deprecated from summary message
  'cheap-audit + predict-grade',

  // cycle-26 · phase rename design-ready → audit-ready (semantic clarity)
  // (注意: 字符串值带 dash · 仅在代码中替换 · 数据迁移由 migrate-phase-rename.js)
  'design-ready',
  'DESIGN_READY',
  '--all-design-ready',
]);

// ─── Terminal-failure exit paths (Gate 3 · enumerated) ──────────────────────
// Every entry MUST call archiveLeadAsRejected(entity, reason) to ensure
// uniform thread archive + title [D] + grade=D + phase=archived.
// New terminal-failure paths added → MUST be appended here + wired.
export const TERMINAL_FAIL_PATHS = Object.freeze([
  // 7 exclusion-filter paths · cheap-audit-queue.js is the archiver (exclusion-filter just returns verdict)
  { id: 'layer1_no_contact_after_enrich', stage: 'Stage 1', file: 'core/leads/cheap-audit-queue.js', handler: 'archiveLeadAsRejected' },
  { id: 'layer2_too_large',               stage: 'Stage 1', file: 'core/leads/cheap-audit-queue.js', handler: 'archiveLeadAsRejected' },
  { id: 'layer2_gov_school_charity',      stage: 'Stage 1', file: 'core/leads/cheap-audit-queue.js', handler: 'archiveLeadAsRejected' },
  { id: 'layer2_competitor',              stage: 'Stage 1', file: 'core/leads/cheap-audit-queue.js', handler: 'archiveLeadAsRejected' },
  { id: 'layer2_niche_mismatch_llm',      stage: 'Stage 1', file: 'core/leads/cheap-audit-queue.js', handler: 'archiveLeadAsRejected' },
  { id: 'layer3_too_few_reviews',         stage: 'Stage 1', file: 'core/leads/cheap-audit-queue.js', handler: 'archiveLeadAsRejected' },
  { id: 'layer3_bad_rating',              stage: 'Stage 1', file: 'core/leads/cheap-audit-queue.js', handler: 'archiveLeadAsRejected' },
  // Stage 2 sitemap hard-gate (was "Stage 1 sitemap > 10" in old labels)
  { id: 'stage2_sitemap_too_large',       stage: 'Stage 2', file: 'scripts/leads/run-audit-pipeline.js', handler: 'archiveLeadAsRejected' },
  // Stage 4 grade=D (was "Stage 3 grade=D" in old labels)
  { id: 'stage4_grade_d',                 stage: 'Stage 4', file: 'core/scoring/lead-grading.js', handler: 'archiveLeadAsRejected' },
  // cycle-26 P5: Stage 7 pre-gate fail (qualification hard_gate brief-independent fail)
  { id: 'stage7_pregate_fail',            stage: 'Stage 7', file: 'scripts/cli/pl-check-qualification.js', handler: 'archiveLeadAsRejected' },
]);

// ─── Helpers ────────────────────────────────────────────────────────────────
export function stageLabel(n) {
  if (!(n in STAGE_LABELS)) throw new Error(`Unknown stage ${n} · must be 0-7 from STAGE_LABELS`);
  return STAGE_LABELS[n];
}

export function gradeTag(grade) {
  const tag = GRADE_TAGS[grade];
  if (!tag) throw new Error(`Unknown grade ${grade} · must be A|B|C|D from GRADE_TAGS`);
  return tag;
}

export function stateTag(state) {
  const tag = STATE_TAGS[state];
  if (!tag) throw new Error(`Unknown state ${state} · must be one of ${Object.keys(STATE_TAGS).join('|')}`);
  return tag;
}
