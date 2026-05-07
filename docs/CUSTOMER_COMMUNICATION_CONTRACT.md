# Customer Communication Contract

Updated: 2026-05-07

## Principle

Agents may draft customer-facing email copy, but sending should use fixed intents, fixed variables, and Resend.

Do not let agents freestyle transactional links.

## Standard Email Intents

| Intent | Purpose |
|---|---|
| `payment_receipt` | Confirm payment and explain next step. |
| `intake_confirmation` | Confirm received materials and what we will build. |
| `needs_more_info` | Ask for missing business-critical data. |
| `dev_preview_ready` | Send dev preview for customer review. |
| `revision_received` | Confirm revision request and quota usage. |
| `revision_ready` | Send updated dev preview after revision. |
| `approval_received` | Confirm approval and start publish/domain work. |
| `live_published` | Send live URL after publish. |
| `domain_setup` | Give DNS/domain setup instructions. |
| `domain_active` | Confirm domain is active. |
| `extra_revision_required` | Explain revision quota and link to extra revision checkout. |

## Required Variables

Every customer email payload should include:

```json
{
  "intent": "dev_preview_ready",
  "to": "customer@example.com",
  "clientSlug": "opa-bar-mezze-restaurant",
  "businessName": "Opa Bar & Mezze",
  "orderId": "cs_test_example",
  "previewUrl": "https://opa-bar-mezze-restaurant-dev.pages.dev/",
  "approveUrl": "https://profitslocal.com/approve?order_id=cs_test_example&email=customer%40example.com&client_slug=opa-bar-mezze-restaurant&repo=matthew6688%2Fopa-bar-mezze-restaurant&preview_url=https%3A%2F%2Fopa-bar-mezze-restaurant-dev.pages.dev%2F",
  "reviseUrl": "https://profitslocal.com/revision?order_id=cs_test_example&email=customer%40example.com&client_slug=opa-bar-mezze-restaurant&repo=matthew6688%2Fopa-bar-mezze-restaurant&preview_url=https%3A%2F%2Fopa-bar-mezze-restaurant-dev.pages.dev%2F",
  "domainSetupUrl": "https://profitslocal.com/domain-setup?order_id=cs_test_example&email=customer%40example.com&client_slug=opa-bar-mezze-restaurant&repo=matthew6688%2Fopa-bar-mezze-restaurant&preview_url=https%3A%2F%2Fopa-bar-mezze-restaurant-dev.pages.dev%2F",
  "liveUrl": "",
  "extraRevisionUrl": "https://profitslocal.com/checkout?tier=extra_revision&order_id=cs_test_example&email=customer%40example.com&client_slug=opa-bar-mezze-restaurant",
  "internalDiscordThreadId": "1501197070319616011"
}
```

`internalDiscordThreadId` is for case memory only. Do not show Discord links to customers.

## Discord Discussion Pattern

Use this pattern in the project thread:

```text
Draft customer email for intent=dev_preview_ready.
Use case/order variables.
Include preview, approve, revise, and domain setup links.
Do not send yet.
```

Then:

```text
Operator approves draft
-> send via Resend customer email runner
-> record Resend email ID
-> append case timeline
-> post summary back to Discord thread
```

## Future HTML Templates

HTML branding should live in one central module and reuse the same intent variables.

## HTML Brand Template Requirements

All transactional emails should use the ProfitsLocal visual language from `profitslocal.com`:

- cream paper background;
- black bordered card;
- coral primary CTA;
- mint highlight only for important status/plan blocks;
- ProfitsLocal wordmark or text logo at top;
- short plain-language subject;
- one primary CTA button when the intent has a next action;
- all support links point to official `https://profitslocal.com` pages;
- no Discord links or internal file paths visible to customers.

Minimum HTML sections:

```text
preheader
header / ProfitsLocal mark
headline
short intro
key details table
primary CTA
secondary links
support note
footer with order id and reply guidance
```

## Email Intent Link Rules

| Intent | Primary CTA |
|---|---|
| `payment_receipt` | Official intake or preview link, depending on order type. |
| `intake_confirmation` | Preview expectation or missing-info form. |
| `needs_more_info` | Official intake/contact form. |
| `dev_preview_ready` | Preview URL, with approve/revision/domain links as secondary actions. |
| `revision_received` | Official revision URL or preview URL. |
| `revision_ready` | Preview URL. |
| `approval_received` | Domain setup URL. |
| `live_published` | Live URL. |
| `domain_setup` | Official domain setup/status URL. |
| `domain_active` | Live URL. |
| `extra_revision_required` | Official checkout URL with `tier=extra_revision`. |

Never send customer links on the customer preview domain for `/approve`, `/revision`, `/revise`, `/domain-setup`, `/domain-help`, `/checkout`, or `/thank-you`.
