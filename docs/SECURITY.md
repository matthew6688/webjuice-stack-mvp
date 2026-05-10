# Security And Key Handling

## Local Secrets

Put live API keys in `.env.local`. This file is ignored by git and is loaded by local automation scripts before they read `process.env`.

```bash
npm run setup:local-env
npm run check:env -- --workflow funnel
```

Then replace only the values needed for the workflow you are running. Do not paste raw tokens into shell commands, docs, GitHub commits, screenshots, or generated artifacts. The setup script prompts locally and writes `.env.local` with file mode `0600`.

## Admin Settings Checklist

`/admin/settings` is a checklist and copy helper for configuration, not a secret editor.

Local development checks these files, in order, before overlaying runtime environment variables:

1. `.env`
2. `.env.local`
3. `.dev.vars`
4. `process.env`

The page reports whether each required value is configured, missing, optional, or needs confirmation. It may show the source of a configured value, such as `.env.local`, and it may show masked values like `sk_t…1234`. It must never render raw secrets into the HTML.

When an operator types into a value field, the page only generates a copyable env line. To make the change take effect, write that line to local `.env.local` or to the deployed provider's environment variables, then restart/redeploy the relevant service.

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

## Agentic Inbox

The ProfitsLocal inbox is documented in `docs/AGENTIC_INBOX.md`.

Access is controlled by Cloudflare Access, not by per-mailbox authorization inside the app. Anyone in the Access allow policy can access the current mailbox and MCP endpoint.

Do not commit Cloudflare API tokens used for setup or maintenance. The deployed Worker only needs Cloudflare Worker secrets such as `POLICY_AUD` and `TEAM_DOMAIN`.

Resend API keys are runtime secrets. Keep `RESEND_API_KEY` in Cloudflare Pages secrets and GitHub Actions secrets only. The default sender is `ProfitsLocal <hi@profitslocal.com>`, and operational notifications should go to `hi@profitslocal.com`.

Transactional email must be sent through Resend. Agentic Inbox is allowed to draft conversational replies, but automatic sending from Agentic Inbox requires a separate review, allowlist, audit log, and kill switch before enabling.
