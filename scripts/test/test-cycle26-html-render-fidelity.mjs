/**
 * cycle-26 · TDD test 16/?? · HTML render (huashu) fidelity.
 *
 * P1.2 per Matthew: "MD 文档完备 · audit 报告完整" — when master.md becomes
 * master.report.html via huashu-md-html, the HTML must:
 *   - have same # of <h2> as ## headings in MD
 *   - contain all section heading texts verbatim
 *   - contain references to ALL inline images present in MD
 *   - size > 5KB (not error/blank page)
 *   - HTML structure valid (closes tags · has <html><body>)
 *
 * Uses pre-built clients/ace-roofing-service/v2/{master.md, master.report.html}
 * if present · otherwise skip.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const SLUG = 'ace-roofing-service';
const MD_FILE = path.join(ROOT, 'clients', SLUG, 'v2/master.md');
const HTML_FILE = path.join(ROOT, 'clients', SLUG, 'v2/master.report.html');

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}

console.log('cycle-26 · test 16/?? · HTML render fidelity (huashu-md-html)\n');

if (!fs.existsSync(MD_FILE) || !fs.existsSync(HTML_FILE)) {
  console.log(`  ⏭ skip · ${SLUG} master.md or master.report.html not built`);
  console.log('\n0/0 passed · skipped');
  process.exit(0);
}

const md = fs.readFileSync(MD_FILE, 'utf8');
const html = fs.readFileSync(HTML_FILE, 'utf8');

// ─── F1 · file existence + size ────────────────────────────────────────────
t('master.report.html size > 5KB (not blank/error page)', () => {
  const size = fs.statSync(HTML_FILE).size;
  assert.ok(size > 5000, `expected ≥ 5KB · got ${size} bytes`);
});

t('master.report.html has valid HTML skeleton (html/body tags)', () => {
  assert.ok(html.includes('<html') || html.includes('<HTML'), 'missing <html> tag');
  assert.ok(html.includes('<body') || html.includes('<BODY'), 'missing <body> tag');
  assert.ok(html.trim().endsWith('</html>') || html.trim().endsWith('</HTML>'),
    'must close </html>');
});

// ─── F2 · heading count parity ────────────────────────────────────────────
t('<h2> count in HTML === ## count in master.md (no drift)', () => {
  const mdH2 = (md.match(/^## /gm) || []).length;
  const htmlH2 = (html.match(/<h2[^>]*>/gi) || []).length;
  assert.equal(htmlH2, mdH2, `h2 count drift · md=${mdH2} html=${htmlH2}`);
});

// ─── F3 · every section heading text appears in HTML verbatim ─────────────
t('every ## heading text in MD also appears in HTML', () => {
  const headings = (md.match(/^## .+/gm) || []).map((h) => h.replace(/^## /, '').trim());
  // Strip ASCII + Unicode quotes · collapse all whitespace to single space (HTML may line-break)
  function norm(s) { return s.replace(/["'“”‘’]/g, '').replace(/\s+/g, ' ').trim(); }
  const htmlNorm = norm(html);
  for (const h of headings) {
    const core = norm(h.split('·')[0].trim().slice(0, 12));
    assert.ok(htmlNorm.includes(core), `heading "${h}" (core="${core}") missing in HTML`);
  }
});

// ─── F4 · inline image refs preserved (count match) ───────────────────────
t('inline image references preserved (md ![] count ≈ html <img> count)', () => {
  const mdImages = (md.match(/!\[[^\]]*\]\([^)]+\)/g) || []).length;
  const htmlImages = (html.match(/<img[^>]+>/gi) || []).length;
  // Allow some divergence (e.g. inline cards may add wrapper)
  // But all md images must be at least 1 img · or 0 if no md images
  if (mdImages > 0) {
    assert.ok(htmlImages >= mdImages, `image count drop: md=${mdImages} html=${htmlImages}`);
  }
});

// ─── F5 · no literal "{{ }}" template leak (huashu render failure) ────────
t('no unrendered template literal `{{ }}` in HTML (huashu failure mode)', () => {
  assert.ok(!html.match(/\{\{[a-zA-Z_]/), 'template literal leaked · huashu render incomplete');
});

// ─── F6 · master.md title heading in HTML <h1> ────────────────────────────
t('master.md # title rendered as <h1> in HTML', () => {
  const mdH1 = md.match(/^# (.+)$/m);
  if (!mdH1) { console.log('    (skip · no # title in md)'); return; }
  const titleText = mdH1[1].split('·')[0].trim();
  assert.ok(html.includes('<h1'), 'missing <h1> tag');
  assert.ok(html.includes(titleText), `title text "${titleText}" missing in HTML`);
});

// ─── F7 · frontmatter NOT rendered as visible content ─────────────────────
t('YAML frontmatter not leaked as visible HTML body content', () => {
  // YAML field like "business_id: " should not appear in visible body text
  // (might appear in HTML comments or meta · but not in user-visible content)
  const bodyMatch = html.match(/<body[^>]*>([\s\S]+?)<\/body>/i);
  if (!bodyMatch) { console.log('    (skip · no body match)'); return; }
  const body = bodyMatch[1];
  assert.ok(!/business_id:\s*"/.test(body),
    'YAML frontmatter leaked into visible body');
  assert.ok(!/^---\s*$/m.test(body), '--- YAML delimiter leaked');
});

// ─── F8 · cross-check: master.md vs master.report.html generation time ─────
t('master.report.html mtime newer-or-equal master.md mtime (built after MD)', () => {
  const mdMtime = fs.statSync(MD_FILE).mtimeMs;
  const htmlMtime = fs.statSync(HTML_FILE).mtimeMs;
  // Allow 1 sec slack
  assert.ok(htmlMtime + 1000 >= mdMtime, `HTML stale · md ${mdMtime} > html ${htmlMtime}`);
});

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
