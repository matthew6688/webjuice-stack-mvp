/**
 * core/tasks/intent-router.js · SOP-0 Task System
 *
 * Classifies a free-text task input (with optional attachments) into a SOP-0
 * task spec: { kind, target_cli, args, target_entity_key, confidence }.
 *
 * Provider chain (per Matthew · 2026-05-12 · "local cheap, paid don't auto-fire"):
 *
 *   default cascade  : ollama (T0 local) → regex (T0 local, always-on safety net)
 *   opt-in cascade   : if INTENT_ROUTER_PAID_FALLBACK set, paid CLIs slot in BEFORE
 *                       regex but AFTER ollama (operator explicitly consents to $)
 *
 *   Examples:
 *     (default)                                  ollama → regex
 *     INTENT_ROUTER_PAID_FALLBACK=claude_cli     ollama → claude_cli → regex
 *     INTENT_ROUTER_PAID_FALLBACK=codex_cli      ollama → codex_cli → regex
 *     TEXT_PROVIDER=ollama  (env force)          ollama only
 *
 * Owner: SOP-0 §3 (docs/SOP_0_TASK_SYSTEM.md)
 *
 * Output schema:
 *   {
 *     kind:              one of KINDS,
 *     target_cli:        npm script name (e.g. 'pl:pipeline-batch-step') or null,
 *     args:              string[] (CLI args),
 *     target_entity_key: entityKey if input referenced an existing entity, else null,
 *     confidence:        0..1,
 *     provider:          'ollama'|'regex'|'claude_cli'|'codex_cli'|'fallback',
 *     reasoning:         short string (debug only)
 *   }
 */

import { textOllama } from '../llm/text-ollama.js';
import { textClaudeCli } from '../llm/text-claude-cli.js';
import { textCodexCli } from '../llm/text-codex-cli.js';
import { classifyWebsiteTask } from '../discord-tasks/task-router.js';
import { KINDS } from './task-store.js';

const OLLAMA_MODEL = process.env.INTENT_ROUTER_OLLAMA_MODEL
  || process.env.OLLAMA_TEXT_MODEL
  || 'qwen3.5:9b';

/* ─── Prompt for LLM router ───────────────────────────────────────── */

function buildRouterPrompt(text, attachments = []) {
  const att = attachments.length
    ? `\nAttachments (${attachments.length}):\n${attachments.map((a) => `- ${a.contentType || 'unknown'} ${a.filename || a.url || ''}`).join('\n')}`
    : '';
  return `You are a task classifier for the ProfitsLocal SOP-0 task system.
Classify the user request into ONE of these kinds. Return ONLY JSON, no prose.

Kinds:
- intake           : new lead discovery (google search / map scrape / find businesses by niche + city)
- enrich           : enrichment of an existing lead's contact info (phone / website / email)
- audit            : run audit pipeline on an existing entity (entityKey provided or implied)
- dedup            : trigger dedup audit / merge on the store
- photos           : download GMB / Google Places photos for an entity
- image-extract    : extract leads from an image / screenshot of a business card / sign
- ops              : ops / system / health-check / cron / admin task

Input text:
"""
${(text || '').slice(0, 1500)}
"""${att}

JSON schema (all fields required):
{
  "kind":              <one of the 7 kinds above>,
  "target_cli":        <one of: "pl:pipeline-batch-start" | "pl:run-enrichment-batch" | "leads:run-pipeline" | "pl:dedup-audit" | "pl:download-places-photos" | "pl:ingest-image" | "ops:health-check" | null>,
  "args":              <array of CLI args, e.g. ["--niche", "roofer", "--city", "brisbane"]; [] if none>,
  "target_entity_key": <string entityKey if found in input, else null>,
  "confidence":        <float 0..1>,
  "reasoning":         <short string, < 50 chars>
}

JSON only, no markdown fences:`;
}

/* ─── Provider impls ──────────────────────────────────────────────── */

async function viaOllama({ text, attachments }) {
  const out = await textOllama({
    model: OLLAMA_MODEL,
    prompt: buildRouterPrompt(text, attachments),
    purpose: 'sop0_intent_route',
    stage: 'task_routing',
    timeoutMs: 30_000,
    format: 'json',
    think: false,
  });
  if (!out || !out.parsedJson) return null;
  return normalizeLlmOutput(out.parsedJson, 'ollama', out.latencyMs);
}

async function viaPaidCli(name, { text, attachments }) {
  const fn = name === 'claude_cli' ? textClaudeCli : name === 'codex_cli' ? textCodexCli : null;
  if (!fn) return null;
  const out = await fn({
    prompt: buildRouterPrompt(text, attachments),
    purpose: 'sop0_intent_route',
    stage: 'task_routing',
    timeoutMs: 60_000,
  });
  if (!out || !out.ok) return null;
  const json = tryParseJson(out.text || out.rawText || '');
  if (!json) return null;
  return normalizeLlmOutput(json, name, out.latencyMs);
}

function viaRegex({ text, attachments }) {
  // Adapt the existing 5-class regex classifier to the SOP-0 7-kind schema.
  // Mapping defined in REGEX_KIND_MAP; preserves regex's confidence number.
  const message = { content: text || '', attachments: attachments || [] };
  const r = classifyWebsiteTask(message);
  const mapped = REGEX_KIND_MAP[r.kind] || { kind: 'ops', target_cli: null };
  return {
    kind:              mapped.kind,
    target_cli:        mapped.target_cli,
    args:              extractArgsFromText(text, mapped.kind),
    target_entity_key: extractEntityKey(text),
    confidence:        r.confidence || 0.5,
    provider:          'regex',
    reasoning:         `regex/${r.kind}`,
  };
}

const REGEX_KIND_MAP = {
  image_lead_discovery: { kind: 'image-extract', target_cli: 'pl:ingest-image' },
  lead_search_discovery:{ kind: 'intake',        target_cli: 'pl:pipeline-batch-start' },
  site_audit:           { kind: 'audit',         target_cli: 'leads:run-pipeline' },
  website_project_task: { kind: 'ops',           target_cli: null },
  general_website_task: { kind: 'ops',           target_cli: null },
};

/* ─── Helpers ─────────────────────────────────────────────────────── */

function tryParseJson(s) {
  if (!s) return null;
  // strip common ```json``` fences
  const cleaned = String(s).replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
  // fallback: extract first {...} block
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

function normalizeLlmOutput(raw, provider, latencyMs) {
  if (!raw || typeof raw !== 'object') return null;
  const kind = KINDS.includes(raw.kind) ? raw.kind : null;
  if (!kind) return null;
  return {
    kind,
    target_cli:        typeof raw.target_cli === 'string' ? raw.target_cli : null,
    args:              Array.isArray(raw.args) ? raw.args.map(String) : [],
    target_entity_key: typeof raw.target_entity_key === 'string' ? raw.target_entity_key : null,
    confidence:        typeof raw.confidence === 'number' ? raw.confidence : 0.7,
    provider,
    reasoning:         typeof raw.reasoning === 'string' ? raw.reasoning.slice(0, 80) : '',
    latency_ms:        latencyMs || null,
  };
}

function extractEntityKey(text) {
  if (!text) return null;
  // entity keys are like 'place_chij...' or 'image_<slug>_<phone>'
  const m = String(text).match(/\b(?:place_[a-z0-9_-]{6,}|image_[a-z0-9_-]+_\d{8,})\b/i);
  return m ? m[0] : null;
}

function extractArgsFromText(text, kind) {
  // very conservative heuristic for intake/photos/audit:
  // detect niche + city keywords and emit --niche X --city Y
  if (kind !== 'intake') return [];
  const lower = String(text || '').toLowerCase();
  const args = [];
  const niches = ['restaurant', 'roofer', 'roofing', 'plumber', 'hvac', 'dentist', 'salon', 'lawyer', 'law firm', 'photographer'];
  const niche = niches.find((n) => lower.includes(n));
  if (niche) args.push('--niche', niche === 'roofing' ? 'roofer' : niche.split(' ')[0]);
  // city: try to grab a 2nd capitalized word after niche or known city
  const cities = ['brisbane', 'sydney', 'melbourne', 'perth', 'adelaide', 'gold coast'];
  const city = cities.find((c) => lower.includes(c));
  if (city) args.push('--city', city.replace(' ', '-'));
  return args;
}

/* ─── Main entry ──────────────────────────────────────────────────── */

export async function routeIntent({ text, attachments = [] } = {}) {
  const errors = [];

  // 1. Try Ollama (T0 local) — unless TEXT_PROVIDER explicitly forces another single provider
  const forced = process.env.TEXT_PROVIDER;
  if (!forced || forced === 'ollama') {
    try {
      const out = await viaOllama({ text, attachments });
      if (out) return out;
      errors.push('ollama: returned null');
    } catch (err) {
      errors.push(`ollama: ${err.message}`);
    }
  }

  // 2. Optional paid CLI fallback (env opt-in, default empty)
  const paidChain = (process.env.INTENT_ROUTER_PAID_FALLBACK || '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  for (const p of paidChain) {
    try {
      const out = await viaPaidCli(p, { text, attachments });
      if (out) return out;
      errors.push(`${p}: returned null`);
    } catch (err) {
      errors.push(`${p}: ${err.message}`);
    }
  }

  // 3. Regex always-on safety net (never fails — even ops/unknown)
  const out = viaRegex({ text, attachments });
  out.upstream_errors = errors.length ? errors : undefined;
  return out;
}
