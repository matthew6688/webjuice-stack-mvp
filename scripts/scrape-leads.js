#!/usr/bin/env node
/**
 * Scrape leads from Google Places API
 * Usage: node scripts/scrape-leads.js --niche restaurant --city "Miami, FL" --count 20
 *
 * Requires: GOOGLE_PLACES_API_KEY env var
 * Get key: https://console.cloud.google.com/apis/credentials
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
if (!API_KEY) {
  console.error('Error: GOOGLE_PLACES_API_KEY not set');
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    parsed[key] = args[i + 1];
  }
  return parsed;
}

async function searchPlaces(query, count = 20) {
  // Step 1: Text Search
  const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${API_KEY}`;
  const searchRes = await fetch(searchUrl);
  const searchData = await searchRes.json();
  
  if (searchData.status !== 'OK') {
    throw new Error(`Places API error: ${searchData.status} - ${searchData.error_message || ''}`);
  }
  
  const results = searchData.results.slice(0, count);
  
  // Step 2: Get details for each place
  const leads = [];
  for (const place of results) {
    try {
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,photos,opening_hours,types&key=${API_KEY}`;
      const detailsRes = await fetch(detailsUrl);
      const details = await detailsRes.json();
      
      if (details.status === 'OK') {
        const d = details.result;
        leads.push({
          place_id: place.place_id,
          name: d.name,
          address: d.formatted_address,
          phone: d.formatted_phone_number || null,
          website: d.website || null,
          rating: d.rating || null,
          review_count: d.user_ratings_total || 0,
          types: d.types || [],
          hours: d.opening_hours?.weekday_text || null,
          photo_reference: d.photos?.[0]?.photo_reference || null,
          niche: parsed.niche,
          city: parsed.city,
          scraped_at: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.error(`  Error fetching details for ${place.name}: ${e.message}`);
    }
  }
  
  return leads;
}

async function main() {
  global.parsed = parseArgs();
  const { niche, city, count = 20 } = parsed;
  
  if (!niche || !city) {
    console.error('Usage: node scripts/scrape-leads.js --niche restaurant --city "Miami, FL" --count 20');
    process.exit(1);
  }
  
  const query = `${niche} in ${city}`;
  console.log(`Scraping: ${query}`);
  
  const leads = await searchPlaces(query, parseInt(count));
  
  // Save to leads.json
  const fs = require('fs');
  const outputPath = `leads-${niche}-${city.toLowerCase().replace(/[^a-z0-9]/g, '-')}.json`;
  fs.writeFileSync(outputPath, JSON.stringify(leads, null, 2));
  
  console.log(`\nScraped ${leads.length} leads`);
  console.log(`Saved to: ${outputPath}`);
  console.log('\nSample:');
  if (leads.length > 0) {
    const sample = leads[0];
    console.log(`  ${sample.name}`);
    console.log(`  ${sample.address}`);
    console.log(`  ${sample.phone || 'No phone'}`);
    console.log(`  ${sample.website || 'No website'}`);
    console.log(`  Rating: ${sample.rating} (${sample.review_count} reviews)`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
