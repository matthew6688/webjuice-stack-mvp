# ProfitsLocal Operating Rules

Updated: 2026-05-06

## Product Boundary

ProfitsLocal's fixed-price packages are for one-page local business websites. The default product is designed for restaurants, cafes, local services, retail shops, wellness businesses, and similar local operators that need a clear online presence rather than a custom software project.

Included by default:

- one-page responsive website
- business facts, service/menu/product sections, trust cues, location/contact section, and a simple contact form
- basic site copy and page structure based on the customer's submitted information
- hosting on ProfitsLocal infrastructure
- fixed revision allowance attached to the package

Not included by default:

- multi-page websites
- apps, dashboards, decks, portals, login systems, booking systems, databases, custom CMS, or complex integrations
- live consulting or open-ended design direction calls
- full redesigns after the first version has been generated
- custom sender-domain email setup

Custom builds, multi-page sites, and work that requires live consulting generally start at `$1000+` and should be quoted separately.

## Customer Data Ownership

GitHub is the delivery and automation source of truth, not the customer CRM and not the long-term raw asset store.

GitHub stores:

- order IDs, client slugs, packages, status, readiness, and revision history
- approved business facts and approved site copy
- website source code and build/deploy artifacts
- Cloudinary asset references and file summaries

GitHub should not store:

- raw customer uploads as long-term source files
- payment card data
- unnecessary private lead messages
- DNS account credentials or customer mailbox credentials

Cloudinary is the v1 asset store. If Cloudinary becomes expensive or insufficient, migrate asset storage to Cloudflare R2 or S3 while keeping GitHub records as references.

Current implementation:

- `/api/contact`, `/api/create-checkout-session`, and `/api/intake-submit` upload attachments to Cloudinary when `CLOUDINARY_*` runtime secrets are configured.
- Checkout uploads also create a Cloudinary raw JSON manifest, then store `asset_manifest_url` and `asset_manifest_public_id` in Stripe metadata so the paid intake can recover asset references after payment.
- `/api/intake-submit` sends Cloudinary asset references through `record-paid-intake.yml`, and `data/paid-intakes/*` stores them under `intake.assets`.
- If Cloudinary is not configured, the site falls back to internal Resend attachments so submissions are not lost. Production should configure Cloudinary to avoid relying on email as file storage.

Recommended Cloudinary folder shape:

```text
profitslocal/
  clients/
    <client_slug>/
      intake/
      revisions/
      approved/
      source/
```

Asset metadata should include:

- `order_id`
- `client_slug`
- `submission_type`: `intake` or `revision`
- `revision_number`, when applicable
- `uploaded_by_email`
- `original_filename`

## Paid Intake Visibility

Current source of truth:

```text
data/paid-intakes/<client_slug>/<order_id>.json
data/paid-intakes/<client_slug>/<order_id>-timeline.jsonl
```

The dashboard should expose this as:

```text
/admin/intakes
```

Required dashboard fields:

- customer name, checkout email, lead recipient email, package, amount, and order ID
- readiness status and missing information
- uploaded assets and Cloudinary references
- latest timeline entries
- linked case and Discord thread
- actions: request more info, draft customer email, send customer email, mark ready, generate first version

Current implementation:

- `/admin/intakes` is a build-time internal index generated from `data/paid-intakes`.
- `/admin/intakes/<client_slug>/<order_id>` is a build-time detail page with intake content, assets, latest revision, timeline, and operator actions.
- It shows status counts, readiness, missing fields, Cloudinary asset count, lead recipient, revision count, and record path.
- `/admin/action` dispatches `record-paid-intake-action.yml`, which records operator actions back into the paid intake JSON and timeline.
- The dashboard is protected by `ADMIN_ACCESS_TOKEN`.

## Repo And Discord Thread Timing

Do not create a per-customer website repo for every casual lead.

Recommended timing:

1. Free brief or pre-purchase lead: keep in the central repo as a brief summary only.
2. Paid checkout: create paid intake record and internal case.
3. Paid intake created: create or link a Discord thread for internal operations.
4. Intake ready and customer confirms first version generation: create or bind the website repo and agent task.

The Discord thread is the operations room. Internal discussion, AI drafting, customer email approvals, Resend delivery/open/click events, and missing-info updates should all post back to the same thread.

## Discord-First Customer Communication

Goal:

```text
paid intake created
  -> Discord thread receives intake summary and missing fields
  -> operator discusses with AI in the thread
  -> AI drafts customer email
  -> operator approves or edits
  -> Resend sends the email
  -> Resend webhook posts delivered/opened/clicked/bounced events to the same thread
```

This keeps customer communication asynchronous and structured without forcing the operator into scattered inbox work.

Required future pieces:

- email-draft workflow from a paid intake/case
- send-email workflow that requires explicit operator approval
- Resend webhook endpoint
- email event to case/thread resolver
- Discord notification for delivered, opened, clicked, bounced, complained, and failed events

## First Version Generation

Before the first version, customers may submit the paid intake form multiple times. This does not consume a revision.

When readiness is complete, the customer must confirm:

- the information is enough to generate the first version
- the package is for a one-page website
- once the first version is generated, the order is no longer refundable
- major design direction changes after first version are custom quote territory

This confirmation freezes `brief_snapshot_v1`. Revisions after this point are measured against that snapshot and the generated first version.

## Readiness Rules

An intake can be marked ready when these are present:

- checkout email
- business name
- order id
- menu, services, products, or offers
- primary customer action
- address or service area
- lead recipient email for the customer site's contact form
- at least one file, reference website, current website, or preview URL
- customer confirmation to generate first version

Before customer confirmation, the status may be content-ready but not generation-ready:

- `intake_needs_more_info`: required content is missing.
- `intake_needs_generation_confirmation`: content is complete, but the customer has not confirmed generation/refund/scope.
- `intake_ready_for_review`: required content and first-version confirmation are both present.

## Revision Policy

Revision requests must be strict because the fixed price depends on structured, bounded changes.

A revision is:

- a set of edits to the current one-page version
- based on the current version and the frozen first-version brief
- clear enough for an agent to execute without a live consultation

A revision is not:

- a full redesign
- a new design direction
- a multi-page expansion
- a custom app/dashboard/deck request
- an unclear "make it better" note
- a new project disguised as edits

Revision flow:

```text
customer submits revision form
  -> AI checks scope and clarity
  -> unclear: ask customer to resubmit, do not consume revision
  -> out of scope: quote separately, do not consume revision
  -> clear and in scope: consume one revision and create revision task
```

The revision form must make the boundary clear and require the customer to confirm that the request uses one revision if accepted.

Current implementation:

- Customer revision entrypoint: `/revision`.
- API: `/api/revision-submit`.
- Recording workflow: `.github/workflows/record-paid-revision.yml`.
- Repo script: `scripts/funnel/record-paid-revision-update.js`.
- Revision records are appended to the existing paid intake JSON under `revisions`.
- Default included revision limits are 3 for `one_time` and 12 for `yearly_maintenance`.

## Refund Policy

Refund rule:

- Before first version generation starts: refundable.
- After first version is generated: non-refundable.

This must appear in FAQ, checkout, intake confirmation, and generation confirmation.

## Customer Website Contact Form

The default client-site contact form should stay simple:

- name
- email
- phone, optional
- message

Intake must ask:

```text
Where should this website send contact form leads?
```

If the customer does not provide a lead recipient email, use checkout email as fallback.

Default lead email delivery:

```text
from: ProfitsLocal Leads <leads@profitslocal.com>
reply-to: visitor email
to: customer's lead recipient email
```

Spam protection v1:

- honeypot field
- minimum submit time
- message length limits
- basic rate limiting where available
- optional Cloudflare Turnstile later

## Custom Sender Domain Add-On

Default sender domain is ProfitsLocal. Custom sender-domain setup is a paid add-on:

```text
Custom sender domain setup: $150
```

Included:

- DNS setup guidance
- Resend domain verification guidance
- SPF/DKIM/DMARC guidance
- test send verification

Not included by default:

- taking ownership of the customer's DNS account
- full mailbox migration
- ongoing email deliverability consulting

## Template And Style Library

Template/style selection is not required for the current paid intake flow. For now, intake should support a simple design direction choice:

- clean local professional
- warm neighborhood brand
- premium service business
- bold editorial
- practical information-first

Later, the dashboard or intake form can expose a ProfitsLocal template library or approved third-party design references.

## Implementation Priority

1. Public copy and FAQ: scope, refund, revision boundary, custom build pricing.
2. Intake form: lead recipient email and first-version confirmation fields.
3. Paid intake records: persist `leadDelivery` and confirmation fields.
4. Cloudinary upload path: implemented for contact, checkout, and paid intake with Resend fallback when Cloudinary is not configured.
5. Discord thread summary for paid intake.
6. Customer email HTML templates for all key lifecycle events.
7. Resend webhook to Discord thread.
8. Admin dashboard paid intake list/detail.
9. Generate-first-version workflow after readiness and customer confirmation.
10. Custom sender-domain add-on workflow.
