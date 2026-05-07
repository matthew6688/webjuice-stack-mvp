# Core Business Flow SOP

Updated: 2026-05-07

## Purpose

This is the plain-English operating manual for the ProfitsLocal website business loop.

The goal is simple:

```text
Find or receive a business lead
  -> collect enough real information
  -> create an Open Design project
  -> build a real dev preview
  -> show proof to the customer
  -> get paid
  -> revise or approve
  -> publish live
  -> set up domain
  -> record revenue, cost, and project history
```

This SOP is the source of truth for stage names, required inputs, outputs, validation, and where to check status.

## Hard Rules

- Every website project must have an Open Design project.
- Every website project must have a Discord website task thread.
- Every website project must have repo-backed memory. Do not rely on chat memory.
- Every website project must have one current project capsule, one current Open Design binding, and one current customer repo `dev` branch. If these disagree, stop and sync before doing new work.
- Customer website repos only contain the customer website and preview banner. ProfitsLocal checkout/revision/domain pages live on `profitslocal.com`.
- Business facts come from evidence, survey, and content files. Open Design can improve presentation, but it cannot invent core business facts.
- Customer-facing email links must point to official `https://profitslocal.com` funnel pages.
- Work happens on the customer repo `dev` branch until customer approval.
- Publish to `main/live` only after approval.

## Project Sync Protocol

This is the rule that prevents Discord, Open Design, and the customer repo from drifting apart.

### Source Of Truth By Topic

| Topic | Source Of Truth | Notes |
|---|---|---|
| Customer/business facts | Evidence, survey, content files | Name, phone, address, menu/services, booking, contact, sitemap facts. |
| Visual concept | Open Design project | Layout direction, visual hierarchy, art direction, typography exploration, first design intent. |
| Production website | Customer repo `dev` branch | The real deployable Astro/Webjuice implementation. |
| Project conversation and decisions | Discord website task thread + case timeline | Internal discussion, approvals, revision notes, customer communication records. |
| Customer-facing funnel | `profitslocal.com` | Checkout, approval, revision, domain setup, contact, FAQ. |

### Before Any Work Starts

1. Find the client slug and case folder.
2. Open the Discord website task thread.
3. Check `clients/<client>/concept/open-design/concept-manifest.json`.
4. Check the customer repo and current branch.
5. Check the latest case timeline/agent run.
6. Decide whether the work is a visual concept change, a production implementation change, or a business-fact correction.

If the Open Design manifest, Discord thread, and repo point to different clients or different projects, do not continue. Fix the binding first.

### If The Change Starts In Discord

Use this when Matthew or an agent gives instructions in the project thread.

1. Agent reads the task packet and case memory.
2. Agent confirms the existing Open Design project ID from the task packet.
3. If the request changes visual design, run Open Design continuation on the existing project. Do not create a new Open Design project.
4. Export/sync the updated concept back into `clients/<client>/concept/open-design/`.
5. Rebuild `production-handoff.json` and `production-handoff.md`.
6. Port the accepted changes into the customer repo `dev` branch.
7. Run build and QA.
8. Post back to the same Discord thread with:
   - what changed;
   - Open Design run/project ID;
   - repo branch and commit/diff summary;
   - preview URL;
   - QA result path;
   - whether customer email is ready.

Validation before marking done:

- Same Discord thread ID is reused.
- Same Open Design project ID is reused.
- Customer repo is on `dev`.
- Production handoff timestamp is newer than the Discord request.
- QA result exists after the repo change.

### If The Change Starts In Open Design Desktop App

Use this when Matthew visually edits the project in Open Design.

1. Make sure the Open Design app project name matches the client/business.
2. Save or finish the Open Design change.
3. Run `npm run open-design:sync-from-app -- --client <client>`.
4. Rebuild production handoff.
5. Ask `website-agent` in the same Discord thread to port the synced handoff into the customer repo `dev` branch.
6. Run build and QA.
7. Post the updated preview and QA result in the same Discord thread.

Validation before marking done:

- `.profitslocal-sync.json` in the Open Design project points to the same client slug.
- `concept-manifest.json` has the same Open Design project ID Matthew edited.
- `production-handoff.json` exists and is newer than the manual edit.
- Customer repo `dev` contains the ported implementation.
- Preview URL shows the new design, not only the concept folder.

### If The Change Starts Directly In The Repo

Use this only for small production fixes, for example a typo, broken link, build issue, or banner bug.

1. Confirm the change does not alter the main visual direction.
2. Edit the customer repo `dev` branch.
3. Run build and QA.
4. Post the repo change back to Discord.
5. If the change affects reusable design direction, also update Open Design notes or production handoff so the concept memory does not become stale.

### Conflict Rule

If two tools changed the project at the same time, choose this order:

1. Business facts from evidence/survey/content win.
2. Customer-approved decisions in case timeline win.
3. Latest accepted Open Design production handoff wins for visual direction.
4. Customer repo `dev` wins for what is currently deployed.

When uncertain, stop and write a short Discord summary:

```text
Sync conflict found:
- Open Design says: ...
- Repo dev says: ...
- Case/customer decision says: ...
Recommended source to keep: ...
```

Do not email the customer until the conflict is resolved.

## Stage Overview

| Stage | Name | What This Stage Proves |
|---|---|---|
| 0 | Lead / Customer Intake | We know who the business is and why it may need a site. |
| 1 | Evidence Collection | We have real facts, links, photos, menu/services, and contact paths. |
| 2 | Website Ready Packet | The project is ready to build without guessing. |
| 3 | Open Design Project | A visual concept workspace exists for this exact business. |
| 4 | Production Dev Build | The concept and facts are ported into the customer Astro repo. |
| 5 | Dev Preview QA | The preview is real, mobile-friendly, factual, and sellable. |
| 6 | Outreach / Demo Proof | We have screenshots, demo video, and email material. |
| 7 | Checkout / Payment | Customer can claim the preview and payment maps to the right project. |
| 8 | Agent Task / Discord Work | Hermes/Open Design/Codex can continue work from one task packet. |
| 9 | Customer Review Email | Customer receives branded email with preview, approve, revision, and domain links. |
| 10 | Revision Loop | Revisions match order ID + email and consume quota correctly. |
| 11 | Approval / Publish Live | Approved dev version goes live safely. |
| 12 | Domain Setup | Free ProfitsLocal subdomain or customer domain is connected. |
| 13 | Finance / ROI Log | Revenue, provider usage, and customer state are recorded. |

## Stage 0: Lead / Customer Intake

### Goal

Decide whether this business is worth collecting and building.

### Inputs

- Google Places result, manual lead, official website URL, or customer form.
- Business name.
- Location or city.
- Niche, currently restaurant first.
- Existing website, if any.
- Contact path: phone, email, website contact form, booking page, or social.

### Outputs

- Lead record.
- Initial client slug.
- Qualification score or decision.
- Next action: collect more info, build preview, or skip.

### Validation

- Business name is not blank.
- At least one contact path exists.
- Business appears real and reachable.
- If the business has an existing website, we can plausibly redesign it better.

### Where To Check

- `clients/<client>/`
- lead/evidence docs under `docs/LEAD_QUALIFICATION_ENGINE.md`
- Discord thread if manually discussed.

## Stage 1: Evidence Collection

### Goal

Collect real, source-backed information before design or copywriting starts.

### Inputs

- Google Places API data.
- Google Maps photos.
- Official website pages.
- Menu/service pages.
- PDFs, images, scanned menus, product/service documents.
- Business-provided files.

### Outputs

- `clients/<client>/evidence/evidence.json`
- raw scrape/extraction artifacts when available.
- source URLs for facts and media.
- list of missing critical facts.

### Validation

- Business name, address, phone, website, maps link are captured when available.
- For restaurants, menu evidence is captured if menu work is needed.
- Photos are real business or venue/product photos when available.
- Source URLs or extraction notes exist for important facts.
- If evidence is incomplete, missing items are listed instead of guessed.

### Where To Check

- `clients/<client>/evidence/evidence.json`
- `clients/<client>/evidence/`
- `docs/COLLECT_SKILL_USAGE.md`
- `docs/COLLECT_GOOGLE_PLACES_SMOKE.md`

## Stage 2: Website Ready Packet

### Goal

Turn messy information into a build-ready packet that any tool can use.

### Inputs

- Evidence file.
- Website intake survey.
- Content artifact.
- Design/brand artifact.
- Customer notes, if this is a paid inbound customer.

### Outputs

- `clients/<client>/intake/website-survey.json`
- `clients/<client>/content.<niche>.json`
- `clients/<client>/design.<niche>.json`
- `clients/<client>/brand-spec.md`
- `data/cases/<client>/<order>/build-packet.md`

### Validation

- Required facts are present or explicitly marked missing.
- The build packet says what type of site we are building.
- The packet says what pages/routes are expected.
- The packet says what must not change.
- The packet includes contact, CTA, and source-of-truth paths.

### Where To Check

- `docs/WEBSITE_INTAKE_SURVEY.md`
- `docs/WEBSITE_READY_ENGINE.md`
- `data/cases/<client>/<order>/build-packet.md`

## Stage 3: Open Design Project

### Goal

Create the visual concept workspace for this website project.

Every website project must reach this stage before production design/build work is considered complete.

### Inputs

- Official website URL or build-ready packet.
- Business type.
- Target audience.
- Visual tone.
- Brand context.
- Desired scope, such as homepage only or 3-4 key pages.
- Non-negotiables: logo, contact details, booking/order links, sitemap intent, menu/services.

### Outputs

- `clients/<client>/concept/open-design/concept-manifest.json`
- `clients/<client>/concept/open-design/brand-spec.md`
- `clients/<client>/concept/open-design/production-handoff.json`
- Open Design project ID.
- Open Design data directory.
- Sync metadata, usually `.profitslocal-sync.json`.

### Validation

- Open Design project exists.
- Project is visible in the intended Open Design data directory.
- Concept has brand/design direction for the exact business.
- Brand facts are not generic placeholders.
- Production handoff exists before porting to Astro.
- `concept-manifest.json` and `.profitslocal-sync.json` point to the same client slug.
- Discord task packet points to this Open Design project ID.
- If Matthew can see/edit the project in the desktop app, the app project and manifest use the same project ID or data directory.

### Where To Check

- `clients/<client>/concept/open-design/`
- `docs/OPEN_DESIGN_PROJECT_SYNC.md`
- `docs/OPEN_DESIGN_INTEGRATION.md`
- Open Design desktop/source app project list.

### Common Commands

```bash
npm run open-design:run-concept -- --client <client> --mode app-visible --source-url <official-url>
npm run open-design:continue-concept -- --client <client> --prompt "..."
npm run open-design:sync-from-app -- --client <client>
npm run open-design:build-production-handoff -- --client <client> ...
```

## Stage 4: Production Dev Build

### Goal

Port the accepted concept and source-backed content into the customer Astro/Webjuice repo.

### Inputs

- Open Design production handoff.
- Customer content artifact.
- Design artifact.
- Evidence file.
- Customer repo.
- Dev branch.

### Outputs

- Updated customer repo on `dev`.
- Working routes.
- Preview banner with official ProfitsLocal links.
- Build output.

### Validation

- `npm run build` passes in customer repo.
- Expected routes exist.
- Old source URLs are preserved or redirected when redesigning an existing site.
- Customer repo does not contain local ProfitsLocal checkout/revision/domain pages.
- Preview banner points to official `profitslocal.com`.

### Where To Check

- customer repo, usually `/Users/matthew/Developer/webjuice-generated/<client>`
- GitHub repo `matthew6688/<client>`
- Cloudflare Pages dev project.

## Stage 5: Dev Preview QA

### Goal

Make sure the preview is good enough to show a customer.

### Inputs

- Dev preview URL.
- Build output.
- Evidence/content/design files.
- Open Design handoff.

### Outputs

- QA result JSON.
- Desktop screenshot.
- Mobile screenshot.
- List of issues or approval to send customer review email.

### Validation

- Dev preview returns HTTP 200.
- Mobile and desktop screenshots render correctly.
- Business name, phone, address, map, booking/contact links are accurate.
- No obvious placeholder copy.
- No missing critical menu/service information.
- No broken local funnel pages.
- Banner links go to official `profitslocal.com`.

### Where To Check

- `data/qa/<client>/`
- `npm run qa:funnel-pages`
- delivery QA docs/samples.

## Stage 6: Outreach / Demo Proof

### Goal

Prepare proof material so the business can quickly understand what we made.

### Inputs

- Dev preview URL.
- Screenshots.
- Short demo video.
- Business-specific improvement notes.
- Contact email or phone.

### Outputs

- Screenshot assets.
- Demo video.
- Outreach email draft.
- Evidence-backed talking points.

### Validation

- Screenshot shows the actual business preview.
- Email includes preview link and clear offer.
- Email does not pretend the business requested the site if it is outbound.
- Contact path is valid.

### Where To Check

- `clients/<client>/outreach/`
- cold email artifacts.
- Discord project thread.

## Stage 7: Checkout / Payment

### Goal

Let the customer claim the preview and create a paid order tied to the correct project.

### Inputs

- Preview banner link.
- Official `profitslocal.com/checkout`.
- Project context: client slug, repo, preview URL, tier, amount, UTM/source params.
- Stripe checkout.

### Outputs

- Stripe checkout session.
- Paid order event.
- Entitlement/revision quota.
- Revenue ledger event.
- Case memory update.

### Validation

- Payment succeeds in Stripe test/live mode.
- Success redirects to official ProfitsLocal thank-you.
- Order maps to correct `client_slug`, `repo`, and `preview_url`.
- Revenue appears in finance ledger.
- Customer email is sent through Resend.

### Where To Check

- Stripe dashboard.
- `data/funnel/orders/<client>/<order>.json`
- `data/finance/ledger.jsonl`
- `data/cases/<client>/<order>/`
- Discord website task thread.

## Stage 8: Agent Task / Discord Work

### Goal

Create one durable internal workroom where operator and AI can continue the project.

### Inputs

- Paid order.
- Case memory.
- Build packet.
- Open Design project binding.
- Customer repo and dev branch.

### Outputs

- `data/agent-tasks/<client>/<task>.json`
- Discord `#website-tasks` thread.
- Website-agent handoff message.
- Case timeline event.

### Validation

- Task packet matches `docs/AGENT_TASK_PACKET_CONTRACT.md`.
- Discord thread ID is saved in case memory.
- Task packet includes Open Design project ID and commands.
- Agent reads case/task before editing.
- Later revisions reuse same thread.
- Any visual change records whether it came from Discord continuation, Open Design desktop sync, or direct repo work.
- If Open Design was used, the same project ID is reused and the production handoff is rebuilt.
- If a customer email is suggested, it references the latest dev preview and latest QA result.

### Where To Check

- `docs/AGENT_TASK_PACKET_CONTRACT.md`
- `data/agent-tasks/<client>/`
- Discord `#website-tasks`
- `data/cases/<client>/<order>/case.json`

## Stage 9: Customer Review Email

### Goal

Send the customer a branded email with the correct next actions.

### Inputs

- QA-passed dev preview.
- Order ID.
- Checkout email.
- Official approve/revision/domain links.
- Resend API.

### Outputs

- Branded HTML email.
- Resend email ID.
- Case timeline update.
- Discord thread update.

### Validation

- Email uses fixed intent from `docs/CUSTOMER_COMMUNICATION_CONTRACT.md`.
- Links point to official `profitslocal.com`, not customer preview domain.
- Email includes order ID and preview URL.
- Resend ID is recorded.

### Where To Check

- `docs/CUSTOMER_COMMUNICATION_CONTRACT.md`
- `core/funnel/customer-email.js`
- Resend dashboard.
- case timeline.
- Discord thread.

## Stage 10: Revision Loop

### Goal

Let customers request bounded changes without losing order identity.

### Inputs

- Official revision form.
- Order ID.
- Checkout email.
- Requested changes.
- Optional attachments.

### Outputs

- Revision accepted or denied.
- Quota usage update.
- Agent task if accepted.
- Customer email.
- Discord thread update.

### Validation

- Order ID and checkout email match.
- Quota is checked before creating task.
- Accepted revision increments usage.
- Over-limit revision does not create task and sends extra revision checkout link.
- Same Discord thread is reused.

### Where To Check

- `data/funnel/orders/<client>/<order>.json`
- `data/cases/<client>/<order>/`
- `data/agent-tasks/<client>/`
- Discord thread.

## Stage 11: Approval / Publish Live

### Goal

Publish the approved dev version to live safely.

### Inputs

- Official approval form.
- Order ID.
- Checkout email.
- Customer repo `dev`.
- Latest QA result.

### Outputs

- Main/live branch update.
- Cloudflare Pages live deploy.
- Live URL.
- Customer live email.
- Case timeline update.

### Validation

- Order ID + email match.
- Publish workflow succeeds.
- Live URL returns HTTP 200.
- Live email includes order ID and live URL.
- Discord thread records the publish result.

### Where To Check

- GitHub Actions.
- Cloudflare Pages.
- customer repo `main`.
- case timeline.
- Resend dashboard.

## Stage 12: Domain Setup

### Goal

Connect the public domain route.

### Inputs

- Official domain setup form.
- Order ID.
- Checkout email.
- Requested route:
  - free ProfitsLocal subdomain;
  - customer subdomain;
  - customer root domain.

### Outputs

- Domain request record.
- Cloudflare DNS/Pages attach state.
- Customer instructions or active confirmation.
- Domain status email.

### Validation

- Free ProfitsLocal subdomain creates DNS CNAME and attaches Pages custom domain.
- Customer subdomain gives exact CNAME target and waits for DNS.
- Root domain stops for manual DNS/email audit.
- Active domain returns HTTP 200.

### Where To Check

- `data/domain/requests/<client>/`
- Cloudflare DNS.
- Cloudflare Pages custom domains.
- customer email.

## Stage 13: Finance / ROI Log

### Goal

Track enough cost and revenue to judge ROI.

### Inputs

- Stripe revenue.
- Resend email count.
- Google Places/Maps usage.
- Firecrawl/TinyFish usage.
- OpenAI/image generation usage.
- Cloudinary upload/storage events.
- Agent runtime estimate.

### Outputs

- `data/finance/ledger.jsonl`
- customer/project ROI view.

### Validation

- Every payment writes revenue.
- Provider usage writes count/cost when available.
- Email send writes Resend event when cost config exists.
- Agent runtime can be estimated.

### Where To Check

- `data/finance/ledger.jsonl`
- admin dashboard, later.

## Current Priority Order

1. Run a real Stripe test payment from Rich & Rare preview banner through official checkout.
2. Verify paid order creates case, entitlement, ledger, Discord thread, and task packet.
3. Verify task packet has mandatory Open Design project binding.
4. Verify customer review email uses branded HTML and official links.
5. Verify approval publishes live and sends live email.
6. Verify free ProfitsLocal subdomain route.

## How To Know A Project Is Healthy

A healthy website project has:

- evidence file;
- website-ready packet;
- Open Design project;
- customer repo dev preview;
- Discord website thread;
- task packet;
- QA screenshots/results;
- branded customer emails;
- order/revision/domain records when paid;
- finance ledger entries.

If one of these is missing, the project is not fully operational yet.
