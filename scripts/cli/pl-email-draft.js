#!/usr/bin/env node
/**
 * pl:email-draft — Compose a cold email draft for an entity.
 *
 * Default mode (post P2.3 eval): AI-generated per-lead via claude_cli
 *   - grade=A → sonnet (T3); grade=B/C → haiku (T1); fallback → qwen3.5:9b (T0)
 *   Routing decision: data/qa/p2-llm-routing-decision.md
 *
 * Legacy mode: --static uses variant body.md template substitution only.
 *
 * Usage:
 *   npm run pl:email-draft -- <entityKey>                  # AI-gen, auto tier
 *   npm run pl:email-draft -- <entityKey> --tier T1        # force haiku
 *   npm run pl:email-draft -- <entityKey> --static         # template substitution only
 *   npm run pl:email-draft -- <entityKey> --variant <id>
 *   npm run pl:email-draft -- <entityKey> --json
 */

import { parseArgs, die, emit, readEntity, readDetailedAudit } from './_pl-shared.js';
import { pickVariant, getVariant, loadVariantBody } from '../../core/outreach/variant-picker.js';
import { generateEmailBody } from '../../core/outreach/email-body-generator.js';

const args = parseArgs(process.argv.slice(2));
const entityKey = args._[0] || args['entity-key'];
if (!entityKey) die('Usage: pl:email-draft <entityKey>');

const entity = readEntity(entityKey);
if (!entity) die(`entity not found: ${entityKey}`);

const variant = args.variant ? getVariant(args.variant) : pickVariant();
if (!variant) die('no active variants available');

// ── AI path (default) ──
if (!args.static) {
  const result = await generateEmailBody(entity, variant.id, { tier: args.tier || 'auto' });
  if (!result.ok) die(`AI generation failed: ${result.reason}; attempts: ${(result.attempts || []).join(' | ')}`);

  if (args.json) {
    emit({
      ok: true,
      entityKey,
      variant_id: variant.id,
      mode: 'ai',
      subject: result.subject,
      body: result.body,
      personalization_notes: result.personalization_notes,
      tier: result.tier,
      provider: result.provider,
      model: result.model,
      latency_ms: result.latency_ms,
      tokens: result.tokens,
      cost_usd_theoretical: result.cost_usd_theoretical,
      body_warning: result.body_warning,
      hypothesis: variant.hypothesis,
      primary_metric: variant.primary_metric,
    });
  } else {
    console.log(`Variant: ${variant.id} (${variant.tone}) · Tier: ${result.tier} · Model: ${result.model} (${result.latency_ms}ms)`);
    console.log(`Hypothesis: ${variant.hypothesis}`);
    if (result.body_warning) console.log(`\n⚠ ${result.body_warning}`);
    console.log(`\nSubject: ${result.subject}\n`);
    console.log('Body:\n');
    console.log(result.body);
    if (result.personalization_notes) console.log(`\n--- personalization notes ---\n${result.personalization_notes}`);
  }
  process.exit(0);
}

// ── Legacy static template path (--static) ──

const audit = readDetailedAudit(entityKey)?.detailed_audit;
const latest = entity.latest || {};

const findings = (audit?.findings || []).slice(0, 3);
function substitute(template) {
  return String(template || '')
    .replace(/\{\{businessName\}\}/g, latest.name || '—')
    .replace(/\{\{firstName\}\}/g, (latest.contact_first_name || latest.name?.split(' ')[0] || 'there'))
    .replace(/\{\{niche\}\}/g, latest.niche || 'business')
    .replace(/\{\{city\}\}/g, latest.city || 'your area')
    .replace(/\{\{websiteUrl\}\}/g, latest.website || '(no website)')
    .replace(/\{\{websiteStatus\}\}/g, (latest.websiteStatus || 'unknown site').replace(/_/g, ' '))
    .replace(/\{\{reviewCount\}\}/g, String(latest.review_count ?? 0))
    .replace(/\{\{rating\}\}/g, String(latest.rating ?? '?'))
    .replace(/\{\{auditReportUrl\}\}/g, `/audit-reports/${entityKey}/internal-audit-report.html`)
    .replace(/\{\{auditFinding1\}\}/g, findings[0]?.label || '(top issue)')
    .replace(/\{\{auditFinding1Short\}\}/g, findings[0]?.label?.split(/[—\-:]/)[0] || 'key conversion elements')
    .replace(/\{\{auditFinding2\}\}/g, findings[1]?.label || '(2nd issue)')
    .replace(/\{\{auditFinding3\}\}/g, findings[2]?.label || '(3rd issue)')
    .replace(/\{\{auditImpact1\}\}/g, findings[0]?.impact || 'reduces inbound trust')
    .replace(/\{\{auditImpact2\}\}/g, findings[1]?.impact || 'hurts conversion')
    .replace(/\{\{auditImpact3\}\}/g, findings[2]?.impact || 'loses traffic')
    .replace(/\{\{estimatedLostLeadsPerMonth\}\}/g, String(Math.max(2, Math.floor((latest.review_count || 30) / 15))));
}

const subject = substitute(variant.subject_template);
const body = substitute(loadVariantBody(variant.id) || '');

if (args.json) {
  emit({
    ok: true,
    entityKey,
    variant_id: variant.id,
    subject,
    body,
    hypothesis: variant.hypothesis,
    primary_metric: variant.primary_metric,
  });
} else {
  console.log(`Variant: ${variant.id} (${variant.tone})`);
  console.log(`Hypothesis: ${variant.hypothesis}\n`);
  console.log(`Subject: ${subject}\n`);
  console.log('Body:\n');
  console.log(body);
}
