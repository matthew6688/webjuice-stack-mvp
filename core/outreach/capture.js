import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync } from 'child_process';
import { chromium } from 'playwright';

const DESKTOP = { width: 1440, height: 1100 };
const MOBILE = { width: 390, height: 844, isMobile: true };

export async function captureOutreachAssets({
  pack,
  url,
  outputRoot,
  timeoutMs = 45000,
}) {
  const targetUrl = url || pack.previewUrl;
  if (!targetUrl) throw new Error('A preview URL is required');

  const screenshotDesktop = resolveOutput(outputRoot, pack.assets.screenshots.desktop);
  const screenshotMobile = resolveOutput(outputRoot, pack.assets.screenshots.mobile);
  const videoPath = resolveOutput(outputRoot, pack.assets.video);

  fs.mkdirSync(path.dirname(screenshotDesktop), { recursive: true });
  fs.mkdirSync(path.dirname(screenshotMobile), { recursive: true });
  fs.mkdirSync(path.dirname(videoPath), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  try {
    await captureFullPage(browser, targetUrl, DESKTOP, screenshotDesktop, timeoutMs);
    await captureFullPage(browser, targetUrl, MOBILE, screenshotMobile, timeoutMs);
    await captureScrollVideo(browser, targetUrl, DESKTOP, videoPath, timeoutMs);
  } finally {
    await browser.close();
  }

  return {
    url: targetUrl,
    screenshots: {
      desktop: screenshotDesktop,
      mobile: screenshotMobile,
    },
    video: videoPath,
  };
}

export function validateCapturedAssets(paths) {
  const errors = [];
  for (const [label, filePath] of Object.entries({
    desktopScreenshot: paths.screenshots?.desktop,
    mobileScreenshot: paths.screenshots?.mobile,
    video: paths.video,
  })) {
    if (!filePath) {
      errors.push(`${label} path is missing`);
      continue;
    }
    if (!fs.existsSync(filePath)) {
      errors.push(`${label} does not exist: ${filePath}`);
      continue;
    }
    const size = fs.statSync(filePath).size;
    if (size < 1024) errors.push(`${label} is too small: ${filePath}`);
  }
  return { ok: errors.length === 0, errors };
}

async function captureFullPage(browser, url, viewport, outputPath, timeoutMs) {
  const page = await browser.newPage({ viewport });
  await gotoReady(page, url, timeoutMs);
  await page.screenshot({ path: outputPath, fullPage: true });
  await page.close();
}

async function captureScrollVideo(browser, url, viewport, outputPath, timeoutMs) {
  const page = await browser.newPage({ viewport });
  await gotoReady(page, url, timeoutMs);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'webjuice-demo-'));
  try {
    const frameCount = 18;
    const maxScroll = await page.evaluate(() => Math.max(0, document.documentElement.scrollHeight - window.innerHeight));
    for (let i = 0; i < frameCount; i += 1) {
      const ratio = frameCount === 1 ? 0 : i / (frameCount - 1);
      await page.evaluate((scrollY) => window.scrollTo({ top: scrollY, behavior: 'instant' }), Math.round(maxScroll * ratio));
      await page.waitForTimeout(120);
      const framePath = path.join(tmpDir, `frame-${String(i).padStart(3, '0')}.png`);
      await page.screenshot({ path: framePath, fullPage: false });
    }

    execFileSync('ffmpeg', [
      '-y',
      '-framerate', '2',
      '-i', path.join(tmpDir, 'frame-%03d.png'),
      '-vf', 'format=yuv420p',
      '-movflags', '+faststart',
      outputPath,
    ], { stdio: 'ignore' });
  } finally {
    await page.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function gotoReady(page, url, timeoutMs) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs });
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(500);
}

function resolveOutput(outputRoot, filePath) {
  if (path.isAbsolute(filePath)) return filePath;
  return path.resolve(outputRoot || process.cwd(), filePath);
}
