#!/usr/bin/env node
/**
 * V3 cycle-26 · Post-publish asset integrity doctor.
 *
 * For one or all published entities · fetches master.md from CF Pages deploy
 * URL · extracts all asset refs · HTTP-checks each → reports broken.
 *
 * Usage:
 *   npm run pl:asset-integrity-doctor -- --entity-key domain_xxx
 *   npm run pl:asset-integrity-doctor                       # scan all phase=outreach-active entities
 *
 * Exit 0 = all entities clean · 1 = any entity has broken asset.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyAssetsRemote } from '../../core/reports/asset-integrity.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) { out[k] = true; continue; }
    out[k] = next; i++;
  }
  return out;
}

function loadEntity(key) {
  const p = path.join(REPO, 'data/leads/entities', `${key}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function slug(e) {
  const n = e?.latest?.name || e?.entityKey || '';
  return String(n).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function deployRecord(s) {
  const p = path.join(REPO, 'clients', s, 'v2/concept/reference-adapter/cf-pages-deploy.json');
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

async function check(entityKey) {
  const e = loadEntity(entityKey);
  if (!e) return { entityKey, ok: false, reason: 'entity_not_found' };
  const s = slug(e);
  const deploy = deployRecord(s);
  if (!deploy?.demo_url) return { entityKey, ok: false, reason: 'not_deployed' };

  // Fetch live master.md
  let mdText;
  try {
    const r = await fetch(`${deploy.demo_url}/master.md`);
    if (!r.ok) return { entityKey, slug: s, ok: false, reason: `master_md_${r.status}` };
    mdText = await r.text();
  } catch (err) {
    return { entityKey, slug: s, ok: false, reason: `fetch_master_md: ${err.message}` };
  }

  const result = await verifyAssetsRemote({ md: mdText, baseUrl: deploy.demo_url });
  return { entityKey, slug: s, demo_url: deploy.demo_url, ...result };
}

(async () => {
  const args = parseArgs(process.argv.slice(2));
  let keys = [];
  if (args['entity-key']) {
    keys = [args['entity-key']];
  } else {
    // Scan all entities with phase=outreach-active or ready-to-build · deployed
    const dir = path.join(REPO, 'data/leads/entities');
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.json')) continue;
      try {
        const e = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        if (!['ready-to-build', 'outreach-active', 'replied', 'paid'].includes(e.phase)) continue;
        const s = slug(e);
        if (!deployRecord(s)?.demo_url) continue;
        keys.push(f.replace(/\.json$/, ''));
      } catch {}
    }
  }

  if (!keys.length) {
    console.log('No deployed entities to check (filter: phase ∈ ready-to-build/outreach-active/replied/paid + cf-pages-deploy.json)');
    process.exit(0);
  }

  console.log(`pl-asset-integrity-doctor · checking ${keys.length} entity·entities\n`);
  let allOk = true;
  for (const k of keys) {
    const r = await check(k);
    if (r.ok) {
      console.log(`✓ ${r.slug || k} · ${r.checked} assets all 200 · ${r.demo_url}`);
    } else {
      allOk = false;
      console.log(`✗ ${r.slug || k} · ${r.reason || 'broken assets'}`);
      if (r.broken) {
        for (const b of r.broken.slice(0, 10)) {
          console.log(`    ${b.status || 'ERR'} · ${b.url}${b.error ? ' · ' + b.error : ''}`);
        }
        if (r.broken.length > 10) console.log(`    … +${r.broken.length - 10} more`);
      }
    }
  }
  process.exit(allOk ? 0 : 1);
})().catch((err) => { console.error('FATAL:', err.message); process.exit(2); });
