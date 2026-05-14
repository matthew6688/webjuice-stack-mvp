/**
 * Lead thread profile card — pinned-style top message in each Discord forum post.
 * V3 D35 (2026-05-14): 中文重设计 · 字段从 16 → 条件渲染 · 销售导向。
 *
 * 数据源:
 *   - entity JSON (latest / sales_signals / grade / phase / etc.)
 *   - master.md frontmatter (audit_score / visual_* / decision / fired_triggers)
 *   - cf-pages-deploy.json (live URLs for #website-projects)
 *
 * Channel modes:
 *   - 'leads'    · 无 demo · 销售用 master.md 冷接触 · 不显示 live URL
 *   - 'projects' · 有 demo · 加 🌐 Demo + live URL 资源
 *   - 'paid'     · M5 · 加 💳 Payment + 🔁 Revision (字段预留)
 *
 * Render rule: 空字段自动 skip · 不显示 "—" 占位
 * Discord limit: 25 fields × 6000 chars total
 */

import fs from 'node:fs';
import path from 'node:path';
import { deriveLocale, nowInLocale } from '../leads/locale.js';
import { buildThreadTitle, nicheLabel, stageLabel, defaultStageForChannel } from './display-vocab.js';

const COLORS = {
  A: 0x2ecc71, // 绿 · 顶级
  B: 0x3498db, // 蓝 · 优质
  C: 0x95a5a6, // 灰 · 批量
  D: 0xe74c3c, // 红 · 弃
  default: 0x7f8c8d,
};

function slugifyName(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function fmtDaysAgo(iso) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const days = Math.floor(ms / 86400000);
  if (days < 1) return '今天';
  if (days === 1) return '1 天前';
  return `${days} 天前`;
}

/** Read CF Pages deploy record (含 demo_url + 4 asset URLs) · returns null if no demo built */
function readDeployRecord(clientSlug) {
  if (!clientSlug) return null;
  try {
    const p = path.join('clients', clientSlug, 'v2/concept/reference-adapter/cf-pages-deploy.json');
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

/** Read master.md frontmatter (含 audit_score · visual_* · decision · fired_triggers) */
function readMasterMdFrontmatter(clientSlug) {
  if (!clientSlug) return null;
  try {
    const p = path.join('clients', clientSlug, 'v2/master.md');
    if (!fs.existsSync(p)) return null;
    const raw = fs.readFileSync(p, 'utf8');
    const m = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!m) return null;
    // Naive YAML parser · just key: value · 不支持嵌套对象 (assets section)
    const out = {};
    for (const line of m[1].split('\n')) {
      const kv = line.match(/^(\w+):\s*(.*)$/);
      if (!kv) continue;
      let val = kv[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      else if (val === 'null' || val === '') val = null;
      else if (/^-?\d+(\.\d+)?$/.test(val)) val = Number(val);
      else if (val.startsWith('[') && val.endsWith(']')) {
        const inner = val.slice(1, -1).trim();
        val = inner ? inner.split(',').map((s) => s.trim().replace(/"/g, '')) : [];
      }
      out[kv[1]] = val;
    }
    return out;
  } catch {
    return null;
  }
}

/** List files in clients/<slug>/v2/{evidence,screenshots,video}/ */
function listAssets(clientSlug) {
  if (!clientSlug) return { evidence: [], screenshots: [], videos: [] };
  const base = path.join('clients', clientSlug, 'v2');
  const list = (sub, regex) => {
    const d = path.join(base, sub);
    if (!fs.existsSync(d)) return [];
    try { return fs.readdirSync(d).filter((f) => regex.test(f)); }
    catch { return []; }
  };
  return {
    evidence: list('evidence', /\.png$/i),
    screenshots: list('screenshots', /\.(png|jpg)$/i),
    videos: list('video', /\.(webm|mp4)$/i),
  };
}

/** "issue-busy-hero-with-heavy-shadow-text.png" → "Busy hero with heavy shadow text" */
function prettyEvidenceName(filename) {
  return filename
    .replace(/\.(png|jpg)$/i, '')
    .replace(/^issue-/, '')
    .replace(/-/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());
}

/** Format weekday_summary into a concise Chinese string */
function fmtWeekdaySummary(weekdaySummary, daysOpen) {
  if (!weekdaySummary) return null;
  // weekdaySummary 形如 "Mon: 07:00-17:00 · Tue: ... · Sun: closed"
  // 简化: 取第 1 个 open day · 显示 "X 天/周 · <typical hours>"
  const m = weekdaySummary.match(/[A-Z][a-z]+:\s*(\d{2}:\d{2}-\d{2}:\d{2})/);
  const hours = m ? m[1] : '';
  return `${daysOpen || '?'} 天/周${hours ? ` · ${hours}` : ''}`;
}

/**
 * Render entity to Discord embed (profile card).
 * V3 D35: 中文 labels · 条件字段 · 销售导向。
 */
export function renderProfileCard(entity, { audit = null, channel = 'leads' } = {}) {
  const latest = entity.latest || {};
  const grade = entity.grade || {};
  const phase = entity.phase || 'unset';
  const locale = deriveLocale(entity);
  const clientSlug = entity.promotedClientSlug || slugifyName(latest.name || '');
  const level = grade.investment_level || null;
  const tier = grade.product_tier || null;
  const niche = latest.niche || latest.category || '';

  // Load enrich data
  const mdFm = readMasterMdFrontmatter(clientSlug);
  const deploy = readDeployRecord(clientSlug);
  const assets = listAssets(clientSlug);
  const salesTime = latest.sales_signals?.best_contact_time || null;

  // Title · per SOP-DISCORD-DISPLAY §1.1 · [niche-中文] [stage-中文] [grade] name [emoji?]
  const title = buildThreadTitle(entity, channel);

  // V3 D35 (2026-05-14 · 终版 per Matthew):
  //   - 顺序: 行业 · 电话 · 现有网站 · Google · 营业
  //           → 审计总分 · 视觉评分 · 分级 · 最佳联系
  //           → 在线资源
  //           → 流转 · 客户本地 · 线索来源
  //           → 时间线 (全宽 · 末尾 · 单独)
  //   - 无 emoji (field 名)
  //   - Demo + 客户网站 = 裸 URL · 其他 = hyperlink
  //   - 7 section · 每 section = 1 field (inline:false 全宽)
  //   - section name = Discord 自动 bold · 无 emoji 装饰
  //   - 联系方式占位字段 (email/表单页/社媒) · 数据缺时显示 — (反向提醒销售要补)
  //   - 链接: 客户网站 + Demo URL = 裸 URL · 其他 hyperlink
  //   - 证据 = 每条单独 hyperlink (不数量统计)
  const fields = [];
  const lines = [];

  // ═══════ Section 1 · 销售阶段 ═══════
  lines.length = 0;
  if (level) {
    const tierLabel = tier === 'T1' ? 'T1 $399 一次性' :
                      tier === 'T2' ? 'T2 +年维护' :
                      tier === 'T3' ? 'T3 定制月度' : null;
    const action = level === 'A' ? '直接销售投入 · 电话/见面' :
                   level === 'B' ? '直接销售 · 邮件+demo URL' :
                   level === 'C' ? '批量轻触 · 模板邮件 + demo URL' :
                   level === 'D' ? '不追 · archived' : '';
    lines.push(`分级: ${level}${tier ? ` / ${tier}` : ''} · ${action}`);
    if (tierLabel) lines.push(tierLabel);
  }
  if (salesTime?.suggested_window) {
    lines.push(`最佳联系: ${salesTime.suggested_window} · ${salesTime.confidence || 'medium'}`);
    if (salesTime.rationale) lines.push(salesTime.rationale);
  }
  if (lines.length) fields.push({ name: '销售阶段', value: lines.join('\n'), inline: false });

  // ═══════ Section 2 · 基本信息 ═══════
  lines.length = 0;
  if (latest.category || (latest.categories && latest.categories.length)) {
    const cats = latest.categories?.length
      ? `${latest.category || latest.categories[0]} (+${latest.categories.length - 1})`
      : latest.category;
    lines.push(`行业: ${cats}`);
  }
  const weekdaySum = fmtWeekdaySummary(salesTime?.weekday_summary, salesTime?.days_open);
  if (weekdaySum) lines.push(`营业: ${weekdaySum}`);
  if (latest.rating || latest.review_count) {
    const trust = mdFm?.review_trust_signal === 'strong' ? '信任度强' :
                  mdFm?.review_trust_signal === 'weak' ? '信任度弱' :
                  mdFm?.review_trust_signal === 'mixed' ? '信任度混合' : null;
    lines.push(`Google: ${latest.rating || '?'}★ · ${latest.review_count || 0} 条${trust ? ` · ${trust}` : ''}`);
  }
  if (lines.length) fields.push({ name: '基本信息', value: lines.join('\n'), inline: false });

  // ═══════ Section 3 · 联系方式 ═══════
  // V3 D43 cycle-6 (Matthew 2026-05-14): phone/email as clickable tel:/mailto:
  // links. Discord supports these in embed values · works on desktop + mobile.
  lines.length = 0;
  if (latest.phone) {
    const tel = String(latest.phone).replace(/[^\d+]/g, '');
    lines.push(`电话: [${latest.phone}](tel:${tel})`);
  } else {
    lines.push('电话: —');
  }
  if (latest.website) {
    const status = latest.websiteStatus === 'independent_https_site' ? '独立 HTTPS' :
                   latest.websiteStatus === 'directory_listing' ? '目录站' :
                   latest.websiteStatus || '';
    // 客户官方网站 · RAW URL (销售复制粘贴用)
    lines.push(`网站: ${latest.website}${status ? `  ·  ${status}` : ''}`);
  } else {
    lines.push('网站: —');
  }
  if (latest.email) {
    lines.push(`邮箱: [${latest.email}](mailto:${latest.email})`);
  } else {
    lines.push('邮箱: —');
  }
  lines.push(`表单页: ${latest.contact_us_url || '—'}`);
  // 社媒 (Facebook / Instagram / LinkedIn)
  const socials = latest.social_links || latest.socials || {};
  const socialEntries = Object.entries(socials).filter(([, v]) => v);
  if (socialEntries.length) {
    lines.push(`社媒: ${socialEntries.map(([k, v]) => `[${k}](${v})`).join(' · ')}`);
  } else {
    lines.push('社媒: —');
  }
  fields.push({ name: '联系方式', value: lines.join('\n'), inline: false });

  // ═══════ Section 4 · 审计结论 ═══════
  lines.length = 0;
  if (mdFm?.audit_score != null) {
    lines.push(`总分: ${mdFm.audit_score}/100${mdFm.decision ? ` · ${mdFm.decision}` : ''}`);
  }
  if (mdFm?.visual_freshness != null || mdFm?.visual_trust != null || mdFm?.visual_conversion != null) {
    const v = [];
    if (mdFm.visual_freshness != null) v.push(`新鲜度 ${mdFm.visual_freshness}/10`);
    if (mdFm.visual_trust != null) v.push(`信任 ${mdFm.visual_trust}/10`);
    if (mdFm.visual_conversion != null) v.push(`转化 ${mdFm.visual_conversion}/10`);
    lines.push(`视觉: ${v.join(' · ')}${mdFm.visual_age ? ` · 风格 ${mdFm.visual_age}` : ''}`);
  }
  if (mdFm?.fired_triggers && Array.isArray(mdFm.fired_triggers)) {
    lines.push(`Hard triggers: ${mdFm.fired_triggers.length ? mdFm.fired_triggers.join(' · ') : 'passed (无触发)'}`);
  }
  if (lines.length) fields.push({ name: '审计结论', value: lines.join('\n'), inline: false });

  // ═══════ Section 5 · 在线资源 (拆为 2 个 field · Discord 1024 字段上限) ═══════
  lines.length = 0;
  if (channel === 'projects' && deploy?.demo_url) {
    const base = deploy.demo_url.replace(/\/$/, '');
    // Demo · RAW URL
    lines.push(`Demo: ${deploy.demo_url}`);
    // 文档 · hyperlink
    const docs = [];
    if (deploy.audit_url) docs.push(`[客户 audit](${deploy.audit_url})`);
    if (deploy.internal_audit_url) docs.push(`[内部 audit](${deploy.internal_audit_url})`);
    if (deploy.master_md_url) docs.push(`[master.md](${deploy.master_md_url})`);
    if (docs.length) lines.push(docs.join('  ·  '));
    // 截图 + 录屏 · hyperlink
    const media = [];
    for (const f of assets.screenshots) {
      const label = f.replace(/\.[^.]+$/, '').replace(/^./, (c) => c.toUpperCase());
      media.push(`[${label} 截图](${base}/screenshots/${f})`);
    }
    for (const f of assets.videos) {
      const label = f.replace(/\.[^.]+$/, '').replace(/-/g, ' ');
      media.push(`[${label} 录屏](${base}/video/${f})`);
    }
    if (media.length) lines.push(media.join('  ·  '));
    fields.push({ name: '在线资源', value: lines.join('\n'), inline: false });

    // 现状证据 · 单独 field · hyperlink · 累积至 Discord 1024 字段上限
    if (assets.evidence.length) {
      const total = assets.evidence.length;
      const allLines = assets.evidence.map((f) => `• [${prettyEvidenceName(f)}](${base}/evidence/${f})`);
      const kept = [];
      let chars = 0;
      const LIMIT = 980; // 留 ~40 字符给 "+N more" tail
      for (const line of allLines) {
        if (chars + line.length + 1 > LIMIT) break;
        kept.push(line);
        chars += line.length + 1;
      }
      let evValue = kept.join('\n');
      if (kept.length < total) {
        evValue += `\n_(+${total - kept.length} 条 · 完整在 internal-audit-report)_`;
      }
      fields.push({
        name: `现状证据 (${total})`,
        value: evValue,
        inline: false,
      });
    }
  } else if (channel === 'leads') {
    const parts = [];
    if (assets.evidence.length) parts.push(`证据 ${assets.evidence.length}`);
    if (assets.screenshots.length) parts.push(`截图 ${assets.screenshots.length}`);
    if (assets.videos.length) parts.push(`视频 ${assets.videos.length}`);
    if (parts.length) {
      fields.push({ name: '本地资产 (未 publish)', value: parts.join(' · '), inline: false });
    }
  }

  // ═══════ Section 6 · 线索来源 ═══════
  lines.length = 0;
  if (latest.sourceQuery || latest.discovery_rank) {
    const src = latest.google_places_provider === 'official_api' ? 'Places API' :
                latest.sourceType === 'maps_scraper' ? 'Maps Scraper' :
                latest.sourceType || '?';
    const parts = [src];
    if (latest.sourceQuery) parts.push(`查询: "${latest.sourceQuery}"`);
    if (latest.discovery_rank) parts.push(`第 ${latest.discovery_rank} 位`);
    lines.push(parts.join(' · '));
  }
  // V3 D43 cycle-6 (Matthew 2026-05-14): use Discord native dynamic timestamp
  // <t:UNIX:R> = "5 days ago" rendered live in viewer's clock. No more stale strings.
  if (entity.firstSeenAt) {
    const ts = Math.floor(new Date(entity.firstSeenAt).getTime() / 1000);
    if (Number.isFinite(ts) && ts > 0) {
      lines.push(`首次发现: <t:${ts}:D> (<t:${ts}:R>)`);
    }
  }
  // V3 D43 cycle-6 (Matthew 2026-05-14): customer local time was statically
  // computed at render time → stale forever. Discord can only render in
  // viewer's tz not customer's tz. Removed the live-time line; kept the static
  // timezone label since that's a fact that doesn't expire.
  if (locale?.timezone) {
    lines.push(`时区: ${locale.timezone}${locale.state ? ` · ${locale.state}` : ''}`);
  }
  if (lines.length) fields.push({ name: '线索来源', value: lines.join('\n'), inline: false });

  // ═══════ Section 7 · 销售进程 ═══════
  lines.length = 0;
  lines.push(`Phase: \`${phase}\``);

  // V3 D42 (2026-05-14) · 跨 channel 流转历史 · hyperlinks 到之前 archived thread
  // entity 字段: discord_thread_id (#website-leads) · project_thread_id (#website-projects) · paid_thread_id (#paid-websites future)
  const GUILD_ID = process.env.DISCORD_GUILD_ID || '1493925728570310756';
  const history = [];
  if (entity.discord_thread_id && channel !== 'leads') {
    history.push(`[#website-leads](https://discord.com/channels/${GUILD_ID}/${entity.discord_thread_id}) (archived)`);
  }
  if (entity.project_thread_id && channel !== 'projects') {
    history.push(`[#website-projects](https://discord.com/channels/${GUILD_ID}/${entity.project_thread_id}) (archived)`);
  }
  if (entity.paid_thread_id && channel !== 'paid') {
    history.push(`[#paid-websites](https://discord.com/channels/${GUILD_ID}/${entity.paid_thread_id})`);
  }
  if (history.length) {
    lines.push(`旧 thread: ${history.join(' · ')}`);
  }

  if (entity.lastSeenAt) {
    const ts = Math.floor(new Date(entity.lastSeenAt).getTime() / 1000);
    if (Number.isFinite(ts) && ts > 0) {
      lines.push(`最近更新: <t:${ts}:D> (<t:${ts}:R>)`);
    }
  }
  // 销售进程字段 · M4 启动后填
  if (entity.last_outreach_at) {
    const ts = Math.floor(new Date(entity.last_outreach_at).getTime() / 1000);
    if (Number.isFinite(ts) && ts > 0) {
      lines.push(`上次外联: <t:${ts}:D> (<t:${ts}:R>)`);
    }
  }
  if (entity.signals && (entity.signals.sent || entity.signals.opened)) {
    lines.push(`邮件: 发 ${entity.signals.sent || 0} · 开 ${entity.signals.opened || 0} · 点 ${entity.signals.clicked || 0} · 回 ${entity.signals.replied || 0}`);
  }
  if (entity.last_customer_reply_at) {
    lines.push(`客户回信: ${entity.last_customer_reply_at.slice(0, 10)}`);
  }
  if (entity.proposal_sent_at) {
    lines.push(`报价已发: ${entity.proposal_sent_at.slice(0, 10)}`);
  }

  // M5 · paid 字段
  if (channel === 'paid') {
    if (entity.paid_at) lines.push(`付款: ${entity.paid_at.slice(0, 10)} · ${entity.subscription_type || 'one-time'}`);
    if (entity.current_revision_round != null) lines.push(`改稿: r${entity.current_revision_round} · ${entity.revision_status || 'pending'}`);
  }
  fields.push({ name: '销售进程', value: lines.join('\n'), inline: false });

  // Discord embed limits (truncate longest field if overflow)
  const totalChars = fields.reduce((sum, f) => sum + (f.name.length + (f.value || '').length), 0)
    + (title || '').length;
  if (totalChars > 5500) {
    let longest = 0, idx = 0;
    fields.forEach((f, i) => { if ((f.value || '').length > longest) { longest = f.value.length; idx = i; } });
    fields[idx].value = (fields[idx].value || '').slice(0, 900);
  }

  return {
    title,
    description: latest.address || '',
    color: COLORS[level] || COLORS.default,
    fields,
    footer: { text: `entityKey: ${entity.entityKey}` },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Build thread name · forward to display-vocab.
 * Legacy export kept for backwards compat · all callers should use buildThreadTitle.
 */
export function buildLeadThreadName(entity, channel = 'leads') {
  return buildThreadTitle(entity, channel);
}
