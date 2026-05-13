#!/usr/bin/env node
// Round 1 · Approach C · reference HTML adapter
// Take reference-site/index.html + customer master.md → claude CLI → adapted HTML.
// Cost: ~1 claude CLI call · ~$0.30 estimate · ~2 min.
//
// Usage:
//   node scripts/template-lab/round1-c-adapter.mjs --slug brisbane-roof-restoration-experts
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const next = arr[i + 1];
      acc.push([k, next && !next.startsWith('--') ? next : true]);
    }
    return acc;
  }, [])
);

const slug = args.slug;
if (!slug) { console.error('--slug required'); process.exit(1); }

const REFERENCE_HTML = path.join(REPO, 'templates/roofing/families/classic-premium-roftix/reference-site/index.html');
const BOUNDARIES = path.join(REPO, 'templates/roofing/families/classic-premium-roftix/reference-site/HANDOFF-BOUNDARIES.md');
const MASTER_MD = path.join(REPO, 'clients', slug, 'v2', 'master.md');

for (const p of [REFERENCE_HTML, BOUNDARIES, MASTER_MD]) {
  if (!fs.existsSync(p)) { console.error(`Missing: ${p}`); process.exit(1); }
}

const OUT_DIR = path.join(REPO, 'data', 'qa', 'round1-c-output');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUT_HTML = path.join(OUT_DIR, `${slug}.html`);

const referenceBody = fs.readFileSync(REFERENCE_HTML, 'utf8');
const boundariesBody = fs.readFileSync(BOUNDARIES, 'utf8');
const masterBody = fs.readFileSync(MASTER_MD, 'utf8');

// Also copy assets so the adapted HTML can use them via relative path
const REF_ASSETS = path.join(path.dirname(REFERENCE_HTML), 'assets');
const OUT_ASSETS = path.join(OUT_DIR, 'assets');
fs.mkdirSync(OUT_ASSETS, { recursive: true });
for (const f of fs.readdirSync(REF_ASSETS)) {
  fs.copyFileSync(path.join(REF_ASSETS, f), path.join(OUT_ASSETS, f));
}

const prompt = `You are adapting a reference Brisbane roofing demo website to a real customer.

# REFERENCE SITE (Brisbane Premium Roof Co · fictional demo)

\`\`\`html
${referenceBody}
\`\`\`

# HANDOFF BOUNDARIES (rules you must follow)

${boundariesBody}

# REAL CUSTOMER (master.md)

\`\`\`markdown
${masterBody}
\`\`\`

# YOUR TASK

Output a single complete \`<!doctype html>\` HTML document that adapts the reference site to this real customer.

Required edits:
1. Replace every "Brisbane Premium Roof Co" with the real business name
2. Replace phone "(07) 3185 2440" / "0731852440" with the real phone number from master.md
3. Replace address / suburbs / email with real customer data
4. Adapt H1, hero subhead, services, FAQ to match the real customer's services and audit findings
5. Update audit banner to reflect real audit_score and 3 real audit findings (from master.md)
6. For sections marked data-od-sample="true": if customer has real data, use it; else generate plausible niche-typical sample content AND keep the sample-tag UI visible
7. Update topnav + footer business info
8. Keep ALL image src paths as "assets/..." (the 5 PNG files in assets/ remain unchanged)

Rules:
- DO NOT change CSS tokens (colors, fonts, spacing)
- DO NOT change section structure (data-od-locked sections especially)
- DO NOT use phrases from the antiTemplate blacklist (trusted partner, your roof deserves better, etc.)
- DO NOT invent license numbers, specific award names, prices, specific year counts
- Mark any new sections with data-od-new="true" + data-od-new-reason="..."
- Sample content is OK and encouraged (sample-tag UI), but must be plausibly niche-typical

Output ONLY the HTML document. No markdown fences, no commentary, no thinking. Start with <!doctype html> and end with </html>.`;

console.log(`[round1-c] customer: ${slug}`);
console.log(`[round1-c] reference: ${REFERENCE_HTML}`);
console.log(`[round1-c] output:    ${OUT_HTML}`);
console.log(`[round1-c] prompt size: ${prompt.length} chars\n`);

// Invoke claude CLI · capture full stdout as the adapted HTML.
const start = Date.now();
const proc = spawn('claude', ['-p', prompt, '--model', 'claude-sonnet-4-5'], { stdio: ['ignore', 'pipe', 'inherit'] });
let buf = '';
proc.stdout.on('data', (chunk) => { buf += chunk.toString(); process.stderr.write('.'); });
proc.on('exit', (code) => {
  process.stderr.write('\n');
  if (code !== 0) {
    console.error(`\n[round1-c] claude CLI exit ${code}`);
    process.exit(code || 1);
  }
  // Strip any preamble before <!doctype html>
  const docIdx = buf.toLowerCase().indexOf('<!doctype html');
  const cleaned = docIdx > 0 ? buf.slice(docIdx) : buf;
  fs.writeFileSync(OUT_HTML, cleaned);
  const took = Math.round((Date.now() - start) / 1000);
  console.log(`\n[round1-c] DONE · ${cleaned.length} bytes · ${took}s · ${OUT_HTML}`);
});
