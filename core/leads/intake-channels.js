/**
 * SOP-1 intake channels registry · loader
 *
 * Single source of truth for "what are SOP-1's entry points".
 * Used by:
 *   - sop-1.astro 流程图入口框（build-time SSG load）
 *   - docs/SOP_1_INTAKE_DISCOVERY.md (作 quick reference)
 *   - CI test (scripts/qa/test-intake-channels.mjs) 校验 CLI 真存在
 *   - SOP-0 intent router (将来可加 "channel hint" 帮路由)
 *
 * 永远从这个文件读 · 不要在别处复制粘贴 channel list。
 * 改入口 = 改 data/sop1/intake-channels.json 一个地方 · 全站自动同步。
 */

import fs from 'node:fs';
import path from 'node:path';

// Astro prerender 时 import.meta.url 指向 dist/ · data 不在那
// 用 process.cwd() 这样 build 和 runtime 都能找到
const REGISTRY_PATH = path.join(process.cwd(), 'data/sop1/intake-channels.json');

let _cache = null;

export function loadIntakeChannels() {
  if (_cache) return _cache;
  const raw = fs.readFileSync(REGISTRY_PATH, 'utf8');
  _cache = JSON.parse(raw);
  return _cache;
}

export function activeChannels() {
  // Include "active-but-broken" so admin shows it (with badge) · 不显示 = 假装没问题
  return loadIntakeChannels().channels.filter((c) =>
    c.status === 'active' || c.status === 'active-but-broken'
  );
}

export function brokenChannels() {
  return loadIntakeChannels().channels.filter((c) => c.status === 'active-but-broken');
}

export function plannedChannels() {
  return loadIntakeChannels().future_channels || [];
}

export function getChannel(id) {
  return loadIntakeChannels().channels.find((c) => c.id === id);
}

export function getChannelByCli(cli) {
  return loadIntakeChannels().channels.find((c) => c.cli === cli);
}

// Bust cache (testing)
export function _resetCache() { _cache = null; }
