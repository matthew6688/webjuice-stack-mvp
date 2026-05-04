import fs from 'fs';
import path from 'path';

const DEFAULT_OLLAMA_URL = 'http://127.0.0.1:11434';
const DEFAULT_MODEL = 'qwen3.5:9b';

export async function auditRestaurantWithLocalLlm({
  contentPath,
  evidencePath = '',
  outputPath = '',
  model = process.env.OLLAMA_MODEL || DEFAULT_MODEL,
  ollamaUrl = process.env.OLLAMA_URL || DEFAULT_OLLAMA_URL,
  timeoutMs = 180000,
} = {}) {
  if (!contentPath) throw new Error('contentPath is required');
  const content = readJson(contentPath);
  const evidence = evidencePath && fs.existsSync(evidencePath) ? readJson(evidencePath) : null;
  const deterministicFindings = deterministicRestaurantFindings(content, evidence);
  const llmInput = buildAuditPayload(content, evidence, deterministicFindings);
  const llm = await runOllamaAudit({ llmInput, model, ollamaUrl, timeoutMs });
  const findings = normalizeFindings([
    ...deterministicFindings,
    ...(llm.findings || []),
  ]);
  const summary = summarizeFindings(findings);
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    model,
    ollamaUrl: redactLocalUrl(ollamaUrl),
    contentPath,
    evidencePath,
    business: {
      name: content.hero?.name || '',
      menuSections: content.menu?.sections?.length || 0,
      menuItems: countMenuItems(content),
      menuSourceUrl: content.menu?.sourceUrl || '',
      contactPhone: content.contact?.phone || '',
      contactAddress: content.contact?.address || '',
    },
    ok: summary.critical === 0 && summary.high === 0,
    score: llm.score ?? scoreFromFindings(summary),
    verdict: llm.verdict || verdictFromFindings(summary),
    summary,
    deterministicFindings,
    llmFindings: llm.findings || [],
    findings,
    principles: {
      realDataOnly: 'Menu/contact/booking facts should come from official site, Google Places, OCR, or explicit manual evidence.',
      websiteMenuSeparation: 'Website pages should feel like a formal official site; menu pages should be compact mobile utilities.',
      mobileActions: 'Phone, map, reservation, and source actions should work on mobile.',
      noObviousMenuNoise: 'Navigation labels, addresses, phone numbers, and CMS/footer text should not appear as menu items.',
    },
    rawLlm: llm.raw || null,
  };
  if (outputPath) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  return report;
}

export function deterministicRestaurantFindings(content, evidence = null) {
  const findings = [];
  const push = (severity, category, message, evidenceText = '', suggestedFix = '') => {
    findings.push({ severity, category, message, evidence: evidenceText, suggestedFix, source: 'deterministic' });
  };

  if (!content.hero?.name) push('critical', 'identity', 'Restaurant name is missing.');
  if (!content.contact?.phone) push('high', 'contact', 'Phone number is missing.');
  if (!content.contact?.address) push('high', 'contact', 'Address is missing.');
  if (!content.cta?.callUrl?.startsWith('tel:')) push('high', 'mobile_cta', 'Call CTA is missing or not a tel: URL.', content.cta?.callUrl || '');
  if (!content.cta?.mapUrl?.includes('google.com/maps')) push('high', 'mobile_cta', 'Map CTA is missing or not a Google Maps URL.', content.cta?.mapUrl || '');
  if (!content.menu?.sourceUrl) push('high', 'menu_source', 'Menu source URL is missing.');

  const sections = content.menu?.sections || [];
  if (!sections.length) {
    push('critical', 'menu', 'Menu has no sections.');
  }

  const itemKeys = new Map();
  for (const [sectionIndex, section] of sections.entries()) {
    if (!section.name) push('medium', 'menu_section', `Section ${sectionIndex} is missing a name.`);
    if ((section.items || []).length > 30) {
      push('medium', 'menu_density', `Section "${section.name}" has more than 30 items; mobile menu may feel like a dump.`, `${section.items.length} items`, 'Consider splitting the section or keeping high-confidence core items only.');
    }
    for (const [itemIndex, item] of (section.items || []).entries()) {
      const label = `${section.name}[${itemIndex}] ${item.name || '(missing name)'}`;
      if (!item.name) push('high', 'menu_item', `Menu item is missing a name.`, label);
      if (!item.price) push('medium', 'menu_price', `Menu item has no price.`, label);
      if (item.name && item.name.length > 90) push('medium', 'menu_noise', `Menu item name is suspiciously long.`, item.name, 'Check whether this is a note/add-on line rather than a menu item.');
      if (/^(ph\.?|phone|tel\.?)\b/i.test(item.name || '') || /\bqld\s+\d{4}\b/i.test(item.name || '')) {
        push('high', 'menu_noise', 'Menu item looks like contact/address noise.', item.name);
      }
      if (item.generated === true) push('high', 'real_data', 'Menu item is marked generated, not extracted.', label);
      if (!item.sourceUrl && !item.sourceKey) push('medium', 'source_chain', 'Menu item is missing source chain.', label);
      const key = `${String(item.name || '').toLowerCase()}|${String(item.price || '').toLowerCase()}`;
      itemKeys.set(key, (itemKeys.get(key) || 0) + 1);
    }
  }
  for (const [key, count] of itemKeys.entries()) {
    if (count > 2 && key.trim() !== '|') {
      push('medium', 'menu_duplicates', 'Menu has repeated item/price pairs.', `${key} appears ${count} times`, 'Check banquet/list parsing for duplicated inclusions.');
    }
  }

  const menuEvidence = evidence?.resolved?.menu?.sections;
  if (menuEvidence && menuEvidence.sourceType && !['official_site', 'pdf', 'image_ocr', 'firecrawl'].includes(menuEvidence.sourceType)) {
    push('medium', 'source_quality', 'Resolved menu uses a weaker source type than expected.', menuEvidence.sourceType);
  }

  return findings;
}

async function runOllamaAudit({ llmInput, model, ollamaUrl, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${ollamaUrl.replace(/\/$/, '')}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        prompt: buildPrompt(llmInput),
        stream: false,
        format: 'json',
        options: {
          temperature: 0.1,
          top_p: 0.9,
          num_ctx: 12000,
        },
      }),
    });
    if (!res.ok) throw new Error(`Ollama returned HTTP ${res.status}`);
    const data = await res.json();
    const parsed = parseJsonObject(data.response || '{}');
    return {
      verdict: normalizeVerdict(parsed.verdict),
      score: typeof parsed.score === 'number' ? parsed.score : null,
      findings: normalizeFindings(parsed.findings || []).map((finding) => ({ ...finding, source: 'ollama' })),
      raw: parsed,
    };
  } catch (error) {
    return {
      verdict: 'warn',
      score: null,
      findings: [{
        severity: 'medium',
        category: 'local_llm',
        message: `Local LLM audit could not run: ${error.message}`,
        evidence: model,
        suggestedFix: 'Ensure Ollama is running and the selected model is available, then rerun the audit.',
        source: 'ollama',
      }],
      raw: null,
    };
  } finally {
    clearTimeout(timer);
  }
}

function buildPrompt(payload) {
  return `You are a strict QA auditor for an AI-generated restaurant website and mobile menu.

Return JSON only. Do not include markdown. Use this exact shape:
{
  "verdict": "pass" | "warn" | "fail",
  "score": 0-100,
  "findings": [
    {
      "severity": "critical" | "high" | "medium" | "low",
      "category": "real_data" | "menu_noise" | "mobile_cta" | "website_menu_separation" | "contact" | "design_copy" | "source_chain",
      "message": "short finding",
      "evidence": "specific evidence from the input",
      "suggestedFix": "specific fix"
    }
  ]
}

Audit principles:
- Official website route should feel like a formal branded site, not a raw menu dump.
- Menu route should be compact/mobile-friendly and focused on menu facts.
- Menu/contact/booking facts must be backed by source URLs or evidence chains.
- Obvious scrape/OCR/CMS noise must be flagged: phone/address/footer/navigation text as menu items, repeated banquet inclusions, impossible prices, placeholder copy.
- Do not complain about missing exhaustive menus if the current menu is a cleaned high-confidence subset.

Input:
${JSON.stringify(payload, null, 2)}
`;
}

function buildAuditPayload(content, evidence, deterministicFindings) {
  return {
    business: {
      name: content.hero?.name || '',
      cuisine: content.hero?.cuisine || '',
      rating: content.hero?.rating,
      reviewCount: content.hero?.reviewCount,
      address: content.contact?.address || '',
      phone: content.contact?.phone || '',
      website: content.contact?.website || '',
      callUrl: content.cta?.callUrl || '',
      mapUrl: content.cta?.mapUrl || '',
      reserveUrl: content.cta?.reserveUrl || '',
    },
    menu: {
      sourceUrl: content.menu?.sourceUrl || '',
      sectionCount: content.menu?.sections?.length || 0,
      itemCount: countMenuItems(content),
      sections: (content.menu?.sections || []).map((section) => ({
        name: section.name,
        itemCount: section.items?.length || 0,
        sampleItems: (section.items || []).slice(0, 12).map((item) => ({
          name: item.name,
          description: item.description,
          price: item.price,
          sourceUrl: item.sourceUrl,
          generated: item.generated,
        })),
      })),
    },
    contentCopy: {
      heroName: content.hero?.name || '',
      tagline: content.hero?.tagline || '',
      fallbackLevel: content.fallbackLevel || '',
    },
    evidenceSummary: {
      menuSourceType: evidence?.resolved?.menu?.sections?.sourceType || '',
      menuConfidence: evidence?.resolved?.menu?.sections?.confidence || null,
      sourceKeys: (content.menu?.sourceChain || []).map((item) => `${item.key}:${item.sourceType}:${item.confidence}`),
    },
    deterministicFindings: deterministicFindings.slice(0, 20),
  };
}

function normalizeFindings(findings) {
  return (Array.isArray(findings) ? findings : [])
    .map((finding) => ({
      severity: normalizeSeverity(finding.severity),
      category: String(finding.category || 'general'),
      message: String(finding.message || '').trim(),
      evidence: String(finding.evidence || '').trim(),
      suggestedFix: String(finding.suggestedFix || finding.suggestion || '').trim(),
      source: finding.source || 'unknown',
    }))
    .filter((finding) => finding.message);
}

function summarizeFindings(findings) {
  return {
    critical: findings.filter((finding) => finding.severity === 'critical').length,
    high: findings.filter((finding) => finding.severity === 'high').length,
    medium: findings.filter((finding) => finding.severity === 'medium').length,
    low: findings.filter((finding) => finding.severity === 'low').length,
    total: findings.length,
  };
}

function scoreFromFindings(summary) {
  return Math.max(0, 100 - (summary.critical * 30) - (summary.high * 18) - (summary.medium * 8) - (summary.low * 3));
}

function verdictFromFindings(summary) {
  if (summary.critical || summary.high) return 'fail';
  if (summary.medium || summary.low) return 'warn';
  return 'pass';
}

function normalizeVerdict(value) {
  return ['pass', 'warn', 'fail'].includes(value) ? value : null;
}

function normalizeSeverity(value) {
  if (['critical', 'high', 'medium', 'low'].includes(value)) return value;
  if (value === 'error') return 'high';
  if (value === 'warning') return 'medium';
  return 'low';
}

function parseJsonObject(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text || '').match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : {};
  }
}

function countMenuItems(content) {
  return (content.menu?.sections || []).reduce((sum, section) => sum + (section.items?.length || 0), 0);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function redactLocalUrl(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}:${parsed.port || ''}`.replace(/:$/, '');
  } catch {
    return 'local';
  }
}
