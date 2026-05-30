/**
 * core/handoff/persona-context.js · R108 step 5 (codex Round 110 ordered).
 *
 * Shared persona prompt-block builder for the LLM copy generators (B1 services / B2 about / B3 hero).
 * Produces ONE buyer-psychology block that step 6 injects BELOW the LOCKED FACTS and ABOVE the OUTPUT
 * CONTRACT — explicitly at LOWER authority than single-page-brief.yaml.
 *
 * AUTHORITY LADDER (R108 · the safety guard):
 *   single-page-brief.yaml locked facts  >  scraped source  >  persona psychology  >  copy style
 * Persona context is buyer psychology ONLY. It may shape emphasis, order, objections, vocabulary, and CTA
 * framing. It may NEVER be treated as a source of business facts — it does not create claims, credentials,
 * response times, warranty terms, prices, project counts, team sizes, awards, locations, or licence facts.
 * Fact violations are caught deterministically by core/audit/fact-verify.js.
 *
 * This module emits NO business facts of its own — only the segment's psychology (job-to-be-done,
 * decision/bounce triggers, risk concerns, trust levers, information state, voice) plus the explicit guard.
 */

import { getSegment, defaultPrimary, defaultSecondaries, SEGMENT_IDS } from '../audit/personas/index.js';

/**
 * Resolve the buyer segment(s) for a client from the brief/facts, falling back to the canonical default
 * (planned-upgrade primary · urgent-repair secondary · codex Q-P-1). Unknown ids fall back, never throw.
 * @returns {{ primary, secondaries, primaryId, secondaryIds, fallback }}
 */
export function resolvePersona(facts = {}, brief = {}) {
  const pick = (...vals) => vals.find((v) => typeof v === 'string' && v.trim()) || null;
  let primaryId = pick(brief.primary_segment, facts.primary_segment);
  let fallback = false;
  if (!primaryId || !SEGMENT_IDS.includes(primaryId)) {
    primaryId = defaultPrimary();
    fallback = true;
  }
  // codex Round 111: a provided-but-invalid secondary list must fall back to the canonical default
  // (urgent-repair), not collapse to empty. Validate the chosen source, then fall back if it collapses.
  const cleanSecondaries = (list) =>
    [...new Set((Array.isArray(list) ? list : []).filter((id) => SEGMENT_IDS.includes(id) && id !== primaryId))];
  const candidate = (Array.isArray(brief.secondary_segments) && brief.secondary_segments.length)
    ? brief.secondary_segments
    : (Array.isArray(facts.secondary_segments) && facts.secondary_segments.length)
      ? facts.secondary_segments
      : defaultSecondaries();
  let secondaryIds = cleanSecondaries(candidate);
  if (!secondaryIds.length) secondaryIds = cleanSecondaries(defaultSecondaries());
  return {
    primary: getSegment(primaryId),
    secondaries: secondaryIds.map((id) => getSegment(id)),
    primaryId,
    secondaryIds,
    fallback,
  };
}

function asLines(items, max = 6) {
  return (Array.isArray(items) ? items : [])
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .slice(0, max);
}

/**
 * Build the persona-context prompt block for a copy section.
 * @param {object} facts client facts (used ONLY to resolve the segment id; no facts are emitted)
 * @param {object} opts { brief, section: 'about'|'services'|'hero', enabled }
 * @returns {string} the block, or '' when disabled / unresolvable
 */
export function buildPersonaContextBlock(facts = {}, opts = {}) {
  const { brief = {}, section = 'about', enabled = true } = opts;
  if (!enabled) return '';
  let resolved;
  try { resolved = resolvePersona(facts, brief); } catch { return ''; }
  const p = resolved.primary?.segment || resolved.primary; // personas export { segment } default-wrapped
  const seg = p?.segment ? p.segment : p; // tolerate either shape
  if (!seg || !seg.id) return '';

  const jtbd = seg.job_to_be_done || '(unspecified)';
  const triggers = asLines(seg.decision_triggers);
  const risks = asLines(seg.risk_concerns);
  const trust = asLines(seg.trust_levers_top_3, 3);
  const bounce = asLines([...(seg.bounce_triggers || []), ...(seg.forbidden_signals || [])], 8);
  const info = seg.information_state || {};
  const knows = asLines(info.knows, 5).join(', ');
  const doesNot = asLines(info.does_not_know, 5).join(', ');
  const tone = seg.voice_modifiers?.tone || 'plain · concrete · no hype';

  // Section-specific lens — how THIS buyer reads THIS section (psychology, not facts).
  const sectionLens = {
    about: "Answer the one question this buyer is actually asking: \"why would I trust THIS business with my job?\" Lead with the proof that matters to them; cut anything that reads as corporate self-praise.",
    services: "Frame each service around this buyer's pain, objections, and trust levers — what they need to feel confident, not a feature list.",
    hero: "Angle the headline + subhead at this buyer's primary job-to-be-done and biggest bounce trigger. One promise they care about, stated plainly.",
  }[section] || '';

  // Step-4 recurring buyer gaps (fact-gated — include ONLY when the locked facts/source supply them).
  const buyerNeeds = [
    'A concrete PROCESS / what-happens-next sequence (call → inspection/quote → timeline → cleanup → warranty) — ONLY using steps present in the locked facts/source.',
    'Plain residential framing for a homeowner — avoid corporate-scale boasts ("largest", "large-scale") that make a single home feel too small.',
    'Specifics the buyer can verify over vague praise — name a checkable thing ONLY when it appears in the locked facts/source; otherwise use a neutral, non-claiming sentence rather than adjectives like "superior" or "quality".',
  ];

  return [
    '# BUYER PERSONA CONTEXT (psychology ONLY · LOWER AUTHORITY than the locked facts above)',
    '',
    `Primary buyer: ${seg.display_name || seg.id} (${seg.id})${resolved.fallback ? ' · default segment (brief did not specify)' : ''}`,
    `Job to be done: ${jtbd}`,
    triggers.length ? `Decision triggers (what makes them choose): ${triggers.join('; ')}` : null,
    risks.length ? `Risk concerns / objections to answer: ${risks.join('; ')}` : null,
    trust.length ? `Top trust levers: ${trust.join('; ')}` : null,
    bounce.length ? `Bounce / forbidden signals (avoid): ${bounce.join('; ')}` : null,
    (knows || doesNot) ? `Information state — knows: ${knows || '—'} · does NOT know: ${doesNot || '—'}` : null,
    `Voice for this buyer: ${tone}`,
    resolved.secondaryIds.length ? `Secondary buyers (do not alienate): ${resolved.secondaryIds.join(', ')}` : null,
    sectionLens ? `\nFor THIS section: ${sectionLens}` : null,
    '\nWhat this buyer looks for (include ONLY if present in the LOCKED FACTS or scraped source — never invent to satisfy these):',
    ...buyerNeeds.map((n) => `- ${n}`),
    '',
    'GUARD: Persona context is buyer psychology only. It may shape emphasis, order, objections, vocabulary,',
    'and CTA framing. It is NOT a source of business facts — do not create claims, credentials, response',
    'times, warranty terms, prices, project counts, team sizes, awards, locations, or licence facts from',
    'persona data. The LOCKED FACTS and scraped source are the only sources of truth; persona never overrides them.',
  ].filter((l) => l !== null).join('\n');
}

export default { resolvePersona, buildPersonaContextBlock };
