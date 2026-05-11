import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const url = 'http://localhost:4321/admin/scoring';
const outDir = 'data/qa/sop2-screenshots';
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
console.log('navigating to', url);
await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

// Full-page screenshot
const fullPath = path.join(outDir, 'admin-scoring-full.png');
await page.screenshot({ path: fullPath, fullPage: true });
console.log('saved', fullPath);

// Above-fold only
const foldPath = path.join(outDir, 'admin-scoring-fold.png');
await page.screenshot({ path: foldPath, fullPage: false });
console.log('saved', foldPath);

await browser.close();
