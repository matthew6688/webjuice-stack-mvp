/**
 * Unified TEXT adapter — dispatches text-only LLM calls to the right tier.
 *
 * Tiers (memory rule "V2 Cost Discipline"):
 *   T0  local Ollama (free, runs on Mac GPU)
 *   T1  Claude/Codex CLI subscription ($0 actual, tokens tracked)
 *   T3  premium API (sonnet/opus via metered API key — not enabled in this codebase yet)
 *
 * Default cascade by tier:
 *   T0 → ollama, fallback claude_cli, fallback codex_cli  (cheap-first)
 *   T1 → claude_cli, fallback codex_cli, fallback ollama  (quality with cheap safety net)
 *   T3 → claude_cli only, no fallback                     (force premium)
 *
 * Callers pass `tier: 'T0' | 'T1' | 'T3'` (default 'T0' — cheap by default).
 * Env override: `TEXT_PROVIDER=ollama|claude_cli|codex_cli` forces one provider.
 *
 * All providers return the same shape so callers are provider-agnostic.
 */

import { textClaudeCli } from './text-claude-cli.js';
import { textCodexCli } from './text-codex-cli.js';
import { textOllama } from './text-ollama.js';

const TIER_PRIORITY = {
  T0: ['ollama', 'claude_cli', 'codex_cli'],
  T1: ['claude_cli', 'codex_cli', 'ollama'],
  T3: ['claude_cli'],
};
const DEFAULT_TIER = 'T0';

function pickProviders(tier) {
  const forced = process.env.TEXT_PROVIDER;
  if (forced) {
    const fallback = process.env.TEXT_FALLBACK !== 'false';
    if (!fallback) return [forced];
    const all = ['claude_cli', 'codex_cli', 'ollama'];
    return [forced, ...all.filter((p) => p !== forced)];
  }
  return TIER_PRIORITY[tier] || TIER_PRIORITY[DEFAULT_TIER];
}

async function callProvider(name, opts) {
  switch (name) {
    case 'claude_cli': return textClaudeCli(opts);
    case 'codex_cli':  return textCodexCli(opts);
    case 'ollama': {
      // Default Ollama model for T0 tasks: qwen3.5:9b is fast + small + plenty good
      // for classification / summarization. Use OLLAMA_TEXT_MODEL env to override
      // (e.g. set to 'qwen3.6:27b' for hypothesis generation that wants more quality).
      const model = opts.model || process.env.OLLAMA_TEXT_MODEL || 'qwen3.5:9b';
      const out = await textOllama({
        ...opts,
        model,
        think: opts.think !== undefined ? opts.think : false,
      });
      return { ...out, provider: 'ollama' };
    }
    default: return { ok: false, provider: name, reason: `unknown provider: ${name}` };
  }
}

export async function runText(opts = {}) {
  const tier = opts.tier || DEFAULT_TIER;
  const providers = pickProviders(tier);
  const attempts = [];
  for (const name of providers) {
    try {
      const out = await callProvider(name, opts);
      attempts.push({ provider: name, ok: out.ok !== false, latencyMs: out.latencyMs, reason: out.reason });
      if (out.parsedJson && Object.keys(out.parsedJson).length > 0) {
        return { ok: true, ...out, attempts, tier };
      }
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
    tier,
  };
}
