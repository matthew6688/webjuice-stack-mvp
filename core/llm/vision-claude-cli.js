/**
 * Claude Code CLI vision adapter.
 *
 * Runs `claude --print --output-format=json` as a subprocess with the image
 * path inline in the prompt. Claude Code accepts file paths in prompts and
 * reads them with vision automatically.
 *
 * Tier T1 (subscription-covered). We still record token usage + the
 * theoretical $ cost so we can monitor consumption against subscription
 * quota.
 *
 * Benchmark vs Ollama qwen3.6:27b: ~35s vs ~87s on 1440x900 screenshot.
 * Response is also ~2x richer (more detailed JSON).
 */

import { spawnSync } from 'child_process';
import path from 'path';
import { appendLedgerEvent, hashRequest } from '../finance/ledger.js';
import { tryExtractJson } from './vision-ollama.js';

const CLI = process.env.CLAUDE_CLI_PATH || 'claude';

export async function visionClaudeCli({
  prompt,
  imagePaths = [],
  model = process.env.CLAUDE_CLI_MODEL || 'sonnet',  // sonnet = cheaper + faster than opus for vision audit
  ledgerPath,
  leadId,
  clientSlug,
  stage = 'visual_audit',
  purpose = 'visual_audit_claude_cli',
  campaignId,
  timeoutMs = 240_000,
} = {}) {
  if (!prompt) throw new Error('prompt is required');
  if (!imagePaths.length) throw new Error('at least one imagePath required');

  // Resolve absolute paths so Claude can find them
  const abs = imagePaths.map((p) => path.resolve(p));
  const promptWithImages = imagePaths.length === 1
    ? `${prompt}\n\nImage to analyze: ${abs[0]}`
    : `${prompt}\n\nImages to analyze (in order):\n${abs.map((p, i) => `  ${i + 1}. ${p}`).join('\n')}`;

  const start = Date.now();
  const r = spawnSync(CLI, [
    '--print',
    '--output-format', 'json',
    '--model', model,
    '--permission-mode', 'bypassPermissions',
    '--no-session-persistence',
  ], {
    input: promptWithImages,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 10 * 1024 * 1024,
  });
  const latencyMs = Date.now() - start;

  if (r.status !== 0) {
    return {
      ok: false,
      provider: 'claude_cli',
      reason: `CLI exit ${r.status}: ${(r.stderr || '').slice(0, 200)}`,
      latencyMs,
    };
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
    const requestHash = await hashRequest({ provider: 'claude_cli', model: modelUsedKey, prompt, imageCount: imagePaths.length });
    appendLedgerEvent({
      type: 'cost',
      category: 'anthropic',
      provider: 'claude_cli_subscription',
      tier: 'T1',
      leadId, clientSlug, stage, purpose,
      requestHash,
      campaignId,
      units: 1,
      // costUsd here is the "theoretical metered cost"; we're paying via
      // subscription so out-of-pocket is $0, but tracking helps monitor
      // monthly subscription burn.
      unitCost: costUsd,
      amount: 0,                  // actual out-of-pocket: 0 (subscription)
      currency: process.env.ROI_CURRENCY || 'USD',
      metadata: {
        endpoint: 'cli_print',
        model: modelUsedKey,
        model_requested: model,
        image_count: imagePaths.length,
        prompt_chars: prompt.length,
        response_chars: resultText.length,
        input_tokens: usage.input_tokens || modelUsage.inputTokens || 0,
        output_tokens: usage.output_tokens || modelUsage.outputTokens || 0,
        cache_read_tokens: usage.cache_read_input_tokens || modelUsage.cacheReadInputTokens || 0,
        cache_creation_tokens: usage.cache_creation_input_tokens || modelUsage.cacheCreationInputTokens || 0,
        theoretical_cost_usd: costUsd,     // for monitoring vs subscription
        actual_cost_usd: 0,                // out-of-pocket
        duration_ms: parsed?.duration_ms || latencyMs,
        api_duration_ms: parsed?.duration_api_ms || null,
        session_id: parsed?.session_id || null,
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
    cacheReadTokens: usage.cache_read_input_tokens || 0,
    theoreticalCostUsd: costUsd,
    costUsd: 0,            // subscription = $0 out-of-pocket
  };
}
