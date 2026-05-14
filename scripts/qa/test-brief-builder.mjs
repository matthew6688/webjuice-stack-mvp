import fs from 'node:fs';
import path from 'node:path';

const dir = 'clients/brisbane-roof-restoration-experts/v2/multi-page-crawl';
const files = fs.readdirSync(dir).filter(f=>f.endsWith('.json')).sort();
const latest = JSON.parse(fs.readFileSync(path.join(dir, files[files.length-1]), 'utf8'));
console.log('pages:', latest.pages?.length, 'sitemap:', latest.sitemap_source);

const { buildRedesignBrief } = await import('../../core/audit/redesign-brief-builder.js');
const r = await buildRedesignBrief(latest);
console.log('provider:', r.provider);
console.log('duration_ms:', r.duration_ms);
console.log('error:', r.error?.slice(0, 400));
console.log('brief keys:', r.brief && Object.keys(r.brief));
if (r.brief?.core_info) console.log('core_info preview:', JSON.stringify(r.brief.core_info).slice(0, 200));
