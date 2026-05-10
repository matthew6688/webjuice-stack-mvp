#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { loadLocalEnv } from '../../core/env/load-local-env.js';

loadLocalEnv();

const args = parseArgs(process.argv.slice(2));
const niche = normalizeId(args.niche || 'roofing');
const family = normalizeId(args.family || '');
const root = path.resolve(args.root || process.cwd());
const dryRun = Boolean(args['dry-run'] || args.dryRun);
const provider = args.provider || process.env.IMAGE_PROVIDER || 'openai';
const model = args.model || process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
const apiKey = process.env.OPENAI_API_KEY || process.env.IMAGE_API_KEY || '';
const size = args.size || '1024x1024';
const quality = args.quality || 'low';
const count = Math.max(1, Math.min(Number(args.count || 1), 4));

if (!family) {
  console.error('Usage: node scripts/template-lab/generate-image-candidates.js --niche roofing --family classic-premium-roftix [--dry-run]');
  process.exit(1);
}

const familyDir = path.join(root, 'templates', niche, 'families', family);
const manifestPath = path.join(familyDir, 'template-manifest.json');
const designPath = path.join(familyDir, 'DESIGN.md');
const signalsPath = path.join(familyDir, 'design-signals.json');
if (!fs.existsSync(manifestPath)) throw new Error(`Missing manifest: ${manifestPath}`);

const manifest = readJson(manifestPath);
const prompt = args.prompt || buildImagePrompt({
  manifest,
  designMd: readTextIfExists(designPath),
  signals: readJsonIfExists(signalsPath),
});
const outDir = path.join(familyDir, 'image-candidates', new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(outDir, { recursive: true });

const run = {
  schemaVersion: 1,
  provider,
  model,
  size,
  quality,
  count,
  dryRun,
  prompt,
  generatedAt: new Date().toISOString(),
  images: [],
  costPolicy: {
    note: 'OpenAI GPT Image cost depends on model, size, quality, and image tokens. Keep template experiments low quality until a direction is approved.',
  },
};

if (dryRun || !apiKey) {
  run.status = dryRun ? 'dry_run' : 'missing_api_key';
  run.images = Array.from({ length: count }, (_, index) => ({
    index,
    planned: true,
    file: null,
  }));
} else if (provider === 'openai') {
  run.status = 'generated';
  run.images = await generateOpenAIImages({ apiKey, model, prompt, size, quality, count, outDir });
} else {
  throw new Error(`Unsupported image provider: ${provider}`);
}

const runPath = path.join(outDir, 'image-run.json');
fs.writeFileSync(runPath, `${JSON.stringify(run, null, 2)}\n`);

manifest.imageExperiments = manifest.imageExperiments || [];
manifest.imageExperiments.push({
  provider,
  model,
  path: path.relative(root, runPath),
  status: run.status,
  generatedAt: run.generatedAt,
  images: run.images.map((image) => image.file).filter(Boolean).map((file) => path.relative(root, file)),
});
manifest.updatedAt = new Date().toISOString();
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(JSON.stringify({
  ok: ['generated', 'dry_run'].includes(run.status),
  status: run.status,
  runPath,
  images: run.images,
}, null, 2));

async function generateOpenAIImages({ apiKey: key, model: imageModel, prompt: imagePrompt, size: imageSize, quality: imageQuality, count: n, outDir: outputDir }) {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: imageModel,
      prompt: imagePrompt,
      size: imageSize,
      quality: imageQuality,
      n,
    }),
  });
  const bodyText = await response.text();
  if (!response.ok) throw new Error(`OpenAI image generation failed: ${response.status} ${sanitizeOpenAIError(bodyText)}`.trim());
  const body = JSON.parse(bodyText);
  const images = [];
  for (let i = 0; i < (body.data || []).length; i += 1) {
    const item = body.data[i];
    const file = path.join(outputDir, `candidate-${i + 1}.png`);
    if (item.b64_json) {
      fs.writeFileSync(file, Buffer.from(item.b64_json, 'base64'));
    } else if (item.url) {
      const imageResponse = await fetch(item.url);
      if (!imageResponse.ok) throw new Error(`Unable to download generated image: ${imageResponse.status}`);
      fs.writeFileSync(file, Buffer.from(await imageResponse.arrayBuffer()));
    } else {
      images.push({ index: i, error: 'missing_image_payload' });
      continue;
    }
    images.push({
      index: i,
      file,
      revisedPrompt: item.revised_prompt || '',
    });
  }
  return images;
}

function sanitizeOpenAIError(bodyText) {
  try {
    const body = JSON.parse(bodyText);
    return JSON.stringify({
      error: {
        message: String(body.error?.message || body.message || 'request failed').replace(/sk-[A-Za-z0-9_*.-]+/g, 'sk-***redacted***'),
        type: body.error?.type || body.type || '',
        code: body.error?.code || body.code || '',
        param: body.error?.param || body.param || null,
      },
    });
  } catch {
    return String(bodyText || '').replace(/sk-[A-Za-z0-9_*.-]+/g, 'sk-***redacted***');
  }
}

function buildImagePrompt({ manifest, designMd, signals }) {
  const familyName = manifest.displayName || manifest.family || 'local business template';
  const visualThesis = signals?.visualThesis || extractSection(designMd, 'Overview') || 'premium local-business website photography';
  const imageDirection = signals?.imageDirection?.hero || manifest.visualAssetPlan?.required?.join(', ') || 'hero image';
  const palette = (signals?.palette || [])
    .slice(0, 4)
    .map((color) => `${color.name || 'color'} ${color.hex || ''}`.trim())
    .join(', ');
  return [
    `Create a realistic website hero image candidate for a ${familyName} template.`,
    `Niche: ${manifest.niche}.`,
    `Visual thesis: ${visualThesis}`,
    `Image direction: ${imageDirection}`,
    palette ? `Palette mood: ${palette}` : '',
    'Style: photo-quality, commercial local business website, polished but believable, no text, no logos, no fake badges, no watermarks.',
    'Composition: leave usable negative space for headline and CTA, strong first-viewport impact, real materials and environment.',
    'Avoid: generic clipart, obvious AI artifacts, distorted hands, unreadable signage, fake awards, fake business names.',
  ].filter(Boolean).join('\n');
}

function extractSection(markdown, title) {
  if (!markdown) return '';
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(new RegExp(`^## ${escaped}\\n([\\s\\S]*?)(\\n## |$)`, 'm'));
  return match ? match[1].trim() : '';
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJsonIfExists(filePath) {
  return fs.existsSync(filePath) ? readJson(filePath) : null;
}

function readTextIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function normalizeId(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '');
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) parsed[key] = true;
    else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}
