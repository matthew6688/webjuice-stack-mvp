#!/usr/bin/env node
/**
 * One-time migration: backfill grade fields on existing entities.
 *
 * For each entity with detailed_audit fixture, compute its grade (Sprint J
 * lead-grading.js) and persist to entity.grade + transition status.
 *
 * Entities without detailed_audit are left alone (still in queue tab).
 *
 * Run: node scripts/leads/migrate-grade-fields.js
 *      node scripts/leads/migrate-grade-fields.js --dry-run
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { gradeLead, persistLeadGrade } from '../../core/scoring/lead-grading.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const entitiesDir = path.join(repoRoot, 'data/leads/entities');
const detailedDir = path.join(repoRoot, 'data/v2/fixtures/detailed-audit');
const reviewsDir = path.join(repoRoot, 'data/v2/fixtures/reviews');

const dryRun = process.argv.includes('--dry-run');

const entities = fs.readdirSync(entitiesDir).filter((f) => f.endsWith('.json'));
console.log(`[migrate] ${entities.length} entities total\n`);

const summary = { with_detailed: 0, graded: 0, archived_D: 0, skipped_no_detailed: 0, errors: 0 };

for (const file of entities) {
  const entityKey = file.replace(/\.json$/, '');
  const detailedPath = path.join(detailedDir, file);
  if (!fs.existsSync(detailedPath)) {
    summary.skipped_no_detailed += 1;
    continue;
  }

  try {
    const entity = JSON.parse(fs.readFileSync(path.join(entitiesDir, file), 'utf8'));
    const detailed = JSON.parse(fs.readFileSync(detailedPath, 'utf8'));
    const reviewPath = path.join(reviewsDir, file);
    const reviewBundle = fs.existsSync(reviewPath) ? JSON.parse(fs.readFileSync(reviewPath, 'utf8')) : null;

    summary.with_detailed += 1;

    const grade = gradeLead({
      entity,
      detailedAudit: detailed.detailed_audit,
      cheapAudit: null,
      techStack: detailed.tech_stack,
      sitemapAnalysis: detailed.sitemap_analysis,
      activity: detailed.activity,
      domainHistory: detailed.domain_history,
      reviewAnalysis: reviewBundle?.analysis || null,
      businessSizeSignal: null,
    });

    if (dryRun) {
      console.log(`  [dry] ${entity.latest?.name?.slice(0, 40).padEnd(40)} → ${grade.investment_level}${grade.product_tier ? '/' + grade.product_tier : ''}`);
      if (grade.investment_level === 'D') summary.archived_D += 1;
      else summary.graded += 1;
      continue;
    }

    const r = persistLeadGrade({ entityKey, grade });
    const tag = grade.investment_level === 'D' ? '🗄  archived' : '✓ graded';
    console.log(`  ${tag}  ${entity.latest?.name?.slice(0, 40).padEnd(40)}  → ${grade.investment_level}${grade.product_tier ? '/' + grade.product_tier : ''}  (status: ${r.status})`);
    if (grade.investment_level === 'D') summary.archived_D += 1;
    else summary.graded += 1;
  } catch (err) {
    console.warn(`  ⚠ ${entityKey}: ${err.message}`);
    summary.errors += 1;
  }
}

console.log('\n[migrate] summary:', summary);
console.log(dryRun ? '(dry-run; nothing written)' : 'Done — entity.grade + status updated.');
