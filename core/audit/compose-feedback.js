/**
 * core/audit/compose-feedback.js · audit issue → executable compose feedback
 * (codex R50/R68). Turns an audit-v4 issue into a structured, upstream-targeted
 * `compose_feedback` for the compose-loop (GATE-B). Phase-1 red line (R52-Q4):
 * only `rewrite_copy` / `adjust_token` / `replace_image` against an existing
 * upstream artifact. Anything needing add/remove-block, new skills, regen, image
 * generation, or pure aesthetic/structural redesign is marked `blocked` (recorded
 * in loop_summary, never auto-applied). Facts stay authoritative.
 */
import fs from 'node:fs';
import path from 'node:path';

// dim / rule  →  Phase-1 mapping. fieldHint guides the upstream edit target.
const MAP = {
  // --- facts / content accuracy (P0/P1) --- (D2.11 handled by special resolver below)
  // --- content richness (P1) ---
  // codex R73: composer reads services.json `short_desc` (readPreparedServices); empty
  // short_desc → empty cards. Populate from verified service_list backbone (fact-guarded).
  'D2.13_service_card_empty_body': { action: 'rewrite_copy', artifact: 'services.json', field: 'services[].short_desc', fix: 'Populate empty service short_desc from the verified service_list backbone (no fabrication · fact-guarded)', confidence: 0.8 },
  'D2.13_trust_field_presence': { action: 'adjust_token', artifact: 'site-ctx', field: 'footer.abn', fix: 'Surface the verified ABN (+ insured/guarantee) in the footer trust block', confidence: 0.85 },
  'AV-4': { action: 'rewrite_copy', artifact: 'core-extract', field: 'copy(banned phrase)', fix: 'Replace the banned generic phrase with specific concrete proof (pl-au-trade-voice §1.5)', confidence: 0.85 },
  // --- hero (deterministic) ---
  'mech-H-2': { action: 'rewrite_copy', artifact: 'site-ctx', field: 'hero.subhead', fix: 'Trim/expand hero subhead to 14-25 words', confidence: 0.9 },
  'C-H-7': { action: 'rewrite_copy', artifact: 'site-ctx', field: 'hero.headline/subhead', fix: 'Add one concrete number (years/reviews/warranty/suburbs) to the hero copy', confidence: 0.85 },
  'mech-H-1': { action: 'rewrite_copy', artifact: 'site-ctx', field: 'hero.headline', fix: 'Tighten hero H1 to ≤10 words', confidence: 0.9 },
  'D3.7_hero_cta_above_fold': { action: 'rewrite_copy', artifact: 'site-ctx', field: 'hero.headline+subhead', fix: 'Shorten hero H1/subhead so the primary CTA sits above the fold', confidence: 0.75 },
};

// Patterns that are structural/aesthetic → blocked in Phase 1 (record only).
const BLOCKED = [
  { re: /^layout_lever_needed/, reason: 'layout_lever_needed — geometry marginally off (e.g. CTA ≤60px below fold) with copy already at its floor; needs a Phase-2 layout lever (headline size / hero spacing / form placement), not a copy edit (codex R77)' },
  { re: /^D2\.9b_instruction_leak/, reason: 'source_unlocated — rendered About leak is NOT in the render-read writer (about.md is clean); true source untraced. Needs a trace task before any safe edit (codex R73 · Phase-2)' },
  { re: /^D2\.11_service_accuracy/, reason: 'set_level_change — changing which services render (drop/surface/reorder) exceeds Phase-1 copy-only (≈ add/remove block). Phase-2 (codex R73)' },
  { re: /^D2\.9_provenance/, reason: 'Fabricated-proof fix needs review-block suppression (Phase 3) or real review data (upstream enrichment) — not a copy/token edit' },
  { re: /^T4\./, reason: 'Site design-craft (spacing/hierarchy/consistency/imagery/ai_slop) needs template/structural change (Phase 3)' },
  { re: /^vis-hero\./, reason: 'Hero aesthetic judgment (image relevance/hierarchy/ai_slop/5s) needs template/asset change (Phase 2/3)' },
  { re: /D3\.5_footer/, reason: 'Footer presence/structure is template-level (Phase 3)' },
  { re: /ai_slop|hierarchy|spacing|mobile_craft|D-H-3|mech-H-7/, reason: 'Visual/structural craft — not a Phase-1 copy/token/image edit' },
];

const TARGET_PATHS = {
  'site-ctx': (slug) => `clients/${slug}/v2/site-ctx.json`,
  'core-extract': (slug) => `clients/${slug}/v2/core-extract.json`,
  'services.json': (slug) => `clients/${slug}/v2/handoff/od-package/content/services.json`,
  'selected.json': (slug) => `clients/${slug}/v2/handoff/photos/selected.json`,
  'brand-tokens': (slug) => `clients/${slug}/v2/handoff/od-package/brand/brand-tokens.css`,
};

// codex R68 fix: D2.11 must edit the file that actually CONTAINS the rendered
// (wrong) value, not a hard-coded artifact. core-extract may already be correct
// while the bad value lives in single-page-brief.yaml. Search candidates in
// render-source priority and target the one holding the conflicting value.
const FACT_SOURCE_CANDIDATES = ['single-page-brief.yaml', 'site-ctx.json', 'core-extract.json', 'master.md'];
function resolveFactSource(slug, renderedValue) {
  if (!renderedValue || slug === '<slug>') return null;
  const digits = renderedValue.replace(/\D/g, '');
  const needle = digits.length >= 6 ? digits : renderedValue.toLowerCase();
  for (const fname of FACT_SOURCE_CANDIDATES) {
    const p = `clients/${slug}/v2/${fname}`;
    try {
      const raw = fs.readFileSync(path.resolve(p), 'utf8');
      const hay = digits.length >= 6 ? raw.replace(/\D/g, '') : raw.toLowerCase();
      if (hay.includes(needle)) return { artifact: fname.replace(/\.(json|yaml|md)$/, ''), path: p };
    } catch { /* missing file · skip */ }
  }
  return null;
}
function renderedConflictValue(what) {
  const abn = what.match(/Rendered ABN ([\d ]{11,17})/i);
  if (abn) return abn[1];
  const warr = what.match(/Rendered claims (\d{1,2})[\s-]?year/i);
  if (warr) return warr[1] + '-year';
  return null;
}

// codex R72: does the hero have a traceable PROOF number to surface? A proof number is
// a marketing fact (years-in-business / rating / reviews / warranty / suburb count) —
// NOT an ABN/phone/licence digit. Checks proof_chips + a narrow real_facts allowlist.
// No proof number anywhere → C-H-7 is unsatisfiable (fact-guard forbids inventing) → block.
const PROOF_NUMBER_FIELDS = ['founded_year', 'years_in_business', 'google_rating', 'rating', 'review_count', 'reviews', 'domain_age_years', 'guarantee', 'warranty', 'warranty_years'];
function heroHasTraceableNumber(slug) {
  if (slug === '<slug>') return true; // synthetic context · don't block
  const hay = [];
  try {
    const hc = JSON.parse(fs.readFileSync(path.resolve(`clients/${slug}/v2/handoff/od-package/content/hero-copy.json`), 'utf8'));
    (hc.candidates || []).forEach((c) => { hay.push((c.proof_chips || []).join(' ')); });
  } catch { /* no hero-copy */ }
  try {
    const rf = JSON.parse(fs.readFileSync(path.resolve(`clients/${slug}/v2/core-extract.json`), 'utf8')).brief?.real_facts || {};
    for (const f of PROOF_NUMBER_FIELDS) if (rf[f] !== undefined) hay.push(JSON.stringify(rf[f]));
  } catch { /* no core-extract */ }
  return /\d/.test(hay.join(' '));
}

/**
 * @returns compose_feedback object for one issue.
 */
export function toComposeFeedback(issue, ctx = {}) {
  const key = issue.rule || issue.dim || '';
  const slug = ctx.slug || '<slug>';

  const blocked = BLOCKED.find((b) => b.re.test(key));
  if (blocked) {
    return { loop_action: null, blocking_reason: blocked.reason, evidence: issue.what, source_dim: key, severity: issue.severity };
  }

  // D2.11 facts: resolve the real source file containing the rendered bad value
  if (key === 'D2.11_facts_cross_check') {
    const src = resolveFactSource(slug, renderedConflictValue(issue.what || ''));
    const artifact = src?.artifact || 'core-extract';
    return { loop_action: 'adjust_token', target_artifact: artifact, target_path: src?.path || TARGET_PATHS['core-extract'](slug), target_field: 'verified_fact(abn|warranty)', allowed_fix: 'Correct the conflicting fact in the source file that holds the rendered value so render matches the verified value', evidence: issue.what, source_dim: key, severity: issue.severity, confidence: src ? 0.9 : 0.6, ...(src ? {} : { resolution_note: 'source file not located · verify before edit' }) };
  }

  // D2.13 unresolved placeholder: [object Object]/token = upstream (adjust_token);
  // empty Est./File No./dash-only = template conditional → blocked (codex R68 #3).
  if (key === 'D2.13_unresolved_placeholder') {
    const w = issue.what || '';
    if (/\[object Object\]|template token|TBD|TBC|N\/A/i.test(w)) {
      return { loop_action: 'adjust_token', target_artifact: 'core-extract', target_path: TARGET_PATHS['core-extract'](slug), target_field: 'serialized field', allowed_fix: 'Normalize the upstream value that serialized to [object Object] / TBD (upstream data only · no template edits)', evidence: w, source_dim: key, severity: issue.severity, confidence: 0.8 };
    }
    return { loop_action: null, blocking_reason: 'Empty Est./File No./dash-only need template conditional rendering (Phase 3), not an upstream copy/token edit', evidence: w, source_dim: key, severity: issue.severity };
  }

  // codex R72: C-H-7 (hero needs a concrete number) is only satisfiable if a traceable
  // number EXISTS in the facts — fact-guard forbids inventing one. No number anywhere in
  // the hero chips / real_facts → block upfront (don't waste an unsatisfiable rewrite).
  if (key === 'C-H-7' && !heroHasTraceableNumber(slug)) {
    return { loop_action: null, blocking_reason: 'no_traceable_number — hero needs a concrete number but none exists in proof_chips/real_facts; fact-guard forbids inventing one (needs upstream data, not a copy edit)', evidence: issue.what, source_dim: key, severity: issue.severity };
  }

  // image-relevance mismatch with an existing better candidate → replace_image
  if (/image|imagery/i.test(key) && !/T4\.|vis-hero\./.test(key)) {
    return { loop_action: 'replace_image', target_artifact: 'selected.json', target_path: TARGET_PATHS['selected.json'](slug), allowed_fix: 'Swap to a better on-brand candidate already in selected.json', evidence: issue.what, source_dim: key, severity: issue.severity, confidence: 0.6 };
  }

  const m = MAP[key];
  if (!m) {
    return { loop_action: null, blocking_reason: `no Phase-1 mapping for ${key} (record only)`, evidence: issue.what, source_dim: key, severity: issue.severity };
  }
  return {
    loop_action: m.action,
    target_artifact: m.artifact,
    target_path: (TARGET_PATHS[m.artifact] || (() => null))(slug),
    target_field: m.field,
    allowed_fix: m.fix,
    evidence: issue.what,
    source_dim: key,
    severity: issue.severity,
    confidence: m.confidence,
  };
}

// codex R70: site-ctx.json is a DERIVED middle contract (pl:extract-site-ctx
// regenerates it) — the loop must NEVER write it. Redirect any site-ctx-targeted
// feedback to the TRUE writer file, else block. Keeps the SSOT single-writer rule.
function resolveTrueWriter(cf, slug) {
  if (!cf.loop_action || cf.target_artifact !== 'site-ctx') return cf;
  const field = (cf.target_field || '').toLowerCase();
  const exists = (rel) => { try { return fs.existsSync(path.resolve(`clients/${slug}/v2/${rel}`)); } catch { return false; } };
  const redirect = (artifact, rel, target_field, note) => ({ ...cf, target_artifact: artifact, target_path: `clients/${slug}/v2/${rel}`, target_field, re_extract: note?.re_extract || false, writer_note: note?.msg });

  if (field.includes('hero')) {
    const cdir = `clients/${slug}/v2/handoff/od-package/content`;
    if (exists('handoff/od-package/content/hero-copy.json')) {
      // codex R70: compute the chosen index EXACTLY like the composer's readPreparedHero()
      // — content-selection.hero_index (when hero_approved) → hero-copy.recommended_index → 0.
      let idx = 0;
      try { idx = JSON.parse(fs.readFileSync(path.resolve(`${cdir}/hero-copy.json`), 'utf8')).recommended_index ?? 0; } catch {}
      try {
        if (fs.existsSync(path.resolve(`${cdir}/content-selection.json`))) {
          const sel = JSON.parse(fs.readFileSync(path.resolve(`${cdir}/content-selection.json`), 'utf8'));
          if (sel.hero_approved && sel.hero_index != null) idx = sel.hero_index;
        }
      } catch {}
      return redirect('hero-copy.json', 'handoff/od-package/content/hero-copy.json', `candidates[${idx}].headline/subheadline`);
    }
    return redirect('core-extract', 'core-extract.json', 'brief.narrative.hero_copy_options', { re_extract: true });
  }
  if (field.includes('service')) {
    if (exists('handoff/od-package/content/services.json')) return redirect('services.json', 'handoff/od-package/content/services.json', 'services[].short_desc/desc');
    return redirect('core-extract', 'core-extract.json', 'brief.real_facts.service_list', { re_extract: true });
  }
  if (field.includes('footer') || field.includes('abn')) {
    // codex R70: composer footer reads `brief?.abn || licNum.ABN`. The only safe,
    // render-read writer is single-page-brief.yaml:abn. core-extract is NOT a reliable
    // fallback (a-j/mark store lowercase license_numbers.abn which the footer never reads,
    // and re-extract won't synthesize the canonical brief) → block when no brief exists.
    if (exists('single-page-brief.yaml')) return redirect('single-page-brief.yaml', 'single-page-brief.yaml', 'abn', { msg: 'composer footer reads brief.abn' });
    return { loop_action: null, blocking_reason: 'missing canonical render brief (single-page-brief.yaml) for footer.abn — composer footer reads brief.abn || licNum.ABN; needs a brief-generation step before this is loop-actionable', evidence: cf.evidence, source_dim: cf.source_dim, severity: cf.severity };
  }
  // unknown site-ctx field · cannot safely redirect → block
  return { loop_action: null, blocking_reason: `site-ctx is derived; no true-writer mapping for field "${cf.target_field}" — would be overwritten by re-extract`, evidence: cf.evidence, source_dim: cf.source_dim, severity: cf.severity };
}

/** Attach compose_feedback to every issue · returns {issues, actionable, blocked}. */
export function attachComposeFeedback(issues, ctx = {}) {
  let actionable = 0, blocked = 0;
  const out = (issues || []).map((iss) => {
    const cf = resolveTrueWriter(toComposeFeedback(iss, ctx), ctx.slug || '<slug>');
    if (cf.loop_action) actionable++; else blocked++;
    return { ...iss, compose_feedback: cf };
  });
  return { issues: out, actionable, blocked };
}

export { resolveTrueWriter as _resolveTrueWriter };
