#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { buildWebsiteReady, saveWebsiteReadyOutputs } from '../../core/intake/website-ready.js';
import { buildOpenDesignWorkspace } from '../../core/open-design/workspace.js';
import { createAgentTask, validateAgentTask } from '../../core/agents/task.js';
import { buildAgentReviewEmail } from '../../core/funnel/customer-email.js';

const args = parseArgs(process.argv.slice(2));
const clientSlug = stringArg('client');
if (!clientSlug) {
  console.error('Usage: npm run ops:project-dry-run -- --client <slug> [--business-name "..."] [--source-url https://...] [--repo owner/repo] [--repo-dir /path/to/repo] [--email owner@example.com]');
  process.exit(1);
}

const niche = args.niche || 'restaurant';
const route = args.route || 'website';
const businessName = args['business-name'] || args.businessName || clientSlug;
const sourceUrl = args['source-url'] || args.sourceUrl || '';
const repo = args.repo || `matthew6688/${clientSlug}`;
const repoDir = args['repo-dir'] || args.repoDir || '';
const previewUrl = args['preview-url'] || args.previewUrl || `https://${clientSlug}-dev.pages.dev/`;
const orderId = args.order || args.orderId || `dryrun_${Date.now()}`;
const email = args.email || '';
const runOpenDesign = boolArg('run-open-design');
const buildHandoff = boolArg('build-handoff');
const caseDir = path.join('data', 'cases', clientSlug, orderId);
const paths = {
  caseDir,
  casePath: path.join(caseDir, 'case.json'),
  contextPath: path.join(caseDir, 'context-packet.json'),
  timelinePath: path.join(caseDir, 'timeline.jsonl'),
  buildPacketPath: path.join(caseDir, 'build-packet.md'),
  checklistPath: path.join(caseDir, 'ops-checklist.json'),
  checklistMarkdownPath: path.join(caseDir, 'ops-checklist.md'),
  taskDraftPath: path.join(caseDir, 'agent-task-draft.json'),
  reviewEmailPath: path.join(caseDir, 'customer-review-email-draft.json'),
  handoffPath: path.join(caseDir, 'website-handoff.json'),
  handoffMarkdownPath: path.join(caseDir, 'website-handoff.md'),
};

fs.mkdirSync(caseDir, { recursive: true });

const checklist = {
  schemaVersion: 1,
  mode: 'project_dry_run',
  clientSlug,
  businessName,
  niche,
  route,
  repo,
  repoDir,
  sourceUrl,
  previewUrl,
  orderId,
  customerEmail: email,
  status: 'running',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  stages: [],
  nextActions: [],
};

let caseFile = writeInitialCase();
saveChecklist();

await stage('stage_0_case_created', {
  name: '创建 dry-run case',
  critical: true,
  run: () => ({
    status: 'pass',
    output: 'Dry-run case created.',
    evidence: [paths.casePath, paths.contextPath],
    nextAction: '继续验证 evidence 和 website-ready packet。',
  }),
});

await stage('stage_1_evidence_validate', {
  name: '验证 evidence',
  critical: true,
  command: `npm run evidence:validate -- --client ${clientSlug} --niche ${niche}`,
  run: () => {
    const evidencePath = path.join('clients', clientSlug, 'evidence', 'evidence.json');
    if (!fs.existsSync(evidencePath)) {
      return {
        status: 'blocker',
        output: `Missing evidence file: ${evidencePath}`,
        evidence: [],
        nextAction: '先运行资料收集，生成 evidence/evidence.json。',
      };
    }
    return runCommand('npm', ['run', 'evidence:validate', '--', '--client', clientSlug, '--niche', niche], {
      evidence: [evidencePath],
      successNextAction: '继续生成 website-ready packet。',
    });
  },
});

let websiteReady = null;
await stage('stage_2_website_ready_packet', {
  name: '生成 website-ready packet',
  critical: true,
  run: () => {
    try {
      websiteReady = buildWebsiteReady({
        clientSlug,
        niche,
        route,
        sourceType: args.source || args.sourceType || 'manual',
        customerConfirmed: args.confirmed || args.confirm || true,
        businessName,
        casePath: paths.casePath,
        buildPacketPath: paths.buildPacketPath,
      });
      saveWebsiteReadyOutputs(websiteReady);
      const status = websiteReady.survey.readyToBuild ? 'pass' : 'blocker';
      return {
        status,
        output: `Readiness: ${websiteReady.survey.readiness}; readyToBuild=${websiteReady.survey.readyToBuild}`,
        evidence: [websiteReady.paths.surveyPath, websiteReady.paths.buildPacketPath],
        data: {
          readiness: websiteReady.survey.readiness,
          readyToBuild: websiteReady.survey.readyToBuild,
          missing: websiteReady.survey.missing,
          nextAction: websiteReady.survey.nextAction,
        },
        nextAction: translateNextAction(websiteReady.survey.nextAction),
      };
    } catch (error) {
      return {
        status: 'blocker',
        output: error.message,
        evidence: [],
        nextAction: '修复 evidence/content/design 缺口后重新运行 dry-run。',
      };
    }
  },
});

let openDesign = null;
await stage('stage_3_open_design_binding', {
  name: '检查 Open Design project',
  critical: true,
  run: () => {
    openDesign = buildOpenDesignWorkspace(clientSlug);
    if (openDesign.status === 'bound') {
      return {
        status: 'pass',
        output: `Open Design project bound: ${openDesign.projectId}`,
        evidence: [openDesign.manifestPath, openDesign.productionHandoffPath],
        data: openDesign,
        nextAction: '继续确认 production handoff。',
      };
    }
    if (runOpenDesign && sourceUrl) {
      const result = runCommand('npm', [
        'run',
        'open-design:run-concept',
        '--',
        '--client',
        clientSlug,
        '--mode',
        'app-visible',
        '--source-url',
        sourceUrl,
      ], {
        evidence: [openDesign.manifestPath],
        successNextAction: '重新运行 dry-run 或继续生成 production handoff。',
      });
      openDesign = buildOpenDesignWorkspace(clientSlug);
      return {
        ...result,
        status: openDesign.status === 'bound' ? result.status : 'blocker',
        data: openDesign,
      };
    }
    return {
      status: 'blocker',
      output: 'Open Design project is not created/bound.',
      evidence: [],
      data: openDesign,
      nextAction: openDesign.createCommand,
    };
  },
});

await stage('stage_4_production_handoff', {
  name: '检查 production handoff',
  critical: true,
  run: () => {
    const handoffPath = openDesign?.productionHandoffPath || path.join('clients', clientSlug, 'concept', 'open-design', 'production-handoff.json');
    if (fs.existsSync(handoffPath)) {
      return {
        status: 'pass',
        output: `Production handoff exists: ${handoffPath}`,
        evidence: [handoffPath],
        nextAction: '继续 port/build customer repo dev preview。',
      };
    }
    if (buildHandoff && repoDir) {
      return runCommand('npm', [
        'run',
        'open-design:build-production-handoff',
        '--',
        '--client',
        clientSlug,
        '--content',
        path.join('clients', clientSlug, 'content.restaurant.json'),
        '--design',
        path.join('clients', clientSlug, 'design.restaurant.json'),
        '--evidence',
        path.join('clients', clientSlug, 'evidence', 'evidence.json'),
        '--survey',
        path.join('clients', clientSlug, 'intake', 'website-survey.json'),
        '--target-repo',
        repoDir,
        '--target-branch',
        'dev',
      ], {
        evidence: [handoffPath],
        successNextAction: '继续 port/build customer repo dev preview。',
      });
    }
    return {
      status: 'blocker',
      output: `Missing production handoff: ${handoffPath}`,
      evidence: [],
      nextAction: '在 Open Design concept 被接受后运行 open-design:build-production-handoff。',
    };
  },
});

await stage('stage_5_customer_repo_build', {
  name: '构建 customer repo dev preview',
  critical: Boolean(repoDir),
  command: repoDir ? `cd ${repoDir} && npm run build` : '',
  run: () => {
    if (!repoDir) {
      return {
        status: 'skipped',
        output: 'No --repo-dir provided.',
        evidence: [],
        nextAction: '提供 --repo-dir 后验证 customer repo build 和 preview banner。',
      };
    }
    if (!fs.existsSync(repoDir)) {
      return {
        status: 'blocker',
        output: `Missing repo dir: ${repoDir}`,
        evidence: [],
        nextAction: '先 clone/sync customer repo 到本地。',
      };
    }
    return runCommand('npm', ['run', 'build'], {
      cwd: repoDir,
      evidence: [path.join(repoDir, 'dist')],
      successNextAction: '继续验证 customer repo preview banner。',
    });
  },
});

await stage('stage_5b_preview_funnel_qa', {
  name: '验证 preview banner 和官方 funnel links',
  critical: Boolean(repoDir),
  run: () => {
    if (!repoDir) {
      return {
        status: 'skipped',
        output: 'No --repo-dir provided.',
        evidence: [],
        nextAction: '提供 --repo-dir 后运行 qa:funnel-pages。',
      };
    }
    const distDir = path.join(repoDir, 'dist');
    if (!fs.existsSync(distDir)) {
      return {
        status: 'blocker',
        output: `Missing dist dir: ${distDir}`,
        evidence: [],
        nextAction: '先在 customer repo 运行 npm run build。',
      };
    }
    const result = runCommand('npm', ['run', 'qa:funnel-pages', '--', '--dist-dir', distDir, '--client', businessName], {
      evidence: [distDir],
      successNextAction: '继续创建 agent task draft。',
    });
    if (result.status !== 'pass') {
      const output = String(result.output || '');
      if (output.includes('local_funnel_route_removed_or_redirected') || output.includes('still exists') || output.includes('still serves ProfitsLocal funnel chrome')) {
        result.nextAction = '这个 customer repo 还残留旧版本地 funnel 页面。先同步到最新模板规则，移除本地 /checkout /approve /revise /domain-help 等页面，再重新运行 dry-run。';
      }
    }
    return result;
  },
});

let task = null;
await stage('stage_8_agent_task_draft', {
  name: '创建 agent task draft',
  critical: true,
  run: () => {
    try {
      task = createAgentTask({
        clientSlug,
        type: 'sale',
        repo,
        branch: 'dev',
        buildPacketPath: paths.buildPacketPath,
        openDesign,
        createdFrom: 'manual',
        order: {
          orderId,
          clientSlug,
          repo,
          email,
          company: businessName,
          previewUrl,
          tier: 'dry_run',
          amount: 0,
          currency: 'USD',
        },
      });
      const validation = validateAgentTask(task);
      writeJson(paths.taskDraftPath, task);
      return {
        status: validation.ok ? 'pass' : 'blocker',
        output: validation.ok ? `Task draft valid: ${task.id}` : `Task draft invalid: ${validation.errors.join('; ')}`,
        evidence: [paths.taskDraftPath],
        data: { taskId: task.id, validation },
        nextAction: validation.ok ? '人工确认后可把 task dispatch 到 Discord website thread。' : '修复 task packet 缺失字段。',
      };
    } catch (error) {
      return {
        status: 'blocker',
        output: error.message,
        evidence: [],
        nextAction: '修复 task packet 所需输入。',
      };
    }
  },
});

await stage('stage_9_customer_review_email_draft', {
  name: '生成 customer review email draft',
  critical: false,
  run: () => {
    if (!email) {
      return {
        status: 'skipped',
        output: 'No --email provided.',
        evidence: [],
        nextAction: '付款或客户 intake 后，用 checkout email 生成 review email。',
      };
    }
    const message = buildAgentReviewEmail({
      caseFile,
      runResult: {
        ok: true,
        previewUrl,
        changedFiles: [],
      },
      deployResult: { status: 'dry_run', conclusion: 'not_sent' },
    });
    if (!message) {
      return {
        status: 'skipped',
        output: 'Customer review email could not be built.',
        evidence: [],
        nextAction: '确认 caseFile.customer.email 是否存在。',
      };
    }
    writeJson(paths.reviewEmailPath, message);
    return {
      status: 'pass',
      output: `Review email draft written for ${email}`,
      evidence: [paths.reviewEmailPath],
      nextAction: 'customer email 只能在 delivery QA 通过后通过 Resend 正式发送。',
    };
  },
});

finalizeChecklist();
saveChecklist();
console.log(JSON.stringify({
  ok: checklist.status === 'ready_for_customer_review',
  status: checklist.status,
  clientSlug,
  orderId,
  caseDir,
  checklistPath: paths.checklistPath,
  checklistMarkdownPath: paths.checklistMarkdownPath,
  blockers: checklist.stages.filter((item) => item.status === 'blocker' || item.status === 'fail').map((item) => ({
    id: item.id,
    name: item.name,
    nextAction: item.nextAction,
  })),
  nextActions: checklist.nextActions,
}, null, 2));

process.exit(checklist.status === 'failed' ? 1 : 0);

async function stage(id, { name, critical = false, command = '', run }) {
  const startedAt = new Date().toISOString();
  let result;
  try {
    result = run();
  } catch (error) {
    result = {
      status: critical ? 'fail' : 'skipped',
      output: error.message,
      evidence: [],
      nextAction: '检查上一步输出和命令错误。',
    };
  }
  const finishedAt = new Date().toISOString();
  const normalized = {
    id,
    name,
    critical,
    status: result.status || 'pass',
    command: command || result.command || '',
    output: result.output || '',
    evidence: result.evidence || [],
    data: result.data || undefined,
    nextAction: result.nextAction || '',
    startedAt,
    finishedAt,
  };
  checklist.stages.push(normalized);
  if (normalized.nextAction && ['blocker', 'fail', 'skipped'].includes(normalized.status)) {
    checklist.nextActions.push({
      stage: normalized.id,
      action: normalized.nextAction,
    });
  }
  checklist.updatedAt = finishedAt;
  saveChecklist();
  return normalized;
}

function runCommand(command, commandArgs, { cwd = process.cwd(), evidence = [], successNextAction = '' } = {}) {
  try {
    const output = execFileSync(command, commandArgs, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
    return {
      status: 'pass',
      command: `${command} ${commandArgs.join(' ')}`,
      output: tail(output),
      evidence,
      nextAction: successNextAction,
    };
  } catch (error) {
    const output = `${error.stdout || ''}${error.stderr || ''}${error.message || ''}`.trim();
    return {
      status: 'blocker',
      command: `${command} ${commandArgs.join(' ')}`,
      output: tail(output),
      evidence,
      nextAction: '修复该命令失败原因后重新运行 dry-run。',
    };
  }
}

function writeInitialCase() {
  const now = new Date().toISOString();
  const file = {
    schemaVersion: 1,
    caseId: `${clientSlug}_${orderId}`,
    status: 'dry_run_created',
    clientSlug,
    repo,
    branch: 'dev',
    previewUrl,
    order: {
      id: orderId,
      provider: 'dry_run',
      tier: 'dry_run',
      amount: 0,
      currency: 'USD',
      paymentStatus: 'not_paid',
    },
    customer: {
      company: businessName,
      email,
      phone: '',
      domain: '',
    },
    discord: {
      salesThreadId: '',
      revisionThreadId: '',
      websiteTaskThreadId: '',
      lastChannelId: '',
      lastMessageId: '',
      lastMessageUrl: '',
    },
    sourceOfTruth: {
      evidence: `clients/${clientSlug}/evidence/evidence.json`,
      content: `clients/${clientSlug}/content.restaurant.json`,
      design: `clients/${clientSlug}/design.restaurant.json`,
      brandSpec: `clients/${clientSlug}/brand-spec.md`,
      checkout: `clients/${clientSlug}/funnel/checkout.json`,
      websiteSurvey: `clients/${clientSlug}/intake/website-survey.json`,
    },
    paths: {
      casePath: paths.casePath,
      contextPath: paths.contextPath,
      timelinePath: paths.timelinePath,
      buildPacketPath: paths.buildPacketPath,
      artifactsDir: path.join(caseDir, 'artifacts'),
    },
    createdAt: now,
    updatedAt: now,
  };
  writeJson(paths.casePath, file);
  writeJson(paths.contextPath, {
    schemaVersion: 1,
    caseId: file.caseId,
    clientSlug,
    repo,
    previewUrl,
    sourceOfTruth: file.sourceOfTruth,
    paths: file.paths,
    note: 'Dry-run context only. Do not treat as paid customer order.',
  });
  if (!fs.existsSync(paths.timelinePath)) fs.writeFileSync(paths.timelinePath, '');
  fs.mkdirSync(path.join(caseDir, 'artifacts'), { recursive: true });
  return file;
}

function finalizeChecklist() {
  const criticalStages = checklist.stages.filter((item) => item.critical);
  const criticalBlockers = criticalStages.filter((item) => ['blocker', 'fail'].includes(item.status));
  checklist.status = criticalBlockers.length
    ? 'blocked'
    : 'ready_for_customer_review';
  checklist.updatedAt = new Date().toISOString();
  writeMarkdownSummary();
  writeHandoffSummary();
}

function saveChecklist() {
  writeJson(paths.checklistPath, checklist);
}

function writeMarkdownSummary() {
  const lines = [
    `# Ops Checklist: ${businessName}`,
    '',
    `Status: ${checklist.status}`,
    `Client: ${clientSlug}`,
    `Order/run: ${orderId}`,
    `Repo: ${repo}`,
    `Preview: ${previewUrl}`,
    '',
    '| Stage | Status | Evidence | Next action |',
    '|---|---|---|---|',
    ...checklist.stages.map((item) => [
      item.name,
      item.status,
      item.evidence?.length ? item.evidence.join('<br>') : '-',
      item.nextAction || '-',
    ].map(escapeMd).join(' | ')).map((row) => `| ${row} |`),
    '',
  ];
  fs.writeFileSync(paths.checklistMarkdownPath, `${lines.join('\n')}\n`);
}

function writeHandoffSummary() {
  const currentOpenDesign = buildOpenDesignWorkspace(clientSlug);
  const summary = {
    schemaVersion: 1,
    clientSlug,
    businessName,
    repo,
    repoDir,
    previewUrl,
    orderId,
    status: checklist.status,
    sourceUrl,
    websiteSurveyPath: path.join('clients', clientSlug, 'intake', 'website-survey.json'),
    buildPacketPath: paths.buildPacketPath,
    openDesign: {
      status: currentOpenDesign.status,
      projectId: currentOpenDesign.projectId || '',
      manifestPath: currentOpenDesign.manifestPath || '',
      productionHandoffPath: currentOpenDesign.productionHandoffPath || '',
      continueCommand: currentOpenDesign.continueCommand || '',
      syncCommand: currentOpenDesign.syncCommand || '',
    },
    taskDraftPath: fs.existsSync(paths.taskDraftPath) ? paths.taskDraftPath : '',
    reviewEmailDraftPath: fs.existsSync(paths.reviewEmailPath) ? paths.reviewEmailPath : '',
    checklistPath: paths.checklistPath,
    checklistMarkdownPath: paths.checklistMarkdownPath,
    nextActions: checklist.nextActions,
    summaryText: checklist.status === 'ready_for_customer_review'
      ? '这个新 repo 已经达到可以进入客户 review 的标准状态。'
      : '这个项目还没有达到客户 review 标准，请先处理 blockers。',
  };

  writeJson(paths.handoffPath, summary);

  const lines = [
    `# Website Handoff: ${businessName}`,
    '',
    `状态：${checklist.status}`,
    `项目：${clientSlug}`,
    `Repo：${repo}`,
    `本地目录：${repoDir || '未提供'}`,
    `Preview：${previewUrl}`,
    `Dry-run：${orderId}`,
    '',
    '## 当前结论',
    '',
    summary.summaryText,
    '',
    '## 核心入口',
    '',
    `- Website survey：${summary.websiteSurveyPath}`,
    `- Build packet：${summary.buildPacketPath}`,
    `- Ops checklist：${summary.checklistMarkdownPath}`,
    `- Agent task draft：${summary.taskDraftPath || '未生成'}`,
    `- Customer review email draft：${summary.reviewEmailDraftPath || '未生成'}`,
    '',
    '## Open Design',
    '',
    `- 状态：${summary.openDesign.status}`,
    `- Project ID：${summary.openDesign.projectId || '未绑定'}`,
    `- Manifest：${summary.openDesign.manifestPath || '未生成'}`,
    `- Production handoff：${summary.openDesign.productionHandoffPath || '未生成'}`,
    `- Continue command：${summary.openDesign.continueCommand || '无'}`,
    `- Sync command：${summary.openDesign.syncCommand || '无'}`,
    '',
    '## 下一步',
    '',
    ...(summary.nextActions.length
      ? summary.nextActions.map((item, index) => `${index + 1}. ${item.action}`)
      : ['1. 可以把这份 handoff 发到 Discord website thread，进入人工 review 或客户 review。']),
    '',
  ];
  fs.writeFileSync(paths.handoffMarkdownPath, `${lines.join('\n')}\n`);
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function tail(value) {
  const lines = String(value || '').trim().split('\n').filter(Boolean);
  return lines.slice(Math.max(lines.length - 18, 0)).join('\n');
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    parsed[key] = next && !next.startsWith('--') ? next : true;
    if (next && !next.startsWith('--')) i += 1;
  }
  return parsed;
}

function stringArg(name) {
  return String(args[name] || '').trim();
}

function boolArg(name) {
  const value = args[name];
  return value === true || value === 'true' || value === '1' || value === 'yes';
}

function escapeMd(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}

function translateNextAction(value = '') {
  const text = String(value || '');
  const known = {
    'Create or continue the website task thread and build on dev.': '创建或继续 Discord website task thread，然后在 dev 上构建。',
    'Collect missing source-of-truth fields, then rerun website-ready.': '补齐 source-of-truth 缺失字段，然后重新运行 website-ready。',
    'Resolve evidence conflicts before any build work.': '先解决 evidence 冲突，再开始任何 build 工作。',
    'Send the survey summary to the customer or operator for confirmation.': '先把 survey summary 发给客户或 operator 确认。',
  };
  return known[text] || text;
}
