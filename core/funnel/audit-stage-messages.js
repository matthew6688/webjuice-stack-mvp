/**
 * V3 D38 (2026-05-14) · Audit pipeline per-stage Discord message builders
 *
 * 按 SOP-AUDIT-STAGE-NOTIFICATIONS.md 规范:
 *   - 默认 stage 成功: 无 emoji · 用 **Stage X/4 · done** bold 当锚
 *   - 失败保留: ❌ 唯一异常 marker
 *   - URL hyperlink (contact_us_url · social · live demo URL 等)
 *   - 本地路径 (audit 报告未 publish): 只显文件名
 *   - publish 后 (cf-pages-deploy.json 存在): live URL hyperlink
 *
 * Called from scripts/leads/run-audit-pipeline.js postStage().
 */

import fs from 'node:fs';
import path from 'node:path';

function readDeploy(slug) {
  if (!slug) return null;
  try {
    const p = path.join('clients', slug, 'v2/concept/reference-adapter/cf-pages-deploy.json');
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch { return null; }
}

function listEvidence(slug) {
  if (!slug) return [];
  try {
    const d = path.join('clients', slug, 'v2/evidence');
    if (!fs.existsSync(d)) return [];
    return fs.readdirSync(d).filter((f) => /\.png$/i.test(f));
  } catch { return []; }
}

function prettyEvidenceName(filename) {
  return filename
    .replace(/\.(png|jpg)$/i, '')
    .replace(/^issue-/, '')
    .replace(/-/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());
}

function slugifyName(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// ─────────────────────────────────────────────────────────
// Pipeline start
// ─────────────────────────────────────────────────────────
export function pipelineStartMessage() {
  return `**Audit pipeline 启动** · 4 stages · 预计 2-5 min`;
}

// ─────────────────────────────────────────────────────────
// Stage 1 · 网站审计 · 12 dim + tech + sitemap + speed + contact
// ─────────────────────────────────────────────────────────
export function stage1Message({ entity, audit, fetchPayload, contact, durationSec }) {
  const lines = [];
  lines.push(`**Stage 1/4 · 网站审计** done${durationSec ? ` · ${durationSec}s` : ''}`);
  lines.push('');

  // 总分 + decision
  if (audit?.audit_score != null) {
    lines.push(`总分: ${audit.audit_score}/100 · ${audit.decision || ''}`);
  }

  // 12 维最弱 3 项 (from audit.issues · sorted by severity)
  const issues = audit?.issues || [];
  if (issues.length) {
    lines.push(`12 维最弱 ${Math.min(3, issues.length)} 项:`);
    const sorted = [...issues].sort((a, b) => (b.severity || 0) - (a.severity || 0)).slice(0, 3);
    for (const i of sorted) {
      const title = i.title || i.id || i.rule || '?';
      const detail = i.details || i.evidence_short || '';
      lines.push(`- ${title}${detail ? ` (${String(detail).slice(0, 80)})` : ''}`);
    }
  }

  // Tech stack
  const tech = fetchPayload?.tech_stack;
  if (tech) {
    const parts = [];
    if (tech.cms) parts.push(tech.cms);
    if (Array.isArray(tech.analytics) && tech.analytics.length) parts.push(...tech.analytics.slice(0, 2));
    if (Array.isArray(tech.pixels) && tech.pixels.length) parts.push(...tech.pixels.slice(0, 2));
    if (parts.length) lines.push(`Tech: ${parts.join(' · ')}`);
  }

  // Sitemap
  const sm = fetchPayload?.sitemap_analysis;
  if (sm && sm.total_urls != null) {
    lines.push(`Sitemap: ${sm.total_urls} pages · ${sm.migration_complexity || 'unknown'} migration complexity`);
  }

  // Speed (LCP / FCP / CWV)
  const perf = fetchPayload?.performance;
  if (perf) {
    const parts = [];
    if (perf.lcp != null) parts.push(`LCP ${(perf.lcp / 1000).toFixed(1)}s`);
    if (perf.fcp != null) parts.push(`FCP ${(perf.fcp / 1000).toFixed(1)}s`);
    if (perf.cwv) parts.push(`CWV ${perf.cwv}`);
    if (parts.length) lines.push(`Speed: ${parts.join(' · ')}`);
  }

  // Contact info (just extracted)
  if (contact) {
    lines.push('');
    lines.push('联系信息:');
    if (contact.emails?.length) {
      lines.push(`- email: ${contact.emails[0]}${contact.contact_us_url ? ` (from [/contact/](${contact.contact_us_url}))` : ''}`);
    } else {
      lines.push(`- email: —${contact.contact_us_url ? ` (try [contact 页](${contact.contact_us_url}))` : ''}`);
    }
    if (entity?.latest?.phone) lines.push(`- phone: ${entity.latest.phone}`);
    const social = contact.social_links || {};
    const socialEntries = Object.entries(social).filter(([, v]) => v);
    if (socialEntries.length) {
      lines.push(`- social: ${socialEntries.map(([k, v]) => `[${k}](${v})`).join(' · ')}`);
    } else {
      lines.push(`- social: —`);
    }
  }

  // Hard triggers
  const triggers = audit?.hard_triggers || [];
  lines.push('');
  if (triggers.length) {
    lines.push(`Hard triggers: ${triggers.join(' · ')}`);
  } else {
    lines.push(`Hard triggers: passed (无触发)`);
  }

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────
// Stage 2 · 视觉审计 · vision LLM
// ─────────────────────────────────────────────────────────
export function stage2Message({ visual, provider, model, latencyMs, costUsd }) {
  const lines = [];
  lines.push(`**Stage 2/4 · 视觉审计** · ${provider || '?'} · ${latencyMs ? (latencyMs / 1000).toFixed(1) + 's' : '?'}`);
  lines.push('');

  // 3 visual scores
  const parsed = visual?.parsedJson || {};
  const fresh = parsed.visual_freshness;
  const trust = parsed.visual_trust;
  const conv = parsed.visual_conversion;
  const age = parsed.visual_age;
  if (fresh != null || trust != null || conv != null) {
    lines.push(`视觉评分:`);
    if (fresh != null) lines.push(`- 新鲜度 ${fresh}/10${age ? ` · 风格 ${age}` : ''}`);
    if (trust != null) lines.push(`- 信任 ${trust}/10`);
    if (conv != null) lines.push(`- 转化 ${conv}/10`);
  }

  // Top 3 issues
  const issues = parsed.issues || [];
  if (issues.length) {
    lines.push('');
    lines.push(`Top ${Math.min(3, issues.length)} 问题:`);
    issues.slice(0, 3).forEach((i, idx) => {
      const t = i.title || i.id || String(i).slice(0, 80);
      lines.push(`${idx + 1}. ${t}`);
    });
  }

  // Provider · model · cost
  if (model || costUsd != null) {
    lines.push('');
    const parts = [];
    if (provider) parts.push(`provider ${provider}`);
    if (model) parts.push(`model ${model}`);
    if (costUsd != null) parts.push(`~$${costUsd.toFixed(4)}`);
    lines.push(parts.join(' · '));
  }

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────
// Stage 3 · grade router
// ─────────────────────────────────────────────────────────
export function stage3Message({ leadGrade, audit, entity }) {
  const lines = [];
  lines.push(`**Stage 3/4 · 分级 router** done`);
  lines.push('');

  const grade = leadGrade?.investment_level || '?';
  const tier = leadGrade?.product_tier || null;
  const pricing = leadGrade?.recommended_pricing?.one_time || (
    tier === 'T1' ? '$399 一次性 + 3 修' :
    tier === 'T2' ? '$399 + $299/年 maintenance' :
    tier === 'T3' ? 'custom · 月度 retainer' : null
  );
  lines.push(`Grade: ${grade}${tier ? ` / ${tier}` : ''}${pricing ? ` (${pricing})` : ''}`);

  // 原因 · 取 factors 前 3
  const factors = (leadGrade?.investment_factors || leadGrade?.factors || []).slice(0, 3);
  if (factors.length) {
    lines.push(`原因: ${factors.join(' · ')}`);
  } else if (leadGrade?.investment_reason) {
    lines.push(`原因: ${leadGrade.investment_reason.slice(0, 200)}`);
  }

  // Next action
  if (leadGrade?.next_action) {
    lines.push(`下一步: ${leadGrade.next_action.slice(0, 200)}`);
  }

  // Skip reasons (D-grade)
  if (grade === 'D' && Array.isArray(leadGrade?.skip_reasons) && leadGrade.skip_reasons.length) {
    lines.push(`skip 原因: ${leadGrade.skip_reasons.map((r) => r.id || r).join(' · ')}`);
  }

  // Phase + thread channel
  lines.push('');
  const phase = entity?.phase || (grade === 'D' ? 'archived' : 'design-ready');
  const hasProjectThread = !!entity?.project_thread_id;
  const channelInfo = hasProjectThread
    ? '#website-projects 已开'
    : grade === 'D'
      ? '不开 thread (archived)'
      : '即将 open #website-leads (后续 publish 后自动 graduate)';
  lines.push(`phase: ${phase} (set) · thread: ${channelInfo}`);

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────
// Stage 4 · 内部审计报告
// ─────────────────────────────────────────────────────────
export function stage4Message({ entity, slug, htmlSize }) {
  const lines = [];
  lines.push(`**Stage 4/4 · 内部审计报告** done`);
  lines.push('');

  const deploy = readDeploy(slug);
  const evidence = listEvidence(slug);

  // Report link · live if published · else local filename
  if (deploy?.internal_audit_url) {
    lines.push(`[internal audit](${deploy.internal_audit_url})${htmlSize ? ` · ${(htmlSize / 1024).toFixed(1)} KB` : ''} · ${evidence.length} evidence PNG`);
  } else {
    lines.push(`internal-audit-report.html${htmlSize ? ` · ${(htmlSize / 1024).toFixed(1)} KB` : ''} · ${evidence.length} evidence PNG (待 publish)`);
  }

  // master.md link
  if (deploy?.master_md_url) {
    lines.push(`[master.md](${deploy.master_md_url}) updated · 22 sections`);
  } else {
    lines.push(`master.md updated (本地 · 待 publish)`);
  }

  // Evidence hyperlinks (per Matthew: "evidence 的时候 · 列表 hyperlink 显示")
  if (evidence.length && deploy?.demo_url) {
    const base = deploy.demo_url.replace(/\/$/, '');
    lines.push('');
    lines.push(`Evidence:`);
    for (const f of evidence.slice(0, 10)) {
      lines.push(`- [${prettyEvidenceName(f)}](${base}/evidence/${f})`);
    }
    if (evidence.length > 10) lines.push(`- _(+${evidence.length - 10} 张更多)_`);
  } else if (evidence.length) {
    // 本地 · 无 live URL · 只列名
    lines.push('');
    lines.push(`Evidence (${evidence.length} · 本地 · 待 publish 后 link):`);
    for (const f of evidence.slice(0, 6)) {
      lines.push(`- ${prettyEvidenceName(f)}`);
    }
    if (evidence.length > 6) lines.push(`- _(+${evidence.length - 6} 张更多)_`);
  }

  lines.push('');
  lines.push(`Audit pipeline 完整 · phase=design-ready · ready for M3 demo build`);

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────
// Stage failure (异常 · 唯一 emoji)
// ─────────────────────────────────────────────────────────
export function stageFailMessage({ stage, reason, retryHint }) {
  return `❌ **Stage ${stage}/4 · 失败**\n\nreason: ${reason}${retryHint ? `\nretry: ${retryHint}` : ''}\n\naudit 终止`;
}
