#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { loadLocalEnv } from '../../core/env/load-local-env.js';

loadLocalEnv();

const args = parseArgs(process.argv.slice(2));
const niche = normalizeId(args.niche || 'roofing');
const family = normalizeId(args.family || '');
const root = path.resolve(args.root || process.cwd());
const images = toArray(args.image || args.images);
const urls = toArray(args.url || args.urls);
const dryRun = Boolean(args['dry-run'] || args.dryRun);
const provider = args.provider || process.env.DESIGN_SIGNAL_PROVIDER || 'openai';
const model = args.model || process.env.OPENAI_VISION_MODEL || 'gpt-5.2';
const apiKey = process.env.OPENAI_API_KEY || process.env.IMAGE_API_KEY || '';

if (!family) {
  console.error('Usage: node scripts/template-lab/extract-design-signals.js --niche roofing --family classic-premium-roftix --image /path/ref.png [--dry-run]');
  process.exit(1);
}

const familyDir = path.join(root, 'templates', niche, 'families', family);
const manifestPath = path.join(familyDir, 'template-manifest.json');
if (!fs.existsSync(manifestPath)) throw new Error(`Missing manifest: ${manifestPath}`);

const outputPath = args.output
  ? path.resolve(args.output)
  : path.join(familyDir, 'design-signals.json');

const input = {
  provider,
  model,
  dryRun,
  niche,
  family,
  images: images.map((imagePath) => normalizeInputPath(imagePath)),
  urls,
};

let signals;
if (dryRun || !apiKey) {
  signals = buildDryRunSignals(input, apiKey ? '' : 'missing_openai_api_key');
} else if (provider === 'openai') {
  signals = await extractWithOpenAI({ input, apiKey, model });
} else {
  throw new Error(`Unsupported design signal provider: ${provider}`);
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(signals, null, 2)}\n`);

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.designSignals = {
  path: path.relative(root, outputPath),
  provider,
  model,
  inputImages: input.images.map((item) => item.path),
  inputUrls: input.urls,
  generatedAt: signals.generatedAt,
  status: signals.ok ? 'ready' : 'needs_attention',
};
manifest.sourceInputs = manifest.sourceInputs || {};
manifest.sourceInputs.screenshots = Array.from(new Set([...(manifest.sourceInputs.screenshots || []), ...input.images.map((item) => item.path)]));
manifest.sourceInputs.urls = Array.from(new Set([...(manifest.sourceInputs.urls || []), ...input.urls]));
manifest.updatedAt = new Date().toISOString();
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(JSON.stringify({
  ok: signals.ok,
  outputPath,
  dryRun,
  provider,
  model,
  images: input.images.length,
  urls: input.urls.length,
  status: manifest.designSignals.status,
}, null, 2));

async function extractWithOpenAI({ input: extractionInput, apiKey: key, model: visionModel }) {
  const imageContent = extractionInput.images.map((image) => ({
    type: 'input_image',
    image_url: image.dataUrl,
  }));
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: visionModel,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: buildExtractionPrompt(extractionInput),
            },
            ...imageContent,
          ],
        },
      ],
      text: {
        format: {
          type: 'json_object',
        },
      },
    }),
  });

  const bodyText = await response.text();
  if (!response.ok) throw new Error(`OpenAI design signal extraction failed: ${response.status} ${bodyText}`.trim());
  const body = JSON.parse(bodyText);
  const text = body.output_text || body.output?.flatMap((item) => item.content || []).map((part) => part.text).filter(Boolean).join('\n') || '';
  const parsed = JSON.parse(text);
  return normalizeSignals({ ...parsed, provider: extractionInput.provider, model: visionModel, dryRun: false });
}

function buildExtractionPrompt(extractionInput) {
  return `You are extracting a machine-readable web design contract from reference screenshots and links for a local-business website template.

Return only valid JSON. Do not invent facts about a real business. Focus on visual design signals, not brand copying.

Context:
- niche: ${extractionInput.niche}
- family: ${extractionInput.family}
- reference urls: ${extractionInput.urls.join(', ') || 'none'}

JSON schema:
{
  "ok": true,
  "referenceSummary": "short summary",
  "visualThesis": "one sentence",
  "palette": [{"name":"primary","hex":"#000000","usage":"..."}],
  "typography": {"display":"...", "body":"...", "label":"...", "notes":"..."},
  "imageDirection": {"hero":"...", "services":"...", "projects":"...", "mustAvoid":["..."]},
  "layoutRhythm": [{"section":"hero","pattern":"..."}],
  "componentTokens": {"radius":"...", "border":"...", "shadow":"...", "button":"..."},
  "ctaHierarchy": ["..."],
  "fidelityRisks": ["..."],
  "openDesignRules": ["..."],
  "publicApprovalChecklist": ["..."]
}`;
}

function buildDryRunSignals(extractionInput, reason = '') {
  return normalizeSignals({
    ok: true,
    dryRun: true,
    provider: extractionInput.provider,
    model: extractionInput.model,
    reason,
    referenceSummary: 'Dry-run design signal extraction. Real vision extraction requires OPENAI_API_KEY.',
    visualThesis: `${titleize(extractionInput.family)} should be extracted from the provided screenshot or reference URL before Open Design runs.`,
    palette: [
      { name: 'primary', hex: '#111111', usage: 'placeholder until vision extraction' },
      { name: 'accent', hex: '#F25A1D', usage: 'placeholder CTA/accent' },
      { name: 'surface', hex: '#FFFFFF', usage: 'placeholder page surface' },
    ],
    typography: {
      display: 'extract from screenshot',
      body: 'extract from screenshot',
      label: 'extract from screenshot',
      notes: 'Dry-run only.',
    },
    imageDirection: {
      hero: 'extract from screenshot or linked reference',
      services: 'extract from screenshot or linked reference',
      projects: 'extract from screenshot or linked reference',
      mustAvoid: ['text-only hero', 'generic SVG-only primary visual for photo-heavy references'],
    },
    layoutRhythm: [
      { section: 'hero', pattern: 'extract from screenshot' },
      { section: 'services', pattern: 'extract from screenshot' },
    ],
    componentTokens: {
      radius: 'extract',
      border: 'extract',
      shadow: 'extract',
      button: 'extract',
    },
    ctaHierarchy: ['extract primary and secondary CTA treatment'],
    fidelityRisks: ['dry-run output cannot approve visual fidelity'],
    openDesignRules: ['Bind source screenshots and design signals before generation.'],
    publicApprovalChecklist: ['Human approval required before publication.'],
  });
}

function normalizeSignals(raw) {
  return {
    schemaVersion: 1,
    ok: raw.ok !== false,
    dryRun: Boolean(raw.dryRun),
    provider: raw.provider || provider,
    model: raw.model || model,
    generatedAt: new Date().toISOString(),
    reason: raw.reason || '',
    referenceSummary: raw.referenceSummary || '',
    visualThesis: raw.visualThesis || '',
    palette: Array.isArray(raw.palette) ? raw.palette : [],
    typography: raw.typography || {},
    imageDirection: raw.imageDirection || {},
    layoutRhythm: Array.isArray(raw.layoutRhythm) ? raw.layoutRhythm : [],
    componentTokens: raw.componentTokens || {},
    ctaHierarchy: Array.isArray(raw.ctaHierarchy) ? raw.ctaHierarchy : [],
    fidelityRisks: Array.isArray(raw.fidelityRisks) ? raw.fidelityRisks : [],
    openDesignRules: Array.isArray(raw.openDesignRules) ? raw.openDesignRules : [],
    publicApprovalChecklist: Array.isArray(raw.publicApprovalChecklist) ? raw.publicApprovalChecklist : [],
  };
}

function normalizeInputPath(inputPath) {
  const absolute = path.resolve(inputPath);
  if (!fs.existsSync(absolute)) throw new Error(`Reference image not found: ${absolute}`);
  const ext = path.extname(absolute).toLowerCase();
  const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png';
  const bytes = fs.readFileSync(absolute);
  return {
    path: path.relative(root, absolute),
    absolute,
    mime,
    bytes: bytes.length,
    dataUrl: `data:${mime};base64,${bytes.toString('base64')}`,
  };
}

function toArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(toArray);
  return String(value).split(',').map((item) => item.trim()).filter(Boolean);
}

function normalizeId(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '');
}

function titleize(value) {
  return String(value).split(/[-_\s]+/).filter(Boolean).map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(' ');
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
