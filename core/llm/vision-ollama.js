/**
 * Local Ollama vision adapter — calls Ollama's /api/generate with images
 * inline. Model must have `vision` capability (e.g. qwen3.6:27b, gemma3:27b).
 *
 * T0 cost (free, runs on user's Mac mini). Latency ~20-60s per image
 * depending on model + resolution.
 */

import fs from 'fs';
import { appendLedgerEvent, hashRequest } from '../finance/ledger.js';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

export async function visionOllama({
  model,
  prompt,
  imagePaths = [],
  ledgerPath,
  leadId,
  clientSlug,
  stage = 'visual_audit',
  purpose = 'visual_audit_ollama',
  campaignId,
  fetchImpl = globalThis.fetch,
  timeoutMs = 240_000,
} = {}) {
  if (!model) throw new Error('model is required (e.g. "qwen3.6:27b")');
  if (!prompt) throw new Error('prompt is required');
  if (!imagePaths.length) throw new Error('at least one imagePath is required');

  const imagesB64 = imagePaths.map((p) => fs.readFileSync(p).toString('base64'));

  const body = {
    model,
    prompt,
    images: imagesB64,
    stream: false,
    options: { temperature: 0.2 },
  };

  const requestHash = await hashRequest({ provider: 'ollama', endpoint: 'generate', model, prompt, imageCount: imagePaths.length });
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
        image_count: imagePaths.length,
        prompt_chars: prompt.length,
        response_chars: (payload?.response || '').length,
        eval_count: payload?.eval_count,
        prompt_eval_count: payload?.prompt_eval_count,
        total_duration_ns: payload?.total_duration,
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

/**
 * Extract first balanced JSON object from a free-text LLM response.
 * Returns null if no parseable JSON found.
 */
export function tryExtractJson(text) {
  if (!text) return null;
  // Look for code-fenced JSON first
  const fence = text.match(/```(?:json)?\s*\n?([\s\S]+?)\n?```/);
  if (fence) {
    try { return JSON.parse(fence[1]); } catch {}
  }
  // Otherwise find first balanced {...}
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        const candidate = text.slice(start, i + 1);
        try { return JSON.parse(candidate); } catch { return null; }
      }
    }
  }
  return null;
}
