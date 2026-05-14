/**
 * V3 D40 (2026-05-14) · Image OCR 补充 enrich · 多角度 Google Places search + AI judgment
 *
 * 用于 image-extract 入口 · OCR 抽完后调用此 module:
 *   1. 5 个搜索角度 (phone-only · name-only · name+city · name+niche+city · phone+niche)
 *   2. 候选 dedup by place_id · 评分 (phone=50 · name=30 · niche=10 · city=5 · services=5)
 *   3. ≥ 80 自动用 · 50-80 AI judgment 复核 · < 50 返候选给 operator
 *
 * Cost: ~$0.07-0.20 per image (4 Places API calls · AI ~$0.002 only on medium-confidence)
 */

import { resolveBusinessFromSignals } from './single-enrich-resolver.js';

/** Normalize phone to digits only (compare AU mobile vs landline format) */
function normalizePhone(s) {
  if (!s) return '';
  return String(s).replace(/[^0-9]/g, '').replace(/^61/, '0'); // +61 → 0 (AU local format)
}

/** Levenshtein-based fuzzy match 0-1 · case + punctuation insensitive */
function fuzzyMatch(a, b) {
  if (!a || !b) return 0;
  const na = String(a).toLowerCase().replace(/[^a-z0-9]/g, '');
  const nb = String(b).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;
  // simple distance: count chars in common
  const longer = na.length > nb.length ? na : nb;
  const shorter = na.length > nb.length ? nb : na;
  let common = 0;
  for (const ch of shorter) if (longer.includes(ch)) common++;
  return Math.min(common / longer.length, 0.85);
}

/** Niche overlap · OCR niche vs candidate.types[] (GBP categories) */
function nicheOverlap(ocrNiche, candidateTypes) {
  if (!ocrNiche || !Array.isArray(candidateTypes)) return false;
  const niche = String(ocrNiche).toLowerCase();
  const nicheMap = {
    roofer: ['roofing_contractor', 'general_contractor'],
    plumber: ['plumber', 'plumbing_supply_store'],
    electrician: ['electrician', 'electrical_supply_store'],
    restaurant: ['restaurant', 'cafe', 'meal_takeaway'],
    dentist: ['dentist', 'dental_clinic'],
    auto: ['car_repair', 'auto_repair', 'panelbeater'],
    painter: ['painter'],
    landscape: ['landscape_designer', 'landscaping'],
  };
  const expected = nicheMap[niche] || [niche];
  for (const t of candidateTypes) {
    if (expected.some((e) => t.toLowerCase().includes(e) || e.includes(t.toLowerCase()))) return true;
  }
  return false;
}

/** Score 1 candidate vs OCR result · 0-100 */
function scoreMatch(candidate, ocr) {
  let score = 0;
  const reasons = [];

  // Phone (50) - normalize both, exact match
  const candPhone = normalizePhone(candidate.phone || candidate.formatted_phone_number);
  const ocrPhone = normalizePhone(ocr.phone);
  if (candPhone && ocrPhone && candPhone === ocrPhone) {
    score += 50;
    reasons.push('phone exact');
  }

  // Name fuzzy match (30)
  const nameSim = fuzzyMatch(candidate.name, ocr.businessName);
  if (nameSim >= 0.95) { score += 30; reasons.push(`name 完全`); }
  else if (nameSim >= 0.8) { score += 22; reasons.push(`name ${(nameSim * 100).toFixed(0)}%`); }
  else if (nameSim >= 0.6) { score += 12; reasons.push(`name 部分 ${(nameSim * 100).toFixed(0)}%`); }

  // Niche overlap (10)
  const types = candidate.types || candidate.gbp_categories || [];
  if (nicheOverlap(ocr.niche, types)) {
    score += 10;
    reasons.push('niche match');
  }

  // City in address (5)
  if (ocr.city && candidate.address) {
    if (String(candidate.address).toLowerCase().includes(String(ocr.city).toLowerCase())) {
      score += 5;
      reasons.push('city in address');
    }
  }

  // Services overlap (5) · OCR services 中任一在 candidate types/categories 出现
  if (Array.isArray(ocr.services) && ocr.services.length && Array.isArray(types)) {
    const hit = ocr.services.some((s) => {
      const ns = String(s).toLowerCase();
      return types.some((t) => String(t).toLowerCase().includes(ns) || ns.includes(String(t).toLowerCase()));
    });
    if (hit) { score += 5; reasons.push('services overlap'); }
  }

  return { score, reasons };
}

/** AI judgment for medium-confidence candidates (50-80 score) */
async function aiJudgeMatch(candidate, ocr) {
  try {
    const { runText } = await import('../llm/text-adapter.js');
    const prompt = `Below is data from an OCR'd business flyer/card and a Google Places API candidate.
Are they the SAME business?

OCR extracted:
- phone: ${ocr.phone || '?'}
- business_name: ${ocr.businessName || '?'}
- niche: ${ocr.niche || '?'}
- city: ${ocr.city || '?'}
- services: ${(ocr.services || []).join(', ') || '?'}

Places candidate:
- name: ${candidate.name}
- address: ${candidate.address || '?'}
- phone: ${candidate.phone || candidate.formatted_phone_number || '?'}
- rating: ${candidate.rating || '?'} · ${candidate.user_ratings_total || 0} reviews
- categories: ${(candidate.types || []).join(', ')}
- website: ${candidate.website || '?'}

Consider: phone match (AU sometimes has mobile + landline · 0424 + 07 numbers from same store).
Name similarity (allow "Pty Ltd" suffix · plurals · abbreviation).
Niche/categories overlap.
Geographic context (suburb in same metro area).

Output STRICT JSON · no prose:
{"match_likely":true,"confidence":85,"reasoning":"brief"}`;

    const out = await runText({
      prompt,
      tier: 'T0',                     // ollama → claude → codex cascade
      maxTokens: 200,
    });
    const text = out?.text || out?.content || String(out);
    const m = text.match(/\{[\s\S]*?"match_likely"[\s\S]*?\}/);
    if (m) return JSON.parse(m[0]);
    return { match_likely: false, confidence: 0, reasoning: 'AI parse failed' };
  } catch (err) {
    return { match_likely: false, confidence: 0, reasoning: `AI error: ${err.message}` };
  }
}

/**
 * Main · multi-angle Places search + scoring + AI judgment.
 *
 * @param {object} ocr · { businessName · phone · niche · city · services? · ... }
 * @returns {{
 *   match: { name, place_id, address, phone, ... } | null,
 *   candidates: Array,           // 全候选 (sorted by score)
 *   method: 'high_confidence' | 'ai_judgment' | 'no_match' | 'low_confidence',
 *   score: number,               // top candidate score
 *   ai_verdict?: { match_likely, confidence, reasoning }
 * }}
 */
export async function enrichFromOCR(ocr) {
  if (!ocr) return { match: null, candidates: [], method: 'no_match', score: 0 };

  // 5 个搜索角度 · 各取 top 1 候选 (single-enrich-resolver 默认拿第 1)
  const angles = [];
  if (ocr.phone) {
    angles.push({ label: 'phone-only', signals: { phone: ocr.phone } });
  }
  if (ocr.businessName && ocr.city) {
    angles.push({ label: 'name+city', signals: { businessName: ocr.businessName, city: ocr.city } });
  }
  if (ocr.businessName) {
    angles.push({ label: 'name-only', signals: { businessName: ocr.businessName } });
  }
  if (ocr.businessName && ocr.niche && ocr.city) {
    angles.push({ label: 'name+niche+city', signals: { businessName: ocr.businessName, niche: ocr.niche, city: ocr.city } });
  }
  if (ocr.phone && ocr.niche) {
    angles.push({ label: 'phone+niche', signals: { phone: ocr.phone, niche: ocr.niche } });
  }

  if (angles.length === 0) {
    return { match: null, candidates: [], method: 'no_match', score: 0, reason: 'no usable signals' };
  }

  // Run all angles in parallel (Places API 不并发限制)
  const results = await Promise.allSettled(angles.map(async (a) => {
    try {
      const r = await resolveBusinessFromSignals(a.signals);
      return { angle: a.label, ok: r.ok, lead: r.lead, candidates: r.candidates };
    } catch (err) {
      return { angle: a.label, ok: false, reason: err.message };
    }
  }));

  // Collect all candidate leads · dedupe by place_id
  const seen = new Map();
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    const lead = r.value?.lead;
    if (!lead?.place_id) continue;
    if (!seen.has(lead.place_id)) {
      seen.set(lead.place_id, { ...lead, found_via: r.value.angle });
    }
  }
  const unique = Array.from(seen.values());

  if (unique.length === 0) {
    return { match: null, candidates: [], method: 'no_match', score: 0 };
  }

  // Score each
  const scored = unique.map((c) => {
    const { score, reasons } = scoreMatch(c, ocr);
    return { ...c, score, reasons };
  }).sort((a, b) => b.score - a.score);

  const top = scored[0];

  // High confidence (>=80) · use directly
  if (top.score >= 80) {
    return { match: top, candidates: scored.slice(0, 5), method: 'high_confidence', score: top.score };
  }

  // Medium confidence (50-79) · AI judgment
  if (top.score >= 50) {
    const aiVerdict = await aiJudgeMatch(top, ocr);
    if (aiVerdict.match_likely && aiVerdict.confidence >= 70) {
      return { match: top, candidates: scored.slice(0, 5), method: 'ai_judgment', score: top.score, ai_verdict: aiVerdict };
    }
    // AI 说不像 · 返候选给 operator
    return { match: null, candidates: scored.slice(0, 5), method: 'low_confidence', score: top.score, ai_verdict: aiVerdict };
  }

  // Low (<50) · operator pick
  return { match: null, candidates: scored.slice(0, 5), method: 'low_confidence', score: top.score };
}
