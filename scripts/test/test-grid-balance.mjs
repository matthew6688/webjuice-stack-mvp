#!/usr/bin/env node
/**
 * test-grid-balance.mjs · deterministic tests for core/audit/grid-balance.js (Matthew 2026-05-30 · codex wrap-up).
 *
 * The rule: an item-grid must never leave a LONE item on the last row (items % cols == 1, items > cols).
 * 3+2 is fine; 3+1 / 7-in-3col are not. Columns are read from the page's own inline CSS; a center-last
 * CSS safety rule marks a grid orphan-safe.
 *
 * Run: node scripts/test/test-grid-balance.mjs
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkGridBalance } from '../../core/audit/grid-balance.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
process.chdir(REPO);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log(`  ✓ ${m}`); } else { fail++; console.log(`  ✗ ${m}`); } };

// helpers (NOTE: the module only inspects classes containing "grid" — use grid-named test classes)
const grid = (cls, css, n) => `<style>${css}</style><div class="${cls}">${'<article>x</article>'.repeat(n)}</div>`;
const COL3 = '.x-grid{grid-template-columns:repeat(3,minmax(0,1fr));}';
const flags = (html) => checkGridBalance(html).findings.length;

console.log('test-grid-balance:');

// 1. lone-orphan cases MUST flag
ok(flags(grid('x-grid', COL3, 4)) === 1, '4 items in 3-col → flags (3+1 lone orphan)');
ok(flags(grid('x-grid', COL3, 7)) === 1, '7 items in 3-col → flags (3+3+1 lone orphan)');

// 2. balanced cases MUST pass
ok(flags(grid('x-grid', COL3, 3)) === 0, '3 items in 3-col → ok');
ok(flags(grid('x-grid', COL3, 5)) === 0, '5 items in 3-col → ok (3+2, no lone)');
ok(flags(grid('x-grid', COL3, 6)) === 0, '6 items in 3-col → ok');
ok(flags(grid('x-grid', COL3, 2)) === 0, '2 items in 3-col → ok (single short row, no lone-last)');

// 3. modifier class overrides base cols (4 in a 2-col modifier = 2×2, must pass)
const modCss = '.gallery-grid{grid-template-columns:repeat(3,1fr);}.gallery-grid.gallery-grid--2col{grid-template-columns:repeat(2,1fr);}';
ok(flags(grid('gallery-grid gallery-grid--2col', modCss, 4)) === 0, 'gallery-grid--2col modifier makes 4 items pass (2×2)');
ok(flags(grid('gallery-grid', '.gallery-grid{grid-template-columns:repeat(3,1fr);}', 4)) === 1, 'gallery-grid (no modifier) 4 items → flags');

// 4. auto-fit columns are variable → advisory/pass, never a hard orphan
const autoFit = grid('strap-grid', '.strap-grid{grid-template-columns:repeat(auto-fit,minmax(190px,1fr));}', 4);
ok(flags(autoFit) === 0, 'auto-fit grid → not flagged (variable columns)');

// 5. center-last CSS safety rule makes a lone orphan "handled" (no flag)
const safe = grid('story-grid', '.story-grid{grid-template-columns:repeat(3,1fr);}.story-grid>*:last-child:nth-child(3n+1):not(:first-child){grid-column:1/-1;}', 7);
ok(flags(safe) === 0, '7 items WITH center-last CSS safety rule → not flagged (handled)');

// 6. @media mobile overrides must NOT mask the desktop column count
const withMedia = `<style>.x-grid{grid-template-columns:repeat(3,1fr);}@media(max-width:980px){.x-grid{grid-template-columns:1fr;}}</style><div class="x-grid">${'<article>x</article>'.repeat(4)}</div>`;
ok(flags(withMedia) === 1, '@media 1-col override ignored; desktop 3-col 4-item still flags');

console.log(`\ngrid-balance: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
