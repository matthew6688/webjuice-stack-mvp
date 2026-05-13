#!/usr/bin/env node
/**
 * M2-D4 · C-grade batch send.
 *
 * Reads pending entries from data/leads/cold-outreach-queue.json, renders the
 * C-grade email template, and either prints (dry-run default) or sends via
 * agentic-inbox (when env C_GRADE_BATCH_LIVE=1).
 *
 * Flags:
 *   --limit N           process at most N pending entries (default 50)
 *
 * Env:
 *   C_GRADE_BATCH_LIVE=1  enable real send (otherwise dry-run preview)
 *   PRINT_TEMPLATE=1      include rendered template body in stdout (test gate)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const QUEUE_PATH = path.join(REPO_ROOT, 'data', 'leads', 'cold-outreach-queue.json');

function readQueue() {
  if (!fs.existsSync(QUEUE_PATH)) return [];
  try { return JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf8')); } catch { return []; }
}

function writeQueue(items) {
  fs.mkdirSync(path.dirname(QUEUE_PATH), { recursive: true });
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(items, null, 2));
}

function readEntity(entityKey) {
  const file = path.join(REPO_ROOT, 'data', 'leads', 'entities', `${entityKey}.json`);
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function appendContactLog(entityKey, entry) {
  const file = path.join(REPO_ROOT, 'data', 'leads', 'entities', `${entityKey}.json`);
  if (!fs.existsSync(file)) return;
  try {
    const e = JSON.parse(fs.readFileSync(file, 'utf8'));
    e.contact_log = Array.isArray(e.contact_log) ? e.contact_log : [];
    e.contact_log.push(entry);
    fs.writeFileSync(file, JSON.stringify(e, null, 2));
  } catch {}
}

// C-grade template — short, low-effort outreach.
const TEMPLATE_SUBJECT = 'Quick note about {{businessName}}';
const TEMPLATE_BODY = [
  'Hi {{ownerName}},',
  '',
  'I run a small studio that helps {{niche}} businesses in {{city}} tidy up their websites.',
  'I took a quick look at {{businessName}} and thought a few small changes could help you turn more Google visits into calls.',
  '',
  'If you would like a no-pressure 5-minute audit doc, just reply "yes" and I will send it over.',
  '',
  'Cheers,',
  'Matthew',
].join('\n');

function renderTemplate(tpl, vars) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    const v = vars[k];
    return v == null || v === '' ? fallbackFor(k) : String(v);
  });
}

function fallbackFor(key) {
  // Test contract: no empty {{placeholders}} after render.
  const fallbacks = {
    ownerName: 'there',
    businessName: 'your business',
    niche: 'local service',
    city: 'your area',
  };
  return fallbacks[key] || '—';
}

function buildVars(entityKey, entity) {
  const latest = entity?.latest || {};
  return {
    ownerName: latest.owner_name || latest.contact_name || '',
    businessName: latest.name || entityKey,
    niche: latest.niche || latest.category || '',
    city: latest.city || '',
  };
}

function parseArgs(argv) {
  const out = { limit: 50 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--limit') out.limit = Number(argv[++i]) || 50;
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const live = process.env.C_GRADE_BATCH_LIVE === '1';
  const printTemplate = process.env.PRINT_TEMPLATE === '1';

  const queue = readQueue();
  const pending = queue.filter((q) => q.status === 'pending').slice(0, args.limit);

  const mode = live ? 'LIVE' : 'dry-run';
  console.log(`[c-grade-batch-send] mode=${mode} limit=${args.limit} pending=${pending.length}/${queue.length}`);

  if (!pending.length) {
    console.log('  (preview) no pending entries · dry-run exits clean');
    process.exit(0);
  }

  for (const item of pending) {
    const entity = readEntity(item.entityKey);
    const vars = buildVars(item.entityKey, entity);
    const subject = renderTemplate(TEMPLATE_SUBJECT, vars);
    const body = renderTemplate(TEMPLATE_BODY, vars);

    if (!live) {
      console.log(`\n  [dry-run / preview] ${item.entityKey}`);
      console.log(`    subject: ${subject}`);
      if (printTemplate) {
        console.log('    body:');
        console.log(body.split('\n').map((l) => `      ${l}`).join('\n'));
      }
      continue;
    }

    // LIVE — real send path (mocked away in tests; not exercised here).
    try {
      const mod = await import('../../core/integrations/agentic-inbox.js');
      if (typeof mod.sendOutbound === 'function') {
        await mod.sendOutbound({ to: vars.email, subject, body });
      }
    } catch (err) {
      console.warn(`    send failed: ${err.message}`);
      continue;
    }

    // Mark queue.status=sent + entity.contact_log
    item.status = 'sent';
    item.sent_at = new Date().toISOString();
    appendContactLog(item.entityKey, {
      kind: 'c-grade-batch',
      sent_at: item.sent_at,
      subject,
    });
  }

  if (live) writeQueue(queue);
  console.log(`\n[c-grade-batch-send] done · mode=${mode}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
