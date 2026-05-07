# Agent Task Packet Contract

Updated: 2026-05-07

## Purpose

This is the P2 contract for website build work.

ProfitsLocal will mostly use:

- Discord `#website-tasks` as the internal project workspace;
- local Hermes `website-agent` as the Discord worker;
- Open Design desktop/source app as the visual concept workspace;
- customer repo `dev` branch as the production preview workspace.

The task packet must make those tools work on the same project without losing memory.

## One Project, One Thread, One Open Design Binding

Each paid project should have one durable website thread.

```text
data/cases/<client>/<order>/case.json
  -> discord.websiteTaskThreadId
  -> data/agent-tasks/<client>/<task>.json
  -> clients/<client>/concept/open-design/concept-manifest.json
  -> customer repo dev branch
```

Later revisions, approval updates, domain updates, email drafts, and Open Design continuation requests reuse the same thread and case folder.

## Required Task Packet Fields

Every executable website task should include:

```json
{
  "schemaVersion": 1,
  "id": "task_...",
  "clientSlug": "rich-and-rare-restaurant",
  "businessName": "Rich & Rare Restaurant",
  "type": "sale",
  "repo": "matthew6688/rich-and-rare-restaurant",
  "branch": "dev",
  "previewUrl": "https://rich-and-rare-restaurant-dev.pages.dev/",
  "liveUrl": "",
  "casePath": "data/cases/<client>/<order>/case.json",
  "contextPacketPath": "data/cases/<client>/<order>/context-packet.json",
  "customerMessagesPath": "data/cases/<client>/<order>/customer-messages.jsonl",
  "discord": {
    "channelId": "1501072883001065614",
    "threadId": "150...",
    "threadUrl": "https://discord.com/channels/..."
  },
  "sourceOfTruth": {
    "evidence": "clients/<client>/evidence/evidence.json",
    "survey": "clients/<client>/intake/website-survey.json",
    "content": "clients/<client>/content.restaurant.json",
    "design": "clients/<client>/design.restaurant.json",
    "brandSpec": "clients/<client>/brand-spec.md",
    "buildPacket": "data/cases/<client>/<order>/build-packet.md"
  },
  "openDesign": {
    "status": "bound",
    "projectId": "open-design-project-id",
    "dataDir": "/Users/matthew/Developer/open-design/.od",
    "conceptPath": "clients/<client>/concept/open-design/",
    "manifestPath": "clients/<client>/concept/open-design/concept-manifest.json",
    "productionHandoffPath": "clients/<client>/concept/open-design/production-handoff.json",
    "continueCommand": "npm run open-design:continue-concept -- --client <client> --prompt \"...\"",
    "syncCommand": "npm run open-design:sync-from-app -- --client <client>",
    "buildHandoffCommand": "npm run open-design:build-production-handoff -- --client <client> ..."
  },
  "customerLinks": {
    "checkoutUrl": "https://profitslocal.com/checkout?...",
    "revisionUrl": "https://profitslocal.com/revision?...",
    "approveUrl": "https://profitslocal.com/approve?...",
    "domainSetupUrl": "https://profitslocal.com/domain-setup?...",
    "extraRevisionUrl": "https://profitslocal.com/checkout?...tier=extra_revision"
  },
  "acceptanceCriteria": []
}
```

## Discord Work Pattern

In the project thread, the operator can ask:

```text
@website-agent read the task packet and case memory.
Use the existing Open Design project. Do not create a new project.
Port accepted Open Design changes into the Astro customer repo dev branch.
Run build + QA before suggesting a customer email.
```

If Matthew edits in Open Design desktop app:

```text
@website-agent sync the existing Open Design project from app, rebuild production handoff, then port the accepted changes to dev.
```

If Discord/Hermes changes the concept:

```text
@website-agent continue the existing Open Design project with this prompt: ...
Then export, rebuild production handoff, port to dev, and run QA.
```

## Non-Negotiable Rules

- Do not use Discord as customer support. Discord is internal only.
- Do not send customer emails from freeform agent text. Use fixed email intents and variables.
- Do not deploy Open Design HTML directly. Translate it into the customer Astro/Webjuice repo.
- Do not overwrite business facts from Open Design. Evidence/content/survey files win.
- Do not create a new Open Design project if the task packet already has one.
- Do not work on `main` for customer changes. Work on `dev`; publish only after approval.
- Do not add ProfitsLocal checkout/revision/domain pages back into customer repos. Customer repos keep the preview banner and customer website pages only.

## Customer Email Recording

When an email is discussed in Discord:

1. Agent drafts by intent, for example `dev_preview_ready`.
2. Agent lists variables used: preview, approve, revision, domain, order, email.
3. Operator approves or edits.
4. Email is sent through Resend.
5. Resend ID and the rendered customer-facing links are posted back to the thread.
6. Case timeline records the email intent, recipient, Resend ID, and links.

