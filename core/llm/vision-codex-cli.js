/**
 * Codex CLI vision adapter.
 *
 * Runs `codex exec --json` as a subprocess and parses the streaming JSON
 * event log. The final response is in the last `item.completed` event with
 * type=agent_message; the `turn.completed` event has usage.
 *
 * Tier T1 (subscription-covered). Records token counts + computed
 * theoretical cost (OpenAI rates).
 *
 * Benchmark: ~40s on 1440x900 screenshot, slightly noisier (deprecation
 * warnings on stderr) but functional.
 */

import { spawnSync } from 'child_process';
import path from 'path';
import { appendLedgerEvent, hashRequest } from '../finance/ledger.js';
import { tryExtractJson } from './vision-ollama.js';

const CLI = process.env.CODEX_CLI_PATH || 'codex';

// Rough OpenAI o1 / GPT-5 token pricing (used for theoretical cost when in subscription)
// Adjust as needed. These are "what would it cost on metered API" estimates.
const CODEX_PRICE_PER_M_INPUT_USD = 2.50;   // o1-mini-ish rate
const CODEX_PRICE_PER_M_OUTPUT_USD = 10.00;

export async function visionCodexCli({
  prompt,
  imagePaths = [],
  ledgerPath,
  leadId,
  clientSlug,
  stage = 'visual_audit',
  purpose = 'visual_audit_codex_cli',
  campaignId,
  timeoutMs = 240_000,
} = {}) {
  if (!prompt) throw new Error('prompt is required');
  if (!imagePaths.length) throw new Error('at least one imagePath required');

  const abs = imagePaths.map((p) => path.resolve(p));
  const promptWithImages = imagePaths.length === 1
    ? `${prompt}\n\nImage to analyze: ${abs[0]}`
    : `${prompt}\n\nImages:\n${abs.map((p, i) => `  ${i + 1}. ${p}`).join('\n')}`;

  const start = Date.now();
  // Lean: --ignore-user-config skips ~/.codex/config.toml (which is where
  // MCP servers + skill paths + plugins are configured). Stable, no
  // "skill load failed" warnings, deterministic context.
  const r = spawnSync(CLI, [
    'exec',
    '--skip-git-repo-check',
    '--sandbox', 'workspace-write',
    '--ignore-user-config',
    '--json',
    promptWithImages,
  ], {
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 10 * 1024 * 1024,
  });
  const latencyMs = Date.now() - start;

  if (r.status !== 0 && !r.stdout) {
    return {
      ok: false,
      provider: 'codex_cli',
      reason: `CLI exit ${r.status}: ${(r.stderr || '').slice(0, 200)}`,
      latencyMs,
    };
  }

  // Parse streaming JSON events (one per line)
  let finalMessage = '';
  let usage = null;
  for (const line of r.stdout.split('\n')) {
    if (!line.trim().startsWith('{')) continue;
    try {
      const ev = JSON.parse(line);
      if (ev.type === 'item.completed' && ev.item?.type === 'agent_message') {
        finalMessage = ev.item.text || finalMessage;
      } else if (ev.type === 'turn.completed' && ev.usage) {
        usage = ev.usage;
      }
    } catch {}
  }

  if (!finalMessage) {
    return { ok: false, provider: 'codex_cli', reason: 'no agent_message in output', latencyMs };
  }

  const parsedJson = tryExtractJson(finalMessage);

  const inputTokens = usage?.input_tokens || 0;
  const outputTokens = usage?.output_tokens || 0;
  const theoreticalCost = (inputTokens / 1_000_000) * CODEX_PRICE_PER_M_INPUT_USD
                       + (outputTokens / 1_000_000) * CODEX_PRICE_PER_M_OUTPUT_USD;

  if (ledgerPath || leadId || clientSlug) {
    const requestHash = await hashRequest({ provider: 'codex_cli', prompt, imageCount: imagePaths.length });
    appendLedgerEvent({
      type: 'cost',
      category: 'openai',
      provider: 'codex_cli_subscription',
      tier: 'T1',
      leadId, clientSlug, stage, purpose,
      requestHash,
      campaignId,
      units: 1,
      unitCost: theoreticalCost,
      amount: 0,
      currency: process.env.ROI_CURRENCY || 'USD',
      metadata: {
        endpoint: 'cli_exec_json',
        image_count: imagePaths.length,
        prompt_chars: prompt.length,
        response_chars: finalMessage.length,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cached_input_tokens: usage?.cached_input_tokens || 0,
        reasoning_output_tokens: usage?.reasoning_output_tokens || 0,
        theoretical_cost_usd: theoreticalCost,
        actual_cost_usd: 0,
        duration_ms: latencyMs,
      },
    }, ledgerPath);
  }

  return {
    ok: true,
    provider: 'codex_cli',
    rawText: finalMessage,
    parsedJson,
    latencyMs,
    tokensIn: inputTokens,
    tokensOut: outputTokens,
    theoreticalCostUsd: theoreticalCost,
    costUsd: 0,
  };
}
