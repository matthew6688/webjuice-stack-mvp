#!/usr/bin/env node
/**
 * pl:llm-eval — run the same prompt across multiple LLMs, report
 * latency / tokens / cost / output for side-by-side comparison.
 *
 * Used to decide which local model to pin for heartbeat (P2.1) and
 * for AI body generation (P2.3).
 *
 * Usage:
 *   npm run pl:llm-eval -- --task heartbeat --entityKey <key>
 *   npm run pl:llm-eval -- --task email-body --entityKey <key> --variant v_2026-05_audit-led
 *   npm run pl:llm-eval -- --task heartbeat --entityKey <key> --models qwen3.5:9b,qwen3.6:27b,gemma3:27b
 *   npm run pl:llm-eval -- --task heartbeat --entityKey <key> --include-cli   # also test claude_cli
 *   npm run pl:llm-eval -- --task heartbeat --entityKey <key> --output md > eval.md
 */

import fs from 'fs';
import path from 'path';
import { parseArgs, die, readEntity, readDetailedAudit, ROOT } from './_pl-shared.js';
import { textOllama } from '../../core/llm/text-ollama.js';
import { textClaudeCli } from '../../core/llm/text-claude-cli.js';
import { deriveLocale, nowInLocale } from '../../core/leads/locale.js';
import { getVariant, loadVariantBody } from '../../core/outreach/variant-picker.js';

const args = parseArgs(process.argv.slice(2));
const task = args.task || 'heartbeat';
const entityKey = args.entityKey || args._[0];
if (!entityKey) die('Usage: pl:llm-eval --task heartbeat|email-body --entityKey <key>');
const entity = readEntity(entityKey);
if (!entity) die(`entity not found: ${entityKey}`);
const outputFmt = args.output || 'json';
const includeCli = args['include-cli'] === true;

const defaultModels = ['qwen3.5:9b', 'qwen3.6:27b', 'gemma3:27b', 'deepseek-r1:14b'];
const models = args.models ? String(args.models).split(',').map(s => s.trim()) : defaultModels;

function buildHeartbeatPrompt(entity) {
  const audit = readDetailedAudit(entity.entityKey)?.detailed_audit;
  const locale = deriveLocale(entity);
  return `You are the per-lead heartbeat agent. Decide ONE next action.

LEAD CONTEXT:
- Name: ${entity.latest?.name}
- Niche: ${entity.latest?.niche || 'unknown'}
- City: ${entity.latest?.city || 'unknown'}
- Grade: ${entity.grade?.investment_level} / ${entity.grade?.product_tier || '-'}
- Phase: ${entity.phase || 'unset'}${entity.sub_status ? ` (${entity.sub_status})` : ''}
- Last reply class: ${entity.last_reply_class || 'none'}
- Reviews: ${entity.latest?.review_count || 0} @ ${entity.latest?.rating || '?'}★
- Website: ${entity.latest?.website || 'NONE'} (${entity.latest?.websiteStatus || 'unknown'})
- Audit score: ${audit?.audit_score || 'none'}/100 (${audit?.decision || 'none'})
- Email signals: sent=${entity.signals?.sent || 0} replied=${entity.signals?.replied || 0}
- Last contact: ${entity.last_contact_at || 'never'}
- Client local time: ${nowInLocale(locale)}

Output JSON ONLY (no prose) with these keys:
  - next_action: one of [idle, draft_email, send_followup, advance_to_replied, archive, flag_needs_human]
  - reason: 1 sentence explaining why
  - confidence: float 0-1
  - suggested_tone: one of [friendly, direct, formal, curious]`;
}

function buildEmailBodyPrompt(entity, variantId) {
  const variant = getVariant(variantId);
  if (!variant) die(`variant not found: ${variantId}`);
  const audit = readDetailedAudit(entity.entityKey)?.detailed_audit;
  const findings = (audit?.findings || []).slice(0, 5).map((f, i) => `  ${i+1}. ${f.label || f.id} — ${f.impact || ''}`).join('\n');
  return `Write a personalized cold outreach email for this lead. Use the variant tone + hypothesis as guide, but make every sentence specific to THIS business (not generic).

LEAD:
- Business: ${entity.latest?.name}
- Niche: ${entity.latest?.niche}
- City: ${entity.latest?.city}
- Website: ${entity.latest?.website} (${entity.latest?.websiteStatus})
- Reviews: ${entity.latest?.review_count}★${entity.latest?.rating}
- Audit score: ${audit?.audit_score}/100
- Top findings:
${findings || '  (no findings)'}

VARIANT GUIDE:
- Subject template: ${variant.subject_template}
- Tone: ${variant.tone}
- Hypothesis: ${variant.hypothesis}

Output JSON ONLY (no prose) with these keys:
  - subject: subject line (max 70 chars)
  - body: email body (max 200 words), no signature, plain text
  - personalization_notes: 1 sentence on what you specifically referenced from this lead`;
}

const prompt = task === 'email-body'
  ? buildEmailBodyPrompt(entity, args.variant || 'v_2026-05_audit-led')
  : buildHeartbeatPrompt(entity);

const results = [];

for (const model of models) {
  process.stderr.write(`Testing ${model}... `);
  const t0 = Date.now();
  let out;
  try {
    out = await textOllama({ prompt, model, think: false });
  } catch (err) {
    out = { ok: false, reason: err.message };
  }
  const latency = Date.now() - t0;
  results.push({
    provider: 'ollama',
    model,
    tier: 'T0',
    latency_ms: latency,
    tokens_in: out.tokensIn || 0,
    tokens_out: out.tokensOut || 0,
    cost_usd_actual: 0,
    parsed: out.parsedJson || null,
    raw_excerpt: (out.rawText || '').slice(0, 200),
    ok: !!out.parsedJson,
    reason: out.reason,
  });
  process.stderr.write(`${latency}ms\n`);
}

if (includeCli) {
  for (const cliModel of ['haiku', 'sonnet']) {
    process.stderr.write(`Testing claude_cli ${cliModel}... `);
    const t0 = Date.now();
    let out;
    try {
      out = await textClaudeCli({ prompt, model: cliModel, purpose: 'llm_eval' });
    } catch (err) {
      out = { ok: false, reason: err.message };
    }
    const latency = Date.now() - t0;
    results.push({
      provider: 'claude_cli',
      model: cliModel,
      tier: 'T1',
      latency_ms: latency,
      tokens_in: out.tokensIn || 0,
      tokens_out: out.tokensOut || 0,
      cost_usd_actual: 0,
      cost_usd_theoretical: out.theoreticalCostUsd || 0,
      parsed: out.parsedJson || null,
      raw_excerpt: (out.rawText || '').slice(0, 200),
      ok: !!out.parsedJson,
    });
    process.stderr.write(`${latency}ms\n`);
  }
}

if (outputFmt === 'md') {
  const lines = [];
  lines.push(`# LLM eval — ${task} — ${entity.latest?.name || entityKey}\n`);
  lines.push(`**Entity**: \`${entityKey}\` · grade=${entity.grade?.investment_level} · phase=${entity.phase || 'unset'}\n`);
  lines.push(`## Comparison\n`);
  lines.push('| Model | Tier | Latency | Tokens (in/out) | Cost | Parsed JSON |');
  lines.push('|---|---|---|---|---|---|');
  for (const r of results) {
    const cost = r.tier === 'T0' ? '$0' : `$${(r.cost_usd_theoretical || 0).toFixed(4)} (subs)`;
    lines.push(`| ${r.model} | ${r.tier} | ${r.latency_ms}ms | ${r.tokens_in}/${r.tokens_out} | ${cost} | ${r.ok ? '✓' : '✗'} |`);
  }
  lines.push('\n## Outputs\n');
  for (const r of results) {
    lines.push(`### ${r.model} (${r.tier})\n`);
    if (r.parsed) {
      lines.push('```json');
      lines.push(JSON.stringify(r.parsed, null, 2));
      lines.push('```\n');
    } else {
      lines.push(`**failed to parse JSON**: \`${r.reason || 'unknown'}\``);
      lines.push(`raw: \`${r.raw_excerpt}\`\n`);
    }
  }
  console.log(lines.join('\n'));
} else {
  console.log(JSON.stringify({
    ok: true,
    task,
    entityKey,
    entity_name: entity.latest?.name,
    prompt_chars: prompt.length,
    models_tested: results.length,
    summary: results.map((r) => ({ model: r.model, tier: r.tier, latency_ms: r.latency_ms, tokens: `${r.tokens_in}/${r.tokens_out}`, parsed_ok: r.ok })),
    details: results,
  }, null, 2));
}
