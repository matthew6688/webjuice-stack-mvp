#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { loadLocalEnv } from '../../core/env/load-local-env.js';
import {
  buildDocumentGenerationPrompt,
  buildDocumentModelComparisonInput,
  evaluateDocumentOutput,
} from '../../core/leads/document-model-comparison.js';

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(args.root || process.cwd());
process.chdir(root);
loadLocalEnv();

const runId = normalizeId(args['run-id'] || args.runId || new Date().toISOString().replace(/[:.]/g, '-'));
const outRoot = path.resolve(args.out || path.join(root, 'data', 'qa', 'document-model-comparison', runId));
const timeoutMs = Number(args.timeout || args['timeout-ms'] || 180000);
const promptVariant = normalizeId(args['prompt-variant'] || args.promptVariant || 'strict-v2');
const input = args.input
  ? JSON.parse(fs.readFileSync(path.resolve(args.input), 'utf8'))
  : buildDocumentModelComparisonInput();
const prompt = buildDocumentGenerationPrompt(input, { variant: promptVariant });
const providers = parseProviders(args.providers || 'deterministic,ollama:gemma3:27b');
const ollamaThink = parseThinkArg(args.think);

fs.mkdirSync(outRoot, { recursive: true });
writeText(path.join(outRoot, 'prompt.txt'), prompt);
writeJson(path.join(outRoot, 'input.json'), input);

const results = [];
for (const provider of providers) {
  const result = await runProvider({ provider, prompt, input, outRoot, timeoutMs });
  results.push(result);
  writeJson(path.join(outRoot, `${safeFileName(provider.id)}.result.json`), result);
  writeText(path.join(outRoot, `${safeFileName(provider.id)}.raw.txt`), result.rawOutput || result.error || '');
}

const ranked = [...results].sort((a, b) => (b.evaluation?.score || 0) - (a.evaluation?.score || 0));
const summary = {
  schemaVersion: 1,
  runId,
  promptVariant,
  outRoot: path.relative(root, outRoot),
  providers: results.map((item) => ({
    id: item.id,
    provider: item.provider,
    model: item.model || null,
    status: item.status,
    durationMs: item.durationMs,
    score: item.evaluation?.score ?? 0,
    grade: item.evaluation?.grade ?? 'F',
    ok: Boolean(item.evaluation?.ok),
    topFindings: (item.evaluation?.findings || []).slice(0, 5),
  })),
  bestProvider: ranked[0]?.id || null,
  generatedAt: new Date().toISOString(),
};
writeJson(path.join(outRoot, 'summary.json'), summary);
console.log(JSON.stringify(summary, null, 2));

async function runProvider({ provider, prompt, input, outRoot, timeoutMs }) {
  const started = Date.now();
  let rawOutput = '';
  let status = 'ok';
  let error = '';
  try {
    if (provider.type === 'deterministic') rawOutput = JSON.stringify(buildDeterministicDocument(input), null, 2);
    else if (provider.type === 'ollama') rawOutput = await runOllama({ model: provider.model, prompt, timeoutMs });
    else if (provider.type === 'codex') rawOutput = runCodex({ prompt, outRoot, timeoutMs });
    else if (provider.type === 'claude') rawOutput = runClaude({ prompt, timeoutMs });
    else throw new Error(`Unknown provider type: ${provider.type}`);
  } catch (caught) {
    status = 'error';
    error = caught?.message || String(caught);
  }
  const durationMs = Date.now() - started;
  const evaluation = evaluateDocumentOutput(rawOutput, input);
  return {
    id: provider.id,
    provider: provider.type,
    model: provider.model || null,
    status,
    durationMs,
    rawOutput,
    error,
    evaluation,
  };
}

async function runOllama({ model, prompt, timeoutMs }) {
  const ollamaUrl = String(args['ollama-url'] || args.ollamaUrl || process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
  const response = await fetch(`${ollamaUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      format: 'json',
      ...(ollamaThink === null ? {} : { think: ollamaThink }),
      options: {
        temperature: 0.2,
        num_predict: 1800,
      },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`ollama ${model} failed: ${response.status} ${text.slice(0, 500)}`);
  const body = JSON.parse(text);
  return body.response || '';
}

function runCodex({ prompt, outRoot, timeoutMs }) {
  const outputFile = path.join(outRoot, 'codex.output.txt');
  const result = spawnSync('codex', [
    'exec',
    '--ignore-user-config',
    '--ephemeral',
    '--output-last-message',
    outputFile,
    prompt,
  ], {
    cwd: root,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `codex exited ${result.status}`);
  return fs.existsSync(outputFile) ? fs.readFileSync(outputFile, 'utf8') : result.stdout;
}

function runClaude({ prompt, timeoutMs }) {
  const result = spawnSync('claude', [
    '-p',
    '--model',
    args['claude-model'] || 'haiku',
    '--max-budget-usd',
    args['claude-budget'] || '0.25',
    '--output-format',
    'text',
    prompt,
  ], {
    cwd: root,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `claude exited ${result.status}`);
  return result.stdout;
}

function buildDeterministicDocument(input) {
  const facts = input.verifiedFacts || {};
  return {
    discoveryReport: {
      businessIdentity: `${facts.businessName} is a roofing and exterior restoration lead from operator-provided sign/photo evidence.`,
      contactPaths: [`Call ${facts.phones?.[0] || ''}`].filter(Boolean),
      services: facts.services || [],
      currentPresence: 'No verified website, email, address, reviews, or Google Business data are present in this fixture.',
      opportunityDiagnosis: 'A phone-first landing page can turn the visible service list into a clear quote path and make the business easier to evaluate.',
      recommendedAngle: 'Free in-person roof inspection and quote for restoration, repairs, gutters, and exterior cleaning.',
      evidenceUsed: ['operator image/text', 'verified phone', 'visible service list', 'source claim about free inspection'],
      missingEvidence: ['website', 'email', 'address/service area', 'Google reviews', 'licence/warranty proof'],
    },
    gapScore: {
      total: 74,
      conversion: 20,
      localSeo: 12,
      designTrust: 18,
      content: 24,
      rationale: 'The lead has a clear phone and service scope but lacks online proof, location, and verified review evidence.',
    },
    websiteProductionSpec: {
      pageMode: 'one_page_preview',
      templateDirection: 'phone-first local roofing repair/restoration page with strong service tiles and inspection CTA',
      blockPlan: [
        { id: 'hero', goal: 'Show roofing/restoration offer, call CTA, and free inspection angle.' },
        { id: 'services', goal: 'Group roof restoration, repairs, gutters, and exterior cleaning into easy quote paths.' },
        { id: 'trust', goal: 'Use process clarity and sourced claims without fake reviews.' },
        { id: 'process', goal: 'Explain call, inspection, advice, and quote steps.' },
        { id: 'faq', goal: 'Answer common inspection and service questions.' },
        { id: 'contact', goal: `Make ${facts.phones?.[0] || 'the phone'} the main conversion route.` },
      ],
      assetPlan: [
        { slot: 'hero', need: 'realistic roofer on roof or strong finished roof image' },
        { slot: 'service', need: 'roof repair/restoration work close-up' },
        { slot: 'proof', need: 'before/after or material detail, marked internally as demo if generated' },
      ],
      contactPlan: { primaryPhone: facts.phones?.[0] || '', email: '', address: '', form: 'name phone service details' },
      seoPlan: { title: 'Roof Restoration and Repairs', localKeywords: ['roof restoration', 'roof repairs', 'gutters', 'pressure cleaning'] },
      factLock: {
        mustKeep: [facts.businessName, ...(facts.phones || [])].filter(Boolean),
        mustNotClaim: ['email', 'address', 'website URL', 'real reviews', 'licence', 'award', 'rating', 'price', 'guarantee'],
      },
    },
    copyBrief: {
      heroHeadline: 'Roof restorations, repairs and gutters made easy to quote',
      heroSubcopy: `Call ${facts.contactName || 'the team'} on ${facts.phones?.[0] || 'the listed phone'} for a free in-person inspection and clear next step.`,
      primaryCta: `Call ${facts.phones?.[0] || 'now'}`,
      serviceCopy: (facts.services || []).slice(0, 6).map((service) => ({
        service,
        copy: `Clear ${service} copy that explains what the homeowner can ask about before booking an inspection.`,
      })),
      faq: [
        'Can I ask for a free inspection before deciding?',
        'What roof issues should I describe when calling?',
        'Can exterior cleaning and gutters be discussed at the same visit?',
      ],
      outreachHook: 'I saw the sign lists roof restorations, gutters, pressure cleaning and a free inspection, but I could not verify a matching website.',
    },
    riskNotes: [
      'Do not fabricate service area, address, email, website, reviews, licences, or warranty claims.',
      'If using generated images or demo reviews, keep that provenance in internal metadata and replace before production launch.',
    ],
  };
}

function parseProviders(value) {
  return String(value || '').split(',').map((raw) => raw.trim()).filter(Boolean).map((raw) => {
    if (raw === 'deterministic') return { id: 'deterministic', type: 'deterministic' };
    if (raw === 'codex') return { id: 'codex', type: 'codex' };
    if (raw === 'claude') return { id: 'claude', type: 'claude' };
    if (raw.startsWith('ollama:')) {
      const model = raw.slice('ollama:'.length);
      return { id: `ollama-${model}`, type: 'ollama', model };
    }
    return { id: raw, type: raw };
  });
}

function parseThinkArg(value) {
  if (value === undefined) return null;
  const normalized = String(value).toLowerCase();
  if (normalized === 'false' || normalized === 'off' || normalized === '0') return false;
  if (normalized === 'true' || normalized === 'on' || normalized === '1') return true;
  return null;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, String(value));
}

function safeFileName(value) {
  return normalizeId(value).replace(/:/g, '-');
}

function normalizeId(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9-_:]+/g, '-').replace(/^-+|-+$/g, '');
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
