# Hermes Website Agent

This is the dedicated Hermes profile/channel plan for ProfitsLocal restaurant website work.

The existing `enricher` profile is not the right owner for website tasks. Its SOUL and memory are for import/export company enrichment, and it listens to `#enrichment`. Website revision, preview, approval, and publish work needs its own isolated channel, profile, memory, and goal.

## Target Shape

- Discord channel: `#website-tasks`
- Hermes profile: `website-agent`
- Launch service: `ai.hermes.gateway-website-agent`
- Working directory: `/Users/matthew/Developer/google-map-website`
- Memory source of truth: repo case files under `data/cases/<client>/<order>/`
- Execution source of truth: `data/agent-tasks/<client>/<task>.json`
- Website-ready source of truth: `clients/<client>/intake/website-survey.json` and case `build-packet.md`
- Customer-facing automation: GitHub Actions workflows, Resend email, Cloudflare Pages deploys

Local setup SOP: `docs/HERMES_LOCAL_DISCORD_SOP.md`.

## Responsibilities

`website-agent` should:

- read the current Discord thread and the saved case memory before answering;
- classify requests as `website`, `menu`, `domain`, `revision`, `approval`, or `account`;
- never invent restaurant facts, prices, hours, contact info, reservation links, or photos;
- use `build-packet.md`, `clients/<client>/intake/website-survey.json`, `clients/<client>/evidence`, `content.restaurant.json`, `design.restaurant.json`, and `brand-spec.md` as source of truth;
- preserve the distinction between official website pages and minimal mobile menu pages;
- use Huashu Design/open-design protocol for website UI changes;
- load local design skills before visual edits: `huashu-design`, Open Design `web-prototype`/`saas-landing`/`critique`, plus `design`, `frontend-design`, and `design-review` when available;
- trigger or guide the existing automation rather than manually editing random files;
- post dev preview links for review and only publish live after explicit approval.

## Discord Routing

Recommended channel split:

| Channel | Owner | Purpose |
|---|---|---|
| `#sales` or current sales channel | Sales webhook | New payment/order notification |
| `#website-tasks` | `website-agent` | Website/revision execution thread and memory |
| `#revise` | Revision webhook | Customer revision intake notification |
| `#bot-logs` | none | Logs only, all bots ignore |
| `#sandbox` | all bots | Test only |

The sales webhook may still create an ops notification thread in the sales channel. The executable website task must always be mirrored into `#website-tasks` as its own true Discord thread with the case path, task path, repo, preview URL, order ID, and customer email. `website-agent` should be the only free-response Hermes profile for `#website-tasks`.

Current routing contract:

- `#website-tasks` is a Discord text channel (`type: 0`).
- Current channel ID: `1501072883001065614`.
- Each new paid website task is first posted as a normal parent-channel message that mentions `website-agent`.
- Hermes `auto_thread: true` then creates the thread from that parent message, producing the same clean text-channel thread display used by the other Hermes channels.
- The parent message contains the full task packet: case path, build packet path, task path, repo, preview URL, order ID, customer email, and design/evidence pointers.
- If Hermes does not create the thread in time, automation falls back to explicit Discord message-thread creation so the order is not lost.
- Later revisions, approval updates, dev preview notifications, and live publish notifications reuse `case.json.discord.websiteTaskThreadId`.

## Website Task Intake Router

`#website-tasks` is the lead-ops command center. Keep using the existing channel instead of creating a second one. Default every new message in this channel to lead discovery, lead sync, lead audit, stage movement, or mockup handoff unless it clearly names a paid project/revision.

When Matthew posts a parent message in `#website-tasks`, the router should create or reuse one task thread and write a task envelope under `data/discord-tasks/<taskId>/`:

```text
Discord parent message
-> task router classifies intent
-> thread is created from the parent message
-> thread receives the intake receipt
-> skill/workflow writes artifacts and task-log.jsonl
-> admin reads lead/project artifacts and moves the card
-> thread receives tool logs, evidence links, stage updates, and human decision prompts
```

Supported first-pass routing:

| Operator input | Router kind | Workflow |
|---|---|---|
| Business photo, sign, phone screenshot, OCR text | `image_lead_discovery` | `image-lead-discovery` + `lead-ops` |
| "google search / 找 / scrape leads" | `lead_search_discovery` | lead search + qualification + `lead-ops` |
| URL plus audit/redesign/SEO language | `site_audit` | `site-audit` + `seo-audit` + `lead-ops` |
| Open Design, repo, demo, revision, publish | `website_project_task` | website-agent / Open Design continuation |
| Unknown text | `general_website_task` | manual triage before workflow |

Thread replies should use Chinese operator-facing templates:

- Intake receipt: what was recognized, which workflow will run, task/log paths.
- Tool log: tool name, input, output, source URL, artifact path.
- Stage update: old/new business stage, AI reason, next action.
- Decision prompt: clear buttons later; short-term slash-command/reaction fallback is acceptable.
- Final receipt: admin link, evidence paths, next action, and whether human approval is needed.

Thread title should be stage-aware and synced with the admin pipeline when the AI reaches a decision:

```text
[研究中] Roofing & Restoration · roofing · unknown
[需人工] Example Roofing · roofing · Brisbane
[可做 Mockup] M&B Roofing · roofing · Western Sydney
[已跳过] Strong Site Co · HVAC · Gold Coast
```

Use:

```bash
npm run discord:sync-website-task-title -- --thread <threadId> --stage ready_for_mockup --business "M&B Roofing" --industry roofing --city "Western Sydney"
npm run discord:sync-website-task-thread -- --thread <threadId> --client <clientSlug>
npm run discord:sync-lead-ops-thread -- --thread <threadId> --send true
```

Only add `--send true` when intentionally updating Discord.

`sync-website-task-thread` pulls recent Discord conversation into `clients/<client>/lead/discord-thread.json`. The admin lead card then shows the thread link, useful conversation summary, and latest operator/agent messages alongside normal evidence logs.

`sync-lead-ops-thread` is the automation path for "sync to admin": it reads the thread conversation, extracts structured lead candidates, writes `clients/<slug>/lead/*`, writes evidence and discovery logs, syncs the Discord conversation snapshot, updates the thread title, and posts a short summary back to the thread.

The agent should not pause for small missing details. For each candidate it should keep moving until `ready-to-build.json` has:

- `aiConclusion.result`: `ready_for_mockup`, `needs_human`, or `skip`
- `aiConclusion.score`
- `scorecard.reasons`
- `websiteBuildHandoff.openDesignPayload.prompt`

Only ask Matthew for a decision when the result is genuinely uncertain: current-site audit 60-80, conflicting evidence, compliance-sensitive claims, or approval to spend build time. Otherwise, auto-skip or auto-promote to mockup-ready and report the evidence in the thread.

Verification:

```bash
npm run discord:test-website-task-router
npm run discord:route-website-task -- --content "google search Brisbane roofers leads"
npm run discord:route-website-task -- --content "google search Brisbane roofers leads" --persist true
npm run discord:sync-website-task-title -- --thread 1502382386464424028 --stage ready_for_mockup --business "M&B Roofing" --industry roofing --city "Western Sydney"
```

Use `--persist true` from an existing Hermes/Discord thread when the thread already exists and the agent only needs to write the task envelope/log locally.

Only run live dispatch intentionally:

```bash
npm run discord:route-website-task -- --input data/qa/discord-task-router/message.json --send true
```

Do not print, commit, or paste `WEBSITE_TASKS_DISCORD_BOT_TOKEN`.

## Required Profile Config

`~/.hermes/profiles/website-agent/config.yaml` should include:

```yaml
model:
  provider: openai-codex
  default: gpt-5.4-mini

terminal:
  backend: local
  cwd: /Users/matthew/Developer/google-map-website
  timeout: 180
  persistent_shell: true

memory:
  memory_enabled: true
  user_profile_enabled: false
  memory_char_limit: 4000

discord:
  require_mention: true
  free_response_channels:
    - "WEBSITE_TASKS_CHANNEL_ID"
    - "1493926255492595732"
  no_thread_channels:
    - "1493926255492595732"
  ignored_channels:
    - "1493926218574200942"
  auto_thread: true
  reactions: true
  group_sessions_per_user: false

security:
  redact_secrets: true
```

Why `group_sessions_per_user: false`: website work should be grouped by Discord thread/case, not by the human user across unrelated clients.

Note: automation now prefers Hermes `auto_thread` for text-channel handoffs so bot-created tasks display like human-started Hermes threads. It still has an explicit Discord message-thread fallback if auto-threading does not complete in time.

## Required Env

The profile needs its own bot token unless the old profile using that token is stopped. Hermes has token locks; two running profiles should not share one Discord bot token.

```env
DISCORD_BOT_TOKEN=...
DISCORD_ALLOWED_USERS=
DISCORD_HOME_CHANNEL=WEBSITE_TASKS_CHANNEL_ID
GATEWAY_ALLOW_ALL_USERS=true
DISCORD_ALLOW_BOTS=mentions
```

Do not set legacy model overrides such as `LLM_MODEL=kimi-for-coding` in this profile unless the matching provider key is configured. On 2026-05-05 this stale override caused `website-agent` to fail before pickup even though `config.yaml` pointed to `openai-codex`. The profile now leaves model selection to `config.yaml`.

For a clean production setup, create a separate Discord application/bot named `ProfitsLocal Website Agent`, invite it to the server, and give it access only to `#website-tasks`, `#sandbox`, and any needed threads.

Why `DISCORD_ALLOW_BOTS=mentions`: sales/revision automation can hand work to `website-agent` by posting a task packet that explicitly mentions the bot. Generic bot/webhook notifications remain ignored, which prevents noisy loops.

Why `GATEWAY_ALLOW_ALL_USERS=true`: this channel is dedicated to website execution and should accept customer-order handoffs without requiring every webhook/bot author ID to be pre-registered. Keep the bot scoped to `#website-tasks` and `#sandbox`.

GitHub Actions can hand a paid order or revision to this agent by setting:

```env
WEBSITE_TASKS_DISCORD_CHANNEL_ID=1501072883001065614
WEBSITE_AGENT_MENTION=<@1501073096696664184>
WEBSITE_TASKS_DISCORD_BOT_TOKEN=...
```

Important: `WEBSITE_TASKS_DISCORD_BOT_TOKEN` should belong to a different Discord app than `website-agent`; Discord bots do not reliably receive their own messages. Think of `website-agent` as the worker/receiver, and `WEBSITE_TASKS_DISCORD_BOT_TOKEN` as the dispatcher/sender. If this is omitted, the workflow falls back to `DISCORD_BOT_TOKEN`.

The setup script also copies the required design skills into the profile-local skills directory:

- `huashu-design`
- `design`
- `frontend-design`
- `design-review`
- Open Design: `web-prototype`, `saas-landing`, `design-brief`, `critique`, `tweaks`

## SOUL Requirements

Use `scripts/hermes/setup-website-agent-profile.js` to write the recommended `SOUL.md`. The key behavioral contract is:

- one case/thread equals one durable customer workstream;
- read `build-packet.md`, `website-survey.json`, `case.json`, `context-packet.json`, `timeline.jsonl`, and `customer-messages.jsonl` before deciding;
- use existing workflows for `route-funnel-event`, `agent:complete-task`, and `publish-approved`;
- push customer-facing site changes only to `dev`;
- publish `dev` to `main/live` only after explicit approval with matching order ID and checkout email;
- send or trigger customer emails for review/publish milestones.

## Verification

After creating the channel and setting the profile token:

```bash
npm run hermes:setup-website-agent -- --channel WEBSITE_TASKS_CHANNEL_ID
npm run hermes:set-website-agent-token -- --channel WEBSITE_TASKS_CHANNEL_ID
npm run hermes:recover-discord-gateway -- --start true
launchctl print gui/$(id -u)/ai.hermes.gateway-website-agent
```

`hermes:recover-discord-gateway` checks Discord `/users/@me` first and starts the LaunchAgent only when the bot token returns HTTP 200. This prevents a broken Discord/API window from turning into a restart loop.

If you want to clone local model auth from an existing Hermes profile, run with `--clone-auth true`. Do not clone or reuse the Discord bot token from another running profile.

Then post in `#website-tasks`:

```text
case: data/cases/opa-bar-mezze-restaurant/<order-id>/case.json
task: data/agent-tasks/opa-bar-mezze-restaurant/<task>.json
请读取 case memory，告诉我下一步应该做什么。
```

Expected behavior:

- only `website-agent` responds;
- it reads the case/task paths;
- it does not use old enrichment memory;
- it suggests or runs the website task flow, not import/export enrichment.

You can also run the repeatable smoke test:

```bash
npm run hermes:smoke-website-agent-handoff
```

Default mode is dry-run and prints the exact handoff payload. The smoke script uses `--intent validate` by default, so the agent only confirms pickup and does not read fake files. To post a live smoke to Discord and wait for the auto-created thread/reply:

```bash
npm run hermes:smoke-website-agent-handoff -- --send true
```

To test the full production-style handoff text, use:

```bash
npm run hermes:smoke-website-agent-handoff -- --send true --intent full
```

This requires `WEBSITE_TASKS_DISCORD_CHANNEL_ID`, `WEBSITE_AGENT_MENTION`, and `WEBSITE_TASKS_DISCORD_BOT_TOKEN` in `.env.local`. The handoff bot token should not be the `website-agent` bot token, because bots do not reliably receive their own messages.

The smoke script refuses to send if `WEBSITE_TASKS_DISCORD_BOT_TOKEN` resolves to the same bot ID as `WEBSITE_AGENT_MENTION`. Use a separate app such as `ProfitsLocal Handoff` for dispatch.

## Current Validation

Verified locally on 2026-05-05:

- `ai.hermes.gateway-website-agent` LaunchAgent starts and stays running.
- The dedicated bot can see `#website-tasks` (`1501072883001065614`).
- A bot/webhook-style message from another Discord app only triggers when it mentions `website-agent`.
- Hermes creates a dedicated Discord thread for the handoff message.
- `website-agent` completes a model smoke test in that thread with `openai-codex / gpt-5.4-mini`.
- `route-funnel-event` supports an optional website-agent handoff message to `#website-tasks`.
- 2026-05-05 live smoke verified explicit thread creation, business-name thread naming, in-thread task packet posting, website-agent pickup, and Huashu/open-design skill loading.
- The handoff message includes pointers to case, context, task, website survey, build packet, evidence, content, design, and brand spec files.

Known non-blocking warning: Discord slash command registration is over the server limit, so a few slash commands are skipped. Normal message/thread pickup works.

## Discord API Incident / 429 Recovery

If `#website-tasks` stops responding, diagnose before restarting:

```bash
npm run hermes:recover-discord-gateway
tail -80 ~/.hermes/profiles/website-agent/logs/gateway.error.log
```

Hard evidence of the known failure mode:

- `HTTPException: 429 Too Many Requests`
- Discord code `40062`
- message `Service resource is being rate limited`
- `Timeout waiting for connection to Discord`

When this happens, stop all Discord gateway LaunchAgents so they do not keep refreshing the limit window:

```bash
for label in ai.hermes.gateway ai.hermes.gateway-outreacher ai.hermes.gateway-distributor ai.hermes.gateway-enricher ai.hermes.gateway-marketer ai.hermes.gateway-prospector ai.hermes.gateway-curator ai.hermes.gateway-website-agent; do
  launchctl bootout gui/$(id -u) "$HOME/Library/LaunchAgents/$label.plist" 2>/dev/null || true
done
pkill -f 'hermes_cli.main.*gateway run' 2>/dev/null || true
```

Wait for Discord health to return, then start only the website agent:

```bash
npm run hermes:recover-discord-gateway -- --start true
```

Do not repeatedly bootstrap the LaunchAgent while the healthcheck is still 429/500. The generated LaunchAgent includes `ThrottleInterval=300`, but manual retries can still prolong Discord's resource limit.
