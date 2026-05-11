/**
 * Tab routing — maps the granular 17 stages + lead grade to the 3
 * top-level admin tabs (队列 / 线索 / 项目) + each tab's internal cells.
 *
 * Design rules (per user 2026-05-11 decisions):
 *   - 3 tabs only at nav level: 队列 / 线索 / 项目
 *   - Each tab has its own 「归档」 internal cell (no separate archive nav)
 *   - D-grade leads auto-archive (no manual review)
 *   - 线索 tab's "就绪" column has 3 sub-cells: A / B / C only (D doesn't enter)
 *   - 项目 tab unchanged (uses paid-intake-index.js views)
 *
 * Stage source files:
 *   - core/funnel/stage-config.js: LEAD_STAGE_META + DISCOVERY_STAGE_META
 *   - core/leads/discovery-store.js: DISCOVERY_ENTITY_STATUS
 *   - core/scoring/cheap-audit-v2.js: actions (audit_candidate / skip / ...)
 *   - core/scoring/lead-grading.js: investment_level (A/B/C/D)
 */

// ─── Tab 1: 队列 ─────────────────────────────────────────────────────────
// "lead 进来到打上 grade 标签" — fully automated pipeline.
// Internal cells (left-to-right reflects time order):

export const QUEUE_CELLS = {
  raw: {
    key: 'raw',
    label: '地图抓取库',
    description: '原始 lead 已入库，未跑任何 audit',
    matches: ({ status, hasCheapAudit }) =>
      ['new_lead', 'discovered', 'scored'].includes(status) && !hasCheapAudit,
  },
  awaiting_cheap_audit: {
    key: 'awaiting_cheap_audit',
    label: '待 cheap 审计',
    description: '已入库，等待 GBP triage + Stage 2 site scan',
    matches: ({ status, hasCheapAudit }) =>
      ['queued_for_audit'].includes(status) && !hasCheapAudit,
  },
  awaiting_detailed_audit: {
    key: 'awaiting_detailed_audit',
    label: '待详细审计',
    description: 'Cheap audit 已过，等待 Block D 全 pipeline',
    matches: ({ status, hasCheapAudit, hasDetailedAudit }) =>
      hasCheapAudit && !hasDetailedAudit && !['skipped', 'archived'].includes(status),
  },
  awaiting_grade: {
    key: 'awaiting_grade',
    label: '待分级',
    description: '详细审计已跑，等待最终 grade 计算',
    matches: ({ hasDetailedAudit, hasGrade }) =>
      hasDetailedAudit && !hasGrade,
  },
  needs_human: {
    key: 'needs_human',
    label: '人工判断',
    description: 'AI 不够确定，需要 operator 介入',
    matches: ({ status }) =>
      ['needs_human', 'needs_evidence', 'manual_review', 'discovery_ready'].includes(status),
  },
  awaiting_enrichment: {
    key: 'awaiting_enrichment',
    label: '待补资料',
    description: '缺联系方式 / 官网 / 现站审计，先补再继续',
    matches: ({ status }) =>
      ['queued_for_enrichment'].includes(status),
  },
  archived: {
    key: 'archived',
    label: '归档',
    description: '命中 hard skip / niche 不匹配 / 联系不足无法补全',
    matches: ({ status, archiveReason, hasGrade }) =>
      // Archived if either (a) explicitly archived, (b) skipped, OR
      // (c) grade=D archived in queue (because no grade computed but cheap audit said skip).
      // D-grade auto-archive itself happens in 线索 archive cell.
      !hasGrade && ['skipped', 'archived'].includes(status),
  },
};

// ─── Tab 2: 线索 ─────────────────────────────────────────────────────────
// "已分级 → 销售前流程" — A/B/C grade + outreach status.
// D grade auto-routes to 线索 归档 (no manual review).

export const LEAD_CELLS = {
  ready_a: {
    key: 'ready_a',
    label: '就绪 · A 全攻',
    description: '完整 OD redesign + 个性化销售流程',
    matches: ({ investmentLevel, status }) =>
      investmentLevel === 'A' && !['outreach_sent', 'follow_up_due', 'replied', 'paid_handoff', 'archived', 'bounced'].includes(status),
  },
  ready_b: {
    key: 'ready_b',
    label: '就绪 · B 试探',
    description: 'AI mockup hero + 短邮件试反应',
    matches: ({ investmentLevel, status }) =>
      investmentLevel === 'B' && !['outreach_sent', 'follow_up_due', 'replied', 'paid_handoff', 'archived', 'bounced'].includes(status),
  },
  ready_c: {
    key: 'ready_c',
    label: '就绪 · C 批量',
    description: '模板邮件 + PDF 链接，被动等回复',
    matches: ({ investmentLevel, status }) =>
      investmentLevel === 'C' && !['outreach_sent', 'follow_up_due', 'replied', 'paid_handoff', 'archived', 'bounced'].includes(status),
  },
  outreach_sent: {
    key: 'outreach_sent',
    label: '外发中',
    description: '销售材料已发，等回复',
    matches: ({ status }) => ['outreach_sent', 'follow_up_due', 'draft_ready'].includes(status),
  },
  in_negotiation: {
    key: 'in_negotiation',
    label: '谈判中',
    description: '客户已回，在沟通',
    matches: ({ status }) => ['replied'].includes(status),
  },
  archived: {
    key: 'archived',
    label: '归档',
    description: 'D 档（自动） + 长期无回复 + 退信',
    matches: ({ investmentLevel, status }) =>
      investmentLevel === 'D' || ['archived', 'bounced'].includes(status),
  },
};

// ─── Tab 3: 项目 ─────────────────────────────────────────────────────────
// Existing /admin/intakes — paid-intake-index.js owns these views.
// Re-export here for documentation, but the page itself doesn't change.

export const PROJECT_CELLS = {
  review_ready: { key: 'review_ready', label: '待发 review' },
  revision_pending: { key: 'revision_pending', label: '修订待处理' },
  waiting_dns: { key: 'waiting_dns', label: '等待 DNS' },
  missing_open_design: { key: 'missing_open_design', label: '缺少 Open Design' },
  qa_blocked: { key: 'qa_blocked', label: 'QA 阻塞' },
  all: { key: 'all', label: '全部项目' },
  // archived = sites that went live + churned (future)
  archived: { key: 'archived', label: '归档（已上线 / 已停服）' },
};

// ─── Top-level tab definitions ───────────────────────────────────────────

export const TABS = {
  queue: { id: 'queue', label: '队列', url: '/admin/queue', cells: QUEUE_CELLS },
  leads: { id: 'leads', label: '线索', url: '/admin/leads', cells: LEAD_CELLS },
  projects: { id: 'projects', label: '项目', url: '/admin/intakes', cells: PROJECT_CELLS },
};

/**
 * Classify a lead into its current cell across all tabs.
 *
 * Input shape (constructed by the admin page):
 *   {
 *     status: 'new_lead' | 'paid_handoff' | ...,
 *     hasCheapAudit: bool,
 *     hasDetailedAudit: bool,
 *     hasGrade: bool,
 *     investmentLevel: 'A' | 'B' | 'C' | 'D' | null,
 *     archiveReason: string | null,
 *   }
 *
 * Returns: { tab: 'queue', cell: 'awaiting_grade' }
 *
 * Note: a lead is in EXACTLY ONE cell. Cells are evaluated in order
 * (top-down, tab-by-tab); first match wins.
 */
export function classifyLead(ctx) {
  // Project tab takes priority — once paid_handoff, the lead belongs in projects.
  if (ctx.status === 'paid_handoff' || ctx.hasPaidIntake) {
    return { tab: 'projects', cell: 'all' };
  }

  // Lead tab — only if graded
  if (ctx.hasGrade && ctx.investmentLevel) {
    for (const cell of Object.values(LEAD_CELLS)) {
      if (cell.matches(ctx)) return { tab: 'leads', cell: cell.key };
    }
  }

  // Queue tab — everything else
  for (const cell of Object.values(QUEUE_CELLS)) {
    if (cell.matches(ctx)) return { tab: 'queue', cell: cell.key };
  }

  // Fallback
  return { tab: 'queue', cell: 'raw' };
}
