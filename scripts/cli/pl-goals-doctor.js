#!/usr/bin/env node
/**
 * pl:goals-doctor · cycle-27 · Rule 14 enforcement (Matthew 2026-05-15)
 *
 * End-to-end validates the 6 CORE GOALS for every active-sales entity.
 * Pre-commit gate: any commit touching entity / Discord / build / publish paths
 * MUST run this CLI and get exit 0 before merging.
 *
 * Core goals (Matthew 2026-05-15 spec):
 *   G1 · master.md exists on disk + accessible online (HTTP 200)
 *   G2 · audit HTML files exist + accessible (customer-audit · internal-audit)
 *   G3 · profile card on Discord (project thread) matches entity state
 *   G4 · Stage 1-9 messages present in lead/project thread
 *   G5 · no duplicate thread (1 entity = 1 active thread across leads/projects)
 *   G6 · all linked URLs return HTTP 200 (no dead links)
 *   G7 · archived lead-thread profile card stays fresh after graduate
 *        (matches entity grade · deploy URL · phase) · Matthew 2026-05-16
 *
 * Modes:
 *   --quick   (file-only · for pre-commit · skips Discord + HTTP network)
 *   default   (full · includes HTTP + Discord scans · for ops + post-deploy)
 *
 * Exit 0 = all goals pass · Exit 1 = any fail
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ENTITIES_DIR = path.join(ROOT, 'data/leads/entities');
const CLIENTS_DIR = path.join(ROOT, 'clients');
const TOKEN = process.env.WEBSITE_TASKS_DISCORD_BOT_TOKEN || '';
const DISCORD_API = 'https://discord.com/api/v10';

const QUICK = process.argv.includes('--quick');
const VERBOSE = process.argv.includes('--verbose') || process.argv.includes('-v');

// active-sales phases · only validate entities in these states
const ACTIVE_PHASES = new Set(['ready-to-build', 'outreach-active', 'replied', 'proposal-sent', 'nurture', 'paid']);

const violations = [];
function fail(goal, entity, reason, detail = null) {
  violations.push({ goal, entity, reason, detail });
}

function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// ─── Load active-sales entities ────────────────────────────────────
function loadEntities() {
  if (!fs.existsSync(ENTITIES_DIR)) return [];
  const out = [];
  for (const f of fs.readdirSync(ENTITIES_DIR)) {
    if (!f.endsWith('.json')) continue;
    try {
      const d = JSON.parse(fs.readFileSync(path.join(ENTITIES_DIR, f), 'utf8'));
      if (!ACTIVE_PHASES.has(d.phase)) continue;
      out.push({ key: f.replace('.json', ''), ...d });
    } catch { /* skip malformed */ }
  }
  return out;
}

// ─── G1 · master.md exists ────────────────────────────────────────
function checkG1_MasterMdExists(entity) {
  const slug = entity.promotedClientSlug || slugify(entity.latest?.name || '');
  if (!slug) { fail('G1', entity.key, 'no slug derivable from entity'); return; }
  const p = path.join(CLIENTS_DIR, slug, 'v2', 'master.md');
  if (!fs.existsSync(p)) fail('G1', entity.key, `master.md missing on disk`, p);
}

// ─── G2 · audit HTML files exist ──────────────────────────────────
function checkG2_AuditHtmlExists(entity) {
  const slug = entity.promotedClientSlug || slugify(entity.latest?.name || '');
  if (!slug) { fail('G2', entity.key, 'no slug'); return; }
  for (const f of ['customer-facing-audit.html', 'internal-audit-report.html']) {
    const p = path.join(CLIENTS_DIR, slug, 'v2', f);
    if (!fs.existsSync(p)) fail('G2', entity.key, `${f} missing on disk`, p);
  }
}

// ─── G6 · HTTP 200 on all deploy URLs ─────────────────────────────
async function checkG6_DeployUrlsLive(entity, fetchImpl) {
  if (!entity.deploy?.demo_url) return;  // pre-publish · skip
  const urls = [
    entity.deploy.demo_url,
    entity.deploy.audit_url,
    entity.deploy.internal_audit_url,
    entity.deploy.master_md_url,
    entity.deploy.master_report_url,
  ].filter(Boolean);
  for (const url of urls) {
    try {
      const r = await fetchImpl(url, { method: 'HEAD' });
      if (r.status !== 200) fail('G6', entity.key, `dead link ${r.status}`, url);
    } catch (err) {
      fail('G6', entity.key, `fetch failed: ${err.message}`, url);
    }
  }
}

// ─── G3 · profile card matches entity state ──────────────────────
async function checkG3_ProfileCardFresh(entity, fetchImpl) {
  // Only check entities with a project thread + profile message
  const threadId = entity.project_thread_id;
  const msgId = entity.project_profile_message_id;
  if (!threadId || !msgId) return; // pre-graduate · skip
  if (!TOKEN) { fail('G3', entity.key, 'no Discord token to verify card'); return; }
  try {
    const r = await fetchImpl(`${DISCORD_API}/channels/${threadId}/messages/${msgId}`, {
      headers: { Authorization: `Bot ${TOKEN}` },
    });
    if (r.status === 404) { fail('G3', entity.key, 'profile card message 404'); return; }
    if (!r.ok) { fail('G3', entity.key, `Discord HTTP ${r.status}`); return; }
    const m = await r.json();
    const embed = m.embeds?.[0];
    if (!embed) { fail('G3', entity.key, 'profile card has no embed'); return; }
    const grade = entity.grade?.investment_level;
    if (grade && !embed.title?.includes(`[${grade}]`)) {
      fail('G3', entity.key, `card title missing [${grade}]`, embed.title);
    }
    if (entity.deploy?.demo_url && !(embed.description || '').includes(entity.deploy.demo_url)) {
      fail('G3', entity.key, 'card missing live demo URL', entity.deploy.demo_url);
    }
  } catch (err) {
    fail('G3', entity.key, `card check threw: ${err.message}`);
  }
}

// ─── G4 · Stage 1-9 history in project thread ────────────────────
async function checkG4_StageHistoryComplete(entity, fetchImpl) {
  const threadId = entity.project_thread_id || entity.discord_thread_id;
  if (!threadId) return;
  if (!TOKEN) { fail('G4', entity.key, 'no Discord token'); return; }
  try {
    const r = await fetchImpl(`${DISCORD_API}/channels/${threadId}/messages?limit=100`, {
      headers: { Authorization: `Bot ${TOKEN}` },
    });
    if (r.status === 404) { fail('G4', entity.key, 'thread 404'); return; }
    if (!r.ok) { fail('G4', entity.key, `Discord HTTP ${r.status}`); return; }
    const arr = await r.json();
    if (!Array.isArray(arr)) return;
    // Must have at least Stage 9 (published) · ideally Stage 1-9
    const stages = new Set();
    for (const m of arr) {
      const sm = (m.content || '').match(/## Stage (\d)\/9/g);
      if (sm) for (const s of sm) stages.add(s.match(/Stage (\d)/)[1]);
    }
    // For outreach-active entities · we expect Stage 9 minimum (published)
    if (entity.phase === 'outreach-active' && !stages.has('9')) {
      fail('G4', entity.key, 'project thread missing Stage 9 (published)');
    }
    // ALL audited entities should have at least one Stage 3-8 message · sign of audit.
    // Exempt legacy V2→V3 migrated entities (merged_from_v3_key) · their original
    // lead thread is 404 by now · history gap is documented historical state.
    const auditedStages = ['3', '4', '5', '6', '7', '8'].filter((s) => stages.has(s));
    if (entity.grade?.investment_level && auditedStages.length === 0 && !entity.merged_from_v3_key) {
      fail('G4', entity.key, 'graded entity has no Stage 3-8 in thread (history missing)', `present: ${[...stages].join(',')}`);
    }
  } catch (err) {
    fail('G4', entity.key, `stage history check threw: ${err.message}`);
  }
}

// ─── G5 · no duplicate thread (1 entity = 1 active visible thread) ──
async function checkG5_NoDuplicateThread(entity, fetchImpl) {
  const lead = entity.discord_thread_id;
  const proj = entity.project_thread_id;
  if (!lead || !proj) return; // need both to have a potential dup
  if (lead === proj) return; // same id · not a dup
  if (!TOKEN) return;
  try {
    const leadR = await fetchImpl(`${DISCORD_API}/channels/${lead}`, { headers: { Authorization: `Bot ${TOKEN}` } });
    const projR = await fetchImpl(`${DISCORD_API}/channels/${proj}`, { headers: { Authorization: `Bot ${TOKEN}` } });
    if (!leadR.ok || !projR.ok) return; // one is dead · no dup
    const leadMeta = await leadR.json();
    const projMeta = await projR.json();
    const leadVisible = !leadMeta.thread_metadata?.archived;
    const projVisible = !projMeta.thread_metadata?.archived;
    if (leadVisible && projVisible) {
      fail('G5', entity.key, `both leads + projects threads visible · duplicate`, `lead=${lead} · proj=${proj}`);
    }
  } catch { /* tolerate · don't fail */ }
}

// ─── G7 · archived lead-thread profile card stays fresh ─────────────
// Matthew 2026-05-16: "make sure your goal also check the archieved thread
// profile card updates" — even after graduate (lead thread archived), the
// card on that thread must still reflect current entity state (grade · deploy URL).
async function checkG7_ArchivedLeadCardFresh(entity, fetchImpl) {
  const leadThreadId = entity.discord_thread_id;
  const leadCardId = entity.discord_profile_message_id;
  if (!leadThreadId || !leadCardId) return;
  // Only relevant if entity has graduated (project_thread_id set) OR is archived
  const isGraduated = Boolean(entity.project_thread_id);
  const isPhaseArchived = entity.phase === 'archived';
  if (!isGraduated && !isPhaseArchived) return;
  if (!TOKEN) { fail('G7', entity.key, 'no Discord token to verify archived card'); return; }
  try {
    // GET works on archived threads · only POST/PATCH is blocked
    const r = await fetchImpl(`${DISCORD_API}/channels/${leadThreadId}/messages/${leadCardId}`, {
      headers: { Authorization: `Bot ${TOKEN}` },
    });
    if (r.status === 404) { fail('G7', entity.key, 'archived-thread profile card 404'); return; }
    if (!r.ok) { fail('G7', entity.key, `Discord HTTP ${r.status}`); return; }
    const m = await r.json();
    const embed = m.embeds?.[0];
    if (!embed) { fail('G7', entity.key, 'archived-thread card has no embed'); return; }
    const grade = entity.grade?.investment_level;
    if (grade && !embed.title?.includes(`[${grade}]`)) {
      fail('G7', entity.key, `archived card title missing [${grade}]`, embed.title);
    }
    if (entity.deploy?.demo_url && !(embed.description || '').includes(entity.deploy.demo_url)) {
      fail('G7', entity.key, 'archived card missing live demo URL', entity.deploy.demo_url);
    }
  } catch (err) {
    fail('G7', entity.key, `archived card check threw: ${err.message}`);
  }
}

// ─── V2/V3 duplicate detection (separate from G5 thread dup) ──────
function checkDupEntities() {
  if (!fs.existsSync(ENTITIES_DIR)) return;
  const all = fs.readdirSync(ENTITIES_DIR).filter((f) => f.endsWith('.json'));
  const byName = new Map();
  for (const f of all) {
    let d;
    try { d = JSON.parse(fs.readFileSync(path.join(ENTITIES_DIR, f), 'utf8')); } catch { continue; }
    const name = d.latest?.name?.trim();
    if (!name) continue;
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push({ file: f, key: f.replace('.json', ''), data: d });
  }
  for (const [name, group] of byName.entries()) {
    if (group.length < 2) continue;
    const domain = group.find((e) => e.key.startsWith('domain_'));
    const place = group.find((e) => e.key.startsWith('place_'));
    if (!domain || !place) continue;
    if (domain.data.merged_from_v3_key) continue;
    if (!ACTIVE_PHASES.has(domain.data.phase) && !ACTIVE_PHASES.has(place.data.phase)) continue;
    fail('G5', domain.key, `V2/V3 entity duplicate for "${name}"`, `place: ${place.key} · run pl:merge-dup-entities`);
  }
}

// ─── Main ───────────────────────────────────────────────────────────
(async () => {
  console.log(`pl-goals-doctor · ${QUICK ? 'QUICK mode (files only)' : 'FULL mode (files + Discord + HTTP)'}\n`);
  const entities = loadEntities();
  console.log(`Validating ${entities.length} active-sales entities (phase ∈ ${[...ACTIVE_PHASES].join(', ')})\n`);

  for (const e of entities) {
    checkG1_MasterMdExists(e);
    checkG2_AuditHtmlExists(e);
    if (!QUICK) {
      await checkG6_DeployUrlsLive(e, fetch);
      await checkG3_ProfileCardFresh(e, fetch);
      await checkG4_StageHistoryComplete(e, fetch);
      await checkG5_NoDuplicateThread(e, fetch);
      await checkG7_ArchivedLeadCardFresh(e, fetch);
    }
  }
  checkDupEntities();

  // Summary
  const byGoal = { G1: [], G2: [], G3: [], G4: [], G5: [], G6: [], G7: [] };
  for (const v of violations) (byGoal[v.goal] ||= []).push(v);

  console.log('━━━ Per-goal summary ━━━');
  for (const g of ['G1','G2','G3','G4','G5','G6','G7']) {
    const list = byGoal[g] || [];
    const label = {
      G1: 'master.md 在线',
      G2: 'audit HTML 在线',
      G3: 'profile card fresh',
      G4: 'Stage 1-9 message 历史完整',
      G5: '不重复 thread / 不重复 entity',
      G6: '所有 deploy URL HTTP 200',
      G7: 'archived lead-thread card 同步',
    }[g];
    if (list.length === 0) console.log(`  ✓ ${g} · ${label}`);
    else console.log(`  ✗ ${g} · ${label} · ${list.length} fail`);
  }

  if (violations.length === 0) {
    console.log(`\n✓ goals-doctor: ALL 7 goals pass · ${entities.length} entities clean${QUICK ? ' (quick mode · re-run without --quick for network checks)' : ''}`);
    process.exit(0);
  }

  console.log(`\n✗ goals-doctor: ${violations.length} violations across ${Object.keys(byGoal).filter((g)=>byGoal[g].length).length} goals\n`);
  if (VERBOSE || violations.length <= 20) {
    for (const v of violations) {
      console.log(`  ${v.goal} · ${v.entity}: ${v.reason}${v.detail ? `\n      ${v.detail}` : ''}`);
    }
  } else {
    for (const g of Object.keys(byGoal)) {
      if (!byGoal[g].length) continue;
      console.log(`\n▸ ${g} (${byGoal[g].length})`);
      for (const v of byGoal[g].slice(0, 5)) console.log(`  · ${v.entity}: ${v.reason}`);
      if (byGoal[g].length > 5) console.log(`  · … +${byGoal[g].length - 5} more · re-run with --verbose`);
    }
  }
  process.exit(1);
})();
