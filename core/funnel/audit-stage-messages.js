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

/** V3 D41: list screenshots (desktop / mobile) · for 现状证据 */
function listScreenshots(slug) {
  if (!slug) return [];
  try {
    const d = path.join('clients', slug, 'v2/screenshots');
    if (!fs.existsSync(d)) return [];
    return fs.readdirSync(d).filter((f) => /\.(png|jpg)$/i.test(f));
  } catch { return []; }
}

/** V3 D41: list videos (mobile throttled walkthrough) · for 现状证据 */
function listVideos(slug) {
  if (!slug) return [];
  try {
    const d = path.join('clients', slug, 'v2/video');
    if (!fs.existsSync(d)) return [];
    return fs.readdirSync(d).filter((f) => /\.(webm|mp4)$/i.test(f));
  } catch { return []; }
}

/** Detect if local evidence files are newer than last CF deploy.
 *  Returns true 时 hyperlinks 会 404 · 需 republish 才 live。 */
function isEvidenceStale(slug, deploy) {
  if (!slug || !deploy?.deployed_at) return false;
  try {
    const deployTs = new Date(deploy.deployed_at).getTime();
    const evidenceDir = path.join('clients', slug, 'v2/evidence');
    if (!fs.existsSync(evidenceDir)) return false;
    for (const f of fs.readdirSync(evidenceDir)) {
      if (!/\.png$/i.test(f)) continue;
      const mtime = fs.statSync(path.join(evidenceDir, f)).mtimeMs;
      if (mtime > deployTs) return true;
    }
    return false;
  } catch { return false; }
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
// Cheap-audit + predict summary · V3 D43 cycle-7 (cycle-8 explicit thresholds)
// Matthew 2026-05-14: thread 不能是空壳 + 阈值要具体 · 不要 vague "GBP 弱"
// ─────────────────────────────────────────────────────────
export function cheapAuditPredictMessage({ entity, cheapAudit, predict }) {
  const latest = entity?.latest || {};
  const rc = latest.review_count || 0;
  const rating = latest.rating || 0;
  const ws = latest.websiteStatus || '?';
  const wsLabel = ws === 'independent_https_site' ? '独立 HTTPS' :
                  ws === 'independent_http_site' ? '独立 HTTP' :
                  ws === 'no_website' ? '无网站' :
                  ws === 'social_or_third_party_only' ? '社媒/三方' : ws;
  const hasWebsite = /^independent_(http|https)_site$/.test(ws);
  const action = cheapAudit?.action || '?';
  const actionLabel = action === 'audit_candidate' ? '可深审' :
                      action === 'starter_candidate' ? '可建站' :
                      action === 'manual_review' ? '操作员复核' :
                      action === 'skip' ? '跳过' :
                      action === 'queued_for_enrichment' ? '待补 contact' : action;
  const g = predict?.predict_grade || '?';
  const nextStep =
    g === 'A' ? '→ 立刻 detailedAudit (高优先 · 优先 100)' :
    g === 'B' ? '→ 进 detailedAudit 队列 (优先 75)' :
    g === 'C' ? '→ cold backlog · 销售触发或周期任务再 audit' :
    g === 'D' ? '→ archive · 不深审' : '→ ?';

  // V3 D43 cycle-8 · 具体阈值对照（A/B/C/D 评定标准 + 这家是怎么判的）
  // 阈值与 core/leads/predict-grade.js 同步
  const A_REVIEWS_MIN = 100, A_RATING_MIN = 4.3;
  const B_REVIEWS_MIN = 30,  B_RATING_MIN = 4.0;
  const cActionOk = action === 'audit_candidate' || action === 'starter_candidate';
  const tick = (ok) => ok ? '✓' : '✗';

  const lines = [];
  lines.push(`**Intake 完成 · cheap-audit + predict-grade**`);
  lines.push('');
  lines.push(`▸ **GBP 信号**: ${rating}★ · ${rc} 条评论 · 网站 ${wsLabel}`);
  lines.push(`▸ **Cheap-audit 判定**: \`${action}\` (${actionLabel}) · gbp_quality ${cheapAudit?.gbp_quality ?? '?'}/100`);
  if (cheapAudit?.reason) lines.push(`▸ Cheap-audit 原因: ${cheapAudit.reason}`);
  if (cheapAudit?.fired_triggers?.length) {
    lines.push(`▸ Fired triggers: ${cheapAudit.fired_triggers.join(', ')}`);
  }
  lines.push('');
  lines.push(`**Predict grade**: \`${g}\``);
  lines.push('');
  // 具体阈值对照表（每行: 实际值 vs B/A 阈值）
  lines.push('```');
  lines.push('维度        本家       预B 阈值       预A 阈值');
  lines.push(`reviews     ${String(rc).padEnd(10)} ≥${B_REVIEWS_MIN.toString().padEnd(13)}≥${A_REVIEWS_MIN}`);
  lines.push(`           ${tick(rc >= B_REVIEWS_MIN).padEnd(11)}${tick(rc >= A_REVIEWS_MIN)}`);
  lines.push(`rating      ${String(rating + '★').padEnd(10)} ≥${(B_RATING_MIN + '★').padEnd(13)}≥${A_RATING_MIN}★`);
  lines.push(`           ${tick(rating >= B_RATING_MIN).padEnd(11)}${tick(rating >= A_RATING_MIN)}`);
  lines.push(`website     ${(hasWebsite ? '有' : '无').padEnd(10)} 不强制       必须`);
  lines.push(`           ✓          ${tick(hasWebsite)}`);
  lines.push(`cheap       ${action.padEnd(10)} ∈[audit/starter]`);
  lines.push(`           ${tick(cActionOk).padEnd(11)}${tick(cActionOk)}`);
  lines.push('```');
  // 显式原因
  if (predict?.reasons?.length) {
    lines.push('');
    lines.push('**为什么这样判:**');
    for (const r of predict.reasons) {
      lines.push(r.startsWith('  ✗') ? r : `· ${r}`);
    }
  }
  lines.push('');
  lines.push(`**下一步**: ${nextStep}`);

  // V3 D43 cycle-13 (Matthew 2026-05-14): emoji 指南是 DEFAULT · 所有需要 human
  // review 或处于 backlog 的 lead 都显示 (predict-A/B/C + manual_review +
  // queued_for_enrichment + needs human). 只有 predict-D (archive · 永不深审)
  // 跳过 (反正不在 #website-leads)。
  const showEmojiGuide = g === 'A' || g === 'B' || g === 'C'
    || action === 'manual_review' || action === 'queued_for_enrichment';
  if (showEmojiGuide) {
    lines.push('');
    lines.push('**手动操作 (对本帖加表情即可):**');
    lines.push('· 🚀 / ⚡ / 🔥 → 推进 → detailedAudit (priority 100)');
    lines.push('· 💤 / 😴 → 直接 archive (不再深审)');
    lines.push('· 🔁 / 🔄 → 重跑 cheap-audit');
  }

  return lines.join('\n');
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

  // 12 维最弱 3 项 (issues 是 {critical, major, minor} 对象 · 不是 flat 数组)
  const issuesObj = audit?.issues || {};
  const flatIssues = [
    ...(issuesObj.critical || []).map((i) => ({ ...i, sev: 3 })),
    ...(issuesObj.major || []).map((i) => ({ ...i, sev: 2 })),
    ...(issuesObj.minor || []).map((i) => ({ ...i, sev: 1 })),
  ];
  if (flatIssues.length) {
    lines.push(`12 维最弱 ${Math.min(3, flatIssues.length)} 项:`);
    for (const i of flatIssues.slice(0, 3)) {
      const id = i.id || i.title || '?';
      const detail = i.plain_language || i.rationale || '';
      lines.push(`- ${id}${detail ? ` (${String(detail).slice(0, 80)})` : ''}`);
    }
  }

  // Tech stack · objects with .name not strings (cms / analytics / pixels)
  const tech = fetchPayload?.tech_stack;
  if (tech) {
    const parts = [];
    if (tech.cms?.name) parts.push(tech.cms.name);
    else if (typeof tech.cms === 'string') parts.push(tech.cms);
    if (Array.isArray(tech.analytics) && tech.analytics.length) {
      parts.push(...tech.analytics.slice(0, 2).map((a) => a?.name || a).filter(Boolean));
    }
    if (Array.isArray(tech.pixels) && tech.pixels.length) {
      parts.push(...tech.pixels.slice(0, 2).map((p) => p?.name || p).filter(Boolean));
    }
    if (parts.length) lines.push(`Tech: ${parts.join(' · ')}`);
  }

  // Sitemap · has_sitemap=false 时显示 "no sitemap"
  const sm = fetchPayload?.sitemap_analysis;
  if (sm) {
    if (sm.has_sitemap === false) {
      lines.push(`Sitemap: 没找到 (standard paths 无 sitemap.xml)`);
    } else if (sm.total_urls != null) {
      lines.push(`Sitemap: ${sm.total_urls} pages · ${sm.migration_complexity || '?'} migration`);
    }
  }

  // Speed · 用 pagespeed.results.mobile.lab_metrics (lcp_ms / fcp_ms / cls / tbt_ms)
  const mobMetrics = fetchPayload?.pagespeed?.results?.mobile?.lab_metrics;
  const mobScores = fetchPayload?.pagespeed?.results?.mobile?.scores;
  if (mobMetrics || mobScores) {
    const parts = [];
    if (mobScores?.performance != null) parts.push(`perf ${mobScores.performance}/100`);
    if (mobMetrics?.lcp_ms != null) parts.push(`LCP ${(mobMetrics.lcp_ms / 1000).toFixed(1)}s`);
    if (mobMetrics?.fcp_ms != null) parts.push(`FCP ${(mobMetrics.fcp_ms / 1000).toFixed(1)}s`);
    if (mobMetrics?.cls != null) parts.push(`CLS ${mobMetrics.cls.toFixed(2)}`);
    if (parts.length) lines.push(`Speed (mobile): ${parts.join(' · ')}`);
  }

  // Contact info
  if (contact) {
    lines.push('');
    lines.push('联系信息:');
    if (contact.emails?.length) {
      lines.push(`- email: ${contact.emails[0]}${contact.contact_us_url ? ` (from [/contact/](${contact.contact_us_url}))` : ''}`);
    } else if (contact.contact_us_url) {
      lines.push(`- email: — (已抓 [/contact/](${contact.contact_us_url}) · 网站未公开)`);
    } else {
      lines.push(`- email: —`);
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

  lines.push('');
  lines.push('━━━');
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

  lines.push('');
  lines.push('━━━');
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

  lines.push('');
  lines.push('━━━');

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
  const stale = isEvidenceStale(slug, deploy);
  const canHyperlink = deploy?.demo_url && !stale;
  const base = deploy?.demo_url ? deploy.demo_url.replace(/\/$/, '') : null;

  // ━━━━━━━━━━ 在线资源 (只留 文档 + Demo URL) ━━━━━━━━━━
  lines.push('━━━ 在线资源 ━━━');
  if (deploy?.demo_url) {
    // Demo URL · 裸 URL · 销售复制粘贴用
    lines.push(`Demo: ${deploy.demo_url}`);
  }
  if (canHyperlink && deploy.audit_url) {
    lines.push(`[客户 audit](${deploy.audit_url})`);
  } else if (deploy?.audit_url) {
    lines.push(`客户 audit (待 republish)`);
  } else {
    lines.push(`客户 audit (本地 · 待 publish)`);
  }
  if (canHyperlink && deploy.internal_audit_url) {
    lines.push(`[内部 audit](${deploy.internal_audit_url})${htmlSize ? ` · ${(htmlSize / 1024).toFixed(1)} KB` : ''}`);
  } else {
    lines.push(`内部 audit (本地${htmlSize ? ` · ${(htmlSize / 1024).toFixed(1)} KB` : ''}${stale ? ' · 待 republish' : ' · 待 publish'})`);
  }
  if (canHyperlink && deploy.master_md_url) {
    lines.push(`[master.md](${deploy.master_md_url})`);
  } else {
    lines.push(`master.md (本地)`);
  }

  // ━━━━━━━━━━ 现状证据 (截图 + 录屏 + 标注证据 · 全列 · 每条 1 行) ━━━━━━━━━━
  const screenshots = listScreenshots(slug);
  const videos = listVideos(slug);
  const totalEvidence = screenshots.length + videos.length + evidence.length;
  if (totalEvidence > 0) {
    lines.push('');
    lines.push(`━━━ 现状证据 (${totalEvidence}) ━━━`);
    // Screenshots
    for (const f of screenshots) {
      const label = f.replace(/\.[^.]+$/, '').replace(/^./, (c) => c.toUpperCase());
      if (canHyperlink) {
        lines.push(`[${label} 截图](${base}/screenshots/${f})`);
      } else {
        lines.push(`${label} 截图 (本地)`);
      }
    }
    // Videos
    for (const f of videos) {
      const label = f.replace(/\.[^.]+$/, '').replace(/-/g, ' ');
      if (canHyperlink) {
        lines.push(`[${label} 录屏](${base}/video/${f})`);
      } else {
        lines.push(`${label} 录屏 (本地)`);
      }
    }
    // Evidence PNGs · 每条 1 行
    if (evidence.length) {
      const evToShow = evidence.slice(0, 10);
      for (const f of evToShow) {
        if (canHyperlink) {
          lines.push(`[${prettyEvidenceName(f)}](${base}/evidence/${f})`);
        } else {
          lines.push(`${prettyEvidenceName(f)} (本地)`);
        }
      }
      if (evidence.length > 10) lines.push(`_(+${evidence.length - 10} 张更多)_`);
    }
  }

  // ━━━━━━━━━━ 结尾 ━━━━━━━━━━
  lines.push('');
  lines.push('━━━');
  if (stale) {
    lines.push(`Audit pipeline 完整 · evidence 本地更新 · 跑 \`npm run pl:publish-demo -- --slug ${slug}\` 同步到 CF Pages`);
  } else {
    lines.push(`Audit pipeline 完整 · phase=design-ready · ready for M3 demo build`);
  }

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────
// Stage 5 · Qualification check (D39 · M2 → M3 gate)
// ─────────────────────────────────────────────────────────
export function stage5Message({ entity, verdict, crawl, briefResult }) {
  const lines = [];
  lines.push(`**Stage 5/5 · Qualification check** done${crawl?.duration_ms ? ` · ${(crawl.duration_ms / 1000).toFixed(1)}s` : ''}`);
  lines.push('');

  // ━━━ 数据采集 ━━━
  if (crawl) {
    lines.push('━━━ 数据采集 ━━━');
    lines.push(`Multi-page crawl: ${crawl.pages_crawled || 0} 页 · sitemap=${crawl.sitemap_source || '?'}`);
    lines.push(`Firecrawl: ${crawl.pages_via_firecrawl || 0} · Direct fetch: ${crawl.pages_via_direct || 0} · ~$${(crawl.cost_estimate || 0).toFixed(3)}`);
  }
  if (briefResult) {
    lines.push(`AI 分析: ${briefResult.provider} · ${(briefResult.duration_ms / 1000).toFixed(1)}s · ~$${briefResult.cost_estimate || 0}`);
  }

  // ━━━ Hard Gates ━━━
  lines.push('');
  lines.push('━━━ Hard Gates ━━━');
  const failedGates = verdict.hard_gates.filter((g) => !g.passed);
  if (failedGates.length === 0) {
    lines.push(`${verdict.hard_gates.length}/${verdict.hard_gates.length} passed · 全过`);
  } else {
    lines.push(`${verdict.hard_gates.length - failedGates.length}/${verdict.hard_gates.length} passed`);
    for (const g of failedGates) {
      lines.push(`❌ ${g.id}: ${g.reason}`);
    }
  }

  // ━━━ Scorecard ━━━
  if (verdict.scorecard) {
    lines.push('');
    lines.push('━━━ Scorecard ━━━');
    const sc = verdict.scorecard;
    lines.push(`A 核心信息: ${sc.A_core_info.score}/${sc.A_core_info.max} (${(sc.A_core_info.items || []).join(', ')})`);
    lines.push(`B 品牌素材: ${sc.B_brand.score}/${sc.B_brand.max} (${(sc.B_brand.items || []).join(', ')})`);
    lines.push(`C 范围可行: ${sc.C_scope.score}/${sc.C_scope.max} (${(sc.C_scope.items || []).join(', ')})`);
    lines.push(`D 技术风险: ${sc.D_tech.score}/${sc.D_tech.max} (${(sc.D_tech.items || []).join(', ')})`);
    lines.push(`E 解决性: ${sc.E_solvability.score}/${sc.E_solvability.max} (${(sc.E_solvability.items || []).join(', ')})`);
    lines.push('');
    lines.push(`**总分: ${sc.total}/100** · 阈值 ${sc.threshold}`);
  }

  // ━━━ Verdict ━━━
  lines.push('');
  lines.push('━━━ Verdict ━━━');
  if (verdict.verdict === 'ready-to-build') {
    lines.push(`Phase: \`ready-to-build\` (set)`);
    lines.push(`下一步: 自动 chain pl:build-from-reference + pl:publish-demo`);
  } else if (verdict.verdict === 'qa-pending') {
    lines.push(`Phase: \`qa-pending\` (set)`);
    lines.push(`下一步: operator 看 scorecard 弱项 · 补缺字段 · 跑 \`npm run pl:check-qualification -- --entity-key ${entity.entityKey}\` 重评`);
  } else if (verdict.verdict === 'archived') {
    lines.push(`Phase: \`archived\` (set)`);
    lines.push(`原因: ${verdict.archive_reason}`);
  }

  lines.push('');
  lines.push('━━━');
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────
// Stage failure (异常 · 唯一 emoji)
// ─────────────────────────────────────────────────────────
export function stageFailMessage({ stage, reason, retryHint }) {
  return `❌ **Stage ${stage}/4 · 失败**\n\nreason: ${reason}${retryHint ? `\nretry: ${retryHint}` : ''}\n\naudit 终止`;
}
