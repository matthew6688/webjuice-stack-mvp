#!/usr/bin/env node

import {
  buildForumThreadName,
  defaultDiscordForumBlueprints,
  desiredForumTagNames,
} from '../../core/funnel/discord.js';

const leadName = buildForumThreadName({
  workspace: 'leads',
  kind: 'sale',
  order: { company: 'Dark Shepherd', template: 'webjuice-restaurant' },
});

const projectName = buildForumThreadName({
  workspace: 'projects',
  kind: 'revision',
  order: { company: 'Dark Shepherd', template: 'webjuice-restaurant' },
  caseFile: { revision: { used: 2, policy: { limit: 3 } } },
  revision: { used: 2, limit: 3 },
});

const leadTags = desiredForumTagNames({
  workspace: 'leads',
  kind: 'paid_intake',
  order: { template: 'webjuice-restaurant' },
});

const projectTags = desiredForumTagNames({
  workspace: 'projects',
  kind: 'revision',
  order: { template: 'webjuice-roofing' },
  caseFile: { status: 'waiting_for_customer_dns' },
});

const blueprints = defaultDiscordForumBlueprints();

const result = {
  ok: true,
  leadName,
  projectName,
  leadTags,
  projectTags,
  hasLeadsBlueprint: Array.isArray(blueprints.leads) && blueprints.leads.length >= 5,
  hasProjectsBlueprint: Array.isArray(blueprints.projects) && blueprints.projects.length >= 8,
  assertions: {
    leadNamePrefix: leadName.startsWith('[Qualified]'),
    projectNamePrefix: projectName.startsWith('[Revision 2/3]'),
    leadTagsContainPaid: leadTags.includes('paid'),
    projectTagsContainRoofing: projectTags.includes('roofing'),
    projectTagsContainDomainBlocked: projectTags.includes('domain-blocked'),
    projectTagsContainWaitingUs: projectTags.includes('waiting-us'),
  },
};

if (!Object.values(result.assertions).every(Boolean) || !result.hasLeadsBlueprint || !result.hasProjectsBlueprint) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(result, null, 2));
