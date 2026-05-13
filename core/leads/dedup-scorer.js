/**
 * core/leads/dedup-scorer.js
 *
 * M1-D1 · 5-key weighted dedup scoring.
 *
 * Returns {score, verdict} for an entity pair. Verdicts:
 *   ≥ AUTO_MERGE_THRESHOLD (default 60) → 'auto-merge'
 *   ≥ LLM_THRESHOLD       (default 30) → 'llm-decide'
 *   < LLM_THRESHOLD                      → 'pass'
 *
 * Weights (Matthew 2026-05-13, DECISIONS-LOG):
 *   phone   35 (last 10 digits, exact)
 *   email   30 (exact, case-insensitive)
 *   domain  25 (root domain, www. stripped)
 *   name    20 (Levenshtein-based fuzzy)
 *   address 15 (exact, normalized)
 *
 * NOTE: place_id auto-merge is the *0th* defense layer and lives in
 * mergeLeadIntoEntity (discovery-store.js). Pairs with matching place_id
 * never reach scoreDedup at all.
 */

const SIGNAL_WEIGHTS = Object.freeze({
  phone: 35,
  email: 30,
  domain: 25,
  name: 20,
  address: 15,
});

export function getThresholds() {
  const autoMerge = Number(process.env.DEDUP_AUTO_MERGE_THRESHOLD || 60);
  const llm = Number(process.env.DEDUP_LLM_THRESHOLD || 30);
  return { autoMerge, llm };
}

export function getWeights() {
  return { ...SIGNAL_WEIGHTS };
}

function normPhone(v) {
  if (!v) return '';
  const digits = String(v).replace(/\D+/g, '');
  if (!digits) return '';
  return digits.slice(-10); // canonical last 10 digits
}

function normEmail(v) {
  if (!v) return '';
  return String(v).trim().toLowerCase();
}

function normDomain(v) {
  if (!v) return '';
  let s = String(v).trim().toLowerCase();
  // try URL parse first
  try {
    if (/^https?:\/\//i.test(s)) s = new URL(s).hostname;
  } catch { /* ignore */ }
  s = s.replace(/^www\./, '');
  return s;
}

function normName(v) {
  if (!v) return '';
  return String(v).trim().toLowerCase().replace(/\s+/g, ' ');
}

function normAddress(v) {
  if (!v) return '';
  return String(v).trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.,]/g, '');
}

// Levenshtein distance, iterative.
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m = a.length;
  const n = b.length;
  const prev = new Array(n + 1);
  const curr = new Array(n + 1);
  for (let j = 0; j <= n; j += 1) prev[j] = j;
  for (let i = 1; i <= m; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= n; j += 1) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost,
      );
    }
    for (let j = 0; j <= n; j += 1) prev[j] = curr[j];
  }
  return prev[n];
}

export function nameSimilarity(a, b) {
  const x = normName(a);
  const y = normName(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const dist = levenshtein(x, y);
  const maxLen = Math.max(x.length, y.length);
  if (!maxLen) return 0;
  return Math.max(0, 1 - dist / maxLen);
}

/**
 * Score how likely two entity-like objects are duplicates.
 * Accepts either flat objects ({phone, email, domain, name, address}) or
 * entity-store shapes ({identifiers, latest}). Pulls fields defensively.
 */
export function scoreDedup(a, b) {
  const { autoMerge, llm } = getThresholds();
  const signals = {};
  let score = 0;

  const A = extractFields(a);
  const B = extractFields(b);

  // phone
  if (A.phone && B.phone && A.phone === B.phone) {
    score += SIGNAL_WEIGHTS.phone;
    signals.phone = SIGNAL_WEIGHTS.phone;
  }
  // email
  if (A.email && B.email && A.email === B.email) {
    score += SIGNAL_WEIGHTS.email;
    signals.email = SIGNAL_WEIGHTS.email;
  }
  // domain
  if (A.domain && B.domain && A.domain === B.domain) {
    score += SIGNAL_WEIGHTS.domain;
    signals.domain = SIGNAL_WEIGHTS.domain;
  }
  // name (fuzzy)
  if (A.name && B.name) {
    const sim = nameSimilarity(A.name, B.name);
    if (sim > 0) {
      const contribution = SIGNAL_WEIGHTS.name * sim;
      score += contribution;
      signals.name = Math.round(contribution * 10) / 10;
    }
  }
  // address (exact normalized)
  if (A.address && B.address && A.address === B.address) {
    score += SIGNAL_WEIGHTS.address;
    signals.address = SIGNAL_WEIGHTS.address;
  }

  const rounded = Math.round(score * 10) / 10;
  let verdict = 'pass';
  if (rounded >= autoMerge) verdict = 'auto-merge';
  else if (rounded >= llm) verdict = 'llm-decide';

  return { score: rounded, verdict, signals };
}

function extractFields(obj) {
  if (!obj || typeof obj !== 'object') return {};
  const ids = obj.identifiers || {};
  const latest = obj.latest || {};
  return {
    phone: normPhone(obj.phone ?? ids.phoneDigits ?? latest.phone ?? ''),
    email: normEmail(obj.email ?? ids.email ?? latest.email ?? ''),
    domain: normDomain(obj.domain ?? ids.websiteDomain ?? latest.website ?? ''),
    name: normName(obj.name ?? latest.name ?? ''),
    address: normAddress(obj.address ?? latest.address ?? ''),
  };
}

export const SIGNAL_WEIGHTS_FOR_TEST = SIGNAL_WEIGHTS;
