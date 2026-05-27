#!/usr/bin/env node
/**
 * pl:license-build-index · Build SQLite FTS5 index from state license CSVs.
 *
 * Reads:  data/licenses/{qld-qbcc,vic-bpc,nsw-fairtrading}.csv
 * Writes: data/licenses/_index.sqlite (FTS5 full-text on licensee_name + address)
 *
 * Uses node:sqlite (Node 22+ built-in · zero dep).
 *
 * Usage:
 *   node --experimental-sqlite scripts/cli/pl-license-build-index.js
 *   (or npm run pl:license-build-index)
 */
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const REPO = process.cwd();
const LIC_DIR = path.join(REPO, 'data/licenses');
const DB_PATH = path.join(LIC_DIR, '_index.sqlite');

if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
const db = new DatabaseSync(DB_PATH);

// ─── Schema ────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE licenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    state TEXT NOT NULL,
    authority TEXT NOT NULL,
    licence_number TEXT,
    licensee_name TEXT NOT NULL,
    licensee_name_norm TEXT NOT NULL,
    abn TEXT,
    acn TEXT,
    address TEXT,
    licence_type TEXT,
    licence_class TEXT,
    licence_category TEXT,
    status TEXT DEFAULT 'active',
    raw_row TEXT
  );

  CREATE INDEX idx_licence_number ON licenses(licence_number);
  CREATE INDEX idx_abn ON licenses(abn);
  CREATE INDEX idx_state ON licenses(state);
  CREATE INDEX idx_name_norm ON licenses(licensee_name_norm);

  CREATE VIRTUAL TABLE licenses_fts USING fts5(
    licensee_name, address, content='licenses', content_rowid='id', tokenize='porter unicode61'
  );

  CREATE TRIGGER licenses_ai AFTER INSERT ON licenses BEGIN
    INSERT INTO licenses_fts(rowid, licensee_name, address) VALUES (new.id, new.licensee_name, new.address);
  END;
`);

// ─── CSV parser ─────────────────────────────────────────────────────────
function parseCSVLine(line) {
  const out = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && inQuote && line[i+1] === '"') { cur += '"'; i++; continue; }
    if (c === '"') { inQuote = !inQuote; continue; }
    if (c === ',' && !inQuote) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}

// Normalize licensee name for exact-equality lookups (lowercase · strip
// "Pty Ltd", "&", "and", punctuation · collapse whitespace).
function normalizeName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\bpty\s*\.?\s*ltd\.?\b/g, '')
    .replace(/\bptyltd\b/g, '')
    .replace(/\b(limited|inc|corp|company|co)\.?\b/g, '')
    .replace(/[&]/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Importers ──────────────────────────────────────────────────────────
function importQLD() {
  const file = path.join(LIC_DIR, 'qld-qbcc.csv');
  if (!fs.existsSync(file)) { console.log('  QLD: file not found · skip'); return 0; }
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);
  // QLD columns: Number,Name,ACN,ABN,Address,TypeDesc,TypeCode,FinCatDesc,FinCatCode,Grade,ClassType
  const ins = db.prepare(`
    INSERT INTO licenses (
      state, authority, licence_number, licensee_name, licensee_name_norm,
      abn, acn, address, licence_type, licence_class, licence_category, status, raw_row
    ) VALUES ('QLD', 'QBCC', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
  `);
  let count = 0;
  db.exec('BEGIN');
  for (let i = 1; i < lines.length; i++) {
    const ln = lines[i].trim();
    if (!ln) continue;
    const f = parseCSVLine(ln);
    if (f.length < 11) continue;
    const abnClean = String(f[3] || '').replace(/\D/g, ''); // strip whitespace from ABN
    const acnClean = String(f[2] || '').replace(/\D/g, '');
    ins.run(
      f[0], f[1], normalizeName(f[1]), abnClean, acnClean, f[4],
      f[5], f[10], f[7], JSON.stringify(f)
    );
    count++;
  }
  db.exec('COMMIT');
  return count;
}

// VIC BPC schema: Account Name,Type,Accreditation ID,Accreditation Status,ABN,ACN,Limitation,Commenced,Expires
function importVIC() {
  const file = path.join(LIC_DIR, 'vic-bpc.csv');
  if (!fs.existsSync(file)) { console.log('  VIC: file not found · skip'); return 0; }
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);
  const ins = db.prepare(`
    INSERT INTO licenses (
      state, authority, licence_number, licensee_name, licensee_name_norm,
      abn, acn, address, licence_type, licence_class, licence_category, status, raw_row
    ) VALUES ('VIC', 'VBA', ?, ?, ?, ?, ?, NULL, ?, ?, NULL, ?, ?)
  `);
  let count = 0;
  db.exec('BEGIN');
  for (let i = 1; i < lines.length; i++) {
    const ln = lines[i].trim();
    if (!ln) continue;
    const f = parseCSVLine(ln);
    if (f.length < 9) continue;
    const status = (f[3] || 'Current').toLowerCase().includes('current') ? 'active' : 'inactive';
    ins.run(
      f[2],                                              // licence_number e.g. "CB-L 100598"
      f[0],                                              // licensee_name
      normalizeName(f[0]),                               // normalized
      String(f[4] || '').replace(/\D/g, ''),             // ABN clean
      String(f[5] || '').replace(/\D/g, ''),             // ACN clean
      f[1],                                              // licence_type (Person / Company)
      f[6],                                              // licence_class (Limitation)
      status,
      JSON.stringify(f)
    );
    count++;
  }
  db.exec('COMMIT');
  return count;
}

// NSW Fair Trading schema (after XLSX→CSV flatten):
// SheetCategory,Licence Number,Issue Date,Expiry Date,Licensee,Address Type,Address,Birth Year,ACN,ABN,Classes
function importNSW() {
  const file = path.join(LIC_DIR, 'nsw-fairtrading.csv');
  if (!fs.existsSync(file)) { console.log('  NSW: file not found · skip'); return 0; }
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);
  const ins = db.prepare(`
    INSERT INTO licenses (
      state, authority, licence_number, licensee_name, licensee_name_norm,
      abn, acn, address, licence_type, licence_class, licence_category, status, raw_row
    ) VALUES ('NSW', 'FairTrading', ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'active', ?)
  `);
  let count = 0;
  db.exec('BEGIN');
  for (let i = 1; i < lines.length; i++) {
    const ln = lines[i].trim();
    if (!ln) continue;
    const f = parseCSVLine(ln);
    if (f.length < 11) continue;
    const isOrg = (f[0] || '').toLowerCase().includes('sheet3');
    ins.run(
      f[1],                                              // licence_number e.g. "236638C"
      (f[4] || '').trim(),                               // licensee_name
      normalizeName(f[4]),
      String(f[9] || '').replace(/\D/g, ''),             // ABN clean
      String(f[8] || '').replace(/\D/g, ''),             // ACN clean
      f[6],                                              // address
      isOrg ? 'Company' : 'Individual',
      f[10],                                             // licence_class = "Classes" (e.g. "Carpenter; Tiler; Roofer")
      JSON.stringify(f)
    );
    count++;
  }
  db.exec('COMMIT');
  return count;
}

// ─── Build ──────────────────────────────────────────────────────────────
console.log(`[license-build-index] → ${DB_PATH}`);
const qld = importQLD(); console.log(`  QLD: ${qld} rows imported`);
const vic = importVIC(); if (vic) console.log(`  VIC: ${vic} rows imported`);
const nsw = importNSW(); if (nsw) console.log(`  NSW: ${nsw} rows imported`);

const stats = db.prepare(`
  SELECT
    COUNT(*) AS rows,
    COUNT(DISTINCT licensee_name_norm) AS unique_licensees,
    COUNT(DISTINCT licence_number) AS unique_licences,
    COUNT(DISTINCT abn) AS unique_abns,
    COUNT(DISTINCT state) AS states
  FROM licenses WHERE 1=1
`).get();
console.log(`  total: ${stats.rows} rows · ${stats.unique_licensees} unique businesses · ${stats.unique_licences} unique licence numbers · ${stats.unique_abns} unique ABNs · ${stats.states} state(s)`);
console.log(`  DB size: ${(fs.statSync(DB_PATH).size / 1024 / 1024).toFixed(1)} MB`);
db.close();
