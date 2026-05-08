const STATUS_LABELS = {
  configured: 'Configured',
  partial: 'Partial',
  missing: 'Missing',
  optional: 'Optional',
};

export function loadAdminSettingsIndex(env = process.env) {
  const sections = [
    buildOpsSection(env),
    buildOpenDesignSection(env),
    buildTransactionalEmailSection(env),
    buildColdOutreachSection(env),
    buildPaymentsSection(env),
    buildMediaSection(env),
    buildResearchSection(env),
    buildDomainSection(env),
    buildLocalAiSection(env),
  ];

  const counts = sections.reduce((acc, section) => {
    acc.total += section.items.length;
    for (const item of section.items) {
      acc[item.status] = (acc[item.status] || 0) + 1;
    }
    return acc;
  }, { total: 0, configured: 0, partial: 0, missing: 0, optional: 0 });

  const blockers = sections.flatMap((section) =>
    section.items
      .filter((item) => item.required && item.status !== 'configured')
      .map((item) => ({
        section: section.title,
        label: item.label,
        status: item.status,
        reason: item.reason,
      })),
  );

  return {
    sections,
    counts,
    blockers,
    updatedAt: new Date().toISOString(),
  };
}

function buildOpsSection(env) {
  return makeSection('Core ops', 'Internal routing, forum workspaces, and admin access.', [
    makeItem('Admin access token', env.ADMIN_ACCESS_TOKEN, {
      required: true,
      display: maskSecret(env.ADMIN_ACCESS_TOKEN),
      reason: 'Protects every /admin page.',
    }),
    makeItem('Website leads forum channel', env.WEBSITE_LEADS_DISCORD_CHANNEL_ID, {
      required: true,
      display: env.WEBSITE_LEADS_DISCORD_CHANNEL_ID || 'missing',
      reason: 'Holds pre-sale lead workspaces.',
    }),
    makeItem('Website projects forum channel', env.WEBSITE_PROJECTS_DISCORD_CHANNEL_ID, {
      required: true,
      display: env.WEBSITE_PROJECTS_DISCORD_CHANNEL_ID || 'missing',
      reason: 'Holds paid/review/live project workspaces.',
    }),
    makeItem('Website handoff bot token', env.WEBSITE_TASKS_DISCORD_BOT_TOKEN || env.DISCORD_BOT_TOKEN, {
      required: true,
      display: maskSecret(env.WEBSITE_TASKS_DISCORD_BOT_TOKEN || env.DISCORD_BOT_TOKEN),
      reason: 'Creates and updates Discord forum workspaces.',
    }),
    makeItem('Website agent mention', env.WEBSITE_AGENT_MENTION, {
      required: true,
      display: env.WEBSITE_AGENT_MENTION || 'missing',
      reason: 'Used when handing project work to the website agent.',
    }),
  ]);
}

function buildOpenDesignSection(env) {
  return makeSection('Open Design', 'Design runtime, shared workspace, and upgrade control.', [
    makeItem('Open Design root', env.OPEN_DESIGN_ROOT, {
      required: false,
      display: env.OPEN_DESIGN_ROOT || '/Users/matthew/Developer/open-design (default)',
      status: env.OPEN_DESIGN_ROOT ? 'configured' : 'optional',
      reason: 'Overrides the default local Open Design checkout path.',
    }),
    makeItem('Open Design data dir', env.OPEN_DESIGN_DATA_DIR, {
      required: false,
      display: env.OPEN_DESIGN_DATA_DIR || '/Users/matthew/Developer/open-design/.od (default)',
      status: env.OPEN_DESIGN_DATA_DIR ? 'configured' : 'optional',
      reason: 'Controls where shared projects and app state live.',
    }),
    makeItem('Open Design port', env.OPEN_DESIGN_PORT, {
      required: false,
      display: env.OPEN_DESIGN_PORT || '7466 (default)',
      status: env.OPEN_DESIGN_PORT ? 'configured' : 'optional',
      reason: 'Daemon/API port for headless design runs.',
    }),
    makeItem('Open Design mode', env.PROFITSLOCAL_OPEN_DESIGN_MODE, {
      required: false,
      display: env.PROFITSLOCAL_OPEN_DESIGN_MODE || 'isolated (default)',
      status: env.PROFITSLOCAL_OPEN_DESIGN_MODE ? 'configured' : 'optional',
      reason: 'Controls how project data dirs are resolved for runs.',
    }),
  ]);
}

function buildTransactionalEmailSection(env) {
  return makeSection('Transactional email', 'Workflow email for review, revision, live, and domain steps.', [
    makeItem('Resend API key', env.RESEND_API_KEY, {
      required: true,
      display: maskSecret(env.RESEND_API_KEY),
      reason: 'Sends review, revision, approval, and domain emails.',
    }),
    makeItem('From email', env.FROM_EMAIL, {
      required: true,
      display: env.FROM_EMAIL || 'missing',
      reason: 'Primary sender identity for customer-facing workflow email.',
    }),
    makeItem('Reply-to email', env.REPLY_TO_EMAIL, {
      required: false,
      display: env.REPLY_TO_EMAIL || 'not set',
      status: env.REPLY_TO_EMAIL ? 'configured' : 'optional',
      reason: 'Where direct human replies should land.',
    }),
  ]);
}

function buildColdOutreachSection(env) {
  return makeSection('Cold outreach', 'Provider-agnostic outreach layer; text-first, webhook-friendly.', [
    makeItem('Agentic email / outreach sender', env.AGENTIC_EMAIL_API_KEY || env.AGENTIC_EMAIL_TOKEN || '', {
      required: false,
      display: maskSecret(env.AGENTIC_EMAIL_API_KEY || env.AGENTIC_EMAIL_TOKEN || ''),
      status: env.AGENTIC_EMAIL_API_KEY || env.AGENTIC_EMAIL_TOKEN ? 'configured' : 'optional',
      reason: 'Future conversational or cold outreach sender.',
    }),
    makeItem('Instantly API token', env.INSTANTLY_API_KEY || env.INSTANTLY_TOKEN || '', {
      required: false,
      display: maskSecret(env.INSTANTLY_API_KEY || env.INSTANTLY_TOKEN || ''),
      status: env.INSTANTLY_API_KEY || env.INSTANTLY_TOKEN ? 'configured' : 'optional',
      reason: 'Future cold outreach sender + webhook provider.',
    }),
    makeItem('Smartlead API key', env.SMARTLEAD_API_KEY || '', {
      required: false,
      display: maskSecret(env.SMARTLEAD_API_KEY || ''),
      status: env.SMARTLEAD_API_KEY ? 'configured' : 'optional',
      reason: 'Future cold outreach sender + inbox workflow provider.',
    }),
  ]);
}

function buildPaymentsSection(env) {
  return makeSection('Checkout & billing', 'Payment collection and post-purchase workflow.', [
    makeItem('Stripe secret key', env.STRIPE_SECRET_KEY, {
      required: true,
      display: maskSecret(env.STRIPE_SECRET_KEY),
      reason: 'Creates checkout sessions and powers live payments.',
    }),
    makeItem('Stripe publishable key', env.STRIPE_PUBLISHABLE_KEY, {
      required: true,
      display: maskSecret(env.STRIPE_PUBLISHABLE_KEY),
      reason: 'Needed by the checkout surface.',
    }),
    makeItem('Stripe webhook secret', env.STRIPE_WEBHOOK_SECRET, {
      required: true,
      display: maskSecret(env.STRIPE_WEBHOOK_SECRET),
      reason: 'Verifies live Stripe events.',
    }),
    makeItem('Tally API key', env.TALLY_API_KEY, {
      required: false,
      display: maskSecret(env.TALLY_API_KEY),
      status: env.TALLY_API_KEY ? 'configured' : 'optional',
      reason: 'Optional; used when testing Tally-based form creation.',
    }),
  ]);
}

function buildMediaSection(env) {
  return makeSection('Media & uploads', 'Attachments, revision uploads, and asset hosting.', [
    makeItem('Cloudinary cloud name', env.CLOUDINARY_CLOUD_NAME, {
      required: true,
      display: env.CLOUDINARY_CLOUD_NAME || 'missing',
      reason: 'Stores uploaded revision and intake assets.',
    }),
    makeItem('Cloudinary API key', env.CLOUDINARY_API_KEY, {
      required: true,
      display: maskSecret(env.CLOUDINARY_API_KEY),
      reason: 'Required for upload API calls.',
    }),
    makeItem('Cloudinary API secret', env.CLOUDINARY_API_SECRET, {
      required: true,
      display: maskSecret(env.CLOUDINARY_API_SECRET),
      reason: 'Signs Cloudinary upload requests.',
    }),
    makeItem('Cloudinary upload preset', env.CLOUDINARY_UPLOAD_PRESET, {
      required: false,
      display: env.CLOUDINARY_UPLOAD_PRESET || 'not set',
      status: env.CLOUDINARY_UPLOAD_PRESET ? 'configured' : 'optional',
      reason: 'Optional preset for simpler upload flows.',
    }),
  ]);
}

function buildResearchSection(env) {
  return makeSection('Research & scrape', 'Lead discovery, website evidence, and menu extraction.', [
    makeItem('Google Places API key', env.GOOGLE_PLACES_API_KEY, {
      required: true,
      display: maskSecret(env.GOOGLE_PLACES_API_KEY),
      reason: 'Used for real business facts, photos, and map-grounded lead discovery.',
    }),
    makeItem('TinyFish API key', env.TINYFISH_API_KEY, {
      required: false,
      display: maskSecret(env.TINYFISH_API_KEY),
      status: env.TINYFISH_API_KEY ? 'configured' : 'optional',
      reason: 'Preferred low-cost search/fetch layer when available.',
    }),
    makeItem('Firecrawl API key', env.FIRECRAWL_API_KEY, {
      required: false,
      display: maskSecret(env.FIRECRAWL_API_KEY),
      status: env.FIRECRAWL_API_KEY ? 'configured' : 'optional',
      reason: 'Fallback/alternative scraping and parsing provider.',
    }),
  ]);
}

function buildDomainSection(env) {
  return makeSection('Domain & deploy', 'Client repo bootstrap, Pages deploy, and custom domain routing.', [
    makeItem('GitHub PAT', env.GH_PAT, {
      required: true,
      display: maskSecret(env.GH_PAT),
      reason: 'Bootstrap repos, secrets, and workflows.',
    }),
    makeItem('Cloudflare API token', env.CF_API_TOKEN, {
      required: true,
      display: maskSecret(env.CF_API_TOKEN),
      reason: 'Create Pages projects and domain DNS records.',
    }),
    makeItem('Cloudflare account ID', env.CF_ACCOUNT_ID, {
      required: true,
      display: env.CF_ACCOUNT_ID || 'missing',
      reason: 'Targets the correct Cloudflare account for Pages operations.',
    }),
    makeItem('Cloudflare zone ID', env.CF_ZONE_ID, {
      required: false,
      display: env.CF_ZONE_ID || 'not set',
      status: env.CF_ZONE_ID ? 'configured' : 'optional',
      reason: 'Optional helper for faster domain attach/inspect flows.',
    }),
    makeItem('ProfitsLocal root domain', env.PROFITSLOCAL_ROOT_DOMAIN, {
      required: false,
      display: env.PROFITSLOCAL_ROOT_DOMAIN || 'profitslocal.com (default)',
      status: env.PROFITSLOCAL_ROOT_DOMAIN ? 'configured' : 'optional',
      reason: 'Default root domain used for preview/live customer subdomains.',
    }),
  ]);
}

function buildLocalAiSection(env) {
  return makeSection('Local AI audit', 'Fallback review and content sanity pass before customer review.', [
    makeItem('Ollama model', env.OLLAMA_MODEL, {
      required: false,
      display: env.OLLAMA_MODEL || 'qwen3.5:9b (default)',
      status: env.OLLAMA_MODEL ? 'configured' : 'optional',
      reason: 'Used for local audit and low-cost validation.',
    }),
    makeItem('Ollama URL', env.OLLAMA_URL, {
      required: false,
      display: env.OLLAMA_URL || 'http://127.0.0.1:11434 (default)',
      status: env.OLLAMA_URL ? 'configured' : 'optional',
      reason: 'Endpoint for local model inference.',
    }),
  ]);
}

function makeSection(title, description, items) {
  return { title, description, items };
}

function makeItem(label, rawValue, options = {}) {
  const hasValue = Boolean(String(rawValue || '').trim());
  const required = options.required !== false;
  const status = options.status || (hasValue ? 'configured' : (required ? 'missing' : 'optional'));
  return {
    label,
    required,
    status,
    statusLabel: STATUS_LABELS[status] || status,
    display: options.display ?? (hasValue ? String(rawValue) : 'missing'),
    reason: options.reason || '',
  };
}

function maskSecret(value) {
  const str = String(value || '').trim();
  if (!str) return 'missing';
  if (str.length <= 8) return `${str.slice(0, 2)}***`;
  return `${str.slice(0, 4)}…${str.slice(-4)}`;
}
