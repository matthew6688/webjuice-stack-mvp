/**
 * Unified vision adapter — dispatches to the best provider available.
 *
 * Default order (configurable via VISION_PROVIDER env var):
 *   1. claude_cli   — fastest + best quality, T1 subscription
 *   2. codex_cli    — backup T1 subscription
 *   3. ollama       — local T0 free, slowest, last resort
 *
 * Set VISION_PROVIDER to force a specific one. Set VISION_FALLBACK=true
 * (default) to auto-fall-through on errors.
 *
 * All providers share the same call signature and return the same shape,
 * so caller code is provider-agnostic:
 *
 *   const out = await runVision({ prompt, imagePaths, leadId, ... });
 *   out.parsedJson    // the JSON the LLM returned
 *   out.provider      // which provider answered
 *   out.latencyMs
 */

import { visionOllama } from './vision-ollama.js';
import { visionClaudeCli } from './vision-claude-cli.js';
import { visionCodexCli } from './vision-codex-cli.js';

const DEFAULT_PRIORITY = ['claude_cli', 'codex_cli', 'ollama'];

function pickProviders() {
  const forced = process.env.VISION_PROVIDER;
  if (forced) {
    const fallback = process.env.VISION_FALLBACK !== 'false';
    if (!fallback) return [forced];
    // Forced first, but allow fallback chain
    return [forced, ...DEFAULT_PRIORITY.filter((p) => p !== forced)];
  }
  return DEFAULT_PRIORITY;
}

async function callProvider(name, opts) {
  switch (name) {
    case 'claude_cli': return visionClaudeCli(opts);
    case 'codex_cli':  return visionCodexCli(opts);
    case 'ollama': {
      // ollama expects a `model` argument
      const model = opts.model || process.env.OLLAMA_VISION_MODEL || 'qwen3.6:27b';
      const out = await visionOllama({
        ...opts,
        model,
        think: opts.think !== undefined ? opts.think : false,
      });
      return { ...out, provider: 'ollama' };
    }
    default: return { ok: false, provider: name, reason: `unknown provider: ${name}` };
  }
}

export async function runVision(opts = {}) {
  const providers = pickProviders();
  const attempts = [];
  for (const name of providers) {
    try {
      const out = await callProvider(name, opts);
      attempts.push({ provider: name, ok: out.ok !== false, latencyMs: out.latencyMs, reason: out.reason });
      if (out.parsedJson && Object.keys(out.parsedJson).length > 0) {
        return { ...out, attempts };
      }
      // If JSON parsing fails but call succeeded, try next provider
      attempts[attempts.length - 1].note = 'no parseable JSON in response';
    } catch (err) {
      attempts.push({ provider: name, ok: false, reason: err.message });
    }
  }
  return {
    ok: false,
    reason: `all ${providers.length} providers failed`,
    attempts,
    provider: null,
    rawText: '',
    parsedJson: null,
    latencyMs: 0,
  };
}
