import { renderTaskCreatedMessage, renderDoneMessage, renderFailedMessage } from '../../core/discord-tasks/humanize.js';

const task = { task_id: '20260514-054503-378a91', kind: 'single-enrich' };
const route = {
  kind: 'single-enrich',
  target_cli: 'pl:single-enrich',
  args: ['--business-name', 'Roof & Gutter Experts', '--phone', '02 5104 1571', '--city', 'wollongong'],
  target_entity_key: null,
  provider: 'codex_cli',
};

console.log('===CREATED===');
console.log(renderTaskCreatedMessage({ task, route }));

console.log('\n===DONE===');
const tail = `{
  "ok": true,
  "place_id": "ChIJHV4yL0wfE2sR0j2mhcBoPfU",
  "entity_key": "place_chijhv4yl0wfe2sr0j2mhcbopfu",
  "name": "Illawarra Roof Maintenance",
  "phone": "0435 800 410",
  "address": "6 Thomas St, Corrimal NSW 2518, Australia",
  "city": "wollongong",
  "audit_chained": "20260514-054506-157c6f"
}`;
console.log(renderDoneMessage({ task, durationMs: 1400, tail, xref: '· 正在为客户网站做 audit · 完了再发这里' }));

console.log('\n===FAILED===');
console.log(renderFailedMessage({ task, exitCode: 1, stderr: '--niche required', tail: '' }));
