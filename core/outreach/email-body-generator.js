/**
 * Email body generator — replaces static variant template substitution with
 * per-lead AI-generated subject + body.
 *
 * Routing decided by P2.3 LLM eval (data/qa/p2-llm-routing-decision.md):
 *   - grade=A → sonnet via claude_cli (T3, ~$0.26 actual cost = subs)
 *   - grade=B/C → haiku via claude_cli (T1, ~$0.05 actual cost = subs)
 *   - fallback (offline/quota exhausted) → qwen3.5:9b local with body_warning
 *     flag set so operator knows to review carefully
 *
 * Local models (qwen3.5:9b, deepseek-r1:14b) fabricate specifics for
 * customer-facing cold outreach. They're unsafe for unsupervised send.
 *
 * Output schema:
 *   { ok, subject, body, personalization_notes, tier, model, latency_ms,
 *     tokens, body_warning? }
 */

import { textClaudeCli } from '../llm/text-claude-cli.js';
import { textOllama } from '../llm/text-ollama.js';
import { readDetailedAudit } from '../funnel/lead-thread-helpers.js';
import { getVariant } from './variant-picker.js';

function buildPrompt(entity, variant) {
  const audit = readDetailedAudit(entity.entityKey)?.detailed_audit;
  const latest = entity.latest || {};
  const findings = (audit?.findings || []).slice(0, 5).map((f, i) => `  ${i + 1}. ${f.label || f.id} — ${f.impact || ''}`).join('\n');
  return `Write a personalized cold outreach email for this lead. Use the variant tone + hypothesis as guide, but make every concrete claim grounded in the AUDIT findings + visible site details — do NOT invent features the site doesn't have.

LEAD:
- Business: ${latest.name}
- Niche: ${latest.niche}
- City: ${latest.city}
- Website: ${latest.website} (${latest.websiteStatus})
- Reviews: ${latest.review_count}★${latest.rating}
- Phone: ${latest.phone}
- Audit score: ${audit?.audit_score}/100 — ${audit?.decision}
- Top findings:
${findings || '  (no findings)'}

VARIANT GUIDE:
- Subject template: ${variant.subject_template}
- Tone: ${variant.tone}
- Hypothesis: ${variant.hypothesis}

RULES:
- Reference only facts visible in LEAD section. Don't invent suburbs, features, integrations, etc.
- Body ≤ 200 words.
- No "[Name]" placeholders — use the real business name or omit.
- Sign as "— Matthew" (no fake signature).

Output JSON ONLY (no prose) with these keys:
  - subject: subject line (max 70 chars)
  - body: email body (max 200 words), plain text
  - personalization_notes: 1 sentence on what concrete facts you referenced from LEAD`;
}

/**
 * Generate email subject + body for an entity.
 *
 * @param {object} entity        - V2 entity (must have latest, grade)
 * @param {string} variantId     - variant id from data/outreach/variants/
 * @param {object} opts
 * @param {string} [opts.tier]   - 'auto' (default, picks by grade) | 'T0' | 'T1' | 'T3'
 * @returns {Promise<{ok, subject, body, ...}>}
 */
export async function generateEmailBody(entity, variantId, opts = {}) {
  const variant = getVariant(variantId);
  if (!variant) return { ok: false, reason: `variant not found: ${variantId}` };
  const prompt = buildPrompt(entity, variant);
  const grade = entity.grade?.investment_level;

  let tier = opts.tier || 'auto';
  if (tier === 'auto') {
    tier = grade === 'A' ? 'T3' : 'T1';  // A → sonnet; B/C → haiku
  }

  const t0 = Date.now();
  let attempt;
  if (tier === 'T3' || tier === 'T1') {
    const model = tier === 'T3' ? 'sonnet' : 'haiku';
    attempt = await textClaudeCli({ prompt, model, purpose: 'cold_email_body_gen', stage: 'outreach', leadId: entity.entityKey });
    if (attempt?.parsedJson) {
      return {
        ok: true,
        subject: attempt.parsedJson.subject,
        body: attempt.parsedJson.body,
        personalization_notes: attempt.parsedJson.personalization_notes,
        tier,
        provider: 'claude_cli',
        model,
        latency_ms: Date.now() - t0,
        tokens: { in: attempt.tokensIn, out: attempt.tokensOut },
        cost_usd_theoretical: attempt.theoreticalCostUsd,
        body_warning: null,
      };
    }
    // CLI failed → fall through to T0 with warning
  }

  // T0 (local) — used as fallback or when explicit
  const ollama = await textOllama({ prompt, model: 'qwen3.5:9b', think: false });
  if (ollama?.parsedJson) {
    return {
      ok: true,
      subject: ollama.parsedJson.subject,
      body: ollama.parsedJson.body,
      personalization_notes: ollama.parsedJson.personalization_notes,
      tier: 'T0',
      provider: 'ollama',
      model: 'qwen3.5:9b',
      latency_ms: Date.now() - t0,
      tokens: { in: ollama.tokensIn, out: ollama.tokensOut },
      cost_usd_theoretical: 0,
      body_warning: tier !== 'T0'
        ? 'CLAUDE_CLI_UNAVAILABLE_USED_LOCAL — local models hallucinate specifics in cold outreach. REVIEW BEFORE SEND.'
        : null,
    };
  }

  return {
    ok: false,
    reason: 'all_providers_failed',
    attempts: [
      tier !== 'T0' ? `claude_cli ${tier === 'T3' ? 'sonnet' : 'haiku'}: ${attempt?.reason || 'no_json'}` : null,
      `ollama qwen3.5:9b: ${ollama?.reason || 'no_json'}`,
    ].filter(Boolean),
  };
}
