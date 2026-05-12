#!/usr/bin/env node
/**
 * pl:rebuild-niche-shards — rescan entity store, rebuild niche cohort
 * shards in data/leads/niches/<niche>/<city>.entityKeys.json + profile.json.
 *
 * SOP-1 §6.
 */

import { rebuildAllNicheShards } from '../../core/leads/niche-cohort.js';

const t0 = Date.now();
const result = rebuildAllNicheShards({});
const dt = Date.now() - t0;
console.log(JSON.stringify({ ...result, ms: dt }, null, 2));
