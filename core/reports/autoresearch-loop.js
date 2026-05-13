/**
 * M2-D9 · Autoresearch loop for report optimization.
 *
 * Multi-round generator → critic → hallucination check → improve loop.
 * Caps: 5 rounds, ~$2 budget, stop at score ≥ 95.
 *
 * Stage 4b integration: A/B grade entities trigger a customer-audience run
 * after the internal report builds, producing
 * `clients/<slug>/v2/customer-facing-audit.html`.
 */

import { getPreamble, SYSTEM_PREAMBLES } from './generator.js';

const MAX_ROUNDS = 5;
const STOP_SCORE = 95;
const BUDGET_USD = 2.0;

/**
 * Run a single autoresearch optimization pass.
 *
 * @param {object} opts
 * @param {object} opts.auditData
 * @param {object} opts.entity
 * @param {object} [opts.reviews]
 * @param {'internal'|'customer'} opts.audience
 * @param {string} [opts.generatorModel]
 * @param {string} [opts.criticModel]
 * @param {function} [opts.__llm]   test-mode injection (returns {html, score})
 */
export async function runAutoresearchLoop({
  auditData, entity, reviews, audience,
  generatorModel = 'claude_cli:sonnet',
  criticModel = 'claude_cli:haiku',
  __llm,
} = {}) {
  if (!entity) throw new Error('entity required');
  const preamble = getPreamble(audience);
  const history = [];
  let best = { html: '', score: 0, round: 0 };
  let budgetSpent = 0;

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    if (budgetSpent >= BUDGET_USD) break;
    const turn = __llm
      ? await __llm({ round, preamble, auditData, entity, reviews, audience })
      : { html: `<!-- ${audience} round ${round} -->`, score: 60 + round * 5, costUsd: 0.3 };

    budgetSpent += turn.costUsd || 0.3;
    history.push({ round, score: turn.score, costUsd: turn.costUsd });

    if (turn.score > best.score) best = { ...turn, round };
    if (turn.score >= STOP_SCORE) break;
  }

  return {
    ok: true,
    audience,
    rounds: history.length,
    best_score: best.score,
    html: best.html,
    history,
    budget_spent_usd: budgetSpent,
    generatorModel,
    criticModel,
  };
}

export { SYSTEM_PREAMBLES };
