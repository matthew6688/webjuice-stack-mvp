# Website Agent Closure Plan

> Scope: restaurant paid order and revision fulfillment only.
> Goal: one customer/order thread becomes the durable workspace from payment through feedback, dev preview, approval, and live publish.

## Current Assessment

The Discord integration is now technically working:

- `website-agent` is online and can read `#website-tasks`.
- `#website-tasks` pickup works when a separate sender bot mentions `website-agent`.
- The handoff message includes pointers to case, context, task, evidence, content, design, and brand spec files.
- The `website-agent` profile has local design skills installed, including `huashu-design`, `design`, `frontend-design`, `design-review`, and Open Design skills.
- Repeatable smoke test exists: `npm run hermes:smoke-website-agent-handoff`.

The remaining risk is not Discord connectivity. The risk is operational closure: making sure every customer event returns to the same durable case/thread and that every agent run proves it read context, used design protocol, pushed dev, and notified the right place.

## Principle

One paid order gets one durable case workspace:

```txt
Stripe/Tally/Revision event
  -> data/cases/<client>/<order>/case.json
  -> data/cases/<client>/<order>/context-packet.json
  -> one website-task Discord thread
  -> dev branch implementation
  -> customer review email
  -> approval
  -> live publish
```

The Discord thread is the human-visible workspace. The case folder is the source of truth. If they disagree, the case folder wins and the thread should be repaired.

## Required Behaviors

### 1. Payment Creates Or Reuses One Website Thread

When a paid order is routed:

- Create/update `data/cases/<client>/<order>/case.json`.
- Create/update `data/agent-tasks/<client>/<task>.json`.
- Send one handoff to `#website-tasks`.
- Persist returned `websiteTaskThreadId` and `websiteTaskMessageId` into `case.json.discord`.
- If the order already has `websiteTaskThreadId`, send the new message into that existing thread, not a new thread.

Validation:

```bash
npm run hermes:smoke-website-agent-handoff -- --send true
```

Then inspect:

- Discord created or reused one thread.
- `case.json.discord.websiteTaskThreadId` exists for real routed orders.

### 2. Feedback Always Returns To The Same Thread

When a customer submits `/revise`:

- Match `orderId + checkout email`.
- Load entitlement and case.
- Append customer message to `customer-messages.jsonl`.
- Create revision task.
- Post the revision handoff into the existing `websiteTaskThreadId`.
- If no thread exists, create one and record a repair event.

Validation:

- Submit one fake revision against an existing paid test order.
- Confirm no second website task thread is created.
- Confirm `timeline.jsonl` has `revision_requested`.
- Confirm Discord thread receives the feedback summary and task path.

### 3. Thread Memory Cannot Be The Only Memory

The agent must not rely on Discord scrollback alone.

Each agent run must begin from:

- `case.json`
- `context-packet.json`
- `timeline.jsonl`
- `customer-messages.jsonl`
- current `task.json`
- `clients/<client>/evidence/evidence.json`
- `clients/<client>/content.restaurant.json`
- `clients/<client>/design.restaurant.json`
- `clients/<client>/brand-spec.md`

Validation:

- Agent run summary must include a `contextRead` checklist.
- If any required file is missing, the agent must stop and post `blocked_missing_context`.

### 4. Design Skill Usage Must Be Auditable

For website visual changes, the agent must use the design protocol:

- Load or follow `huashu-design`.
- Use Open Design `web-prototype` or `saas-landing` patterns for full website work.
- Use `critique` or `design-review` before final dev push.
- Preserve website/menu separation.
- Use real evidence and brand assets before writing customer-facing content.

Validation:

- Agent run record includes `designProtocolUsed`.
- Run summary includes which skill/pattern was used.
- Diff touches expected design/content files only.
- Screenshot QA or Playwright visual QA runs before customer review.

### 5. Dev Publish Path

The agent may push only to `dev` during revision or post-payment work.

After work:

- Run build.
- Push `dev`.
- Wait for Cloudflare Pages dev deploy.
- Post dev preview in website task thread.
- Send customer review email via Resend.

Validation:

```bash
npm run agent:complete-task -- \
  --task <task.json> \
  --repo-dir <client repo> \
  --execute true \
  --checkout true \
  --push true \
  --check-deploy true \
  --send-email true \
  --send-discord true
```

Expected:

- `dev` branch updated.
- deploy is `completed/success`.
- website task thread gets dev preview.
- customer gets review email.
- case timeline gets `agent_run_completed`.

### 6. Approval Publishes Live

When customer approves:

- Match `orderId + checkout email`.
- Resolve approved task/case.
- Publish dev tree to main/live.
- Wait for live deploy.
- Send customer live email.
- Post live published update into the same website task thread.

Validation:

```bash
npm run agent:publish-approved -- \
  --task <task.json> \
  --repo-dir <client repo> \
  --execute true \
  --push true \
  --check-deploy true \
  --send-email true \
  --send-discord true
```

Expected:

- `main` updated without force push.
- live deploy success.
- same Discord thread receives live URL.
- case status becomes `live_published`.

## Commands To Standardize

These should be the canonical operator commands:

```bash
npm run check:env -- --workflow websiteAgent
npm run hermes:smoke-website-agent-handoff
npm run hermes:smoke-website-agent-handoff -- --send true
npm run funnel:route-event -- --input <payload.json> --provider stripe --send-discord true --send-email true
npm run agent:complete-task -- --task <task.json> --repo-dir <client repo> --execute true --checkout true --push true --check-deploy true --send-email true --send-discord true
npm run agent:publish-approved -- --task <task.json> --repo-dir <client repo> --execute true --push true --check-deploy true --send-email true --send-discord true
```

## Test Matrix

| Test | Purpose | Status |
|---|---|---|
| Handoff validate smoke | Confirm Discord pickup/thread without fake file reads | Passing |
| Full handoff dry-run | Confirm payload contains all paths and design protocol | Passing |
| Paid route local smoke | Confirm sale creates case/task/ledger | Existing MVP |
| Paid route + website thread | Confirm payment creates/reuses website thread | Pending |
| Revision route same thread | Confirm feedback goes to existing thread | Pending |
| Agent complete dev push | Confirm dev branch + preview + Discord + email | Existing MVP, needs website-thread assertion |
| Approval live publish | Confirm live publish + same thread update | Existing MVP, needs website-thread assertion |
| Memory continuation | Confirm later thread message can recover from case files | Pending |
| Design protocol audit | Confirm run record proves Huashu/open-design usage | Pending |

## Immediate Implementation Order

1. Add dedicated `ProfitsLocal Handoff` sender bot to TODO and configure later.
2. Update Discord routing to prefer existing `case.json.discord.websiteTaskThreadId` before creating a new website task thread.
3. Add `websiteTaskThreadId` to revision handoff routing so feedback returns to the same thread.
4. Add agent run checklist fields: `contextRead`, `designProtocolUsed`, `qaScreenshots`, `devDeployUrl`, `customerEmailId`.
5. Add an end-to-end fixture script that simulates:
   - paid order
   - revision feedback
   - dev completion
   - approval publish
   - assertions that all Discord updates used one thread.
6. Run the fixture against Opa Bar + Mezze using test order IDs only.

## Required Secrets And Variables

| Name | Purpose |
|---|---|
| `WEBSITE_TASKS_DISCORD_CHANNEL_ID` | Target `#website-tasks` channel |
| `WEBSITE_AGENT_MENTION` | Mention that triggers `website-agent` |
| `WEBSITE_TASKS_DISCORD_BOT_TOKEN` | Separate sender/dispatcher bot, not `website-agent` |
| `DISCORD_BOT_TOKEN` | Sales/revision true-thread creation if separate |
| `RESEND_API_KEY` | Customer emails |
| `GH_PAT` / `AGENT_GITHUB_TOKEN` | Repo/workflow dispatch |
| `CF_API_TOKEN` / `CF_ACCOUNT_ID` | Cloudflare Pages deploy checks/domain |

## Done Definition

This integration is done only when one test order can prove:

- one case folder;
- one website task Discord thread;
- payment, feedback, dev preview, approval, and live publish all recorded in that case;
- customer email sent at each key step;
- dev and live deploys verified;
- agent run record proves it read context and used the design protocol.
