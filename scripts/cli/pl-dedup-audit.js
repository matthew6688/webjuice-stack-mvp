#!/usr/bin/env node
/**
 * pl:dedup-audit — scan entity store, output suspect dedup queue.
 *
 * Read-only by default (writes dedup-review-queue.json). With AI auto-decider
 * enabled (default · disable with --no-llm), every detected suspect pair is
 * passed to llmDecideDedup() and either:
 *   - high-confidence 'same'      → write 'same' to dedup-decisions.json
 *   - high-confidence 'different' → write 'different' to dedup-decisions.json
 *   - anything else               → fall through to human-review queue
 *
 * --no-llm     skip LLM, behave like v1 (queue everything)
 * --llm-only   call LLM and PRINT verdicts but DO NOT write decisions (test mode)
 * --model M    override default qwen3.5:9b
 *
 * SOP-X-Dedup §4.1 + §4.2.
 */

import fs from 'node:fs';
import path from 'node:path';
import { detectDuplicates, writeReviewQueue } from '../../core/leads/dedup-detector.js';
import { llmDecideDedup, HIGH_CONF_THRESHOLD } from '../../core/leads/dedup-llm-decider.js';
import { pushAlert } from '../../core/ops/alert-pusher.js';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, tok, i, arr) => {
    if (tok.startsWith('--')) {
      const key = tok.slice(2);
      const next = arr[i + 1];
      acc.push([key, next && !next.startsWith('--') ? next : true]);
    }
    return acc;
  }, [])
);

const PUSH = !!args.push;
const NO_LLM = !!args['no-llm'];
const LLM_ONLY = !!args['llm-only'];
const MODEL = typeof args.model === 'string' ? args.model : undefined;

const STORE = path.resolve(process.cwd(), 'data/leads');
const ENTITIES_DIR = path.join(STORE, 'entities');
const DECISIONS_PATH = path.join(STORE, 'dedup-decisions.json');

function readEntity(entityKey) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ENTITIES_DIR, `${entityKey}.json`), 'utf8'));
  } catch {
    return null;
  }
}

function loadDecisions() {
  if (!fs.existsSync(DECISIONS_PATH)) return { schemaVersion: 1, decisions: [] };
  try {
    const s = JSON.parse(fs.readFileSync(DECISIONS_PATH, 'utf8'));
    if (!Array.isArray(s.decisions)) s.decisions = [];
    return s;
  } catch {
    return { schemaVersion: 1, decisions: [] };
  }
}

function writeDecision(state, entry) {
  state.decisions.push(entry);
  state.decisions = state.decisions.slice(-1000);
  fs.writeFileSync(DECISIONS_PATH, JSON.stringify(state, null, 2));
}

function pairs(keys) {
  const out = [];
  for (let i = 0; i < keys.length; i += 1) {
    for (let j = i + 1; j < keys.length; j += 1) {
      out.push([keys[i], keys[j]]);
    }
  }
  return out;
}

const t0 = Date.now();
const result = detectDuplicates({});
const detectMs = Date.now() - t0;

// AI auto-decider pass
let llmStats = { calls: 0, auto_same: 0, auto_different: 0, uncertain: 0, fallback: 0, ms: 0 };
const autoDecidedPairs = new Set();

if (!NO_LLM && result.suspectGroups.length > 0) {
  const llmT0 = Date.now();
  const decisionsState = LLM_ONLY ? null : loadDecisions();

  for (const group of result.suspectGroups) {
    for (const [k1, k2] of pairs(group.entityKeys)) {
      const eA = readEntity(k1);
      const eB = readEntity(k2);
      if (!eA || !eB) continue;
      const verdict = await llmDecideDedup(eA, eB, {
        reason: `${group.matchKey}-match`,
        matched_field: group.matchKey,
        matched_value: group.matchValue,
      }, MODEL ? { model: MODEL } : {});
      llmStats.calls += 1;
      if (verdict.source === 'fallback') llmStats.fallback += 1;

      const highConf = verdict.confidence >= HIGH_CONF_THRESHOLD && verdict.source === 'llm';
      console.log(`  [LLM] ${k1} ↔ ${k2}  → ${verdict.verdict}  conf=${verdict.confidence.toFixed(2)}  ${verdict.source}  ${verdict.latency_ms}ms`);
      console.log(`         ${verdict.reasoning}`);

      if (highConf && verdict.verdict === 'same') {
        llmStats.auto_same += 1;
        autoDecidedPairs.add([k1, k2].sort().join('::'));
        if (!LLM_ONLY) {
          writeDecision(decisionsState, {
            at: new Date().toISOString(),
            k1, k2,
            decision: 'same',
            operator: 'llm-auto',
            source: 'llm',
            model: verdict.model,
            confidence: verdict.confidence,
            reasoning: verdict.reasoning,
            trigger: { reason: `${group.matchKey}-match`, matched_value: group.matchValue },
            fields_supporting_same: verdict.fields_supporting_same,
            fields_supporting_different: verdict.fields_supporting_different,
          });
        }
      } else if (highConf && verdict.verdict === 'different') {
        llmStats.auto_different += 1;
        autoDecidedPairs.add([k1, k2].sort().join('::'));
        if (!LLM_ONLY) {
          writeDecision(decisionsState, {
            at: new Date().toISOString(),
            k1, k2,
            decision: 'different',
            operator: 'llm-auto',
            source: 'llm',
            model: verdict.model,
            confidence: verdict.confidence,
            reasoning: verdict.reasoning,
            trigger: { reason: `${group.matchKey}-match`, matched_value: group.matchValue },
            fields_supporting_same: verdict.fields_supporting_same,
            fields_supporting_different: verdict.fields_supporting_different,
          });
        }
      } else {
        llmStats.uncertain += 1;
      }
    }
  }
  llmStats.ms = Date.now() - llmT0;
}

// Filter groups: if EVERY pair in a group was LLM-auto-decided, drop from human queue
const remainingGroups = result.suspectGroups.filter((g) => {
  if (NO_LLM || LLM_ONLY) return true;
  const allPairs = pairs(g.entityKeys);
  return allPairs.some(([a, b]) => !autoDecidedPairs.has([a, b].sort().join('::')));
});
const filteredResult = { ...result, suspectGroups: remainingGroups };

const queuePath = writeReviewQueue(filteredResult, {});

const out = {
  ok: true,
  scanned: result.scanned,
  total_suspects_detected: result.suspectGroups.length,
  total_suspects_queued: filteredResult.suspectGroups.length,
  summary: result.summary,
  llm: NO_LLM ? { disabled: true } : llmStats,
  llm_only_mode: LLM_ONLY,
  detect_ms: detectMs,
  ms: Date.now() - t0,
  queue_path: queuePath,
};

console.log(JSON.stringify(out, null, 2));

if (filteredResult.suspectGroups.length > 0) {
  console.log('\nSuspect groups (for human review):');
  for (const g of filteredResult.suspectGroups.slice(0, 10)) {
    console.log(`  [${g.matchKey}=${g.matchValue}] ${g.entityKeys.length} entities`);
    for (const p of g.previews) {
      console.log(`    - ${p.entityKey}  "${p.name}"  ${p.city || '-'} / ${p.niche || '-'}`);
    }
  }
}

if (PUSH && filteredResult.suspectGroups.length > 20) {
  await pushAlert({
    title: `Dedup review queue: ${filteredResult.suspectGroups.length} suspect groups (after LLM)`,
    detail: `pl:dedup-audit found ${result.suspectGroups.length} groups · LLM auto-decided ${llmStats.auto_same + llmStats.auto_different} pairs (${llmStats.auto_same} same / ${llmStats.auto_different} different) · ${filteredResult.suspectGroups.length} remain for human review.\n\nReview at /admin/v2-leads/dedup-review`,
    severity: filteredResult.suspectGroups.length > 100 ? 'error' : 'warn',
    source: 'pl:dedup-audit',
    fields: [
      { name: 'scanned', value: String(result.scanned), inline: true },
      { name: 'detected', value: String(result.suspectGroups.length), inline: true },
      { name: 'auto-decided', value: String(llmStats.auto_same + llmStats.auto_different), inline: true },
      { name: 'queued', value: String(filteredResult.suspectGroups.length), inline: true },
      { name: 'ms', value: String(Date.now() - t0), inline: true },
    ],
    url: 'https://profitslocal.com/admin/v2-leads/dedup-review',
  });
}
