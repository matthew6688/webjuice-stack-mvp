/**
 * Buyer-segment persona router.
 *
 * Codex Round 11 canonical: "Template quality is judged by the trade owner ·
 * website performance is judged by the trade owner's customer." Each segment
 * here represents one of those customers · the audit T5 dim asks "does the
 * fold actually serve THIS segment's job-to-be-done."
 *
 * Boundary (codex Round 8):
 *   - personas/*.js = segment DATA (orthogonal to niche)
 *   - trust-signals/*.js = niche DATA (orthogonal to segment)
 *   - Audit dims read both · neither owns weighting logic.
 *
 * Scope tonight: 4 segments. `insurance-claim` deferred to Phase B.
 * Modifiers (landlord-investor · pre-sale-staging · referral-warm-lead)
 * are NOT segments · they overlay on a primary segment via the brief.
 *
 * Default primary when brief is ambiguous (codex Q-P-1):
 *   primary_segment = 'planned-upgrade'
 *   secondary_segments = ['urgent-repair']
 */

import urgentRepair from './urgent-repair.js';
import plannedUpgrade from './planned-upgrade.js';
import commercialMaintenance from './commercial-maintenance.js';
import guidedFirstTimeBuyer from './guided-first-time-buyer.js';

const SEGMENTS = {
  'urgent-repair': urgentRepair,
  'planned-upgrade': plannedUpgrade,
  'commercial-maintenance': commercialMaintenance,
  'guided-first-time-buyer': guidedFirstTimeBuyer,
};

export const SEGMENT_IDS = Object.keys(SEGMENTS);

export function getSegment(id) {
  const segment = SEGMENTS[id];
  if (!segment) {
    throw new Error(
      `Unknown buyer segment "${id}". Known: ${SEGMENT_IDS.join(', ')}. ` +
        `(insurance-claim is Phase B · not yet available.)`,
    );
  }
  return segment;
}

export function listSegments() {
  return Object.values(SEGMENTS);
}

export function defaultPrimary() {
  // Codex Q-P-1: ambiguous brief defaults to planned-upgrade primary
  // with urgent-repair as secondary capture.
  return 'planned-upgrade';
}

export function defaultSecondaries() {
  return ['urgent-repair'];
}

export default {
  getSegment,
  listSegments,
  defaultPrimary,
  defaultSecondaries,
  SEGMENT_IDS,
};
