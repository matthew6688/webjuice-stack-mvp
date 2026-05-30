/**
 * core/enrichment/identity/resolve-identity.js · tiered identity resolver (SPEC-IDENTITY-RESOLUTION · codex R134).
 *
 * PURE DECISION LAYER. "Is this candidate/page the SAME business as the target?" Runs cheapest tier first,
 * escalates on ambiguity. Returns a unified verdict. It does NOT fetch, search, or WRITE — callers do that.
 *
 * ⚠️ CANONICAL WRITES ARE STRUCTURALLY OUT OF SCOPE (codex R134):
 *  - this module imports ONLY the judges (identity-match · match-judge) — NEVER an entity store / writer.
 *  - every verdict carries `write_allowed: false`. Promotion to canonical is a SEPARATE, clearance-gated
 *    step that lives elsewhere and is not reachable from here. (test asserts no writer imports + write_allowed false.)
 *
 * Promotion rule: `promotable === true` can ONLY come from tier0 (deterministic verified) or tier2
 * (judgePageIdentity with deterministically-verified strong evidence). tier1 (URL/snippet triage) NEVER promotes.
 */
import { buildAnchors, matchIdentity } from '../identity-match.js';
import { judgePageIdentity, judgeEnrichmentMatches } from '../../llm/match-judge.js';

function verdict(o) {
  return {
    status: 'ambiguous', promotable: false, tier_used: 'deterministic', confidence: 0,
    reasons: [], evidence: [], conflicts: [], source_policy: 'unknown', model: null, prompt_version: null,
    write_allowed: false, // codex R134: canonical writes are NOT reachable from this module
    ...o,
  };
}

/**
 * @param {{ entity, candidate?, page?, sourceContext? }} input
 *   candidate: structured looked-up record { source, name, abn, phone, address, state, domain, url, title, abrScore }
 *   page: a fetched page { url, text, fetch_via } for tier2 content judging
 * @param {object} [opts] passthrough to the LLM judges (e.g. { runner } for tests/model-pinning)
 */
export async function resolveIdentity({ entity, candidate = {}, page = null, sourceContext = {} } = {}, opts = {}) {
  const reasons = [];
  const source_policy = candidate.source || (page ? 'page' : 'unknown');
  if (!entity) return verdict({ reasons: ['no entity'], source_policy });

  // ── tier0 · deterministic anchors (cheapest) ──
  const anchors = buildAnchors(entity);
  const t0 = matchIdentity(anchors, candidate, opts);
  reasons.push(`tier0:${t0.status}:${t0.reason}`);
  if (t0.status === 'verified') {
    return verdict({ status: 'same', promotable: true, tier_used: 'deterministic', confidence: 0.95, reasons, evidence: t0.matched, source_policy });
  }
  if (t0.conflicts && t0.conflicts.length) {
    return verdict({ status: 'different', promotable: false, tier_used: 'deterministic', confidence: 0.8, reasons, conflicts: t0.conflicts, source_policy });
  }

  // ── tier2 · page-content LLM (if a fetched page is available) — can promote (verified strong evidence) ──
  if (page && page.text) {
    const t2 = await judgePageIdentity({ entity, page, sourceContext }, opts);
    reasons.push(`tier2:${t2.status}:${t2.reason || ''}`);
    return verdict({
      status: t2.status, promotable: t2.promotable, tier_used: 'page_llm', confidence: t2.confidence,
      reasons, evidence: t2.evidence, conflicts: t2.conflicts, source_policy, model: t2.model, prompt_version: t2.prompt_version,
    });
  }

  // ── tier1 · URL/snippet triage (if a URL but no page) — routes only, NEVER promotes (needs page confirm) ──
  if (candidate.url) {
    let tier1;
    try { tier1 = await judgeEnrichmentMatches({ entity: entity.latest || entity, candidates: [{ url: candidate.url, title: candidate.title || candidate.name || '' }] }); }
    catch (e) { return verdict({ status: 'ambiguous', tier_used: 'search_llm', reasons: [...reasons, `tier1 error: ${String(e.message).slice(0, 80)}`], source_policy }); }
    const v = (tier1 && tier1[0]) || {};
    reasons.push(`tier1:${v.matches}:${(v.reason || '').slice(0, 60)}`);
    const status = v.matches === 'yes' ? 'same' : v.matches === 'no' ? 'different' : 'ambiguous';
    // promotable stays FALSE — a URL/snippet match must be confirmed by tier2 page content before canonical.
    return verdict({ status, promotable: false, tier_used: 'search_llm', confidence: typeof v.confidence === 'number' ? v.confidence : 0, reasons, source_policy });
  }

  // nothing to escalate on
  return verdict({ status: 'ambiguous', tier_used: 'deterministic', reasons: [...reasons, 'no page/url to escalate'], source_policy });
}

export default { resolveIdentity };
