/**
 * Industry-aware trust signal adapter.
 *
 * Different niches have different legal / regulatory trust markers that
 * customers expect to see displayed. Roofing in QLD AU needs QBCC license;
 * dentists need AHPRA registration; restaurants need food handling certs.
 *
 * The dispatcher picks the right adapter based on entity.latest.niche.
 *
 * Each adapter exports `auditTrustSignals({ rawHtml, markdown }) → {
 *   ok, score, signals: [...], required_missing: [...], industry_label
 * }`.
 *
 * Adapter contract:
 *   - signals: [{ id, name, present, evidence_excerpt }]
 *   - required_missing: [...] — required-by-law signals not found
 *   - score: 0-100 weighted across signal importance
 */

import { auditTrustSignalsRoofingAU } from './roofing-au.js';
import { auditTrustSignalsGeneric } from './generic.js';

const ADAPTERS = {
  roofing: auditTrustSignalsRoofingAU,
  // Future:
  // 'dental': auditTrustSignalsDentalAU,
  // 'restaurant': auditTrustSignalsRestaurantAU,
};

export function auditTrustSignals({ rawHtml, markdown, niche, city }) {
  const key = String(niche || '').toLowerCase().trim();
  // Match niche keyword to known adapter (roof/roofing → roofing)
  for (const [adapterKey, fn] of Object.entries(ADAPTERS)) {
    if (key.includes(adapterKey)) {
      return fn({ rawHtml, markdown, city });
    }
  }
  return auditTrustSignalsGeneric({ rawHtml, markdown, city });
}
