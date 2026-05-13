#!/usr/bin/env node
// Generate 5 hero/service/project images for classic-premium-roftix reference-site
// using OpenAI gpt-image-1. Saves directly into reference-site/assets/.
import fs from 'fs';
import path from 'path';
import { loadLocalEnv } from '../../core/env/load-local-env.js';

loadLocalEnv();
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) { console.error('OPENAI_API_KEY missing'); process.exit(1); }

const outDir = '/Users/matthew/Developer/google-map-website-v3/templates/roofing/families/classic-premium-roftix/reference-site/assets';
fs.mkdirSync(outDir, { recursive: true });

const SHARED = 'High-quality photorealistic photograph. Australian Brisbane suburbs context. Natural Queensland light. No text, no logos, no people facing camera, no AI-looking gradients, no oversaturation. Realistic roofing trade context. Editorial quality, suitable for premium roofing company website.';

const jobs = [
  {
    name: 'hero-premium-roof-blue-hour.jpg',
    size: '1536x1024',
    prompt: `${SHARED} Wide cinematic photograph of a beautifully restored single-storey Brisbane Queenslander home, low blue-hour dusk light, terracotta tile roof catching warm last sunlight against a moody navy-blue sky. Camera angle slightly low, looking up at the ridgeline. Mature palm and frangipani in soft shadow. Verandah lights just starting to glow. The roof is the hero — clean ridge capping, even tile colour, sharp gutters. Subtle suburban street context. Composition leaves room on the right for overlay text. Premium real-estate photography aesthetic.`,
  },
  {
    name: 'service-roof-repair-flashing-detail.jpg',
    size: '1024x1024',
    prompt: `${SHARED} Close-up detail photograph of skilled hands re-pointing fresh flexible roofing cement along ridge capping on a Brisbane terracotta tile roof. The trowel and fresh grey pointing are sharp focus, terracotta tiles in foreground/background slightly soft. Bright but not harsh midday Brisbane sun. Quality workmanship visible.`,
  },
  {
    name: 'service-roof-installation-detail.jpg',
    size: '1024x1024',
    prompt: `${SHARED} Photograph of a freshly installed dark-charcoal Colorbond steel roof on a Brisbane home, taken from a slightly elevated angle showing crisp ridge lines, clean ribbed sheeting, and new matching gutters. Bright Queensland blue sky with light cloud. No workers visible. Material quality and clean install detail are the focus.`,
  },
  {
    name: 'about-roofer-working-roof-frame.jpg',
    size: '1024x1024',
    prompt: `${SHARED} Mid-shot of an experienced Australian tradesman in branded workshirt and high-vis (back to camera or three-quarter) inspecting a tile roof on a suburban Brisbane home, holding a digital camera and clipboard. Calm professional manner. Wide-brim sun hat. The inspection process, not the action — pen, notes, photographic evidence. Daytime overcast soft light.`,
  },
  {
    name: 'project-before-after-roof-transformation.jpg',
    size: '1536x1024',
    prompt: `${SHARED} Side-by-side before-and-after composition (split frame, left half = before, right half = after) of the same Brisbane Queenslander terracotta tile roof. Left: faded, moss-stained, broken capping, cracked tiles, peeling paint, grey washed-out. Right: same roof restored — clean terracotta colour, fresh pointing on ridges, new gutters, sharp lines, brighter scene. Identical angle and composition on both sides for clear comparison. Realistic restoration result, not exaggerated.`,
  },
];

async function generate(job) {
  console.log(`\n[${job.name}] generating ${job.size}...`);
  const start = Date.now();
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt: job.prompt,
      size: job.size,
      quality: 'medium',
      n: 1,
    }),
  });
  const text = await res.text();
  if (!res.ok) { console.error(`  FAIL ${res.status}: ${text.slice(0, 300)}`); return false; }
  const json = JSON.parse(text);
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) { console.error(`  no b64_json in response`); return false; }
  const buf = Buffer.from(b64, 'base64');
  const out = path.join(outDir, job.name);
  fs.writeFileSync(out, buf);
  console.log(`  saved ${out} · ${Math.round(buf.length / 1024)} KB · ${Math.round((Date.now() - start) / 1000)}s`);
  return true;
}

let ok = 0;
for (const job of jobs) {
  try { if (await generate(job)) ok++; } catch (err) { console.error(`  ERR ${err.message}`); }
}
console.log(`\nDone · ${ok}/${jobs.length} generated`);
