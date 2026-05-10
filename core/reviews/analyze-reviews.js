/**
 * Analyze a lead's Google reviews via local Ollama (T0 free).
 *
 * Input: { reviews: [{ author_name, rating, text, ... }], rating, review_count, business_name, niche }
 * Output: structured JSON with themes, quotable highlights, redesign hooks.
 *
 * Why Ollama qwen-nothink: review analysis is structured-extraction, not
 * reasoning — qwen3.x family with thinking off produces clean JSON in
 * 30-60s on Mac mini. See feedback_qwen_disable_thinking memory.
 */

import { textOllama } from '../llm/text-ollama.js';

const DEFAULT_MODEL = process.env.REVIEW_OLLAMA_MODEL || 'qwen3.6:27b';

function buildPrompt({ reviews, rating, review_count, business_name, niche }) {
  const reviewBlock = reviews.map((r, i) => `Review ${i + 1} (${r.rating}★, by ${r.author_name || 'anonymous'}, ${r.relative_time || ''}):\n${r.text || '(no text)'}`).join('\n\n---\n\n');

  return `You are auditing the customer reviews of a local business. Output STRICT JSON only — no prose, no markdown fence.

Business: ${business_name}
Niche: ${niche}
Overall rating: ${rating}★ across ${review_count} reviews
Sample reviews shown below (Google's "most relevant"):

${reviewBlock}

Return JSON with this exact shape:
{
  "summary": "1-2 sentence plain-language read of how customers actually feel",
  "positive_themes": ["3-6 short phrases — what customers consistently praise"],
  "negative_themes": ["1-4 short phrases — complaints or weak spots, [] if none"],
  "quotable_for_redesign": [
    { "quote": "exact short snippet (under 25 words)", "author": "first name", "rating": 5, "why_useful": "what redesign element this supports — testimonials section, hero proof, etc" }
  ],
  "trust_signal_strength": "strong | moderate | weak",
  "owner_reply_observations": "brief note on whether replies are visible / professional / missing — best guess from the data",
  "redesign_hooks": ["2-4 specific suggestions: which review themes to surface where on the site"]
}

Rules:
- Pick 3-5 quotable reviews max. Prefer concrete, specific praise over generic "great service".
- Trim quotes — never include the author's name inside the quote field.
- positive_themes / negative_themes use kebab-case-ish short phrases (e.g. "fast turnaround", "punctual crew").
- If reviews are too few/sparse to judge, set trust_signal_strength to "weak" and explain in summary.

/no_think`;
}

export async function analyzeReviews({
  reviews,
  rating,
  review_count,
  business_name,
  niche,
  model = DEFAULT_MODEL,
  ledgerPath,
  leadId,
  clientSlug,
} = {}) {
  if (!reviews?.length) {
    return {
      ok: false,
      reason: 'no reviews to analyze',
      analysis: null,
    };
  }

  const prompt = buildPrompt({ reviews, rating, review_count, business_name, niche });
  const out = await textOllama({
    model,
    prompt,
    think: false,
    ledgerPath,
    leadId,
    clientSlug,
    stage: 'review_mining',
    purpose: 'review_analysis',
  });

  return {
    ok: Boolean(out.parsedJson),
    model,
    latencyMs: out.latencyMs,
    analysis: out.parsedJson,
    rawText: out.parsedJson ? null : out.rawText?.slice(0, 1000),
  };
}
