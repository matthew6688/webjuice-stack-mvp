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
import { visionOllama } from '../llm/vision-ollama.js';

const INBOX_DIR = path.resolve(process.cwd(), 'data/inbox');
const VISION_MODEL = process.env.SOP0_IMAGE_VISION_MODEL
  || process.env.VISION_OLLAMA_MODEL
  || 'qwen3.6:27b';

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
  "businessName": <string · the business name>,
  "niche":        <string · category lowercase: "restaurant"|"cafe"|"plumber"|"roofer"|"electrician"|"dentist"|"hairdresser"|"law-firm"|"photographer"|"other">,
  "city":         <string · city lowercase, hyphenated>,
  "address":      <string · full address if visible>,
  "phone":        <string · phone digits + spaces/dashes OK>,
  "website":      <string · domain or URL>,
  "category":     <string · category as shown in image, freeform>
}

Be strict. Don't guess fields not visible. JSON only, no prose.`;

export async function extractBusinessFromImage(localPath) {
  const out = await visionOllama({
    model: VISION_MODEL,
    prompt: EXTRACT_PROMPT,
    imagePaths: [localPath],
    purpose: 'sop0_image_task_extract',
    stage: 'image_task_routing',
    timeoutMs: parseInt(process.env.SOP0_IMAGE_VISION_TIMEOUT_MS || '240000', 10),
    think: false,
  });
  if (!out?.rawText) return null;
  // Some Ollama vision models wrap in fences; strip and find first {…}
  const raw = String(out.rawText).replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const obj = JSON.parse(m[0]);
    return normalize(obj, out.latencyMs);
  } catch {
    return null;
  }
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
    return { ok: false, reason: 'vision returned no businessName', local_attachments: local, extracted };
  }
  if (!extracted.niche || !extracted.city) {
    return { ok: false, reason: 'vision missing niche/city — operator should fill', local_attachments: local, extracted };
  }
  const args = ['--image', local[0].local_path, '--niche', extracted.niche, '--city', extracted.city, '--business-name', extracted.businessName];
  if (extracted.phone)    args.push('--phone',    extracted.phone);
  if (extracted.address)  args.push('--address',  extracted.address);
  if (extracted.website)  args.push('--website',  extracted.website);
  if (extracted.category) args.push('--category', extracted.category);
  return { ok: true, args, extracted, local_attachments: local };
}
