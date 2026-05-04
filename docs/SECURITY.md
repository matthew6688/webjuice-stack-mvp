# Security And Key Handling

## Local Secrets

Put live API keys in `.env.local`. This file is ignored by git and is loaded by local automation scripts before they read `process.env`.

```bash
cp .env.example .env.local
```

Then replace only the values needed for the workflow you are running.

## Rules

- Never commit `.env`, `.env.local`, screenshots of dashboards, or API keys.
- Prefer GitHub Secrets and Cloudflare Secrets for deployed automation.
- Use `npm run check:env -- --workflow <name>` before running a paid workflow.
- Run the secret scan from the validation checklist before committing.

## Paid Workflow Validation

Before a workflow can spend money or create revenue, record the provider, unit price, and campaign in the finance ledger. Use dry-run mode first when a script supports it.

Current paid/revenue workflows:

- Google Places / Firecrawl / OpenAI extraction and design
- Tally payment collection
- Cloudflare deployment
- Resend outreach
