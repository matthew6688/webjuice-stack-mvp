/**
 * Reply classifier — takes an incoming customer reply, returns one of the 12
 * reply classes from DISCORD_OUTREACH_PRD.md §7.2.
 *
 * Uses regex + keyword heuristics first (fast, free, deterministic), falls
 * back to Claude CLI (haiku) for ambiguous cases.
 *
 * Returns { class, confidence, method, signal_excerpt }.
 */

import { REPLY_CLASSES } from '../sales/reply-playbook.js';

const PATTERNS = [
  // Strongest signals first
  { class: 'unsubscribe', re: /\b(unsubscribe|remove me|stop emailing|opt[- ]?out|do not contact|please stop|please remove)\b/i, confidence: 0.98 },
  { class: 'bounced', re: /(mailer-daemon|address (?:not found|rejected)|undelivered mail|delivery failure|550 5\.\d|recipient.*does not exist)/i, confidence: 0.99 },
  { class: 'no', re: /^\s*(no(?:,|\s+thanks|t interested)|we'?re not interested|not interested|please don'?t contact)\b/i, confidence: 0.9 },
  // Wrong-person referrals
  { class: 'wrong-person', re: /\b(wrong person|wrong contact|i'?m not the (?:right person|decision maker)|please contact (?:our manager|our owner|my (?:colleague|boss)))/i, confidence: 0.85 },
  { class: 'referred', re: /\b(my (?:friend|colleague) (?:[A-Z][a-z]+ ?){1,3}|i (?:can )?refer you to|talk to my)\b/i, confidence: 0.7 },
  // Objections (price / timing / scope)
  { class: 'objection-price', re: /\b(too (?:expensive|pricey|much)|out of (?:our|my) budget|can'?t afford|cheaper option|do you have a discount|reduce the price)\b/i, confidence: 0.85 },
  { class: 'objection-timing', re: /\b(not (?:the )?right time|too busy (?:right now|at the moment)|maybe (?:later|next quarter))\b/i, confidence: 0.8 },
  { class: 'objection-scope', re: /\b(don'?t need (?:the|a) (?:full|whole)|just need (?:the|a)|only (?:want|need)|skip the)\b/i, confidence: 0.75 },
  // Soft postpone
  { class: 'not-now', re: /\b(ask me (?:in|again|back|later)|reach me again|(?:in|after) (?:\d+|a few|several) (?:weeks?|months?)|circle back in|reach out (?:next quarter|later this year)|reschedule for|check back in)\b/i, confidence: 0.85 },
  // Questions about specifics
  { class: 'question', re: /\b(how (?:much|long)|what(?:'?s| is) (?:the price|the cost|included)|when (?:can|could) we|can you (?:tell me|explain|share))/i, confidence: 0.75 },
  // Positive interest
  { class: 'interested', re: /\b(sounds (?:good|interesting|great)|tell me more|interested|let'?s talk|book a call|set up a (?:call|meeting)|happy to chat|yes,? (?:please|let'?s))\b/i, confidence: 0.8 },
];

/**
 * Async-capable classifier with LLM fallback. Use this when you want the unclear
 * branch to be re-evaluated by a local model (T0 Ollama) before flagging human.
 *
 * Cheap path: regex returns high-confidence → return immediately, no LLM call.
 * Fallback path: regex returns unclear/low-confidence → call Ollama qwen3.5:9b
 *                with the same 12-class schema. Costs $0 (local).
 *
 * Synchronous classifyReply() below stays regex-only for legacy callers.
 */
export async function classifyReplyWithFallback(text) {
  const initial = classifyReply(text);
  if (initial.class !== 'unclear' && initial.confidence >= 0.5) return initial;

  // Lazy import so the sync path stays zero-dep
  const { runText } = await import('./text-adapter.js');
  const prompt = `You are classifying a customer email reply into one of 12 categories.

Categories: ${REPLY_CLASSES.join(', ')}

Reply text:
"""
${String(text || '').slice(0, 1500)}
"""

Output JSON ONLY (no prose) with these keys:
  - class: one of the 12 categories above
  - confidence: float 0-1
  - reason: 1-line explanation

If the reply is genuinely ambiguous output { "class": "unclear", "confidence": 0.4, "reason": "..." }`;

  const llm = await runText({
    prompt,
    tier: 'T0',
    purpose: 'reply_classification_fallback',
    stage: 'reply_handling',
  });
  if (!llm.ok || !llm.parsedJson?.class) return { ...initial, method: 'regex+llm_failed' };
  const cls = String(llm.parsedJson.class).trim();
  if (!REPLY_CLASSES.includes(cls)) return { ...initial, method: 'regex+llm_invalid_class', llm_response: cls };
  return {
    class: cls,
    confidence: Number(llm.parsedJson.confidence ?? 0.6),
    method: 'llm_fallback',
    signal_excerpt: String(llm.parsedJson.reason || '').slice(0, 120),
    provider: llm.provider,
    regex_initial: { class: initial.class, confidence: initial.confidence },
  };
}

export function classifyReply(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    return { class: 'unclear', confidence: 0.1, method: 'empty', signal_excerpt: '' };
  }

  // Pass 1: regex heuristics, return first high-confidence match
  const matches = [];
  for (const p of PATTERNS) {
    const m = trimmed.match(p.re);
    if (m) matches.push({ class: p.class, confidence: p.confidence, signal_excerpt: m[0] });
  }
  if (matches.length === 0) {
    return { class: 'unclear', confidence: 0.3, method: 'no_match', signal_excerpt: trimmed.slice(0, 60) };
  }
  matches.sort((a, b) => b.confidence - a.confidence);
  // If two top matches are equally high but different classes → unclear
  if (matches.length > 1 && matches[0].confidence === matches[1].confidence && matches[0].class !== matches[1].class) {
    return {
      class: 'unclear',
      confidence: 0.4,
      method: 'tie',
      signal_excerpt: `${matches[0].signal_excerpt} | ${matches[1].signal_excerpt}`,
      candidates: matches.slice(0, 3),
    };
  }
  return {
    class: matches[0].class,
    confidence: matches[0].confidence,
    method: 'regex',
    signal_excerpt: matches[0].signal_excerpt,
    candidates: matches.slice(0, 3),
  };
}

export { REPLY_CLASSES };
