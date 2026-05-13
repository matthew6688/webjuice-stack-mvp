/**
 * core/tasks/intent-router.js · SOP-0 Task System
 *
 * Classifies a free-text task input (with optional attachments) into a SOP-0
 * task spec: { kind, target_cli, args, target_entity_key, confidence }.
 *
 * Provider chain (V3 D27 · 2026-05-13 · Matthew: "paid CLI 优先 quality > free"):
 *
 *   default cascade  : codex_cli → claude_cli → ollama → regex
 *                       (paid CLIs use Matthew's subscription · no per-call $$$ ·
 *                        ollama T0 local fallback · regex always-on safety net)
 *
 *   env overrides:
 *     INTENT_ROUTER_CASCADE=claude_cli,ollama    explicit chain
 *     INTENT_ROUTER_CASCADE=ollama               ollama only (fastest · cheap)
 *     TEXT_PROVIDER=ollama  (legacy force)       ollama only
 *
 * Why this order (live E2E + pressure test 2026-05-13 findings):
 *   - ollama (qwen3.5:9b) got 22/24 router tests correct · 2 edge case misses
 *   - Live Discord E2E showed ollama dropped --niche/--city args → CLI exit 1
 *   - codex_cli + claude_cli are smarter at args extraction + edge cases
 *   - Matthew confirmed paid-first preferred when quality matters
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
- intake          : BATCH discovery via gosom Maps SCRAPER (free, unofficial) — vague intent, "find brisbane roofers" / "搜索 melbourne plumbers"
- places-intake   : BATCH discovery via Google Places API (official, paid free-tier) — TRIGGERED by: "places search ..." / "use places ..." / quoted search strings: "roofer brisbane" "roofer gold coast" (multi-query supported)
- single-enrich   : ONE specific business named → resolve via Places + enrich + chain audit. Signals: phone number, Google Maps URL, "this customer", "找这个客户"
- enrich          : enrichment of existing leads in store ("fill missing contacts" general)
- audit           : run audit on an existing entity (entityKey provided like place_chij...)
- dedup           : trigger dedup audit / merge on the store
- photos          : download GMB photos for an entity
- image-extract   : extract leads from image attachment (input has image)
- ops             : ops / system / health-check / cron / admin task

Decision hints (priority order):
- Has image attachment → image-extract (HIGHEST priority for media)
- "places search" / "use places" or **multiple quoted strings as search terms** → places-intake (multi-query)
- Has phone number / Google Maps URL / single quoted business + location → single-enrich
- "find X in Y" / "搜索 X Y" without quotes → intake (gosom)
- entityKey reference → audit

CRITICAL · args extraction rules (V3 2026-05-13 fix · Bug A):

For kind="intake" (batch-maps via gosom): MUST extract --niche AND --city from query.
Examples:
- "find brisbane plumbers"        → args: ["--niche", "plumber",  "--city", "brisbane"]
- "find brisbane plumbers --count 2" → args: ["--niche", "plumber",  "--city", "brisbane", "--count", "2"]
- "搜索 melbourne 屋顶"            → args: ["--niche", "roofing",  "--city", "melbourne"]
- "Sydney roofing companies"      → args: ["--niche", "roofing",  "--city", "sydney"]
- "find dentists in gold coast"   → args: ["--niche", "dentist",  "--city", "gold-coast"]
Common niche words: plumber, roofer/roofing, electrician, dentist, restaurant, cafe, lawyer, hairdresser, photographer, accountant.
Use SINGULAR form ("plumber" not "plumbers"). City: lowercase, hyphenate spaces ("gold-coast").

For kind="places-intake": each quoted string becomes a --query arg.
Example: '"cafe brisbane" "cafe sydney"' → args: ["--query", "cafe brisbane", "--query", "cafe sydney"]

For kind="single-enrich": extract --business-name / --phone / --city / --niche / --website / --gbp-url from text.
Example: "Joe's Plumbing 0412345678 Sydney" → args: ["--business-name", "Joe's Plumbing", "--phone", "0412345678", "--city", "sydney", "--niche", "plumber"]

For kind="audit": extract --entity-key.
Example: "audit place_chij..." → args: ["--entity-key", "place_chij..."]

Input text:
"""
${(text || '').slice(0, 1500)}
"""${att}

JSON schema (all fields required):
{
  "kind":              <one of the 8 kinds above>,
  "target_cli":        <one of: "pl:pipeline-batch-start" | "pl:scrape-docker" | "pl:places-search-intake" | "pl:run-enrichment-batch" | "pl:single-enrich" | "leads:run-pipeline" | "leads:build-master-md" | "pl:dedup-audit" | "pl:download-places-photos" | "pl:ingest-image" | "ops:health-check" | null>,
  "args":              <array of CLI args · follow extraction rules above · NEVER pass raw query as positional args>,
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
  const s = String(text || '');
  const lower = s.toLowerCase();

  // 1. IMAGE — defer to legacy classifier when attachments present
  if (attachments?.length) {
    return {
      kind:              'image-extract',
      target_cli:        'pl:ingest-image',
      args:              [],
      target_entity_key: null,
      confidence:        0.9,
      provider:          'regex',
      reasoning:         'regex/has-image-attachment',
    };
  }

  // 2. AUDIT (V3 Bug fix · pressure test 2026-05-13) — entityKey reference
  // matches place_chij... · image_<slug>_<phone> · domain_<...>
  const entityKey = extractEntityKey(s);
  if (entityKey && (/\b(audit|run\s+audit)\b/i.test(s) || /审计|跑\s*audit/.test(s))) {
    return {
      kind:              'audit',
      target_cli:        'leads:run-pipeline',
      args:              ['--entity-key', entityKey],
      target_entity_key: entityKey,
      confidence:        0.9,
      provider:          'regex',
      reasoning:         'regex/audit-keyword+entityKey',
    };
  }

  // 3. PLACES-INTAKE
  const quotedAll = [...s.matchAll(/["“]([^"”\n]{3,80})["”]/g)].map((m) => m[1].trim());
  const hasPlacesKeyword = /\b(places\s+search|use\s+places|官方搜索|places\s+intake)\b/i.test(s);
  if (quotedAll.length >= 2 || hasPlacesKeyword) {
    const queries = quotedAll.length ? quotedAll : [s.replace(/places\s+search|use\s+places/ig, '').trim()];
    const args = [];
    for (const q of queries) { args.push('--query', q); }
    return {
      kind:              'places-intake',
      target_cli:        'pl:places-search-intake',
      args,
      target_entity_key: null,
      confidence:        0.85,
      provider:          'regex',
      reasoning:         hasPlacesKeyword ? 'regex/places-keyword' : 'regex/multi-quoted',
    };
  }

  // 4. SINGLE-ENRICH
  const hasPhone = /(?:\+?\d[\d\s().-]{7,}\d)/.test(s);
  const hasGbpUrl = /(?:maps\.google\.com|goo\.gl\/maps|maps\.app\.goo\.gl)/i.test(s);
  const hasQuotedName = quotedAll.length === 1;
  if (hasPhone || hasGbpUrl || hasQuotedName) {
    return {
      kind:              'single-enrich',
      target_cli:        'pl:single-enrich',
      args:              buildSingleEnrichArgs(s),
      target_entity_key: entityKey,
      confidence:        0.75,
      provider:          'regex',
      reasoning:         hasGbpUrl ? 'regex/gbp-url' : hasPhone ? 'regex/phone' : 'regex/quoted-name',
    };
  }

  // 5. INTAKE (batch-maps via gosom) · V3 Bug A fix (2026-05-13 pressure test):
  // Detect intake intent BEFORE falling through to legacy classifier.
  // Strong signals: city keyword present, OR niche keyword present, OR
  // "find/search" verb with industry-like noun.
  const heuristicArgs = extractArgsFromText(s, 'intake');
  const hasNiche = heuristicArgs.includes('--niche');
  const hasCity = heuristicArgs.includes('--city');
  const hasFindVerb = /\b(find|search\s+for|search|搜索|搜\s*一?批|查找|listing)\b/i.test(s);
  if (hasNiche || hasCity || (hasFindVerb && /\b(companies|businesses|shops|stores|places)\b/i.test(s))) {
    return {
      kind:              'intake',
      target_cli:        'pl:pipeline-batch-start',
      args:              heuristicArgs,
      target_entity_key: null,
      confidence:        hasNiche && hasCity ? 0.85 : 0.6,
      provider:          'regex',
      reasoning:         `regex/intake niche=${hasNiche} city=${hasCity} verb=${hasFindVerb}`,
    };
  }

  // 6. Fall through to legacy 5-class classifier
  const message = { content: text || '', attachments: attachments || [] };
  const r = classifyWebsiteTask(message);
  const mapped = REGEX_KIND_MAP[r.kind] || { kind: 'ops', target_cli: null };
  return {
    kind:              mapped.kind,
    target_cli:        mapped.target_cli,
    args:              extractArgsFromText(text, mapped.kind),
    target_entity_key: entityKey,
    confidence:        r.confidence || 0.5,
    provider:          'regex',
    reasoning:         `regex/${r.kind}`,
  };
}

/** Extract --business-name / --phone / --gbp-url etc. from free text for single-enrich. */
function buildSingleEnrichArgs(text) {
  const args = [];
  const phone = text.match(/(?:\+?\d[\d\s().-]{7,}\d)/);
  if (phone) args.push('--phone', phone[0].replace(/\s+/g, ''));
  const url = text.match(/https?:\/\/(?:maps\.google\.com|goo\.gl\/maps|maps\.app\.goo\.gl)[^\s)]+/i);
  if (url) args.push('--gbp-url', url[0]);
  const quoted = text.match(/["“]([^"”]{3,60})["”]/);
  if (quoted) args.push('--business-name', quoted[1].trim());
  // niche/city via existing helper
  const nicheCity = extractArgsFromText(text, 'intake');
  for (let i = 0; i < nicheCity.length; i += 2) args.push(nicheCity[i], nicheCity[i + 1]);
  return args;
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

// V3 (2026-05-13 · Bug A fix · pressure test expanded these lists):
// Singularize-aware niche detection · multi-city support.
const NICHE_KEYWORDS = [
  // services
  ['plumber', 'plumber'], ['plumbers', 'plumber'], ['plumbing', 'plumber'],
  ['roofer', 'roofer'], ['roofers', 'roofer'], ['roofing', 'roofer'], ['roof restoration', 'roofer'],
  ['electrician', 'electrician'], ['electricians', 'electrician'], ['electrical', 'electrician'],
  ['painter', 'painter'], ['painters', 'painter'], ['painting', 'painter'],
  ['hvac', 'hvac'], ['ac', 'hvac'], ['air conditioning', 'hvac'], ['heating', 'hvac'],
  ['locksmith', 'locksmith'], ['locksmiths', 'locksmith'],
  ['carpenter', 'carpenter'], ['carpentry', 'carpenter'],
  ['landscaper', 'landscaper'], ['landscaping', 'landscaper'], ['gardener', 'landscaper'],
  ['cleaner', 'cleaner'], ['cleaning', 'cleaner'], ['cleaners', 'cleaner'],
  ['mechanic', 'mechanic'], ['mechanics', 'mechanic'], ['auto repair', 'mechanic'],
  ['detailer', 'auto detail'], ['detailing', 'auto detail'], ['auto detail', 'auto detail'],
  ['panel beater', 'panel beater'], ['panel beaters', 'panel beater'],
  // hospitality
  ['restaurant', 'restaurant'], ['restaurants', 'restaurant'],
  ['cafe', 'cafe'], ['café', 'cafe'], ['cafes', 'cafe'], ['coffee shop', 'cafe'],
  ['bar', 'bar'], ['pub', 'bar'],
  ['bakery', 'bakery'], ['bakeries', 'bakery'],
  // health
  ['dentist', 'dentist'], ['dentists', 'dentist'], ['dental', 'dentist'],
  ['doctor', 'doctor'], ['gp', 'doctor'], ['clinic', 'doctor'],
  ['physio', 'physiotherapist'], ['physiotherapist', 'physiotherapist'],
  ['chiropractor', 'chiropractor'],
  ['vet', 'vet'], ['veterinarian', 'vet'], ['veterinary', 'vet'],
  // beauty / personal
  ['hairdresser', 'hairdresser'], ['hair salon', 'hairdresser'], ['barber', 'hairdresser'],
  ['nail salon', 'nail salon'], ['nails', 'nail salon'],
  ['salon', 'salon'], ['spa', 'spa'], ['massage', 'massage'],
  ['gym', 'gym'], ['fitness', 'gym'], ['pilates', 'gym'], ['yoga', 'gym'],
  // professional
  ['lawyer', 'lawyer'], ['law firm', 'lawyer'], ['solicitor', 'lawyer'], ['attorney', 'lawyer'],
  ['accountant', 'accountant'], ['accounting', 'accountant'], ['cpa', 'accountant'],
  ['photographer', 'photographer'], ['photography', 'photographer'],
  ['real estate', 'real estate'], ['realtor', 'real estate'],
  // 中文 keywords
  ['屋顶', 'roofer'], ['屋顶公司', 'roofer'], ['修屋顶', 'roofer'],
  ['水管', 'plumber'], ['管道工', 'plumber'],
  ['电工', 'electrician'],
  ['牙医', 'dentist'], ['牙科', 'dentist'],
  ['餐厅', 'restaurant'], ['饭店', 'restaurant'],
  ['咖啡', 'cafe'],
  ['美发', 'hairdresser'], ['理发', 'hairdresser'],
  ['律师', 'lawyer'], ['律所', 'lawyer'],
  ['会计', 'accountant'],
];

const CITY_KEYWORDS = [
  ['brisbane', 'brisbane'],
  ['sydney', 'sydney'],
  ['melbourne', 'melbourne'],
  ['perth', 'perth'],
  ['adelaide', 'adelaide'],
  ['canberra', 'canberra'],
  ['hobart', 'hobart'],
  ['darwin', 'darwin'],
  ['gold coast', 'gold-coast'],
  ['sunshine coast', 'sunshine-coast'],
  ['newcastle', 'newcastle'],
  ['wollongong', 'wollongong'],
  ['cairns', 'cairns'],
  ['townsville', 'townsville'],
  ['geelong', 'geelong'],
  ['ipswich', 'ipswich'],
  ['toowoomba', 'toowoomba'],
];

function extractArgsFromText(text, kind) {
  if (kind !== 'intake') return [];
  const lower = String(text || '').toLowerCase();
  const args = [];
  // niche: pick the FIRST match (longer phrases checked first via list order)
  for (const [kw, norm] of NICHE_KEYWORDS) {
    if (lower.includes(kw)) {
      args.push('--niche', norm);
      break;
    }
  }
  // city
  for (const [kw, norm] of CITY_KEYWORDS) {
    if (lower.includes(kw)) {
      args.push('--city', norm);
      break;
    }
  }
  // count: extract --count N or "N companies/businesses"
  const countMatch = lower.match(/--count\s+(\d+)|\b(\d{1,3})\s+(companies|businesses|leads|results)\b/);
  if (countMatch) {
    const n = countMatch[1] || countMatch[2];
    if (n) args.push('--count', n);
  }
  return args;
}

// V3 (2026-05-13 · Bug A): post-LLM normalize · enforce niche/city extraction
// even when the LLM dropped them. LLM args win if present; we only ADD missing.
function normalizeArgsForKind(args, text, kind) {
  if (!Array.isArray(args)) args = [];
  if (kind === 'intake' || kind === 'single-enrich') {
    const hasNiche = args.some((a, i) => a === '--niche' && args[i + 1]);
    const hasCity = args.some((a, i) => a === '--city' && args[i + 1]);
    const heuristic = extractArgsFromText(text, 'intake');
    if (!hasNiche) {
      const i = heuristic.indexOf('--niche');
      if (i >= 0) args = [...args, '--niche', heuristic[i + 1]];
    }
    if (!hasCity) {
      const i = heuristic.indexOf('--city');
      if (i >= 0) args = [...args, '--city', heuristic[i + 1]];
    }
    // Strip any positional args that look like part of the raw query
    // (heuristic: lowercase word not preceded by a --flag)
    const cleaned = [];
    for (let i = 0; i < args.length; i++) {
      const a = String(args[i]);
      if (a.startsWith('--')) {
        cleaned.push(a);
        if (args[i + 1] !== undefined && !String(args[i + 1]).startsWith('--')) {
          cleaned.push(args[i + 1]);
          i++;
        }
      }
      // positional dropped silently
    }
    args = cleaned;
  }
  return args;
}

/* ─── Main entry ──────────────────────────────────────────────────── */

// V3 D27 (2026-05-13): default cascade · paid CLIs first · ollama T0 fallback
const DEFAULT_CASCADE = 'codex_cli,claude_cli,ollama';

export async function routeIntent({ text, attachments = [] } = {}) {
  const errors = [];

  // Build cascade · respect explicit env override, legacy TEXT_PROVIDER, or default
  let cascade;
  if (process.env.INTENT_ROUTER_CASCADE) {
    cascade = process.env.INTENT_ROUTER_CASCADE.split(',').map((s) => s.trim()).filter(Boolean);
  } else if (process.env.TEXT_PROVIDER && process.env.TEXT_PROVIDER !== 'auto') {
    cascade = [process.env.TEXT_PROVIDER];
  } else {
    cascade = DEFAULT_CASCADE.split(',');
  }

  // Walk cascade · first success wins
  for (const provider of cascade) {
    try {
      let out = null;
      if (provider === 'ollama') {
        out = await viaOllama({ text, attachments });
      } else if (provider === 'claude_cli' || provider === 'codex_cli') {
        out = await viaPaidCli(provider, { text, attachments });
      } else {
        errors.push(`${provider}: unknown provider · skipped`);
        continue;
      }
      if (out) {
        out.args = normalizeArgsForKind(out.args, text, out.kind);
        out.upstream_errors = errors.length ? errors : undefined;
        return out;
      }
      errors.push(`${provider}: returned null`);
    } catch (err) {
      errors.push(`${provider}: ${err.message}`);
    }
  }

  // Final fallback · regex always-on safety net
  const out = viaRegex({ text, attachments });
  out.upstream_errors = errors.length ? errors : undefined;
  out.args = normalizeArgsForKind(out.args, text, out.kind);
  return out;
}
