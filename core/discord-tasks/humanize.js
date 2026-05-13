/**
 * Human-readable labels + admin URL deep links for Discord task notifications.
 * V3 D25 (2026-05-13): Discord 通知必须人话 · 业务事件 > 技术细节。
 *
 * Used by:
 *   - scripts/cli/pl-task-listener.js (task-created reply)
 *   - scripts/cli/pl-task-dispatcher.js (running / done / failed / timeout replies)
 */

// 8 task kinds → 业务术语 + emoji
const KIND_LABELS = {
  scrape:          { emoji: '🔎', label: '批量抓客户', verb: '抓取' },
  'places-intake': { emoji: '🔎', label: '精准搜客户', verb: '搜索' },
  'single-enrich': { emoji: '🎯', label: '查 1 个具体客户', verb: '解析' },
  audit:           { emoji: '🔬', label: '客户网站审计', verb: '审计' },
  dedup:           { emoji: '🧹', label: '判重 + 合并', verb: '查重' },
  'image-extract': { emoji: '🖼', label: '从图片提取客户信息', verb: 'OCR + 提取' },
  enrich:          { emoji: '➕', label: '补全客户联系方式', verb: '补全' },
  ops:             { emoji: '⚙️', label: '系统任务', verb: '执行' },
  demo_build:      { emoji: '🎨', label: '生成 M3 demo 网站', verb: '生成' },
  photos_fetch:    { emoji: '📷', label: '拉 GMB 照片', verb: '下载' },
};

const FALLBACK = { emoji: '⚙️', label: '后台任务', verb: '执行' };

export function kindLabel(kind) {
  return KIND_LABELS[kind] || FALLBACK;
}

// CLI → 用户友好的"在做什么"短句
const CLI_HUMAN = {
  'pl:pipeline-batch-start':  '启动批量抓任务',
  'pl:scrape-docker':         '本地 gosom 抓 Google Maps',
  'pl:places-search-intake':  'Google Places 精准搜',
  'pl:single-enrich':         'Places 解析 1 个商家 + 补全',
  'pl:run-enrichment-batch':  '批量补全联系方式',
  'pl:ingest-image':          '图片 OCR + 商家信息提取',
  'pl:dedup-audit':           '扫全库找疑似重复',
  'pl:download-places-photos':'下载 GMB 6 张照片',
  'leads:run-pipeline':       '跑 audit 4 阶段',
  'leads:build-master-md':    '生成 master.md',
  'leads:build-internal-report': '生成内部 audit HTML',
  'pl:build-from-reference':  '生成 demo 网站',
  'ops:health-check':         '系统健康检查',
};

export function cliHuman(cli) {
  return CLI_HUMAN[cli] || cli;
}

// 失败 stderr / exit code → 人话解释
const FAILURE_PATTERNS = [
  { match: /docker.*not running|ECONNREFUSED.*8080/i, human: 'gosom Docker 容器没启动 · 跑 `docker start gmaps-scraper-web` 后 ✅ 重试这条' },
  { match: /quota.*exceeded|PlacesQuotaCap/i, human: '今天 Google Places API 额度用完 · 等明天 0:00 重置 · 或用 docker 抓取代替' },
  { match: /GOOGLE_PLACES_API_KEY missing/i, human: 'Google API key 未配置 · 检查 .env.local 的 GOOGLE_PLACES_API_KEY' },
  { match: /ENOTFOUND|getaddrinfo/i, human: '网络问题 · 域名解析失败 · 检查 internet · ✅ 重试' },
  { match: /ECONNREFUSED/i, human: '连接被拒 · 目标网站可能挂了 / DNS 错 / 防火墙 · 暂时跳过' },
  { match: /Cannot find package/i, human: '依赖缺失 · 跑 `npm install` 后 ✅ 重试' },
  { match: /timeout|killed.*signal/i, human: '任务超时 · 网站太慢 / API 太久 · 重跑 1 次仍超时 → 跳过' },
  { match: /place_id.*not.*resolvable|no place_id/i, human: '没法从输入解析出商家 · 检查 maps URL 或 business-name 拼写' },
  { match: /city.*alone is not enough/i, human: '只给了 city 不够 · 加 --business-name 或 --phone 或 --website' },
];

export function explainFailure(stderr, exitCode) {
  const text = String(stderr || '').slice(-2000);
  for (const { match, human } of FAILURE_PATTERNS) {
    if (match.test(text)) return human;
  }
  if (exitCode === 124 || exitCode === 137) return '任务被超时强杀 · 重跑 1 次或加 timeout';
  return `CLI 退出码 ${exitCode} · ${text.slice(-200) || '无 stderr'}`;
}

// Admin URL 深链
const ADMIN_BASE = process.env.ADMIN_BASE_URL || 'https://tasks.profitslocal.com';

export function adminUrl(path = '') {
  const base = ADMIN_BASE.replace(/\/$/, '');
  const clean = String(path || '').replace(/^\//, '');
  return clean ? `${base}/${clean}` : base;
}

export const adminUrls = {
  task: (taskId) => adminUrl(`tasks?id=${taskId}`),
  discovery: (runId) => adminUrl(`discovery?run=${runId}`),
  customerAudit: (slug) => adminUrl(`customer/${slug}/audit`),
  customerDemo: (slug) => adminUrl(`customer/${slug}/demo`),
  customerPhotos: (slug) => adminUrl(`customer/${slug}/photos`),
  coldQueue: () => adminUrl('queue/cold-outreach'),
};

// 渲染 "任务已创建" 通知 · 人话版
export function renderTaskCreatedMessage({ task, route }) {
  const { emoji, label, verb } = kindLabel(route.kind);
  const cliHum = cliHuman(route.target_cli);
  const argsPreview = (route.args || []).slice(0, 6).join(' ');
  const entityRef = route.target_entity_key ? `客户: \`${route.target_entity_key}\`` : '';

  const head = `${emoji} **${label}** · 已收到`;
  const body = `· 在做: ${verb} → \`${cliHum}\`${argsPreview ? `\n· 参数: \`${argsPreview}\`` : ''}${entityRef ? `\n· ${entityRef}` : ''}`;
  const expect = `· 预计 1-3 分钟出结果 · 完了我会回这里告诉你`;
  const link = `· 进度详情: ${adminUrls.task(task.task_id)}`;
  const techFold = `_技术细节: task=${task.task_id} · kind=${route.kind} · routed-by=${route.provider}_`;

  return [head, body, expect, link, '', techFold].join('\n');
}

// 渲染 "完成" 通知
export function renderDoneMessage({ task, durationMs, tail, xref }) {
  const { emoji, label } = kindLabel(task.kind);
  const secs = (durationMs / 1000).toFixed(1);

  const head = `✅ **${label}** · 完成 · 用时 ${secs}s`;
  const summary = extractBusinessSummary(task.kind, tail);
  const cross = xref ? `· 后续: ${xref}` : '';
  const tech = '\n<details><summary>技术细节</summary>\n\n```\n' + (tail || '').slice(-1200) + '\n```\n</details>';

  return [head, summary, cross].filter(Boolean).join('\n') + tech;
}

// 渲染 "失败" 通知
export function renderFailedMessage({ task, exitCode, stderr, tail }) {
  const { emoji, label } = kindLabel(task.kind);
  const human = explainFailure(stderr || tail, exitCode);

  const head = `❌ **${label}** · 失败`;
  const why = `· 原因: ${human}`;
  const link = `· 详情: ${adminUrls.task(task.task_id)}`;
  const tech = '\n<details><summary>技术细节</summary>\n\n```\n' + (tail || stderr || '').slice(-1200) + '\n```\n</details>';

  return [head, why, link].join('\n') + tech;
}

// 渲染 "超时" 通知
export function renderTimeoutMessage({ task, timeoutMs, tail }) {
  const { emoji, label } = kindLabel(task.kind);
  const secs = Math.round(timeoutMs / 1000);

  const head = `⏳ **${label}** · 超时 · 跑了 ${secs}s 后被终止`;
  const action = `· 已转人工 · 看 ${adminUrls.task(task.task_id)} 决定 ✅ 重试 / 🗑 放弃`;
  const tech = '\n<details><summary>技术细节</summary>\n\n```\n' + (tail || '').slice(-1200) + '\n```\n</details>';

  return [head, action].join('\n') + tech;
}

// 试图从 CLI stdout 抽业务摘要 (kind-specific)
function extractBusinessSummary(kind, tail) {
  const t = String(tail || '');
  if (kind === 'scrape' || kind === 'places-intake') {
    // 抓取类 · 找 "N rows" / "found N" / "lead_count"
    const m = t.match(/(?:found|rows?|leads?|entities?)[:\s]+(\d+)/i);
    if (m) return `· 找到 ${m[1]} 个客户 · 看清单: ${adminUrls.discovery('')}`;
    return '· 抓取完成 · 看清单: ' + adminUrls.discovery('');
  }
  if (kind === 'audit') {
    const m = t.match(/audit_score[:\s]+(\d+)/i);
    if (m) return `· audit 完成 · 得分 ${m[1]}/100`;
    return '· audit 4 阶段都跑完';
  }
  if (kind === 'single-enrich') {
    return '· 客户已入库 + master.md skeleton 已建';
  }
  if (kind === 'image-extract') {
    return '· 图片解析完 · 商家信息已入库';
  }
  if (kind === 'demo_build') {
    return '· demo 网站生成完 · 在 clients/<slug>/v2/concept/reference-adapter/';
  }
  return '';
}
