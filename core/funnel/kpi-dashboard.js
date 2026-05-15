/**
 * V3 cycle-26 P5 · KPI dashboard for batch finalize.
 *
 * Replaces verbose per-entity batch thread events (🔄/🆕 spam) with single
 * comprehensive end-of-batch summary. Same dashboard echoed to #website-tasks
 * parent thread so operator sees ONE clean board · not 40+ updates.
 *
 * Input shape:
 *   batchState: { batchId, niche, city, started_at, finalized_at, query, cost_usd_total }
 *   entities:   Array<{
 *     name, entityKey, threadUrl?,
 *     phase: 'outreach-active'|'qa-pending'|'archived'|'ready-to-build'|...,
 *     grade: 'A'|'B'|'C'|'D',
 *     audit_score?, qualification_total?, qualification_threshold?,
 *     deploy_url?, archive_reason?,
 *   }>
 */

function fmtDuration(startedAt, finalizedAt) {
  if (!startedAt || !finalizedAt) return '—';
  const ms = new Date(finalizedAt).getTime() - new Date(startedAt).getTime();
  if (ms <= 0) return '—';
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function categorize(entity) {
  // Phase precedence: archived > qa-pending > outreach-active (published) > ready-to-build > other
  if (entity.phase === 'archived' || entity.grade === 'D') return 'archived';
  if (entity.phase === 'qa-pending') return 'qa_pending';
  if (entity.phase === 'outreach-active' || entity.phase === 'replied'
      || entity.phase === 'proposal-sent' || entity.phase === 'nurture'
      || entity.phase === 'paid' || entity.deploy_url) return 'published';
  if (entity.phase === 'ready-to-build') return 'ready_to_build_not_published';
  // cycle-27 bug #7 (Matthew 2026-05-15): cheap-audit-queue survivors that
  // didn't auto-chain detailed-audit (predict-C cold queue) OR need enrich
  // first · they're "accounted for" but not terminal · KPI gate needs them
  // counted so it can fire at expected_total.
  if (entity.phase === 'audit-pending') return 'audit_pending';
  if (entity.phase === 'enrich-pending') return 'enrich_pending';
  return 'in_progress';
}

function namedLink(entity) {
  return entity.threadUrl ? `[${entity.name}](${entity.threadUrl})` : `**${entity.name}**`;
}

/**
 * @param {{ batchState: object, entities: Array }} ctx
 * @returns {string} · ready-to-post Discord markdown
 */
export function buildKpiDashboard({ batchState = {}, entities = [] } = {}) {
  const lines = [];

  // ─── Header ──
  const niche = batchState.niche || '?';
  const city = batchState.city || '?';
  const dur = fmtDuration(batchState.started_at, batchState.finalized_at);
  const cost = batchState.cost_usd_total != null
    ? `~$${Number(batchState.cost_usd_total).toFixed(2)}`
    : '—';
  lines.push(`🏁 **批次完成 · ${niche} / ${city}** · ${dur} · ${cost}`);
  lines.push('');

  // ─── Categorize ──
  const pubs = entities.filter((e) => categorize(e) === 'published');
  const qas = entities.filter((e) => categorize(e) === 'qa_pending');
  const arcs = entities.filter((e) => categorize(e) === 'archived');
  const rtbs = entities.filter((e) => categorize(e) === 'ready_to_build_not_published');
  // cycle-27 bug #7: cheap-audit-queue cold-queue + enrich-pending survivors
  const auditPend = entities.filter((e) => categorize(e) === 'audit_pending');
  const enrichPend = entities.filter((e) => categorize(e) === 'enrich_pending');
  const ips = entities.filter((e) => categorize(e) === 'in_progress');

  // Grade distribution (across all)
  const gradeCount = { A: 0, B: 0, C: 0, D: 0 };
  for (const e of entities) {
    const g = typeof e.grade === 'string' ? e.grade : e.grade?.grade;
    if (g && gradeCount[g] !== undefined) gradeCount[g]++;
  }

  // ─── KPI Counts ──
  lines.push('━━━ 📊 KPI ━━━');
  lines.push(`Scraped:        ${entities.length}`);
  lines.push(`Audit done:     ${entities.length - ips.length}`);
  lines.push(`Graded A/B/C/D: ${gradeCount.A} / ${gradeCount.B} / ${gradeCount.C} / ${gradeCount.D}`);
  lines.push(`Published live: ${pubs.length}`);
  lines.push(`QA-pending:     ${qas.length}`);
  lines.push(`Ready unpub:    ${rtbs.length}`);
  lines.push(`Audit-pending:  ${auditPend.length}`);
  lines.push(`Enrich-pending: ${enrichPend.length}`);
  lines.push(`Archived:       ${arcs.length}`);
  lines.push('');

  // ─── Published list ──
  if (pubs.length) {
    lines.push(`━━━ 🚀 Published live (${pubs.length}) ━━━`);
    for (const e of pubs) {
      const url = e.deploy_url || '(url missing)';
      lines.push(`✓ ${e.name} · ${url}`);
    }
    lines.push('');
  } else {
    lines.push('━━━ 🚀 Published live (0) ━━━');
    lines.push('— 无');
    lines.push('');
  }

  // ─── QA-pending ──
  if (qas.length) {
    lines.push(`━━━ ⚠️ Needs operator (${qas.length}) ━━━`);
    for (const e of qas) {
      const total = e.qualification_total;
      const thresh = e.qualification_threshold || 60;
      const scoreNote = total != null ? `scorecard ${total}/${thresh}` : 'qa-pending';
      lines.push(`- ${namedLink(e)} · ${scoreNote}`);
    }
    lines.push('');
  }

  // ─── Archived ──
  if (arcs.length) {
    lines.push(`━━━ 🗄 Archived 跳过 (${arcs.length}) ━━━`);
    for (const e of arcs.slice(0, 8)) {
      const reason = (e.archive_reason || '').split(':').slice(-1)[0].trim() || 'rejected';
      lines.push(`- ${e.name} · ${reason.slice(0, 80)}`);
    }
    if (arcs.length > 8) lines.push(`… +${arcs.length - 8} more · 见 batch state`);
    lines.push('');
  }

  // ─── Ready-to-build but not yet published (rare race) ──
  if (rtbs.length) {
    lines.push(`━━━ 🔨 Ready · waiting publish (${rtbs.length}) ━━━`);
    for (const e of rtbs) {
      lines.push(`- ${namedLink(e)}`);
    }
    lines.push('');
  }

  // ─── Still in progress (timeout / failed mid-pipeline) ──
  if (ips.length) {
    lines.push(`━━━ ⏳ In progress · check thread (${ips.length}) ━━━`);
    for (const e of ips) {
      lines.push(`- ${namedLink(e)} · phase=${e.phase || '?'}`);
    }
  }

  lines.push('━━━');
  return lines.join('\n');
}
