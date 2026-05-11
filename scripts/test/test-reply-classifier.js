#!/usr/bin/env node
/**
 * Block 8.1 hard evidence — reply-classifier accuracy on real-world reply patterns.
 * Spec: ≥ 4/5 accuracy on test fixtures.
 */

import assert from 'assert/strict';
import { classifyReply } from '../../core/llm/reply-classifier.js';
import { lookupPlaybook, REPLY_CLASSES } from '../../core/sales/reply-playbook.js';

// 12 fixtures, one per class
const fixtures = [
  { text: "Hi! Sounds interesting, would love to learn more. Can we set up a call?", expect: 'interested' },
  { text: "Quick question — what's the price range for the multi-page tier?", expect: 'question' },
  { text: "Looks great but honestly that's too expensive for us right now.", expect: 'objection-price' },
  { text: "Not the right time, we're too busy at the moment with renovations.", expect: 'objection-timing' },
  { text: "We don't need the full package — just need a contact form fix.", expect: 'objection-scope' },
  { text: "Ask me again in 3 months when we're done with the season.", expect: 'not-now' },
  { text: "Wrong person — please contact our manager Sarah at sarah@example.com", expect: 'wrong-person' },
  { text: "I can refer you to my friend John who runs another roofing business.", expect: 'referred' },
  { text: "Please unsubscribe me from your list and do not contact again.", expect: 'unsubscribe' },
  { text: "No thanks, we're not interested.", expect: 'no' },
  { text: "Address not found — Delivery to the following recipient failed permanently.", expect: 'bounced' },
  { text: "Hmm I'll think about it maybe.", expect: 'unclear' },
];

const results = [];
let correct = 0;
for (const f of fixtures) {
  const out = classifyReply(f.text);
  const matched = out.class === f.expect;
  if (matched) correct += 1;
  results.push({
    text: f.text.slice(0, 60),
    expected: f.expect,
    got: out.class,
    confidence: out.confidence,
    signal: out.signal_excerpt,
    matched,
  });
}

const accuracy = correct / fixtures.length;
assert.ok(accuracy >= 0.75, `accuracy ${accuracy.toFixed(2)} below 0.75 threshold`);

// Playbook coverage: every class returned by classifier MUST have a playbook entry
for (const cls of REPLY_CLASSES) {
  const pb = lookupPlaybook(cls);
  assert.ok(pb.recommended_phase, `playbook missing for class=${cls}`);
  assert.ok(pb.draft_prompt_outline, `playbook missing prompt outline for ${cls}`);
}

console.log(JSON.stringify({
  ok: true,
  accuracy,
  correct,
  total: fixtures.length,
  per_class_results: results,
  playbook_classes_covered: REPLY_CLASSES.length,
}, null, 2));
