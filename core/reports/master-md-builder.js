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
import { gradeLead } from '../scoring/lead-grading.js';

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

  // ── Layer 1: technical fact ──
  // For DOM rules: rationale is the fact. For vision LLM issues: what_observed.
  const fact = issue.what_observed || issue.rationale || '';
  if (fact) {
    lines.push(`**技术事实**`);
    lines.push('');
    lines.push(fact);
    lines.push('');
  }

  // ── Layer 2: plain language (Chinese) ──
  const plain = issue.plain_language || issue.plain_explanation;
  if (plain) {
    lines.push(`**普通话翻译**`);
    lines.push('');
    lines.push(plain);
    lines.push('');
  }

  // ── Layer 3: customer impact (with $ when possible) ──
  if (issue.customer_impact) {
    lines.push(`**对客户的影响**`);
    lines.push('');
    lines.push(issue.customer_impact);
    lines.push('');
  }

  // Vision-specific extras (kept after the 3 layers)
  if (issue.why_problem && !issue.customer_impact) {
    lines.push(`**为什么是问题**`);
    lines.push('');
    lines.push(issue.why_problem);
    lines.push('');
  }
  if (issue.what_correct_looks_like) {
    lines.push(`**正确长啥样**`);
    lines.push('');
    lines.push(issue.what_correct_looks_like);
    lines.push('');
  }
  if (issue.how_to_fix_in_redesign) {
    lines.push(`**Redesign 怎么改**`);
    lines.push('');
    lines.push(issue.how_to_fix_in_redesign);
    lines.push('');
  }

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
  reviewBundle,        // full fetched bundle (includes rating_distribution if from local docker)
  techStack,           // detectTechStack output (CMS / analytics / pixels)
  sitemapAnalysis,     // analyzeSitemap output (page count + redirect plan)
  activity,            // auditActivity output (freshness, blog, socials)
  aiGeo,               // auditAiGeoReadiness output (12 checks)
  pagespeed,           // PSI mobile + desktop result with CRUX field data
  formAudit,           // auditFormsOnPage output (forms + captcha + spam)
  domainHistory,       // auditDomainHistory output (whois + Wayback + DNS)
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

  // ── Lead grading (internal-only summary at the top) ──
  const sizeSignal = deriveBusinessSizeSignal({ latest, sitemapAnalysis, activity, techStack });
  const grading = gradeLead({
    entity,
    detailedAudit: audit,
    cheapAudit: null,
    techStack,
    sitemapAnalysis,
    activity,
    domainHistory,
    reviewAnalysis: reviews,
    businessSizeSignal: sizeSignal,
  });
  sections.push('## 内部分级 · 运营优先看这段');
  sections.push('');
  sections.push(`**投入分级：** \`${grading.investment_level}\` ${
    { A: '全攻 — 完整 OD redesign + 个性化销售流程',
      B: '预览试探 — ChatGPT 生成 mockup hero 图 + 短邮件试反应',
      C: '批量轻触 — 模板邮件 + 报告 PDF 链接，无主动跟进',
      D: '跳过 — 不投入精力' }[grading.investment_level] || ''
  }`);
  sections.push('');
  if (grading.investment_factors?.length) {
    sections.push('**触发依据：**');
    for (const f of grading.investment_factors) sections.push(`- ${f}`);
    sections.push('');
  }
  if (grading.product_tier) {
    sections.push(`**产品档位：** \`${grading.product_tier}\` ${grading.product_tier_label}`);
    sections.push('');
    sections.push(`- ${grading.product_tier_factors.join('\n- ')}`);
    sections.push('');
    if (grading.recommended_pricing) {
      const p = grading.recommended_pricing;
      sections.push(`**建议报价：** 一次性 ${p.one_time}${p.monthly ? ` + 月度 ${p.monthly}` : ''}`);
      sections.push('');
    }
  }
  sections.push(`**下一步行动：** ${grading.next_action}`);
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
    // Rating distribution table — only available when reviewBundle came
    // from local docker scrape (Places API doesn't return per-star counts).
    const dist = reviewBundle?.rating_distribution;
    const total = dist ? Object.values(dist).reduce((a, b) => a + Number(b || 0), 0) : 0;
    if (dist && total > 0) {
      sections.push('**评分分布（基于 Google 全量评论）：**');
      sections.push('');
      sections.push('| 星级 | 条数 | 占比 |');
      sections.push('|---|---|---|');
      for (const star of [5, 4, 3, 2, 1]) {
        const n = Number(dist[star] || 0);
        const pct = total ? ((n / total) * 100).toFixed(1) : '0';
        sections.push(`| ${star}★ | ${n} | ${pct}% |`);
      }
      sections.push(`| **合计** | **${total}** | 100% |`);
      sections.push('');
      const fivePct = ((Number(dist[5] || 0) / total) * 100).toFixed(0);
      sections.push(`**${fivePct}% 是 5★ 评价** — 这条数据本身就是巨大的销售素材，redesign 后的网站应该把它放在 hero 区。`);
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
  // Merge DOM rule issues + vision LLM issues. Both have the same shape
  // after Sprint A — three-layer (technical fact / 普通话 / customer impact).
  const dimRuleCritical = (audit.issues?.critical) || [];
  const dimRuleMajor = (audit.issues?.major) || [];
  const visionIssues = (visual.issues || []);
  const visionCritical = visionIssues.filter((i) => i.severity === 'critical');
  const visionMajor = visionIssues.filter((i) => i.severity === 'major' || !i.severity);
  const allCritical = [...dimRuleCritical, ...visionCritical];
  const allMajor = [...dimRuleMajor, ...visionMajor];

  if (allCritical.length || allMajor.length) {
    sections.push('## 五、当前网站在哪里"漏水"');
    sections.push('');
    if (allCritical.length) {
      sections.push(`### 关键问题 · ${allCritical.length} 项（立刻在伤害成交）`);
      sections.push('');
      for (const issue of allCritical) sections.push(renderIssueBlock(issue, manifest, 'critical'));
    }
    if (allMajor.length) {
      sections.push(`### 主要问题 · ${allMajor.length} 项（影响转化的明显短板）`);
      sections.push('');
      for (const issue of allMajor) sections.push(renderIssueBlock(issue, manifest, 'major'));
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

  // ── PageSpeed Insights · 真实用户速度数据 ──
  if (pagespeed?.ok) {
    sections.push('## 真实速度数据 · Google PageSpeed Insights');
    sections.push('');
    sections.push('我们前面那段「慢速 4G 加载视频」是我们这边的实验室结果。这一段是 **Google 自己**对你网站打的分，包括过去 28 天 **真实访客**的网络体验数据（CRUX field data）。');
    sections.push('');
    const m = pagespeed.results?.mobile;
    const d = pagespeed.results?.desktop;
    if (m) {
      sections.push('### 移动端（mobile）');
      sections.push('');
      sections.push(`**Lighthouse 分数（实验室）：**`);
      sections.push('');
      sections.push('| 维度 | 分数 |');
      sections.push('|---|---|');
      sections.push(`| 性能 (Performance) | **${m.scores.performance}/100** |`);
      sections.push(`| 可访问性 (Accessibility) | ${m.scores.accessibility}/100 |`);
      sections.push(`| 最佳实践 (Best Practices) | ${m.scores.best_practices}/100 |`);
      sections.push(`| SEO | ${m.scores.seo}/100 |`);
      sections.push('');
      const lab = m.lab_metrics;
      if (lab.lcp_ms != null) {
        sections.push(`**Lab 关键指标：** LCP \`${(lab.lcp_ms / 1000).toFixed(1)}s\` · FCP \`${(lab.fcp_ms / 1000).toFixed(1)}s\` · CLS \`${(lab.cls || 0).toFixed(3)}\` · TBT \`${Math.round(lab.tbt_ms || 0)}ms\``);
        sections.push('');
      }
      if (m.crux_overall) {
        sections.push(`**真实用户体验（过去 28 天 CRUX field data）总评：** \`${m.crux_overall}\``);
        sections.push('');
        const crux = m.crux_field_data;
        const cruxRows = [];
        if (crux.lcp_p75_ms?.p75 != null) cruxRows.push(`| LCP（最大内容绘制 p75） | ${(crux.lcp_p75_ms.p75 / 1000).toFixed(2)}s | ${crux.lcp_p75_ms.category} |`);
        if (crux.fcp_p75_ms?.p75 != null) cruxRows.push(`| FCP（首次内容绘制 p75） | ${(crux.fcp_p75_ms.p75 / 1000).toFixed(2)}s | ${crux.fcp_p75_ms.category} |`);
        if (crux.ttfb_p75_ms?.p75 != null) cruxRows.push(`| TTFB（服务器响应 p75） | ${(crux.ttfb_p75_ms.p75 / 1000).toFixed(2)}s | ${crux.ttfb_p75_ms.category} |`);
        if (crux.cls_p75?.p75 != null) cruxRows.push(`| CLS（布局抖动 p75） | ${(crux.cls_p75.p75 / 100).toFixed(3)} | ${crux.cls_p75.category} |`);
        if (crux.inp_p75_ms?.p75 != null) cruxRows.push(`| INP（交互响应 p75） | ${crux.inp_p75_ms.p75}ms | ${crux.inp_p75_ms.category} |`);
        if (cruxRows.length) {
          sections.push('| 指标 | 75% 用户值 | Google 评级 |');
          sections.push('|---|---|---|');
          sections.push(cruxRows.join('\n'));
          sections.push('');
          sections.push(`**这意味着：** 过去 28 天访问你网站的实际用户里，75% 的人遇到的体验就是上面这些数字 — 不是我们测的、是 Google 用真实 Chrome 用户数据统计出来的。`);
          sections.push('');
        }
      }
      if ((m.opportunities || []).length) {
        sections.push(`**Google 建议的优化项（按节省时间排序，前 ${m.opportunities.length}）：**`);
        sections.push('');
        for (const op of m.opportunities) {
          const savingsBits = [];
          if (op.savings_ms) savingsBits.push(`节省 ${Math.round(op.savings_ms)}ms`);
          if (op.savings_bytes) savingsBits.push(`节省 ${(op.savings_bytes / 1024).toFixed(0)}KB`);
          sections.push(`- **${op.title}** — ${savingsBits.join(' · ')}`);
        }
        sections.push('');
      }
    }
    if (d) {
      sections.push(`### 桌面端（desktop）`);
      sections.push('');
      sections.push(`**Lighthouse 分数：** Performance ${d.scores.performance} · A11y ${d.scores.accessibility} · Best Practices ${d.scores.best_practices} · SEO ${d.scores.seo}`);
      sections.push('');
    }
  }

  // ── SEO 迁移评估 + 运营活跃度 ──
  if (sitemapAnalysis?.ok || activity?.ok) {
    sections.push('## SEO 迁移评估 与 运营活跃度');
    sections.push('');
    sections.push('客户最常担心的问题：「我重做网站，会不会丢掉 Google 排名？」这一段直接回答。');
    sections.push('');

    if (sitemapAnalysis?.ok) {
      const s = sitemapAnalysis;
      if (s.has_sitemap) {
        sections.push(`### 现有页面盘点`);
        sections.push('');
        sections.push(`- **Sitemap 状态：** 已检测到 → \`${s.sitemap_url}\``);
        sections.push(`- **页面总数：** ${s.total_urls}`);
        sections.push(`- **迁移复杂度：** ${
          s.migration_complexity === 'low' ? '低（≤15 页 — 1-2 周内可完成全站重做）'
          : s.migration_complexity === 'medium' ? '中（≤80 页 — 服务页 + 部分 blog）'
          : '高（>80 页 — 需要分阶段迁移 + 完整 redirect map）'
        }`);
        sections.push('');
        const byPattern = s.urls_by_pattern || {};
        if (Object.keys(byPattern).length) {
          sections.push('**页面分类：**');
          sections.push('');
          sections.push('| 类型 | 数量 |');
          sections.push('|---|---|');
          const labels = {
            home: '首页', service_page: '服务详情页', blog_post: 'Blog 文章',
            about: '关于 / 团队', contact: '联系 / 报价', gallery: '作品集 / 案例',
            faq: 'FAQ', testimonial: '客户评价', legal: '法律 / 隐私',
            top_level_page: '顶层页面', inner_page: '内页', asset: '资源文件',
          };
          for (const [k, v] of Object.entries(byPattern).sort((a, b) => b[1] - a[1])) {
            sections.push(`| ${labels[k] || k} | ${v} |`);
          }
          sections.push('');
        }
        if (s.last_mod_summary) {
          sections.push(`**Sitemap lastmod 跨度：** 最旧 ${s.last_mod_summary.oldest} → 最新 ${s.last_mod_summary.newest}`);
          sections.push('');
        }
        sections.push(`**Redirect 计划承诺：** redesign 上线时我们会附一份 ${Math.min(s.total_urls, s.redirect_plan?.length || 0)} 条 1:1 redirect 表（旧 URL → 新 URL），保证 Google 已经索引的页面权重无损迁移。已经在 Google 第一二页的关键词不会丢。`);
        sections.push('');
      } else {
        sections.push(`### 现有页面盘点`);
        sections.push('');
        sections.push(`- **Sitemap 状态：** 未发现 sitemap.xml — 这本身就是个 SEO 短板（Google 爬虫漏抓页面），redesign 时会一并补上。`);
        sections.push('');
      }
    }

    if (activity?.ok) {
      sections.push(`### 运营活跃度`);
      sections.push('');
      const lab = (f) => ({
        active: '活跃（30 天内有更新）',
        recent: '近期（90 天内有更新）',
        stale: '停滞（超过 3 个月没动）',
        dormant: '休眠（超过 1 年没更新过）',
        unknown: '无法判断',
      }[f] || f);
      sections.push(`- **整体活跃度：** ${lab(activity.overall_freshness)} ${activity.days_since_any_update != null ? `（最近一次更新 ${activity.days_since_any_update} 天前）` : ''}`);
      if (activity.blog_section_present) {
        sections.push(`- **Blog 板块：** 有，共 ${activity.blog_post_count} 篇文章 ${activity.days_since_newest_blog != null ? `（最新一篇 ${activity.days_since_newest_blog} 天前）` : ''}`);
      } else {
        sections.push(`- **Blog 板块：** 未发现 — 没有内容营销基础`);
      }
      const sl = activity.social_links || {};
      const socialList = Object.keys(sl);
      if (socialList.length) {
        sections.push(`- **社交媒体链接：** 网站上引用了 ${socialList.length} 个平台 — ${socialList.join(', ')}`);
      } else {
        sections.push(`- **社交媒体链接：** 网站上没有 social 链接 — GBP 流量进来后没有第二触点`);
      }
      sections.push('');

      if (activity.overall_freshness === 'dormant') {
        sections.push(`> **关键发现：** 客户的网站超过一年没动过。redesign 之后我们也建议帮忙建立最低限度的内容更新节奏（每月 1 篇 case study 即可），否则 AI / Google 都会判定网站「死站」。`);
        sections.push('');
      }
    }
  }

  // ── 表单与 anti-spam 审计 ──
  if (formAudit?.ok && formAudit.form_count_total > 0) {
    sections.push('## 联系表单与防垃圾设置');
    sections.push('');
    sections.push('客户能不能 *方便地* 把信息留下来 = 直接的转化路径。这一段审视所有 `<form>` 元素的可用性 + 防 spam 配置。');
    sections.push('');
    const contactForms = formAudit.forms.filter((f) => f.role === 'contact');
    if (!contactForms.length) {
      sections.push('**关键发现：网站上没有可识别的联系/报价表单** — 客户只能通过电话或邮件触达。redesign 必须补一个高效的报价请求表单（建议 3-4 字段：姓名 / 电话 / 邮箱 / 简短需求）。');
      sections.push('');
    } else {
      for (const f of contactForms) {
        const firctionLabel = { low: '低（≤4 字段，转化友好）', moderate: '中（5-6 字段）', high: '高（≥7 字段，会显著降低转化）' }[f.friction_level] || f.friction_level;
        sections.push(`### 表单 · ${f.field_count} 字段（摩擦：${firctionLabel}）`);
        sections.push('');
        sections.push(`- **字段构成：** ${f.inputs.map((i) => `${i.labelText || i.name}(${i.type}${i.required ? ',必填' : ''})`).join(' · ')}`);
        sections.push(`- **必填字段数：** ${f.required_count}/${f.field_count}`);
        sections.push(`- **常见关键字段：** ${[f.has_email_field && 'email', f.has_phone_field && 'phone', f.has_message_field && 'message'].filter(Boolean).join(' · ') || '都没有 — 异常'}`);
        sections.push(`- **提交按钮：** ${f.has_submit_button ? `「${f.submit_label}」` : '⚠ 未找到 submit 按钮 — 表单可能根本无法提交'}`);
        sections.push(`- **Honeypot 防 spam：** ${f.honeypot_present ? '已配置（推荐做法，对真人无感）' : '未检测到'}`);
        sections.push('');
      }
    }
    if (formAudit.captchas_detected.length) {
      sections.push('**已部署的人机验证：**');
      for (const c of formAudit.captchas_detected) {
        const frictionTag = { high: '高摩擦', low: '低摩擦', invisible: '不可见' }[c.friction] || c.friction;
        sections.push(`- ${c.name} — ${frictionTag}`);
      }
      sections.push('');
    } else if (!formAudit.has_any_anti_spam) {
      sections.push('**未检测到任何 anti-spam 措施**（reCAPTCHA / hCaptcha / Turnstile / honeypot 都没有）— 表单极容易被自动机器人灌爆，垃圾询盘会让客户对真实询盘麻木。redesign 时建议加 Cloudflare Turnstile（不可见，免费）。');
      sections.push('');
    }
    if (formAudit.auditor_notes?.length) {
      sections.push('**Audit 总结：**');
      sections.push('');
      for (const n of formAudit.auditor_notes) {
        const tag = { high: '关键', medium: '中等', low: '提示' }[n.severity] || n.severity;
        sections.push(`- [${tag}] ${n.text}`);
      }
      sections.push('');
    }
  }

  // ── 域名年龄 + Wayback 历史 + 邮件 DNS ──
  if (domainHistory?.ok) {
    sections.push('## 域名历史与邮件信誉');
    sections.push('');
    const dh = domainHistory;
    if (dh.domain_age_years != null) {
      const referenceDate = dh.domain_created_iso || dh.wayback?.first_snapshot || null;
      const sourceLabel = dh.domain_age_source === 'wayback_first_snapshot_proxy'
        ? `Wayback 首次快照 ${referenceDate || '-'} 起算（.au 域名无公开创建日期）`
        : `创建于 ${referenceDate?.slice(0,10) || '-'}`;
      sections.push(`- **域名"在线已"约：** ${dh.domain_age_years} 年（${sourceLabel}）— ${dh.domain_age_years >= 5 ? '老域名 = 多年 SEO 资产，redesign 时 redirect map 必须做对' : dh.domain_age_years >= 2 ? '中等年龄' : '相对年轻的域名'}`);
    }
    if (dh.wayback?.snapshot_count) {
      sections.push(`- **Wayback Machine 快照：** ${dh.wayback.snapshot_count} 条（${dh.wayback.first_snapshot} → ${dh.wayback.last_snapshot}）`);
      if (dh.recent_redesign_signal) {
        sections.push(`  - ⚠ ${dh.recent_redesign_signal} — **建议把这个 lead 降低优先级**（刚 redesign 过的客户短期不会再投资重做）`);
      }
    }
    sections.push('');

    if (dh.email_dns) {
      const ed = dh.email_dns;
      sections.push('### 邮件 DNS 配置（影响未来邮件营销 / 冷邮件投递率）');
      sections.push('');
      sections.push(`- **SPF (反垃圾发件验证)：** ${ed.spf_present ? '已配置' : '⚠ 未配置 — 客户如果用域名邮箱发邮件，进垃圾箱的概率高'}`);
      sections.push(`- **DKIM (邮件签名)：** ${ed.dkim_selectors_found.length ? `已配置（selectors: ${ed.dkim_selectors_found.join(', ')}）` : '⚠ 常见 selector 未发现 DKIM 配置（不一定确凿，但提示有问题）'}`);
      sections.push(`- **DMARC (策略)：** ${ed.dmarc_present ? `已配置（policy: \`${ed.dmarc_policy || 'none'}\`）` : '⚠ 未配置 — 域名易被仿冒做钓鱼'}`);
      sections.push(`- **整体邮件投递信誉：** \`${ed.posture}\` ${
        ed.posture === 'strong' ? '(SPF + DKIM + DMARC 齐全)'
        : ed.posture === 'partial' ? '(只有 2/3 — 建议补全)'
        : ed.posture === 'weak' ? '(只有 1/3 — 邮件营销前必须修)'
        : '(全无配置 — 邮件营销 / cold outreach 几乎不可能投递成功)'
      }`);
      sections.push('');
      if (ed.posture !== 'strong') {
        sections.push('> 这是后续 **「Social Media Management 月度包」** 或 **「Cold Outreach 启动包」** 的前置条件 —— 邮件 DNS 没修好，发出去的邮件全进垃圾箱。redesign 时一并处理。');
        sections.push('');
      }
    }
  }

  // ── 技术栈与营销基建 ──
  if (techStack && techStack.ok) {
    sections.push('## 技术栈与营销基建');
    sections.push('');
    sections.push('从网站源码识别出来的工具，能帮我们判断这位客户的数字成熟度。');
    sections.push('');
    const ts = techStack;
    const rows = [];
    if (ts.cms) rows.push(`- **网站平台 (CMS)：** ${ts.cms.name}（迁移复杂度参考；WordPress / Wix / Squarespace 这类有标准导出工具，custom-coded 会复杂）`);
    if (ts.cms_alternatives?.length) rows.push(`  - 还检测到：${ts.cms_alternatives.map((c) => c.name).join(' · ')}`);
    if (ts.analytics?.length) rows.push(`- **分析工具：** ${ts.analytics.map((a) => a.name).join(' · ')}`);
    else rows.push(`- **分析工具：** 未检测到 — 客户目前看不到任何流量数据，等于在盲飞`);
    if (ts.pixels?.length) {
      rows.push(`- **广告 Pixel：** ${ts.pixels.map((p) => p.name).join(' · ')} — 客户已经在投放（或投放过）付费广告，对营销预算不陌生`);
    } else {
      rows.push(`- **广告 Pixel：** 未检测到 — 暂未投放追踪型广告`);
    }
    if (ts.chat?.length) rows.push(`- **客服 / 聊天：** ${ts.chat.map((c) => c.name).join(' · ')}`);
    if (ts.email_capture?.length) rows.push(`- **邮件捕获：** ${ts.email_capture.map((e) => e.name).join(' · ')}`);
    if (ts.hosting_hint) rows.push(`- **托管 / CDN 线索：** ${ts.hosting_hint}`);
    sections.push(rows.join('\n'));
    sections.push('');
    sections.push(`**数字成熟度打分：** ${ts.sophistication_score} / 6 ${
      ts.sophistication_score >= 4 ? '（高 — 客户懂数字营销，redesign 谈预算时不必从零教育）'
      : ts.sophistication_score >= 2 ? '（中 — 已有基础设施，缺少深度运营）'
      : '（低 — 客户对网站的认知是「有就行」，需要先讲清楚一份能赚钱的网站长什么样）'
    }`);
    sections.push('');

    // Pixel preservation clause — every detected tracker must be re-installed
    // on the rebuild, otherwise the customer loses historical conversion data
    // and ad-account targeting audiences.
    const allTrackers = [
      ...(ts.analytics || []).map((a) => a.name),
      ...(ts.pixels || []).map((p) => p.name),
    ];
    if (allTrackers.length) {
      sections.push('### Redesign 时必须保留 / 重新安装的追踪代码');
      sections.push('');
      sections.push('客户可能有数月 / 数年的历史数据 + 广告投放受众 sit 在这些 ID 上面。重做时**必须用同一套 ID 重新接进新网站**，否则等于清零所有累积。');
      sections.push('');
      for (const name of allTrackers) sections.push(`- ${name}`);
      sections.push('');
      sections.push('我们 redesign 交付清单会把这些列为「必须 setup 项」。');
      sections.push('');
    }

    // Notable risk: Universal Analytics (deprecated July 2023) still installed
    if (ts.analytics?.some((a) => a.id === 'ua')) {
      sections.push('> **关键发现：客户网站还装着 Universal Analytics**，这套工具 Google 已于 2023 年 7 月停止收集数据。也就是说，**他们至少 2 年没有看过任何真实的网站访客数据**。这是销售切入的强角度。');
      sections.push('');
    }
  }

  // ── AI / GEO Readiness ──
  if (aiGeo?.ok) {
    sections.push('## AI 时代可发现性 · GEO Readiness');
    sections.push('');
    sections.push('GEO = Generative Engine Optimization。ChatGPT、Perplexity、Google AI Overviews 这些 AI 搜索产品**不像传统搜索引擎那样按"关键词排名"工作**，它们直接抓取结构化数据并把答案合成给用户。如果你的网站在 AI 抓取这一块做得不到位，等于在生成式搜索时代隐身。');
    sections.push('');
    sections.push(`**AI 可发现性总分：** ${aiGeo.dimension_score} / 100 — ${aiGeo.summary}`);
    sections.push('');
    const passed = aiGeo.rules.filter((r) => r.hit);
    const failed = aiGeo.rules.filter((r) => !r.hit);
    if (passed.length) {
      sections.push(`### 已经做到的（${passed.length} 项）`);
      sections.push('');
      for (const r of passed) sections.push(`- [PASS] \`${r.id}\` — ${r.rationale}`);
      sections.push('');
    }
    if (failed.length) {
      sections.push(`### 还缺的（${failed.length} 项 — 这些是 redesign 时一并补上的标准动作）`);
      sections.push('');
      for (const r of failed) sections.push(`- [缺失] \`${r.id}\` (${r.max} 分) — ${r.rationale}`);
      sections.push('');
    }
    sections.push('> **销售切入：** 「ChatGPT 现在每月 30 亿次搜索，本地服务用户问『Brisbane 哪家屋顶公司靠谱』，AI 回答时只引用结构化数据完整的网站。你目前在这个新阵地的得分是 ' + aiGeo.dimension_score + '/100。」');
    sections.push('');
  }

  // ── 业务规模信号（筛选 / 定价用，非销售素材）──
  if (sizeSignal) {
    sections.push('## 业务规模信号 · 内部筛选用');
    sections.push('');
    sections.push('**注：这一段只给运营内部看，不进入客户报告。** 用来判断这个 lead 是不是匹配我们「小网站 / 多批量 / 快上线」的产品定位。');
    sections.push('');
    sections.push(`- **规模信号汇总：** ${sizeSignal.summary}`);
    sections.push(`- **客户分级：** \`${sizeSignal.tier}\` ${sizeSignal.tier === 'enterprise' ? '— 大客户，要求多、决策慢，**与我们小批量模式不匹配**，建议跳过或转介给定制开发服务商' : sizeSignal.tier === 'mid' ? '— 中型客户，可接但价格要往上提（基础包 + 配置项）' : '— 小型，符合我们标准产品包定位'}`);
    sections.push(`- **建议定价档：** ${sizeSignal.pricingTier}`);
    sections.push('');
    if (sizeSignal.indicators?.length) {
      sections.push('**触发依据：**');
      for (const i of sizeSignal.indicators) sections.push(`- ${i}`);
      sections.push('');
    }
  }

  // ── Upsell 机会（基于活跃度 + GBP 流量底子）──
  if (activity?.ok || techStack) {
    const upsells = deriveUpsellOpportunities({ activity, latest, techStack, reviews });
    if (upsells.length) {
      sections.push('## Upsell 机会 · redesign 之外的月度营收');
      sections.push('');
      sections.push('redesign 是一次性收入。以下是基于这个客户当前现状自动识别的**持续性服务包**机会，可以在 redesign 提案签字时一并捆绑进去。');
      sections.push('');
      for (const u of upsells) {
        sections.push(`### ${u.title}`);
        sections.push('');
        sections.push(`**触发依据：** ${u.trigger}`);
        sections.push('');
        sections.push(`**包内容：** ${u.scope}`);
        sections.push('');
        sections.push(`**月度费用区间：** ${u.priceRange}`);
        sections.push('');
        sections.push(`**销售切入：** ${u.pitch}`);
        sections.push('');
      }
    }
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

function deriveBusinessSizeSignal({ latest, sitemapAnalysis, activity, techStack }) {
  const indicators = [];
  let score = 0;

  const reviewCount = Number(latest?.review_count || 0);
  const pageCount = sitemapAnalysis?.total_urls || 0;
  const categories = (latest?.categories || []).length;
  const trackerCount = (techStack?.analytics?.length || 0) + (techStack?.pixels?.length || 0);
  const socials = Object.keys(activity?.social_links || {}).length;

  // Reviews — proxy for established business operation
  if (reviewCount >= 500) { score += 3; indicators.push(`Google 评价 ${reviewCount} 条（≥500，大企业级口碑积累）`); }
  else if (reviewCount >= 200) { score += 2; indicators.push(`Google 评价 ${reviewCount} 条（≥200，成熟运营）`); }
  else if (reviewCount >= 50) { score += 1; indicators.push(`Google 评价 ${reviewCount} 条（≥50，有规模基础）`); }

  // Page count — proxy for content investment / multi-service complexity
  if (pageCount >= 300) { score += 3; indicators.push(`网站页面数 ${pageCount}（≥300，复杂多服务体系）`); }
  else if (pageCount >= 100) { score += 2; indicators.push(`网站页面数 ${pageCount}（≥100，中等复杂度）`); }
  else if (pageCount >= 30) { score += 1; indicators.push(`网站页面数 ${pageCount}（≥30，中小规模）`); }

  // Categories — multiple = diversified service offering
  if (categories >= 4) { score += 1; indicators.push(`GBP 多业务分类 ${categories} 个（多元化经营）`); }

  // Tracker sophistication — paid digital marketing budget
  if (trackerCount >= 4) { score += 2; indicators.push(`已部署 ${trackerCount} 个分析 / pixel 工具（高数字成熟度）`); }
  else if (trackerCount >= 2) { score += 1; indicators.push(`已部署 ${trackerCount} 个追踪工具`); }

  // Social channel diversity
  if (socials >= 4) { score += 1; indicators.push(`引用 ${socials} 个社交平台（多渠道运营）`); }

  if (!indicators.length) return null;

  let tier, pricingTier, summary;
  if (score >= 7) {
    tier = 'enterprise';
    pricingTier = '不建议接（与我们小批量模式不匹配）；如果接，最低 $20K + 月度运营 $3K+';
    summary = '大型客户特征';
  } else if (score >= 4) {
    tier = 'mid';
    pricingTier = '基础包 $6-10K + 月度运营 $1-2K';
    summary = '中型客户特征';
  } else {
    tier = 'small';
    pricingTier = '标准包 $3-6K（符合我们核心产品）';
    summary = '小型客户特征';
  }

  return { tier, pricingTier, summary, indicators, score };
}

function deriveUpsellOpportunities({ activity, latest, techStack, reviews }) {
  const out = [];
  const reviewCount = Number(latest?.review_count || 0);
  const rating = Number(latest?.rating || 0);
  const goodTraction = reviewCount >= 50 && rating >= 4.0;
  const fresh = activity?.overall_freshness;
  const socials = Object.keys(activity?.social_links || {});

  if (goodTraction && (fresh === 'dormant' || fresh === 'stale')) {
    out.push({
      title: 'Social Media Management 月度包',
      trigger: `客户活跃度为「${fresh === 'dormant' ? '休眠（>1 年没动）' : '停滞（3-12 月没动）'}」，但 Google 上有 ${reviewCount} 条 ${rating}★ 评价的口碑底子 — 有内容素材却没在用。`,
      scope: '每月 8-12 帖（FB / IG / LinkedIn 至少 2 平台）+ 4 条工程现场 reels/short videos + 月度 GBP 帖子 2 条 + 评论回复代运营。',
      priceRange: '$800-1,500/月（视平台数量与内容深度）',
      pitch: '「你 Google 上的 ${reviewCount} 条好评是金矿，但你的 Facebook 已经 ${days} 天没动过 — 这等于你把口碑资产堆在仓库里没拿去卖。我们月度包就是把这部分自动化跑起来。」'
        .replace('${reviewCount}', reviewCount).replace('${days}', activity?.days_since_any_update || '?'),
    });
  }

  if (socials.length === 0) {
    out.push({
      title: 'Social presence 一次性 setup + 月度运营包',
      trigger: '网站上没检测到任何社交媒体链接 — 连基础的多渠道触点都缺。',
      scope: '一次性：FB / IG 商家档案 setup + 品牌头像/封面 + 内容模板 5 套 (3-5K 一次性)。月度：4 帖 + 评论管理 + 月度报表。',
      priceRange: '$1,500 setup + $600-900/月',
      pitch: '「Google Maps 流量进来后没有第二落点，意味着客户当下没决定就走了 — 没办法再触及。社交账号是免费的二次触达管道。」',
    });
  }

  if (activity?.blog_section_present === false) {
    out.push({
      title: '内容写作月度包（Blog / 案例 / SEO 长尾）',
      trigger: '网站没有 blog 板块 — 没有内容营销基础设施，长尾 SEO 流量为零。',
      scope: '每月 2 篇 SEO-optimized blog（800-1,200 字）+ 每季度 1 篇 case study（含 before/after 图）+ 关键词研究报告。',
      priceRange: '$400-800/月',
      pitch: '「ChatGPT 时代搜索引擎更偏爱有「专家深度内容」的网站。你目前的网站只有服务介绍页 — AI 可引用的素材几乎为零。」',
    });
  } else if (activity?.blog_post_count >= 1 && activity?.days_since_newest_blog > 180) {
    out.push({
      title: '内容写作月度包（Blog 复活）',
      trigger: `Blog 板块存在但已 ${activity.days_since_newest_blog} 天没新文章 — 内容资产在贬值。`,
      scope: '每月 2 篇新文 + 季度审视旧文做更新 + 内链优化。',
      priceRange: '$400-800/月',
      pitch: '「你已经投资过 blog 板块，但久未更新等于让这部分 SEO 资产滑坡。重启月度更新成本远低于重新建立。」',
    });
  }

  // Has paid ads pixel but missing analytics — measurement gap
  const ts = techStack || {};
  if (ts.has_paid_ads_evidence && !ts.has_measurement) {
    out.push({
      title: '付费广告 ROI 分析包',
      trigger: '检测到 Google Ads / Meta Pixel 但没装分析工具 — 客户在投钱却看不到投了之后发生了什么。',
      scope: '装 GA4 + 转化事件配置 + 月度广告 ROI 报表 + 转化路径分析。',
      priceRange: '$300-600/月（按广告预算 5-10% 比例）',
      pitch: '「你已经在投广告但没装分析 — 等于把钱扔进黑洞。我们帮你看清每一块钱的去处。」',
    });
  }

  return out;
}

export function writeMasterMd({ outputPath, ...rest }) {
  const { md, frontmatter, sectionCount } = buildMasterMd(rest);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, md);
  return { mdPath: outputPath, frontmatter, sectionCount, byteLength: Buffer.byteLength(md, 'utf8') };
}
