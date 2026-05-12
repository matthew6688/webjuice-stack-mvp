/**
 * core/leads/thin-contact.js
 *
 * SOP-1's thin-contact predicate (§3.6.1).
 * An entity is "thin-contact" if it has neither phone nor website at the
 * top-level `latest.*` snapshot. Such entities are flagged for SOP-1 §3.6
 * enrichment (5-way search) before they can graduate to SOP-2 audit.
 *
 * Used by:
 *   - core/leads/discovery-store.js#mergeLeadIntoEntity (auto-set initial
 *     enrichment_status to 'pending' for thin-contact entities)
 *   - scripts/cli/pl-run-enrichment-batch.js (filter pending queue)
 *
 * SOP_1_INTAKE_DISCOVERY.md §3.6.1.
 */

/**
 * Return true if the entity lacks both phone and website.
 *
 * @param {Object} entity — V2 entity from data/leads/entities/<key>.json
 * @returns {boolean}
 */
export function isThinContact(entity) {
  const phone = entity?.latest?.phone || '';
  const website = entity?.latest?.website || '';
  return !phone && !website;
}

/**
 * Inverse — useful for filter chains.
 */
export function hasContact(entity) {
  return !isThinContact(entity);
}
