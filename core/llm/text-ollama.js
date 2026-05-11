/**
 * Local Ollama text adapter — calls /api/generate without images.
 * T0 cost (free, runs on Mac mini). Mirrors vision-ollama but for
 * text-only tasks like review analysis or content classification.
 */

import { appendLedgerEvent, hashRequest } from '../finance/ledger.js';
import { tryExtractJson } from './vision-ollama.js';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

export async function textOllama({
  model,
  prompt,
  ledgerPath,
  leadId,
  clientSlug,
  stage = 'review_mining',
  purpose = 'review_analysis_ollama',
  campaignId,
  fetchImpl = globalThis.fetch,
  timeoutMs = 240_000,
  think = false,
  format = null,
} = {}) {
  if (!model) throw new Error('model is required');
  if (!prompt) throw new Error('prompt is required');

  const body = {
    model,
    prompt,
    stream: false,
    options: { temperature: 0.2 },
    think,
  };
  if (format) body.format = format;

  const requestHash = await hashRequest({ provider: 'ollama', endpoint: 'generate', model, prompt });
  const start = Date.now();

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let payload;
  let httpStatus = 0;
  try {
    const res = await fetchImpl(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    httpStatus = res.status;
    if (!res.ok) throw new Error(`ollama HTTP ${res.status}`);
    payload = await res.json();
  } finally {
    clearTimeout(timer);
  }
  const latencyMs = Date.now() - start;

  if (ledgerPath || leadId || clientSlug) {
    appendLedgerEvent({
      type: 'cost',
      category: 'other',
      provider: 'ollama_local',
      tier: 'T0',
      leadId, clientSlug, stage, purpose,
      requestHash,
      campaignId,
      units: 1,
      unitCost: 0,
      amount: 0,
      currency: process.env.ROI_CURRENCY || 'USD',
      metadata: {
        endpoint: 'generate',
        model,
        prompt_chars: prompt.length,
        response_chars: (payload?.response || '').length,
        eval_count: payload?.eval_count,
        latency_ms: latencyMs,
        http_status: httpStatus,
      },
    }, ledgerPath);
  }

  return {
    model,
    rawText: payload?.response || '',
    parsedJson: tryExtractJson(payload?.response || ''),
    latencyMs,
    tokensIn: payload?.prompt_eval_count || null,
    tokensOut: payload?.eval_count || null,
    costUsd: 0,
  };
}
