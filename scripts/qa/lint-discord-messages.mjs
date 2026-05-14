#!/usr/bin/env node
/**
 * qa:lint-discord-messages · V3 D43 (2026-05-14)
 *
 * Scan codebase for forbidden patterns in user-facing Discord messages.
 *
 * Catches the bug categories from E2E run #2:
 *   · place_chij* hash literals (operator-facing should show business name)
 *   · admin/tasks.profitslocal.com URLs (D40 deprecated · admin UI retired)
 *   · "Stage N · English / 中文" bilingual labels (pick one)
 *   · LISTENER_ALLOW_BOTS=1 (test-only flag · never in production source)
 *   · entity_key raw in user-facing strings
 *
 * Exit codes:
 *   0  · clean
 *   1  · violations found (CI fails · pre-commit blocks)
 *
 * Usage:
 *   npm run qa:lint-discord-messages
 *   npm run qa:lint-discord-messages -- --json
 *
 * Allowlist: prefix line with `// lint:allow-discord` to suppress for that line.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');
const ARGS = process.argv.slice(2);
const JSON_MODE = ARGS.includes('--json');

// Files to scan · only user-facing message emitters
const TARGET_DIRS = ['core', 'scripts'];
const TARGET_EXTS = ['.js', '.mjs'];

// Forbidden patterns. Each: { id, pattern, severity, hint }
const RULES = [
  {
    id: 'place_id_hash',
    pattern: /["'`]place_chij[a-z0-9_-]+["'`]/i,
    severity: 'error',
    hint: 'use lookupEntityName(key) → business name · not raw place_id hash',
    skipPatterns: [/discoveryEntityKey/, /entityKey\s*[:=]/, /\.entityKey/, /place_chij[a-z0-9_-]+\.json/], // legit data refs
  },
  {
    id: 'admin_url',
    pattern: /\/admin\/(tasks|v2-leads|customer|cron|queue|intakes)/i,
    severity: 'error',
    hint: 'admin URL deprecated (D40) · use Discord thread + business context',
  },
  {
    id: 'tasks_profitslocal_url',
    pattern: /https?:\/\/(?:tasks|admin)\.profitslocal\.com/i,
    severity: 'error',
    hint: 'admin tunnel URL not user-clickable post-D40 · drop',
  },
  {
    id: 'bilingual_stage_label',
    // matches "Stage N · English ... 中文" or "English Chinese English" patterns in postStageUpdate
    pattern: /stage:\s*['"`](?:Stage\s+\d+|批次\S+\s+\w+|自动\S+\s+\w+|[A-Z][a-z]+\s+\w+\s+[一-龥])/i,
    severity: 'error',
    hint: 'pick one language for stage label · drop English+Chinese mix',
  },
  {
    id: 'listener_allow_bots',
    pattern: /LISTENER_ALLOW_BOTS\s*=?\s*['"`]?1/i,
    severity: 'error',
    hint: 'test-only flag · never in source · use env override in test driver',
    skipPatterns: [/process\.env\.LISTENER_ALLOW_BOTS/], // legit usage to READ the flag
  },
  {
    id: 'entity_key_in_user_msg',
    // matches `entity_key:` or `entityKey:` followed by code that puts it in a `content:` field
    // heuristic: line contains both "entity_key" and Chinese chars (user-facing)
    pattern: /(entity_key|entityKey).{0,80}[一-龥]/,
    severity: 'warn',
    hint: 'avoid showing raw entity_key in 中文 user messages',
  },
];

function shouldSkip(filepath) {
  if (filepath.includes('/node_modules/')) return true;
  if (filepath.includes('/scripts/qa/lint-discord-messages')) return true; // self
  if (filepath.includes('/data/')) return true;
  if (filepath.includes('/clients/')) return true;
  if (filepath.includes('/docs/')) return true;
  if (filepath.includes('/_archive/')) return true;
  return false;
}

function* walkFiles(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (shouldSkip(full)) continue;
    if (entry.isDirectory()) {
      yield* walkFiles(full);
    } else if (TARGET_EXTS.includes(path.extname(entry.name))) {
      yield full;
    }
  }
}

const violations = [];

for (const dir of TARGET_DIRS) {
  for (const file of walkFiles(path.join(REPO, dir))) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, idx) => {
      // Skip lines explicitly opted-out
      if (line.includes('lint:allow-discord')) return;
      // Skip comments (basic check) · still flag inside template strings
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;

      for (const rule of RULES) {
        if (rule.pattern.test(line)) {
          if (rule.skipPatterns?.some((p) => p.test(line))) continue;
          violations.push({
            rule: rule.id,
            severity: rule.severity,
            file: path.relative(REPO, file),
            line: idx + 1,
            text: line.trim().slice(0, 200),
            hint: rule.hint,
          });
        }
      }
    });
  }
}

if (JSON_MODE) {
  console.log(JSON.stringify({ violations, total: violations.length }, null, 2));
  process.exit(violations.some((v) => v.severity === 'error') ? 1 : 0);
}

const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', D = '\x1b[2m', X = '\x1b[0m';

if (violations.length === 0) {
  console.log(`${G}✓ Discord message lint clean${X} · scanned ${TARGET_DIRS.join(', ')}`);
  process.exit(0);
}

console.log('');
console.log(`${R}✗ Discord message lint · ${violations.length} violation(s)${X}`);
console.log('');
for (const v of violations) {
  const sev = v.severity === 'error' ? `${R}ERROR${X}` : `${Y}WARN${X}`;
  console.log(`  ${sev} [${v.rule}] ${D}${v.file}:${v.line}${X}`);
  console.log(`    ${v.text}`);
  console.log(`    ${D}→ ${v.hint}${X}`);
  console.log('');
}
const errors = violations.filter((v) => v.severity === 'error').length;
console.log(`${errors > 0 ? R : Y}${violations.length} violations · ${errors} errors${X}`);
process.exit(errors > 0 ? 1 : 0);
