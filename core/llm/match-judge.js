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
import fs from 'node:fs';

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
 * Run cascade · return {text, provider, latency_ms, trace[]}
 * codex → claude → ollama
 *
 * Trace records every provider attempt with success/failure · used by
 * pl:cascade-doctor to detect silent degradation (e.g. codex always failing
 * → ollama is doing all the work silently)
 */
async function runCascade(prompt) {
  const start = Date.now();
  const trace = [];
  let result = null;
  for (const tier of ['codex_cli', 'claude_cli', 'ollama']) {
    const tStart = Date.now();
    try {
      if (tier === 'codex_cli')      result = { text: (await runCli('codex', ['exec'], prompt, 90_000)).stdout, provider: tier };
      else if (tier === 'claude_cli') result = { text: (await runCli('claude', ['-p', prompt], '', 90_000)).stdout, provider: tier };
      else                            result = { text: await ollamaJson(prompt), provider: tier };
      trace.push({ tier, ok: true, latency_ms: Date.now() - tStart });
      break;
    } catch (err) {
      trace.push({ tier, ok: false, latency_ms: Date.now() - tStart, error: err.message.slice(0, 150) });
    }
  }
  if (!result) throw new Error(`All judges failed: ${trace.map((t) => `${t.tier}: ${t.error}`).join(' · ')}`);
  result.latency_ms = Date.now() - start;
  result.trace = trace;
  // Persist trace into ledger-like cascade log for daily aggregation
  appendCascadeTrace({ scope: 'match-judge', trace, final_provider: result.provider });
  return result;
}

function appendCascadeTrace(entry) {
  try {
    const p = '/Users/matthew/Developer/google-map-website-v3/data/finance/cascade-trace.jsonl';
    const line = JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n';
    fs.appendFileSync(p, line);
  } catch {}
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

/* ─── Public · intake results plausibility (GR6 · D43) ──────────── */

/**
 * Judge whether intake (gosom / batch search) results look like genuine
 * niche businesses, not generic noise.
 *
 * Catches:
 *   · Generic listings (e.g. "Yellow Pages") leaking through niche search
 *   · Wrong-city contamination (Brisbane query → Sydney results)
 *   · Suspicious volume (1 candidate when --count=10 asked · likely scrape failure)
 *
 * @param {object} ctx · {query, niche, city, expected_count, candidates}
 * @returns {{verdict, confidence, reason, suspicious_picks: string[]}}
 */
export async function judgeIntakeResults(ctx) {
  const prompt = `You are a quality gate for batch lead intake (Google Maps / Places API scrape).

USER QUERY: ${JSON.stringify({ query: ctx.query, niche: ctx.niche, city: ctx.city, expected_count: ctx.expected_count })}

CANDIDATES (first 15):
${JSON.stringify((ctx.candidates || []).slice(0, 15), null, 2)}

QUESTION: Are these candidates actually ${ctx.niche || 'the requested niche'} businesses in ${ctx.city || 'the requested area'}?

Common contamination to catch:
- Generic directory listings ("Yellow Pages", "Local Listings") · not real businesses
- Wrong-niche results (asked plumber · got general handyman / hardware store)
- Wrong-city (asked Brisbane · got Sydney/Melbourne by mistake)
- Suspicious volume (1 result when 10 expected · likely partial scrape)

Return JSON only:
{
  "verdict":          "proceed" | "human-gate" | "reject",
  "confidence":       <float 0..1>,
  "reason":           <short string>,
  "suspicious_picks": <array of business names that look off · empty if all good>
}

Decision rule:
- proceed (≥0.85): ≥80% of candidates look like real niche+city matches
- human-gate (0.5..0.85): 1-3 sus picks · operator should eyeball before downstream
- reject (<0.5): mostly noise · re-run with different query

JSON only:`;

  const result = await runCascade(prompt);
  const j = extractJson(result.text);
  if (!j) {
    return { verdict: 'human-gate', confidence: 0, reason: `judge unparseable (${result.provider})`, suspicious_picks: [], provider: result.provider, latency_ms: result.latency_ms };
  }
  return {
    verdict: ['proceed', 'human-gate', 'reject'].includes(j.verdict) ? j.verdict : 'human-gate',
    confidence: typeof j.confidence === 'number' ? j.confidence : 0.5,
    reason: String(j.reason || '').slice(0, 200),
    suspicious_picks: Array.isArray(j.suspicious_picks) ? j.suspicious_picks.map(String).slice(0, 10) : [],
    provider: result.provider,
    latency_ms: result.latency_ms,
  };
}

/* ─── Public · audit conclusion plausibility check (GR6 · D43) ──── */

/**
 * Judge whether an audit's final scorecard makes sense given the inputs.
 *
 * Catches:
 *   · Score 95/100 on a 1-page site (probably scorecard bug)
 *   · Score 30/100 with all gates PASSED (inconsistency)
 *   · Phase=ready-to-build but missing core fields (data hole)
 *
 * @param {object} ctx · {entity, crawl_summary, scorecard, verdict, hard_gates}
 * @returns {{verdict, confidence, reason, anomalies: string[]}}
 */
export async function judgeAuditConclusion(ctx) {
  const prompt = `You are a quality gate for website audit conclusions.

AUDIT RESULT:
${JSON.stringify({
  entity_name: ctx.entity?.latest?.name,
  pages_crawled: ctx.crawl_summary?.pages_crawled,
  sitemap_source: ctx.crawl_summary?.sitemap_source,
  hard_gates_passed: ctx.hard_gates?.every?.((g) => g.passed),
  scorecard: ctx.scorecard,
  verdict: ctx.verdict,
}, null, 2)}

QUESTION: Does this conclusion make sense given the inputs?

Anomalies to catch:
- Score ≥85 with pages_crawled=1 (suspicious · scorecard might be hallucinating)
- Score <50 with all hard_gates passed (rare · usually 5 dim doesn't hit floor unless crawl thin)
- verdict=ready-to-build but core_info dim < 15 (missing fundamentals)
- verdict=qa-pending but all dims ≥80% max (should be ready-to-build instead)
- pages_crawled=0 but verdict assigned (crawl failed · audit invalid)

Return JSON only:
{
  "verdict":    "trust" | "review" | "redo",
  "confidence": <float 0..1>,
  "reason":     <short string>,
  "anomalies":  <array of specific concerns · empty if no issues>
}

Decision rule:
- trust (≥0.85): consistent · use the audit
- review (0.5..0.85): minor anomalies · operator should glance
- redo (<0.5): inconsistent · re-run audit with bigger crawl

JSON only:`;

  const result = await runCascade(prompt);
  const j = extractJson(result.text);
  if (!j) {
    return { verdict: 'review', confidence: 0, reason: `judge unparseable (${result.provider})`, anomalies: [], provider: result.provider, latency_ms: result.latency_ms };
  }
  return {
    verdict: ['trust', 'review', 'redo'].includes(j.verdict) ? j.verdict : 'review',
    confidence: typeof j.confidence === 'number' ? j.confidence : 0.5,
    reason: String(j.reason || '').slice(0, 200),
    anomalies: Array.isArray(j.anomalies) ? j.anomalies.map(String).slice(0, 10) : [],
    provider: result.provider,
    latency_ms: result.latency_ms,
  };
}

/* ─── Public · enrichment search-result match verification (D43 · Q3) ─ */

/**
 * Per Matthew 2026-05-14:
 *   "用 google 去搜索一下 · 至于搜索的结果要不要大模型去判断一下是不是
 *    相关或者 match 的?"
 *
 * enrichment.js 跑 5-6 个 Tinyfish/DDG 搜索 (discover_official · social_*
 * · reviews_thirdparty · reverse_phone) · 用正则 host 匹配分类。但是不验
 * 证 "这个 facebook page 真是这家店吗" · 可能 false match (同名连锁 /
 * 同名 SEO agency / etc)。
 *
 * 给每个 candidate URL 一个 LLM 判断:
 *   yes (>= 0.8 confidence) → 写 entity.latest
 *   maybe (0.4..0.8) → 写 entity.latest.maybe_X (operator 复核)
 *   no (< 0.4) → 丢
 *
 * @param {object} input
 * @param {object} input.entity · { name, niche, city, phone, address }
 * @param {Array}  input.candidates · [{ type, url, title, snippet? }]
 * @returns {Promise<Array>} per candidate: { url, matches, confidence, reason }
 */
export async function judgeEnrichmentMatches({ entity, candidates }) {
  if (!candidates?.length) return [];
  const prompt = `You are a data quality verifier for a lead enrichment pipeline.

TARGET BUSINESS:
${JSON.stringify(entity, null, 2)}

SEARCH CANDIDATES (URLs found from web search):
${JSON.stringify(candidates.slice(0, 12), null, 2)}

QUESTION: For EACH candidate · is this URL really the OFFICIAL profile / website /
social presence of the TARGET BUSINESS · or a false match (same-name competitor ·
generic directory · franchise sibling · unrelated)?

For each candidate, return verdict:
- "yes" (>= 0.8 confidence): clearly the same business
- "maybe" (0.4..0.8): partial signal · could be · operator review
- "no" (< 0.4): wrong match · skip

Common false-match patterns:
- Same business name in different city (e.g. "Joe's Roofing" Sydney vs Brisbane)
- Same name but different niche (e.g. "ABC Plumbing" target vs "ABC Plumbing Supplies")
- Generic directory page (Yellow Pages / hipages) listing many businesses
- Franchise / chain sibling not the actual target

Return JSON array · one entry per candidate:
[
  { "url": "...", "matches": "yes"|"maybe"|"no", "confidence": <float>, "reason": "<short>" },
  ...
]

JSON only:`;

  const result = await runCascade(prompt);
  const j = extractJson(result.text);
  if (!Array.isArray(j)) {
    // LLM didn't return array · fallback: mark all as maybe (operator review)
    return candidates.map((c) => ({
      url: c.url, matches: 'maybe', confidence: 0,
      reason: `LLM unparseable (${result.provider})`,
      provider: result.provider,
    }));
  }
  // Map LLM verdicts back to candidates (by URL match)
  return candidates.map((c) => {
    const verdict = j.find((v) => v.url === c.url) || {};
    return {
      url: c.url,
      matches: ['yes', 'maybe', 'no'].includes(verdict.matches) ? verdict.matches : 'maybe',
      confidence: typeof verdict.confidence === 'number' ? verdict.confidence : 0,
      reason: String(verdict.reason || '').slice(0, 150),
      provider: result.provider,
    };
  });
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
