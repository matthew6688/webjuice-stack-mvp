/**
 * SOP-3 §4 · LLM cascade · production thin wrapper.
 *
 * Priority (per Matthew · 2026-05-17):
 *   T1 主 · codex CLI subscription
 *   T1 副 · claude CLI subscription
 *   T0 backup · Ollama local (qwen3.6:27b text · gemma3:27b vision)
 *
 * Each call returns:
 *   { ok, output, tier, tool, model, latency_ms, fallback_chain: [{tier,reason}...] }
 *
 * NOT autoresearch lab — that's offline (experiments/autoresearch-lab/).
 * This is the production runner that reads `config/autoresearch/locked-combos.json`
 * (when available) or falls back to defaults defined here.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const LOCKED_COMBOS_PATH = path.resolve('config/autoresearch/locked-combos.json');
const DEFAULT_TIMEOUT_MS = 90_000;
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

// SOP-3 §4 · LLM cascade defaults.
// T0 TEXT backup = qwen3.6:27b (2026-05-30 · R93 copy-cascade fix per Matthew). REPLACES deepseek-r1:14b,
//   which ignored the fact-locked copy contract and produced REJECT-grade generic copy (R93 evidence).
//   The old "qwen broken with format=json (0 bytes/hangs)" note (2026-05-17) was a THINKING-mode bug:
//   qwen3.x emits <think> tokens that break JSON. Fixed by `think:false` in callOllama (see below).
//   deepseek-r1 is also worst-for-judging per handoff — now also worst-for-generating; retired from copy.
// T0 vision backup verified earlier: gemma3:27b (17GB · 31s · multimodal)
const DEFAULT_COMBOS = {
  'extract_services_from_site': {
    primary: { tier: 'T1b', tool: 'claude', model: 'claude-sonnet-4-5' },
    fallback: { tier: 'T1a', tool: 'codex', model: 'gpt-5-codex' },
    backup: { tier: 'T0', tool: 'ollama', model: 'qwen3.6:27b' },
  },
  'extract_about_narrative': {
    primary: { tier: 'T1b', tool: 'claude', model: 'claude-sonnet-4-5' },
    fallback: { tier: 'T1a', tool: 'codex', model: 'gpt-5' },
    backup: { tier: 'T0', tool: 'ollama', model: 'qwen3.6:27b' },
  },
  'extract_hero_copy': {
    primary: { tier: 'T1b', tool: 'claude', model: 'claude-sonnet-4-5' },
    fallback: { tier: 'T1a', tool: 'codex', model: 'gpt-5' },
    backup: { tier: 'T0', tool: 'ollama', model: 'qwen3.6:27b' },
  },
  // Persona-POV copy-quality judge (text · Matthew 2026-05-30). Premium/advisory · N-run averaged.
  'eval_persona_copy': {
    primary: { tier: 'T1b', tool: 'claude', model: 'claude-sonnet-4-5' },
    fallback: { tier: 'T1a', tool: 'codex', model: 'gpt-5' },
    backup: { tier: 'T0', tool: 'ollama', model: 'qwen3.6:27b' },
  },
  // NOTE: design_* / fill_fix_matrix backups kept on deepseek-r1:14b (codex review 2026-05-30 · the
  // qwen3.6 swap is verified for COPY tasks only; design-task backup change is out of scope/unproven).
  'design_page_sections': {
    primary: { tier: 'T1b', tool: 'claude', model: 'claude-sonnet-4-5' },
    fallback: { tier: 'T1b', tool: 'claude', model: 'claude-haiku-4-5' },
    backup: { tier: 'T0', tool: 'ollama', model: 'deepseek-r1:14b' },
  },
  'design_header': {
    primary: { tier: 'T1b', tool: 'claude', model: 'claude-sonnet-4-5' },
    fallback: { tier: 'T1b', tool: 'claude', model: 'claude-haiku-4-5' },
    backup: { tier: 'T0', tool: 'ollama', model: 'deepseek-r1:14b' },
  },
  'design_footer': {
    primary: { tier: 'T1b', tool: 'claude', model: 'claude-haiku-4-5' },
    fallback: { tier: 'T1b', tool: 'claude', model: 'claude-sonnet-4-5' },
    backup: { tier: 'T0', tool: 'ollama', model: 'deepseek-r1:14b' },
  },
  'design_cta_system': {
    primary: { tier: 'T1b', tool: 'claude', model: 'claude-sonnet-4-5' },
    fallback: { tier: 'T1b', tool: 'claude', model: 'claude-haiku-4-5' },
    backup: { tier: 'T0', tool: 'ollama', model: 'deepseek-r1:14b' },
  },
  'fill_fix_matrix': {
    primary: { tier: 'T1b', tool: 'claude', model: 'claude-haiku-4-5' },
    fallback: { tier: 'T1b', tool: 'claude', model: 'claude-sonnet-4-5' },
    backup: { tier: 'T0', tool: 'ollama', model: 'deepseek-r1:14b' },
  },
  'classify_images_contact_sheet': {
    primary: { tier: 'T1b', tool: 'claude', model: 'claude-sonnet-4-5', vision: true },
    fallback: null, // codex vision not bench-tested · skip directly to T0
    backup: { tier: 'T0', tool: 'ollama', model: 'gemma3:27b', vision: true },
  },
  'eval_screenshot_visual': {
    primary: { tier: 'T1b', tool: 'claude', model: 'claude-sonnet-4-5', vision: true },
    fallback: { tier: 'T1b', tool: 'claude', model: 'claude-haiku-4-5', vision: true },
    backup: { tier: 'T0', tool: 'ollama', model: 'gemma3:27b', vision: true },
  },
  // codex R64 · hero-only fold judge (aesthetic layer · deterministic facts injected · LLM may NOT audit facts)
  'eval_hero_quality': {
    primary: { tier: 'T1b', tool: 'claude', model: 'claude-sonnet-4-5', vision: true },
    fallback: { tier: 'T1b', tool: 'claude', model: 'claude-haiku-4-5', vision: true },
    backup: { tier: 'T0', tool: 'ollama', model: 'gemma3:27b', vision: true },
  },
  // codex R66 · T4 site-level designer-craft review (full-page rhythm/consistency/imagery/mobile/ai-slop · facts injected)
  'eval_design_review': {
    primary: { tier: 'T1b', tool: 'claude', model: 'claude-sonnet-4-5', vision: true },
    fallback: { tier: 'T1b', tool: 'claude', model: 'claude-haiku-4-5', vision: true },
    backup: { tier: 'T0', tool: 'ollama', model: 'gemma3:27b', vision: true },
  },
  // codex R70 · compose-loop field-scoped copy fix (text only · NO new facts · rewrite within constraints)
  // backup = gemma3:27b in PLAIN mode (format:null) — reliable fenced JSON for copy
  // rewrites; format=json 500s on long prompts and deepseek-r1 reasoning output is flaky.
  'gen_copy_fix': {
    primary: { tier: 'T1b', tool: 'claude', model: 'claude-sonnet-4-5' },
    fallback: { tier: 'T1b', tool: 'claude', model: 'claude-haiku-4-5' },
    backup: { tier: 'T0', tool: 'ollama', model: 'gemma3:27b', format: null },
  },
};

function loadCombos() {
  try {
    if (fs.existsSync(LOCKED_COMBOS_PATH)) {
      return { ...DEFAULT_COMBOS, ...JSON.parse(fs.readFileSync(LOCKED_COMBOS_PATH, 'utf8')) };
    }
  } catch { /* fall back */ }
  return DEFAULT_COMBOS;
}

/**
 * Call codex CLI · returns clean output via --output-last-message file.
 */
async function callCodex({ prompt, model = 'gpt-5-codex', timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const outFile = path.join(os.tmpdir(), `codex-out-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.txt`);
  const start = Date.now();
  return new Promise((resolve) => {
    const args = ['exec', '--output-last-message', outFile, '-c', `model="${model}"`, prompt];
    const p = spawn('codex', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    p.stderr.on('data', (c) => { stderr += c.toString(); });
    const timer = setTimeout(() => { try { p.kill('SIGTERM'); } catch {} }, timeoutMs);
    p.on('close', (code) => {
      clearTimeout(timer);
      const latency = Date.now() - start;
      try {
        const output = fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8') : '';
        try { fs.unlinkSync(outFile); } catch {}
        if (code !== 0) return resolve({ ok: false, latency, reason: `exit ${code}: ${stderr.slice(0, 200)}` });
        if (!output) return resolve({ ok: false, latency, reason: 'empty output' });
        resolve({ ok: true, output, latency });
      } catch (err) { resolve({ ok: false, latency, reason: err.message }); }
    });
    p.on('error', (err) => { clearTimeout(timer); resolve({ ok: false, latency: Date.now() - start, reason: err.message }); });
  });
}

/**
 * Call claude CLI · supports image input via @file syntax.
 */
async function callClaude({ prompt, model = 'claude-sonnet-4-5', imagePath = null, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const fullPrompt = imagePath ? `${prompt}\n\n@${imagePath}` : prompt;
  const start = Date.now();
  return new Promise((resolve) => {
    const args = ['-p', fullPrompt, '--model', model];
    const p = spawn('claude', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    p.stdout.on('data', (c) => { stdout += c.toString(); });
    p.stderr.on('data', (c) => { stderr += c.toString(); });
    const timer = setTimeout(() => { try { p.kill('SIGTERM'); } catch {} }, timeoutMs);
    p.on('close', (code) => {
      clearTimeout(timer);
      const latency = Date.now() - start;
      if (code !== 0) return resolve({ ok: false, latency, reason: `exit ${code}: ${stderr.slice(0, 200)}` });
      if (!stdout) return resolve({ ok: false, latency, reason: 'empty stdout' });
      // codex R68 fix: claude CLI exits 0 even on auth/quota errors, printing the
      // error to stdout. Treat those as failures so the cascade falls through with
      // a clear reason instead of swallowing the error text as a valid "output".
      const m = stdout.match(/(?:API Error:\s*)?(401|403|429|5\d\d)\b|authentication[_ ]error|Invalid authentication|usage limit|rate.?limit|quota/i);
      if (m && stdout.length < 600) return resolve({ ok: false, latency, reason: `claude CLI error: ${stdout.trim().slice(0, 160)}` });
      resolve({ ok: true, output: stdout, latency });
    });
    p.on('error', (err) => { clearTimeout(timer); resolve({ ok: false, latency: Date.now() - start, reason: err.message }); });
  });
}

/**
 * Call Ollama local model · supports vision via base64 images array.
 */
async function callOllama({ prompt, model, imagePath = null, format = 'json', timeoutMs = 180_000 }) {
  const start = Date.now();
  // format omitted when falsy: gemma3:27b 500s on long text + format=json (line 26-27),
  // but is reliable in plain mode (returns fenced JSON · extractJson handles the fence).
  // think:false is REQUIRED for qwen3.x backups — with thinking on + format=json they emit <think>
  // reasoning that breaks/hangs JSON (the 2026-05-17 "qwen broken" symptom). Disabling it makes
  // qwen3.6:27b return clean JSON (verified 2026-05-30, R93 copy-cascade fix per Matthew).
  const body = { model, prompt, stream: false, think: false, options: { num_predict: 2048 } };
  if (format) body.format = format;
  if (imagePath && fs.existsSync(imagePath)) {
    body.images = [fs.readFileSync(imagePath).toString('base64')];
  }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const latency = Date.now() - start;
    if (!res.ok) return { ok: false, latency, reason: `http ${res.status}` };
    const json = await res.json();
    if (!json.response) return { ok: false, latency, reason: 'no response field' };
    return { ok: true, output: json.response, latency, eval_count: json.eval_count };
  } catch (err) { return { ok: false, latency: Date.now() - start, reason: err.message }; }
}

/**
 * Run a single tier · returns { ok, output, latency, ... } or error.
 */
async function runTier(combo, { prompt, imagePath, timeoutMs }) {
  if (!combo) return { ok: false, reason: 'no combo for tier' };
  switch (combo.tool) {
    case 'codex':  return callCodex({ prompt, model: combo.model, timeoutMs });
    case 'claude': return callClaude({ prompt, model: combo.model, imagePath, timeoutMs });
    case 'ollama': return callOllama({ prompt, model: combo.model, imagePath, timeoutMs, format: 'format' in combo ? combo.format : 'json' });
    default: return { ok: false, reason: `unknown tool ${combo.tool}` };
  }
}

/**
 * Top-level: run task with cascade fallback + optional validator.
 *
 * @param {string} taskId · e.g. 'extract_services_from_site'
 * @param {object} opts
 *   - prompt · string
 *   - imagePath · optional · for vision tasks
 *   - timeoutMs · per-tier timeout
 *   - skipTo · 'fallback' | 'backup' · skip primary (for testing)
 *   - validate · (output) => { ok, parsed?, error? } · if returns ok:false,
 *                cascade auto-falls to next tier (treats LLM output as failed).
 *                Fixes the gap where HTTP-ok but JSON-malformed was treated as success.
 */
export async function runTask(taskId, { prompt, imagePath = null, timeoutMs = DEFAULT_TIMEOUT_MS, skipTo = null, validate = null } = {}) {
  const combos = loadCombos();
  const cfg = combos[taskId];
  if (!cfg) {
    return { ok: false, reason: `no combo registered for task ${taskId}` };
  }
  const chain = [];
  const tiers = ['primary', 'fallback', 'backup'];
  const skipUntil = skipTo ? tiers.indexOf(skipTo) : 0;
  for (let i = skipUntil; i < tiers.length; i++) {
    const tierName = tiers[i];
    const combo = cfg[tierName];
    if (!combo) { chain.push({ tier: tierName, reason: 'not configured' }); continue; }
    const res = await runTier(combo, { prompt, imagePath, timeoutMs });
    chain.push({ tier: tierName, ...combo, ok: res.ok, latency_ms: res.latency, reason: res.reason });
    if (res.ok) {
      // Run validator if provided · falls through to next tier on validation failure
      let validatorResult = null;
      if (validate) {
        try {
          validatorResult = validate(res.output);
        } catch (err) {
          validatorResult = { ok: false, error: `validator threw: ${err.message}` };
        }
        if (!validatorResult.ok) {
          chain[chain.length - 1].validation_failed = true;
          chain[chain.length - 1].validation_error = validatorResult.error;
          continue; // try next tier
        }
      }
      return {
        ok: true,
        output: res.output,
        parsed: validatorResult?.parsed,
        tier_used: tierName,
        tool: combo.tool,
        model: combo.model,
        latency_ms: res.latency,
        fallback_chain: chain,
        _source: combo.tool === 'ollama'
          ? `ai-completed:ollama:${combo.model}`
          : `ai-completed:${combo.tool}:${combo.model}`,
      };
    }
  }
  return { ok: false, reason: 'all tiers failed validation/exec', fallback_chain: chain };
}

/**
 * Extract JSON object from raw LLM output · tolerant to wrapping markdown / prose.
 */
/**
 * Repair common LLM JSON output mistakes:
 *  - smart/curly quotes → straight quotes
 *  - trailing commas in objects + arrays
 *  - // and /* ... *\/ comments
 *  - Python/JS-style True/False/None
 *  - leading "Here is the JSON: " preamble
 */
function repairJson(text) {
  if (!text) return text;
  let s = String(text);
  // Smart quotes → ASCII
  s = s.replace(/[“”„″]/g, '"').replace(/[‘’‚′]/g, "'");
  // Strip /* ... */ block comments
  s = s.replace(/\/\*[\s\S]*?\*\//g, '');
  // Strip // line comments (but only when NOT inside a string — best-effort)
  s = s.replace(/^[^"\n]*?(\/\/[^\n]*)$/gm, (line) => line.includes('//') && !/^\s*"/.test(line) ? line.replace(/\/\/[^\n]*$/, '') : line);
  // Python literals → JSON
  s = s.replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false').replace(/\bNone\b/g, 'null');
  // Trailing commas before } or ]
  s = s.replace(/,(\s*[}\]])/g, '$1');
  return s.trim();
}

/**
 * Robust extraction of a JSON object from LLM output.
 * Strategies in order:
 *   1. Direct parse
 *   2. Strip markdown code fence (```json ... ``` or ``` ... ```)
 *   3. Repair (smart quotes / trailing commas / comments / Python literals) and parse
 *   4. Find outermost {...} and try parse + repair
 *   5. Find outermost [...] (array root) and try parse + repair
 *   6. Try each balanced {...} candidate scanned from earliest opening brace
 * Returns parsed object or null. Never throws.
 */
export function extractJson(raw) {
  if (!raw) return null;
  const tryParse = (s) => { try { return JSON.parse(s); } catch { return null; } };

  // 1. Direct
  let v = tryParse(raw);
  if (v !== null) return v;

  // 2. Markdown fence (allow language tag or none, allow no trailing newline)
  const fenced = raw.match(/```(?:json|jsonc|json5)?\s*\n?([\s\S]*?)```/i);
  if (fenced) {
    v = tryParse(fenced[1]);
    if (v !== null) return v;
    v = tryParse(repairJson(fenced[1]));
    if (v !== null) return v;
  }

  // 3. Repair-then-parse on whole input
  v = tryParse(repairJson(raw));
  if (v !== null) return v;

  // 4. Outermost {...}
  const objStart = raw.indexOf('{');
  const objEnd = raw.lastIndexOf('}');
  if (objStart >= 0 && objEnd > objStart) {
    const slice = raw.slice(objStart, objEnd + 1);
    v = tryParse(slice) || tryParse(repairJson(slice));
    if (v !== null) return v;
  }

  // 5. Outermost [...] for array roots
  const arrStart = raw.indexOf('[');
  const arrEnd = raw.lastIndexOf(']');
  if (arrStart >= 0 && arrEnd > arrStart) {
    const slice = raw.slice(arrStart, arrEnd + 1);
    v = tryParse(slice) || tryParse(repairJson(slice));
    if (v !== null) return v;
  }

  // 6. Balanced-brace scan from each opening brace (last resort for nested prose)
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] !== '{') continue;
    let depth = 0, inStr = false, esc = false;
    for (let j = i; j < raw.length; j++) {
      const c = raw[j];
      if (inStr) {
        if (esc) esc = false;
        else if (c === '\\') esc = true;
        else if (c === '"') inStr = false;
      } else {
        if (c === '"') inStr = true;
        else if (c === '{') depth++;
        else if (c === '}') {
          depth--;
          if (depth === 0) {
            const cand = raw.slice(i, j + 1);
            v = tryParse(cand) || tryParse(repairJson(cand));
            if (v !== null) return v;
            break;
          }
        }
      }
    }
  }

  return null;
}
