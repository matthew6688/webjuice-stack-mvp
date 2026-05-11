/**
 * Claude Code CLI text-only adapter — for tasks like review analysis,
 * content classification, summary that don't need vision.
 *
 * Same lean flags as vision-claude-cli (no skills / no MCP / no settings)
 * so subprocess is deterministic and fast. Tier T1 (subscription).
 */

import { spawnSync } from 'child_process';
import { appendLedgerEvent, hashRequest } from '../finance/ledger.js';
import { tryExtractJson } from './vision-ollama.js';

const CLI = process.env.CLAUDE_CLI_PATH || 'claude';

export async function textClaudeCli({
  prompt,
  model = process.env.CLAUDE_CLI_MODEL || 'sonnet',
  ledgerPath,
  leadId,
  clientSlug,
  stage = 'text_analysis',
  purpose = 'text_analysis_claude_cli',
  campaignId,
  timeoutMs = 240_000,
} = {}) {
  if (!prompt) throw new Error('prompt required');

  const start = Date.now();
  const r = spawnSync(CLI, [
    '--print',
    '--output-format', 'json',
    '--model', model,
    '--permission-mode', 'bypassPermissions',
    '--no-session-persistence',
    '--disable-slash-commands',
    '--strict-mcp-config',
    '--mcp-config', '{"mcpServers":{}}',
    '--setting-sources', '',
  ], {
    input: prompt,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 10 * 1024 * 1024,
  });
  const latencyMs = Date.now() - start;

  if (r.status !== 0) {
    return { ok: false, provider: 'claude_cli', reason: `CLI exit ${r.status}: ${(r.stderr || '').slice(0, 200)}`, latencyMs };
  }
  let parsed;
  try { parsed = JSON.parse(r.stdout); }
  catch { return { ok: false, provider: 'claude_cli', reason: 'CLI JSON parse failed', latencyMs }; }

  const resultText = parsed?.result || '';
  const parsedJson = tryExtractJson(resultText);
  const usage = parsed?.usage || {};
  const modelUsedKey = Object.keys(parsed?.modelUsage || {})[0] || 'claude_unknown';
  const modelUsage = parsed?.modelUsage?.[modelUsedKey] || {};
  const costUsd = Number(parsed?.total_cost_usd || modelUsage.costUSD || 0);

  if (ledgerPath || leadId || clientSlug) {
    const requestHash = await hashRequest({ provider: 'claude_cli', model: modelUsedKey, prompt });
    appendLedgerEvent({
      type: 'cost',
      category: 'anthropic',
      provider: 'claude_cli_subscription',
      tier: 'T1',
      leadId, clientSlug, stage, purpose,
      requestHash,
      campaignId,
      units: 1,
      unitCost: costUsd,
      amount: 0,
      currency: process.env.ROI_CURRENCY || 'USD',
      metadata: {
        endpoint: 'cli_print_text',
        model: modelUsedKey,
        model_requested: model,
        prompt_chars: prompt.length,
        response_chars: resultText.length,
        input_tokens: usage.input_tokens || modelUsage.inputTokens || 0,
        output_tokens: usage.output_tokens || modelUsage.outputTokens || 0,
        cache_read_tokens: usage.cache_read_input_tokens || modelUsage.cacheReadInputTokens || 0,
        cache_creation_tokens: usage.cache_creation_input_tokens || modelUsage.cacheCreationInputTokens || 0,
        theoretical_cost_usd: costUsd,
        actual_cost_usd: 0,
        duration_ms: parsed?.duration_ms || latencyMs,
      },
    }, ledgerPath);
  }

  return {
    ok: true,
    provider: 'claude_cli',
    model: modelUsedKey,
    rawText: resultText,
    parsedJson,
    latencyMs,
    tokensIn: usage.input_tokens || modelUsage.inputTokens || 0,
    tokensOut: usage.output_tokens || modelUsage.outputTokens || 0,
    theoreticalCostUsd: costUsd,
    costUsd: 0,
  };
}
