import fs from 'fs';
import path from 'path';

export const ENRICHMENT_GATE_STATUSES = ['planned', 'approved', 'executed', 'ingested'];

export function enrichmentGatePath(storeRoot = path.join('data', 'leads')) {
  return path.join(storeRoot, 'queues', 'selected-enrichment-gates.json');
}

export function loadEnrichmentGates({ storeRoot = path.join('data', 'leads') } = {}) {
  const filePath = enrichmentGatePath(storeRoot);
  if (!fs.existsSync(filePath)) {
    return {
      schemaVersion: 1,
      updatedAt: '',
      gates: {},
    };
  }
  try {
    const body = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return {
      schemaVersion: 1,
      updatedAt: body.updatedAt || '',
      gates: body.gates && typeof body.gates === 'object' ? body.gates : {},
    };
  } catch {
    return {
      schemaVersion: 1,
      updatedAt: '',
      gates: {},
    };
  }
}

export function getEnrichmentGate(entityKey, { storeRoot = path.join('data', 'leads') } = {}) {
  const gates = loadEnrichmentGates({ storeRoot });
  return normalizeGate(entityKey, gates.gates?.[entityKey]);
}

export function updateEnrichmentGate({
  entityKey,
  status,
  operator = 'profitslocal-admin',
  note = '',
  storeRoot = path.join('data', 'leads'),
  at = new Date().toISOString(),
} = {}) {
  const key = String(entityKey || '').trim();
  if (!key) throw new Error('entityKey is required');
  if (!ENRICHMENT_GATE_STATUSES.includes(status)) {
    throw new Error(`Unsupported enrichment gate status: ${status}`);
  }
  const gates = loadEnrichmentGates({ storeRoot });
  const existing = normalizeGate(key, gates.gates[key]);
  const next = {
    ...existing,
    entityKey: key,
    status,
    updatedAt: at,
    updatedBy: operator,
    history: [
      ...(existing.history || []),
      { at, status, operator, note: String(note || '').trim() },
    ],
  };
  if (status === 'approved') next.approvedAt = next.approvedAt || at;
  if (status === 'executed') next.executedAt = next.executedAt || at;
  if (status === 'ingested') next.ingestedAt = next.ingestedAt || at;

  gates.updatedAt = at;
  gates.gates[key] = next;
  const filePath = enrichmentGatePath(storeRoot);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(gates, null, 2)}\n`, 'utf8');
  return { ok: true, gate: next, path: filePath };
}

export function normalizeGate(entityKey, gate = {}) {
  return {
    entityKey,
    status: ENRICHMENT_GATE_STATUSES.includes(gate.status) ? gate.status : 'planned',
    updatedAt: gate.updatedAt || '',
    updatedBy: gate.updatedBy || '',
    approvedAt: gate.approvedAt || '',
    executedAt: gate.executedAt || '',
    ingestedAt: gate.ingestedAt || '',
    history: Array.isArray(gate.history) ? gate.history : [],
  };
}

export function enrichmentGateLabel(status) {
  return {
    planned: '已生成计划，未批准花钱',
    approved: '已批准补资料成本',
    executed: '已执行补资料',
    ingested: '已入库',
  }[status] || status || '未计划';
}
