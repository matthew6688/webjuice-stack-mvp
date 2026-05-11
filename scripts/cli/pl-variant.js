#!/usr/bin/env node
/**
 * pl:variant — manage outreach variant registry.
 *
 * Usage:
 *   npm run pl:variant -- list
 *   npm run pl:variant -- list --all                       # incl retired
 *   npm run pl:variant -- show <id>
 *   npm run pl:variant -- retire <id>
 *   npm run pl:variant -- new --subject "..." --body-file <path> --tone friendly --cohort "grade-A roofing"
 *   npm run pl:variant -- new --subject "..." --body-file <path> --hypothesis-auto      # auto-gen via Claude CLI
 */

import fs from 'fs';
import path from 'path';
import { parseArgs, die, emit } from './_pl-shared.js';
import { listVariants, getVariant, registerVariant, retireVariant } from '../../core/outreach/variant-picker.js';
import { generateHypothesis } from '../../core/outreach/hypothesis-generator.js';

const args = parseArgs(process.argv.slice(2));
const sub = args._[0];

if (sub === 'list') {
  const includeRetired = args.all === true;
  const variants = listVariants({ activeOnly: !includeRetired });
  emit({
    ok: true,
    count: variants.length,
    variants: variants.map((v) => ({
      id: v.id, active: v.active, tone: v.tone, primary_metric: v.primary_metric,
      hypothesis: v.hypothesis, subject: v.subject_template,
    })),
  });
} else if (sub === 'show') {
  const id = args._[1];
  if (!id) die('Usage: pl:variant show <id>');
  const v = getVariant(id);
  if (!v) die(`variant not found: ${id}`);
  emit(v);
} else if (sub === 'retire') {
  const id = args._[1];
  if (!id) die('Usage: pl:variant retire <id>');
  const r = retireVariant(id);
  if (!r.ok) die(r.reason);
  emit({ ok: true, retired: r.retired });
} else if (sub === 'new') {
  const subject = args.subject;
  if (!subject) die('--subject required');
  let body = '';
  if (args['body-file']) body = fs.readFileSync(args['body-file'], 'utf8');
  else if (args.body) body = args.body;
  else die('--body or --body-file required');
  const tone = args.tone || 'neutral';
  const cohortHint = args.cohort || 'grade-A roofing';

  let hypothesis = args.hypothesis;
  let primaryMetric = args.metric || args['primary-metric'];

  if (args['hypothesis-auto'] || (!hypothesis && !args['no-auto'])) {
    const dryRun = !process.env.ANTHROPIC_API_KEY && !process.env.CLAUDE_CLI_PATH && process.env.HYPOTHESIS_DRY_RUN !== 'false';
    const gen = await generateHypothesis({ subject, body, tone, cohort_hint: cohortHint, dryRun });
    if (!gen.ok) die(`hypothesis generation failed: ${gen.reason}`);
    hypothesis = hypothesis || gen.hypothesis;
    primaryMetric = primaryMetric || gen.primary_metric;
  }
  if (!hypothesis) die('hypothesis required (use --hypothesis "..." or --hypothesis-auto)');

  // Build id from date + tone
  const date = new Date().toISOString().slice(0, 7);
  const slug = subject.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
  const id = args.id || `v_${date}_${tone}_${slug}`;

  const variant = registerVariant({
    id, active: true, subject_template: subject,
    body_template_path: `${id}/body.md`,
    tone, hypothesis, primary_metric: primaryMetric || 'reply_rate',
    body,
  });
  emit({ ok: true, registered: variant });
} else {
  die('Usage: pl:variant <list|show|retire|new>');
}
