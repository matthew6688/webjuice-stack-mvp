/**
 * V3 D39 (2026-05-14) · Redesign Brief Builder · AI 分析 multi-page crawl raw JSON
 *
 * Per Matthew "不要预定义 extractor · 把 json 全抓回来 给 AI 分析"
 *
 * 输入: multi-page-crawl 结果 (10+ 页 rawHtml + text + meta)
 * 输出: 结构化 redesign brief JSON
 *   - core_info (REAL · 不可编 · 必客户原文)
 *   - brand_assets (logo · 颜色 · 字体 · 风格)
 *   - extensions (AI 优化拓展 · hero copy / service descriptions / etc.)
 *   - redesign_brief 一段总结
 *   - qualification_flags (scorecard 输入 · scope / logo quality / etc.)
 *
 * Cost: ~$1-2 per customer (claude_cli sonnet · 50KB in + 10KB out)
 * Cascade: codex_cli → claude_cli → ollama (per Matthew D39)
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const PROMPT_TEMPLATE = `You are analyzing a real local business website for a redesign project (ProfitsLocal AU).

Below is the raw scrape of N pages from the customer's current website. Extract structured info:

# REAL · 必须客户原文 (never invent)

\`\`\`
business_name: exact spelling
phone: all listed (verified format · AU mobile 04XX XXX XXX or landline 0X XXXX XXXX)
email: all listed
address: exact street + suburb + state + postcode
license_numbers: regex patterns (ABN/QBCC/license number)
founded_year: regex "since YYYY" / "established YYYY" / "X years"
owner_name: from About page
service_list: each service name + 1-sentence brief · only services they explicitly offer
testimonials: quote + author + location (real customer testimonials only)
team_members: name + role (if shown)
\`\`\`

# BRAND ASSETS · 可推断

\`\`\`
logo_url: highest-res image referenced (og:image · favicon · header logo)
primary_color: hex from CSS/Hero
accent_color: hex
font_family: from @font-face URLs
voice_tone: classify (formal/casual/expert/luxury/friendly/professional)
key_messaging: 3-5 phrases customer uses to describe themselves
\`\`\`

# EXTENSIONS · AI 优化 (标 source=ai)

\`\`\`
improved_hero_copy: 2-3 H1 + subhead options (more compelling · audit-aware)
improved_service_descriptions: rewrite each for clarity + benefit
meta_descriptions: SEO-optimized per page
cta_suggestions: action verbs · niche-typical
trust_signals_to_emphasize: from existing material
\`\`\`

# REDESIGN BRIEF · 1-paragraph synthesis

What we should keep · what we should improve · why this redesign matters.

# QUALIFICATION FLAGS · scorecard 输入

\`\`\`
scope_pages_estimate: N
complexity: simple|medium|complex
logo_quality: have-svg|have-png-high|have-png-low|missing
booking_required: true|false
multilingual_required: true|false
ecommerce_detected: true|false
member_portal_detected: true|false
blog_active: true|false (>= 5 posts in last 6 months)
third_party_pixels_count: N
ready_to_build_concerns: [...]
\`\`\`

# RAW SCRAPE (input)

Customer URL: {BASE_URL}
Pages crawled: {PAGE_COUNT}
Sitemap source: {SITEMAP_SOURCE}

{PAGES_JSON}

# OUTPUT FORMAT

STRICT JSON · no markdown fences · no commentary. Start with { · end with }.
Schema:
{
  "core_info": {...},
  "brand_assets": {...},
  "extensions": {...},
  "redesign_brief": "...",
  "qualification_flags": {...}
}
`;

/** Run a CLI subprocess · pipe prompt to stdin · capture stdout · timeout 5min */
function runCli(cmd, args, input, timeoutMs = 300_000) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    const timer = setTimeout(() => { proc.kill('SIGTERM'); reject(new Error(`timeout ${timeoutMs}ms`)); }, timeoutMs);
    proc.on('error', reject);
    proc.on('exit', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`exit ${code}: ${stderr.slice(0, 300)}`));
    });
    if (input) {
      proc.stdin.write(input);
      proc.stdin.end();
    }
  });
}

/** Try codex_cli first · then claude_cli · then ollama (per D39 cascade) */
async function runAiCascade(prompt) {
  const errs = [];
  // Try codex CLI
  try {
    // V3 D43 P5: gpt-4o 不支持 ChatGPT 账号 · 用默认 (gpt-5) · 跟 image-task-prep cascade 一致
    const r = await runCli('codex', ['exec'], prompt, 240_000);
    return { text: r.stdout, provider: 'codex_cli' };
  } catch (err) { errs.push(`codex: ${err.message}`); }
  // Try claude CLI
  try {
    const r = await runCli('claude', ['-p', prompt, '--model', 'claude-sonnet-4-5'], '', 240_000);
    return { text: r.stdout, provider: 'claude_cli' };
  } catch (err) { errs.push(`claude: ${err.message}`); }
  // Try ollama
  try {
    const { textOllama } = await import('../llm/text-ollama.js');
    const model = process.env.OLLAMA_TEXT_MODEL || 'qwen3.5:9b';
    const r = await textOllama({ model, prompt, think: false });
    return { text: r.rawText || '', provider: 'ollama' };
  } catch (err) { errs.push(`ollama: ${err.message}`); }
  throw new Error(`All providers failed: ${errs.join(' · ')}`);
}

/** Extract JSON object from LLM output (handle prefixes/suffixes) */
function extractJson(text) {
  if (!text) return null;
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

/**
 * Main · build redesign brief from multi-page crawl result.
 *
 * @param {object} crawlResult · output from multiPageCrawl()
 * @returns {{brief, raw_response, provider, cost_estimate, duration_ms}}
 */
export async function buildRedesignBrief(crawlResult) {
  if (!crawlResult?.pages?.length) {
    return { brief: null, error: 'no crawled pages' };
  }
  const start = Date.now();

  // Build pages JSON for prompt (truncate rawHtml to ~3KB/page to fit context)
  const pagesForPrompt = crawlResult.pages.map((p) => ({
    url: p.url,
    title: p.title,
    text_md: (p.text || '').slice(0, 5000),
    rawHtml_excerpt: (p.rawHtml || '').slice(0, 3000),
    meta: p.meta,
  }));

  const prompt = PROMPT_TEMPLATE
    .replace('{BASE_URL}', crawlResult.base_url || '?')
    .replace('{PAGE_COUNT}', String(crawlResult.pages.length))
    .replace('{SITEMAP_SOURCE}', crawlResult.sitemap_source || 'unknown')
    .replace('{PAGES_JSON}', JSON.stringify(pagesForPrompt, null, 2));

  // Run AI cascade
  let result;
  try {
    result = await runAiCascade(prompt);
  } catch (err) {
    return { brief: null, error: err.message, duration_ms: Date.now() - start };
  }

  const brief = extractJson(result.text);
  return {
    brief,
    raw_response: result.text.slice(0, 5000),
    provider: result.provider,
    cost_estimate: result.provider === 'ollama' ? 0 : result.provider === 'codex_cli' ? 0.5 : 1.5,
    duration_ms: Date.now() - start,
    prompt_length: prompt.length,
  };
}

/** Save brief to disk · for downstream scorecard + reference-adapter use */
export function saveBrief(slug, briefResult, repoRoot = process.cwd()) {
  const outPath = path.join(repoRoot, 'clients', slug, 'v2/redesign-brief.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(briefResult, null, 2));
  return outPath;
}
