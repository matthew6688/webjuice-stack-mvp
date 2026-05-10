#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const args = parseArgs(process.argv.slice(2));
const niche = normalizeId(args.niche || 'roofing');
const familyArg = normalizeId(args.family || '');
const all = Boolean(args.all);
const root = path.resolve(args.root || process.cwd());
const failBelow = Number(args['fail-below'] || 80);

const families = all ? listFamilies(niche) : [familyArg].filter(Boolean);
if (!families.length) {
  console.error('Usage: node scripts/template-lab/audit-template-copy.js --niche roofing --family classic-premium-roftix');
  process.exit(1);
}

const results = families.map((family) => auditFamily({ root, niche, family }));
const ok = results.every((result) => result.score >= failBelow);
console.log(JSON.stringify({ ok, failBelow, results }, null, 2));
process.exit(ok ? 0 : 1);

function auditFamily({ root: repoRoot, niche: nicheId, family }) {
  const familyDir = path.join(repoRoot, 'templates', nicheId, 'families', family);
  const manifestPath = path.join(familyDir, 'template-manifest.json');
  const conceptDir = path.join(familyDir, 'open-design');
  const files = fs.existsSync(conceptDir)
    ? fs.readdirSync(conceptDir).filter((file) => file.endsWith('.html')).map((file) => path.join(conceptDir, file))
    : [];
  const findings = [];

  if (!files.length) findings.push(finding('high', 'missing-html', 'No generated HTML files found to audit.'));
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const text = stripHtml(html);
    checkInternalTerms({ file, text, findings });
    checkFakeProof({ file, text, findings });
    checkGenericCopy({ file, text, findings });
    checkContactPath({ file, html, text, findings });
    checkIndustrySpecificity({ file, text, niche: nicheId, findings });
  }

  const score = Math.max(0, 100 - findings.reduce((sum, item) => sum + severityPenalty(item.severity), 0));
  const report = {
    schemaVersion: 1,
    family,
    niche: nicheId,
    score,
    ok: score >= 80 && !findings.some((item) => item.severity === 'critical'),
    files: files.map((file) => path.relative(repoRoot, file)),
    findings,
    generatedAt: new Date().toISOString(),
  };

  const outPath = path.join(familyDir, 'copy-audit.json');
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.copyAudit = {
      path: path.relative(repoRoot, outPath),
      score,
      ok: report.ok,
      generatedAt: report.generatedAt,
      findingCount: findings.length,
    };
    manifest.updatedAt = new Date().toISOString();
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }

  return report;
}

function checkInternalTerms({ file, text, findings }) {
  const terms = ['lead-ops', 'open design', 'template-lab', 'internal audit', 'mockup direction', 'verified fact', 'dummy content'];
  for (const term of terms) {
    if (text.toLowerCase().includes(term)) findings.push(finding('critical', 'internal-language', `Customer-facing copy contains internal term: ${term}`, file));
  }
}

function checkFakeProof({ file, text, findings }) {
  const patterns = [
    /\b\d{2,4}\+?\s+(projects|clients|homes|reviews|years)\b/i,
    /\b(licensed|certified|award-winning|trusted by|5-star|★★★★★)\b/i,
    /\b\d+(\.\d+)?%\s+(satisfaction|retention|success)\b/i,
  ];
  for (const pattern of patterns) {
    if (pattern.test(text)) findings.push(finding('high', 'possible-fake-proof', `Possible unverified proof claim: ${pattern.source}`, file));
  }
}

function checkGenericCopy({ file, text, findings }) {
  const generic = ['your trusted partner', 'welcome to', 'quality services', 'we are committed to excellence', 'solutions for all your needs'];
  for (const phrase of generic) {
    if (text.toLowerCase().includes(phrase)) findings.push(finding('medium', 'generic-copy', `Generic phrase should be rewritten: ${phrase}`, file));
  }
}

function checkContactPath({ file, html, text, findings }) {
  const hasContact = /href=["']tel:|href=["']mailto:|<form\b|request.*quote|free.*inspection|contact us/i.test(`${html}\n${text}`);
  if (!hasContact) findings.push(finding('critical', 'missing-contact-path', 'No clear phone, email, form, quote, or contact path found.', file));
}

function checkIndustrySpecificity({ file, text, niche, findings }) {
  const wordsByNiche = {
    roofing: ['roof', 'gutter', 'leak', 'tile', 'metal', 'inspection', 'restoration', 'repair'],
  };
  const terms = wordsByNiche[niche] || [niche];
  const hits = terms.filter((term) => text.toLowerCase().includes(term));
  if (hits.length < 2) findings.push(finding('high', 'weak-niche-specificity', `Copy does not strongly read as ${niche}.`, file));
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function severityPenalty(severity) {
  return { critical: 35, high: 18, medium: 8, low: 3 }[severity] || 5;
}

function finding(severity, code, message, file = '') {
  return { severity, code, message, file: file ? path.relative(root, file) : '' };
}

function listFamilies(nicheId) {
  const familyRoot = path.join(root, 'templates', nicheId, 'families');
  if (!fs.existsSync(familyRoot)) return [];
  return fs.readdirSync(familyRoot)
    .filter((name) => fs.existsSync(path.join(familyRoot, name, 'template-manifest.json')))
    .sort();
}

function normalizeId(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '');
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) parsed[key] = true;
    else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}
