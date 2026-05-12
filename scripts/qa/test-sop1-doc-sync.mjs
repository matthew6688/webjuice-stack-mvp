#!/usr/bin/env node
/**
 * SOP-1 doc/code sync gate · prevent drift from re-creeping in.
 *
 * 检查项 (任一红 → 不让 merge):
 *   1. SOP_HANDOFF_CONTRACT.md status 段落必须列全 DISCOVERY_ENTITY_STATUS 的 10 个值
 *   2. SOP_HANDOFF_CONTRACT.md phase 段落必须列全 ENTITY_PHASE 的 8 个值
 *   3. sop-1.astro 流程图 4 个 step 都存在 (建档/去重/补联系方式/交接)
 *   4. sop-1.astro 不能再画 3a/3b 分支 (已移到 SOP-2)
 *   5. data/sop1/intake-channels.json 标 active-but-broken 的入口在 sop-1.astro 必带 ⚠ 待修
 *
 * 进 CI · 失败 = 文档跟代码脱节 = block merge
 */

import fs from 'node:fs';
import path from 'node:path';
import { DISCOVERY_ENTITY_STATUS, ENTITY_PHASE } from '../../core/leads/discovery-store.js';

const G = '\x1b[32m', R = '\x1b[31m', X = '\x1b[0m';
let pass = 0, fail = 0;
const failures = [];

function check(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  ${G}✓${X} ${label}`); }
  else      { fail++; failures.push(label + (detail ? ' — ' + detail : '')); console.log(`  ${R}✗${X} ${label}${detail ? ' — ' + detail : ''}`); }
}

const root = path.resolve('.');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

console.log('=== SOP-1 doc/code sync gate ===\n');

console.log('Check 1: SOP_HANDOFF_CONTRACT.md status enum 完整');
const handoffDoc = read('docs/SOP_HANDOFF_CONTRACT.md');
for (const v of Object.values(DISCOVERY_ENTITY_STATUS)) {
  check(`  doc mentions status="${v}"`, handoffDoc.includes(`"${v}"`) || handoffDoc.includes(`\`${v}\``) || handoffDoc.includes(` ${v} `),
    `value missing from docs/SOP_HANDOFF_CONTRACT.md`);
}

console.log('\nCheck 2: SOP_HANDOFF_CONTRACT.md phase enum 完整 (小写)');
for (const v of Object.values(ENTITY_PHASE)) {
  check(`  doc mentions phase="${v}"`, handoffDoc.includes(`"${v}"`) || handoffDoc.includes(`\`${v}\``) || handoffDoc.includes(` ${v} `),
    `value missing from docs/SOP_HANDOFF_CONTRACT.md`);
}

console.log('\nCheck 3: SOP_HANDOFF_CONTRACT.md 不能含已弃用 status 值');
const deprecatedStatus = ['archived', 'paid']; // these moved to ENTITY_PHASE
for (const v of deprecatedStatus) {
  // 允许 doc 提到这些值作为 phase (放在 §4 phase 段)，但 §3 status 段不应当列
  const statusSection = handoffDoc.split(/##\s*4\.|##\s*§\s*4/)[0]; // 取 §4 之前的部分
  const phaseStatusOverlap = new RegExp(`status[\\s\\S]{0,200}\\b${v}\\b`, 'i').test(statusSection);
  check(`  status section 不再含弃用值 "${v}"`, !phaseStatusOverlap || statusSection.length > 30_000,
    `"${v}" still appears in status context`);
}

console.log('\nCheck 4: sop-1.astro 流程图 4 个 step 都在');
const sopAdmin = read('src/pages/admin/scoring/sop-1.astro');
for (const stepName of ['建档', '去重', '补联系方式', '交接']) {
  check(`  step contains "${stepName}"`, sopAdmin.includes(stepName));
}

console.log('\nCheck 5: sop-1.astro 不再画 3a/3b 分支 (已并 SOP-2)');
check('  no "3a" branch label', !sopAdmin.includes('flow-step-num">3a'),
  '3a/3b should be merged into single step 3');
check('  no "3b" branch label', !sopAdmin.includes('flow-step-num">3b'),
  '3b should have been moved to SOP-2 post-handoff');
check('  no thin-contact? decision diamond', !/thin-contact\?/i.test(sopAdmin),
  'decision diamond should be removed');

console.log('\nCheck 6: active-but-broken 入口 admin 必须警示');
const registry = JSON.parse(read('data/sop1/intake-channels.json'));
const broken = registry.channels.filter(c => c.status === 'active-but-broken');
if (broken.length > 0) {
  // 这些 broken 入口在 admin 应该有 ⚠ 待修 + known_issue 提示
  check(`  admin 渲染 ⚠ 待修 标记`, sopAdmin.includes('⚠ 待修'),
    'broken channels exist but no warning in admin');
} else {
  check('  no broken channels (skipped)', true);
}

console.log(`\n${pass} pass · ${fail} fail`);
if (fail > 0) {
  console.log(`\n${R}FAILED:${X}`);
  for (const f of failures.slice(0, 20)) console.log(`  ${R}✗${X} ${f}`);
}
process.exit(fail === 0 ? 0 : 1);
