/**
 * V3 cycle-26 · Card refresh scheduler · default production hook.
 *
 * Wired at boot (CLI / daemon entry points): every writeEntity → schedule
 * upsertProfileCard with 500ms debounce. Multiple writes in burst → one PATCH.
 *
 * Defense line 1 of profile-card-realtime invariant (per SOP-MASTER-MD-DATA-LINEAGE).
 */
const _pending = new Map(); // entityKey → setTimeout handle
const DEBOUNCE_MS = 500;

async function doRefresh(entityKey) {
  _pending.delete(entityKey);
  try {
    const { upsertProfileCard } = await import('./lead-thread-sync.js');
    const r = await upsertProfileCard(entityKey);
    if (!r?.ok && !r?.unchanged && !r?.skipped) {
      console.warn(`[card-refresh] upsert failed for ${entityKey}: ${r?.reason || 'unknown'}`);
    }
  } catch (err) {
    console.warn(`[card-refresh] error for ${entityKey}: ${err.message}`);
  }
}

export function scheduleCardRefresh(entityKey) {
  if (!entityKey) return;
  if (_pending.has(entityKey)) clearTimeout(_pending.get(entityKey));
  const h = setTimeout(() => doRefresh(entityKey), DEBOUNCE_MS);
  _pending.set(entityKey, h);
}

export function installDefaultScheduler() {
  // Lazy import to avoid circular dep with discovery-store at load time
  return import('../leads/discovery-store.js').then(({ setCardRefreshScheduler }) => {
    setCardRefreshScheduler(scheduleCardRefresh);
    return true;
  });
}
