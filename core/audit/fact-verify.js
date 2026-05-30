/**
 * core/audit/fact-verify.js · DETERMINISTIC TRUTH CHECK (Matthew 2026-05-30).
 *
 * The zero-tolerance layer. ENFORCED (exact cross-check vs `single-page-brief.yaml`, HARD FAIL on mismatch
 * or a claim absent from the locked brief): **licence authority, licence number, ABN, phone, and detected
 * street address**. NOT enforced yet (do not claim otherwise): licence *status*, and *wrong* business-name
 * detection (business name is only presence-checked as a match, not flagged when wrong). NO LLM — pure cross-check.
 *
 * This is NOT "copy" auditing (style/quality) — it is fact verification, and it cannot be wrong. It was
 * extracted out of pl-copy-audit so the truth-check has its own name (`fact-verify` · `pl:fact-verify`).
 *
 * Authority ladder (R108): single-page-brief.yaml locked facts > scraped source > persona > copy style.
 * The LLM may phrase around these facts; it may never own/invent them. This module is the enforcement.
 */
import fs from 'fs';

export const IDENTITY_LABELS = new Set(['fabricated_license_or_identity', 'unlocked_identity_claim']);

function unescapeStrip(t) {
  return String(t).replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function normalizeTextFact(value) {
  return String(value || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '');
}

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizePhone(value) {
  const digits = digitsOnly(value);
  if (digits.startsWith('61')) return `0${digits.slice(2)}`;
  return digits;
}

function normalizeLicenseNumber(value) {
  return normalizeTextFact(value);
}

function uniqueNonEmpty(values) {
  return [...new Set((values || []).map(v => String(v || '').trim()).filter(Boolean))];
}

function scalarFromYaml(text, key) {
  const m = String(text).match(new RegExp(`^${key}:\\s*(.+?)\\s*(?:#.*)?$`, 'm'));
  if (!m) return null;
  const raw = m[1].trim();
  if (!raw || raw === 'null') return null;
  return raw.replace(/^["']|["']$/g, '').trim();
}

function nestedScalarFromYaml(text, parent, key) {
  const block = String(text).match(new RegExp(`^${parent}:\\s*\\n([\\s\\S]*?)(?=^[a-zA-Z0-9_-]+:|(?![\\s\\S]))`, 'm'));
  if (!block) return null;
  const m = block[1].match(new RegExp(`^\\s+${key}:\\s*(.+?)\\s*(?:#.*)?$`, 'm'));
  if (!m) return null;
  const raw = m[1].trim();
  if (!raw || raw === 'null') return null;
  return raw.replace(/^["']|["']$/g, '').trim();
}

/** Load the locked identity facts from a single-page-brief.yaml. Returns null if missing. */
export function loadBriefFacts(briefPath) {
  if (!briefPath || !fs.existsSync(briefPath)) return null;
  const text = fs.readFileSync(briefPath, 'utf8');
  const addressParts = [
    nestedScalarFromYaml(text, 'address', 'street'),
    nestedScalarFromYaml(text, 'address', 'suburb'),
    nestedScalarFromYaml(text, 'address', 'state'),
    nestedScalarFromYaml(text, 'address', 'postcode'),
  ].filter(Boolean);
  return {
    path: briefPath,
    business_name: scalarFromYaml(text, 'business_name'),
    phone_display: nestedScalarFromYaml(text, 'phone', 'display'),
    phone_tel: nestedScalarFromYaml(text, 'phone', 'tel_link'),
    address: addressParts.length ? addressParts.join(' ') : null,
    abn: scalarFromYaml(text, 'abn'),
    license_authority: nestedScalarFromYaml(text, 'license', 'authority'),
    license_number: nestedScalarFromYaml(text, 'license', 'number'),
    license_status: nestedScalarFromYaml(text, 'license', 'status'),
  };
}

function extractIdentityClaims(html) {
  const text = unescapeStrip(String(html || '')
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' '));
  const out = {
    abn: [...text.matchAll(/\bABN[\s:#-]*([0-9]{2}[\s.]*[0-9]{3}[\s.]*[0-9]{3}[\s.]*[0-9]{3})\b/gi)].map(m => m[1]),
    license_number: extractLicenseNumberClaims(text),
    license_authority: [],
    phone: [],
    business_name: [],
    address: [],
    text,
  };
  for (const auth of ['VBA', 'QBCC', 'NSW Fair Trading', 'Victorian Building Authority', 'Building Commission WA']) {
    if (new RegExp(`\\b${auth.replace(/\s+/g, '\\s+')}\\b`, 'i').test(text)) out.license_authority.push(auth);
  }
  for (const m of String(html || '').matchAll(/href=["']tel:([^"']+)["']/gi)) out.phone.push(m[1]);
  for (const m of text.matchAll(/\b(?:\+?61\s?)?0?4\d{2}[\s.-]?\d{3}[\s.-]?\d{3}\b/g)) out.phone.push(m[0]);
  for (const m of text.matchAll(/\b\d{1,5}[A-Za-z]?(?:\/\d{1,5})?\s+[A-Z][A-Za-z0-9'.-]*(?:\s+[A-Z][A-Za-z0-9'.-]*){0,4}\s+(?:St|Street|Rd|Road|Dr|Drive|Ave|Avenue|Hwy|Highway|Cres|Crescent|Ct|Court|Parade|Pde)\b[^.|\n]{0,80}\b(?:VIC|QLD|NSW|SA|WA|TAS|ACT|NT)\s*\d{4}\b/g)) {
    out.address.push(m[0]);
  }
  return out;
}

function extractLicenseNumberClaims(text) {
  const claims = [];
  const source = String(text || '');

  // Prefix-style licence numbers, e.g. VBA CDB-U 65938 / DB-U 12345.
  for (const m of source.matchAll(/\b(?:CDB-U|DB-U|CB-U)[\s:#-]*[A-Z0-9-]{3,12}\b/gi)) {
    claims.push(m[0]);
  }

  // Authority + number, e.g. QBCC 1161095. Require the captured value to start
  // with a digit so status phrases like "QBCC Licensed" are not number claims.
  for (const m of source.matchAll(/\b(?:QBCC|BC|RBP)[\s:#-]*(\d[A-Z0-9-]{3,12})\b/gi)) {
    claims.push(m[0]);
  }

  // "QBCC licence 1161095" / "license number: 1161095" phrasing.
  for (const m of source.matchAll(/\b(?:QBCC|BC|RBP)?\s*(?:licen[cs]e|licence|registration)(?:\s*(?:no\.?|number|#))?[\s:#-]*(\d[A-Z0-9-]{3,12})\b/gi)) {
    claims.push(m[0]);
  }

  return uniqueNonEmpty(claims);
}

function normalizedMatch(rendered, brief, normalizer, { allowContains = false } = {}) {
  const renderedNorm = normalizer(rendered);
  const briefNorm = normalizer(brief);
  if (!renderedNorm || !briefNorm) return false;
  if (renderedNorm === briefNorm) return true;
  return allowContains && renderedNorm.length >= 8 && briefNorm.length >= 8
    && (renderedNorm.includes(briefNorm) || briefNorm.includes(renderedNorm));
}

function compareClaim({ field, rendered, brief, normalizer, severity = 'high', hardFail = null, allowContains = false }) {
  const renderedValues = uniqueNonEmpty(rendered);
  const briefValue = String(brief || '').trim();
  if (!renderedValues.length) return [];
  if (!briefValue) {
    return renderedValues.map(value => ({
      section: 'identity',
      kind: hardFail ? 'copy' : 'identity',
      owner: 'rewrite_copy',
      severity,
      labels: ['unlocked_identity_claim'],
      hardFail,
      reason: `${field} appears on page but is absent from locked brief`,
      fix: `Remove the ${field} claim or lock the verified value in single-page-brief.yaml`,
      span: value,
    }));
  }
  return renderedValues
    .filter(value => !normalizedMatch(value, briefValue, normalizer, { allowContains }))
    .map(value => ({
      section: 'identity',
      kind: 'copy',
      owner: 'rewrite_copy',
      severity: 'critical',
      labels: ['fabricated_license_or_identity'],
      hardFail: 'fabricated_license_or_identity',
      reason: `${field} "${value}" conflicts with locked brief value "${briefValue}"`,
      fix: `Render ${field} from single-page-brief.yaml only`,
      span: value,
    }));
}

function compareLicenseNumberClaim({ rendered, brief }) {
  const renderedValues = uniqueNonEmpty(rendered);
  const briefValue = String(brief || '').trim();
  if (!renderedValues.length) return [];
  if (!briefValue) {
    return renderedValues.map(value => ({
      section: 'identity',
      kind: 'copy',
      owner: 'rewrite_copy',
      severity: 'critical',
      labels: ['unlocked_identity_claim'],
      hardFail: 'fabricated_license_or_identity',
      reason: `licence number appears on page but is absent from locked brief`,
      fix: `Remove the licence number claim or lock the verified value in single-page-brief.yaml`,
      span: value,
    }));
  }

  const briefNorm = normalizeLicenseNumber(briefValue);
  return renderedValues
    .filter(value => {
      const valueNorm = normalizeLicenseNumber(value);
      return !valueNorm || !briefNorm || !(valueNorm.includes(briefNorm) || briefNorm.includes(valueNorm));
    })
    .map(value => ({
      section: 'identity',
      kind: 'copy',
      owner: 'rewrite_copy',
      severity: 'critical',
      labels: ['fabricated_license_or_identity'],
      hardFail: 'fabricated_license_or_identity',
      reason: `licence number "${value}" conflicts with locked brief value "${briefValue}"`,
      fix: `Render licence number from single-page-brief.yaml only`,
      span: value,
    }));
}

/**
 * Verify the rendered page's identity facts against the locked brief facts.
 * @param {string} html rendered page HTML
 * @param {object|null} briefFacts from loadBriefFacts()
 * @returns {{ status, findings, claims?, warning? }} · findings with hardFail = fabricated_license_or_identity
 */
export function identityFindings(html, briefFacts) {
  if (!briefFacts) return { status: 'skipped', findings: [], warning: 'identity check skipped: no --brief and no --slug brief path' };
  const claims = extractIdentityClaims(html);
  const findings = [];
  findings.push(...compareClaim({ field: 'ABN', rendered: claims.abn, brief: briefFacts.abn, normalizer: digitsOnly }));
  findings.push(...compareLicenseNumberClaim({ rendered: claims.license_number, brief: briefFacts.license_number }));
  findings.push(...compareClaim({
    field: 'licence authority', rendered: claims.license_authority, brief: briefFacts.license_authority,
    normalizer: normalizeTextFact, severity: 'critical',
    hardFail: briefFacts.license_authority ? null : 'fabricated_license_or_identity',
  }));
  findings.push(...compareClaim({
    field: 'phone', rendered: claims.phone, brief: briefFacts.phone_tel || briefFacts.phone_display, normalizer: normalizePhone,
  }));
  if (briefFacts.business_name && claims.text.includes(briefFacts.business_name)) { /* MATCH · no finding */ }
  if (briefFacts.address && claims.address.length) {
    findings.push(...compareClaim({ field: 'address', rendered: claims.address, brief: briefFacts.address, normalizer: normalizeTextFact, allowContains: true }));
  }
  return { status: 'checked', findings, claims };
}

/**
 * Convenience: load brief + verify in one call. @returns {{ pass, hardFails, findings, status }}
 */
export function verifyFacts(html, briefPath) {
  const briefFacts = loadBriefFacts(briefPath);
  const r = identityFindings(html, briefFacts);
  const hardFails = [...new Set(r.findings.filter(f => f.hardFail).map(f => f.hardFail))];
  return { pass: r.status === 'checked' && hardFails.length === 0, status: r.status, hardFails, findings: r.findings, warning: r.warning };
}
