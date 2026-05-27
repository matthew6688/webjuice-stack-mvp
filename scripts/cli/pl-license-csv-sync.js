#!/usr/bin/env node
/**
 * pl:license-csv-sync · Download state license registers + rebuild SQLite index.
 *
 * AU state registers tracked:
 *   QLD: data.qld.gov.au QBCC Licensed Contractors · CC-BY 4.0 · weekly update · ~73 MB CSV (UTF-16 → convert)
 *   VIC: data.vic.gov.au BPC Building Practitioner Register (TBD)
 *   NSW: api.nsw.gov.au Trades API OR data.nsw.gov.au CSV (TBD)
 *
 * Runs:
 *   1. Curl each state's URL
 *   2. Convert encoding if needed (UTF-16 BOM detection)
 *   3. Save to data/licenses/<state>-<authority>.csv
 *   4. Invoke pl:license-build-index to rebuild SQLite
 *
 * Usage:
 *   npm run pl:license-csv-sync
 *   npm run pl:license-csv-sync -- --state qld    # only one state
 *
 * Cron suggestion: weekly · Mondays 3am via Hermes
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO = process.cwd();
const LIC_DIR = path.join(REPO, 'data/licenses');
fs.mkdirSync(LIC_DIR, { recursive: true });

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) args[a.slice(2)] = process.argv[++i] ?? true;
}
const onlyState = (args.state || '').toUpperCase();

const REGISTERS = [
  {
    state: 'QLD',
    authority: 'QBCC',
    url: 'https://www.data.qld.gov.au/dataset/980b6499-c0b4-491b-ba9c-1c7506368a50/resource/25608781-b28c-44f8-8545-0ab18d84082f/download/builder-contractor-qbcc-licensee-register.csv',
    filename: 'qld-qbcc.csv',
    encoding: 'UTF-16',  // UTF-16 BOM · convert to UTF-8
    licence: 'CC-BY 4.0',
    rows_estimate: 195000,
  },
  {
    state: 'VIC',
    authority: 'VBA',
    url: 'https://vicopendatavba.blob.core.windows.net/vicopendata/BPR.csv',
    filename: 'vic-bpc.csv',
    encoding: 'UTF-8',
    licence: 'CC-BY 4.0',
    rows_estimate: 50000,
  },
  {
    state: 'NSW',
    authority: 'FairTrading',
    url: 'http://onegov.nsw.gov.au/agencies/oft/Contractor%20Licence.xlsx',
    filename: 'nsw-contractor.xlsx',
    convert_xlsx_to_csv: 'nsw-fairtrading.csv',  // post-process XLSX → CSV
    licence: 'Open data',
    rows_estimate: 178000,
  },
  // TBD: WA Building Commission
];

function downloadOne(reg) {
  console.log(`\n→ ${reg.state} ${reg.authority}`);
  console.log(`  url: ${reg.url}`);
  const out = path.join(LIC_DIR, reg.filename);

  // Skip if updated <24h ago (avoid hammering source)
  if (fs.existsSync(out)) {
    const age_h = (Date.now() - fs.statSync(out).mtimeMs) / 3600_000;
    if (age_h < 24 && !args.force) {
      console.log(`  cached (${age_h.toFixed(1)}h old · use --force to refresh)`);
      return { ok: true, cached: true };
    }
  }

  const r = spawnSync('curl', ['-sL', '-o', out, reg.url], { encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(`  ✗ curl failed: ${r.stderr || 'exit ' + r.status}`);
    return { ok: false };
  }
  const size_mb = (fs.statSync(out).size / 1024 / 1024).toFixed(1);
  console.log(`  ✓ downloaded · ${size_mb} MB`);

  // Convert UTF-16 → UTF-8 if needed
  if (reg.encoding === 'UTF-16') {
    const tmp = `${out}.utf8`;
    const c = spawnSync('iconv', ['-f', 'UTF-16', '-t', 'UTF-8', out], { encoding: 'utf8', maxBuffer: 200_000_000 });
    if (c.status === 0) {
      fs.writeFileSync(tmp, c.stdout);
      fs.renameSync(tmp, out);
      console.log(`  ✓ converted UTF-16 → UTF-8`);
    }
  }

  // Convert XLSX → CSV if needed (NSW)
  if (reg.convert_xlsx_to_csv) {
    const csvOut = path.join(LIC_DIR, reg.convert_xlsx_to_csv);
    const c = spawnSync('python3', [path.join(REPO, 'scripts/cli/_xlsx-to-csv.py'), out, csvOut], { stdio: 'inherit' });
    if (c.status === 0) {
      console.log(`  ✓ converted XLSX → CSV (${reg.convert_xlsx_to_csv})`);
      fs.unlinkSync(out); // delete intermediate XLSX
    } else {
      console.error('  ✗ XLSX→CSV failed');
      return { ok: false };
    }
  }

  return { ok: true };
}

console.log('[license-csv-sync] downloading state registers');
const results = [];
for (const reg of REGISTERS) {
  if (onlyState && reg.state !== onlyState) continue;
  results.push({ ...reg, ...downloadOne(reg) });
}

const ok = results.filter(r => r.ok).length;
console.log(`\n${ok}/${results.length} registers downloaded · invoking rebuild`);

if (ok > 0) {
  const b = spawnSync('node', ['scripts/cli/pl-license-build-index.js'], { cwd: REPO, stdio: 'inherit' });
  if (b.status !== 0) console.error('  ✗ index rebuild failed');
}
