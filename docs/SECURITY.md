# Security And Key Handling

Updated: 2026-05-10

## Local Secrets

Put live API keys in `.env.local`. This file is ignored by git and is loaded by local automation scripts before they read `process.env`.

```bash
npm run setup:local-env
npm run check:env -- --workflow funnel
```

Replace only the values needed for the workflow you are running. Do not paste raw tokens into shell commands, docs, GitHub commits, screenshots, or generated artifacts. `scripts/setup-local-env.js` prompts locally and writes `.env.local` with file mode `0600`.

## /admin/settings — Masked-Only Contract

`/admin/settings` is a checklist and copy helper for configuration. It is **read-only** for secrets.

Read sources, in order, with later sources overlaying earlier ones:

1. `.env`
2. `.env.local`
3. `.dev.vars` (Cloudflare Pages local dev)
4. runtime `process.env`

What the page does:

- Reports whether each required value is configured, missing, optional, or needs confirmation.
- Shows the source of a configured value (e.g. `.env.local`, `runtime`).
- Shows masked values such as `sk_t…1234`.
- Generates a copyable `.env` line when an operator types a replacement value.

What the page never does:

- Never writes secrets to disk or to a remote.
- Never renders raw secret values into HTML or JSON responses.
- Never persists operator-pasted values.
- Never mutates secrets through `/admin/action` or any other admin endpoint.

To apply a change, the operator copies the generated line into local `.env.local` or the deployment provider's environment variables, then restarts / redeploys the affected service.

Code: `src/pages/admin/settings.astro`. Admin gate: `functions/admin/_middleware.ts` + `ADMIN_ACCESS_TOKEN`. Cloudflare Access is preferred as the outer gate.

Verify:

```
npm run admin:test-settings-index
npm run check:env -- --workflow funnel
```

## Commit Rules

Never commit:

- `.env`, `.env.local`, `.env.production`, `.dev.vars`
- Raw Maps scraper dumps such as `results.full.json` (may contain review payloads and other private content)
- API responses or fixtures containing real tokens
- Private customer credentials
- Screenshots of dashboards that include unmasked secrets

OK to commit:

- Compact summaries, manifests, queue / report outputs
- QA screenshots that explain a decision
- Files under `public/admin-artifacts/` that support an operator flow
- Handoff evidence

If a generated artifact is very large or only useful for temporary debugging, keep it gitignored or move it to external artifact storage.

Prefer GitHub Secrets and Cloudflare Secrets for deployed automation. Run `npm run check:env -- --workflow <name>` before any paid workflow.

## Secret Scan

Run before staging broad generated output, and before any push that touches generated artifacts:

```bash
rg -n --hidden --glob '!node_modules/**' --glob '!.git/**' --glob '!dist/**' \
  '(sk-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|xox[baprs]-[0-9A-Za-z-]{20,})' .
```

Expected findings should be placeholders, docs examples, or already-known captured public HTML. Sanitize anything that is a real private token before staging.

## Raw Artifacts vs Compact Evidence

The repo is the home for compact evidence: summaries, manifests, public admin artifacts, handoff screenshots. Raw upstream payloads — full Maps scraper dumps, large model traces, full HTML captures with private payloads — stay outside the repo:

- Keep them gitignored, or
- Move them to external artifact storage, or
- Replace with a compact summary before committing.

`results.full.json` is the canonical example: ignored on purpose because it can include review payloads. Commit the derived summary, queue, report, or hard evidence instead.

## Paid Workflow Validation

Before a workflow can spend money or create revenue, record the provider, unit price, and campaign in the finance ledger. Use dry-run mode first when a script supports it.

Current paid / revenue workflows:

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
