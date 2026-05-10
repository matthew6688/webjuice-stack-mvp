export const LEAD_STAGE_META = {
  paid_handoff: {
    label: '成交交接',
    tone: 'ready',
    criteria: ['客户已表现出购买/成交意向。', '需要把 lead facts、mockup、offer、联系人和下一步交给 paid intake。'],
  },
  replied: {
    label: '已回复',
    tone: 'ready',
    criteria: ['客户已有回复或人工标记有兴趣。', '下一步判断是否进入成交交接。'],
  },
  bounced: {
    label: '退信',
    tone: 'alert',
    criteria: ['发送失败、退信或联系路径无效。', '需要补新联系路径，否则跳过。'],
  },
  follow_up_due: {
    label: '待跟进',
    tone: 'warn',
    criteria: ['已发送且到达 follow-up 时间。', '没有回复、没有退信、没有明确跳过。'],
  },
  outreach_sent: {
    label: '已发送',
    tone: 'working',
    criteria: ['已经通过某个 provider 或人工渠道发出。', '需要记录发送时间、渠道和下一次 follow-up 时间。'],
  },
  draft_ready: {
    label: '草稿就绪',
    tone: 'working',
    criteria: ['触达草稿或 outreach brief 已生成。', '发送前仍需要人工/LLM 检查语气、事实和链接。'],
  },
  mockup_ready: {
    label: '样稿就绪',
    tone: 'ready',
    criteria: ['样稿或可展示 preview 已存在。', '有足够截图/链接/证明材料，可以准备触达包。'],
  },
  mockup_building: {
    label: '样稿制作中',
    tone: 'working',
    criteria: ['operator 已批准进入样稿。', '正在生成或绑定 Open Design / template / preview 素材。'],
  },
  ready_for_mockup: {
    label: '可做样稿',
    tone: 'info',
    criteria: ['联系路径存在。', '无官网或现站 audit 显示明确机会。', 'ready-to-build / Open Design handoff 足够推进。'],
  },
  needs_human: {
    label: '需人工判断',
    tone: 'warn',
    criteria: ['AI 结论不够稳，不能自动推进或跳过。', '通常是 audit 60-80 分、证据冲突、联系路径不确定，或销售突破口模糊。'],
  },
  needs_evidence: {
    label: '需人工判断',
    tone: 'warn',
    criteria: ['缺少官网、联系方式、现站审计或设计输入。', '补齐前不能批准样稿。'],
  },
  discovery_ready: {
    label: '需人工判断',
    tone: 'warn',
    criteria: ['抓取来源已有初步信号，但还没有进入稳定正式线索判断。', '需要人工确认是否继续研究、转正式或跳过。'],
  },
  researching: {
    label: '研究中',
    tone: 'working',
    criteria: ['系统正在或应该继续补资料。', '还没形成稳定 AI 结论，缺官网、联系路径、audit 或核心事实。'],
  },
  skipped: {
    label: '已跳过',
    tone: 'skip',
    criteria: ['没有明确销售突破口，或不可触达。', '必须保留跳过原因和已做工作，后续可人工重新打开。'],
  },
  new_lead: {
    label: '新线索',
    tone: 'info',
    criteria: ['刚进入系统或 scraped store，还没有完成自动研究。', '至少有 business name 或 source URL，可以继续补证据。'],
  },
};

export const DISCOVERY_STAGE_META = {
  queued_for_audit: {
    label: '待初筛',
    criteria: ['这是地图抓取后的第一道低成本过滤。', '来自地图抓取库，有官网或疑似官网。', '还没有现站审计证据，需要先用截图和网页文本判断是否有明显改版/获客机会。'],
  },
  ready_for_outreach_brief: {
    label: '待转正式',
    criteria: ['初筛审计已完成。', '审计没有判定为只观察或跳过。', '存在联系方式或可补联系方式，并且销售角度足够明确，可以进入正式线索流程。'],
  },
  queued_for_enrichment: {
    label: '待补资料',
    criteria: ['初筛审计已完成并给出可做样稿或强人工判断。', '目标还没有转入正式客户流程。', '下一步可以先 dry-run 补资料计划，人工确认后再花钱。'],
  },
  manual_review: {
    label: '人工判断',
    criteria: ['AI 证据不足或判断冲突。', '通常是审计 60-80 分、联系路径不稳定、行业/地区价值不清楚。', '需要人工明确转正式线索、继续研究或跳过。'],
  },
  skipped: {
    label: '已跳过',
    criteria: ['现阶段不推进。', '保留跳过原因、已花成本和证据快照。'],
  },
};

export const DECISION_LABELS = {
  audit_candidate: '初筛后有机会，建议转正式线索',
  manual_review: '证据不够稳，需要人工判断',
  build_mockup: '建议进入样稿队列',
  human_review: '需要人工复核',
  skip_or_monitor: '建议跳过或观察',
  promote_discovery: '建议转正式线索',
  research_more: '需要补资料',
  ready_for_outreach_brief: '待转正式线索',
  queued_for_enrichment: '待补资料',
};

export const QUEUE_TYPE_LABELS = {
  discovery: '抓取线索',
  lead: '正式线索',
  project: '项目',
};

export const QUEUE_ACTION_DEFINITIONS = {
  run_cheap_audit: {
    label: '运行初筛审计',
    script: 'leads:audit-discovery-sites',
    args: ({ entityKey }) => ['--entity-key', entityKey, '--limit', '1'],
    requiresEntityKey: true,
    supportsDryRun: true,
  },
  promote_discovery: {
    label: '转入正式线索',
    script: 'leads:promote-discovery-store',
    args: ({ entityKey }) => ['--entity-key', entityKey, '--limit', '1'],
    requiresEntityKey: true,
    supportsDryRun: true,
  },
  plan_enrichment: {
    label: '规划补资料',
    script: 'leads:plan-discovery-enrichment',
    args: () => ['--limit', '3'],
    requiresEntityKey: false,
    supportsDryRun: false,
    noopDryRun: true,
  },
  approve_enrichment_spend: {
    label: '批准补资料成本',
    script: 'leads:update-enrichment-gate',
    args: ({ entityKey }) => ['--entity-key', entityKey, '--status', 'approved'],
    requiresEntityKey: true,
    supportsDryRun: true,
    noopDryRun: true,
  },
  build_outreach_brief: {
    label: '生成触达简报',
    script: 'leads:build-discovery-outreach-briefs',
    args: () => ['--limit', '5'],
    requiresEntityKey: false,
    supportsDryRun: true,
  },
  approve_mockup: {
    label: '批准样稿并创建请求',
    script: 'leads:approve-mockup',
    args: ({ clientSlug }) => ['--client-slug', clientSlug],
    requiresClientSlug: true,
    supportsDryRun: true,
    noopDryRun: true,
  },
  build_mockup_artifacts: {
    label: '生成样稿证据包',
    script: 'leads:build-mockup-artifacts',
    args: ({ clientSlug }) => ['--client-slug', clientSlug],
    requiresClientSlug: true,
    supportsDryRun: true,
    noopDryRun: true,
  },
  build_outreach_email_draft: {
    label: '生成触达草稿',
    script: 'leads:build-outreach-email-draft',
    args: ({ clientSlug }) => ['--client-slug', clientSlug],
    requiresClientSlug: true,
    supportsDryRun: true,
    noopDryRun: true,
  },
};

export const EXECUTABLE_QUEUE_ACTIONS = new Set(Object.keys(QUEUE_ACTION_DEFINITIONS));

export const LEAD_QUEUE_GROUP_META = {
  discovery_audit: {
    label: '待初筛审计',
    automationMode: 'auto',
    automationLabel: '自动推进',
    automationSummary: '系统应自动跑低成本初筛；这里主要看是否失败、积压或需要重试。',
    summary: '地图抓取已入库，但还没跑网站截图、文本和低成本初筛审计。',
    criteria: DISCOVERY_STAGE_META.queued_for_audit.criteria,
    visibleInfo: ['看官网是否存在、电话是否可用、地图分类和搜索词是否匹配。', '优先处理本地服务商、评分/官网弱、但联系方式清楚的目标。', '如果行业明显跑偏，直接留在人工判断或跳过，不要花补资料成本。'],
    opsInfo: ['主要工具：地图抓取输出、浏览器截图、网页源码/正文保存、现站审计。', '成本策略：不抓评论，不调用付费 Google Places；先用本地/低成本证据筛掉低价值目标。'],
  },
  discovery_promote: {
    label: '待转正式线索',
    automationMode: 'auto',
    automationLabel: '自动推进',
    automationSummary: '通过 cheap audit 的目标应自动转入正式线索；这里主要看是否有异常或重复。',
    summary: '初筛审计后仍有明确销售切入点，下一步进入正式线索流程。',
    criteria: DISCOVERY_STAGE_META.ready_for_outreach_brief.criteria,
    visibleInfo: ['看审计分数、主要问题、可触达路径和一句话销售切入点。', '转正式后会进入 leads 页面，开始按正式客户候选对象保存证据和状态。', '如果只是“网站还行但不够好”，不要转正式，先跳过或观察。'],
    opsInfo: ['主要工具：抓取库转正式脚本、线索档案、线索工作日志。', '成本策略：只有通过初筛的目标才进入正式流程，避免把抓取池全部变成高成本线索。'],
  },
  selected_enrichment: {
    label: '待补资料',
    automationMode: 'cost_gate',
    automationLabel: '成本审批',
    automationSummary: '默认只生成 dry-run 计划；涉及 Tinyfish、Google Places 或联系方式提取时需要人工批准花钱。',
    summary: '初筛审计已证明有销售突破口，下一步只对这些目标补 Tinyfish / Google Places / 联系证据。',
    criteria: DISCOVERY_STAGE_META.queued_for_enrichment.criteria,
    visibleInfo: ['看缺什么：邮箱、联系页、社媒、准确地址、Google 商家资料或业务分类。', '只给已经有销售突破口的目标补资料，不对整个抓取池补资料。', '先看 dry-run 计划，再决定是否调用 Tinyfish 或 Google Places。'],
    opsInfo: ['主要工具：补资料规划脚本、Tinyfish、Google Places、官网/联系页读取。', '成本策略：默认 dry-run；需要花钱的补资料动作必须先被初筛证明值得继续。'],
  },
  manual_review: {
    label: '待人工判断',
    automationMode: 'human_gate',
    automationLabel: '人工关口',
    automationSummary: '这是真正的 block。AI 不能稳定判断时，必须人工决定转正式、继续研究或跳过。',
    summary: 'AI 暂时不能可靠决定转正式线索或跳过，需要人工看官网、地图和审计证据。',
    criteria: DISCOVERY_STAGE_META.manual_review.criteria,
    visibleInfo: ['看冲突点：行业是否跑偏、官网是否真实、联系方式是否能用、问题是否足够痛。', '这个阶段的目标不是研究很久，而是快速做一个方向性决定。', '能明确证明有机会就转正式；证据太弱就跳过；只差关键字段才继续研究。'],
    opsInfo: ['主要工具：人工查看官网/地图/审计报告，必要时补一次搜索。', '成本策略：人工判断是为了避免自动化误判后继续花样稿和补资料成本。'],
  },
  ready_mockup: {
    label: '可做样稿',
    automationMode: 'human_gate',
    automationLabel: '人工关口',
    automationSummary: '样稿会消耗更多生成和 QA 成本；这里需要人工确认这个客户值得做样稿。',
    summary: '已经转入正式流程的线索，证据足够，等人工确认是否进入样稿制作。',
    criteria: ['已从抓取库或手工线索转入正式流程。', ...LEAD_STAGE_META.ready_for_mockup.criteria, '人工确认后才进入样稿队列。'],
    visibleInfo: ['看联系人、官网问题、当前网站截图、审计结论和推荐的设计方向。', '必须能说清楚“为什么这个客户看到样稿会有兴趣”。', '批准按钮只是记录进入样稿队列，不等于样稿已经生成。'],
    opsInfo: ['主要工具：现站审计、设计输入、样稿生成流程、触达素材准备。', '成本策略：样稿是相对高成本动作，只给证据足够、触达路径清楚的目标。'],
  },
  verification: {
    label: '待核实证据',
    automationMode: 'auto',
    automationLabel: '自动补证据',
    automationSummary: '系统应自动补齐最低必要证据；这里主要看缺项、失败和是否仍需人工。',
    summary: '缺网站、联系方式或现站审计证据；先补齐，避免后面浪费样稿成本。',
    criteria: LEAD_STAGE_META.needs_evidence.criteria,
    visibleInfo: ['直接看缺口：官网、邮箱/电话、联系页、现站审计、设计输入。', '这个阶段的目标是补齐最低必要证据，不是做完整研究报告。', '证据补齐后才回到可做样稿；补不齐就跳过或继续人工判断。'],
    opsInfo: ['主要工具：补资料计划、官网/联系页读取、现站审计、人工核实。', '成本策略：先补最低必要字段，避免在不可触达或证据不足的目标上做样稿。'],
  },
  outreach_pack: {
    label: '待触达包',
    automationMode: 'auto',
    automationLabel: '自动生成',
    automationSummary: '样稿和证据齐后应自动生成触达包；发送前仍需要事实和语气检查。',
    summary: '样稿或草稿进入后续阶段，但还没有完整触达包记录。',
    criteria: ['样稿、预览或草稿已进入后续阶段。', '还没有触达包或触达简报。', '发送前需要补证明、截图、链接和触达角度。'],
    visibleInfo: ['看是否已有样稿链接、证明截图、审计摘要、触达角度和发送渠道建议。', '触达包要让发送前的人一眼知道：发给谁、为什么发、拿什么证明。', '没有触达包不要直接发送，避免话术空泛或证据链断掉。'],
    opsInfo: ['主要工具：触达简报生成、样稿截图、审计摘要、邮件/短信草稿。', '成本策略：默认不抓评论；触达前只补能提高回复率的证明材料。'],
  },
  outreach_draft: {
    label: '待触达草稿',
    automationMode: 'auto',
    automationLabel: '自动生成',
    automationSummary: '样稿、证明素材和触达包齐后应自动生成草稿；发送动作仍要走人工或 provider 审核。',
    summary: '样稿和证明素材已经齐，但还没有 cold outreach 草稿。',
    criteria: ['已进入样稿就绪阶段。', '有 previewUrl、证明素材和 outreach pack。', '还没有 outreach/email/*.json 草稿。'],
    visibleInfo: ['看收件人是否明确、主卖点、preview 链接、证明点和推荐渠道。', '草稿只准备内容，不自动发送。', '没有明确邮箱时也可以生成草稿，但发送前必须补联系人。'],
    opsInfo: ['主要工具：触达草稿生成、Agentic Inbox/manual provider handoff。', '成本策略：生成草稿不调用付费发送 provider；发送前另走人工确认。'],
  },
};

export function stageLabel(value) {
  return LEAD_STAGE_META[value]?.label
    || DISCOVERY_STAGE_META[value]?.label
    || DECISION_LABELS[value]
    || String(value || '').replace(/Mockup/g, '样稿').replace(/mockup/g, '样稿').replace(/_/g, ' ');
}

export function stageTone(value) {
  return LEAD_STAGE_META[value]?.tone || 'info';
}

export function decisionLabel(value) {
  return DECISION_LABELS[value] || stageLabel(value);
}

export function queueActionLabel(value) {
  return QUEUE_ACTION_DEFINITIONS[value]?.label || decisionLabel(value);
}

export function criteriaForLeadStage(stage) {
  return LEAD_STAGE_META[stage.key]?.criteria || [stage.description || stage.summary || '这个阶段还没有写明进入标准，需要补 SOP。'];
}

export function queueGroupMeta(key) {
  return LEAD_QUEUE_GROUP_META[key] || { label: key, summary: '', criteria: [], visibleInfo: [], opsInfo: [] };
}
