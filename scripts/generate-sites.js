#!/usr/bin/env node
/**
 * Generate client sites from scraped leads
 * Usage: node scripts/generate-sites.js --leads leads-restaurant-miami.json --template webjuice-restaurant
 *
 * For each lead:
 *   1. Creates repo from template
 *   2. Auto-fills brand config with scraped data
 *   3. Creates Pages projects
 *   4. Outputs preview URLs for cold outreach
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const GH_PAT = process.env.GH_PAT;
const CF_TOKEN = process.env.CF_API_TOKEN;
const CF_ACCOUNT = process.env.CF_ACCOUNT_ID;
const GH_OWNER = process.env.GH_OWNER || 'matthew6688';

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i += 2) {
    parsed[args[i].replace(/^--/, '')] = args[i + 1];
  }
  return parsed;
}

async function githubRequest(path, opts = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...opts,
    headers: {
      Authorization: `token ${GH_PAT}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github.v3+json',
      ...opts.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${JSON.stringify(data)}`);
  }
  return data;
}

async function cfRequest(path, opts = {}) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...opts,
    headers: {
      'X-Auth-Email': process.env.CF_EMAIL || 'matthew6688@gmail.com',
      'X-Auth-Key': CF_TOKEN,
      'Content-Type': 'application/json',
      ...opts.headers,
    },
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(`Cloudflare API error: ${JSON.stringify(data.errors)}`);
  }
  return data.result;
}

function slugify(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);
}

function jsString(value) {
  return JSON.stringify(value ?? '');
}

function generateSiteConfig(lead) {
  const slug = slugify(lead.name);
  return {
    name: lead.name,
    tagline: `Professional ${lead.niche} in ${lead.city}`,
    description: `${lead.name} - ${lead.niche} in ${lead.city}. Rated ${lead.rating}/5 with ${lead.review_count} reviews.`,
    email: lead.phone ? `contact@${slug}.com` : 'hello@example.com',
    domain: `${slug}.webjuice.fengtalk.ai`,
    fromName: lead.name,
    address: lead.address,
    phone: lead.phone,
    website: lead.website,
    rating: lead.rating,
    review_count: lead.review_count,
    hours: lead.hours,
  };
}

async function createClientSite(lead, templateRepo) {
  const config = generateSiteConfig(lead);
  const slug = slugify(lead.name) + '-' + lead.niche;
  const repoFullName = `${GH_OWNER}/${slug}`;
  
  console.log(`\n[${lead.name}]`);
  
  try {
    // 1. Generate repo from template
    console.log('  Creating repo...');
    const repo = await githubRequest(`/repos/${templateRepo}/generate`, {
      method: 'POST',
      body: JSON.stringify({
        owner: GH_OWNER,
        name: slug,
        description: `Website for ${lead.name}`,
        private: false,
      }),
    });
    
    // 2. Update site config
    console.log('  Updating config...');
    const siteConfig = `export interface SiteConfig {
  name: string;
  tagline: string;
  description: string;
  email: string;
  domain: string;
  fromName: string;
  address?: string;
  phone?: string;
  rating?: number;
  review_count?: number;
  navLinks: { label: string; href: string }[];
  footer: { text: string };
}

export const siteConfig: SiteConfig = {
  name: ${jsString(config.name)},
  tagline: ${jsString(config.tagline)},
  description: ${jsString(config.description)},
  email: ${jsString(config.email)},
  domain: ${jsString(config.domain)},
  fromName: ${jsString(config.fromName)},
  address: ${jsString(config.address || '')},
  phone: ${jsString(config.phone || '')},
  rating: ${config.rating || 'null'},
  review_count: ${config.review_count || 0},
  navLinks: [
    { label: 'Home', href: '/' },
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' },
  ],
  footer: {
    text: ${jsString(`${config.name} - ${config.address ? config.address.split(',')[0] : lead.city}`)},
  },
};
`;
    
    const fileData = await githubRequest(`/repos/${repoFullName}/contents/src/config/site.ts`);
    await githubRequest(`/repos/${repoFullName}/contents/src/config/site.ts`, {
      method: 'PUT',
      body: JSON.stringify({
        message: 'config: auto-fill from scraped lead data',
        content: Buffer.from(siteConfig).toString('base64'),
        sha: fileData.sha,
        branch: 'main',
      }),
    });
    
    // 3. Create dev branch
    try {
      const ref = await githubRequest(`/repos/${repoFullName}/git/ref/heads/main`);
      await githubRequest(`/repos/${repoFullName}/git/refs`, {
        method: 'POST',
        body: JSON.stringify({ ref: 'refs/heads/dev', sha: ref.object.sha }),
      });
    } catch (e) {
      // dev branch might already exist
    }
    
    // 4. Create Pages projects
    try {
      await cfRequest(`/accounts/${CF_ACCOUNT}/pages/projects`, {
        method: 'POST',
        body: JSON.stringify({ name: `${slug}-live`, production_branch: 'main' }),
      });
      await cfRequest(`/accounts/${CF_ACCOUNT}/pages/projects`, {
        method: 'POST',
        body: JSON.stringify({ name: `${slug}-dev`, production_branch: 'dev' }),
      });
    } catch (e) {
      console.log(`  Pages projects might already exist`);
    }
    
    // 5. Set GitHub Secrets (if pynacl is available)
    try {
      const secretsScript = path.join(__dirname, 'setup-github-secrets.js');
      if (fs.existsSync(secretsScript)) {
        execSync(`node "${secretsScript}" "${repoFullName}" CLOUDFLARE_API_TOKEN "${CF_TOKEN}"`, {
          stdio: 'pipe',
          env: { ...process.env, GH_PAT },
        });
        execSync(`node "${secretsScript}" "${repoFullName}" CLOUDFLARE_ACCOUNT_ID "${CF_ACCOUNT}"`, {
          stdio: 'pipe',
          env: { ...process.env, GH_PAT },
        });
        console.log('  Secrets set');
      }
    } catch (e) {
      console.log('  Secrets need manual setup (tweetnacl not available. Run: npm install tweetnacl)');
    }
    
    return {
      name: lead.name,
      slug,
      repo: repo.html_url,
      preview: `https://${slug}-dev.pages.dev`,
      live: `https://${slug}-live.pages.dev`,
      email: config.email,
      config,
    };
  } catch (e) {
    console.error(`  FAILED: ${e.message}`);
    return null;
  }
}

async function main() {
  const args = parseArgs();
  const { leads: leadsFile, template = 'matthew6688/webjuice-restaurant' } = args;
  
  if (!leadsFile) {
    console.error('Usage: node scripts/generate-sites.js --leads leads-restaurant-miami.json [--template matthew6688/webjuice-restaurant]');
    process.exit(1);
  }
  
  if (!GH_PAT || !CF_TOKEN || !CF_ACCOUNT) {
    console.error('Missing env vars: GH_PAT, CF_API_TOKEN, CF_ACCOUNT_ID');
    process.exit(1);
  }
  
  const leads = JSON.parse(fs.readFileSync(leadsFile, 'utf-8'));
  console.log(`Generating sites for ${leads.length} leads...`);
  console.log(`Template: ${template}`);
  
  const results = [];
  for (const lead of leads) {
    const result = await createClientSite(lead, template);
    if (result) results.push(result);
    // Rate limit friendly
    await new Promise(r => setTimeout(r, 1000));
  }
  
  // Save outreach list
  const outreachPath = leadsFile.replace('.json', '-outreach.json');
  fs.writeFileSync(outreachPath, JSON.stringify(results, null, 2));
  
  console.log(`\n=== Done ===`);
  console.log(`Created ${results.length}/${leads.length} sites`);
  console.log(`Outreach list: ${outreachPath}`);
  console.log('\nPreview URLs:');
  for (const r of results) {
    console.log(`  ${r.name}: ${r.preview}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
