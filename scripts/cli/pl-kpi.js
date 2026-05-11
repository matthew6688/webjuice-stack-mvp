#!/usr/bin/env node
/**
 * pl:kpi — Daily KPI summary. JSON output.
 *
 * Indicators (per DISCORD_OUTREACH_PRD.md §10):
 *   1. 每日抓取商家数 — count of discovery-events.jsonl scraped today
 *   2. 有/无网站占比 — entity.latest.websiteStatus distribution
 *   3. 可成交占比 — count(grade A/B/C) / total
 *   4. 审计完成率 — count(detailed_audit fixture) / count(queued_for_audit)
 *   5. 付款转化率 — ledger sale events / outreach-sent events (placeholder for now)
 *   6. 平均获客成本 — ledger cost sum / paid count
 *   7. 各 phase 计数 — V2 phase distribution
 *   8. 每 grade 计数
 *   9. 今日 ledger 花费
 *
 * Deferred (need email tracking): demo 生成成功率 / 打开率 / 回复率 / demo 点击率 / proposal 转化率 / 制作时间
 */

import fs from 'fs';
import path from 'path';
import { listEntities, parseArgs, emit, ROOT } from './_pl-shared.js';

const args = parseArgs(process.argv.slice(2));
const today = (args.date || new Date().toISOString().slice(0, 10));

const entities = listEntities();

// Grade counts
const byGrade = { A: 0, B: 0, C: 0, D: 0, ungraded: 0 };
for (const e of entities) {
  const g = e.grade?.investment_level;
  if (g && byGrade[g] !== undefined) byGrade[g] += 1;
  else byGrade.ungraded += 1;
}

// Phase counts
const byPhase = {};
for (const e of entities) {
  const p = e.phase || '_unset';
  byPhase[p] = (byPhase[p] || 0) + 1;
}

// Website status
const byWebsiteStatus = {};
for (const e of entities) {
  const ws = e.latest?.websiteStatus || '_unknown';
  byWebsiteStatus[ws] = (byWebsiteStatus[ws] || 0) + 1;
}
const hasWebsite = entities.filter((e) => ['independent_http_site', 'independent_https_site'].includes(e.latest?.websiteStatus)).length;
const noWebsite = entities.filter((e) => ['no_website', 'third_party_landing_page'].includes(e.latest?.websiteStatus)).length;

// Today's discovery events
const eventsPath = path.join(ROOT, 'data', 'leads', 'discovery-events.jsonl');
let todaysScraped = 0;
if (fs.existsSync(eventsPath)) {
  const lines = fs.readFileSync(eventsPath, 'utf8').trim().split('\n').filter(Boolean);
  for (const l of lines) {
    try {
      const e = JSON.parse(l);
      if (e.at?.startsWith(today) && (e.event === 'discovery_run_promoted' || e.event === 'discovery_queues_built')) {
        todaysScraped += Number(e.scrapedCount || e.count || 1);
      }
    } catch {}
  }
}

// Audit completion
const queuedForAudit = entities.filter((e) => e.status === 'queued_for_audit').length;
const detailedDir = path.join(ROOT, 'data', 'v2', 'fixtures', 'detailed-audit');
let auditCompleted = 0;
if (fs.existsSync(detailedDir)) {
  auditCompleted = fs.readdirSync(detailedDir).filter((f) => f.endsWith('.json')).length;
}

// Sellable = A/B/C
const sellable = byGrade.A + byGrade.B + byGrade.C;
const sellablePct = entities.length ? (sellable / entities.length).toFixed(3) : '0';

// Ledger today
const ledgerPath = path.join(ROOT, 'data', 'finance', 'ledger.jsonl');
let todaysCost = 0;
let todaysRevenue = 0;
let revenueEvents = 0;
if (fs.existsSync(ledgerPath)) {
  for (const l of fs.readFileSync(ledgerPath, 'utf8').trim().split('\n').filter(Boolean)) {
    try {
      const e = JSON.parse(l);
      const at = e.createdAt || e.at || '';
      if (!at.startsWith(today)) continue;
      if (e.type === 'cost') todaysCost += Number(e.amount || 0);
      if (e.type === 'revenue') { todaysRevenue += Number(e.amount || 0); revenueEvents += 1; }
    } catch {}
  }
}

emit({
  ok: true,
  date: today,
  totals: {
    entities: entities.length,
    sellable_a_b_c: sellable,
    sellable_pct: sellablePct,
  },
  by_grade: byGrade,
  by_phase: byPhase,
  websites: {
    has_website: hasWebsite,
    no_website: noWebsite,
    breakdown: byWebsiteStatus,
  },
  pipeline: {
    queued_for_audit: queuedForAudit,
    audit_completed_cumulative: auditCompleted,
    todays_scraped_estimate: todaysScraped,
  },
  finance_today: {
    cost_usd: todaysCost,
    revenue_usd: todaysRevenue,
    revenue_events: revenueEvents,
  },
  deferred_metrics: [
    'email_open_rate',
    'email_reply_rate',
    'demo_click_rate',
    'proposal_to_payment_rate',
    'avg_cac',
    'avg_production_time',
  ],
});
