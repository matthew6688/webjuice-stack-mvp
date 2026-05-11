/**
 * Small helpers shared between lead-thread-sync.js and pl-* CLIs.
 * Kept in a separate module to avoid circular imports.
 */

import fs from 'fs';
import path from 'path';

export function readDetailedAudit(entityKey) {
  const p = path.join('data', 'v2', 'fixtures', 'detailed-audit', `${entityKey}.json`);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}
