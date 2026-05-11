/**
 * Unified TEXT adapter — dispatches text-only LLM calls (review analysis,
 * content classification, summarization) to the best provider available.
 *
 * Mirrors vision-adapter.js cascade:
 *   claude_cli → codex_cli → ollama
 *
 * Set TEXT_PROVIDER env var to force a specific one. Default cascades.
 *
 * All providers return the same shape so callers are provider-agnostic.
 */

import { textClaudeCli } from './text-claude-cli.js';
import { textCodexCli } from './text-codex-cli.js';
import { textOllama } from './text-ollama.js';

const DEFAULT_PRIORITY = ['claude_cli', 'codex_cli', 'ollama'];

function pickProviders() {
  const forced = process.env.TEXT_PROVIDER;
  if (forced) {
    const fallback = process.env.TEXT_FALLBACK !== 'false';
    if (!fallback) return [forced];
    return [forced, ...DEFAULT_PRIORITY.filter((p) => p !== forced)];
  }
  return DEFAULT_PRIORITY;
}

async function callProvider(name, opts) {
  switch (name) {
    case 'claude_cli': return textClaudeCli(opts);
    case 'codex_cli':  return textCodexCli(opts);
    case 'ollama': {
      const model = opts.model || process.env.OLLAMA_TEXT_MODEL || 'qwen3.6:27b';
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
  const providers = pickProviders();
  const attempts = [];
  for (const name of providers) {
    try {
      const out = await callProvider(name, opts);
      attempts.push({ provider: name, ok: out.ok !== false, latencyMs: out.latencyMs, reason: out.reason });
      if (out.parsedJson && Object.keys(out.parsedJson).length > 0) {
        return { ...out, attempts };
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
  };
}
