#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import {
  buildDocumentModelComparisonInput,
  parseModelJson,
} from '../../core/leads/document-model-comparison.js';

const root = process.cwd();
const args = parseArgs(process.argv.slice(2));
const clientSlug = args.client || 'roofing-restoration-greg-sign';
const reportRoot = path.join(root, 'data', 'qa', 'document-model-comparison');
const clientReportDir = path.join(root, 'clients', clientSlug, 'reports');
const publicComparisonDir = path.join(root, 'public', 'admin-artifacts', 'document-model-comparison');
const publicClientReportDir = path.join(root, 'public', 'admin-artifacts', clientSlug, 'reports');
fs.mkdirSync(clientReportDir, { recursive: true });
fs.mkdirSync(publicComparisonDir, { recursive: true });
fs.mkdirSync(publicClientReportDir, { recursive: true });

const input = readJson(path.join(reportRoot, 'smoke-cli', 'input.json')) || buildDocumentModelComparisonInput();
const prompt = readText(path.join(reportRoot, 'smoke-cli', 'prompt.txt'));
const providers = [
  providerRecord({ runId: 'smoke-cli', id: 'codex', label: 'Codex CLI' }),
  providerRecord({ runId: 'smoke-cli', id: 'claude', label: 'Claude Code CLI' }),
  providerRecord({ runId: 'smoke-qwen-think-off', id: 'ollama-qwen3-6-27b', label: 'Qwen local think-off' }),
  providerRecord({ runId: 'smoke-deepseek-strict-v2', id: 'ollama-deepseek-r1-14b', label: 'DeepSeek local strict-v2' }),
].filter(Boolean);
const selected = providers.find((item) => item.id === (args.source || 'codex')) || providers[0];
const selectedDoc = selected?.parsed?.ok ? selected.parsed.value : {};

const comparisonHtml = buildComparisonHtml({ input, prompt, providers, selected });
const comparisonPath = path.join(reportRoot, 'document-model-comparison-report.html');
const publicComparisonPath = path.join(publicComparisonDir, 'document-model-comparison-report.html');
writeText(comparisonPath, comparisonHtml);
writeText(publicComparisonPath, comparisonHtml);

const chineseReport = buildChineseLeadReport({ input, selectedDoc, selected });
const leadReportHtml = buildLeadReportHtml({ input, report: chineseReport, selected });
const leadReportMd = buildLeadReportMarkdown({ input, report: chineseReport, selected });
const leadReportJson = {
  schemaVersion: 1,
  clientSlug,
  sourceProvider: selected.label,
  sourceRunId: selected.runId,
  report: chineseReport,
  generatedAt: new Date().toISOString(),
};
const leadHtmlPath = path.join(clientReportDir, 'discovery-report-cn.html');
const leadMdPath = path.join(clientReportDir, 'discovery-report-cn.md');
const leadJsonPath = path.join(clientReportDir, 'discovery-report-cn.json');
const publicLeadHtmlPath = path.join(publicClientReportDir, 'discovery-report-cn.html');
const publicLeadMdPath = path.join(publicClientReportDir, 'discovery-report-cn.md');
const publicLeadJsonPath = path.join(publicClientReportDir, 'discovery-report-cn.json');
writeText(leadHtmlPath, leadReportHtml);
writeText(leadMdPath, leadReportMd);
writeJson(leadJsonPath, leadReportJson);
writeText(publicLeadHtmlPath, leadReportHtml);
writeText(publicLeadMdPath, leadReportMd);
writeJson(publicLeadJsonPath, leadReportJson);

const summary = {
  ok: true,
  comparisonPath: path.relative(root, comparisonPath),
  publicComparisonPath: path.relative(root, publicComparisonPath),
  leadHtmlPath: path.relative(root, leadHtmlPath),
  leadMdPath: path.relative(root, leadMdPath),
  leadJsonPath: path.relative(root, leadJsonPath),
  publicLeadHtmlPath: path.relative(root, publicLeadHtmlPath),
  publicLeadMdPath: path.relative(root, publicLeadMdPath),
  publicLeadJsonPath: path.relative(root, publicLeadJsonPath),
  selectedProvider: selected?.label || '',
  providers: providers.map((item) => ({
    label: item.label,
    runId: item.runId,
    score: item.result?.evaluation?.score ?? 0,
    grade: item.result?.evaluation?.grade || 'F',
    durationMs: item.result?.durationMs ?? 0,
  })),
};
writeJson(path.join(reportRoot, 'document-model-comparison-report.summary.json'), summary);
console.log(JSON.stringify(summary, null, 2));

function providerRecord({ runId, id, label }) {
  const runRoot = path.join(reportRoot, runId);
  const rawPath = path.join(runRoot, `${id}.raw.txt`);
  const resultPath = path.join(runRoot, `${id}.result.json`);
  if (!fs.existsSync(rawPath) || !fs.existsSync(resultPath)) return null;
  const raw = readText(rawPath);
  const result = readJson(resultPath);
  return {
    id,
    label,
    runId,
    rawPath: path.relative(root, rawPath),
    resultPath: path.relative(root, resultPath),
    raw,
    result,
    parsed: parseModelJson(raw),
  };
}

function buildChineseLeadReport({ input, selectedDoc, selected }) {
  const facts = input.verifiedFacts || {};
  const services = facts.services || [];
  const missing = selectedDoc.discoveryReport?.missingEvidence || [
    '邮箱',
    '地址',
    '官网',
    'Google Business Profile',
    '真实客户评价',
    '项目照片',
  ];
  return {
    title: `${facts.businessName || input.businessName} 线索调研与网站机会报告`,
    verdict: '建议进入 Mockup 准备阶段，但需要把“证据缺口”清楚标记在内部记录里。',
    confidence: '中高',
    oneLine: '这个线索有真实电话、明确服务范围、强钩子（40 年经验 + 免费上门检查），但线上存在感很弱，适合用一个清晰、电话优先的本地服务网站做突破。',
    sourceSummary: [
      '来源是 operator 提供的招牌图片和文字转录。',
      `已确认电话：${facts.phones?.[0] || '未提供'}`,
      '没有确认官网、邮箱、地址、Google 评价或项目照片。',
    ],
    verifiedFacts: [
      ['业务名称', facts.businessName || input.businessName || ''],
      ['联系人', facts.contactName || 'Greg'],
      ['电话', facts.phones?.[0] || ''],
      ['服务范围', services.map(translateService).join('、')],
      ['来源声明', (facts.claimsFromSource || []).map(translateClaim).join('；')],
    ],
    gaps: [
      '客户无法从搜索结果里快速确认这家公司是否真实可靠。',
      '没有官网时，服务范围、报价方式、服务地区、项目案例都无法被系统化展示。',
      '只有电话会让转化路径过于单薄，尤其是年轻客户和移动端用户。',
      '缺少 Google 评价、项目图片和营业信息，后续需要继续补证据。',
    ],
    opportunity: [
      '首页首屏直接打“免费上门检查 + 电话预约”，减少用户犹豫。',
      '把 roofing、gutters、driveway、patio、pressure cleaning 整理成清楚的服务模块。',
      '用“40 年经验”作为信任钩子，但不要扩展成未经证实的资质、奖项或保修承诺。',
      '用流程区解释：来电、确认问题、上门检查、给 quote，降低第一次联系的心理成本。',
    ],
    recommendedSite: {
      position: '电话优先的本地屋顶修复与外部翻新单页网站。首屏先讲清楚免费上门检查和电话预约，再用服务模块、流程说明和图片建立信任。',
      blocks: normalizeBlocks(selectedDoc.websiteProductionSpec?.blockPlan).map(translateBlock),
      assets: normalizeAssets(selectedDoc.websiteProductionSpec?.assetPlan).map(translateAsset),
      cta: `Call Greg on ${facts.phones?.[0] || ''}`,
    },
    copyDirection: {
      hero: '免费上门检查的屋顶修复与外部翻新服务',
      subcopy: `Roofing & Restoration 可以把屋顶修复、gutter、driveway、patio 和 pressure cleaning 这些服务整理成一个清楚的电话预约页面。用户第一眼就知道做什么、怎么联系、下一步怎么走。`,
      tone: '直接、可信、像本地老师傅，不要写成科技公司，不要夸大。',
    },
    missingEvidence: missing.map(translateMissingEvidence),
    forbidden: [
      '不能编造邮箱、地址、官网。',
      '不能编造 Google review、评分、执照、奖项、价格、保修。',
      '如果使用 AI 生成图片或示例评价，只能作为内部 demo content 记录，前端不要写 placeholder。',
    ],
    nextSteps: [
      '补一次 Google / Maps / social 搜索，确认是否真的没有官网和 GBP。',
      '如果仍无官网，直接进入电话优先 Mockup。',
      '生成 asset plan：真实招牌图、roofing 工作图、屋顶细节图、联系区背景图。',
      '用 Open Design 生成单页 mockup 后，必须跑 UI / copy / mobile / SEO / fact audit。',
      '通过后再生成 cold outreach 文案和 10 秒 walkthrough。'
    ],
    sourceModel: `${selected.label} (${selected.runId})`,
  };
}

function normalizeBlocks(blockPlan = []) {
  if (!Array.isArray(blockPlan)) return [];
  return blockPlan.map((block) => {
    if (typeof block === 'string') return block;
    return block.id || block.block || block.blockName || block.type || JSON.stringify(block);
  }).filter(Boolean);
}

function normalizeAssets(assetPlan = []) {
  if (!Array.isArray(assetPlan)) return [];
  return assetPlan.map((asset) => {
    if (typeof asset === 'string') return asset;
    return asset.need || asset.asset || asset.assetType || asset.sourceRequirement || JSON.stringify(asset);
  }).filter(Boolean);
}

function translateService(service) {
  const map = {
    'roof restorations': '屋顶翻新 / 修复',
    capping: '屋脊 / 边缘 capping',
    respray: '屋顶重新喷涂',
    repairs: '维修',
    gutters: '排水槽 / gutter',
    driveway: '车道',
    patio: '露台',
    'external living': '户外生活空间',
    'retaining wall': '挡土墙',
    'pressure cleaning': '高压清洗',
  };
  return map[String(service).toLowerCase()] || service;
}

function translateClaim(claim) {
  const lower = String(claim).toLowerCase();
  if (lower.includes('40 years')) return '40 年经验';
  if (lower.includes('free') && lower.includes('inspection')) return '免费上门检查和报价';
  return claim;
}

function translateBlock(block) {
  const key = String(block).toLowerCase();
  const map = {
    hero: '首屏：业务一句话 + 电话 CTA + 免费上门检查',
    services: '服务模块：把屋顶、gutter、车道、露台、高压清洗分组讲清楚',
    service_overview: '服务总览：把屋顶、gutter、车道、露台、高压清洗分组讲清楚',
    trust: '信任模块：只使用已提供的 40 年经验和流程透明度，不编造评价',
    inspection_quote: '检查与报价：解释免费上门检查如何开始',
    experience: '经验说明：用 40 年经验做可信度钩子',
    process: '流程模块：来电、确认问题、上门检查、给 quote',
    faq: '常见问题：回答上门检查、服务范围、报价准备',
    contact: '联系模块：电话优先，表单只收姓名、电话和需求',
    final_cta: '最终 CTA：再次强调打电话预约检查',
  };
  return map[key] || block;
}

function translateAsset(asset) {
  const key = String(asset).toLowerCase();
  if (key.includes('hero')) return '首屏图：真实屋顶 / roofing 工作图，移动端裁切要好';
  if (key.includes('restoration')) return '服务图：屋顶修复或翻新现场图';
  if (key.includes('gutter')) return '细节图：gutter、屋顶边缘或材料细节';
  if (key.includes('before')) return '对比图：只有拿到真实项目照片后再使用 before / after';
  if (key.includes('contact')) return '联系区背景图：本地住宅或屋顶细节，不能喧宾夺主';
  return asset;
}

function translateMissingEvidence(item) {
  const key = String(item).toLowerCase();
  if (key.includes('email')) return '邮箱';
  if (key.includes('street') || key.includes('address')) return '地址';
  if (key.includes('website')) return '官网';
  if (key.includes('service area')) return '服务区域';
  if (key.includes('licence') || key.includes('license') || key.includes('registration')) return '执照 / 注册信息';
  if (key.includes('insurance')) return '保险信息';
  if (key.includes('google business')) return 'Google Business Profile';
  if (key.includes('google rating')) return 'Google 评分';
  if (key.includes('review')) return '真实客户评价';
  if (key.includes('project')) return '项目照片';
  if (key.includes('before')) return '真实 before / after 照片';
  if (key.includes('brand logo')) return '品牌 logo';
  if (key.includes('hours')) return '营业时间';
  return item;
}

function buildComparisonHtml({ input, prompt, providers, selected }) {
  const rows = providers.map((item) => {
    const evaluation = item.result?.evaluation || {};
    const findings = (evaluation.findings || []).map((finding) => `<li>${escapeHtml(finding.code)}：${escapeHtml(finding.message)}</li>`).join('');
    return `
      <tr>
        <td><strong>${escapeHtml(item.label)}</strong><br><span>${escapeHtml(item.runId)}</span></td>
        <td>${escapeHtml(String(evaluation.score ?? 0))} / ${escapeHtml(evaluation.grade || 'F')}</td>
        <td>${formatMs(item.result?.durationMs || 0)}</td>
        <td>${findings ? `<ul>${findings}</ul>` : '<span class="ok">无主要问题</span>'}</td>
      </tr>`;
  }).join('');
  const outputSections = providers.map((item) => `
    <details>
      <summary>${escapeHtml(item.label)} 原始输出 · ${escapeHtml(String(item.result?.evaluation?.score ?? 0))}/${escapeHtml(item.result?.evaluation?.grade || 'F')}</summary>
      <pre>${escapeHtml(item.raw)}</pre>
    </details>`).join('');
  return htmlShell({
    title: 'ProfitsLocal 文档模型比较',
    eyebrow: 'Model QA',
    body: `
      <section class="hero">
        <div>
          <p class="kicker">ProfitsLocal 内部实验</p>
          <h1>文档模型比较：从线索 payload 到网站生产报告</h1>
          <p class="lede">这个页面保留完整 prompt、源数据、模型输出和评分。目标是让我们知道哪个模型适合写 discovery report、gap score、production spec 和 copy brief。</p>
        </div>
        <div class="stamp">
          <strong>${escapeHtml(selected?.label || '')}</strong>
          <span>当前推荐</span>
        </div>
      </section>
      <section>
        <h2>评分结果</h2>
        <table>
          <thead><tr><th>模型</th><th>分数</th><th>耗时</th><th>主要发现</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </section>
      <section class="grid two">
        <div>
          <h2>源数据 Payload</h2>
          <pre>${escapeHtml(JSON.stringify(input, null, 2))}</pre>
        </div>
        <div>
          <h2>统一提示词</h2>
          <pre>${escapeHtml(prompt)}</pre>
        </div>
      </section>
      <section>
        <h2>模型原始输出</h2>
        ${outputSections}
      </section>
    `,
  });
}

function buildLeadReportHtml({ input, report, selected }) {
  const factsRows = report.verifiedFacts.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('');
  const blockList = report.recommendedSite.blocks.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  const assetList = report.recommendedSite.assets.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  return htmlShell({
    title: report.title,
    eyebrow: 'Lead Discovery',
    body: `
      <section class="hero">
        <div>
          <p class="kicker">ProfitsLocal 线索报告</p>
          <h1>${escapeHtml(report.title)}</h1>
          <p class="lede">${escapeHtml(report.oneLine)}</p>
        </div>
        <div class="stamp">
          <strong>${escapeHtml(report.confidence)}</strong>
          <span>推进信心</span>
        </div>
      </section>
      <section class="decision">
        <span>结论</span>
        <p>${escapeHtml(report.verdict)}</p>
      </section>
      <section class="grid two">
        <div>
          <h2>已确认信息</h2>
          <table>${factsRows}</table>
        </div>
        <div>
          <h2>来源说明</h2>
          ${list(report.sourceSummary)}
        </div>
      </section>
      <section class="grid two">
        <div>
          <h2>当前缺口</h2>
          ${list(report.gaps)}
        </div>
        <div>
          <h2>机会判断</h2>
          ${list(report.opportunity)}
        </div>
      </section>
      <section class="grid two">
        <div>
          <h2>建议网站方向</h2>
          <p>${escapeHtml(report.recommendedSite.position)}</p>
          <h3>页面模块</h3>
          <ol>${blockList}</ol>
        </div>
        <div>
          <h2>图片与素材方向</h2>
          <ol>${assetList}</ol>
          <h3>主 CTA</h3>
          <p class="cta">${escapeHtml(report.recommendedSite.cta)}</p>
        </div>
      </section>
      <section>
        <h2>文案方向</h2>
        <div class="quote">
          <strong>${escapeHtml(report.copyDirection.hero)}</strong>
          <p>${escapeHtml(report.copyDirection.subcopy)}</p>
          <small>${escapeHtml(report.copyDirection.tone)}</small>
        </div>
      </section>
      <section class="grid two">
        <div>
          <h2>还需要补的证据</h2>
          ${list(report.missingEvidence)}
        </div>
        <div>
          <h2>禁止编造</h2>
          ${list(report.forbidden)}
        </div>
      </section>
      <section>
        <h2>下一步</h2>
        ${list(report.nextSteps, 'ol')}
      </section>
      <footer>
        <span>Generated by ProfitsLocal document pipeline</span>
        <span>Source: ${escapeHtml(selected.label)} / ${escapeHtml(selected.runId)}</span>
        <span>Lead: ${escapeHtml(input.leadSlug || '')}</span>
      </footer>
    `,
  });
}

function buildLeadReportMarkdown({ report, selected }) {
  return [
    `# ${report.title}`,
    '',
    `结论：${report.verdict}`,
    '',
    report.oneLine,
    '',
    '## 已确认信息',
    ...report.verifiedFacts.map(([label, value]) => `- ${label}: ${value}`),
    '',
    '## 当前缺口',
    ...report.gaps.map((item) => `- ${item}`),
    '',
    '## 机会判断',
    ...report.opportunity.map((item) => `- ${item}`),
    '',
    '## 建议网站方向',
    report.recommendedSite.position,
    '',
    '## 页面模块',
    ...report.recommendedSite.blocks.map((item) => `- ${item}`),
    '',
    '## 图片与素材方向',
    ...report.recommendedSite.assets.map((item) => `- ${item}`),
    '',
    '## 文案方向',
    `Hero: ${report.copyDirection.hero}`,
    `Subcopy: ${report.copyDirection.subcopy}`,
    '',
    '## 禁止编造',
    ...report.forbidden.map((item) => `- ${item}`),
    '',
    '## 下一步',
    ...report.nextSteps.map((item, index) => `${index + 1}. ${item}`),
    '',
    `Source: ${selected.label} / ${selected.runId}`,
  ].join('\n');
}

function htmlShell({ title, eyebrow, body }) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --ink: #17202a;
      --muted: #5d6673;
      --paper: #fff7ea;
      --surface: #fffdf7;
      --line: #1d232b;
      --accent: #ff6640;
      --gold: #ffd95a;
      --soft: #f1e6d4;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--paper); color: var(--ink); }
    body::before { content: ""; position: fixed; inset: 0; pointer-events: none; background: linear-gradient(90deg, rgba(23,32,42,.035) 1px, transparent 1px), linear-gradient(rgba(23,32,42,.025) 1px, transparent 1px); background-size: 56px 56px; }
    main { width: min(1180px, calc(100% - 40px)); margin: 32px auto; background: var(--surface); border: 2px solid var(--line); box-shadow: 8px 8px 0 var(--line); }
    header { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 18px 28px; border-bottom: 2px solid var(--line); }
    .brand { display: flex; align-items: center; gap: 10px; font-weight: 900; letter-spacing: .01em; }
    .mark { width: 28px; height: 28px; border-radius: 50%; background: var(--accent); display: grid; place-items: center; color: white; font-weight: 900; }
    .eyebrow { color: var(--muted); font-size: 13px; font-weight: 800; text-transform: uppercase; }
    section { padding: 30px 36px; border-bottom: 1px solid rgba(29,35,43,.22); }
    .hero { display: grid; grid-template-columns: 1fr 180px; gap: 32px; align-items: end; }
    .kicker { margin: 0 0 14px; font-size: 13px; font-weight: 900; text-transform: uppercase; color: var(--accent); }
    h1 { font-size: clamp(38px, 7vw, 88px); line-height: .92; margin: 0; max-width: 920px; letter-spacing: 0; }
    h2 { font-size: 22px; margin: 0 0 18px; }
    h3 { font-size: 15px; margin: 22px 0 8px; color: var(--muted); text-transform: uppercase; }
    .lede { max-width: 760px; color: var(--muted); font-size: 18px; line-height: 1.6; font-weight: 650; }
    .stamp { border: 2px solid var(--line); background: var(--gold); min-height: 128px; display: grid; place-items: center; text-align: center; padding: 16px; box-shadow: 4px 4px 0 var(--line); }
    .stamp strong { display: block; font-size: 24px; }
    .stamp span { color: var(--muted); font-weight: 800; font-size: 12px; }
    .grid.two { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
    .decision { background: #17202a; color: #fffdf7; display: grid; grid-template-columns: 90px 1fr; gap: 20px; align-items: start; }
    .decision span { color: var(--gold); font-weight: 900; }
    .decision p { margin: 0; font-size: 22px; line-height: 1.45; font-weight: 850; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { border: 1px solid rgba(29,35,43,.24); padding: 12px 14px; vertical-align: top; text-align: left; }
    th { background: var(--soft); width: 150px; }
    thead th { width: auto; }
    ul, ol { margin: 0; padding-left: 20px; color: var(--muted); line-height: 1.65; font-weight: 650; }
    li + li { margin-top: 6px; }
    p { color: var(--muted); line-height: 1.65; font-weight: 650; }
    pre { white-space: pre-wrap; word-break: break-word; background: #17202a; color: #fffdf7; padding: 18px; border-radius: 0; border: 2px solid var(--line); max-height: 520px; overflow: auto; font-size: 12px; line-height: 1.55; }
    details { border: 1px solid rgba(29,35,43,.28); background: #fffaf0; margin: 12px 0; }
    summary { cursor: pointer; padding: 14px 16px; font-weight: 900; }
    details pre { margin: 0; border-left: 0; border-right: 0; border-bottom: 0; }
    .ok { color: #137a47; font-weight: 900; }
    .quote { border-left: 6px solid var(--accent); background: #fff4df; padding: 20px 22px; }
    .quote strong { font-size: 26px; line-height: 1.1; display: block; }
    .quote small { color: var(--muted); font-weight: 800; }
    .cta { display: inline-block; color: var(--line); background: var(--gold); border: 2px solid var(--line); box-shadow: 3px 3px 0 var(--line); padding: 10px 14px; font-weight: 900; }
    footer { display: flex; flex-wrap: wrap; gap: 18px; justify-content: space-between; padding: 18px 28px; color: var(--muted); font-size: 12px; font-weight: 800; }
    @media (max-width: 760px) {
      main { width: calc(100% - 18px); margin: 12px auto; box-shadow: 4px 4px 0 var(--line); }
      header, section { padding: 20px; }
      .hero, .grid.two, .decision { grid-template-columns: 1fr; }
      h1 { font-size: 42px; }
      .stamp { min-height: 96px; }
      pre { max-height: 420px; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div class="brand"><span class="mark">P</span><span>profitslocal</span></div>
      <div class="eyebrow">${escapeHtml(eyebrow)}</div>
    </header>
    ${body}
  </main>
</body>
</html>`;
}

function list(items, tag = 'ul') {
  return `<${tag}>${(items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</${tag}>`;
}

function formatMs(ms) {
  if (!ms) return '0s';
  return `${(ms / 1000).toFixed(1)}s`;
}

function readText(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value);
}

function writeJson(filePath, value) {
  writeText(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) parsed[key] = true;
    else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}
