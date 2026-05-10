/**
 * Internal Audit Report — HTML renderer.
 *
 * Output: self-contained HTML document, brand-aligned (Display serif +
 * cream + 2px black borders + coral accent + citrus stat tile), printable.
 *
 * Inputs:
 *   - entity (required) — discovery store entity
 *   - cheapAudit (required) — output of cheapAuditV2()
 *   - detailedAudit (required for full content) — output of detailedAudit()
 *   - visualAudit (optional, Block E) — placeholder shown if absent
 *   - reviewAnalysis (optional, Block D iter 5) — placeholder if absent
 *   - leadSpend (optional) — summarizeLeadSpend() result for cost line
 *   - screenshotDir (optional) — relative path from output HTML to
 *     desktop.png / mobile.png (for <img> src)
 *
 * Output: HTML string. Caller writes to disk.
 */

const DIMENSION_LABELS = {
  gbp: 'Google Business Profile',
  technical: 'Technical',
  ux_conversion: 'UX & Conversion',
  content: 'Content',
  seo: 'SEO',
  visual: 'Visual',
};
const DIMENSION_WEIGHTS = { gbp: 15, technical: 20, ux_conversion: 25, content: 15, seo: 10, visual: 15 };
const DIMENSION_ORDER = ['gbp', 'technical', 'ux_conversion', 'content', 'seo', 'visual'];

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function decisionLabel(d) {
  return ({
    strong_redesign: 'STRONG REDESIGN',
    moderate_candidate: 'MODERATE CANDIDATE',
    low_priority: 'LOW PRIORITY',
    not_qualified: 'NOT QUALIFIED',
  }[d] || d || 'UNKNOWN').toUpperCase();
}

function decisionColor(d) {
  if (d === 'strong_redesign') return 'coral';
  if (d === 'moderate_candidate') return 'citrus';
  if (d === 'low_priority') return 'sky';
  if (d === 'not_qualified') return 'mint';
  return 'paper';
}

function deriveSalesAngle({ detailedAudit }) {
  if (!detailedAudit) return null;
  const dims = detailedAudit.dimensions || {};
  const weakest = Object.entries(dims)
    .filter(([k]) => k !== 'visual')
    .sort(([, a], [, b]) => (a.score || 0) - (b.score || 0))
    .slice(0, 2);
  const critical = (detailedAudit.issues?.critical || []);
  const triggers = detailedAudit.hard_triggers || [];

  const triggerTalk = {
    no_https: '你的网站没有 HTTPS — 浏览器对来访客户显示「不安全」，直接伤害信任',
    mobile_broken: '你的网站在手机上基本不可用 — 这是大多数本地搜索的入口',
    no_visible_cta_or_phone: '客户进来看不到联系按钮和电话 — 找不到怎么联系你就直接走了',
    no_website: '你目前没有独立网站 — 所有 Google 流量进来后没地方落地',
    high_traction_old_site: '你已经有不错的 Google 流量基础，但网站设计在浪费这些点击',
  };

  const lines = [];
  for (const t of triggers) {
    if (triggerTalk[t]) lines.push(triggerTalk[t]);
  }
  if (!lines.length && weakest.length) {
    const w = weakest[0];
    lines.push(`你的最大短板是 ${DIMENSION_LABELS[w[0]] || w[0]}（得分 ${w[1].score}/100）`);
  }
  if (critical.length) {
    lines.push(`有 ${critical.length} 个 critical 级问题正在直接伤害成交`);
  }
  return lines.length ? lines : null;
}

function renderRules(rules) {
  if (!rules?.length) return '';
  return `
    <table class="rule-table">
      <thead><tr><th>规则</th><th>命中</th><th>得分</th><th>原因</th></tr></thead>
      <tbody>
        ${rules.map((r) => {
          const cls = r.data_missing ? 'na' : (r.hit ? 'hit' : 'miss');
          const mark = r.data_missing ? '—' : (r.hit ? '✓' : '✗');
          return `<tr class="${cls}"><td><code>${escapeHtml(r.id)}</code></td><td class="mark">${mark}</td><td class="num">${r.earned}/${r.max}</td><td class="why">${escapeHtml(r.rationale || '')}</td></tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

function renderIssueEvidence(ev, screenshotDir) {
  if (!ev) return '';
  const t = ev.type;
  if (t === 'cropped' || t === 'element' || t === 'full') {
    const src = ev.cdnUrl || ev.relPath || ev.path?.split('/').pop();
    if (!src) return '';
    return `<div class="issue-evidence">
      <p class="ev-lab">证据截图 · ${escapeHtml(ev.label || t)}</p>
      <img src="${escapeHtml(src)}" alt="evidence for ${escapeHtml(ev.label || '')}" loading="lazy" />
    </div>`;
  }
  if (t === 'mobile-ref') {
    return `<div class="issue-evidence">
      <p class="ev-lab">证据 · 移动端截图</p>
      <img src="${escapeHtml(screenshotDir)}/mobile.png" alt="mobile evidence" />
    </div>`;
  }
  if (t === 'video-ref') {
    return `<p class="issue-row ev-ref"><span class="lab">证据视频</span>见下方「速度对比」段的慢速 4G 加载视频</p>`;
  }
  if (t === 'html-snippet') {
    return `<details class="issue-evidence-html"><summary>证据 · ${escapeHtml(ev.label || 'HTML snippet')}</summary><pre><code>${escapeHtml(ev.text || '')}</code></pre></details>`;
  }
  if (t === 'html-list' || t === 'jsonld-list') {
    const items = ev.items || [];
    if (!items.length) return `<p class="issue-row"><span class="lab">证据</span>${escapeHtml(ev.label || '(empty)')}</p>`;
    return `<details class="issue-evidence-html"><summary>证据 · ${escapeHtml(ev.label || '')}</summary>${items.map((it) => `<pre><code>${escapeHtml(it)}</code></pre>`).join('')}</details>`;
  }
  if (t === 'broken-site') {
    return `<div class="issue-evidence broken-evidence">
      <p class="ev-lab broken-lab">⚠ 证据 · ${escapeHtml(ev.label || '站点加载失败')}</p>
      <p class="broken-reason">${escapeHtml(ev.reason || '')} — 这条 issue 的根因就在这里：访客根本看不到内容。</p>
    </div>`;
  }
  if (t === 'note' || t === 'error') {
    return `<p class="issue-row ev-ref"><span class="lab">证据</span>${escapeHtml(ev.label || '')}</p>`;
  }
  return '';
}

function renderIssue(issue, ctx = {}) {
  const ev = ctx.evidenceById?.[issue.id];
  const screenshotDir = ctx.screenshotDir || './screenshots';
  return `
    <div class="issue-card issue-${issue.severity || 'minor'}">
      <div class="issue-head">
        <span class="issue-severity">${escapeHtml(issue.severity || 'minor').toUpperCase()}</span>
        <code class="issue-id">${escapeHtml(issue.id)}</code>
      </div>
      <div class="issue-title">${escapeHtml(issue.title || issue.id)}</div>
      ${issue.what_observed ? `<p class="issue-row"><span class="lab">观察到</span>${escapeHtml(issue.what_observed)}</p>` : ''}
      ${issue.why_problem ? `<p class="issue-row"><span class="lab">为什么是问题</span>${escapeHtml(issue.why_problem)}</p>` : ''}
      ${issue.what_correct_looks_like ? `<p class="issue-row"><span class="lab">正确长啥样</span>${escapeHtml(issue.what_correct_looks_like)}</p>` : ''}
      ${issue.how_to_fix_in_redesign ? `<p class="issue-row fix"><span class="lab">redesign 怎么改</span>${escapeHtml(issue.how_to_fix_in_redesign)}</p>` : ''}
      ${(!issue.what_observed && issue.rationale) ? `<p class="issue-row"><span class="lab">命中原因</span>${escapeHtml(issue.rationale)}</p>` : ''}
      ${renderIssueEvidence(ev, screenshotDir)}
    </div>`;
}

function renderVisualSection({ visualAudit, evidenceById, screenshotDir }) {
  if (!visualAudit) {
    return `
    <section class="section section-placeholder">
      <h2>视觉审计</h2>
      <p class="placeholder-note">⏳ Vision LLM 视觉审计待生成（Block E autoresearch 中）。报告生成后将补充：</p>
      <ul class="placeholder-list">
        <li>新鲜度 / 信任度 / 转化准备度 1-10 分</li>
        <li>设计年代估计（modern / outdated / severely_outdated）</li>
        <li>每个视觉问题的「为什么是问题 / 正确长啥样 / redesign 怎么改」</li>
        <li>需要保留的优点 + redesign 优先级</li>
      </ul>
    </section>`;
  }
  const issues = visualAudit.issues || [];
  return `
    <section class="section">
      <p class="eyebrow">视觉审计 · Vision LLM</p>
      <h2>设计观感的整体诊断</h2>
      ${visualAudit.summary ? `<p class="lead-summary">${escapeHtml(visualAudit.summary)}</p>` : ''}
      <div class="visual-scores">
        <div class="vs"><span>新鲜度</span><strong>${visualAudit.freshness_score ?? '-'}</strong><small>/10</small></div>
        <div class="vs"><span>信任度</span><strong>${visualAudit.trust_score ?? '-'}</strong><small>/10</small></div>
        <div class="vs"><span>转化准备度</span><strong>${visualAudit.conversion_score ?? '-'}</strong><small>/10</small></div>
        <div class="vs vs-text"><span>设计年代</span><strong class="age">${escapeHtml(visualAudit.design_age_estimate || '-')}</strong></div>
      </div>
      <div class="issues-grid">
        ${issues.map((i) => renderIssue(i, { evidenceById, screenshotDir })).join('')}
      </div>
      ${(visualAudit.positive_observations || []).length ? `
        <div class="positives">
          <p class="eyebrow accent-mint">需要保留的优点</p>
          <ul>${visualAudit.positive_observations.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ul>
        </div>` : ''}
      ${(visualAudit.redesign_priorities || []).length ? `
        <div class="priorities">
          <p class="eyebrow accent-coral">Redesign 优先级</p>
          <ol>${visualAudit.redesign_priorities.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ol>
        </div>` : ''}
    </section>`;
}

function renderReviewSection({ reviewAnalysis, reviewSample, entity }) {
  if (!reviewAnalysis) {
    return `
    <section class="section section-placeholder">
      <h2>客户评论分析</h2>
      <p class="placeholder-note">⏳ 评论挖掘按需生成（仅高价值 lead 跑，加 <code>--with-reviews</code> 触发）。会补充：</p>
      <ul class="placeholder-list">
        <li>5 条 Google 「最相关」评论 + 商家整体评分概览</li>
        <li>常见好评 / 差评 themes（Ollama 本地提取）</li>
        <li>quotable 评论 — 可直接放到 redesign 后网站</li>
        <li>redesign hooks — 哪些主题该在网站哪些位置呈现</li>
      </ul>
    </section>`;
  }
  const a = reviewAnalysis;
  const overall = `${entity?.latest?.rating ?? '-'}★ · ${entity?.latest?.review_count ?? '-'} 条评论`;
  const trustClass = a.trust_signal_strength === 'strong' ? 'mint' : (a.trust_signal_strength === 'weak' ? 'coral-soft' : 'citrus');
  return `
    <section class="section">
      <p class="eyebrow">客户评论分析 · Google Reviews</p>
      <h2>客户在 Google 上怎么夸 / 怎么抱怨</h2>
      ${a.summary ? `<p class="lead-summary">${escapeHtml(a.summary)}</p>` : ''}
      <div class="review-overview">
        <div class="review-stat"><span class="lab">Google 整体</span><strong>${escapeHtml(overall)}</strong></div>
        <div class="review-stat trust-${trustClass}"><span class="lab">信号强度</span><strong>${escapeHtml((a.trust_signal_strength || '-').toUpperCase())}</strong></div>
        <div class="review-stat"><span class="lab">分析样本</span><strong>${reviewSample?.length || 0} 条</strong><small>Google 「最相关」</small></div>
      </div>

      ${(a.positive_themes || []).length ? `
        <h3>客户一致夸赞</h3>
        <div class="theme-pills theme-pos">${a.positive_themes.map((t) => `<span class="theme-pill pos">${escapeHtml(t)}</span>`).join('')}</div>
      ` : ''}

      ${(a.negative_themes || []).length ? `
        <h3>抱怨 / 短板</h3>
        <div class="theme-pills theme-neg">${a.negative_themes.map((t) => `<span class="theme-pill neg">${escapeHtml(t)}</span>`).join('')}</div>
      ` : ''}

      ${(a.quotable_for_redesign || []).length ? `
        <h3>可直接用在 redesign 的 quote</h3>
        <div class="quote-grid">
          ${a.quotable_for_redesign.map((q) => `
            <blockquote class="review-quote">
              <p class="quote-text">"${escapeHtml(q.quote || '')}"</p>
              <footer class="quote-meta">
                <span class="quote-author">— ${escapeHtml(q.author || 'anonymous')}</span>
                <span class="quote-rating">${'★'.repeat(Math.round(q.rating || 5))}</span>
              </footer>
              ${q.why_useful ? `<p class="quote-why"><span class="lab">放哪</span>${escapeHtml(q.why_useful)}</p>` : ''}
            </blockquote>
          `).join('')}
        </div>
      ` : ''}

      ${a.owner_reply_observations ? `
        <h3>商家回复观察</h3>
        <p class="review-row">${escapeHtml(a.owner_reply_observations)}</p>
      ` : ''}

      ${(a.redesign_hooks || []).length ? `
        <div class="priorities">
          <p class="eyebrow accent-coral">Redesign 可发力的钩子</p>
          <ol>${a.redesign_hooks.map((h) => `<li>${escapeHtml(h)}</li>`).join('')}</ol>
        </div>
      ` : ''}
    </section>`;
}

function renderSpeedComparisonSection({ videoUrl } = {}) {
  if (videoUrl) {
    return `
    <section class="section">
      <p class="eyebrow">加载速度证据 · 慢速 4G 移动网络</p>
      <h2>客户在手机上看到的真实加载体验</h2>
      <p class="ev-caption">下方视频在 1.6 Mbps 下行 / 150ms 延迟 / 4× CPU 节流条件下录制 — 这是大多数本地搜索访客在手机上真实看到的体验。</p>
      <video class="speed-video" controls preload="metadata" playsinline>
        <source src="${escapeHtml(videoUrl)}" type="video/webm" />
      </video>
      <p class="placeholder-note" style="margin-top:14px">⏳ Mockup 站点对比视频 — 等 ProfitsLocal 真实 mockup 上线后录制 side-by-side 对比。</p>
    </section>`;
  }
  return `
    <section class="section section-placeholder">
      <h2>速度对比 (前 / 后)</h2>
      <p class="placeholder-note">⏳ 加载速度前后对比视频 — 等 ProfitsLocal 真实 mockup 网站上线后录制：</p>
      <ul class="placeholder-list">
        <li>当前网站慢速节流加载视频（模拟 4G 移动网络）</li>
        <li>Mockup 网站同条件加载视频</li>
        <li>side-by-side 对比 + 客户能直接看到的转化率影响估算</li>
      </ul>
    </section>`;
}

export function renderInternalAuditHtml({
  entity,
  cheapAudit,
  detailedAudit,
  visualAudit = null,
  reviewAnalysis = null,
  reviewSample = null,
  leadSpend = null,
  screenshotDir = './screenshots',
  evidenceById = {},
  videoUrl = null,
} = {}) {
  if (!entity) throw new Error('entity is required');
  const latest = entity.latest || {};
  const businessName = latest.name || entity.entityKey;
  const niche = latest.niche || latest.category || '';
  const city = latest.city || '';
  const dims = detailedAudit?.dimensions || {};
  const auditScore = detailedAudit?.audit_score ?? cheapAudit?.final_score ?? null;
  const decision = detailedAudit?.decision || null;
  const reason = detailedAudit?.qualification_reason || cheapAudit?.reason || '';
  const triggers = detailedAudit?.hard_triggers || cheapAudit?.fired_triggers || [];
  const critical = detailedAudit?.issues?.critical || [];
  const major = detailedAudit?.issues?.major || [];
  const salesAngles = deriveSalesAngle({ detailedAudit });

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>Internal Audit · ${escapeHtml(businessName)}</title>
<style>
  :root {
    --cream: #fff6ec; --paper: #fffcf7; --ink: #17191c; --line: #17191c;
    --muted: #5e6268; --coral: #ff5a3d; --coral-soft: #ffb39f;
    --peach: #ffe1ce; --citrus: #ffd45a; --mint: #cdeccf;
    --green: #47b86a; --sky: #8bd3f7; --lilac: #eadcfb;
    --serif: Georgia, "Times New Roman", serif;
    --sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--cream); color: var(--ink); font-family: var(--sans); font-weight: 600; }
  body { background-image: linear-gradient(rgba(23,25,28,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(23,25,28,0.04) 1px, transparent 1px); background-size: 54px 54px; }
  .doc { max-width: 920px; margin: 32px auto; background: var(--paper); border: 2px solid var(--line); box-shadow: 6px 6px 0 var(--line); }
  .cover { padding: 36px 36px 28px; border-bottom: 2px solid var(--line); display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 24px; align-items: end; }
  .cover .eyebrow { margin: 0; font-size: 11px; font-weight: 950; letter-spacing: 0.12em; text-transform: uppercase; color: var(--coral); }
  .cover h1 { font-family: var(--serif); font-size: 44px; font-weight: 900; line-height: 1.05; margin: 8px 0 8px; max-width: 600px; word-break: break-word; }
  .cover .subline { display: flex; gap: 10px; flex-wrap: wrap; align-items: baseline; font-size: 14px; font-weight: 800; color: var(--muted); margin: 0; }
  .cover .subline strong { color: var(--coral); }
  .cover .meta-line { margin-top: 12px; font-size: 11px; font-weight: 800; color: var(--muted); display: flex; gap: 8px; }
  .cover .meta-line code { background: var(--paper); border: 1.5px solid var(--line); padding: 1px 6px; font-family: var(--mono); }
  .score-tile { background: var(--${decisionColor(decision)}); border: 2px solid var(--line); padding: 18px 22px; text-align: center; min-width: 180px; box-shadow: 4px 4px 0 var(--line); }
  .score-tile .label { font-size: 10px; font-weight: 950; letter-spacing: 0.1em; color: var(--ink); text-transform: uppercase; }
  .score-tile .num { font-family: var(--serif); font-size: 64px; font-weight: 950; line-height: 1; margin: 6px 0 4px; color: var(--ink); }
  .score-tile .num small { font-size: 14px; color: var(--ink); opacity: 0.75; font-weight: 800; }
  .score-tile .decision { font-family: var(--mono); font-size: 12px; font-weight: 950; color: var(--ink); }

  .section { padding: 28px 36px; border-top: 2px solid var(--line); }
  .section .eyebrow { margin: 0 0 6px; font-size: 11px; font-weight: 950; letter-spacing: 0.1em; text-transform: uppercase; color: var(--coral); }
  .section h2 { font-family: var(--serif); font-size: 30px; font-weight: 900; line-height: 1.1; margin: 4px 0 16px; max-width: none; word-break: break-word; }
  .section h3 { font-size: 14px; font-weight: 950; margin: 18px 0 8px; }

  .reason-line { padding: 12px 16px; background: var(--cream); border: 2px solid var(--line); box-shadow: 3px 3px 0 var(--line); font-size: 13.5px; font-weight: 800; line-height: 1.45; word-break: break-word; }
  .lead-summary { margin: 0 0 14px; padding: 14px 18px; background: var(--cream); border: 2px solid var(--line); box-shadow: 3px 3px 0 var(--line); font-size: 14.5px; font-weight: 700; line-height: 1.65; max-width: 760px; word-break: break-word; font-family: var(--sans); }
  .dim-meta { margin: -8px 0 16px; font-size: 12.5px; font-weight: 800; color: var(--muted); font-family: var(--mono); letter-spacing: 0.04em; }
  .dim-meta strong { color: var(--coral); font-family: var(--serif); font-size: 16px; font-weight: 950; }
  .triggers-block { margin-top: 22px; }
  .triggers-block .eyebrow { margin: 0 0 8px; }
  .trigger-list { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 14px; }
  .trigger-pill { background: var(--coral); color: white; padding: 4px 12px; font-family: var(--mono); font-size: 11px; font-weight: 950; border: 1.5px solid var(--line); }

  .contact-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border: 2px solid var(--line); }
  .contact-cell { padding: 14px 18px; border-right: 2px solid var(--line); border-bottom: 2px solid var(--line); }
  .contact-cell:nth-child(2n) { border-right: 0; }
  .contact-cell:nth-last-child(-n+2) { border-bottom: 0; }
  .contact-cell .lab { display: block; font-size: 10px; font-weight: 950; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); margin-bottom: 4px; }
  .contact-cell .val { font-size: 14px; font-weight: 800; word-break: break-word; }

  .dim-grid { display: grid; grid-template-columns: repeat(6, 1fr); border: 2px solid var(--line); margin: 14px 0; }
  .dim-card { padding: 14px 12px; border-right: 2px solid var(--line); }
  .dim-card:last-child { border-right: 0; }
  .dim-card .label { font-size: 9.5px; font-weight: 950; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink); }
  .dim-card .score { font-family: var(--serif); font-size: 28px; font-weight: 950; line-height: 1; margin: 6px 0 6px; }
  .dim-card .bar { height: 5px; background: rgba(23,25,28,0.08); border: 1.5px solid var(--line); overflow: hidden; margin-bottom: 4px; }
  .dim-card .fill { height: 100%; background: var(--coral); }
  .dim-card .weight { font-size: 9.5px; font-weight: 800; color: var(--muted); }

  .screenshots { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border: 2px solid var(--line); margin: 12px 0; }
  .screenshots figure { margin: 0; padding: 14px; border-right: 2px solid var(--line); }
  .screenshots figure:last-child { border-right: 0; }
  .screenshots img { width: 100%; height: auto; display: block; border: 1.5px solid var(--line); }
  .screenshots figcaption { margin-top: 10px; font-size: 11px; font-weight: 800; color: var(--muted); }

  .perf-strip { display: grid; grid-template-columns: repeat(4, 1fr); border: 2px solid var(--line); margin-top: 12px; }
  .perf-cell { padding: 12px; border-right: 2px solid var(--line); }
  .perf-cell:last-child { border-right: 0; }
  .perf-cell .lab { font-size: 9.5px; font-weight: 950; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
  .perf-cell .val { font-family: var(--serif); font-size: 22px; font-weight: 950; line-height: 1; margin-top: 4px; }
  .perf-cell .val.ok { color: var(--green); }
  .perf-cell .val.bad { color: var(--coral); }

  .issue-card { padding: 14px 18px; border: 2px solid var(--line); background: var(--paper); margin: 10px 0; box-shadow: 3px 3px 0 var(--line); }
  .issue-card.issue-critical { background: color-mix(in srgb, var(--coral-soft) 30%, var(--paper)); }
  .issue-card.issue-major { background: color-mix(in srgb, var(--citrus) 18%, var(--paper)); }
  .issue-head { display: flex; gap: 10px; align-items: center; margin-bottom: 6px; }
  .issue-severity { font-family: var(--mono); font-size: 10.5px; font-weight: 950; padding: 2px 8px; background: var(--coral); color: white; border: 1.5px solid var(--line); }
  .issue-major .issue-severity { background: var(--citrus); color: var(--ink); }
  .issue-minor .issue-severity { background: var(--paper); color: var(--ink); }
  .issue-id { font-family: var(--mono); font-size: 11px; background: var(--cream); border: 1.5px solid var(--line); padding: 1px 6px; }
  .issue-title { font-family: var(--serif); font-size: 18px; font-weight: 900; margin-bottom: 8px; }
  .issue-row { margin: 10px 0 0; font-size: 13px; line-height: 1.6; font-weight: 700; }
  .issue-row .lab { display: block; font-size: 10px; font-weight: 950; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); margin: 0 0 3px; }
  .issue-row.fix { padding-top: 8px; margin-top: 12px; border-top: 1.5px dashed rgba(23,25,28,0.18); }
  .issue-row.fix .lab { color: var(--coral); }

  details.dim-detail { border: 2px solid var(--line); margin: 8px 0; background: var(--paper); }
  details.dim-detail summary { cursor: pointer; padding: 10px 16px; display: flex; gap: 14px; align-items: center; list-style: none; font-weight: 850; }
  details.dim-detail summary::-webkit-details-marker { display: none; }
  details.dim-detail summary::before { content: '▶'; color: var(--coral); font-size: 10px; transition: transform 0.2s; }
  details.dim-detail[open] summary::before { transform: rotate(90deg); }
  .dim-summary-label { flex: 1; font-family: var(--serif); font-size: 16px; font-weight: 950; }
  .dim-summary-score { font-family: var(--serif); font-size: 18px; font-weight: 950; }
  .dim-summary-rules { font-size: 11px; font-weight: 800; color: var(--muted); }
  .dim-detail .rule-table { border-top: 2px solid var(--line); }

  .rule-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12.5px; }
  .rule-table th { background: color-mix(in srgb, var(--citrus) 50%, var(--paper)); padding: 10px 12px; font-size: 10.5px; font-weight: 950; text-transform: uppercase; letter-spacing: 0.06em; text-align: left; border-bottom: 2px solid var(--line); }
  .rule-table td { padding: 9px 12px; border-bottom: 1.5px solid rgba(23,25,28,0.08); vertical-align: top; font-weight: 700; }
  .rule-table tr:last-child td { border-bottom: 0; }
  .rule-table td.mark { text-align: center; font-weight: 950; font-size: 14px; }
  .rule-table tr.hit td.mark { color: var(--green); }
  .rule-table tr.miss td.mark { color: rgba(23,25,28,0.35); }
  .rule-table tr.na td.mark { color: rgba(23,25,28,0.25); }
  .rule-table td.num { font-family: var(--mono); font-variant-numeric: tabular-nums; font-weight: 950; }
  .rule-table td.why { color: var(--muted); font-weight: 700; }
  .rule-table code { background: var(--cream); border: 1.5px solid var(--line); padding: 1px 6px; font-family: var(--mono); font-size: 11px; font-weight: 800; }

  .visual-scores { display: grid; grid-template-columns: repeat(4, 1fr); border: 2px solid var(--line); margin: 12px 0 18px; }
  .vs { padding: 14px 16px; border-right: 2px solid var(--line); }
  .vs:last-child { border-right: 0; }
  .vs span { font-size: 10px; font-weight: 950; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
  .vs strong { display: block; font-family: var(--serif); font-size: 32px; font-weight: 950; line-height: 1; margin-top: 6px; }
  .vs small { font-size: 12px; color: var(--muted); font-weight: 700; }
  .vs.vs-text strong.age { font-size: 16px; line-height: 1.3; padding-top: 4px; display: inline-block; }

  .issues-grid { display: flex; flex-direction: column; gap: 0; }
  .positives, .priorities { padding: 14px 16px; border: 2px solid var(--line); background: var(--paper); margin-top: 14px; }
  .positives ul, .priorities ol { margin: 6px 0 0 18px; padding: 0; line-height: 1.55; font-weight: 700; }
  .accent-mint { color: var(--green); }
  .accent-coral { color: var(--coral); }

  .issue-evidence { margin-top: 10px; padding-top: 10px; border-top: 1.5px dashed rgba(23,25,28,0.25); }
  .issue-evidence .ev-lab { margin: 0 0 6px; font-size: 10px; font-weight: 950; letter-spacing: 0.08em; text-transform: uppercase; color: var(--coral); }
  .issue-evidence img { max-width: 100%; height: auto; display: block; border: 1.5px solid var(--line); }
  .issue-evidence-html { margin-top: 8px; border: 1.5px solid var(--line); padding: 8px 10px; background: var(--cream); }
  .issue-evidence-html summary { cursor: pointer; font-size: 11px; font-weight: 950; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }
  .issue-evidence-html pre { margin: 8px 0 0; padding: 8px; background: var(--paper); border: 1.5px solid var(--line); font-size: 11px; line-height: 1.4; overflow: auto; max-height: 240px; white-space: pre-wrap; word-break: break-all; }
  .issue-row.ev-ref { color: var(--muted); }
  .broken-evidence { background: color-mix(in srgb, var(--coral-soft) 35%, var(--paper)); border: 2px dashed var(--coral); padding: 12px 14px; margin-top: 10px; }
  .broken-evidence .broken-lab { color: var(--coral); margin: 0 0 6px; font-size: 11.5px; font-weight: 950; letter-spacing: 0.06em; text-transform: uppercase; }
  .broken-evidence .broken-reason { margin: 0; font-size: 13px; font-weight: 800; line-height: 1.5; }
  .speed-video { width: 100%; max-width: 420px; display: block; margin: 14px auto 0; border: 2px solid var(--line); box-shadow: 4px 4px 0 var(--line); background: black; }
  .review-overview { display: grid; grid-template-columns: repeat(3, 1fr); border: 2px solid var(--line); margin: 14px 0 8px; }
  .review-stat { padding: 14px 16px; border-right: 2px solid var(--line); }
  .review-stat:last-child { border-right: 0; }
  .review-stat .lab { font-size: 10px; font-weight: 950; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
  .review-stat strong { display: block; font-family: var(--serif); font-size: 22px; font-weight: 950; line-height: 1.1; margin-top: 4px; }
  .review-stat small { font-size: 11px; font-weight: 700; color: var(--muted); display: block; margin-top: 3px; }
  .review-stat.trust-mint { background: var(--mint); }
  .review-stat.trust-citrus { background: var(--citrus); }
  .review-stat.trust-coral-soft { background: var(--coral-soft); }
  .theme-pills { display: flex; gap: 8px; flex-wrap: wrap; margin: 6px 0 14px; }
  .theme-pill { padding: 4px 10px; border: 1.5px solid var(--line); font-family: var(--mono); font-size: 11.5px; font-weight: 800; }
  .theme-pill.pos { background: var(--mint); }
  .theme-pill.neg { background: var(--coral-soft); }
  .quote-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border: 2px solid var(--line); margin: 8px 0 14px; }
  .review-quote { margin: 0; padding: 14px 16px; border-right: 2px solid var(--line); border-bottom: 2px solid var(--line); background: var(--paper); }
  .review-quote:nth-child(2n) { border-right: 0; }
  .review-quote:nth-last-child(-n+2) { border-bottom: 0; }
  .review-quote .quote-text { font-family: var(--serif); font-size: 15px; font-weight: 700; line-height: 1.45; margin: 0 0 8px; }
  .review-quote .quote-meta { display: flex; justify-content: space-between; font-size: 11px; font-weight: 800; color: var(--muted); margin-bottom: 6px; }
  .review-quote .quote-rating { color: var(--coral); letter-spacing: 0.08em; }
  .review-quote .quote-why { font-size: 12px; font-weight: 700; line-height: 1.45; color: var(--muted); margin: 6px 0 0; padding-top: 8px; border-top: 1.5px dashed rgba(23,25,28,0.2); }
  .review-quote .quote-why .lab { display: inline-block; font-size: 9.5px; font-weight: 950; letter-spacing: 0.06em; text-transform: uppercase; color: var(--coral); margin-right: 6px; }
  .review-row { font-size: 13.5px; font-weight: 700; line-height: 1.5; }
  .ev-caption { font-size: 13px; font-weight: 700; color: var(--muted); line-height: 1.5; margin: 0; }
  .placeholder-note { background: var(--cream); border: 2px dashed var(--line); padding: 14px 16px; font-size: 13px; font-weight: 800; line-height: 1.5; }
  .placeholder-list { margin: 10px 0 0 22px; padding: 0; line-height: 1.6; font-weight: 700; color: var(--muted); }

  .sales-strip { padding: 16px 18px; background: var(--peach); border: 2px solid var(--line); box-shadow: 4px 4px 0 var(--line); margin-top: 8px; }
  .sales-strip ul { margin: 6px 0 0 22px; padding: 0; font-size: 14px; line-height: 1.55; font-weight: 800; }

  .appendix { padding: 22px 36px; border-top: 2px solid var(--line); background: color-mix(in srgb, white 50%, var(--paper)); }
  .appendix h2 { font-size: 14px; font-weight: 950; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
  .appendix .meta-row { font-size: 11.5px; font-weight: 800; color: var(--muted); display: flex; gap: 14px; flex-wrap: wrap; }
  .appendix code { background: var(--paper); border: 1.5px solid var(--line); padding: 1px 6px; font-family: var(--mono); }

  @media print {
    html, body { background: white; }
    body { background-image: none; }
    .doc { box-shadow: none; margin: 0 auto; }
    details.dim-detail { break-inside: avoid; }
    details.dim-detail[open] summary { break-after: avoid; }
    .issue-card, .perf-strip, .visual-scores, .dim-grid, .contact-grid, .screenshots { break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="doc">

  <header class="cover">
    <div>
      <p class="eyebrow">Internal Audit Report · ProfitsLocal</p>
      <h1>${escapeHtml(businessName)}</h1>
      <p class="subline">
        ${niche ? `<span><strong>${escapeHtml(niche)}</strong></span>` : ''}
        ${city ? `<span>·</span><span>${escapeHtml(city)}</span>` : ''}
        <span>·</span>
        <span>★ ${escapeHtml(latest.rating || '-')} (${escapeHtml(String(latest.review_count || 0))} reviews)</span>
      </p>
      <p class="meta-line">
        <span>generated ${fmtDate(detailedAudit?.audited_at || new Date().toISOString())}</span>
        <span>·</span>
        <span>config <code>${escapeHtml(detailedAudit?.audit_version || cheapAudit?.config_version || 'v1')}</code></span>
        <span>·</span>
        <span>entity <code>${escapeHtml(entity.entityKey)}</code></span>
      </p>
    </div>
    <div class="score-tile">
      <span class="label">Audit Score</span>
      <div class="num">${auditScore ?? '-'}<small>/100</small></div>
      <span class="decision">${escapeHtml(decisionLabel(decision))}</span>
    </div>
  </header>

  <section class="section">
    <p class="eyebrow">总体判断</p>
    <h2>审计概览</h2>
    <p class="lead-summary">${escapeHtml(reason || 'audit pending')}</p>
    ${triggers.length ? `
      <div class="triggers-block">
        <p class="eyebrow accent-coral">已触发 hard triggers</p>
        <div class="trigger-list">
          ${triggers.map((t) => `<span class="trigger-pill">${escapeHtml(t)}</span>`).join('')}
        </div>
      </div>` : ''}
  </section>

  <section class="section">
    <p class="eyebrow">联系方式 + GBP 快照</p>
    <h2>商家档案</h2>
    <div class="contact-grid">
      <div class="contact-cell"><span class="lab">电话</span><span class="val">${escapeHtml(latest.phone || '—')}</span></div>
      <div class="contact-cell"><span class="lab">网址</span><span class="val">${latest.website ? `<a href="${escapeHtml(latest.website)}" target="_blank">${escapeHtml(latest.website)}</a>` : '—'}</span></div>
      <div class="contact-cell"><span class="lab">地址</span><span class="val">${escapeHtml(latest.address || '—')}</span></div>
      <div class="contact-cell"><span class="lab">类目</span><span class="val">${escapeHtml(latest.category || latest.niche || '—')}</span></div>
      <div class="contact-cell"><span class="lab">Google Maps</span><span class="val">${latest.google_maps_url ? `<a href="${escapeHtml(latest.google_maps_url)}" target="_blank">打开</a>` : '—'}</span></div>
      <div class="contact-cell"><span class="lab">网站状态</span><span class="val"><code>${escapeHtml(latest.websiteStatus || '—')}</code></span></div>
      <div class="contact-cell"><span class="lab">来源</span><span class="val">${escapeHtml(latest.sourceQuery || latest.sourceType || '—')}</span></div>
      <div class="contact-cell"><span class="lab">图片数 / 抓取分</span><span class="val">${escapeHtml(String(latest.signals?.imageCount ?? '—'))} · ${escapeHtml(String(latest.discoveryScore ?? '—'))}</span></div>
    </div>
  </section>

  <section class="section">
    <p class="eyebrow">六维度评分总览</p>
    <h2>每个维度的强弱在哪</h2>
    <p class="dim-meta"><strong>${auditScore}/100</strong> · ${escapeHtml(decisionLabel(decision))}</p>
    <div class="dim-grid">
      ${DIMENSION_ORDER.map((k) => {
        const d = dims[k] || { score: 0 };
        return `
        <div class="dim-card">
          <span class="label">${escapeHtml(DIMENSION_LABELS[k] || k)}</span>
          <div class="score">${d.score}<small>/100</small></div>
          <div class="bar"><div class="fill" style="width:${Math.max(0, Math.min(100, d.score))}%"></div></div>
          <span class="weight">权重 ${DIMENSION_WEIGHTS[k]}%</span>
        </div>`;
      }).join('')}
    </div>
  </section>

  <section class="section">
    <p class="eyebrow">现场证据 · 桌面 + 移动</p>
    <h2>客户访问时看到的页面</h2>
    <div class="screenshots">
      <figure>
        <img src="${escapeHtml(screenshotDir)}/desktop.png" alt="desktop screenshot" />
        <figcaption>桌面 1440×900 · 来源：Playwright headless Chromium</figcaption>
      </figure>
      <figure>
        <img src="${escapeHtml(screenshotDir)}/mobile.png" alt="mobile screenshot" />
        <figcaption>移动 375×667 · iPhone 12 viewport</figcaption>
      </figure>
    </div>
    <div class="perf-strip">
      <div class="perf-cell">
        <span class="lab">LCP</span>
        <span class="val ${perfClass(detailedAudit?.dimensions?.technical, 'first_paint_under_3s', 'lcp')}">${perfFmt(detailedAudit?.dimensions?.technical, 'first_paint_under_3s', 'lcp', 's')}</span>
      </div>
      <div class="perf-cell">
        <span class="lab">HTTPS</span>
        <span class="val ${dimRuleHit(detailedAudit?.dimensions?.technical, 'https_enabled') ? 'ok' : 'bad'}">${dimRuleHit(detailedAudit?.dimensions?.technical, 'https_enabled') ? 'YES' : 'NO'}</span>
      </div>
      <div class="perf-cell">
        <span class="lab">Mobile Lighthouse</span>
        <span class="val">${perfFmtPlain(detailedAudit?.dimensions?.technical, 'mobile_responsive') || '—'}</span>
      </div>
      <div class="perf-cell">
        <span class="lab">Console Errors</span>
        <span class="val ${dimRuleHit(detailedAudit?.dimensions?.technical, 'no_console_errors') ? 'ok' : 'bad'}">${perfFmtPlain(detailedAudit?.dimensions?.technical, 'no_console_errors') || '—'}</span>
      </div>
    </div>
  </section>

  ${critical.length ? `
  <section class="section">
    <p class="eyebrow accent-coral">关键问题 · ${critical.length} 项</p>
    <h2>立刻在伤害成交的硬伤</h2>
    <div class="issues-grid">
      ${critical.map((i) => renderIssue({ ...i, severity: 'critical' }, { evidenceById, screenshotDir })).join('')}
    </div>
  </section>` : ''}

  ${major.length ? `
  <section class="section">
    <p class="eyebrow">主要问题 · ${major.length} 项</p>
    <h2>影响转化的明显短板</h2>
    <div class="issues-grid">
      ${major.map((i) => renderIssue({ ...i, severity: 'major' }, { evidenceById, screenshotDir })).join('')}
    </div>
  </section>` : ''}

  <section class="section">
    <p class="eyebrow">规则细节 · 39 项明细</p>
    <h2>每条规则的命中与失分原因</h2>
    ${DIMENSION_ORDER.map((k) => {
      const d = dims[k];
      if (!d) return '';
      return `
        <details class="dim-detail">
          <summary>
            <span class="dim-summary-label">${escapeHtml(DIMENSION_LABELS[k])}</span>
            <span class="dim-summary-score">${d.score}/100</span>
            <span class="dim-summary-rules">${d.rules?.length || 0} 规则</span>
          </summary>
          ${renderRules(d.rules)}
        </details>`;
    }).join('')}
  </section>

  ${renderVisualSection({ visualAudit, evidenceById, screenshotDir })}

  ${renderReviewSection({ reviewAnalysis, reviewSample, entity })}

  ${renderSpeedComparisonSection({ videoUrl })}

  ${salesAngles ? `
  <section class="section">
    <p class="eyebrow accent-coral">销售切入点</p>
    <h2>从 audit 数据自动推导的开场话术</h2>
    <div class="sales-strip">
      <ul>
        ${salesAngles.map((a) => `<li>${escapeHtml(a)}</li>`).join('')}
      </ul>
    </div>
  </section>` : ''}

  <footer class="appendix">
    <h2>Appendix</h2>
    <p class="meta-row">
      <span>Cheap audit version: <code>${escapeHtml(cheapAudit?.config_version || '—')}</code></span>
      <span>Detailed audit version: <code>${escapeHtml(detailedAudit?.audit_version || '—')}</code></span>
      ${leadSpend ? `<span>Lead spend (this audit lifecycle): $${(leadSpend.totalCost || 0).toFixed(4)}</span>` : ''}
    </p>
    <p class="meta-row" style="margin-top:8px">
      <span>Visual auditor: ${visualAudit ? '✓ filled (Block E)' : '⏳ pending Block E autoresearch'}</span>
      <span>Review analysis: ${reviewAnalysis ? '✓ filled' : '⏳ on-demand for high-value leads'}</span>
      <span>Speed video: ⏳ post-mockup</span>
    </p>
  </footer>

</div>
</body>
</html>`;
}

function dimRuleHit(dim, ruleId) {
  if (!dim?.rules) return false;
  const r = dim.rules.find((x) => x.id === ruleId);
  return Boolean(r?.hit);
}

function perfFmt(dim, ruleId, field, suffix = '') {
  const r = dim?.rules?.find((x) => x.id === ruleId);
  if (!r) return '—';
  if (r.data_missing) return '—';
  // rationale often contains useful number we can pull e.g. "LCP 1.5s"
  const num = r.rationale?.match(/[\d.]+/)?.[0];
  return num ? num + suffix : '—';
}
function perfFmtPlain(dim, ruleId) {
  const r = dim?.rules?.find((x) => x.id === ruleId);
  if (!r || r.data_missing) return null;
  const num = r.rationale?.match(/[\d.]+/)?.[0];
  return num || (r.hit ? 'OK' : 'FAIL');
}
function perfClass(dim, ruleId, field) {
  const r = dim?.rules?.find((x) => x.id === ruleId);
  if (!r || r.data_missing) return '';
  return r.hit ? 'ok' : 'bad';
}
