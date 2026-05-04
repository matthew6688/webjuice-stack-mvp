import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { runOcrmypdf } from '../ocr/ocrmypdf.js';
import { readOcrTextOutput, runPaddleOcr } from '../ocr/paddleocr.js';
import { writeMenuEvidenceFromText } from './menu.js';

const MIN_MENU_ITEMS = 3;

export async function extractMenuDocument({
  inputPath,
  clientSlug,
  sourceUrl = '',
  sourceType = '',
  outputDir = '',
  evidencePath = '',
  businessName = '',
  dryRun = false,
  useFirecrawlFallback = false,
  firecrawlParse = null,
} = {}) {
  if (!inputPath) throw new Error('inputPath is required');
  if (!clientSlug) throw new Error('clientSlug is required');

  const resolvedOutputDir = outputDir || path.join('clients', clientSlug, 'artifacts', 'menu-document');
  fs.mkdirSync(resolvedOutputDir, { recursive: true });
  const manifest = {
    schemaVersion: 1,
    inputPath,
    clientSlug,
    sourceUrl: sourceUrl || inputPath,
    sourceType: sourceType || inferSourceType(inputPath),
    outputDir: resolvedOutputDir,
    attempts: [],
    selectedAttempt: null,
    evidencePath: evidencePath || `clients/${clientSlug}/evidence/evidence.json`,
    createdAt: new Date().toISOString(),
  };

  const markitdown = runMarkitdownAttempt(inputPath, path.join(resolvedOutputDir, 'markitdown.md'), { dryRun });
  manifest.attempts.push(markitdown);
  let selected = markitdown.ok && markitdown.itemCount >= MIN_MENU_ITEMS ? markitdown : null;

  if (!selected && isTextLike(inputPath)) {
    const direct = runDirectTextAttempt(inputPath);
    manifest.attempts.push(direct);
    if (direct.ok && direct.itemCount >= MIN_MENU_ITEMS) selected = direct;
  }

  if (!selected && isPdf(inputPath)) {
    const searchablePdf = path.join(resolvedOutputDir, 'ocrmypdf-searchable.pdf');
    const ocrPdf = runOcrmypdfAttempt(inputPath, searchablePdf, { dryRun });
    manifest.attempts.push(ocrPdf);
    if (ocrPdf.ok) {
      const afterOcr = runMarkitdownAttempt(searchablePdf, path.join(resolvedOutputDir, 'ocrmypdf-markitdown.md'), { dryRun });
      afterOcr.provider = 'ocrmypdf+markitdown';
      manifest.attempts.push(afterOcr);
      if (afterOcr.ok && afterOcr.itemCount >= MIN_MENU_ITEMS) selected = afterOcr;
    }
  }

  if (!selected && isImage(inputPath)) {
    const paddle = runPaddleAttempt(inputPath, path.join(resolvedOutputDir, 'paddleocr'), { dryRun });
    manifest.attempts.push(paddle);
    if (paddle.ok && paddle.itemCount >= MIN_MENU_ITEMS) selected = paddle;
  }

  if (!selected && useFirecrawlFallback && firecrawlParse) {
    const firecrawl = await firecrawlParse(inputPath, {
      outputPath: path.join(resolvedOutputDir, 'firecrawl-parse.md'),
      dryRun,
    });
    manifest.attempts.push(normalizeAttempt('firecrawl_parse', firecrawl));
    const last = manifest.attempts.at(-1);
    if (last.ok && last.itemCount >= MIN_MENU_ITEMS) selected = last;
  }

  selected ||= bestAttempt(manifest.attempts);
  manifest.selectedAttempt = selected ? selected.provider : null;

  if (selected?.ok && selected.textPath && !dryRun) {
    const confidence = confidenceForAttempt(selected);
    const pack = writeMenuEvidenceFromText(fs.readFileSync(selected.textPath, 'utf8'), {
      clientSlug,
      businessName,
      sourceUrl: sourceUrl || inputPath,
      sourceType: selected.sourceType || manifest.sourceType,
      outputPath: evidencePath,
      confidence,
    });
    manifest.evidenceSummary = summarizeEvidence(pack);
  }

  const manifestPath = path.join(resolvedOutputDir, 'manifest.json');
  if (!dryRun) fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { ...manifest, manifestPath };
}

function runMarkitdownAttempt(inputPath, outputPath, { dryRun }) {
  const provider = 'markitdown';
  const binary = findBinary('markitdown');
  if (!binary) return failedAttempt(provider, 'markitdown_not_installed');
  if (dryRun) return dryAttempt(provider, outputPath);
  try {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    execFileSync(binary, [inputPath, '-o', outputPath], { stdio: ['ignore', 'pipe', 'pipe'] });
    return textAttempt(provider, outputPath, { sourceType: inferSourceType(inputPath) });
  } catch (error) {
    return failedAttempt(provider, outputFromError(error));
  }
}

function runDirectTextAttempt(inputPath) {
  return textAttempt('direct_text', inputPath, { sourceType: 'official_site' });
}

function runOcrmypdfAttempt(inputPath, outputPath, { dryRun }) {
  const provider = 'ocrmypdf';
  if (dryRun) return dryAttempt(provider, outputPath);
  try {
    runOcrmypdf({ inputPath, outputPath });
    return {
      provider,
      ok: true,
      outputPath,
      textPath: '',
      textLength: 0,
      itemCount: 0,
    };
  } catch (error) {
    return failedAttempt(provider, error.message);
  }
}

function runPaddleAttempt(inputPath, outputPath, { dryRun }) {
  const provider = 'paddleocr';
  if (dryRun) return dryAttempt(provider, outputPath);
  try {
    runPaddleOcr({ inputPath, outputPath });
    const text = readOcrTextOutput(outputPath);
    const textPath = path.join(path.dirname(outputPath), 'paddleocr.txt');
    fs.writeFileSync(textPath, text);
    return textAttempt(provider, textPath, { sourceType: 'image_ocr' });
  } catch (error) {
    return failedAttempt(provider, error.message);
  }
}

function textAttempt(provider, textPath, extra = {}) {
  const text = fs.readFileSync(textPath, 'utf8');
  return {
    provider,
    ok: true,
    textPath,
    textLength: text.trim().length,
    itemCount: countPriceLines(text),
    ...extra,
  };
}

function normalizeAttempt(provider, result = {}) {
  if (!result?.ok) return failedAttempt(provider, result?.error || 'failed');
  return {
    provider,
    ok: true,
    textPath: result.textPath || '',
    textLength: Number(result.textLength || 0),
    itemCount: Number(result.itemCount || 0),
    sourceType: result.sourceType || provider,
  };
}

function bestAttempt(attempts) {
  return attempts
    .filter((attempt) => attempt.ok && attempt.textPath)
    .sort((a, b) => (b.itemCount - a.itemCount) || (b.textLength - a.textLength))[0] || null;
}

function failedAttempt(provider, error) {
  return { provider, ok: false, error: String(error || 'failed'), textPath: '', textLength: 0, itemCount: 0 };
}

function dryAttempt(provider, outputPath) {
  return { provider, ok: true, dryRun: true, outputPath, textPath: '', textLength: 0, itemCount: 0 };
}

function confidenceForAttempt(attempt) {
  if (attempt.provider === 'markitdown') return 0.82;
  if (attempt.provider === 'ocrmypdf+markitdown') return 0.74;
  if (attempt.provider === 'paddleocr') return 0.66;
  if (attempt.provider === 'firecrawl_parse') return 0.76;
  return 0.62;
}

function summarizeEvidence(pack) {
  const sections = pack.resolved?.menu?.sections?.value || [];
  return {
    sections: sections.length,
    items: sections.reduce((sum, section) => sum + (section.items?.length || 0), 0),
  };
}

function countPriceLines(text) {
  return String(text || '').split('\n').filter((line) => /\d{1,3}(?:\.\d{1,2})?\s*$/.test(line.trim())).length;
}

function inferSourceType(inputPath) {
  if (isPdf(inputPath)) return 'pdf';
  if (isImage(inputPath)) return 'image_ocr';
  return 'official_site';
}

function isTextLike(inputPath) {
  return ['.txt', '.md', '.markdown'].includes(path.extname(inputPath).toLowerCase());
}

function isPdf(inputPath) {
  return path.extname(inputPath).toLowerCase() === '.pdf';
}

function isImage(inputPath) {
  return ['.png', '.jpg', '.jpeg', '.webp', '.tif', '.tiff'].includes(path.extname(inputPath).toLowerCase());
}

function findBinary(name) {
  const paths = (process.env.PATH || '').split(path.delimiter);
  for (const dir of paths) {
    const candidate = path.join(dir, name);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function outputFromError(error) {
  return `${error.stdout || ''}${error.stderr || ''}${error.message || ''}`.trim();
}
