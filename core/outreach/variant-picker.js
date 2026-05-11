/**
 * Variant picker — round-robin over active variants. State persisted to
 * data/outreach/variant-picker-state.json so consecutive picks rotate.
 *
 * Phase A (dev): pure round-robin. Phase B (post-50 sends): epsilon-greedy.
 * Phase C (post-500): Thompson sampling. DISCORD_OUTREACH_PRD.md §6.3 + 5.
 *
 * Today only Phase A is wired.
 */

import fs from 'fs';
import path from 'path';

const VARIANTS_DIR = path.join('data', 'outreach', 'variants');
const STATE_PATH = path.join('data', 'outreach', 'variant-picker-state.json');

export function listVariants({ activeOnly = true } = {}) {
  if (!fs.existsSync(VARIANTS_DIR)) return [];
  const ids = fs.readdirSync(VARIANTS_DIR).filter((f) => fs.statSync(path.join(VARIANTS_DIR, f)).isDirectory());
  const variants = ids.map((id) => {
    const p = path.join(VARIANTS_DIR, id, 'variant.json');
    if (!fs.existsSync(p)) return null;
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
  }).filter(Boolean);
  return activeOnly ? variants.filter((v) => v.active) : variants;
}

export function getVariant(id) {
  const p = path.join(VARIANTS_DIR, id, 'variant.json');
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

export function pickVariant({ tone = null } = {}) {
  let pool = listVariants();
  if (tone) pool = pool.filter((v) => v.tone === tone);
  if (pool.length === 0) return null;
  pool.sort((a, b) => a.id.localeCompare(b.id));

  let state = { counter: 0, last_pick: null };
  if (fs.existsSync(STATE_PATH)) {
    try { state = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')); } catch {}
  }
  const chosen = pool[state.counter % pool.length];
  state.counter += 1;
  state.last_pick = chosen.id;
  state.last_picked_at = new Date().toISOString();
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
  return chosen;
}

export function loadVariantBody(variantId) {
  const variant = getVariant(variantId);
  if (!variant?.body_template_path) return null;
  const p = path.join(VARIANTS_DIR, variant.body_template_path);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, 'utf8');
}

export function registerVariant(variant) {
  if (!variant.id) throw new Error('variant.id required');
  if (!variant.hypothesis) throw new Error('variant.hypothesis required (D11: AI must generate)');
  if (!variant.subject_template) throw new Error('subject_template required');
  const dir = path.join(VARIANTS_DIR, variant.id);
  fs.mkdirSync(dir, { recursive: true });
  const payload = {
    id: variant.id,
    active: variant.active !== false,
    created_at: variant.created_at || new Date().toISOString(),
    retired_at: null,
    subject_template: variant.subject_template,
    body_template_path: variant.body_template_path || `${variant.id}/body.md`,
    send_time_rule: variant.send_time_rule || 'client-local 09:00-17:00 weekday',
    tone: variant.tone || 'neutral',
    hypothesis: variant.hypothesis,
    primary_metric: variant.primary_metric || 'reply_rate',
    tracklayer_campaign_id: variant.tracklayer_campaign_id || null,
  };
  fs.writeFileSync(path.join(dir, 'variant.json'), JSON.stringify(payload, null, 2) + '\n');
  if (variant.body) {
    fs.writeFileSync(path.join(VARIANTS_DIR, payload.body_template_path), variant.body);
  }
  return payload;
}

export function retireVariant(id) {
  const v = getVariant(id);
  if (!v) return { ok: false, reason: 'not_found' };
  v.active = false;
  v.retired_at = new Date().toISOString();
  fs.writeFileSync(path.join(VARIANTS_DIR, id, 'variant.json'), JSON.stringify(v, null, 2) + '\n');
  return { ok: true, retired: v };
}
