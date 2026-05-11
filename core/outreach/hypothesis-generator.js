/**
 * Hypothesis generator — given a variant draft (subject + body + tone),
 * asks Claude CLI (haiku) for a 1-2 sentence hypothesis statement.
 *
 * D5 + D11: hypothesis must be present on every variant. AI auto-generates so
 * operator doesn't have to write each one by hand.
 */

import { runText } from '../llm/text-adapter.js';

const PROMPT_TEMPLATE = `You are writing a cold-outreach experimentation hypothesis for a variant test.

Given:
- subject_template: {{subject}}
- tone: {{tone}}
- body excerpt: {{body_excerpt}}
- target cohort hint: {{cohort_hint}}

Output JSON ONLY (no prose), with these keys:
  - hypothesis: 1-2 sentences stating what you expect this variant to outperform (the current baseline) and WHY, including the specific axis being tested
  - primary_metric: the single quantitative metric this hypothesis should be judged on (e.g. "reply_rate_grade_a_roofing", "open_rate", "ctr_to_audit_page")

Example:
{
  "hypothesis": "Audit-led opening with 3 concrete technical findings should boost reply rate vs generic sales pitch by 5pp for grade-A roofing leads, because owners trust evidence over claims.",
  "primary_metric": "reply_rate_grade_a_roofing"
}
`;

export async function generateHypothesis({
  subject,
  body,
  tone = 'neutral',
  cohort_hint = 'grade-A roofing',
  dryRun = false,
} = {}) {
  const bodyExcerpt = String(body || '').slice(0, 500);
  const prompt = PROMPT_TEMPLATE
    .replace('{{subject}}', subject)
    .replace('{{tone}}', tone)
    .replace('{{body_excerpt}}', bodyExcerpt)
    .replace('{{cohort_hint}}', cohort_hint);

  if (dryRun) {
    return {
      ok: true,
      dry_run: true,
      hypothesis: `[dry-run hypothesis] ${tone} tone targeting ${cohort_hint} for variant subject "${subject.slice(0, 40)}"`,
      primary_metric: `reply_rate_${cohort_hint.replace(/\s+/g, '_')}`,
      prompt_preview: prompt.slice(0, 200),
    };
  }

  // T0 tier (local Ollama first; CLI fallback only if Ollama fails)
  // Hypothesis writing is creative-but-not-customer-facing — perfect for local model.
  const r = await runText({
    prompt,
    tier: 'T0',
    purpose: 'variant_hypothesis_generation',
    stage: 'variant_design',
  });
  if (!r.ok) return { ok: false, reason: r.reason };
  const json = r.parsedJson;
  if (!json?.hypothesis || !json?.primary_metric) {
    return { ok: false, reason: 'no_parsed_json', raw: r.rawText?.slice(0, 200) };
  }
  return {
    ok: true,
    hypothesis: json.hypothesis,
    primary_metric: json.primary_metric,
    provider: r.provider,
    model: r.model,
    tokens: { in: r.tokensIn || 0, out: r.tokensOut || 0 },
    latency_ms: r.latencyMs,
  };
}
