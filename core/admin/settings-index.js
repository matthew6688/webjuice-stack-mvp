import fs from 'node:fs';
import path from 'node:path';

const STATUS_LABELS = {
  configured: '已配置',
  partial: '待确认',
  missing: '缺失',
  optional: '可选',
};

const LOCAL_ENV_FILES = ['.env', '.env.local', '.dev.vars'];
let activeSettingsEnv = {};
let activeEnvSources = {};

export function loadAdminSettingsIndex(env = loadAdminSettingsEnv()) {
  activeSettingsEnv = env || {};
  activeEnvSources = env?.__sources || {};
  const sections = [
    buildOpsSection(env),
    buildSpecialAlertsSection(env),
    buildOpenDesignSection(env),
    buildTransactionalEmailSection(env),
    buildColdOutreachSection(env),
    buildPaymentsSection(env),
    buildMediaSection(env),
    buildResearchSection(env),
    buildDomainSection(env),
    buildLocalAiSection(env),
  ];

  const counts = sections.reduce((acc, section) => {
    acc.total += section.items.length;
    for (const item of section.items) {
      acc[item.status] = (acc[item.status] || 0) + 1;
    }
    return acc;
  }, { total: 0, configured: 0, partial: 0, missing: 0, optional: 0 });

  const blockers = sections.flatMap((section) =>
    section.items
      .filter((item) => item.required && item.status !== 'configured')
      .map((item) => ({
        section: section.title,
        label: item.label,
        status: item.status,
        statusLabel: item.statusLabel,
        summary: item.summary,
        actionText: item.actionText,
        reason: item.reason,
        primaryKey: item.primaryKey,
      })),
  );

  return {
    sections,
    counts,
    blockers,
    envSources: env.__sources || {},
    localEnvFiles: env.__files || [],
    updatedAt: new Date().toISOString(),
  };
}

export function loadAdminSettingsEnv({ cwd = process.cwd(), baseEnv = process.env } = {}) {
  const env = {};
  const sources = {};
  const files = [];

  for (const file of LOCAL_ENV_FILES) {
    const filePath = path.join(cwd, file);
    if (!fs.existsSync(filePath)) continue;
    files.push(file);
    const parsed = parseEnvFile(fs.readFileSync(filePath, 'utf8'));
    for (const [key, value] of Object.entries(parsed)) {
      env[key] = value;
      sources[key] = file;
    }
  }

  for (const [key, value] of Object.entries(baseEnv || {})) {
    if (value === undefined) continue;
    env[key] = value;
    sources[key] = sources[key] ? `${sources[key]} + runtime` : 'runtime';
  }

  Object.defineProperty(env, '__sources', { value: sources, enumerable: false });
  Object.defineProperty(env, '__files', { value: files, enumerable: false });
  return env;
}

function parseEnvFile(contents) {
  const parsed = {};
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (!key) continue;
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return parsed;
}

function buildSpecialAlertsSection(env) {
  const specialWebhook = env.SPECIAL_ALERTS_DISCORD_WEBHOOK_URL
    || env.OPS_ALERTS_DISCORD_WEBHOOK_URL
    || env.OPEN_DESIGN_ALERTS_DISCORD_WEBHOOK_URL
    || '';
  return makeSection('特殊提醒', '异常失败、卡住、需要人工判断的情况。', [
    makeItem('Discord 特殊提醒入口', specialWebhook, {
      envKeys: ['SPECIAL_ALERTS_DISCORD_WEBHOOK_URL', 'OPS_ALERTS_DISCORD_WEBHOOK_URL', 'OPEN_DESIGN_ALERTS_DISCORD_WEBHOOK_URL'],
      required: false,
      display: summarizeDiscordWebhook(specialWebhook),
      secret: true,
      inputType: 'url',
      status: specialWebhook ? 'configured' : 'optional',
      summary: '有紧急异常时通知运营人员。',
      reason: 'Open Design 卡住、超时、需要回答问题、质量门禁失败时，会通过这个 Discord webhook 通知人工处理。',
    }),
    makeItem('Open Design 监控模式', env.OPEN_DESIGN_WATCHER_MODE || 'runner-integrated', {
      envKeys: ['OPEN_DESIGN_WATCHER_MODE'],
      required: false,
      display: env.OPEN_DESIGN_WATCHER_MODE || 'runner-integrated (default)',
      defaultValue: 'runner-integrated',
      status: 'configured',
      summary: '控制设计任务由谁负责持续检查。',
      reason: '默认使用现有 runner/queue 路径监控：SSE、状态轮询、文件扫描和质量检查点。',
    }),
    makeItem('检查间隔', env.OPEN_DESIGN_WATCHER_CHECKPOINT_MS, {
      envKeys: ['OPEN_DESIGN_WATCHER_CHECKPOINT_MS'],
      required: false,
      display: env.OPEN_DESIGN_WATCHER_CHECKPOINT_MS || '600000ms (default)',
      defaultValue: '600000',
      inputType: 'number',
      status: env.OPEN_DESIGN_WATCHER_CHECKPOINT_MS ? 'configured' : 'optional',
      summary: '多久检查一次设计任务是否需要处理。',
      reason: '用于判断继续运行、自动回答、升级人工处理或标记卡住；不是强制终止时间。',
    }),
  ]);
}

function buildOpsSection(env) {
  return makeSection('核心运营', '后台访问、项目频道、任务交接这些基础设置。', [
    makeItem('后台访问密码', env.ADMIN_ACCESS_TOKEN, {
      envKeys: ['ADMIN_ACCESS_TOKEN'],
      required: true,
      display: maskSecret(env.ADMIN_ACCESS_TOKEN),
      secret: true,
      summary: '进入后台页面时用来校验身份。',
      reason: '保护所有 /admin 页面，避免外部人员直接访问运营后台。',
    }),
    makeItem('线索频道', env.WEBSITE_LEADS_DISCORD_CHANNEL_ID, {
      envKeys: ['WEBSITE_LEADS_DISCORD_CHANNEL_ID'],
      required: true,
      display: env.WEBSITE_LEADS_DISCORD_CHANNEL_ID || 'missing',
      summary: '售前线索会进入这个 Discord 频道。',
      reason: '用于创建和管理售前线索的 Discord forum workspace。',
    }),
    makeItem('项目频道', env.WEBSITE_PROJECTS_DISCORD_CHANNEL_ID, {
      envKeys: ['WEBSITE_PROJECTS_DISCORD_CHANNEL_ID'],
      required: true,
      display: env.WEBSITE_PROJECTS_DISCORD_CHANNEL_ID || 'missing',
      summary: '付费项目和交付流程会进入这个频道。',
      reason: '用于承载已付款、审核中、已上线项目的 Discord forum workspace。',
    }),
    makeItem('交接机器人密钥', env.WEBSITE_TASKS_DISCORD_BOT_TOKEN || env.DISCORD_BOT_TOKEN, {
      envKeys: ['WEBSITE_TASKS_DISCORD_BOT_TOKEN', 'DISCORD_BOT_TOKEN'],
      required: true,
      display: maskSecret(env.WEBSITE_TASKS_DISCORD_BOT_TOKEN || env.DISCORD_BOT_TOKEN),
      secret: true,
      summary: '机器人用它创建和更新 Discord 项目空间。',
      reason: '用于创建、更新 Discord forum workspace，以及同步项目任务状态。',
    }),
    makeItem('网站 Agent 提醒对象', env.WEBSITE_AGENT_MENTION, {
      envKeys: ['WEBSITE_AGENT_MENTION'],
      required: true,
      display: env.WEBSITE_AGENT_MENTION || 'missing',
      summary: '交接任务时要 @ 的 Agent。',
      reason: '当系统把项目任务交给 website agent 时，会使用这个 mention。',
    }),
  ]);
}

function buildOpenDesignSection(env) {
  return makeSection('Open Design', '设计生成工具的位置、数据目录和运行方式。', [
    makeItem('Open Design 程序目录', env.OPEN_DESIGN_ROOT, {
      envKeys: ['OPEN_DESIGN_ROOT'],
      required: false,
      display: env.OPEN_DESIGN_ROOT || '/Users/matthew/Developer/open-design (default)',
      defaultValue: '/Users/matthew/Developer/open-design',
      status: env.OPEN_DESIGN_ROOT ? 'configured' : 'optional',
      summary: '本机 Open Design 项目所在的位置。',
      reason: '覆盖默认的本地 Open Design checkout 路径。',
    }),
    makeItem('Open Design 数据目录', env.OPEN_DESIGN_DATA_DIR, {
      envKeys: ['OPEN_DESIGN_DATA_DIR'],
      required: false,
      display: env.OPEN_DESIGN_DATA_DIR || '/Users/matthew/Developer/open-design/.od (default)',
      defaultValue: '/Users/matthew/Developer/open-design/.od',
      status: env.OPEN_DESIGN_DATA_DIR ? 'configured' : 'optional',
      summary: '设计项目和运行状态保存在哪里。',
      reason: '控制共享项目、app state 和运行数据的存放目录。',
    }),
    makeItem('Open Design 端口', env.OPEN_DESIGN_PORT, {
      envKeys: ['OPEN_DESIGN_PORT'],
      required: false,
      display: env.OPEN_DESIGN_PORT || '7466 (default)',
      defaultValue: '7466',
      inputType: 'number',
      status: env.OPEN_DESIGN_PORT ? 'configured' : 'optional',
      summary: 'Open Design 本地服务使用的端口。',
      reason: 'headless 设计运行时使用的 daemon/API 端口。',
    }),
    makeItem('Open Design 运行模式', env.PROFITSLOCAL_OPEN_DESIGN_MODE, {
      envKeys: ['PROFITSLOCAL_OPEN_DESIGN_MODE'],
      required: false,
      display: env.PROFITSLOCAL_OPEN_DESIGN_MODE || 'isolated (default)',
      defaultValue: 'isolated',
      status: env.PROFITSLOCAL_OPEN_DESIGN_MODE ? 'configured' : 'optional',
      summary: '控制设计任务如何隔离项目数据。',
      reason: '控制运行时如何解析每个项目的数据目录。',
    }),
  ]);
}

function buildTransactionalEmailSection(env) {
  return makeSection('事务邮件', '客户审核、修改、上线、域名流程里的系统邮件。', [
    makeItem('Resend 密钥', env.RESEND_API_KEY, {
      envKeys: ['RESEND_API_KEY'],
      required: true,
      display: maskSecret(env.RESEND_API_KEY),
      secret: true,
      summary: '用来发送客户流程邮件。',
      reason: '发送审核、修改、批准和域名相关邮件。',
    }),
    makeItem('发件人邮箱', env.FROM_EMAIL, {
      envKeys: ['FROM_EMAIL'],
      required: true,
      display: env.FROM_EMAIL || 'missing',
      inputType: 'email',
      summary: '客户看到的发件人。',
      reason: '客户流程邮件的主要 sender identity。',
    }),
    makeItem('回复邮箱', env.REPLY_TO_EMAIL, {
      envKeys: ['REPLY_TO_EMAIL'],
      required: false,
      display: env.REPLY_TO_EMAIL || 'not set',
      inputType: 'email',
      status: env.REPLY_TO_EMAIL ? 'configured' : 'optional',
      summary: '客户直接回复时进入的邮箱。',
      reason: '客户直接回复系统邮件时，人工回复应进入的位置。',
    }),
  ]);
}

function buildColdOutreachSection(env) {
  return makeSection('冷邮件拓客', '线索外联、收件箱、回复同步相关设置。', [
    makeItem('当前外联方式', 'agentic-email-manual', {
      envKeys: ['OUTREACH_PROVIDER'],
      required: false,
      display: 'Agentic Inbox (manual send / operator-reviewed)',
      defaultValue: 'agentic-email-manual',
      status: 'configured',
      summary: '现在实际采用的冷邮件发送方式。',
      reason: '在 Instantly 或 Smartlead 正式接入前，推荐使用 Agentic Inbox 人工审核发送。',
    }),
    makeItem('Agentic 收件箱地址', env.AGENTIC_INBOX_URL || 'https://mail.profitslocal.com', {
      envKeys: ['AGENTIC_INBOX_URL'],
      required: false,
      display: env.AGENTIC_INBOX_URL || 'https://mail.profitslocal.com',
      defaultValue: 'https://mail.profitslocal.com',
      inputType: 'url',
      status: 'configured',
      summary: '运营查看草稿、回复和手动发送的入口。',
      reason: '用于会话邮件、草稿和人工冷邮件发送的 operator inbox。',
    }),
    makeItem('收件箱回调密钥', env.AGENTIC_EMAIL_WEBHOOK_SECRET || env.OUTREACH_PROVIDER_WEBHOOK_SECRET || '', {
      envKeys: ['AGENTIC_EMAIL_WEBHOOK_SECRET', 'OUTREACH_PROVIDER_WEBHOOK_SECRET'],
      required: false,
      display: maskSecret(env.AGENTIC_EMAIL_WEBHOOK_SECRET || env.OUTREACH_PROVIDER_WEBHOOK_SECRET || ''),
      secret: true,
      status: env.AGENTIC_EMAIL_WEBHOOK_SECRET || env.OUTREACH_PROVIDER_WEBHOOK_SECRET ? 'configured' : 'partial',
      summary: '验证外部回调是不是可信来源。',
      reason: '校验 Agentic Inbox 或外联同步桥传入的回复、退信、跟进事件。',
    }),
    makeItem('Agentic 发送密钥', env.AGENTIC_EMAIL_API_KEY || env.AGENTIC_EMAIL_TOKEN || '', {
      envKeys: ['AGENTIC_EMAIL_API_KEY', 'AGENTIC_EMAIL_TOKEN'],
      required: false,
      display: maskSecret(env.AGENTIC_EMAIL_API_KEY || env.AGENTIC_EMAIL_TOKEN || ''),
      secret: true,
      status: env.AGENTIC_EMAIL_API_KEY || env.AGENTIC_EMAIL_TOKEN ? 'configured' : 'partial',
      summary: '用于通过 API 发送外联邮件。',
      reason: 'Cloudflare Agentic Inbox 或未来 API-backed outreach sender 的凭证。',
    }),
    makeItem('Instantly 密钥', env.INSTANTLY_API_KEY || env.INSTANTLY_TOKEN || '', {
      envKeys: ['INSTANTLY_API_KEY', 'INSTANTLY_TOKEN'],
      required: false,
      display: maskSecret(env.INSTANTLY_API_KEY || env.INSTANTLY_TOKEN || ''),
      secret: true,
      status: env.INSTANTLY_API_KEY || env.INSTANTLY_TOKEN ? 'partial' : 'optional',
      summary: '以后接入 Instantly 时使用。',
      reason: '计划中的专业冷邮件发送和 webhook provider。',
    }),
    makeItem('Smartlead 密钥', env.SMARTLEAD_API_KEY || '', {
      envKeys: ['SMARTLEAD_API_KEY'],
      required: false,
      display: maskSecret(env.SMARTLEAD_API_KEY || ''),
      secret: true,
      status: env.SMARTLEAD_API_KEY ? 'partial' : 'optional',
      summary: '以后接入 Smartlead 时使用。',
      reason: '计划中的专业冷邮件发送和 inbox workflow provider。',
    }),
  ]);
}

function buildPaymentsSection(env) {
  return makeSection('收款结账', 'Stripe 收款、付款回调和购买后的自动流程。', [
    makeItem('Stripe 后端密钥', env.STRIPE_SECRET_KEY, {
      envKeys: ['STRIPE_SECRET_KEY'],
      required: true,
      display: maskSecret(env.STRIPE_SECRET_KEY),
      secret: true,
      summary: '创建付款链接和处理真实收款。',
      reason: '创建 checkout session，并支持线上付款流程。',
    }),
    makeItem('Stripe 前端密钥', env.STRIPE_PUBLISHABLE_KEY, {
      envKeys: ['STRIPE_PUBLISHABLE_KEY'],
      required: true,
      display: maskSecret(env.STRIPE_PUBLISHABLE_KEY),
      summary: '结账页面需要它连接 Stripe。',
      reason: 'checkout 前端页面需要使用这个 publishable key。',
    }),
    makeItem('Stripe 回调密钥', env.STRIPE_WEBHOOK_SECRET, {
      envKeys: ['STRIPE_WEBHOOK_SECRET'],
      required: true,
      display: maskSecret(env.STRIPE_WEBHOOK_SECRET),
      secret: true,
      summary: '确认付款通知真的来自 Stripe。',
      reason: '验证 Stripe webhook event 的签名。',
    }),
    makeItem('Tally 密钥', env.TALLY_API_KEY, {
      envKeys: ['TALLY_API_KEY'],
      required: false,
      display: maskSecret(env.TALLY_API_KEY),
      secret: true,
      status: env.TALLY_API_KEY ? 'configured' : 'optional',
      summary: '用于自动创建或测试 Tally 表单。',
      reason: '可选；测试 Tally-based form creation 时使用。',
    }),
  ]);
}

function buildMediaSection(env) {
  return makeSection('图片和上传', '客户附件、修改上传、图片托管相关设置。', [
    makeItem('Cloudinary 云名称', env.CLOUDINARY_CLOUD_NAME, {
      envKeys: ['CLOUDINARY_CLOUD_NAME'],
      required: true,
      display: env.CLOUDINARY_CLOUD_NAME || 'missing',
      summary: '上传图片和附件会保存到这个 Cloudinary 空间。',
      reason: '存储客户 intake 和 revision 上传的资源。',
    }),
    makeItem('Cloudinary API key', env.CLOUDINARY_API_KEY, {
      envKeys: ['CLOUDINARY_API_KEY'],
      required: true,
      display: maskSecret(env.CLOUDINARY_API_KEY),
      secret: true,
      summary: '上传资源时需要的公开编号。',
      reason: 'Cloudinary upload API 调用所需。',
    }),
    makeItem('Cloudinary API secret', env.CLOUDINARY_API_SECRET, {
      envKeys: ['CLOUDINARY_API_SECRET'],
      required: true,
      display: maskSecret(env.CLOUDINARY_API_SECRET),
      secret: true,
      summary: '用于签名上传请求，请妥善保密。',
      reason: '为 Cloudinary upload request 签名。',
    }),
    makeItem('Cloudinary 上传预设', env.CLOUDINARY_UPLOAD_PRESET, {
      envKeys: ['CLOUDINARY_UPLOAD_PRESET'],
      required: false,
      display: env.CLOUDINARY_UPLOAD_PRESET || 'not set',
      status: env.CLOUDINARY_UPLOAD_PRESET ? 'configured' : 'optional',
      summary: '可选；让上传流程少传一些参数。',
      reason: '简化上传流程时使用的可选 preset。',
    }),
  ]);
}

function buildResearchSection(env) {
  return makeSection('线索研究', 'Google 地图、网站抓取、菜单提取相关设置。', [
    makeItem('Google Places 密钥', env.GOOGLE_PLACES_API_KEY, {
      envKeys: ['GOOGLE_PLACES_API_KEY'],
      required: true,
      display: maskSecret(env.GOOGLE_PLACES_API_KEY),
      secret: true,
      summary: '从 Google 地图获取商家信息、照片和地点数据。',
      reason: '用于真实商家事实、照片和基于地图的 lead discovery。',
    }),
    makeItem('TinyFish 密钥', env.TINYFISH_API_KEY, {
      envKeys: ['TINYFISH_API_KEY'],
      required: false,
      display: maskSecret(env.TINYFISH_API_KEY),
      secret: true,
      status: env.TINYFISH_API_KEY ? 'configured' : 'optional',
      summary: '可用时优先用它做低成本搜索和抓取。',
      reason: '可用时作为 preferred low-cost search/fetch layer。',
    }),
    makeItem('Firecrawl 密钥', env.FIRECRAWL_API_KEY, {
      envKeys: ['FIRECRAWL_API_KEY'],
      required: false,
      display: maskSecret(env.FIRECRAWL_API_KEY),
      secret: true,
      status: env.FIRECRAWL_API_KEY ? 'configured' : 'optional',
      summary: '备用的网站抓取和解析服务。',
      reason: 'fallback 或 alternative scraping/parsing provider。',
    }),
  ]);
}

function buildDomainSection(env) {
  return makeSection('域名和部署', '客户网站仓库、Cloudflare Pages、域名解析相关设置。', [
    makeItem('GitHub 访问密钥', env.GH_PAT, {
      envKeys: ['GH_PAT'],
      required: true,
      display: maskSecret(env.GH_PAT),
      secret: true,
      summary: '创建客户仓库、写入密钥和触发工作流。',
      reason: '用于 bootstrap repos、secrets 和 workflows。',
    }),
    makeItem('Cloudflare 密钥', env.CF_API_TOKEN, {
      envKeys: ['CF_API_TOKEN'],
      required: true,
      display: maskSecret(env.CF_API_TOKEN),
      secret: true,
      summary: '创建 Pages 项目和域名 DNS 记录。',
      reason: '创建 Cloudflare Pages projects 和 domain DNS records。',
    }),
    makeItem('Cloudflare 账号 ID', env.CF_ACCOUNT_ID, {
      envKeys: ['CF_ACCOUNT_ID'],
      required: true,
      display: env.CF_ACCOUNT_ID || 'missing',
      summary: '告诉系统使用哪个 Cloudflare 账号。',
      reason: 'Cloudflare Pages 操作需要定位到正确 account。',
    }),
    makeItem('Cloudflare Zone ID', env.CF_ZONE_ID, {
      envKeys: ['CF_ZONE_ID'],
      required: false,
      display: env.CF_ZONE_ID || 'not set',
      status: env.CF_ZONE_ID ? 'configured' : 'optional',
      summary: '可选；让域名绑定和检查更快。',
      reason: 'domain attach/inspect flows 的可选 helper。',
    }),
    makeItem('默认根域名', env.PROFITSLOCAL_ROOT_DOMAIN, {
      envKeys: ['PROFITSLOCAL_ROOT_DOMAIN'],
      required: false,
      display: env.PROFITSLOCAL_ROOT_DOMAIN || 'profitslocal.com (default)',
      defaultValue: 'profitslocal.com',
      status: env.PROFITSLOCAL_ROOT_DOMAIN ? 'configured' : 'optional',
      summary: '客户预览和上线子域名默认挂在哪个主域下。',
      reason: 'preview/live customer subdomains 使用的默认 root domain。',
    }),
  ]);
}

function buildLocalAiSection(env) {
  return makeSection('本地 AI 审核', '客户审核前的本地低成本检查。', [
    makeItem('Ollama 模型', env.OLLAMA_MODEL, {
      envKeys: ['OLLAMA_MODEL'],
      required: false,
      display: env.OLLAMA_MODEL || 'qwen3.5:9b (default)',
      defaultValue: 'qwen3.5:9b',
      status: env.OLLAMA_MODEL ? 'configured' : 'optional',
      summary: '本地审核时使用哪个模型。',
      reason: '用于 local audit 和 low-cost validation。',
    }),
    makeItem('Ollama 地址', env.OLLAMA_URL, {
      envKeys: ['OLLAMA_URL'],
      required: false,
      display: env.OLLAMA_URL || 'http://127.0.0.1:11434 (default)',
      defaultValue: 'http://127.0.0.1:11434',
      inputType: 'url',
      status: env.OLLAMA_URL ? 'configured' : 'optional',
      summary: '本地模型服务的访问地址。',
      reason: 'local model inference endpoint。',
    }),
  ]);
}

function makeSection(title, description, items) {
  const slug = slugifySection(title);
  const summary = items.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, { configured: 0, partial: 0, missing: 0, optional: 0 });
  return { title, slug, description, items, summary };
}

function slugifySection(title) {
  const asciiSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  if (asciiSlug) return asciiSlug;
  return `section-${Array.from(title).map((char) => char.codePointAt(0).toString(36)).join('-')}`;
}

function makeItem(label, rawValue, options = {}) {
  const hasValue = Boolean(String(rawValue || '').trim());
  const required = options.required !== false;
  const status = options.status || (hasValue ? 'configured' : (required ? 'missing' : 'optional'));
  const envKeys = options.envKeys || [];
  const defaultValue = options.defaultValue || '';
  const editableValue = options.secret ? '' : String(rawValue || '');
  const configuredKey = envKeys.find((key) => Boolean(String(activeSettingsEnv[key] || '').trim())) || '';
  const source = configuredKey ? activeEnvSources[configuredKey] || '' : '';
  return {
    label,
    envKeys,
    primaryKey: envKeys[0] || '',
    configuredKey,
    required,
    status,
    statusLabel: STATUS_LABELS[status] || status,
    display: options.display ?? (hasValue ? String(rawValue) : 'missing'),
    editableValue,
    defaultValue,
    secret: Boolean(options.secret),
    inputType: options.inputType || (options.secret ? 'password' : 'text'),
    placeholder: options.secret
      ? '粘贴新的密钥'
      : (defaultValue ? `默认值：${defaultValue}` : '填写 value'),
    summary: options.summary || options.reason || '',
    actionText: options.actionText || getActionText(status, required, envKeys[0] || '', source),
    source,
    reason: options.reason || '',
  };
}

function getActionText(status, required, key, source) {
  if (status === 'configured') return source ? `已在 ${source} 找到。` : '已经有值，不需要处理。';
  if (status === 'partial') return `不是必填，但建议确认是否要补 ${key || '这个值'}。`;
  if (status === 'optional') return '可选项；没有特殊需求可以先不填。';
  if (required && key) return `把 ${key} 填到 .env.local，线上部署时也要填到部署环境变量。`;
  return '按需要填写。';
}

function maskSecret(value) {
  const str = String(value || '').trim();
  if (!str) return 'missing';
  if (str.length <= 8) return `${str.slice(0, 2)}***`;
  return `${str.slice(0, 4)}…${str.slice(-4)}`;
}

function summarizeDiscordWebhook(value) {
  const str = String(value || '').trim();
  if (!str) return 'not set';
  try {
    const url = new URL(str);
    const parts = url.pathname.split('/').filter(Boolean);
    const id = parts.at(-2) || '';
    const token = parts.at(-1) || '';
    if (!/discord(?:app)?\.com$/i.test(url.hostname) || !id || !token) {
      return `${url.hostname} / invalid Discord webhook shape`;
    }
    return `${url.hostname} / ${id} / ${maskSecret(token)}`;
  } catch {
    return 'configured but invalid URL';
  }
}
