import fs from 'fs';
import path from 'path';
import { qualifyLead, RECOMMENDED_ACTIONS } from './qualification.js';

const BUILD_ACTIONS = new Set([
  RECOMMENDED_ACTIONS.BUILD_STARTER,
  RECOMMENDED_ACTIONS.BUILD_REDESIGN,
  RECOMMENDED_ACTIONS.COLLECT_MORE,
]);

export function buildLeadSearchRun({
  leads,
  query = '',
  niche = 'restaurant',
  city = '',
  generatedAt = new Date().toISOString(),
  minQualification = 'B',
  maxSelected = null,
  websiteScansByPlaceId = {},
} = {}) {
  if (!Array.isArray(leads)) throw new Error('leads must be an array');
  const allowedGrades = gradesAtOrAbove(minQualification);
  const qualifications = leads.map((lead, index) => qualifyLead({
    lead: { ...lead, niche: lead.niche || niche, city: lead.city || city },
    websiteScan: websiteScansByPlaceId[lead.place_id] || null,
    niche: lead.niche || niche,
    clientSlug: lead.clientSlug,
  }));
  const selected = qualifications
    .filter((item) => allowedGrades.has(item.qualification))
    .filter((item) => BUILD_ACTIONS.has(item.recommendedAction))
    .filter((item) => item.contact.contactable)
    .slice(0, maxSelected ? Number(maxSelected) : qualifications.length);

  return {
    schemaVersion: 1,
    generatedAt,
    query,
    niche,
    city,
    minQualification,
    totals: {
      leads: leads.length,
      selected: selected.length,
      skipped: leads.length - selected.length,
    },
    selected,
    skipped: qualifications.filter((item) => !selected.includes(item)),
    collectionQueue: selected.map(collectionQueueItem),
  };
}

export function writeLeadSearchRun(run, outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(run, null, 2)}\n`);
  return outputPath;
}

export function defaultLeadSearchRunPath({ niche = 'restaurant', city = '', slug = 'search' } = {}) {
  const cityPart = slugify(city || 'unknown-city');
  return path.join('data', 'lead-runs', niche, cityPart, `${slugify(slug)}.json`);
}

function collectionQueueItem(item) {
  return {
    clientSlug: item.clientSlug,
    businessName: item.businessName,
    niche: item.niche,
    leadType: item.leadType,
    qualification: item.qualification,
    recommendedAction: item.recommendedAction,
    weightedScore: item.weightedScore,
    contact: item.contact,
    googlePlaces: item.googlePlaces,
    nextSteps: item.nextSteps,
    collectCommand: `npm run extract:google-places -- --placeId ${shellToken(item.googlePlaces.placeId)} --client ${shellToken(item.clientSlug)} --niche ${shellToken(item.niche)}`,
  };
}

function gradesAtOrAbove(minQualification) {
  const order = ['A', 'B', 'C', 'D'];
  const index = order.indexOf(String(minQualification || 'B').toUpperCase());
  const safeIndex = index >= 0 ? index : 1;
  return new Set(order.slice(0, safeIndex + 1));
}

function slugify(value) {
  return String(value || 'unknown')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'unknown';
}

function shellToken(value) {
  const raw = String(value || '');
  if (/^[a-zA-Z0-9._:/@-]+$/.test(raw)) return raw;
  return JSON.stringify(raw);
}
