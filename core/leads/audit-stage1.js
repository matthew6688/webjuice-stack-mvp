/**
 * M2-D5 · Audit Stage 1 helpers.
 *
 * `checkStaleness({fixturePath, stalenessDays, __log})` returns:
 *   - 'reuse'  · fixture exists AND mtime within stalenessDays
 *   - 'refetch' · fixture missing OR mtime older than stalenessDays
 *
 * Env override: AUDIT_STALENESS_DAYS (number, days; default 30).
 */

import fs from 'fs';

const DEFAULT_DAYS = 30;

export function checkStaleness({ fixturePath, stalenessDays, __log } = {}) {
  if (!fixturePath) throw new Error('fixturePath required');
  const envDays = Number(process.env.AUDIT_STALENESS_DAYS);
  const days = Number.isFinite(envDays) && envDays > 0
    ? envDays
    : (Number.isFinite(stalenessDays) && stalenessDays > 0 ? stalenessDays : DEFAULT_DAYS);

  if (!fs.existsSync(fixturePath)) {
    __log?.(`refetch · fixture missing: ${fixturePath}`);
    return 'refetch';
  }
  const stat = fs.statSync(fixturePath);
  const ageMs = Date.now() - stat.mtimeMs;
  const maxMs = days * 86400 * 1000;
  if (ageMs > maxMs) {
    __log?.(`refetch · stale ${(ageMs / 86400000).toFixed(1)}d > ${days}d`);
    return 'refetch';
  }
  __log?.(`reuse · ${(ageMs / 86400000).toFixed(1)}d ≤ ${days}d`);
  return 'reuse';
}
