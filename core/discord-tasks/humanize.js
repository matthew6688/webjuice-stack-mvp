/**
 * Human-readable labels for Discord task notifications.
 * V3 D25 (2026-05-13): Discord 通知必须人话 · 业务事件 > 技术细节。
 * V3 D40 (2026-05-14): 删 admin URL · 加 business name lookup · 删 emoji from done/failed.
 *
 * Used by:
 *   - scripts/cli/pl-task-listener.js (task-created reply)
 *   - scripts/cli/pl-task-dispatcher.js (running / done / failed / timeout replies)
 */
import fs from 'node:fs';

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
  // V3 (2026-05-13): Discord live E2E found Bug A · router 不抽 niche/city → CLI args 错
  { match: /--niche required/i, human: '搜索词没识别到行业 · 试更简洁: `find brisbane plumber` (单数行业词) 或加 niche: `--niche plumber --city brisbane`' },
  { match: /--city required/i, human: '搜索词没识别到城市 · 加 `--city <city>` 或在 query 里明确城市名' },
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

  // V3 D43 (2026-05-14): 对齐 SOP-1/SOP-2 spec · bullet 格式 · 无 admin URL
  // (旧 admin URL 'https://tasks.profitslocal.com/tasks?id=...' 已删 · 链接打不开)
  const head = `${emoji ? emoji + ' ' : ''}**${label}** · 已收到`;
  const bodyLines = [`· 在做: ${verb} → \`${cliHum}\``];
  if (argsPreview) bodyLines.push(`· 参数: \`${argsPreview}\``);
  if (entityRef) bodyLines.push(`· ${entityRef}`);
  bodyLines.push(`· 预计 1-3 分钟出结果 · 完了我会回这里告诉你`);
  const techFold = `_技术细节: task=${task.task_id} · kind=${route.kind} · routed-by=${route.provider}_`;

  return [head, ...bodyLines, '', techFold].join('\n');
}

// 渲染 "完成" 通知
export function renderDoneMessage({ task, durationMs, tail, xref }) {
  const { emoji, label } = kindLabel(task.kind);
  const secs = (durationMs / 1000).toFixed(1);

  const head = `**${label}** · 完成 · 用时 ${secs}s`;
  const summary = extractBusinessSummary(task.kind, tail);
  const cross = xref ? `后续: ${xref}` : '';
  const tech = '\n<details><summary>技术细节</summary>\n\n```\n' + (tail || '').slice(-1200) + '\n```\n</details>';

  return [head, summary, cross].filter(Boolean).join('\n') + tech;
}

// 渲染 "失败" 通知
export function renderFailedMessage({ task, exitCode, stderr, tail }) {
  const { emoji, label } = kindLabel(task.kind);
  const human = explainFailure(stderr || tail, exitCode);

  const head = `❌ **${label}** · 失败`;
  const why = `原因: ${human}`;
  const taskInfo = `task: \`${task.task_id}\` · 详细见上面 thread message`;
  const tech = '\n<details><summary>技术细节</summary>\n\n```\n' + (tail || stderr || '').slice(-1200) + '\n```\n</details>';

  return [head, why, taskInfo].join('\n') + tech;
}

// 渲染 "超时" 通知
export function renderTimeoutMessage({ task, timeoutMs, tail }) {
  const { emoji, label } = kindLabel(task.kind);
  const secs = Math.round(timeoutMs / 1000);

  const head = `⏳ **${label}** · 超时 · 跑了 ${secs}s 后被终止`;
  const action = `已转人工 · react ✅ 重试 / 🗑 放弃 (task: \`${task.task_id}\`)`;
  const tech = '\n<details><summary>技术细节</summary>\n\n```\n' + (tail || '').slice(-1200) + '\n```\n</details>';

  return [head, action].join('\n') + tech;
}

// 试图从 CLI stdout 抽业务摘要 (kind-specific)
// V3 D40 (2026-05-14): 显商家名字 · 不显 place_id
function extractBusinessSummary(kind, tail) {
  const t = String(tail || '');
  if (kind === 'intake' || kind === 'places-intake' || kind === 'scrape') {
    // 找 lead_keys + business names from CLI JSON output
    const names = extractBusinessNames(t);
    if (names.length > 0) {
      const lines = [`找到 ${names.length} 个商家:`];
      names.slice(0, 10).forEach((n) => lines.push(`- ${n}`));
      if (names.length > 10) lines.push(`_(+${names.length - 10} 个更多)_`);
      return lines.join('\n');
    }
    // fallback to count
    const m = t.match(/(?:found|rows?|leads?|entities?|lead_count)[:\s]+(\d+)/i);
    if (m) return `找到 ${m[1]} 个商家`;
    return '抓取完成';
  }
  if (kind === 'single-enrich') {
    // single-enrich JSON 含 "name": "..."
    const nameMatch = t.match(/"name"[:\s]*"([^"]+)"/);
    if (nameMatch) return `匹配商家: **${nameMatch[1]}**`;
    return '商家解析完成';
  }
  if (kind === 'image-extract') {
    // OCR 结果通常含 businessName
    const nameMatch = t.match(/"businessName"[:\s]*"([^"]+)"/i)
      || t.match(/business[_-]?name[=:\s]+"?([^"\n]+)"?/i);
    if (nameMatch) return `识别商家: **${nameMatch[1]}**`;
    return '图片识别完成';
  }
  if (kind === 'audit') {
    const m = t.match(/audit_score[:\s]+(\d+)/i);
    if (m) return `audit 完成 · 得分 ${m[1]}/100`;
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

/**
 * V3 D40 · Extract business names from CLI stdout JSON.
 * Handles: places-intake batches[].lead_keys array · entity name lookup.
 */
function extractBusinessNames(tail) {
  const t = String(tail || '');
  const names = [];

  // Pattern 1: JSON has "lead_keys": ["place_xxx", ...] · lookup each entity
  const leadKeysMatch = t.match(/"lead_keys"\s*:\s*\[([^\]]+)\]/);
  if (leadKeysMatch) {
    const keys = leadKeysMatch[1].match(/"(place_[a-z0-9_]+|domain_[^"]+|phone_[^"]+|image_[^"]+|manual_[^"]+)"/g) || [];
    for (const keyStr of keys) {
      const key = keyStr.replace(/"/g, '');
      const name = lookupEntityName(key);
      if (name) names.push(name);
    }
  }

  // Pattern 2: docker scrape stdout has "name": "..." per result
  if (names.length === 0) {
    const nameMatches = t.matchAll(/"name"\s*:\s*"([^"]{3,80})"/g);
    for (const m of nameMatches) {
      if (!names.includes(m[1])) names.push(m[1]);
      if (names.length >= 15) break;
    }
  }

  return names;
}

/** Read entity name from data/leads/entities/<key>.json · cheap lookup */
function lookupEntityName(entityKey) {
  try {
    const p = `data/leads/entities/${entityKey}.json`;
    if (!fs.existsSync(p)) return null;
    const e = JSON.parse(fs.readFileSync(p, 'utf8'));
    return e.latest?.name || null;
  } catch { return null; }
}
