/**
 * core/llm/match-judge.js · V3 D43 (2026-05-14)
 *
 * LLM-based judgment for ambiguous freestyle inputs (image-extract, single-enrich).
 *
 * Per Matthew: "对于 free style 输入的，比如图片或者 single enrich 的这种，
 *  我估计你需要用大模型来去理解和判断，是否正确或者如何下一步，规则的判断是不够的"
 *
 * Pattern: deterministic step (Places match / OCR) followed by AI verifier.
 * Returns {verdict, confidence, reason, suggested_next}.
 *   verdict: 'proceed' | 'human-gate' | 'reject'
 *
 * Cascade: codex_cli (ChatGPT default model · 准确) → claude_cli → ollama qwen3.5:9b.
 * All providers via stdin · matches D43 image-task-prep fix.
 */

import { spawn } from 'node:child_process';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.MATCH_JUDGE_OLLAMA_MODEL || 'qwen3.5:9b';

/** Single CLI subprocess · pipe prompt via stdin · capture stdout · timeout */
function runCli(cmd, args, input, timeoutMs = 120_000) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    const timer = setTimeout(() => { proc.kill('SIGTERM'); reject(new Error(`timeout ${timeoutMs}ms`)); }, timeoutMs);
    proc.on('error', reject);
    proc.on('exit', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`exit ${code}: ${stderr.slice(0, 200)}`));
    });
    proc.stdin.write(input);
    proc.stdin.end();
  });
}

function extractJson(text) {
  if (!text) return null;
  // Codex output has session/user/codex/tokens-used blocks · pick codex block
  const codexBlock = text.match(/\bcodex\b\s*\n([\s\S]+?)(?:\ntokens used|\n--+|$)/i);
  const raw = (codexBlock ? codexBlock[1] : text)
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/```\s*$/m, '');
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

async function ollamaJson(prompt) {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      think: false,
      options: { temperature: 0.1 },
      format: 'json',
    }),
  });
  if (!res.ok) throw new Error(`ollama HTTP ${res.status}`);
  const data = await res.json();
  return data.response || '';
}

/**
 * Run cascade · return {text, provider, latency_ms}
 * codex → claude → ollama
 */
async function runCascade(prompt) {
  const start = Date.now();
  const errs = [];
  try {
    const r = await runCli('codex', ['exec'], prompt, 90_000);
    return { text: r.stdout, provider: 'codex_cli', latency_ms: Date.now() - start };
  } catch (err) { errs.push(`codex: ${err.message}`); }
  try {
    const r = await runCli('claude', ['-p', prompt], '', 90_000);
    return { text: r.stdout, provider: 'claude_cli', latency_ms: Date.now() - start };
  } catch (err) { errs.push(`claude: ${err.message}`); }
  try {
    const t = await ollamaJson(prompt);
    return { text: t, provider: 'ollama', latency_ms: Date.now() - start };
  } catch (err) { errs.push(`ollama: ${err.message}`); }
  throw new Error(`All judges failed: ${errs.join(' · ')}`);
}

/* ─── Public · single-enrich Places match verification ────────────── */

/**
 * Judge whether a Places API result matches the user's intent.
 *
 * @param {object} userInput · {businessName, phone, city, niche, ...}
 * @param {object} placesResult · {name, address, phone, city, locality, lat, lng}
 * @returns {{verdict, confidence, reason, suggested_next}}
 */
export async function judgeSingleEnrichMatch(userInput, placesResult) {
  const prompt = `You are a data quality verifier for a lead enrichment pipeline.

USER PROVIDED:
${JSON.stringify(userInput, null, 2)}

GOOGLE PLACES RETURNED:
${JSON.stringify(placesResult, null, 2)}

QUESTION: Is the Places result actually the SAME business the user meant?

Common failure modes to catch:
- City mismatch (user said "Brisbane", Places returned a "Sydney" business)
- Name mismatch (Places matched a city geo entity not a business)
- Phone unmatched (user gave phone but result has different phone)
- Address state mismatch (user said "QLD", result is "NSW")

Return JSON only:
{
  "verdict":         "proceed" | "human-gate" | "reject",
  "confidence":      <float 0..1>,
  "reason":          <short string · why this verdict>,
  "suggested_next":  <short hint for operator/system · e.g. "search by phone only" | "user typo"|"clear match">
}

Decision rule:
- proceed: high confidence (>= 0.85) that it's the same business
- human-gate: medium (0.5..0.85) · operator should eyeball
- reject: low (<0.5) · clearly a wrong match · don't write entity

JSON only, no prose:`;

  const result = await runCascade(prompt);
  const j = extractJson(result.text);
  if (!j) {
    return {
      verdict: 'human-gate',
      confidence: 0.0,
      reason: `judge unparseable (${result.provider})`,
      suggested_next: 'manual review',
      provider: result.provider,
      latency_ms: result.latency_ms,
    };
  }
  return {
    verdict: ['proceed', 'human-gate', 'reject'].includes(j.verdict) ? j.verdict : 'human-gate',
    confidence: typeof j.confidence === 'number' ? j.confidence : 0.5,
    reason: String(j.reason || '').slice(0, 200),
    suggested_next: String(j.suggested_next || '').slice(0, 200),
    provider: result.provider,
    latency_ms: result.latency_ms,
  };
}

/* ─── Public · image-extract sufficiency check ────────────────────── */

/**
 * Judge whether image OCR extraction has enough data to proceed downstream.
 *
 * @param {object} ocrResult · {businessName, phone, niche, city, address, services, ...}
 * @returns {{verdict, confidence, reason, suggested_next, required_followup}}
 */
export async function judgeImageExtractSufficiency(ocrResult) {
  const prompt = `You are a quality gate for a lead intake pipeline that ingests photos of business signs / business cards / Google Maps screenshots.

IMAGE OCR EXTRACTED:
${JSON.stringify(ocrResult, null, 2)}

QUESTION: Can this data proceed to automated Places lookup, or do we need operator input?

Decision rules:
- proceed: phone alone is enough (Places phone-lookup works) OR (businessName + city) OR Google Maps URL
- human-gate: missing phone AND missing (businessName + city) · operator must add at least one
- reject: image clearly not a business (e.g. random photo, screenshot of unrelated content)

Note: businessName=null is OK if phone is present — many tradie signs have phone but no company name (e.g. "ROOFING TILE/METAL · 0424 371 622"). Don't fabricate a name.

Return JSON only:
{
  "verdict":            "proceed" | "human-gate" | "reject",
  "confidence":         <float 0..1>,
  "reason":             <short string>,
  "suggested_next":     <one of: "places-lookup-by-phone" | "places-text-search" | "ask-operator-city" | "ask-operator-name" | "ask-operator-anything" | "discard">,
  "required_followup":  <array of missing field names · e.g. ["city","business-name"] · empty if proceed>
}

JSON only, no prose:`;

  const result = await runCascade(prompt);
  const j = extractJson(result.text);
  if (!j) {
    return {
      verdict: 'human-gate',
      confidence: 0.0,
      reason: `judge unparseable (${result.provider})`,
      suggested_next: 'ask-operator-anything',
      required_followup: [],
      provider: result.provider,
      latency_ms: result.latency_ms,
    };
  }
  return {
    verdict: ['proceed', 'human-gate', 'reject'].includes(j.verdict) ? j.verdict : 'human-gate',
    confidence: typeof j.confidence === 'number' ? j.confidence : 0.5,
    reason: String(j.reason || '').slice(0, 200),
    suggested_next: String(j.suggested_next || '').slice(0, 100),
    required_followup: Array.isArray(j.required_followup) ? j.required_followup.map(String) : [],
    provider: result.provider,
    latency_ms: result.latency_ms,
  };
}
