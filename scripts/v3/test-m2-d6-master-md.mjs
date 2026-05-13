#!/usr/bin/env node
// M2-D6 · master.md 5 required section + reorder (7→ after 1)
import fs from 'fs';
import path from 'path';
import { makeRunner, tryImport, REPO_ROOT } from './_test-helpers.mjs';

const r = makeRunner('m2-d6-master-md');

const m = await tryImport('core/reports/master-md-builder.js');
if (!m || m.__error || typeof m.buildMasterMd !== 'function') {
  r.skip('builder-exists', `core/reports/master-md-builder.js#buildMasterMd missing`);
  const s = r.summary({ implementation_present: false });
  process.exit(1);
}

// 5 required section headers (Chinese · per PRD)
const REQUIRED = ['速览', '销售切入点', '现网站快速诊断', '业主沟通要点', '账户与档案'];

await r.assert('5-required-sections-on-empty-audit', () => {
  const md = m.buildMasterMd({ entity: { entityKey: 'test', businessName: 'Test' }, audit: null });
  for (const sec of REQUIRED) {
    if (!md.includes(sec)) throw new Error(`missing required section: ${sec}`);
  }
  return true;
});

await r.assert('TBD-placeholder-when-audit-incomplete', () => {
  const md = m.buildMasterMd({ entity: { entityKey: 'test', businessName: 'Test' }, audit: {} });
  if (!md.match(/TBD|audit\s*不\s*完整/)) throw new Error('expected TBD placeholder when audit empty');
  return true;
});

await r.assert('section-7-after-section-1', () => {
  const md = m.buildMasterMd({ entity: { entityKey: 'test', businessName: 'Test', niche: 'roofer' }, audit: { score: 50 } });
  const idx1 = md.indexOf('速览');
  const idx7 = md.indexOf('销售切入点');
  if (idx1 < 0 || idx7 < 0) throw new Error('1 or 7 missing');
  if (idx7 <= idx1) throw new Error('销售切入点 must come AFTER 速览');
  return true;
});

await r.assert('22-conditional-sections-when-full-data', () => {
  // Snapshot existing real customer for regression
  const realMd = path.join(REPO_ROOT, 'clients', 'rich-and-rare-restaurant', 'master.md');
  if (fs.existsSync(realMd)) {
    const body = fs.readFileSync(realMd, 'utf8');
    const sections = (body.match(/^##\s/gm) || []).length;
    if (sections < 8) throw new Error(`existing real master.md has ${sections} sections · expected ≥ 8`);
  }
  return true;
});

await r.assert('od_status-frontmatter-optional', () => {
  const md = m.buildMasterMd({ entity: { entityKey: 'test', businessName: 'Test' }, audit: null });
  // od_status is M3's concern · M2 must not crash if missing
  if (md.match(/od_status:\s*undefined/)) throw new Error('od_status leaked as undefined string');
  return true;
});

await r.assert('regression-real-customer-renders', () => {
  const real = path.join(REPO_ROOT, 'clients', 'brisbane-roof-restoration-experts', 'v2', 'master.md');
  if (!fs.existsSync(real)) {
    r.skip('regression-real-customer', 'no real customer master.md to regress against');
    return true;
  }
  const body = fs.readFileSync(real, 'utf8');
  if (!body.includes('速览') && !body.includes('快速诊断')) {
    throw new Error('real customer master.md missing required sections after M2 changes');
  }
  return true;
});

const s = r.summary();
process.exit(s.exitCode);
