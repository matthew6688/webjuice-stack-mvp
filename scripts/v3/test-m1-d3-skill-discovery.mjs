#!/usr/bin/env node
// M1-D3 · Hermes skill profitslocal-website-intake
import fs from 'fs';
import path from 'path';
import os from 'os';
import { makeRunner } from './_test-helpers.mjs';

const r = makeRunner('m1-d3-skill-discovery');

const HOME = os.homedir();
const SKILL_PATH = path.join(HOME, '.hermes', 'profiles', 'marketer', 'skills', 'b2b-marketing', 'profitslocal-website-intake', 'SKILL.md');
const ARCHIVE_DIR = path.join(HOME, '.hermes', 'profiles', 'marketer', 'skills', 'b2b-marketing', '.archive');

await r.assert('skill-md-exists', () => {
  if (!fs.existsSync(SKILL_PATH)) throw new Error(`missing ${SKILL_PATH}`);
  return true;
});

await r.assert('skill-md-frontmatter', () => {
  if (!fs.existsSync(SKILL_PATH)) throw new Error('skill missing');
  const body = fs.readFileSync(SKILL_PATH, 'utf8');
  for (const key of ['name:', 'description:', 'read_when:', 'allowed-tools:']) {
    if (!body.includes(key)) throw new Error(`missing frontmatter key: ${key}`);
  }
  if (!body.includes('Bash')) throw new Error('allowed-tools must include Bash');
  return true;
});

await r.assert('description-mentions-4-entries', () => {
  if (!fs.existsSync(SKILL_PATH)) throw new Error('skill missing');
  const body = fs.readFileSync(SKILL_PATH, 'utf8').toLowerCase();
  const entries = ['intake', 'places', 'single', 'image'];
  const missing = entries.filter(e => !body.includes(e));
  if (missing.length) throw new Error(`description missing entries: ${missing.join(',')}`);
  return true;
});

await r.assert('old-skill-archived', () => {
  if (!fs.existsSync(ARCHIVE_DIR)) throw new Error(`missing archive dir: ${ARCHIVE_DIR}`);
  const archived = fs.readdirSync(ARCHIVE_DIR);
  if (!archived.includes('webjuice-outbound-pipeline')) {
    throw new Error('webjuice-outbound-pipeline must be archived');
  }
  return true;
});

// 5 manual chat smoke is human-tested — note in evidence only.
r.skip('manual-chat-smoke-5-cases', 'human-tested via Hermes chat · log in m1-d3-skill-smoke.md');

const s = r.summary({ skill_path: SKILL_PATH, archive_dir: ARCHIVE_DIR });
process.exit(s.exitCode);
