# ProfitsLocal Agentic Inbox

Updated: 2026-05-07

This document records the ProfitsLocal email inbox running on Cloudflare Agentic Inbox.

## Email Responsibility Model

ProfitsLocal uses two email systems with separate responsibilities:

| Email type | System | Current policy |
|---|---|---|
| Transactional and workflow email | Resend | Send automatically from project automation |
| Human/business inbox email | Agentic Inbox | Receive email, generate drafts, operator reviews and sends manually |

Transactional email includes payment receipts, revision receipts, review links, domain status updates, live publish notifications, internal lead notifications, and paid-intake asset notifications.

Agentic Inbox handles conversational email at `hi@profitslocal.com`. It may draft replies, but operators send manually for now.

## Production Setup

| Item | Value |
|---|---|
| Inbox app URL | `https://mail.profitslocal.com` |
| Mailbox address | `hi@profitslocal.com` |
| Cloudflare Worker | `agentic-inbox-profitslocal` |
| R2 bucket | `agentic-inbox` |
| Access team domain | `profitslocal.cloudflareaccess.com` |
| Auth method | Cloudflare Access one-time PIN |
| Allowed operators | `matthew6688@gmail.com`, `ringse2007@gmail.com` |

The old `workers.dev` app URL is not the primary operator URL. Use `https://mail.profitslocal.com`.

## Mail Routing

`hi@profitslocal.com` is routed through Cloudflare Email Routing to the `agentic-inbox-profitslocal` Worker.

Cloudflare created the required mail DNS records for `profitslocal.com`:

- MX records pointing at Cloudflare Email Routing.
- SPF TXT record including Cloudflare mail routing.
- DKIM TXT record under `cf2024-1._domainkey.profitslocal.com`.

Do not add another mail provider for `profitslocal.com` without reviewing these records first.

## Resend Sending

Resend is the source of truth for all transactional project email using the company domain.

| Item | Value |
|---|---|
| Resend account | `hi@profitslocal.com` |
| Resend domain | `profitslocal.com` |
| Resend domain id | `ffceba80-2a2c-4521-97cc-4a883f239717` |
| Default sender | `ProfitsLocal <hi@profitslocal.com>` |
| Internal notification recipient | `hi@profitslocal.com` |
| Verification status | Verified on 2026-05-07 |

This does not conflict with Agentic Inbox:

- Root MX records for `profitslocal.com` stay with Cloudflare Email Routing for inbound mail.
- Resend uses `send.profitslocal.com` for its bounce/SPF records.
- Resend DKIM uses `resend._domainkey.profitslocal.com`.
- DMARC is published at `_dmarc.profitslocal.com`.

Current DNS records added for sending:

```text
TXT resend._domainkey.profitslocal.com p=<Resend DKIM public key>
MX  send.profitslocal.com feedback-smtp.us-east-1.amazonses.com priority 10
TXT send.profitslocal.com v=spf1 include:amazonses.com ~all
TXT _dmarc.profitslocal.com v=DMARC1; p=none; rua=mailto:hi@profitslocal.com; fo=1; adkim=r; aspf=r; pct=100
```

`p=none` is an observation-mode DMARC policy. After a few weeks of clean sending and testing, consider moving to `p=quarantine`, then eventually `p=reject`.

Transactional email must use Resend, not Agentic Inbox. This keeps customer workflow email deterministic, logged, and tied to project automation.

## Transactional Email Templates

ProfitsLocal transactional emails use the shared HTML renderer in `core/funnel/email-template.js`.

Current template policy:

- Sender: `ProfitsLocal <hi@profitslocal.com>`.
- Logo: use the real source asset at `https://profitslocal.com/brand/logo-horizontal.svg`.
- Visible email copy must not expose naked long URLs.
- Long destinations belong behind CTA buttons or action chips such as `Complete intake`, `Review dev preview`, `Approve site`, `Request revision`, `Set up domain`, `Open live site`, and `Open asset`.
- Customer-facing copy must avoid internal automation language such as commits, file paths, workflow status, deploy checks, GitHub Actions, or Discord.
- Internal notifications may include operational metadata, but should still use the same branded template and concise next-step closing copy.

Resend Hosted Templates are allowed later if non-engineers need dashboard editing. Until then, the code renderer is the source of truth so workflow emails stay version-controlled and testable.

## Access Control

Cloudflare Access is the security boundary for the inbox UI and MCP endpoint. Anyone allowed by the Access policy can access all mailboxes in this Agentic Inbox deployment.

Current policy:

- App: `Agentic Inbox ProfitsLocal`
- Decision: allow
- Included emails:
  - `matthew6688@gmail.com`
  - `ringse2007@gmail.com`

If an operator needs access, add their email to this Access policy. Do not share Cloudflare API keys or one-time PIN emails.

## AI Draft Behavior

The upstream Cloudflare Agentic Inbox app automatically triggers the AI agent when a new email arrives.

Current ProfitsLocal policy:

- The agent reads the new email and available thread context.
- It creates a draft reply in the Drafts folder.
- It does not send the email automatically.
- An operator must review and send the draft manually.
- Agentic Inbox should not send transactional workflow email.

This default behavior consumes Cloudflare Workers AI usage for inbound emails. High spam volume can create avoidable AI cost because each received email may trigger prompt-injection checks, draft generation, and draft verification.

If cost control becomes important, add a code-level setting such as `autoDraft.enabled` and skip the `/onNewEmail` agent trigger when disabled.

## Future Agentic Auto-Reply Plan

Automatic Agentic replies are feasible, but should be introduced gradually.

Phase 1, current:

- Auto-draft only.
- Human review required before sending.

Phase 2, low-risk auto-replies:

- Add an explicit `autoSend.enabled=false` default.
- Allow automatic replies only for receipt-style messages such as "we received your email and will reply soon".
- Log every auto-send to Discord or the case timeline.

Phase 3, knowledge-based replies:

- Add an R2-backed Markdown FAQ or knowledge base.
- Add a `search_knowledge_base` tool for the agent.
- Allow auto-send only when the answer is found in approved knowledge base content.

Phase 4, risk-based routing:

- Low risk: auto-send.
- Medium risk: draft only.
- High risk: no draft; flag for operator review.

High-risk categories must remain human-reviewed: pricing exceptions, refunds, complaints, legal/security issues, domain/DNS changes, deliverability issues, account access, and anything involving customer credentials or irreversible actions.

## Knowledge Base

The current lightweight knowledge base is the mailbox-level AI Agent Prompt in the Settings page.

Recommended starter prompt:

```text
You are replying for Profits Local.

Business:
Profits Local helps local restaurants and service businesses improve Google Maps presence, local SEO, reviews, and lead conversion.

FAQ:
Pricing: Tell prospects we offer custom packages after reviewing their business and location.
Service area: We work with local businesses in Australia and can support remote clients.
Call booking: Invite interested prospects to reply with their website, Google Business Profile link, and preferred call times.
Tone: concise, warm, helpful, not pushy.

Never promise guaranteed rankings. If unsure, ask for more details instead of inventing.
```

For a larger FAQ, build a small R2-backed Markdown knowledge base and add a `search_knowledge_base` tool to the agent. That is better than putting long documents into the system prompt.

## Operational Checklist

When changing the inbox:

1. Confirm `https://mail.profitslocal.com` still redirects to Cloudflare Access.
2. Confirm `hi@profitslocal.com` still routes to `agentic-inbox-profitslocal`.
3. Send a test email from Gmail and Outlook.
4. Confirm the email appears in Inbox.
5. Confirm the AI draft appears in Drafts.
6. Send a reviewed reply and check whether it lands in Inbox or spam.
7. Send a Resend test email from `ProfitsLocal <hi@profitslocal.com>` and inspect Gmail/Outlook authentication headers.

## Secret Handling

Cloudflare API tokens used during setup are not runtime dependencies for the inbox. Revoke or rotate exposed tokens after setup or maintenance.

Runtime secrets live in Cloudflare Worker secrets:

- `POLICY_AUD`
- `TEAM_DOMAIN`
