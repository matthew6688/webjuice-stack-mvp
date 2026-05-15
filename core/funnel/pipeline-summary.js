/**
 * V3 cycle-26 (2026-05-15) · Pipeline-end summary checklist · fix-of-record.
 *
 * Posted to entity thread AFTER Stage 9 publish completes. This is the
 * authoritative final state · operator should trust THIS message · NOT the
 * profile card (which may have drifted).
 *
 * 7 sections:
 *   🏁 标题 + duration
 *   📄 报告完整性 (master.md + 3 HTML docs · size + sectionCount)
 *   🖼  素材 (screenshots/video/evidence + Cloudinary)
 *   🌐 在线链接 (5 hyperlinks · CF Pages live)
 *   ✅ Asset Integrity (HTTP HEAD 200 · N/N reachable)
 *   💰 成本
 *   📊 Entity 当前态
 *   🚀 下一步
 */

function fmtBytes(n) {
  if (n == null || n <= 0) return null;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function fmtDuration(sec) {
  if (sec == null || sec <= 0) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function gradeLabel(g) {
  if (!g) return '—';
  if (typeof g === 'string') return g;
  return g.grade || g.investment_level || '—';
}

/**
 * @param {Object} opts
 * @param {Object} opts.entity              · entity.json content
 * @param {Object} [opts.assets]            · { master_md_bytes/sections, master_report_bytes, internal_audit_bytes, customer_audit_bytes, screenshot_count, evidence_count, video_present, cloudinary_upload_count }
 * @param {Object} [opts.integrity]         · { ok, checked, broken: [{url, status, error?}] } from verifyAssetsRemote
 * @param {Object} [opts.cost]              · { firecrawl_usd, vision_llm_usd, ai_brief_usd }
 * @param {number} [opts.duration_sec]      · total pipeline elapsed
 * @returns {string} · markdown ready to post to Discord
 */
export function buildPipelineSummary({ entity, assets = {}, integrity = null, cost = {}, duration_sec = null } = {}) {
  const name = entity?.latest?.name || entity?.entityKey || '?';
  const lines = [];

  // ─── 🏁 Header ─────────────────────────────────────────────────────────
  const durStr = fmtDuration(duration_sec);
  lines.push(`🏁 **Pipeline 完成 · ${name}** · 总用时 ${durStr}`);
  lines.push('');

  // ─── 📄 报告完整性 ────────────────────────────────────────────────────
  const audit_score = entity?.detailed_audit?.audit_score;
  const decision = entity?.detailed_audit?.decision;
  lines.push('━━━ 📄 报告完整性 ━━━');
  const mdSize = fmtBytes(assets.master_md_bytes);
  const mdSec = assets.master_md_sections;
  const scoreLine = audit_score != null ? ` · audit_score ${audit_score}/100${decision ? ' · ' + decision : ''}` : '';
  if (mdSize) lines.push(`✓ master.md · ${mdSize}${mdSec ? ' · ' + mdSec + ' sections' : ''}${scoreLine}`);
  else lines.push('⚠️ master.md · 未生成');
  if (assets.master_report_bytes) lines.push(`✓ master.report.html · ${fmtBytes(assets.master_report_bytes)} (huashu-md-html)`);
  if (assets.internal_audit_bytes) lines.push(`✓ internal-audit-report.html · ${fmtBytes(assets.internal_audit_bytes)}`);
  if (assets.customer_audit_bytes) lines.push(`✓ customer-facing-audit.html · ${fmtBytes(assets.customer_audit_bytes)}`);
  lines.push('');

  // ─── 🖼 素材 ───────────────────────────────────────────────────────────
  lines.push('━━━ 🖼 素材 ━━━');
  lines.push(`${assets.screenshot_count > 0 ? '✓' : '⚠️'} 截图: ${assets.screenshot_count || 0}`);
  lines.push(`${assets.video_present ? '✓' : '⚠️'} 录屏: ${assets.video_present ? '1 个 (mobile-throttled.webm)' : '无'}`);
  lines.push(`${assets.evidence_count > 0 ? '✓' : '⚠️'} Evidence PNG: ${assets.evidence_count || 0}`);
  if (assets.cloudinary_upload_count) {
    lines.push(`✓ Cloudinary CDN: ${assets.cloudinary_upload_count} 文件已上传`);
  } else {
    lines.push(`— Cloudinary: 未启用 (assets served from CF Pages)`);
  }
  lines.push('');

  // ─── 🌐 在线链接 ───────────────────────────────────────────────────────
  const deploy = entity?.deploy || {};
  lines.push('━━━ 🌐 在线链接 (CF Pages live) ━━━');
  if (deploy.demo_url) {
    lines.push(`Demo:        ${deploy.demo_url}`);
    if (deploy.audit_url) lines.push(`Customer:    ${deploy.audit_url}`);
    if (deploy.internal_audit_url) lines.push(`Internal:    ${deploy.internal_audit_url}`);
    if (deploy.master_md_url) lines.push(`master.md:   ${deploy.master_md_url}`);
    if (deploy.master_report_url) lines.push(`master.html: ${deploy.master_report_url}`);
  } else {
    lines.push('— 未发布 (Stage 9 publish 未跑或失败)');
  }
  lines.push('');

  // ─── ✅ Asset Integrity ────────────────────────────────────────────────
  lines.push('━━━ ✅ Asset Integrity ━━━');
  if (integrity) {
    const reachable = (integrity.checked || 0) - (integrity.broken?.length || 0);
    if (integrity.ok) {
      lines.push(`✓ ${reachable} / ${integrity.checked} reachable (HTTP 200)`);
    } else {
      lines.push(`❌ ${reachable} / ${integrity.checked} reachable · ${integrity.broken?.length || 0} broken:`);
      for (const b of (integrity.broken || []).slice(0, 8)) {
        lines.push(`  · ${b.status || 'ERR'} · ${b.url}${b.error ? ' · ' + b.error : ''}`);
      }
      if ((integrity.broken?.length || 0) > 8) {
        lines.push(`  · … +${integrity.broken.length - 8} more`);
      }
    }
  } else {
    lines.push('— 未跑 (post-publish integrity check skipped)');
  }
  lines.push('');

  // ─── 💰 成本 ──────────────────────────────────────────────────────────
  lines.push('━━━ 💰 成本 ━━━');
  const fc = cost.firecrawl_usd || 0;
  const vis = cost.vision_llm_usd || 0;
  const brief = cost.ai_brief_usd || 0;
  const total = fc + vis + brief;
  lines.push(`Firecrawl multi-page: $${fc.toFixed(3)}`);
  lines.push(`Vision LLM:           $${vis.toFixed(2)}`);
  lines.push(`AI brief:             $${brief.toFixed(2)}`);
  lines.push(`**总计: $${total.toFixed(2)}**`);
  lines.push('');

  // ─── 📊 Entity 当前态 ─────────────────────────────────────────────────
  lines.push('━━━ 📊 Entity 当前态 ━━━');
  lines.push(`phase:         ${entity?.phase || '—'}`);
  lines.push(`grade:         ${gradeLabel(entity?.grade)} (investment_level)`);
  lines.push(`audit_score:   ${audit_score != null ? `${audit_score}/100${decision ? ' · ' + decision : ''}` : '—'}`);
  const qs = entity?.qualification?.scorecard?.total;
  const qt = entity?.qualification?.scorecard?.threshold || 60;
  const qv = entity?.qualification?.verdict;
  if (qs != null) {
    const okMark = qs >= qt ? '✓' : '⚠️';
    lines.push(`qualification: ${qs}/100 (≥${qt} ${okMark})${qv ? ' · ' + qv : ''}`);
  } else {
    lines.push(`qualification: —`);
  }
  lines.push(`sales_stage:   ${entity?.sales_stage || '— (待 operator 推进)'}`);
  lines.push('');

  // ─── 🚀 下一步 ────────────────────────────────────────────────────────
  lines.push('━━━ 🚀 下一步 ━━━');
  if (entity?.phase === 'outreach-active' && deploy.audit_url) {
    lines.push('• operator 看 customer-facing-audit.html 决定要不要发给客户');
    lines.push('• ✉️ react 触发自动外联 (M4 待启动)');
    lines.push('• 💤 react 进 nurture (90 天后再触)');
  } else if (entity?.phase === 'ready-to-build') {
    lines.push('• 等后续 stages chain 完成 (build + publish)');
  } else if (entity?.phase === 'qa-pending') {
    lines.push('• operator 看 scorecard 弱项 · 补字段 · 重跑 pl:check-qualification');
  } else if (entity?.phase === 'archived') {
    lines.push('• entity 已 archive · 不再投入');
  } else {
    lines.push(`• 当前 phase=${entity?.phase || '?'} · 等下一步流转`);
  }
  lines.push('');
  lines.push('━━━');

  return lines.join('\n');
}
