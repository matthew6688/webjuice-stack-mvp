/**
 * core/tasks/image-task-prep.js · SOP-0 P6.X
 *
 * When a Discord forum thread has image attachments, the listener calls this
 * module to:
 *   1. Download attachments to data/inbox/<task_id>/<idx>.<ext>
 *   2. Run vision LLM (Ollama qwen3.6:27b or similar) to extract structured
 *      business fields: businessName / niche / city / phone / address / website
 *   3. Return an args array ready for pl:ingest-image
 *
 * Failure modes (best-effort):
 *   - Download fails → throw; listener falls back to plain image-extract task
 *     with no args (operator-triage)
 *   - Vision fails / returns junk → return partial args (whatever we got);
 *     listener marks task `human` if required fields missing
 *
 * Owner: SOP-0 §3.5 (image-extract path).
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { visionOllama } from '../llm/vision-ollama.js';

const INBOX_DIR = path.resolve(process.cwd(), 'data/inbox');

// Multi-model fallback chain (per Matthew 2026-05-12: "所有文字识别都是一系列模型，
// 前面解决不了就按顺序 fallback"; D43 2026-05-14: 加 codex_cli 当头牌 vision
// provider — 比 ollama 准很多 · 解决 phantom-name 问题).
// Default chain: codex_cli (T3 GPT-5o vision) → qwen3.6:27b → gemma3:27b (T0).
// 标识符:
//   codex_cli           · 通过 `codex exec -i <file>` 调 OpenAI vision
//   <ollama-model-name> · 调本地 ollama (vision-capable)
// To extend: SOP0_IMAGE_VISION_CHAIN=codex_cli,qwen3.6:27b,gemma3:27b,<more>
// Disable codex: SOP0_IMAGE_VISION_CHAIN=qwen3.6:27b,gemma3:27b
const VISION_CHAIN = (process.env.SOP0_IMAGE_VISION_CHAIN
  || process.env.SOP0_IMAGE_VISION_MODEL
  || process.env.VISION_OLLAMA_MODEL
  || 'codex_cli,qwen3.6:27b,gemma3:27b')
  .split(',').map((s) => s.trim()).filter(Boolean);

/* ─── Download Discord attachment ─────────────────────────────────── */

export async function downloadAttachments(taskId, attachments = []) {
  if (!Array.isArray(attachments) || attachments.length === 0) return [];
  const dest = path.join(INBOX_DIR, taskId);
  fs.mkdirSync(dest, { recursive: true });
  const local = [];
  for (let i = 0; i < attachments.length; i += 1) {
    const a = attachments[i];
    if (!a?.url) continue;
    const ct = (a.contentType || '').toLowerCase();
    if (!ct.startsWith('image/')) continue; // skip non-image (PDFs etc handled separately)
    const ext = guessExt(a.filename, ct);
    const fname = `${i}${ext}`;
    const file = path.join(dest, fname);
    const res = await fetch(a.url);
    if (!res.ok) throw new Error(`download failed ${a.url}: HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(file, buf);
    local.push({ ...a, local_path: file, size_bytes: buf.byteLength });
  }
  return local;
}

function guessExt(filename, contentType) {
  const m = String(filename || '').match(/\.([a-z0-9]+)$/i);
  if (m) return '.' + m[1].toLowerCase();
  if (contentType.includes('png')) return '.png';
  if (contentType.includes('webp')) return '.webp';
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return '.jpg';
  if (contentType.includes('gif')) return '.gif';
  if (contentType.includes('heic')) return '.heic';
  return '.bin';
}

/* ─── Vision extraction ───────────────────────────────────────────── */

const EXTRACT_PROMPT = `You are extracting business listing data from an image (business card / signage / Google Maps screenshot / phone screenshot).

Return ONLY a JSON object with these fields (use null for unknown):
{
  "businessName": <string · the business name · see CRITICAL rule below>,
  "niche":        <string · category lowercase: "restaurant"|"cafe"|"plumber"|"roofer"|"electrician"|"dentist"|"hairdresser"|"law-firm"|"photographer"|"other">,
  "city":         <string · city lowercase, hyphenated>,
  "address":      <string · full address if visible>,
  "phone":        <string · phone digits + spaces/dashes OK>,
  "website":      <string · domain or URL>,
  "category":     <string · category as shown in image, freeform>
}

CRITICAL · businessName rules (avoid phantom names):
- Only fill businessName if a real, identifiable company name is visible
  (e.g. "ABC Plumbing", "Joe's Roofing Co", "Smith & Sons").
- DO NOT use service category text as business name. Examples that are NOT
  business names · return null instead:
    × "Roofing Tile/Metal"     (service description)
    × "Tile/Metal Roofing"      (service description)
    × "Restorations Repairs"    (service list)
    × "ROOFING"                 (single category word)
    × "Plumber"                 (single category word)
- Tradie signs without a company name often have ONLY: services + phone + years
  experience. In that case businessName MUST be null. The phone number alone
  is enough to identify the business downstream via Places lookup.
- A real business name typically has at least one of: proper noun (person/place
  name), "Pty Ltd", "Co", "Inc", "& Sons", "Brothers", possessive ('s).

Be strict. Don't guess fields not visible. JSON only, no prose.`;

/** Try one model. Return normalized object or null. */
async function extractWithModel(model, localPath) {
  try {
    if (model === 'codex_cli') return await extractWithCodex(localPath);
    const out = await visionOllama({
      model,
      prompt: EXTRACT_PROMPT,
      imagePaths: [localPath],
      purpose: 'sop0_image_task_extract',
      stage: 'image_task_routing',
      timeoutMs: parseInt(process.env.SOP0_IMAGE_VISION_TIMEOUT_MS || '240000', 10),
      think: false,
    });
    if (!out?.rawText) return null;
    const raw = String(out.rawText).replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const obj = JSON.parse(m[0]);
    return normalize(obj, out.latencyMs);
  } catch (err) {
    return null;
  }
}

/** Codex CLI vision · `echo <prompt> | codex exec -i <file>` · ChatGPT-account compatible.
 *  CLI quirks (D43 实测 2026-05-14):
 *   · prompt 必须通过 stdin · 不能当 positional arg
 *   · --model gpt-4o 在 ChatGPT-account 模式下不支持 · 用默认(gpt-5)
 *   · 输出有 session 头 + "user\n<prompt>\ncodex\n<answer>\ntokens used\n<n>" 格式
 *  Override: SOP0_IMAGE_CODEX_MODEL=<model> (only if account supports it)
 */
function extractWithCodex(localPath) {
  return new Promise((resolve) => {
    const start = Date.now();
    const timeoutMs = parseInt(process.env.SOP0_IMAGE_CODEX_TIMEOUT_MS || '180000', 10);
    const codexModel = process.env.SOP0_IMAGE_CODEX_MODEL || '';
    const finalArgs = codexModel
      ? ['exec', '--model', codexModel, '-i', localPath]
      : ['exec', '-i', localPath];
    const proc = spawn('codex', finalArgs, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    const timer = setTimeout(() => { proc.kill('SIGTERM'); resolve(null); }, timeoutMs);
    proc.on('error', () => { clearTimeout(timer); resolve(null); });
    proc.on('exit', (code) => {
      clearTimeout(timer);
      const latencyMs = Date.now() - start;
      if (code !== 0 || !stdout) return resolve(null);
      // Extract `codex\n<answer>\ntokens used` block · or fallback to whole stdout
      const codexBlock = stdout.match(/\bcodex\b\s*\n([\s\S]+?)(?:\ntokens used|\n--+|$)/i);
      const raw = (codexBlock ? codexBlock[1] : stdout)
        .replace(/^```(?:json)?\s*/im, '').replace(/```\s*$/m, '');
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) return resolve(null);
      try { return resolve(normalize(JSON.parse(m[0]), latencyMs)); }
      catch { return resolve(null); }
    });
    // Send prompt via stdin (codex requires this · positional arg is rejected)
    proc.stdin.write(EXTRACT_PROMPT);
    proc.stdin.end();
  });
}

/**
 * Multi-model fallback extraction. Walks VISION_CHAIN, MERGING fields across
 * models (first non-null wins per field). Stops early if "good enough" (has
 * businessName + niche + city).
 */
export async function extractBusinessFromImage(localPath) {
  const tried = [];
  let merged = null;
  let totalLatency = 0;
  for (const model of VISION_CHAIN) {
    const result = await extractWithModel(model, localPath);
    const ok = !!result;
    const goodFields = result
      ? Object.entries(result).filter(([k, v]) => v && k !== 'latency_ms' && k !== 'tried_models').length
      : 0;
    tried.push({ model, ok, goodFields, latency_ms: result?.latency_ms || 0 });
    if (result) {
      totalLatency += (result.latency_ms || 0);
      // Merge: prefer existing non-null, fill from new
      if (!merged) {
        merged = result;
      } else {
        for (const k of Object.keys(result)) {
          if (k === 'latency_ms' || k === 'tried_models') continue;
          if (!merged[k] && result[k]) merged[k] = result[k];
        }
      }
      // Stop early if we already have key fields
      if (merged.businessName && merged.niche && merged.city) break;
    }
  }
  if (!merged) return null;
  merged.latency_ms = totalLatency;
  merged.tried_models = tried;
  return merged;
}

function normalize(obj, latencyMs) {
  const s = (v) => (typeof v === 'string' && v.trim() && v.trim().toLowerCase() !== 'null')
    ? v.trim()
    : null;
  return {
    businessName: s(obj.businessName) || s(obj.business_name) || s(obj.name),
    niche:        s(obj.niche),
    city:         s(obj.city),
    address:      s(obj.address),
    phone:        s(obj.phone),
    website:      s(obj.website),
    category:     s(obj.category),
    latency_ms:   latencyMs,
  };
}

/* ─── End-to-end prep ─────────────────────────────────────────────── */

/**
 * Given a task that has image attachments, download them, run vision LLM,
 * and synthesize args ready for pl:ingest-image.
 *
 * Returns:
 *   { ok: true, args: [...], extracted: {...}, local_attachments: [...] }
 *   { ok: false, reason: '...', local_attachments: [...] }
 */
export async function prepareImageTask({ taskId, attachments }) {
  let local;
  try {
    local = await downloadAttachments(taskId, attachments);
  } catch (err) {
    return { ok: false, reason: `download failed: ${err.message}`, local_attachments: [] };
  }
  if (local.length === 0) {
    return { ok: false, reason: 'no image attachments to process', local_attachments: [] };
  }
  let extracted;
  try {
    extracted = await extractBusinessFromImage(local[0].local_path);
  } catch (err) {
    return { ok: false, reason: `vision extract failed: ${err.message}`, local_attachments: local };
  }
  if (!extracted || !extracted.businessName) {
    // V3 D40 · 没 business name 时 · 也尝试用 phone 做 Places enrich (有时 OCR 只抽到 phone)
    if (extracted?.phone) {
      try {
        const { enrichFromOCR } = await import('../leads/image-enrich.js');
        const result = await enrichFromOCR(extracted);
        if (result.match) {
          extracted.businessName = result.match.name;
          extracted.address = extracted.address || result.match.address;
          extracted.niche = extracted.niche || result.match.niche;
          extracted.city = extracted.city || result.match.city;
          extracted.website = extracted.website || result.match.website;
          extracted.enrich_method = result.method;
          extracted.enrich_score = result.score;
        }
      } catch (err) {
        // non-blocking
      }
    }
    if (!extracted.businessName) {
      return { ok: false, reason: 'vision returned no businessName', local_attachments: local, extracted };
    }
  }

  // V3 D40 · Multi-angle Places enrich · 即使 OCR 拿到 business_name 也跑 · 拿 place_id 升级
  // (image_xxx → place_xxx) + 补缺 city/address/website
  try {
    const { enrichFromOCR } = await import('../leads/image-enrich.js');
    const result = await enrichFromOCR(extracted);
    if (result.match) {
      // 用 Places 数据覆盖缺失字段 (OCR 字段优先 · Places 兜底)
      extracted.place_id = result.match.place_id;
      extracted.address = extracted.address || result.match.address;
      extracted.niche = extracted.niche || result.match.niche;
      extracted.city = extracted.city || result.match.city;
      extracted.website = extracted.website || result.match.website;
      extracted.enrich_method = result.method;
      extracted.enrich_score = result.score;
      extracted.enrich_match_name = result.match.name;
    } else {
      extracted.enrich_method = 'no_match';
      extracted.enrich_candidates = result.candidates;
    }
  } catch (err) {
    extracted.enrich_method = 'enrich_failed';
    extracted.enrich_error = err.message;
  }

  if (!extracted.niche || !extracted.city) {
    return { ok: false, reason: 'vision + Places enrich 仍缺 niche/city — operator should fill', local_attachments: local, extracted };
  }
  const args = ['--image', local[0].local_path, '--niche', extracted.niche, '--city', extracted.city, '--business-name', extracted.businessName];
  if (extracted.phone)    args.push('--phone',    extracted.phone);
  if (extracted.address)  args.push('--address',  extracted.address);
  if (extracted.website)  args.push('--website',  extracted.website);
  if (extracted.category) args.push('--category', extracted.category);
  return { ok: true, args, extracted, local_attachments: local };
}
