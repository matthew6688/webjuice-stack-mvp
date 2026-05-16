#!/usr/bin/env node
/**
 * pl:customer-summary — generate a concise business background summary for a lead.
 *
 * Matthew (2026-05-16): "如果有网站的就用 tinyfish 直接 fetch · 如果没有就 search ·
 *   加上 LLM 分析是否相关、是否采用 · 最后我需要的是这个客户的一个 summary,
 *   简单的客户背景分析."
 *
 * Pipeline:
 *   1. Tinyfish SEARCH by "name · city · niche" (force AU location) → top 10 results
 *      (other directories, GBP, Yelp, LinkedIn, news, reviews, etc.)
 *   2. IF entity has website → Tinyfish FETCH homepage (markdown)
 *      ELSE skip · search-only path
 *   3. LLM cascade (codex_cli → claude_cli → ollama) writes:
 *      - 业务范围 (services offered)
 *      - 营业历史 (years in business)
 *      - 客户群 (residential/commercial/B2B/B2C)
 *      - 服务区域 (service area · suburbs)
 *      - 差异化卖点 (USP/positioning)
 *      - 规模估计 (employee count · trucks · scale signals)
 *      - 投资能力 (small biz / family / mid · ability to pay $X for website)
 *      - 是否值得 outreach (yes/no + reason)
 *
 * Output: clients/<slug>/v2/customer-summary.md
 *
 * Usage:
 *   npm run pl:customer-summary -- --entity-key <key>
 *   npm run pl:customer-summary -- --all-active   (all outreach-active + ready-to-build)
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { tinyfishSearch, tinyfishFetchUrls } from '../../core/extractors/tinyfish.js';

const REPO = process.cwd();
const ENTITIES_DIR = path.join(REPO, 'data/leads/entities');
const CLIENTS_DIR = path.join(REPO, 'clients');
const ACTIVE_PHASES = new Set(['ready-to-build', 'outreach-active', 'replied', 'proposal-sent', 'nurture', 'paid', 'audit-ready', 'qa-pending']);

function args() {
  const out = {}; const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    if (!t.startsWith('--')) continue;
    const k = t.slice(2); const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) out[k] = true; else { out[k] = v; i += 1; }
  }
  return out;
}
function die(msg) { console.error(`pl:customer-summary: ${msg}`); process.exit(1); }

function slugify(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }

function runCli(cmd, argList, input, timeoutMs = 90_000) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, argList, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => { p.kill('SIGKILL'); reject(new Error(`${cmd} timeout ${timeoutMs}ms`)); }, timeoutMs);
    p.stdout.on('data', (b) => { stdout += b.toString(); });
    p.stderr.on('data', (b) => { stderr += b.toString(); });
    p.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`${cmd} exit ${code}: ${stderr.slice(0, 200)}`));
      resolve({ stdout, stderr });
    });
    if (input) p.stdin.write(input);
    p.stdin.end();
  });
}

async function llmCascade(prompt) {
  const trace = [];
  for (const tier of ['codex_cli', 'claude_cli']) {
    const t0 = Date.now();
    try {
      let out;
      if (tier === 'codex_cli') out = (await runCli('codex', ['exec'], prompt, 120_000)).stdout;
      else out = (await runCli('claude', ['-p', prompt], '', 120_000)).stdout;
      trace.push({ tier, ok: true, latency_ms: Date.now() - t0 });
      return { text: out, provider: tier, trace };
    } catch (err) {
      trace.push({ tier, ok: false, latency_ms: Date.now() - t0, error: err.message.slice(0, 150) });
    }
  }
  throw new Error(`All LLM tiers failed: ${JSON.stringify(trace)}`);
}

async function summarizeEntity(entity) {
  const latest = entity.latest || {};
  const name = latest.name || entity.entityKey;
  const city = latest.city || '';
  const niche = latest.niche || latest.category || 'roofer';
  const website = latest.website || '';
  const slug = entity.promotedClientSlug || slugify(name);

  console.log(`\n▶ ${name} · ${city} · niche=${niche}`);
  console.log(`  website: ${website || '(none)'}`);

  // 1. Tinyfish SEARCH · forced AU location
  const searchQuery = `${name} ${city} ${niche}`.trim();
  console.log(`  [1/3] tinyfish search · "${searchQuery}" · location="${city}, Australia"`);
  const sStart = Date.now();
  let searchResults = [];
  let searchErr = null;
  try {
    const r = await tinyfishSearch({
      query: searchQuery,
      location: `${city}, Australia`,
      language: 'en',
      purpose: 'customer_summary_search',
      leadId: entity.entityKey,
      clientSlug: slug,
    });
    searchResults = r.results || [];
  } catch (err) { searchErr = err.message; }
  const sMs = Date.now() - sStart;
  console.log(`        → ${searchResults.length} results · ${sMs}ms ${searchErr ? '· ERR ' + searchErr : ''}`);

  // 2. Tinyfish FETCH homepage if website exists
  let homepageMd = null;
  let fetchMs = 0;
  let fetchErr = null;
  if (website) {
    console.log(`  [2/3] tinyfish fetch · ${website}`);
    const fStart = Date.now();
    try {
      const r = await tinyfishFetchUrls({ urls: [website], format: 'markdown', purpose: 'customer_summary_fetch', leadId: entity.entityKey, clientSlug: slug });
      homepageMd = r.results?.[0]?.text || null;
    } catch (err) { fetchErr = err.message; }
    fetchMs = Date.now() - fStart;
    console.log(`        → ${homepageMd ? `${homepageMd.length} bytes md` : 'no content'} · ${fetchMs}ms ${fetchErr ? '· ERR ' + fetchErr : ''}`);
  } else {
    console.log(`  [2/3] tinyfish fetch · SKIP (no website)`);
  }

  // 3. LLM summarize
  console.log(`  [3/3] LLM cascade · codex → claude`);
  const prompt = [
    `你是一个销售线索分析师 · 帮 ProfitsLocal (我们做小企业网站升级) 评估这条潜客.`,
    ``,
    `## 商家信息`,
    `名字: ${name}`,
    `城市: ${city}, Australia`,
    `行业: ${niche}`,
    `官网: ${website || '(无官网)'}`,
    `Google 评分: ${latest.rating ?? '?'} · 评论数: ${latest.review_count ?? '?'}`,
    `电话: ${latest.phone || '?'}  ·  邮箱: ${latest.email || '?'}  ·  地址: ${latest.address || '?'}`,
    ``,
    homepageMd ? `## 官网首页 markdown (前 4000 字符)\n${homepageMd.slice(0, 4000)}` : '',
    ``,
    `## Tinyfish 搜索结果 (top 10 · "${searchQuery}")`,
    searchResults.length
      ? searchResults.slice(0, 10).map((r, i) => `${i+1}. [${r.title || '(no title)'}](${r.url})${r.description ? '\n   ' + r.description.slice(0, 200) : ''}`).join('\n')
      : '(搜索无结果)',
    ``,
    `## 你的任务`,
    `用 markdown 输出客户背景分析 · 必须包含这些段落 (中文 · 简洁 · 没数据就写"未知"):`,
    ``,
    `### 业务范围`,
    `(列出他们做的具体服务 · 3-5 条)`,
    ``,
    `### 经营历史`,
    `(年限 · 创始年份 · 家族企业 yes/no)`,
    ``,
    `### 目标客户`,
    `(住宅 / 商业 / B2B / B2C · 哪种为主)`,
    ``,
    `### 服务区域`,
    `(具体地区 · 比如 "Cairns 及 Far North Queensland")`,
    ``,
    `### 差异化卖点 (USP)`,
    `(他们网站/搜索里强调什么? 1-3 条)`,
    ``,
    `### 规模估算`,
    `(员工数 · 工人数 · 车队 · 凭网站和评论数估)`,
    ``,
    `### 数字化成熟度`,
    `(网站现状 · 是否有 GBP · 社媒活跃 · 评论积极性 · SEO long-tail 页数)`,
    ``,
    `### 投资能力评估`,
    `(small/medium · 能否付得起 $1000-3000 网站升级费 · 凭啥判断)`,
    ``,
    `### Outreach 建议`,
    `(是否值得跟进 · 推荐 angle · 痛点切入)`,
    ``,
    `### 数据完整度`,
    `(我们抓到的信息够不够 · 还缺什么)`,
    ``,
    `仅输出 markdown · 不要前后废话.`,
  ].filter(Boolean).join('\n');

  const llmStart = Date.now();
  const llm = await llmCascade(prompt);
  const llmMs = Date.now() - llmStart;
  console.log(`        → ${llm.provider} · ${llmMs}ms · ${llm.text.length} chars`);

  // Write to clients/<slug>/v2/customer-summary.md
  const outDir = path.join(CLIENTS_DIR, slug, 'v2');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'customer-summary.md');
  const fm = [
    `---`,
    `business_id: "${entity.entityKey}"`,
    `business_name: "${name}"`,
    `city: "${city}"`,
    `niche: "${niche}"`,
    `website: "${website}"`,
    `generated_at: "${new Date().toISOString()}"`,
    `generator: "pl:customer-summary"`,
    `provider: "${llm.provider}"`,
    `tinyfish_search_results: ${searchResults.length}`,
    `tinyfish_fetch_bytes: ${homepageMd ? homepageMd.length : 0}`,
    `cost_estimate_usd: ${llm.provider === 'codex_cli' ? 0.05 : llm.provider === 'claude_cli' ? 0.15 : 0}`,
    `---`,
    ``,
    `# 客户背景 · ${name}`,
    ``,
    llm.text.trim(),
  ].join('\n');
  fs.writeFileSync(outFile, fm);
  console.log(`  → ${outFile}`);

  return {
    entityKey: entity.entityKey,
    slug,
    path: outFile,
    search_ms: sMs,
    fetch_ms: fetchMs,
    llm_ms: llmMs,
    total_ms: sMs + fetchMs + llmMs,
    provider: llm.provider,
    has_homepage: !!homepageMd,
    search_results: searchResults.length,
    cost_usd: llm.provider === 'codex_cli' ? 0.05 : llm.provider === 'claude_cli' ? 0.15 : 0,
  };
}

(async () => {
  const a = args();
  const targets = [];
  if (a['entity-key']) {
    const f = path.join(ENTITIES_DIR, `${a['entity-key']}.json`);
    if (!fs.existsSync(f)) die(`entity not found: ${a['entity-key']}`);
    targets.push(JSON.parse(fs.readFileSync(f, 'utf8')));
  } else if (a['all-active']) {
    for (const f of fs.readdirSync(ENTITIES_DIR)) {
      if (!f.endsWith('.json')) continue;
      try {
        const e = JSON.parse(fs.readFileSync(path.join(ENTITIES_DIR, f), 'utf8'));
        if (ACTIVE_PHASES.has(e.phase)) targets.push(e);
      } catch { /* skip */ }
    }
  } else {
    die('Usage: --entity-key <key> | --all-active');
  }

  console.log(`pl:customer-summary · ${targets.length} target(s)`);
  const results = [];
  for (const e of targets) {
    try {
      const r = await summarizeEntity(e);
      results.push(r);
    } catch (err) {
      console.error(`  ✗ ${e.entityKey}: ${err.message}`);
      results.push({ entityKey: e.entityKey, error: err.message });
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('Summary');
  const ok = results.filter((r) => !r.error);
  const totalMs = ok.reduce((a, b) => a + b.total_ms, 0);
  const totalCost = ok.reduce((a, b) => a + b.cost_usd, 0);
  console.log(`  ok:        ${ok.length}/${results.length}`);
  console.log(`  total ms:  ${totalMs} (avg ${ok.length ? Math.round(totalMs/ok.length) : 0}/lead)`);
  console.log(`  total $:   $${totalCost.toFixed(2)} (avg $${ok.length ? (totalCost/ok.length).toFixed(3) : '0'}/lead)`);
  console.log(`  providers: ${[...new Set(ok.map((r) => r.provider))].join(', ')}`);
})();
