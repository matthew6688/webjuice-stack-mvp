/**
 * Reference HTML adapter handoff · M3 default for V3 (2026-05-13).
 *
 * Background: round 0 + round 1 validated this approach on 3 roofing
 * customers (brisbane-roof-restoration-experts · gutter-and-roof-repairs ·
 * weatherproof-restorations) — same locked design system, different real
 * customer info + plausible sample content where data missing. See:
 *   - templates/roofing/families/trade-classic/reference-site/
 *   - templates/roofing/families/trade-classic/reference-site/HANDOFF-BOUNDARIES.md
 *   - docs/v3/OD-HANDOFF-RESEARCH.md
 *
 * Replaces the freeform `renderOpenDesignPrompt` path that lived in
 * `website-build-handoff.js` — that path left too many free parameters
 * (visual direction, copy tone, image source) so quality was unstable.
 * This module locks design system + image choice + copy boundaries, OD
 * only adapts content.
 *
 * Public API:
 *   buildReferenceAdapterPrompt({ slug, entity, audit, niche, family })
 *     → string · the single prompt to pipe to claude CLI / Anthropic API
 *
 *   resolveReferenceSite({ niche, family })
 *     → { html, boundaries, assetsDir }
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

// Family registry · per-niche default family.
// V0 canonical: trade-classic (2026-05-29 · replaces retired classic-premium-roftix).
// Reference site: templates/roofing/families/trade-classic/reference-site/
// As we add families for other niches, extend this map.
const FAMILY_REGISTRY = {
  roofing: 'trade-classic',
  roofer: 'trade-classic',
  // cycle-27 (Matthew 2026-05-16 · Bug C): trades fallback. electrician /
  // plumber / concreter / carpenter all share the "premium trade contractor"
  // visual archetype. LLM retexture handles copy & color swap.
  // Once a dedicated reference site lands for each niche we override here.
  electrician: 'trade-classic',
  electrical: 'trade-classic',
  plumber: 'trade-classic',
  plumbing: 'trade-classic',
  concreter: 'trade-classic',
  concrete: 'trade-classic',
  carpenter: 'trade-classic',
  carpentry: 'trade-classic',
  builder: 'trade-classic',
  builders: 'trade-classic',
  painter: 'trade-classic',
  painting: 'trade-classic',
  landscaper: 'trade-classic',
  landscaping: 'trade-classic',
  // Add restaurant / dental / etc. once their reference sites land.
};

// cycle-27 trades default · used when niche is unrecognized.
const TRADES_DEFAULT_FAMILY = 'trade-classic';

function defaultFamilyForNiche(niche) {
  const key = String(niche || '').toLowerCase().trim();
  if (FAMILY_REGISTRY[key]) return FAMILY_REGISTRY[key];
  // Substring match · catches "electrical contractor" · "roof restoration" etc.
  for (const known of Object.keys(FAMILY_REGISTRY)) {
    if (key.includes(known)) return FAMILY_REGISTRY[known];
  }
  return null;
}

/**
 * Resolve the reference-site assets for a given niche/family.
 * Returns the HTML body, the boundaries spec, and the assets directory path.
 */
export function resolveReferenceSite({ niche, family, repoRoot = REPO_ROOT } = {}) {
  // cycle-27 Bug C fix: never hard-crash — fall back to trades-default family
  // (LLM retextures copy + color for any service-trade niche). Log the fallback
  // so we know which niches need their own dedicated reference site.
  let resolvedFamily = family || defaultFamilyForNiche(niche);
  if (!resolvedFamily) {
    console.warn(`[reference-adapter] niche="${niche}" has no registered family · using TRADES_DEFAULT_FAMILY=${TRADES_DEFAULT_FAMILY}`);
    resolvedFamily = TRADES_DEFAULT_FAMILY;
  }
  const familyRoot = path.join(repoRoot, 'templates', 'roofing', 'families', resolvedFamily, 'reference-site');
  const htmlPath = path.join(familyRoot, 'index.html');
  const boundariesPath = path.join(familyRoot, 'HANDOFF-BOUNDARIES.md');
  const assetsDir = path.join(familyRoot, 'assets');
  if (!fs.existsSync(htmlPath)) throw new Error(`Reference HTML missing: ${htmlPath}`);
  if (!fs.existsSync(boundariesPath)) throw new Error(`Boundaries missing: ${boundariesPath}`);
  return {
    family: resolvedFamily,
    html: fs.readFileSync(htmlPath, 'utf8'),
    boundaries: fs.readFileSync(boundariesPath, 'utf8'),
    assetsDir,
    htmlPath,
    boundariesPath,
  };
}

/**
 * Build the single prompt for the reference-adapter LLM call.
 *
 * @param {object} opts
 * @param {string} opts.slug                customer slug (used for context only)
 * @param {object} opts.entity              persisted entity (data/leads/entities/<slug>.json)
 * @param {object} [opts.audit]             detailed audit (optional · null OK)
 * @param {string} [opts.masterMd]          rendered master.md body · optional but recommended (richest context)
 * @param {string} [opts.niche]             override niche → family resolution
 * @param {string} [opts.family]            override family explicitly
 *
 * @returns {string}                        the prompt body
 */
export function buildReferenceAdapterPrompt({ slug, entity, audit, masterMd, niche, family } = {}) {
  const resolvedNiche = niche || entity?.latest?.niche || entity?.niche;
  const ref = resolveReferenceSite({ niche: resolvedNiche, family });

  // Build a compact customer brief. If masterMd was provided, prefer it whole
  // (it's the source of truth and already contains owner voice / reviews /
  // audit pain points). Otherwise synthesize from entity + audit.
  const customerBrief = masterMd
    ? masterMd
    : synthesizeBriefFromEntity({ entity, audit });

  return `You are adapting a reference website to a specific real local-business customer.

# REFERENCE SITE (locked design system · adapt only content)

\`\`\`html
${ref.html}
\`\`\`

# HANDOFF BOUNDARIES (rules you MUST follow)

${ref.boundaries}

# REAL CUSTOMER (master.md or synthesized brief)

\`\`\`markdown
${customerBrief}
\`\`\`

# YOUR TASK

Output a single complete \`<!doctype html>\` HTML document that adapts the reference site to this real customer.

Required edits:
1. Replace the demo business name with the real business name everywhere (title, topnav, hero, footer, alt text)
2. Replace demo phone / tel: links with the real phone
3. Replace demo address / suburbs / email with real customer data (only when present in master.md · do NOT invent)
4. Adapt H1, hero subhead, services, FAQ to the real customer's services and audit pain points
5. Update audit banner with real audit_score and 3 real audit findings (or remove banner if no audit)
   · Keep the "Read the full audit report →" link pointing to "../customer-facing-audit.html"
   · That file is the English plain-language full audit (D26) generated by pl:build-customer-audit
6. For sections marked data-od-sample="true": use real data when present; else infer plausible niche-typical sample AND keep the sample-tag UI visible so the customer knows what's editable
7. Update topnav links + footer business info
8. Keep ALL image src paths as "assets/..." — those 5 PNG files in assets/ are LOCKED

Rules:
- DO NOT change CSS tokens (colors, fonts, spacing scale)
- DO NOT change section internal structure (data-od-locked sections especially)
- DO NOT use the antiTemplate blacklist phrases ("trusted partner", "your roof deserves better", "X years of excellence", "quality you can count on", "welcome to", "we are committed")
- DO NOT invent license numbers, specific awards, prices, years (use vague phrasing like "established local operators" if no real year)
- For new sections (business has scenario reference doesn't cover): mark data-od-new="true" data-od-new-reason="..."

Output ONLY the HTML document. No markdown fences, no commentary, no thinking. Start with <!doctype html> and end with </html>.`;
}

function synthesizeBriefFromEntity({ entity, audit }) {
  const e = entity || {};
  const latest = e.latest || {};
  const ident = e.identifiers || {};
  const lines = [];
  lines.push(`# ${latest.name || e.entityKey}`);
  lines.push('');
  lines.push(`- Niche: ${latest.niche || 'unknown'}`);
  lines.push(`- City / area: ${latest.city || 'unknown'}`);
  if (latest.phone) lines.push(`- Phone: ${latest.phone}`);
  if (latest.website) lines.push(`- Website: ${latest.website}`);
  if (latest.address) lines.push(`- Address: ${latest.address}`);
  if (latest.rating != null) lines.push(`- Google rating: ${latest.rating}`);
  if (latest.review_count != null) lines.push(`- Google reviews: ${latest.review_count}`);
  if (audit) {
    lines.push('');
    lines.push('## Audit summary');
    if (audit.score != null) lines.push(`- Score: ${audit.score}/100`);
    if (audit.decision) lines.push(`- Decision: ${audit.decision}`);
    if (Array.isArray(audit.issues)) {
      lines.push('- Top issues:');
      audit.issues.slice(0, 5).forEach(i => lines.push(`  - ${typeof i === 'string' ? i : (i?.title || JSON.stringify(i))}`));
    }
  }
  return lines.join('\n');
}

/**
 * Convenience: return the prompt + the assets directory that callers need to
 * copy alongside the rendered HTML output.
 */
export function buildAdapterPayload(opts) {
  const resolvedNiche = opts?.niche || opts?.entity?.latest?.niche || opts?.entity?.niche;
  const ref = resolveReferenceSite({ niche: resolvedNiche, family: opts?.family });
  return {
    prompt: buildReferenceAdapterPrompt(opts),
    assetsDir: ref.assetsDir,
    family: ref.family,
    referenceHtmlPath: ref.htmlPath,
  };
}
