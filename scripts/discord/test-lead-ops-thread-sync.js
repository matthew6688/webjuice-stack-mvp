#!/usr/bin/env node

import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  extractLeadCandidatesFromThreadMessages,
  syncLeadOpsCandidatesFromThread,
} from '../../core/discord-tasks/lead-ops-sync.js';
import { loadLeadOutreachIndex } from '../../core/funnel/lead-outreach-index.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lead-ops-thread-sync-'));

try {
  const thread = {
    id: 'thread-restaurant-discovery',
    guild_id: 'guild-1',
    parent_id: '1501072883001065614',
    name: '搜索一些brisbane的restaurant，做一些lead discovery',
  };
  const messages = [
    {
      id: 'm1',
      author: 'website-agent',
      bot: true,
      content: `
已整理成可发给 admin 的 **lead sync** 版本：

### 1. AJ Vietnamese Noodle House
- 地址：70 Charlotte St, Brisbane City QLD 4000
- 电话：(07) 3229 2128
- 状态：Google Maps 显示 **Add website**，未见独立官网
- 备注：很适合做官网/SEO/本地获客切入

### 2. Haeduri Chicken City
- 地址：108 Margaret St, Brisbane City QLD 4000
- 电话：0493 284 239
- 状态：Google Maps 显示 **Add website**，未见独立官网
- 备注：同样是高优先级

### 3. The Vietnamese Restaurant
- 地址：194 Wickham St, Fortitude Valley QLD 4006
- 电话：0423 680 780
- 状态：Google Maps 只看到 **facebook.com**，未见独立官网
- 备注：可作为网站升级/品牌官网机会

## 2) 次级候选（可继续核实）

### 4. Sing's Vietnamese Chargrill
- 地址：376 George St, Brisbane City
- 状态：官网不清晰
- 备注：需要再确认主店与实际运营情况后再判断
`,
      attachments: [],
    },
  ];
  const candidates = extractLeadCandidatesFromThreadMessages(messages);
  assert.equal(candidates.length, 3);
  assert.equal(candidates[0].businessName, 'AJ Vietnamese Noodle House');
  assert.equal(candidates[1].phone, '0493 284 239');
  assert.equal(candidates[2].city, 'Fortitude Valley');

  const result = syncLeadOpsCandidatesFromThread({
    clientLeads: candidates,
    thread,
    messages,
    clientsRoot: path.join(root, 'clients'),
    now: '2026-05-09T00:00:00.000Z',
  });
  assert.equal(result.count, 3);
  assert.match(result.suggestedThreadTitle, /Lead ops \(3\)/);

  const index = loadLeadOutreachIndex({
    clientsRoot: path.join(root, 'clients'),
    casesRoot: path.join(root, 'data', 'cases'),
    paidIntakesRoot: path.join(root, 'data', 'paid-intakes'),
  });
  const aj = index.records.find((record) => record.clientSlug === 'aj-vietnamese-noodle-house');
  const vietnamese = index.records.find((record) => record.clientSlug === 'the-vietnamese-restaurant');
  assert.equal(aj.pipelineStage, 'ready_for_mockup');
  assert.equal(aj.address, '70 Charlotte St, Brisbane City QLD 4000');
  assert.ok(aj.discordThreadUrl.includes('thread-restaurant-discovery'));
  assert.equal(vietnamese.socialAccounts.length, 1);

  console.log(JSON.stringify({
    ok: true,
    candidates: candidates.map((candidate) => candidate.businessName),
    synced: result.synced.map((item) => item.clientSlug),
    ajStage: aj.pipelineStage,
  }, null, 2));
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
