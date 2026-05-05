import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 1400 },
  { name: 'mobile', width: 390, height: 1200, isMobile: true },
];

export async function captureReviewScreenshots({
  url,
  outputDir,
  repoRoot = process.cwd(),
  prefix = 'review',
  timeoutMs = 45000,
} = {}) {
  if (!url) throw new Error('url is required');
  if (!outputDir) throw new Error('outputDir is required');
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch();
  const screenshots = [];
  const consoleErrors = [];
  try {
    for (const viewport of VIEWPORTS) {
      const page = await browser.newPage({
        viewport: { width: viewport.width, height: viewport.height },
        isMobile: Boolean(viewport.isMobile),
      });
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(`${viewport.name}: ${message.text()}`);
      });
      const response = await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs });
      const status = response?.status() || 0;
      if (status >= 400) throw new Error(`Screenshot target returned HTTP ${status}: ${url}`);
      const filePath = path.join(outputDir, `${prefix}-${viewport.name}.png`);
      await page.screenshot({ path: filePath, fullPage: true });
      await page.close();
      screenshots.push(toRepoRelative(filePath, repoRoot));
    }
  } finally {
    await browser.close();
  }
  return {
    ok: true,
    url,
    screenshots,
    consoleErrors,
    outputDir: toRepoRelative(outputDir, repoRoot),
    capturedAt: new Date().toISOString(),
  };
}

function toRepoRelative(filePath, repoRoot) {
  const relative = path.relative(repoRoot || process.cwd(), filePath);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative)
    ? relative
    : filePath;
}
