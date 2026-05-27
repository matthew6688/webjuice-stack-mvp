#!/usr/bin/env node
/**
 * skills:build — extract JSON build artifact from each SKILL.md
 *
 * Per Codex Round 8 R3 + Round 10 schema: SKILL.md is human-authored canonical.
 * Runtime consumers (pl:compose-site · pl:audit-rubric · pl-validate-single-page-brief)
 * read the JSON sibling, NOT the markdown. Zero hand-maintenance — JSON is regenerated.
 *
 * Phase A scope: only pl-local-trade-page-spec emits a structured JSON. Other PL skills
 * (pl-au-trade-voice / pl-trade-vocab-roofing / pl-anti-slop-catalog / pl-audit-rubric)
 * are TODO Step 3 · this script handles them when they land.
 *
 * Usage:
 *   npm run skills:build                         # build all PL skills
 *   npm run skills:build -- --skill <name>       # build one
 *   npm run skills:build -- --check              # exit 1 if any JSON would change (pre-commit)
 *   npm run skills:build -- --verbose            # log extraction details
 *
 * Canonical JSON schema (Codex Round 10):
 *   {
 *     "name": string,
 *     "version": string,
 *     "kind": "page_spec" | "voice" | "vocab" | "anti_slop_catalog" | "audit_rubric",
 *     "contract": { "inputs_required": [], "outputs_expected": [], "runtime_consumers": [] },
 *     "constants": {},
 *     "rules": [{ id, severity, description, enforced_by: [] }, ...],
 *     "sections": [{ id, name, purpose, hard_rules: [ruleId], anti_patterns: [apId], audit_check_ids: [] }, ...],
 *     "anti_patterns": [{ id, summary, catalog_pointer }, ...]
 *   }
 *
 * Spec: docs/v3/SOP-SINGLE-PAGE-LOCAL-TRADE-STANDARD.md §"Build artifact"
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');
const SKILLS_DIR = path.join(REPO, 'skills');

// ─── PL skills we manage ────────────────────────────────────────────────
const PL_SKILLS = [
  { dir: 'pl-local-trade-page-spec', kind: 'page_spec', extractor: extractPageSpec },
  { dir: 'pl-au-trade-voice',        kind: 'voice',     extractor: extractVoice },
  // TODO Step 3.2:
  // { dir: 'pl-audit-rubric',           kind: 'audit_rubric',       extractor: extractRubric },
];

// ─── Helpers ────────────────────────────────────────────────────────────
function readSkill(dir) {
  const skillPath = path.join(SKILLS_DIR, dir, 'SKILL.md');
  if (!fs.existsSync(skillPath)) return null;
  return { path: skillPath, content: fs.readFileSync(skillPath, 'utf8') };
}

function parseFrontmatter(md) {
  const m = md.match(/^---\n([\s\S]+?)\n---\n/);
  if (!m) return { fm: {}, body: md };
  const lines = m[1].split('\n');
  const fm = {};
  let key = null, multiline = '';
  for (const line of lines) {
    const kv = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (kv) {
      if (key && multiline) fm[key] = multiline.trim();
      key = kv[1]; multiline = kv[2];
    } else if (key && line.trim()) {
      multiline += '\n' + line.trim();
    }
  }
  if (key) fm[key] = multiline.trim();
  return { fm, body: md.slice(m[0].length) };
}

// ─── Page-spec extractor ────────────────────────────────────────────────
function extractPageSpec(md) {
  const { fm, body } = parseFrontmatter(md);

  // Section detection: lines like `### Section N · <id>` or `### Overlay · <id>`
  const sectionHeaderRe = /^### (?:Section \d+ · |Overlay · )`?([a-z][\w-]*)`?[^\n]*$/gm;
  const sectionAnchors = [];
  let m;
  while ((m = sectionHeaderRe.exec(body)) !== null) {
    sectionAnchors.push({ id: m[1], start: m.index });
  }
  // Add hero (Section 1)
  const heroAnchor = body.match(/^## Section 1 · Hero[^\n]*$/m);
  if (heroAnchor) sectionAnchors.unshift({ id: 'hero', start: heroAnchor.index });

  // Walk each section block · extract hard_rules + audit_check_ids + anti_patterns
  const sections = [];
  for (let i = 0; i < sectionAnchors.length; i++) {
    const { id, start } = sectionAnchors[i];
    const end = sectionAnchors[i + 1]?.start ?? body.length;
    const block = body.slice(start, end);
    const purposeMatch = block.match(/\*\*Purpose\*\*[:：]?\s*([^\n]+)/);
    const purpose = purposeMatch ? purposeMatch[1].trim() : '';
    const hardRules = [...block.matchAll(/\*\*([A-Z]-[A-Z]+-\d+|R-[A-Z]+-\d+|D-H-\d+|C-H-\d+|R-[A-Z]{2,4}-\d+)\*\*/g)]
      .map((x) => x[1]);
    const auditIds = [...block.matchAll(/`(mech-[A-Z]+-\d+|vis-[A-Z]+-\d+)`/g)]
      .map((x) => x[1]);
    const antiPatterns = [...block.matchAll(/`?(AS-trade-\d+)`?/g)]
      .map((x) => x[1]);
    sections.push({
      id,
      name: id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      purpose: purpose || null,
      hard_rules: [...new Set(hardRules)],
      anti_patterns: [...new Set(antiPatterns)],
      audit_check_ids: [...new Set(auditIds)],
    });
  }

  // Global rules (R-AUD-* · R-UNI-* in §"Page-level non-negotiable rules")
  const globalRulesBlock = body.match(/## Page-level non-negotiable rules([\s\S]+?)(?=\n## )/);
  const globalRules = [];
  if (globalRulesBlock) {
    const rb = globalRulesBlock[1];
    const ruleRe = /\*\*(R-[A-Z]+-\d+)\*\*\s*·\s*([^\n]+)/g;
    let rm;
    while ((rm = ruleRe.exec(rb)) !== null) {
      globalRules.push({ id: rm[1], severity: 'hard', description: rm[2].trim(), enforced_by: [] });
    }
  }

  // Anti-pattern catalog (AS-trade-1..8)
  const antiPatterns = [];
  const apRe = /\*\*(AS-trade-\d+)\*\*\s*·\s*([^|]+?)(?=\s*(?:catalog|full|\||$))/g;
  let ap;
  while ((ap = apRe.exec(body)) !== null) {
    antiPatterns.push({
      id: ap[1],
      summary: ap[2].trim(),
      catalog_pointer: 'pl-anti-slop-catalog', // TODO Step 3
    });
  }

  // Constants (word budgets · etc.)
  const constants = {
    total_words_min: 1000,
    total_words_max: 1400,
    hero_h1_max_words: 10,
    hero_h1_max_words_owner_voice_exception: 11,
    hero_subhead_min_words: 14,
    hero_subhead_max_words: 25,
    cta_max_words: 5,
    paragraph_max_sentences: 4,
    sentence_max_words: 24,
    phone_min_occurrences: 6,
    suburb_chips_min: 8,
    ship_gate_t1: 'PASS',
    ship_gate_composite_min: 73,
    ship_gate_t5_primary_min: 75,
    ship_gate_t5_secondary_min: 50,
  };

  // Contract (where this skill is read at runtime)
  const contract = {
    inputs_required: [
      'brief schema (TODO Step 4 · core/handoff/single-page-brief-schema.js)',
      'core/audit/personas/*.js (segment data)',
      'clients/<slug>/v2/handoff/od-package/brand/ (brand snapshot)',
    ],
    outputs_expected: [
      'rendered HTML conforming to 11-section sequence',
      'pl-audit-rubric T1/T2/T5 deterministic gates passable (TODO Step 3)',
    ],
    runtime_consumers: [
      'pl:compose-site (renderer · TODO --single-page mode)',
      'pl-validate-single-page-brief (TODO Step 4 · brief schema gate)',
      'pl-audit-rubric (TODO Step 3 · rule + threshold lookup)',
      'pl-llm-page-copywriter-site (loads as prompt context)',
    ],
  };

  return {
    name: fm.name || 'pl-local-trade-page-spec',
    version: fm.metadata?.match(/version:\s*([\d.]+)/)?.[1] || '1.0.0',
    kind: 'page_spec',
    contract,
    constants,
    rules: globalRules,
    sections,
    anti_patterns: antiPatterns,
    _meta: {
      generated_by: 'scripts/cli/skills-build.js',
      generated_at: new Date().toISOString(),
      source: 'skills/pl-local-trade-page-spec/SKILL.md',
      source_sha256: null, // filled below
    },
  };
}

// ─── Voice / vocab extractor (generic markdown contract · codex R15 Q-X-5 a) ─
// Required heading convention:
//   ## §N · <Section Name>                              ← extracted as sections[]
//   ### N.M heading + table or list                     ← rule data
//   `AV-<digit>` / `<niche>V-<digit>` style IDs in §5 build artifact block
// Voice/vocab skills MUST include a §"Build artifact" block with embedded JSON
// (under triple-backtick `json` fence) · this extractor reads + validates it.
function extractVoice(md) {
  const { fm, body } = parseFrontmatter(md);

  // Read embedded JSON in §"Build artifact" block (canonical · author writes it)
  const jsonBlockMatch = body.match(/##\s*§\d+\s*·\s*Build artifact[\s\S]+?```json\n([\s\S]+?)\n```/);
  if (!jsonBlockMatch) {
    throw new Error('voice/vocab SKILL.md MUST contain a §"Build artifact" block with embedded JSON (```json fence)');
  }
  let embedded;
  try {
    embedded = JSON.parse(jsonBlockMatch[1]);
  } catch (e) {
    throw new Error(`voice/vocab build artifact JSON invalid: ${e.message}`);
  }

  // Sanity: required top-level keys
  for (const k of ['name', 'version', 'kind', 'contract', 'constants', 'rules', 'sections']) {
    if (!(k in embedded)) {
      throw new Error(`voice/vocab embedded JSON missing required key: ${k}`);
    }
  }

  // Stamp _meta (will be added by main loop)
  embedded._meta = { generated_by: 'scripts/cli/skills-build.js', generated_at: null, source: null, source_sha256: null };
  return embedded;
}

// ─── Build / check ──────────────────────────────────────────────────────
const args = process.argv.slice(2);
const FLAGS = {
  check: args.includes('--check'),
  verbose: args.includes('--verbose'),
  skillFilter: args.includes('--skill') ? args[args.indexOf('--skill') + 1] : null,
};

let anyChanged = false;
let anyError = false;

for (const skill of PL_SKILLS) {
  if (FLAGS.skillFilter && FLAGS.skillFilter !== skill.dir) continue;
  const file = readSkill(skill.dir);
  if (!file) {
    if (FLAGS.verbose) console.log(`[skip] ${skill.dir} · no SKILL.md`);
    continue;
  }
  let extracted;
  try {
    extracted = skill.extractor(file.content);
  } catch (e) {
    console.error(`[ERROR] ${skill.dir} extraction failed:`, e.message);
    anyError = true;
    continue;
  }
  extracted._meta.source_sha256 = crypto.createHash('sha256')
    .update(file.content).digest('hex').slice(0, 16);
  const jsonPath = path.join(SKILLS_DIR, skill.dir, `${skill.dir}.json`);
  const newJson = JSON.stringify(extracted, null, 2) + '\n';
  // Compare ignoring _meta · timestamps drift but content stability is what we test
  const stripMeta = (j) => { const c = { ...j }; delete c._meta; return JSON.stringify(c, null, 2); };
  const oldJson = fs.existsSync(jsonPath) ? fs.readFileSync(jsonPath, 'utf8') : null;
  let changed;
  if (oldJson === null) {
    changed = true;
  } else {
    try {
      const oldStripped = stripMeta(JSON.parse(oldJson));
      const newStripped = stripMeta(extracted);
      changed = oldStripped !== newStripped;
    } catch {
      changed = true; // can't parse old → regenerate
    }
  }
  if (FLAGS.check) {
    if (changed) {
      console.error(`[check FAIL] ${jsonPath} · regenerate with: npm run skills:build`);
      anyChanged = true;
    } else if (FLAGS.verbose) {
      console.log(`[check ok] ${skill.dir}`);
    }
  } else {
    if (changed) {
      fs.writeFileSync(jsonPath, newJson);
      console.log(`[wrote] ${jsonPath} (${extracted.sections.length} sections · ${extracted.rules.length} rules · ${extracted.anti_patterns.length} anti-patterns)`);
    } else if (FLAGS.verbose) {
      console.log(`[unchanged] ${skill.dir}`);
    }
  }
}

if (FLAGS.check && anyChanged) {
  console.error('\nskills:build --check: 1+ JSON would change · commit aborted');
  process.exit(1);
}
if (anyError) {
  process.exit(2);
}
console.log(FLAGS.check ? 'skills:build --check: clean' : 'skills:build: done');
