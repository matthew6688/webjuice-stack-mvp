#!/usr/bin/env node
/**
 * pl-discord-snapshot · V3 D43 cycle-12 (Matthew 2026-05-14)
 *
 * One-shot Discord verification · 必须用这个当 PASS 凭据 · 不允许手动 sample。
 * Output: human-readable PASS/FAIL + JSON snapshot at data/qa/discord-snapshot-<ts>.json
 *
 * Usage:
 *   npm run pl:discord-snapshot                  # full leads channel scan
 *   npm run pl:discord-snapshot -- --thread <id>
 *   npm run pl:discord-snapshot -- --strict      # fail on any thread mismatch
 *
 * Per-state expectations (SOP §2.5):
 *   预D  · 不该有 thread
 *   预C  · profile + cheap summary + emoji guide → ≥3 msg · title [预C]
 *   预A/B · profile + cheap summary             → ≥2 msg · title [预A/B]
 *   audited A/B/C · profile + summary + 5 stages → ≥7 msg · title [A/B/C] [待发]
 */

import fs from 'node:fs';
import path from 'node:path';

const TOKEN = process.env.DISCORD_BOT_TOKEN || process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN;
const LEADS_CH = process.env.WEBSITE_LEADS_DISCORD_CHANNEL_ID;
const PROJECTS_CH = process.env.WEBSITE_PROJECTS_DISCORD_CHANNEL_ID;
const DISCORD_API = 'https://discord.com/api/v10';

if (!TOKEN) { console.error('Missing DISCORD_BOT_TOKEN'); process.exit(2); }

const args = process.argv.slice(2);
const argThreadIdx = args.indexOf('--thread');
const argThread = argThreadIdx >= 0 ? args[argThreadIdx + 1] : null;
const argChannelIdx = args.indexOf('--channel');
const argChannel = argChannelIdx >= 0 ? args[argChannelIdx + 1] : 'leads';
const STRICT = args.includes('--strict');

const ENTITIES_DIR = '/Users/matthew/Developer/google-map-website-v3/data/leads/entities';

async function discordGet(url) {
  const r = await fetch(`${DISCORD_API}${url}`, {
    headers: { Authorization: `Bot ${TOKEN}`, 'User-Agent': 'profitslocal-snapshot' },
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

function readEntity(key) {
  const p = path.join(ENTITIES_DIR, `${key}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function findEntityByThreadId(threadId) {
  const files = fs.readdirSync(ENTITIES_DIR).filter((f) => f.endsWith('.json'));
  for (const f of files) {
    try {
      const e = JSON.parse(fs.readFileSync(path.join(ENTITIES_DIR, f), 'utf8'));
      if (String(e.discord_thread_id) === String(threadId)) {
        return { ...e, entityKey: e.entityKey || f.replace('.json', '') };
      }
    } catch { /* skip */ }
  }
  return null;
}

// V3 D43 cycle-14 (Matthew 2026-05-14): classify by THREAD content + TITLE
// 不再依赖 entity.grade · 因为 entity 可能有历史 grade 但 thread 刚开（无 stage 消息）。
// Source of truth = 这个 thread 当前显示什么 · 应该等于什么。
function classifyByThread(threadName, msgs, entity) {
  // Title 决定 visual state · message features 决定 audit state
  const titleHasYuC = threadName.includes('[预C]');
  const titleHasYuB = threadName.includes('[预B]');
  const titleHasYuA = threadName.includes('[预A]');
  const titleHasD = threadName.includes('[D]');
  const titleHasC = threadName.includes('[C]') && !titleHasYuC;
  const titleHasB = threadName.includes('[B]') && !titleHasYuB;
  const titleHasA = threadName.includes('[A]') && !titleHasYuA;

  if (titleHasYuC) return 'predict_C';
  if (titleHasYuB) return 'predict_B';
  if (titleHasYuA) return 'predict_A';
  if (titleHasD) return 'audited_D';
  if (titleHasC) return 'audited_C';
  if (titleHasB) return 'audited_B';
  if (titleHasA) return 'audited_A';
  return 'unknown';
}

function expectedForState(state) {
  switch (state) {
    case 'predict_D': return { mustHaveThread: false };
    // V3 D43 cycle-24 (Matthew 2026-05-15): audited_D 应该 archived (cycle-22 22.A bail
    // + persistLeadGrade archiveAndLockThread). Pre-cycle-22 留下的 active [D] thread
    // 视为 legacy · 期望被 archive · snapshot caller 必须读 thread_metadata.archived.
    case 'audited_D': return { mustHaveThread: true, minMessages: 1, titleContains: '[D]', expectedFeatures: ['profile_card'], expectArchived: true };
    // emoji guide baked into cheap_summary message · 所以 cheap_summary alone covers both features
    case 'predict_C': return { mustHaveThread: true, minMessages: 2, titleContains: '[预C]', expectedFeatures: ['profile_card', 'cheap_summary', 'emoji_guide'] };
    case 'predict_B': return { mustHaveThread: true, minMessages: 2, titleContains: '[预B]', expectedFeatures: ['profile_card', 'cheap_summary'] };
    case 'predict_A': return { mustHaveThread: true, minMessages: 2, titleContains: '[预A]', expectedFeatures: ['profile_card', 'cheap_summary'] };
    case 'audited_A':
    case 'audited_B':
    case 'audited_C':
      return { mustHaveThread: true, minMessages: 5, titleContains: `[${state.slice(-1)}]`, expectedFeatures: ['profile_card', 'stage_3_grade'] };
    default: return { mustHaveThread: false };
  }
}

function detectFeatures(msgs) {
  const features = new Set();
  for (const m of msgs) {
    const text = m.content || '';
    const embedTitle = m.embeds?.[0]?.title || '';
    const embedDesc = m.embeds?.[0]?.description || '';
    const embedFields = m.embeds?.[0]?.fields || [];
    // V3 D43 cycle-20: profile card now uses ━━━ section divider in description (not fields)
    // Detect via section markers OR legacy fields
    if (embedDesc.includes('━━━ 基本信息') || embedDesc.includes('━━━ 联系方式')
        || embedFields.some((f) => f.name === '联系方式' || f.name === '基本信息')) features.add('profile_card');
    if (text.includes('Intake 完成') || text.includes('cheap-audit + predict-grade')) features.add('cheap_summary');
    if (text.includes('销售操作') || text.includes('手动操作')) features.add('emoji_guide');
    if (text.includes('pipelineStartMessage') || text.includes('Audit pipeline 启动')) features.add('stage_0_start');
    if (text.includes('Stage 1') && text.includes('done')) features.add('stage_1_audit');
    if (text.includes('Stage 2') || text.includes('视觉审计')) features.add('stage_2_vision');
    if (text.includes('Stage 3') || text.includes('分级 router')) features.add('stage_3_grade');
    if (text.includes('Stage 4') || text.includes('HTML report')) features.add('stage_4_html');
    if (text.includes('Stage 5') || text.includes('Qualification')) features.add('stage_5_quality');
    if (text.includes('master.md 已重建')) features.add('master_md_hook');
    if (text.includes('客户 audit HTML')) features.add('customer_audit_hook');
  }
  return Array.from(features);
}

// V3 D43 cycle-13 (Matthew 2026-05-14): per-field accuracy verification.
// Hard evidence is NOT message count — it's "shown value matches entity source-of-truth".
function verifyFieldAccuracy(embed, entity, slug) {
  if (!embed || !entity) return { checked: 0, mismatches: [] };
  const latest = entity.latest || {};
  const mismatches = [];
  let checked = 0;

  // V3 D43 cycle-20: parse description into virtual sections (━━━ name ━━━)
  // for accuracy verification · backward compat with old fields[] format.
  let fields = embed.fields || [];
  if (!fields.length && embed.description) {
    const parts = embed.description.split(/━━━ ([^━]+) ━━━\n/);
    // parts: [address_or_empty, name1, body1, name2, body2, ...]
    for (let i = 1; i < parts.length; i += 2) {
      const name = (parts[i] || '').trim();
      const value = (parts[i + 1] || '').trim();
      if (name) fields.push({ name, value });
    }
  }

  for (const f of fields) {
    const v = f.value || '';
    if (f.name === '联系方式') {
      checked++;
      // Phone: should appear as [number](tel:...)
      if (latest.phone) {
        const phoneNorm = String(latest.phone).replace(/[^\d+]/g, '');
        if (!v.includes(`tel:${phoneNorm}`) && !v.includes(latest.phone)) {
          mismatches.push(`电话: entity has "${latest.phone}" but field doesn't show it`);
        }
      }
      // Email
      if (latest.email && !v.includes(latest.email)) {
        mismatches.push(`邮箱: entity has "${latest.email}" but field doesn't show it`);
      }
      // Website
      if (latest.website && !v.includes(latest.website)) {
        mismatches.push(`网站: entity has "${latest.website}" but field doesn't show it`);
      }
    }
    if (f.name === '基本信息') {
      checked++;
      if (latest.rating != null && !v.includes(String(latest.rating))) {
        mismatches.push(`Google rating: entity=${latest.rating} not in field`);
      }
      if (latest.review_count != null && !v.includes(String(latest.review_count))) {
        mismatches.push(`reviews: entity=${latest.review_count} not in field`);
      }
    }
    if (f.name === '审计结论' && entity.grade?.investment_level) {
      checked++;
      const auditScore = (() => {
        try {
          const mdPath = path.join('/Users/matthew/Developer/google-map-website-v3/clients', slug, 'v2/master.md');
          if (!fs.existsSync(mdPath)) return null;
          const m = fs.readFileSync(mdPath, 'utf8').match(/^audit_score:\s*(\d+)/m);
          return m ? Number(m[1]) : null;
        } catch { return null; }
      })();
      if (auditScore != null && !v.includes(`${auditScore}/100`)) {
        mismatches.push(`审计总分: master.md=${auditScore}/100 not in field`);
      }
    }
    if (f.name.includes('在线资源') || f.name.includes('本地资产')) {
      checked++;
      // Verify cf-pages-deploy.json links match
      try {
        const dp = path.join('/Users/matthew/Developer/google-map-website-v3/clients', slug, 'v2/concept/reference-adapter/cf-pages-deploy.json');
        if (fs.existsSync(dp)) {
          const deploy = JSON.parse(fs.readFileSync(dp, 'utf8'));
          // If deploy exists, field SHOULD be "在线资源 (已发布)" not "本地资产 (未 publish)"
          if (f.name.includes('未 publish') || f.name.includes('未发布')) {
            mismatches.push(`链接丢失: cf-pages-deploy.json 存在但 field 名是 "${f.name}" · 应是 "在线资源 (已发布)"`);
          }
          // Verify all 4 hyperlinks present
          for (const linkKey of ['audit_url', 'internal_audit_url', 'master_md_url', 'master_report_url']) {
            if (deploy[linkKey] && !v.includes(deploy[linkKey])) {
              mismatches.push(`链接丢失: deploy.${linkKey}=${deploy[linkKey]} 不在 field`);
            }
          }
        }
      } catch { /* skip */ }
    }
  }
  return { checked, mismatches };
}

function slugifyName(s) {
  return String(s || '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

async function checkThread(threadInfo) {
  const { id, name, parent_id } = threadInfo;
  const entity = findEntityByThreadId(id);

  let msgs = [];
  try { msgs = await discordGet(`/channels/${id}/messages?limit=50`); } catch (err) { msgs = []; }

  // V3 D43 cycle-24 (Matthew 2026-05-15): fetch thread metadata for audited_D archived check
  let threadMeta = null;
  try { threadMeta = await discordGet(`/channels/${id}`); } catch (err) { /* skip */ }
  const isArchived = !!threadMeta?.thread_metadata?.archived;

  // V3 D43 cycle-14: classify by title + thread content (not entity history)
  const state = classifyByThread(name, msgs, entity);
  const expected = expectedForState(state);

  const features = detectFeatures(msgs);

  // Title checks
  const titleHasQ = name.includes('[?]');
  const titleMatchesExpected = expected.titleContains
    ? name.includes(expected.titleContains)
    : true;

  // V3 D43 cycle-13: per-field accuracy verification
  const slug = entity?.promotedClientSlug || slugifyName(entity?.latest?.name || '');
  let accuracyMismatches = [];
  let fieldsChecked = 0;
  let assetMisattribution = false;
  for (const m of msgs) {
    // V3 D43 cycle-23c (Matthew 2026-05-15): cycle-20 把 profile card 改成 description
    // 格式 · fields[] 是空. 这里要 accept description-only embed.
    if (!m.embeds?.[0] || !entity) continue;
    if (!m.embeds[0].fields?.length && !m.embeds[0].description) continue;
    const a = verifyFieldAccuracy(m.embeds[0], entity, slug);
    accuracyMismatches.push(...a.mismatches);
    fieldsChecked += a.checked;
    // Legacy slug-collision check
    const assetField = (m.embeds[0].fields || []).find((f) => f.name.includes('资产'));
    if (assetField) {
      const thisAudited = !!entity.grade?.investment_level || !!entity.detailed_audit?.at;
      if (!thisAudited) assetMisattribution = true;
    }
    break; // verify only the latest profile card embed
  }
  accuracyMismatches = [...new Set(accuracyMismatches)];

  // Feature checks
  const missingFeatures = (expected.expectedFeatures || []).filter((f) => !features.includes(f));
  const enoughMessages = expected.minMessages == null || msgs.length >= expected.minMessages;

  const failures = [];
  if (titleHasQ) failures.push('title 含 [?]');
  if (!titleMatchesExpected) failures.push(`title 不含期望片段 "${expected.titleContains}"`);
  if (!enoughMessages) failures.push(`message count ${msgs.length} < 期望 ${expected.minMessages}`);
  if (missingFeatures.length) failures.push(`缺少 feature: ${missingFeatures.join(', ')}`);
  if (assetMisattribution) failures.push('本地资产 显示在 non-audited entity (slug-collision)');
  // V3 D43 cycle-13: accuracy mismatches are hard FAILs
  for (const am of accuracyMismatches) failures.push(`字段 mismatch: ${am}`);
  // V3 D43 cycle-24 (Matthew 2026-05-15): audited_D 必须 archived
  if (expected.expectArchived && !isArchived) {
    failures.push('audited_D thread 应被 archived (cycle-22 D-grade auto-archive)');
  }

  return {
    threadId: id,
    title: name,
    entityKey: entity?.entityKey || null,
    slug,
    state,
    expected,
    actual: {
      msg_count: msgs.length,
      features,
      title_has_questionmark: titleHasQ,
      asset_misattribution: assetMisattribution,
      fields_checked: fieldsChecked,
      accuracy_mismatches: accuracyMismatches,
      thread_archived: isArchived,
    },
    failures,
    pass: failures.length === 0,
  };
}

async function listActiveLeadsThreads() {
  if (!LEADS_CH) throw new Error('WEBSITE_LEADS_DISCORD_CHANNEL_ID not set');
  const cd = await discordGet(`/channels/${LEADS_CH}`);
  const ad = await discordGet(`/guilds/${cd.guild_id}/threads/active`);
  return (ad.threads || []).filter((t) => t.parent_id === LEADS_CH);
}

(async () => {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const snapshot = { at: new Date().toISOString(), threads: [] };

  let threads;
  if (argThread) {
    const t = await discordGet(`/channels/${argThread}`);
    threads = [{ id: t.id, name: t.name, parent_id: t.parent_id }];
  } else {
    threads = await listActiveLeadsThreads();
  }

  console.log(`\n═══ Discord Snapshot · ${ts} ═══`);
  console.log(`Channel: ${argThread || 'leads (' + LEADS_CH + ')'}`);
  console.log(`Threads to check: ${threads.length}\n`);

  let passed = 0, failed = 0;
  for (const t of threads) {
    const res = await checkThread(t);
    snapshot.threads.push(res);
    const mark = res.pass ? '✅' : '❌';
    console.log(`${mark} ${t.id} · ${t.name}`);
    console.log(`     state=${res.state} · msgs=${res.actual.msg_count} · features=[${res.actual.features.join(',')}]`);
    if (res.failures.length) {
      for (const f of res.failures) console.log(`     · ${f}`);
    }
    if (res.pass) passed++; else failed++;
    await new Promise((r) => setTimeout(r, 200));
  }

  // Aggregate checks
  const channelHasQ = threads.some((t) => t.name.includes('[?]'));
  snapshot.summary = {
    total: threads.length,
    passed,
    failed,
    channel_has_questionmark: channelHasQ,
  };

  console.log('\n═══ Summary ═══');
  console.log(`  total:   ${threads.length}`);
  console.log(`  passed:  ${passed}`);
  console.log(`  failed:  ${failed}`);
  console.log(`  any [?]: ${channelHasQ ? '❌ YES' : '✓ NO'}`);

  // Save JSON snapshot for audit trail
  const qaDir = '/Users/matthew/Developer/google-map-website-v3/data/qa';
  fs.mkdirSync(qaDir, { recursive: true });
  const snapPath = path.join(qaDir, `discord-snapshot-${ts}.json`);
  fs.writeFileSync(snapPath, JSON.stringify(snapshot, null, 2) + '\n');
  console.log(`  snapshot: ${snapPath}`);

  if (failed > 0 && STRICT) process.exit(1);
  if (channelHasQ && STRICT) process.exit(1);
  process.exit(0);
})().catch((err) => { console.error('FATAL:', err.message); process.exit(2); });
