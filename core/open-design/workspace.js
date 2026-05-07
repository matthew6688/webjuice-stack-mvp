import fs from 'fs';

export const DEFAULT_OPEN_DESIGN_DATA_DIR = '/Users/matthew/Developer/open-design/.od';

export function buildOpenDesignWorkspace(clientSlug, options = {}) {
  const prefix = options.prefix || (clientSlug ? `clients/${clientSlug}` : 'clients/<client>');
  const conceptPath = options.conceptPath || `${prefix}/concept/open-design`;
  const manifestPath = options.manifestPath || `${conceptPath}/concept-manifest.json`;
  const productionHandoffPath = options.productionHandoffPath || `${conceptPath}/production-handoff.json`;
  const manifest = options.manifest || readJsonIfExists(manifestPath);
  const dataDir = options.dataDir || manifest?.dataDir || DEFAULT_OPEN_DESIGN_DATA_DIR;

  if (!manifest) {
    return {
      status: 'not_created',
      mode: options.mode || 'app-visible',
      dataDir,
      projectId: '',
      runId: '',
      conceptPath,
      manifestPath,
      productionHandoffPath,
      createCommand: clientSlug
        ? `npm run open-design:run-concept -- --client ${clientSlug} --mode app-visible --source-url <official-site-url>`
        : '',
      continueCommand: '',
      syncCommand: '',
      rule: 'Create or bind one local Open Design project before doing high-fidelity design changes.',
    };
  }

  return {
    status: 'bound',
    mode: manifest.mode || options.mode || 'app-visible',
    dataDir,
    projectId: manifest.projectId || '',
    runId: manifest.lastRunId || manifest.runId || '',
    conceptPath,
    manifestPath,
    productionHandoffPath,
    createCommand: '',
    continueCommand: clientSlug ? `npm run open-design:continue-concept -- --client ${clientSlug} --prompt "<change request>"` : '',
    syncCommand: clientSlug ? `npm run open-design:sync-from-app -- --client ${clientSlug}` : '',
    rule: 'Use this exact local Open Design project for design concept changes. Do not start a separate Open Design project unless the operator explicitly asks.',
  };
}

function readJsonIfExists(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}
