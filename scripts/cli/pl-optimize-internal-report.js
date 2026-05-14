#!/usr/bin/env node
/**
 * pl:optimize-internal-report · M2-D9 internal audience · multi-round autoresearch
 *
 * Generates a polished internal audit report HTML via multi-round claude CLI loop:
 *   Round 1: write initial report from master.md + internal preamble (Chinese titles)
 *   Round 2: critic reviews · finds weaknesses (排版 / 内容深度 / 销售视角缺失)
 *   Round 3: writer rewrites incorporating critique
 *   (Optional Round 4 + critique 2 + Round 5 rewrite)
 *
 * Output: clients/<slug>/v2/internal-audit-report.optimized.html
 *         + history JSON with each round HTML + critique
 *
 * Cost: ~$1.50 per customer (5 claude CLI calls · ~5-10 min)
 *
 * Usage:
 *   npm run pl:optimize-internal-report -- --slug brisbane-roof-restoration-experts [--rounds 3]
 */
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { getPreamble } from '../../core/reports/generator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');

const args = parseArgs(process.argv.slice(2));
const slug = args.slug;
if (!slug) {
  console.error('Usage: pl:optimize-internal-report -- --slug <slug> [--rounds 3]');
  process.exit(1);
}

const ROUNDS = parseInt(args.rounds, 10) || 3;
const MODEL = args.model || 'claude-sonnet-4-5';

const v2Dir = path.join(REPO, 'clients', slug, 'v2');
const masterMdPath = path.join(v2Dir, 'master.md');
if (!fs.existsSync(masterMdPath)) {
  console.error(`master.md not found: ${masterMdPath}`);
  process.exit(1);
}

const masterMd = fs.readFileSync(masterMdPath, 'utf8');
const businessName = (masterMd.match(/business_name:\s*"([^"]+)"/) || [])[1] || slug;
const auditScore = (masterMd.match(/audit_score:\s*(\d+)/) || [])[1] || 'unknown';
const internalPreamble = getPreamble('internal');

const outHtml = path.join(v2Dir, 'internal-audit-report.optimized.html');
const historyJson = path.join(v2Dir, 'internal-audit-report.optimized.history.json');

console.log(`[pl:optimize-internal-report] slug:      ${slug}`);
console.log(`[pl:optimize-internal-report] business:  ${businessName} · audit=${auditScore}`);
console.log(`[pl:optimize-internal-report] rounds:    ${ROUNDS}`);
console.log(`[pl:optimize-internal-report] output:    ${outHtml}\n`);

const history = { slug, businessName, started_at: new Date().toISOString(), rounds: [] };

// ───────────────────────────────────────────────────────────────
// Round 1 · initial draft
// ───────────────────────────────────────────────────────────────
const PROMPT_R1 = `${internalPreamble}

# 任务

为以下客户生成一份高质量的「内部 audit 报告」HTML · 给 ProfitsLocal 销售/运营看 · 用来在客户面前讲述网站现状 + redesign 价值。

# 客户 master.md (source of truth)

\`\`\`markdown
${masterMd}
\`\`\`

# 你要产出的 HTML

要求:
1. **标题全部中文** · 章节标题、子标题、卡片标题 (例如: 一、店家速览 · 二、视觉审计 · 三、网站漏水点 · etc.)
2. **正文中文为主** · 数字/技术 ID/Lighthouse 分数等用英文
3. **排版重点**:
   - cream / 米橘 / 海军蓝 配色 (跟现有 internal-audit-report.html 一致)
   - serif heading (Playfair Display / Georgia) · sans body (Inter)
   - 信息密集但有节奏 · 每节有视觉锚点 (score tile / issue card / quote block)
   - "评论引用" 用 blockquote 风格 + 引号装饰 + 出处行
   - "技术发现" 用 4 段结构: 技术事实 / 普通话翻译 / 对客户的影响 / Redesign 怎么改
   - "Upsell 机会" 用 stat-tile 风格 · 含触发依据 + 月度收入区间 + 销售切入话术
4. **结构** (建议 8-10 章 · 你看 master.md 数据决定哪些章必出哪些可省):
   - 一、内部分级 · 销售优先看这段 (grade / 投入分级 / 触发依据 / 建议报价)
   - 二、店家速览 (联系方式 + Google rating + 行业)
   - 三、客户访问页面 (desktop + mobile 截图 + 慢 4G 视频链接)
   - 四、视觉审计 · Vision LLM 怎么看 (新鲜度/信任/转化 + reasoning)
   - 五、客户评价分析 (一致夸赞 + 4 条 ready-to-use quote)
   - 六、网站漏水点 (关键 + 主要 issue · 4 段结构)
   - 七、Redesign 发力点 (综合视觉+评论 6-8 条)
   - 八、销售切入点 (1-2 句一击)
   - 九、技术现状 (PageSpeed / SEO / Form / DNS / 技术栈 / 数字成熟度)
   - 十、AI 时代可发现性 GEO (分数 + 缺失项 + 销售切入)
   - 十一、Upsell 持续性月度营收机会
   - 十二、附录 (数据出处 + version)
5. **使用 master.md 里的真实数据** · 不要编造 · 数据缺失则写 "TBD · 待补"

输出一份完整的 \`<!doctype html>\` 文档。包含 inline CSS。不要 markdown fence · 不要任何 commentary。Start with <!doctype html> · end with </html>。`;

await runRound(1, PROMPT_R1, null);

// ───────────────────────────────────────────────────────────────
// Round 2..N · critique + rewrite
// ───────────────────────────────────────────────────────────────
for (let r = 2; r <= ROUNDS; r++) {
  const prevHtml = history.rounds[r - 2].html;

  // Critique
  const critiquePrompt = `${internalPreamble}

# 你的任务: 评审 (中文)

我之前生成了一份「内部 audit 报告 HTML」给 ProfitsLocal 销售/运营看 · 现在请你**评审 5 个维度** (每个 0-10 分):

## 5 维度

1. **哲学一致性** (Philosophy) · 设计语言/排版/配色是否贯穿一致 · 还是几个风格混在一起
2. **视觉层级** (Hierarchy) · 一眼能不能找到关键 (grade / score / 痛点 / 卖点)
3. **细节执行** (Detail) · 间距/对齐/字号/装饰 · 90/10 那种细节
4. **功能性** (Function) · 排版是不是真给销售/运营帮忙 · 不是装饰
5. **创新性** (Innovation) · 有没有让人 lean-in 的视觉 moment · 还是模板感

针对每个维度:
- 0-4 broken · 5-6 functional · 7-8 strong · 9-10 exceptional
- 必须**引证具体元素** (section / 颜色 / 字号 / 内容) · 不要 "感觉不一致" 这种空话
- 列出 **Fix 清单**: 3-5 条具体改动 · 每条 1 句话 · 按 visual cost saved / minute spent 排序

# 我之前生成的 HTML

\`\`\`html
${prevHtml}
\`\`\`

# 输出格式

纯文本 · 中文 · 简洁:
\`\`\`
## 评审 round ${r - 1}

### 哲学一致性: X/10
[reasoning · 引证具体元素]

### 视觉层级: X/10
[reasoning]

### 细节执行: X/10
[reasoning]

### 功能性: X/10
[reasoning]

### 创新性: X/10
[reasoning]

### Fix 清单 (按 impact / effort 排序)
1. [具体改动 · 1 句话]
2. ...
\`\`\`

不要输出 HTML。不要客套话。直接评审。`;

  const critique = await runClaude(critiquePrompt, `round ${r} critique`);
  history.rounds[r - 2].critique = critique;

  // Rewrite
  const rewritePrompt = `${internalPreamble}

# 任务: 根据评审重写 HTML

你之前生成了一份内部 audit 报告 HTML · 评审员找到了改进点 · 请重写。

# 评审反馈

${critique}

# 客户 master.md (data source · 仍以此为准 · 不要编造)

\`\`\`markdown
${masterMd}
\`\`\`

# 之前的 HTML

\`\`\`html
${prevHtml}
\`\`\`

# 要求

按评审 Fix 清单**逐条应用**改进 · 输出新版 HTML:
1. 标题保持中文 (一、二、三 章节序)
2. 正文中文为主 · 数字/技术 ID 英文
3. 排版改进按评审建议 · 不要破坏已经好的
4. 保留所有真实数据 · 不要编

输出完整 \`<!doctype html>\` · 不要 markdown fence · 不要 commentary。Start with <!doctype html> · end with </html>。`;

  await runRound(r, rewritePrompt, critique);
}

// ───────────────────────────────────────────────────────────────
// Save final + history
// ───────────────────────────────────────────────────────────────
const finalHtml = history.rounds[history.rounds.length - 1].html;
fs.writeFileSync(outHtml, finalHtml);
history.completed_at = new Date().toISOString();
history.total_rounds = ROUNDS;
history.final_size = finalHtml.length;
// Strip full HTML from history JSON to keep file small · keep critique + size
const slimHistory = {
  ...history,
  rounds: history.rounds.map((r) => ({
    round: r.round,
    size: r.html.length,
    critique: r.critique || null,
    duration_s: r.duration_s,
  })),
};
fs.writeFileSync(historyJson, JSON.stringify(slimHistory, null, 2));

console.log(`\n[pl:optimize-internal-report] ✅ DONE`);
console.log(`  Final HTML: ${outHtml} (${finalHtml.length} bytes)`);
console.log(`  History:    ${historyJson}`);

// V3 D35 hook · refresh Discord thread + post update
(async () => {
  try {
    const entitiesDir = path.join(REPO, 'data/leads/entities');
    let foundKey = null;
    for (const f of fs.readdirSync(entitiesDir)) {
      if (!f.endsWith('.json')) continue;
      try {
        const e = JSON.parse(fs.readFileSync(path.join(entitiesDir, f), 'utf8'));
        const s = String(e?.latest?.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        if (s === slug) { foundKey = f.replace(/\.json$/, ''); break; }
      } catch {}
    }
    if (foundKey) {
      const { refreshThreadAndPost } = await import('../../core/funnel/lead-thread-sync.js');
      await refreshThreadAndPost(foundKey,
        `📊 **内部 audit (优化版) 已生成** · ${ROUNDS} 轮 · ${(finalHtml.length / 1024).toFixed(1)}KB`);
    }
  } catch { /* non-blocking */ }
})();

// ─── helpers ─────────────────────────────────────────────────
async function runRound(roundN, prompt, critique) {
  console.log(`\n━━━ Round ${roundN}/${ROUNDS} · writing HTML ━━━`);
  const start = Date.now();
  const out = await runClaude(prompt, `round ${roundN} write`);
  const docIdx = out.toLowerCase().indexOf('<!doctype html');
  const html = docIdx > 0 ? out.slice(docIdx) : out;
  const dur = Math.round((Date.now() - start) / 1000);
  history.rounds.push({ round: roundN, html, critique: critique || null, duration_s: dur });
  console.log(`  ✓ Round ${roundN} HTML · ${html.length} bytes · ${dur}s`);
}

function runClaude(prompt, label) {
  return new Promise((resolve, reject) => {
    const proc = spawn('claude', ['-p', prompt, '--model', MODEL], { stdio: ['ignore', 'pipe', 'inherit'] });
    let buf = '';
    proc.stdout.on('data', (chunk) => { buf += chunk.toString(); process.stderr.write('.'); });
    proc.on('exit', (code) => {
      process.stderr.write('\n');
      if (code !== 0) return reject(new Error(`claude CLI exit ${code} for ${label}`));
      resolve(buf);
    });
  });
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq > 2) { out[a.slice(2, eq)] = a.slice(eq + 1); continue; }
    const k = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) { out[k] = true; continue; }
    out[k] = next; i++;
  }
  return out;
}
