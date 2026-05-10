/**
 * Master MD synthesizer — generates `clients/<slug>/v2/master.md` from
 * audit + visual + review fixtures + Cloudinary manifest.
 *
 * The master.md is the SINGLE SOURCE OF TRUTH for every customer-facing
 * artifact:
 *   - huashu-md-html → 4 themes of polished HTML (article/report/reading/interactive)
 *   - hyperframes → video / slide deck composition
 *   - sales operator can hand-edit prose without re-running audits
 *
 * Schema goals:
 *   - YAML frontmatter holds all structured fields (audit_score, decision,
 *     hard_triggers, asset URLs) — every downstream tool can read them
 *   - Body is a Chinese narrative with English data preserved (per
 *     feedback_report_typography rule): h2/h3 中文, data 英文
 *   - All visual assets reference Cloudinary CDN URLs (so HTML / videos
 *     produced from this MD are portable)
 *
 * Output: { mdPath, frontmatter, sectionCount }
 */

import fs from 'fs';
import path from 'path';

function fmtRating(n) {
  if (n == null || n === '') return '-';
  return typeof n === 'number' ? `${n}★` : String(n);
}

function fmtAssetCount(manifest) {
  const ev = manifest?.evidenceUrls || {};
  return { count: Object.keys(ev).length, video: Boolean(manifest?.videoUrl) };
}

function buildFrontmatter({ entity, detailedAudit, visualAudit, reviewAnalysis, manifest, screenshotDir }) {
  const latest = entity.latest || {};
  const audit = detailedAudit || {};
  const visual = visualAudit || {};

  const fm = {
    business_id: entity.entityKey,
    business_name: latest.name || entity.entityKey,
    niche: latest.niche || latest.category || '',
    city: latest.city || '',
    rating: latest.rating ?? null,
    review_count: latest.review_count ?? null,
    website: latest.website || null,
    audit_score: audit.audit_score ?? null,
    decision: audit.decision || null,
    audit_version: audit.audit_version || null,
    fired_triggers: audit.hard_triggers || [],
    visual_age: visual.design_age_estimate || null,
    visual_freshness: visual.freshness_score ?? null,
    visual_trust: visual.trust_score ?? null,
    visual_conversion: visual.conversion_score ?? null,
    review_trust_signal: reviewAnalysis?.trust_signal_strength || null,
    generated_at: new Date().toISOString(),
    assets: {
      cloudinary_folder: manifest?.folderBase || null,
      evidence_count: fmtAssetCount(manifest).count,
      video_url: manifest?.videoUrl || null,
      desktop_screenshot: manifest?.screenshotUrls?.desktop || `${screenshotDir}/desktop.png`,
      mobile_screenshot: manifest?.screenshotUrls?.mobile || `${screenshotDir}/mobile.png`,
    },
  };
  return fm;
}

function yamlSerialize(obj, indent = 0) {
  const pad = ' '.repeat(indent);
  const lines = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) {
      lines.push(`${pad}${k}: null`);
    } else if (Array.isArray(v)) {
      if (!v.length) lines.push(`${pad}${k}: []`);
      else {
        lines.push(`${pad}${k}:`);
        for (const item of v) lines.push(`${pad}  - ${typeof item === 'string' ? JSON.stringify(item) : item}`);
      }
    } else if (typeof v === 'object') {
      lines.push(`${pad}${k}:`);
      lines.push(yamlSerialize(v, indent + 2));
    } else if (typeof v === 'string') {
      lines.push(`${pad}${k}: ${JSON.stringify(v)}`);
    } else {
      lines.push(`${pad}${k}: ${v}`);
    }
  }
  return lines.join('\n');
}

function renderEvidenceLine(issue, manifest) {
  const evId = String(issue.id || '').replace(/_/g, '-');
  const cdn = manifest?.evidenceUrls?.[evId];
  if (cdn) return `\n![${issue.title || issue.id}](${cdn})\n`;
  return '';
}

function renderIssueBlock(issue, manifest, severity) {
  const tag = severity === 'critical' ? '关键' : '主要';
  const lines = [];
  lines.push(`### ${tag} · ${issue.title || issue.id}`);
  lines.push('');
  if (issue.what_observed) lines.push(`**观察到：** ${issue.what_observed}`);
  if (issue.why_problem) lines.push(`\n**为什么是问题：** ${issue.why_problem}`);
  if (issue.what_correct_looks_like) lines.push(`\n**正确长啥样：** ${issue.what_correct_looks_like}`);
  if (issue.how_to_fix_in_redesign) lines.push(`\n**Redesign 怎么改：** ${issue.how_to_fix_in_redesign}`);
  if (!issue.what_observed && issue.rationale) lines.push(`**命中原因：** ${issue.rationale}`);
  const ev = renderEvidenceLine(issue, manifest);
  if (ev) lines.push(ev);
  lines.push('');
  return lines.join('\n');
}

export function buildMasterMd({
  entity,
  detailedAudit,
  visualAudit,
  reviewAnalysis,
  reviewSample,
  cloudinaryManifest,
  screenshotDir = './screenshots',
} = {}) {
  if (!entity) throw new Error('entity required');
  const latest = entity.latest || {};
  const audit = detailedAudit || {};
  const visual = visualAudit || {};
  const reviews = reviewAnalysis || {};
  const manifest = cloudinaryManifest || {};

  const fm = buildFrontmatter({ entity, detailedAudit, visualAudit, reviewAnalysis, manifest, screenshotDir });

  const sections = [];

  // ── Title ──
  sections.push(`# ${fm.business_name} · 现状审计与重构提议`);
  sections.push('');
  sections.push(`> **${fm.audit_score}/100** · ${fm.decision || '-'} · 行业：${fm.niche || '-'} · 地区：${fm.city || '-'} · Google 评价：${fmtRating(fm.rating)} （${fm.review_count || 0} 条）`);
  sections.push('');

  // ── 一、店家现状速览 ──
  sections.push('## 一、店家现状速览');
  sections.push('');
  if (audit.qualification_reason) {
    sections.push(`**审计结论：** ${audit.qualification_reason}`);
    sections.push('');
  }
  if ((fm.fired_triggers || []).length) {
    sections.push(`**已触发的 hard triggers：** ${fm.fired_triggers.map((t) => '`' + t + '`').join(' · ')}`);
    sections.push('');
  }
  const summaryBits = [];
  if (latest.phone) summaryBits.push(`- 电话：${latest.phone}`);
  if (latest.address) summaryBits.push(`- 地址：${latest.address}`);
  if (latest.website) summaryBits.push(`- 网站：[${latest.website}](${latest.website})`);
  if (latest.websiteStatus) summaryBits.push(`- 网站状态：\`${latest.websiteStatus}\``);
  if (summaryBits.length) {
    sections.push(summaryBits.join('\n'));
    sections.push('');
  }

  // ── 二、客户访问时看到的页面 ──
  sections.push('## 二、客户访问时看到的页面');
  sections.push('');
  sections.push(`![桌面 1440×900](${fm.assets.desktop_screenshot})`);
  sections.push('');
  sections.push(`![移动 375×667](${fm.assets.mobile_screenshot})`);
  sections.push('');
  if (fm.assets.video_url) {
    sections.push(`**慢速 4G 加载实景视频**（1.6 Mbps · 150ms 延迟 · 4× CPU 节流，模拟真实手机访客的体验）：`);
    sections.push('');
    sections.push(`[播放视频](${fm.assets.video_url})`);
    sections.push('');
  }

  // ── 三、视觉审计（Vision LLM）──
  if (visual.summary) {
    sections.push('## 三、视觉审计 · Vision LLM 怎么看');
    sections.push('');
    sections.push(`> ${visual.summary}`);
    sections.push('');
    const scoreBits = [];
    if (fm.visual_freshness != null) scoreBits.push(`新鲜度 **${fm.visual_freshness}/10**`);
    if (fm.visual_trust != null) scoreBits.push(`信任度 **${fm.visual_trust}/10**`);
    if (fm.visual_conversion != null) scoreBits.push(`转化准备度 **${fm.visual_conversion}/10**`);
    if (fm.visual_age) scoreBits.push(`设计年代 \`${fm.visual_age}\``);
    if (scoreBits.length) {
      sections.push(scoreBits.join(' · '));
      sections.push('');
    }
    if ((visual.positive_observations || []).length) {
      sections.push('**值得保留的优点：**');
      sections.push(visual.positive_observations.map((p) => `- ${p}`).join('\n'));
      sections.push('');
    }
  }

  // ── 四、客户在 Google 上怎么说 ──
  if (reviews.summary || (reviews.quotable_for_redesign || []).length) {
    sections.push('## 四、客户在 Google 上怎么说');
    sections.push('');
    if (reviews.summary) {
      sections.push(`> ${reviews.summary}`);
      sections.push('');
    }
    if ((reviews.positive_themes || []).length) {
      sections.push(`**一致夸赞：** ${reviews.positive_themes.map((t) => '`' + t + '`').join(' · ')}`);
      sections.push('');
    }
    if ((reviews.negative_themes || []).length) {
      sections.push(`**抱怨 / 短板：** ${reviews.negative_themes.map((t) => '`' + t + '`').join(' · ')}`);
      sections.push('');
    }
    if ((reviews.quotable_for_redesign || []).length) {
      sections.push('**可直接放上 redesign 后网站的 quote：**');
      sections.push('');
      for (const q of reviews.quotable_for_redesign) {
        sections.push(`> "${q.quote || ''}"`);
        sections.push(`> — **${q.author || 'anonymous'}**, ${'★'.repeat(Math.round(q.rating || 5))}`);
        if (q.why_useful) sections.push(`>`);
        if (q.why_useful) sections.push(`> *放哪：${q.why_useful}*`);
        sections.push('');
      }
    }
  }

  // ── 五、当前网站在哪里"漏水" ──
  const critical = (audit.issues?.critical) || [];
  const major = (audit.issues?.major) || [];
  if (critical.length || major.length) {
    sections.push('## 五、当前网站在哪里"漏水"');
    sections.push('');
    if (critical.length) {
      sections.push(`### 关键问题 · ${critical.length} 项（立刻在伤害成交）`);
      sections.push('');
      for (const issue of critical) sections.push(renderIssueBlock(issue, manifest, 'critical'));
    }
    if (major.length) {
      sections.push(`### 主要问题 · ${major.length} 项（影响转化的明显短板）`);
      sections.push('');
      for (const issue of major) sections.push(renderIssueBlock(issue, manifest, 'major'));
    }
  }

  // ── 六、Redesign 的发力点 ──
  const redesignHooks = [
    ...((visual.redesign_priorities || []).map((p) => ({ source: 'vision', text: p }))),
    ...((reviews.redesign_hooks || []).map((p) => ({ source: 'reviews', text: p }))),
  ];
  if (redesignHooks.length) {
    sections.push('## 六、Redesign 的发力点（综合视觉 + 评论数据）');
    sections.push('');
    for (let i = 0; i < redesignHooks.length; i += 1) {
      const h = redesignHooks[i];
      const tag = h.source === 'vision' ? '[视觉]' : '[评论]';
      sections.push(`${i + 1}. ${tag} ${h.text}`);
    }
    sections.push('');
  }

  // ── 七、销售切入点 ──
  // (Derived from hard triggers + weakest dimension. Same heuristic as
  // internal-audit-html.js deriveSalesAngle but shaped for prose.)
  const salesAngles = deriveSalesAngles({ audit, reviewAnalysis: reviews, latest });
  if (salesAngles.length) {
    sections.push('## 七、推荐销售切入点');
    sections.push('');
    for (const a of salesAngles) sections.push(`- ${a}`);
    sections.push('');
  }

  // ── 附录 ──
  sections.push('## 附录 · 数据出处');
  sections.push('');
  sections.push(`- Cheap audit version: \`${audit.cheap_config_version || '-'}\``);
  sections.push(`- Detailed audit version: \`${audit.audit_version || '-'}\``);
  sections.push(`- Vision model: \`ollama-qwen3.6-27b-nothink\``);
  sections.push(`- Review source: \`Google Places Place Details · most_relevant\``);
  sections.push(`- 完整 audit 报告 HTML：[internal-audit-report](./internal-audit-report.html)`);
  sections.push('');

  const md = `---\n${yamlSerialize(fm)}\n---\n\n${sections.join('\n')}`;
  return { md, frontmatter: fm, sectionCount: sections.filter((s) => s.startsWith('## ')).length };
}

function deriveSalesAngles({ audit, reviewAnalysis, latest }) {
  const out = [];
  const triggers = audit?.hard_triggers || [];
  const triggerTalk = {
    no_https: '你的网站没有 HTTPS — 浏览器对来访客户显示「不安全」，直接伤害信任',
    mobile_broken: '你的网站在手机上基本不可用 — 这是大多数本地搜索的入口',
    no_visible_cta_or_phone: '客户进来看不到联系按钮和电话 — 找不到怎么联系你就直接走了',
    no_website: '你目前没有独立网站 — 所有 Google 流量进来后没地方落地',
    high_traction_old_site: '你已经有不错的 Google 流量基础（' + (latest?.review_count || '?') + ' 条 ' + fmtRating(latest?.rating) + ' 评论），但当前网站设计在浪费这些点击',
    third_party_landing_page: '你目前用的不是真正属于你的网站 — 流量都给了第三方平台，关闭后什么都不剩',
  };
  for (const t of triggers) {
    if (triggerTalk[t]) out.push(triggerTalk[t]);
  }
  if (reviewAnalysis?.trust_signal_strength === 'strong') {
    out.push('客户口碑已经强（' + reviewAnalysis.positive_themes?.slice(0, 3).join(' / ') + '）— 网站只需要把这份信任承接住，不需要从零建立');
  }
  return out;
}

export function writeMasterMd({ outputPath, ...rest }) {
  const { md, frontmatter, sectionCount } = buildMasterMd(rest);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, md);
  return { mdPath: outputPath, frontmatter, sectionCount, byteLength: Buffer.byteLength(md, 'utf8') };
}
