/**
 * Codex CLI text-only adapter (paired with text-claude-cli and text-ollama).
 */

import { spawnSync } from 'child_process';
import { appendLedgerEvent, hashRequest } from '../finance/ledger.js';
import { tryExtractJson } from './vision-ollama.js';

const CLI = process.env.CODEX_CLI_PATH || 'codex';
const CODEX_PRICE_PER_M_INPUT_USD = 2.50;
const CODEX_PRICE_PER_M_OUTPUT_USD = 10.00;

export async function textCodexCli({
  prompt,
  ledgerPath,
  leadId,
  clientSlug,
  stage = 'text_analysis',
  purpose = 'text_analysis_codex_cli',
  campaignId,
  timeoutMs = 240_000,
} = {}) {
  if (!prompt) throw new Error('prompt required');
  const start = Date.now();
  const r = spawnSync(CLI, [
    'exec',
    '--skip-git-repo-check',
    '--sandbox', 'workspace-write',
    '--ignore-user-config',
    '--json',
    prompt,
  ], { encoding: 'utf8', timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 });
  const latencyMs = Date.now() - start;
  if (r.status !== 0 && !r.stdout) {
    return { ok: false, provider: 'codex_cli', reason: `exit ${r.status}: ${(r.stderr || '').slice(0, 200)}`, latencyMs };
  }

  let finalMessage = '';
  let usage = null;
  for (const line of r.stdout.split('\n')) {
    if (!line.trim().startsWith('{')) continue;
    try {
      const ev = JSON.parse(line);
      if (ev.type === 'item.completed' && ev.item?.type === 'agent_message') finalMessage = ev.item.text || finalMessage;
      else if (ev.type === 'turn.completed' && ev.usage) usage = ev.usage;
    } catch {}
  }
  if (!finalMessage) return { ok: false, provider: 'codex_cli', reason: 'no agent_message', latencyMs };

  const parsedJson = tryExtractJson(finalMessage);
  const inputTokens = usage?.input_tokens || 0;
  const outputTokens = usage?.output_tokens || 0;
  const theoreticalCost = (inputTokens / 1_000_000) * CODEX_PRICE_PER_M_INPUT_USD + (outputTokens / 1_000_000) * CODEX_PRICE_PER_M_OUTPUT_USD;

  if (ledgerPath || leadId || clientSlug) {
    const requestHash = await hashRequest({ provider: 'codex_cli', prompt });
    appendLedgerEvent({
      type: 'cost', category: 'openai', provider: 'codex_cli_subscription', tier: 'T1',
      leadId, clientSlug, stage, purpose, requestHash, campaignId,
      units: 1, unitCost: theoreticalCost, amount: 0, currency: process.env.ROI_CURRENCY || 'USD',
      metadata: {
        endpoint: 'cli_exec_text',
        prompt_chars: prompt.length, response_chars: finalMessage.length,
        input_tokens: inputTokens, output_tokens: outputTokens,
        cached_input_tokens: usage?.cached_input_tokens || 0,
        theoretical_cost_usd: theoreticalCost, actual_cost_usd: 0,
        duration_ms: latencyMs,
      },
    }, ledgerPath);
  }

  return {
    ok: true, provider: 'codex_cli',
    rawText: finalMessage, parsedJson, latencyMs,
    tokensIn: inputTokens, tokensOut: outputTokens,
    theoreticalCostUsd: theoreticalCost, costUsd: 0,
  };
}
