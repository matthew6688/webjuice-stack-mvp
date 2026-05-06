import fs from 'fs';
import path from 'path';

export function loadPaidIntakeIndex({ root = 'data/paid-intakes' } = {}) {
  const records = [];
  if (!fs.existsSync(root)) return { records, counts: statusCounts(records), updatedAt: new Date().toISOString() };
  for (const clientSlug of fs.readdirSync(root).sort()) {
    const clientDir = path.join(root, clientSlug);
    if (!fs.statSync(clientDir).isDirectory()) continue;
    for (const filename of fs.readdirSync(clientDir).sort()) {
      if (!filename.endsWith('.json') || filename.endsWith('-timeline.json')) continue;
      const filePath = path.join(clientDir, filename);
      try {
        records.push(summarizePaidIntakeRecord(JSON.parse(fs.readFileSync(filePath, 'utf8')), filePath));
      } catch (error) {
        records.push({
          filePath,
          clientSlug,
          orderId: filename.replace(/\.json$/, ''),
          status: 'invalid_record',
          customer: { company: '', email: '', domain: '' },
          error: error instanceof Error ? error.message : String(error),
          updatedAt: '',
        });
      }
    }
  }
  records.sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
  return { records, counts: statusCounts(records), updatedAt: new Date().toISOString() };
}

export function loadPaidIntakeRecord({ root = 'data/paid-intakes', clientSlug, orderId } = {}) {
  const filePath = path.join(root, clientSlug || '', `${orderId || ''}.json`);
  const timelinePath = path.join(root, clientSlug || '', `${orderId || ''}-timeline.jsonl`);
  if (!fs.existsSync(filePath)) return null;
  const record = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const timeline = fs.existsSync(timelinePath)
    ? fs.readFileSync(timelinePath, 'utf8').split(/\n+/).filter(Boolean).map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { type: 'invalid_timeline_line', raw: line };
      }
    })
    : [];
  return {
    record,
    summary: summarizePaidIntakeRecord(record, filePath),
    filePath,
    timelinePath,
    timeline,
  };
}

export function summarizePaidIntakeRecord(record, filePath = '') {
  const revisions = Array.isArray(record.revisions) ? record.revisions : [];
  const acceptedRevisions = revisions.filter((revision) => revision.accepted !== false);
  return {
    filePath,
    clientSlug: record.clientSlug || '',
    orderId: record.orderId || record.order?.id || '',
    status: record.status || '',
    readinessStatus: record.readiness?.status || '',
    missing: record.readiness?.missing || [],
    customer: {
      company: record.customer?.company || '',
      email: record.customer?.email || '',
      phone: record.customer?.phone || '',
      domain: record.customer?.domain || '',
    },
    leadRecipientEmail: record.leadDelivery?.recipientEmail || '',
    tier: record.order?.tier || '',
    amount: record.order?.amount || '',
    currency: record.order?.currency || 'USD',
    assetCount: Array.isArray(record.intake?.assets) ? record.intake.assets.length : 0,
    fileCount: Array.isArray(record.intake?.files) ? record.intake.files.length : 0,
    revisionCount: acceptedRevisions.length,
    revisionLimit: record.revisionPolicy?.includedRevisions || includedRevisionsForTier(record.order?.tier),
    latestRevisionStatus: revisions[revisions.length - 1]?.status || '',
    firstVersionConfirmed: record.firstVersionConfirmation?.confirmed === true,
    createdAt: record.createdAt || '',
    updatedAt: record.updatedAt || '',
  };
}

export function statusCounts(records) {
  return records.reduce((counts, record) => {
    const key = record.status || 'unknown';
    counts[key] = (counts[key] || 0) + 1;
    counts.total = (counts.total || 0) + 1;
    return counts;
  }, { total: 0 });
}

export function includedRevisionsForTier(tier) {
  if (tier === 'yearly_maintenance') return 12;
  return 3;
}
