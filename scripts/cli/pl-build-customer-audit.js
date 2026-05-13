#!/usr/bin/env node
/**
 * pl:build-customer-audit · M2-D9 production runner
 *
 * Takes master.md + internal-audit-report.html for a real customer, sends to
 * claude CLI with the `customer` audience preamble, writes
 * clients/<slug>/v2/customer-facing-audit.html.
 *
 * Cost: ~$0.30 per call (claude sonnet-4-5 · ~50k input + ~6k output tokens · ~2 min)
 *
 * Usage:
 *   npm run pl:build-customer-audit -- --slug <customer-slug>
 */
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { getPreamble } from '../../core/reports/generator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');

const args = parseArgs(process.argv.slice(2));
const slug = args.slug;
if (!slug) {
  console.error('Usage: pl:build-customer-audit -- --slug <customer-slug>');
  process.exit(1);
}

const v2Dir = path.join(REPO, 'clients', slug, 'v2');
const masterMdPath = path.join(v2Dir, 'master.md');
if (!fs.existsSync(masterMdPath)) {
  console.error(`master.md not found: ${masterMdPath}`);
  process.exit(1);
}

const masterMd = fs.readFileSync(masterMdPath, 'utf8');
const internalHtml = fs.existsSync(path.join(v2Dir, 'internal-audit-report.html'))
  ? fs.readFileSync(path.join(v2Dir, 'internal-audit-report.html'), 'utf8').slice(0, 30000)
  : '(internal-audit-report.html not built yet)';

const preamble = getPreamble('customer');
const businessName = (masterMd.match(/business_name:\s*"([^"]+)"/) || [])[1] || slug;

const prompt = `${preamble}

# THE BUSINESS

${businessName}

# THE INTERNAL AUDIT (in Chinese · operator-facing · contains technical terms · contains $ recommendations)

Below is the FULL internal audit report. Your job: rewrite as a customer-facing audit
for the business owner. Strip jargon. Strip prices. Translate findings into business impact.

\`\`\`markdown
${masterMd}
\`\`\`

# WHAT TO PRODUCE

Output a single complete \`<!doctype html>\` HTML document. Use clean editorial design.
Same visual style as internal report (cream background, serif headings, sans body) but
audience is the BUSINESS OWNER not the operator.

Structure:
1. Hero · 1 line summary + score visualization
2. "What's working well" · 2-3 strengths (in business owner language)
3. "What's holding you back" · 3-5 specific issues (translated to "more calls / lost customers")
4. "What changes when we fix this" · expected outcomes
5. Closing · invite to 30-min walkthrough · NO prices · NO sales pressure

Style requirements:
- LANGUAGE: ENGLISH ONLY · Australian-friendly plain English (no Chinese characters anywhere)
- Australian spelling: colour / optimise / behaviour / centre · NOT American
- Plain language · no GTM / pixel / sitemap / CRUX / LCP / TBT / Lighthouse
- No "$" figures · no quotes · no pricing
- Flesch reading ease ≥ 60 (Grade 7-8 readability)
- Friendly tone · honest about strengths AND weaknesses
- Use specific findings from the audit · do not invent

Output ONLY the HTML document. No markdown fences. No commentary.
Start with <!doctype html> and end with </html>.`;

const outPath = path.join(v2Dir, 'customer-facing-audit.html');

console.log(`[pl:build-customer-audit] slug:    ${slug}`);
console.log(`[pl:build-customer-audit] business: ${businessName}`);
console.log(`[pl:build-customer-audit] master.md: ${masterMd.length} bytes`);
console.log(`[pl:build-customer-audit] output:  ${outPath}`);
console.log(`[pl:build-customer-audit] prompt:  ${prompt.length} chars\n`);

const model = args.model || process.env.PL_CUSTOMER_AUDIT_MODEL || 'claude-sonnet-4-5';
const start = Date.now();
const proc = spawn('claude', ['-p', prompt, '--model', model], { stdio: ['ignore', 'pipe', 'inherit'] });
let buf = '';
proc.stdout.on('data', (chunk) => { buf += chunk.toString(); process.stderr.write('.'); });
proc.on('exit', (code) => {
  process.stderr.write('\n');
  if (code !== 0) {
    console.error(`claude CLI exit ${code}`);
    process.exit(code || 1);
  }
  const docIdx = buf.toLowerCase().indexOf('<!doctype html');
  const cleaned = docIdx > 0 ? buf.slice(docIdx) : buf;
  fs.writeFileSync(outPath, cleaned);
  const took = Math.round((Date.now() - start) / 1000);
  console.log(`\n[pl:build-customer-audit] DONE · ${cleaned.length} bytes · ${took}s · ${outPath}`);
});

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq > 2) { out[a.slice(2, eq)] = a.slice(eq + 1); continue; }
    const k = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) { out[k] = true; continue; }
    out[k] = next; i++;
  }
  return out;
}
