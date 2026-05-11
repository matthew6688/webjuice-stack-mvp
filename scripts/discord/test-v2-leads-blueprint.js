#!/usr/bin/env node
/**
 * Block 1.1 hard evidence — V2 leads forum tag blueprint.
 *
 * Verifies DISCORD_OUTREACH_PRD.md §7.3:
 *   - leads blueprint has exactly 14 tags
 *   - 3 grade + 8 lifecycle + 3 modifier
 *   - niche (restaurant / roofing) NOT in leads blueprint
 *   - desiredForumTagNames maps legacy callers to new vocabulary
 */

import { defaultDiscordForumBlueprints, desiredForumTagNames } from '../../core/funnel/discord.js';

const blueprints = defaultDiscordForumBlueprints();
const leadTagNames = blueprints.leads.map((t) => t.name);

const expected = {
  grade: ['grade-a', 'grade-b', 'grade-c'],
  lifecycle: ['awaiting', 'outreach-active', 'replied', 'proposal-sent', 'nurture', 'paid', 'archived', 'needs-human'],
  modifier: ['urgent', 'do-not-contact', 'nurture-due'],
};
const expectedAll = [...expected.grade, ...expected.lifecycle, ...expected.modifier];

const missing = expectedAll.filter((tag) => !leadTagNames.includes(tag));
const extra = leadTagNames.filter((tag) => !expectedAll.includes(tag));
const nicheStillPresent = leadTagNames.filter((t) => ['restaurant', 'roofing'].includes(t));

const legacyPaidIntake = desiredForumTagNames({ workspace: 'leads', kind: 'paid_intake', order: { paymentStatus: 'paid' } });
const legacySale = desiredForumTagNames({ workspace: 'leads', kind: 'sale', order: { template: 'webjuice-restaurant' } });
const legacyReplied = desiredForumTagNames({ workspace: 'leads', kind: '', order: { replyState: 'replied' } });
const v2GradeA = desiredForumTagNames({ workspace: 'leads', kind: 'sale', order: { grade: 'A' } });

const result = {
  ok: true,
  count: leadTagNames.length,
  tags: leadTagNames,
  groups: expected,
  legacy_mappings: {
    paid_intake: legacyPaidIntake,        // should be ['paid']
    sale: legacySale,                      // should be ['awaiting']
    replied: legacyReplied,                // should be ['replied']
    sale_with_grade_a: v2GradeA,           // should be ['awaiting','grade-a']
  },
  assertions: {
    exactly_14_tags: leadTagNames.length === 14,
    all_expected_present: missing.length === 0,
    no_unexpected_tags: extra.length === 0,
    niche_removed: nicheStillPresent.length === 0,
    legacy_paid_works: legacyPaidIntake.includes('paid'),
    legacy_sale_maps_to_awaiting: legacySale.includes('awaiting'),
    legacy_replied_works: legacyReplied.includes('replied'),
    grade_a_tag_emitted: v2GradeA.includes('grade-a') && v2GradeA.includes('awaiting'),
    within_20_tag_limit: leadTagNames.length < 20,
  },
};

if (missing.length) result.missing = missing;
if (extra.length) result.extra = extra;
if (nicheStillPresent.length) result.niche_still_present = nicheStillPresent;

const ok = Object.values(result.assertions).every(Boolean);
if (!ok) {
  result.ok = false;
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(result, null, 2));
