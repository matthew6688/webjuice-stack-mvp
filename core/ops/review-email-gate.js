import fs from 'fs';
import path from 'path';
import { validatePreReviewGate } from '../agents/review-gate.js';
import { recordCaseNotification } from '../cases/case-file.js';
import { sendCustomerEmail } from '../funnel/customer-email.js';

export async function sendReadyForReviewEmail(options = {}) {
  const {
    clientSlug = '',
    orderId = '',
    caseDir = '',
    env = process.env,
    send = false,
    fetchImpl = fetch,
  } = options;

  const resolvedCaseDir = caseDir || path.join('data', 'cases', safeId(clientSlug), safeId(orderId));
  const paths = {
    caseDir: resolvedCaseDir,
    casePath: path.join(resolvedCaseDir, 'case.json'),
    checklistPath: path.join(resolvedCaseDir, 'ops-checklist.json'),
    reviewDraftPath: path.join(resolvedCaseDir, 'customer-review-email-draft.json'),
    outputPath: path.join(resolvedCaseDir, 'customer-review-email-send.json'),
  };

  const caseFile = readJson(paths.casePath, '缺少 case.json，无法发送 review email。');
  const checklist = readJson(paths.checklistPath, '缺少 ops-checklist.json，无法判断项目状态。');
  const message = readJson(paths.reviewDraftPath, '缺少 customer-review-email-draft.json，无法发送 review email。');

  const result = {
    ok: false,
    send,
    clientSlug: caseFile.clientSlug || clientSlug,
    orderId: caseFile.order?.id || orderId,
    checklistStatus: checklist.status || 'unknown',
    casePath: paths.casePath,
    checklistPath: paths.checklistPath,
    reviewDraftPath: paths.reviewDraftPath,
    ready: checklist.status === 'ready_for_customer_review',
    preReviewGate: {
      ok: true,
      skipped: true,
      reason: 'no_latest_agent_run',
      missing: [],
    },
    deliveryQa: null,
    sendResult: { ok: false, skipped: true, reason: 'send_disabled' },
    message: '',
  };

  if (!result.ready) {
    result.message = 'ops-checklist 还没有达到 ready_for_customer_review，禁止正式发 review email。';
    writeJson(paths.outputPath, result);
    return result;
  }

  if (caseFile.latestAgentRun?.audit) {
    const gate = validatePreReviewGate({ audit: caseFile.latestAgentRun.audit });
    result.preReviewGate = gate;
    result.deliveryQa = gate.deliveryQa || null;
    if (!gate.ok) {
      result.message = `pre-review gate 未通过：${gate.missing.join(', ')}`;
      writeJson(paths.outputPath, result);
      return result;
    }
  }

  if (send) {
    const sendResult = await sendCustomerEmail(env, message, {
      fetchImpl,
      clientSlug: caseFile.clientSlug || clientSlug,
      emailMetadata: {
        kind: 'customer_review_ready',
        orderId: caseFile.order?.id || orderId,
      },
    });
    result.sendResult = sendResult;
    result.ok = Boolean(sendResult.ok);
    result.message = sendResult.ok
      ? 'Review email 已正式发送。'
      : (sendResult.skipped ? 'Review email 未发送。' : 'Review email 发送失败。');

    if (sendResult.ok) {
      const record = recordCaseNotification(caseFile.paths || { casePath: paths.casePath }, {
        type: 'customer_review_email_sent',
        kind: 'website_task',
        ok: true,
        channel: 'resend',
        reason: 'ready_for_customer_review',
      });
      result.caseRecord = {
        ok: record.ok,
        casePath: record.caseFile?.paths?.casePath || paths.casePath,
      };
    }
  } else {
    result.ok = true;
    result.message = 'Dry-run only：review email 已通过门禁检查，可以正式发送。';
  }

  writeJson(paths.outputPath, result);
  return result;
}

function readJson(filePath, errorMessage) {
  if (!fs.existsSync(filePath)) throw new Error(errorMessage);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function safeId(value) {
  return String(value || 'unknown')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'unknown';
}
