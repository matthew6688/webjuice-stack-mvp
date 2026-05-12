/**
 * core/leads/dedup-llm-decider.js
 *
 * SOP-1 AI dedup auto-decider.
 *
 * Given two suspected-duplicate entities + the trigger that flagged them,
 * call local Ollama (qwen3.5:9b by default · think:false / /no_think per
 * feedback_qwen_disable_thinking) and return a structured verdict:
 *
 *   - 'same'      (confidence ≥ 0.85) → caller may auto-write merge decision
 *   - 'different' (confidence ≥ 0.85) → caller may auto-write 'different' decision
 *   - 'uncertain' (anything else)     → caller must queue for human review
 *
 * Failure modes (ollama down, parse error, schema mismatch) ALWAYS fall back
 * to `verdict: 'uncertain'` with `source: 'fallback'` — never throw.
 *
 * Reuses core/llm/text-ollama.js for the HTTP call (no new client).
 *
 * SOP-X-Dedup §4.2.
 */

import { textOllama } from '../llm/text-ollama.js';

const DEFAULT_MODEL = 'qwen3.5:9b';
const HIGH_CONF_THRESHOLD = 0.85;

/**
 * Trim an entity JSON down to the fields the LLM actually needs to compare.
 * Keeps prompt short + deterministic.
 */
function compactEntity(e) {
  if (!e || typeof e !== 'object') return {};
  const latest = e.latest || {};
  const ids = e.identifiers || {};
  return {
    entityKey: e.entityKey || null,
    name: latest.name || null,
    phone: latest.phone || null,
    website: latest.website || null,
    address: latest.address || null,
    city: latest.city || null,
    state: latest.state || null,
    postcode: latest.postcode || null,
    country: latest.country || null,
    niche: latest.niche || null,
    business_type: latest.business_type || latest.businessType || null,
    opening_hours: latest.opening_hours || latest.openingHours || null,
    lat: latest.lat || latest.latitude || null,
    lng: latest.lng || latest.longitude || null,
    place_id: ids.place_id || null,
    phone_digits: ids.phoneDigits || null,
    website_domain: ids.websiteDomain || null,
    abn: ids.abn || latest.abn || null,
  };
}

function buildPrompt(entityA, entityB, trigger) {
  const a = compactEntity(entityA);
  const b = compactEntity(entityB);
  const t = {
    reason: trigger?.reason || 'unknown',
    matched_field: trigger?.matched_field || trigger?.matchKey || null,
    matched_value: trigger?.matched_value || trigger?.matchValue || null,
  };
  return `你是商家档案查重助手。下面是两个疑似重复的商家。判断它们是不是同一家。

判断信号 (强度):
- 强: ABN 一致 · 地理坐标 < 100m · 电话+地址都一致 · place_id 相同
- 中: 同电话不同名 (可能换牌)  · 同域名不同名 (可能母子公司)
- 弱: 名字 fuzzy 相似但其他全不同
- 区分: opening_hours 完全冲突 · 业态完全不同 · 地址跨城市跨州

商家 A: ${JSON.stringify(a)}
商家 B: ${JSON.stringify(b)}
触发原因: ${t.reason}: ${t.matched_value ?? ''}

只输出 JSON · 不要 markdown · 不要解释 · 严格 schema:
{"verdict":"same|different|uncertain","confidence":0-1,"reasoning":"30-100字中文","fields_supporting_same":["phone","address",...],"fields_supporting_different":["name","opening_hours",...]}

think:false  /no_think`;
}

/**
 * Validate parsed LLM JSON against expected schema.
 * Returns normalized object or null.
 */
function validateSchema(j) {
  if (!j || typeof j !== 'object') return null;
  const verdict = j.verdict;
  if (!['same', 'different', 'uncertain'].includes(verdict)) return null;
  let conf = typeof j.confidence === 'number' ? j.confidence : Number(j.confidence);
  if (!Number.isFinite(conf)) return null;
  if (conf < 0) conf = 0;
  if (conf > 1) conf = 1;
  const reasoning = typeof j.reasoning === 'string' ? j.reasoning.trim() : '';
  if (!reasoning) return null;
  const same = Array.isArray(j.fields_supporting_same)
    ? j.fields_supporting_same.filter((x) => typeof x === 'string')
    : [];
  const diff = Array.isArray(j.fields_supporting_different)
    ? j.fields_supporting_different.filter((x) => typeof x === 'string')
    : [];
  return {
    verdict,
    confidence: conf,
    reasoning,
    fields_supporting_same: same,
    fields_supporting_different: diff,
  };
}

function fallback(reasonMsg, model, latencyMs = 0) {
  return {
    verdict: 'uncertain',
    confidence: 0,
    reasoning: `LLM 判定失败 · 回退人工 · ${reasonMsg}`,
    fields_supporting_same: [],
    fields_supporting_different: [],
    model,
    latency_ms: latencyMs,
    source: 'fallback',
  };
}

/**
 * Main entry. Always returns a verdict object — never throws.
 *
 * @param {object} entityA full entity JSON
 * @param {object} entityB full entity JSON
 * @param {object} trigger { reason, matched_field, matched_value }
 * @param {object} [opts]
 * @param {string} [opts.model]
 * @param {Function} [opts.ollamaFn] injection point for tests (defaults to textOllama)
 * @param {number} [opts.timeoutMs]
 * @returns {Promise<{verdict, confidence, reasoning, fields_supporting_same, fields_supporting_different, model, latency_ms, source}>}
 */
export async function llmDecideDedup(entityA, entityB, trigger, opts = {}) {
  const model = opts.model || DEFAULT_MODEL;
  const ollamaFn = opts.ollamaFn || textOllama;
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const prompt = buildPrompt(entityA, entityB, trigger || {});

  let out;
  const t0 = Date.now();
  try {
    out = await ollamaFn({
      model,
      prompt,
      purpose: 'sop1_dedup_decide',
      stage: 'dedup_decision',
      timeoutMs,
      format: 'json',
      think: false,
    });
  } catch (err) {
    return fallback(`ollama unreachable: ${err?.message || err}`, model, Date.now() - t0);
  }

  const latencyMs = out?.latencyMs ?? (Date.now() - t0);

  if (!out || !out.parsedJson) {
    return fallback('no parseable JSON in response', model, latencyMs);
  }
  const v = validateSchema(out.parsedJson);
  if (!v) {
    return fallback('schema validation failed', model, latencyMs);
  }

  return {
    ...v,
    model,
    latency_ms: latencyMs,
    source: 'llm',
  };
}

export { HIGH_CONF_THRESHOLD, buildPrompt, validateSchema };
