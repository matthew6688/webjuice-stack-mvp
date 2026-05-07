# Local Hermes + Discord Website Agent SOP

Updated: 2026-05-07

## Purpose

This SOP defines the local-first operating setup for ProfitsLocal website work.

For now, focus on the local Mac running Hermes, connected to the Discord `#website-tasks` channel. VPS deployment is intentionally deferred until the local workflow is stable.

## Operating Principle

```text
One customer project
  -> one repo project capsule
  -> one Discord website task thread
  -> local Hermes website-agent reads the capsule
  -> operator + AI collaborate in Discord
  -> customer emails go out through Resend
```

The Discord thread is the main internal workspace. The repo case files are the durable memory. The admin dashboard is an index and quick-link surface, not the main conversation UI.

## Local Components

| Component | Local role |
|---|---|
| Hermes profile `website-agent` | Worker that reads Discord threads and runs/coordinates website tasks. |
| Discord `#website-tasks` | Text channel where each customer project gets a thread. |
| Website task thread | Per-customer/per-order workspace for operator + AI discussion. |
| Project capsule | Repo-backed case memory under `data/cases/<client>/<order>/`. |
| Admin dashboard | Finds the right customer/project/thread/links quickly. |
| Resend | Sends customer-facing transactional emails. |

## Required Discord Setup

Use a normal text channel:

```text
#website-tasks
```

Rules:

- each executable website task becomes a thread under `#website-tasks`;
- thread name should include the business name and task/order context;
- later revision, review, approval, and live publish updates reuse the same saved website thread;
- the agent should answer only when mentioned or inside an allowed website thread.

Recommended bot split:

| Bot | Role |
|---|---|
| `website-agent` | Hermes worker/receiver. |
| `ProfitsLocal Handoff` | Sender/dispatcher that posts task packets and mentions `website-agent`. |

The split matters because Discord bots do not reliably receive their own messages.

Required bot/channel permissions:

- View Channels
- Send Messages
- Create Public Threads
- Send Messages in Threads
- Read Message History
- Add Reactions
- Attach Files, optional for artifacts

## Project Capsule

The agent must read the capsule before acting.

Current case shape:

```text
data/cases/<client>/<order>/
├── case.json
├── context-packet.json
├── timeline.jsonl
├── customer-messages.jsonl
├── decisions.jsonl
├── agent-runs.jsonl
└── build-packet.md
```

Current client source-of-truth files:

```text
clients/<client>/evidence/evidence.json
clients/<client>/intake/website-survey.json
clients/<client>/content.restaurant.json
clients/<client>/design.restaurant.json
clients/<client>/brand-spec.md
clients/<client>/concept/open-design/concept-manifest.json
clients/<client>/concept/open-design/production-handoff.json
data/agent-tasks/<client>/<task>.json
```

Before first-version work, run `npm run intake:build-website-ready`. The generated build packet is the handoff that lets Hermes, Codex, Open Design, Claude Code, or OpenCode work inside the same framework.

The executable task packet standard is documented in `docs/AGENT_TASK_PACKET_CONTRACT.md`. Website-agent should treat that contract as the checklist before editing or emailing.

## Open Design Binding

High-fidelity design work should use the same local Open Design project recorded in the task packet.

Truth source rule:

```text
Open Design is the source of truth for visual concept and design direction.
The customer repo dev branch is the source of truth for the development preview.
The customer repo main/live branch is the source of truth for the approved live site.
ProfitsLocal evidence/content/survey/case files are the source of truth for business facts and project memory.
```

Task packets should include:

```text
openDesignProject
openDesignDataDir
openDesignConcept
openDesignManifest
productionHandoff
openDesignContinue
openDesignSync
```

Rules:

- If the request is visual/conceptual, continue the recorded Open Design project with `openDesignContinue`.
- If Matthew changed the design manually in Open Design, sync it back with `openDesignSync`.
- Rebuild `production-handoff.json` before porting design changes into the customer repo.
- Do not start a new Open Design project unless the operator explicitly says to.
- Do not deploy Open Design HTML directly. Port accepted design changes into the Webjuice/Astro repo on `dev`.

## Local Setup Steps

1. Prepare the Hermes profile:

```bash
npm run hermes:setup-website-agent -- --channel WEBSITE_TASKS_CHANNEL_ID
```

2. Set the local `website-agent` bot token:

```bash
npm run hermes:set-website-agent-token -- --channel WEBSITE_TASKS_CHANNEL_ID
```

3. Confirm profile files:

```text
~/.hermes/profiles/website-agent/
├── .env
├── config.yaml
├── SOUL.md
└── skills/
```

4. Start the local LaunchAgent:

```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/ai.hermes.gateway-website-agent.plist
launchctl print gui/$(id -u)/ai.hermes.gateway-website-agent
```

5. Run the smoke:

```bash
npm run hermes:smoke-website-agent-handoff -- --send true
```

Expected:

- a parent task message appears in `#website-tasks`;
- Hermes creates or detects one thread;
- `website-agent` replies in the thread;
- the result includes thread ID and reply data.

## Required Local Env

Hermes profile `.env`:

```env
DISCORD_BOT_TOKEN=<website-agent worker token>
DISCORD_HOME_CHANNEL=<website-tasks channel id>
DISCORD_ALLOW_BOTS=mentions
GATEWAY_ALLOW_ALL_USERS=true
```

Main repo `.env.local` or GitHub/Cloudflare env:

```env
WEBSITE_TASKS_DISCORD_CHANNEL_ID=<website-tasks channel id>
WEBSITE_AGENT_MENTION=<@website-agent app/user id>
WEBSITE_TASKS_DISCORD_BOT_TOKEN=<handoff sender token>
```

Important:

- `DISCORD_BOT_TOKEN` in Hermes should be the worker bot.
- `WEBSITE_TASKS_DISCORD_BOT_TOKEN` should be the sender bot.
- Do not run the same worker token in another Hermes profile at the same time.

## Customer Thread Workflow

For each customer/project:

1. Open the saved Discord website task thread from admin/case.
2. Review uploaded customer assets and customer messages.
3. Ask `website-agent` to read the case and task paths.
4. Discuss the website/menu/domain/revision work in the thread.
5. If an email is needed, ask the agent to draft the email in the thread.
6. The draft must use a fixed email intent from `docs/CUSTOMER_COMMUNICATION_CONTRACT.md`.
7. Operator approves or edits the email.
8. Send through Resend or the existing email runner.
9. Post the email ID and customer-facing link back into the thread.
10. Case timeline records the action.

Customer-facing rule:

- customers receive email links;
- customers do not use Discord;
- Discord stays internal for operator + AI collaboration.

## Admin Dashboard Relationship

The admin dashboard should help you find and operate the right thread.

It should show or link:

- Discord website task thread;
- case path and context path;
- repo, dev preview, live URL;
- revise, approve, domain setup, and customer review links;
- Cloudinary assets;
- customer email and lead recipient;
- revision quota;
- latest agent run status.

It should not become the main chat interface or a customer portal.

## Standard Local Commands

Smoke local Hermes pickup:

```bash
npm run hermes:smoke-website-agent-handoff -- --send true
```

Check closure logic:

```bash
npm run hermes:test-website-agent-closure
```

Run a task to dev:

```bash
npm run agent:complete-task -- --task <task.json> --repo-dir <client-repo> --execute true --checkout true --push true --check-deploy true --send-email true --send-discord true
```

Publish after approval:

```bash
npm run agent:publish-approved -- --task <task.json> --repo-dir <client-repo> --execute true --push true --check-deploy true --send-email true --send-discord true
```

## Troubleshooting

### Agent does not reply

Check:

- local LaunchAgent is running;
- bot is invited and can see `#website-tasks`;
- message mentions `website-agent`;
- profile `.env` has the worker token;
- no other Hermes profile is using the same token;
- `DISCORD_ALLOW_BOTS=mentions` is set.

### Thread is not created

Check:

- `#website-tasks` is a text channel;
- bot has Create Public Threads;
- Hermes `auto_thread: true` is set;
- sender bot fallback has thread permissions.

### Agent forgets context

Post the capsule pointers again:

```text
case: data/cases/<client>/<order>/case.json
context: data/cases/<client>/<order>/context-packet.json
timeline: data/cases/<client>/<order>/timeline.jsonl
messages: data/cases/<client>/<order>/customer-messages.jsonl
task: data/agent-tasks/<client>/<task>.json
```

The expected behavior is: read capsule first, then answer.

### Agent ignores design protocol

Ask it to confirm:

- `huashu-design` was loaded or followed;
- Open Design `web-prototype`, `saas-landing`, `design-brief`, or `critique` was used when relevant;
- evidence/content/design/brand files were read;
- website vs menu route was preserved.

Run records should include `designProtocolUsed`.

## Local Done Criteria

Local Hermes + Discord is ready when:

- one paid customer/order maps to one website task thread;
- later feedback returns to that same thread;
- `website-agent` replies in the thread and reads the capsule;
- admin/case can link back to the thread;
- agent runs record context read and design protocol usage;
- customer-facing emails still go through Resend.

## Current Sender Bot Evidence

Dedicated sender bot is configured:

```text
Sender bot: ProfitsLocal Handoff
Application ID: 1501742351716978738
Channel: website-tasks / 1501072883001065614
Worker mention: <@1501073096696664184>
```

Validated on 2026-05-07:

- `ProfitsLocal Handoff` token can read the `website-tasks` text channel.
- `.env.local` has `WEBSITE_TASKS_DISCORD_BOT_TOKEN` set to the sender bot.
- GitHub secret `WEBSITE_TASKS_DISCORD_BOT_TOKEN` is set on `matthew6688/webjuice-stack-mvp`.
- Real handoff smoke posted with the sender bot, Hermes auto-created a thread, and `website-agent` replied:

```text
threadId: 1501743599585460284
messageId: 1501743599585460284
reply: website-agent handoff smoke ok
```

The sender bot and worker bot are now separated, which avoids the "bot cannot reliably pick up its own message" failure mode.

## Deferred

VPS Hermes deployment is a later phase. Do not design around VPS until the local SOP remains stable through multiple real customer/project runs.
