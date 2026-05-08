import fs from 'fs';
import path from 'path';

export const LEAD_TYPES = {
  NO_WEBSITE: 'no_website',
  BAD_WEBSITE: 'bad_website',
  GOOD_WEBSITE: 'good_website',
  UNKNOWN: 'unknown',
};

export const RECOMMENDED_ACTIONS = {
  BUILD_STARTER: 'build_starter_preview',
  BUILD_REDESIGN: 'build_redesign_preview',
  COLLECT_MORE: 'collect_more_info',
  OUTREACH_ONLY: 'outreach_only',
  MANUAL_REVIEW: 'manual_review',
  SKIP: 'skip',
};

export function qualifyLead(input = {}) {
  const lead = input.lead || readLead(input.leadPath, input.leadIndex);
  if (!lead) throw new Error('lead or leadPath is required');
  const websiteScan = input.websiteScan || readJsonIfExists(input.websiteScanPath);
  const niche = input.niche || lead.niche || 'restaurant';
  const websiteUrl = cleanUrl(lead.website || input.websiteUrl || '');
  const websiteAssessment = assessWebsite({ lead, websiteScan, websiteUrl });
  const contactability = scoreContactability({ lead, websiteScan });
  const businessValue = scoreBusinessValue({ lead, niche });
  const websiteOpportunity = scoreWebsiteOpportunity({ lead, websiteAssessment });
  const assetAvailability = scoreAssetAvailability({ lead, websiteScan });
  const buildFeasibility = scoreBuildFeasibility({ lead, websiteScan, websiteAssessment });
  const scores = {
    contactability,
    businessValue,
    websiteOpportunity,
    assetAvailability,
    buildFeasibility,
  };
  const weightedScore = Math.round(
    contactability * 0.25
    + businessValue * 0.2
    + websiteOpportunity * 0.25
    + assetAvailability * 0.15
    + buildFeasibility * 0.15,
  );
  const leadType = classifyLeadType({ websiteUrl, websiteAssessment, websiteOpportunity });
  const qualification = qualificationGrade({ scores, weightedScore, leadType });
  const recommendedAction = recommendedActionFor({ qualification, leadType, scores });
  const reasons = reasonsFor({ lead, websiteUrl, websiteAssessment, scores, leadType });
  const blockers = blockersFor({ lead, scores });
  const nextSteps = nextStepsFor({ leadType, recommendedAction, websiteUrl });

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    clientSlug: input.clientSlug || slugify(lead.name || 'unknown-lead'),
    businessName: lead.name || '',
    niche,
    leadType,
    qualification,
    recommendedAction,
    weightedScore,
    scores,
    contact: {
      phone: lead.phone || '',
      website: websiteUrl,
      googleMapsUrl: lead.google_maps_url || '',
      email: websiteAssessment.email || '',
      contactable: contactability >= 45,
    },
    googlePlaces: {
      placeId: lead.place_id || '',
      rating: Number(lead.rating || 0) || null,
      reviewCount: Number(lead.review_count || 0),
      address: lead.address || '',
      hoursCount: Array.isArray(lead.hours) ? lead.hours.length : 0,
      photoCount: Array.isArray(lead.photo_references) ? lead.photo_references.length : (lead.photo_reference ? 1 : 0),
    },
    websiteAssessment,
    reasons,
    blockers,
    nextSteps,
  };
}

export function saveLeadQualification(result, outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  return outputPath;
}

function assessWebsite({ lead, websiteScan, websiteUrl }) {
  if (!websiteUrl) {
    return {
      exists: false,
      quality: 'none',
      score: 0,
      email: '',
      signals: ['no website listed on Google Places'],
      issues: ['no official website URL'],
    };
  }
  const text = [websiteScan?.markdown, websiteScan?.html, websiteScan?.metadata?.description, websiteScan?.metadata?.title]
    .filter(Boolean)
    .join('\n');
  const links = Array.isArray(websiteScan?.links) ? websiteScan.links : [];
  const issues = [];
  const signals = [];
  let score = 50;
  if (websiteScan) {
    score += 10;
    signals.push('official website can be scraped');
  } else {
    issues.push('website not inspected yet');
  }
  if (text.length > 3000) {
    score += 12;
    signals.push('website has substantial content');
  } else if (websiteScan) {
    score -= 8;
    issues.push('website content appears thin');
  }
  if (/reserve|reservation|book|booking|opentable|resy|tock|sevenrooms|nowbookit/i.test(text) || links.some((link) => /reserve|booking|sevenrooms|opentable|resy|tock/i.test(link))) {
    score += 8;
    signals.push('reservation/contact conversion path found');
  } else if (lead.niche === 'restaurant') {
    score -= 8;
    issues.push('no reservation/contact conversion path found');
  }
  if (/menu|dining|food|drink|wine/i.test(text) || links.some((link) => /menu|dining|food|drink|wine/i.test(link))) {
    score += 6;
    signals.push('menu/content path found');
  }
  if (/squarespace|wix|weebly|godaddy|wordpress/i.test(text)) {
    score -= 6;
    issues.push('template/CMS footprint suggests redesign opportunity');
  }
  if (/©\s*(?:20(?:0\d|1\d)|2020|2021|2022)/i.test(text)) {
    score -= 6;
    issues.push('possible stale copyright/date signal');
  }
  const imageCount = (text.match(/!\[|<img\b/gi) || []).length;
  if (imageCount >= 3) {
    score += 5;
    signals.push('website exposes usable imagery');
  }
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || '';
  if (email) signals.push('email found on website');
  const normalizedScore = clamp(score);
  return {
    exists: true,
    quality: normalizedScore >= 78 ? 'good' : normalizedScore >= 45 ? 'weak' : 'bad',
    score: normalizedScore,
    email,
    signals,
    issues,
  };
}

function scoreContactability({ lead, websiteScan }) {
  let score = 0;
  if (lead.phone) score += 45;
  if (lead.website) score += 18;
  if (lead.google_maps_url) score += 10;
  const text = [websiteScan?.markdown, websiteScan?.html].filter(Boolean).join('\n');
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text)) score += 22;
  if (/instagram\.com|facebook\.com|mailto:/i.test(text)) score += 10;
  return clamp(score);
}

function scoreBusinessValue({ lead, niche }) {
  const rating = Number(lead.rating || 0);
  const reviews = Number(lead.review_count || 0);
  let score = 30;
  if (rating >= 4.7) score += 25;
  else if (rating >= 4.3) score += 18;
  else if (rating >= 4.0) score += 10;
  if (reviews >= 1000) score += 25;
  else if (reviews >= 250) score += 18;
  else if (reviews >= 75) score += 10;
  if (Array.isArray(lead.hours) && lead.hours.length >= 5) score += 8;
  if (niche === 'restaurant') score += 5;
  return clamp(score);
}

function scoreWebsiteOpportunity({ lead, websiteAssessment }) {
  if (!lead.website) return 92;
  if (websiteAssessment.quality === 'bad') return 88;
  if (websiteAssessment.quality === 'weak') return 76;
  if (websiteAssessment.quality === 'good') return 35;
  return 60;
}

function scoreAssetAvailability({ lead, websiteScan }) {
  let score = 0;
  const photos = Array.isArray(lead.photo_references) ? lead.photo_references.length : (lead.photo_reference ? 1 : 0);
  if (photos >= 8) score += 35;
  else if (photos >= 3) score += 25;
  else if (photos >= 1) score += 12;
  const text = [websiteScan?.markdown, websiteScan?.html].filter(Boolean).join('\n');
  if (/logo|brand|<img\b|!\[/i.test(text)) score += 20;
  if (/menu|services|dining|gallery|about/i.test(text)) score += 20;
  if (/#[0-9a-f]{6}|font-family/i.test(text)) score += 10;
  return clamp(score);
}

function scoreBuildFeasibility({ lead, websiteScan, websiteAssessment }) {
  let score = 20;
  if (lead.name) score += 10;
  if (lead.address) score += 12;
  if (lead.phone) score += 12;
  if (lead.google_maps_url) score += 8;
  if (lead.website && websiteScan) score += 18;
  if (!lead.website && (lead.photo_reference || lead.photo_references?.length)) score += 10;
  if (websiteAssessment.signals?.some((signal) => /menu|content/i.test(signal))) score += 8;
  if (websiteAssessment.signals?.some((signal) => /conversion|reservation|contact/i.test(signal))) score += 8;
  return clamp(score);
}

function classifyLeadType({ websiteUrl, websiteAssessment, websiteOpportunity }) {
  if (!websiteUrl) return LEAD_TYPES.NO_WEBSITE;
  if (websiteAssessment.quality === 'good' && websiteOpportunity < 50) return LEAD_TYPES.GOOD_WEBSITE;
  if (['bad', 'weak'].includes(websiteAssessment.quality)) return LEAD_TYPES.BAD_WEBSITE;
  return LEAD_TYPES.UNKNOWN;
}

function qualificationGrade({ scores, weightedScore, leadType }) {
  if (scores.contactability < 35) return 'D';
  if (leadType === LEAD_TYPES.GOOD_WEBSITE && scores.websiteOpportunity < 45) return weightedScore >= 80 ? 'C' : 'D';
  if (leadType === LEAD_TYPES.NO_WEBSITE && weightedScore >= 68 && scores.buildFeasibility >= 65 && scores.contactability >= 50) return 'A';
  if (leadType === LEAD_TYPES.BAD_WEBSITE && weightedScore >= 74 && scores.buildFeasibility >= 70 && scores.contactability >= 50) return 'A';
  if (weightedScore >= 78 && scores.buildFeasibility >= 65) return 'A';
  if (weightedScore >= 62) return 'B';
  if (weightedScore >= 45) return 'C';
  return 'D';
}

function recommendedActionFor({ qualification, leadType, scores }) {
  if (qualification === 'D') return RECOMMENDED_ACTIONS.SKIP;
  if (qualification === 'C') return RECOMMENDED_ACTIONS.OUTREACH_ONLY;
  if (qualification === 'B') return RECOMMENDED_ACTIONS.COLLECT_MORE;
  if (leadType === LEAD_TYPES.NO_WEBSITE) return RECOMMENDED_ACTIONS.BUILD_STARTER;
  if (leadType === LEAD_TYPES.BAD_WEBSITE) return RECOMMENDED_ACTIONS.BUILD_REDESIGN;
  if (scores.websiteOpportunity >= 70) return RECOMMENDED_ACTIONS.BUILD_REDESIGN;
  return RECOMMENDED_ACTIONS.MANUAL_REVIEW;
}

function reasonsFor({ lead, websiteUrl, websiteAssessment, scores, leadType }) {
  const reasons = [];
  if (lead.phone) reasons.push('Phone exists, so the lead is contactable.');
  if (websiteAssessment.email) reasons.push('Email found on website.');
  if (!websiteUrl) reasons.push('No website listed on Google Places.');
  if (websiteUrl) reasons.push('Official website exists and can be assessed.');
  if (lead.rating >= 4.5 && lead.review_count >= 250) reasons.push('Strong Google rating and review count.');
  if (lead.photo_references?.length || lead.photo_reference) reasons.push('Google Places provides photo references.');
  if (leadType === LEAD_TYPES.BAD_WEBSITE) reasons.push('Existing website looks like a redesign opportunity.');
  if (scores.buildFeasibility >= 70) reasons.push('Enough public information exists to build a truthful preview.');
  for (const issue of websiteAssessment.issues || []) reasons.push(`Website issue: ${issue}.`);
  return reasons;
}

function blockersFor({ lead, scores }) {
  const blockers = [];
  if (!lead.phone && !lead.website && !lead.google_maps_url) blockers.push('No reliable contact path.');
  if (scores.businessValue < 45) blockers.push('Low public demand signal from rating/reviews.');
  if (scores.buildFeasibility < 45) blockers.push('Not enough verified information for a truthful preview.');
  return blockers;
}

function nextStepsFor({ leadType, recommendedAction, websiteUrl }) {
  if (recommendedAction === RECOMMENDED_ACTIONS.BUILD_STARTER) {
    return [
      'Collect Google Places photos and any social/contact links.',
      'Create a lightweight starter preview with phone/map/contact CTA.',
      'Prepare outreach around missing website presence.',
    ];
  }
  if (recommendedAction === RECOMMENDED_ACTIONS.BUILD_REDESIGN) {
    return [
      'Scrape official website and brand assets.',
      'Build redesign preview on dev.',
      'Prepare before/after screenshots and scroll demo.',
    ];
  }
  if (recommendedAction === RECOMMENDED_ACTIONS.COLLECT_MORE) {
    return [
      websiteUrl ? 'Inspect the official website more deeply.' : 'Search web/social profiles for contact and assets.',
      'Confirm email/contact path before building a preview.',
    ];
  }
  if (recommendedAction === RECOMMENDED_ACTIONS.OUTREACH_ONLY) {
    return ['Do not build yet; send or make a lightweight manual contact attempt first.'];
  }
  return ['Skip or keep for later manual review.'];
}

function readLead(filePath, leadIndex = 0) {
  if (!filePath) return null;
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return Array.isArray(raw) ? raw[Number(leadIndex || 0)] : raw;
}

function readJsonIfExists(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function cleanUrl(value) {
  return String(value || '').trim();
}

function slugify(value) {
  return String(value || 'unknown')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'unknown';
}

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}
