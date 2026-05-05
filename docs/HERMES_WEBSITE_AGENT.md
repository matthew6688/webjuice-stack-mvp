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
- Customer-facing automation: GitHub Actions workflows, Resend email, Cloudflare Pages deploys

## Responsibilities

`website-agent` should:

- read the current Discord thread and the saved case memory before answering;
- classify requests as `website`, `menu`, `domain`, `revision`, `approval`, or `account`;
- never invent restaurant facts, prices, hours, contact info, reservation links, or photos;
- use `clients/<client>/evidence`, `content.restaurant.json`, `design.restaurant.json`, and `brand-spec.md` as source of truth;
- preserve the distinction between official website pages and minimal mobile menu pages;
- use Huashu Design/open-design protocol for website UI changes;
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

The sales webhook may still create the initial true thread, but the task handoff should be posted into `#website-tasks` or mirrored there with the case path, task path, repo, preview URL, order ID, and customer email. `website-agent` should be the only free-response Hermes profile for `#website-tasks`.

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

## Required Env

The profile needs its own bot token unless the old profile using that token is stopped. Hermes has token locks; two running profiles should not share one Discord bot token.

```env
DISCORD_BOT_TOKEN=...
DISCORD_ALLOWED_USERS=
DISCORD_HOME_CHANNEL=WEBSITE_TASKS_CHANNEL_ID
GATEWAY_ALLOW_ALL_USERS=true
DISCORD_ALLOW_BOTS=mentions
```

For a clean production setup, create a separate Discord application/bot named `ProfitsLocal Website Agent`, invite it to the server, and give it access only to `#website-tasks`, `#sandbox`, and any needed threads.

Why `DISCORD_ALLOW_BOTS=mentions`: sales/revision automation can hand work to `website-agent` by posting a task packet that explicitly mentions the bot. Generic bot/webhook notifications remain ignored, which prevents noisy loops.

Why `GATEWAY_ALLOW_ALL_USERS=true`: this channel is dedicated to website execution and should accept customer-order handoffs without requiring every webhook/bot author ID to be pre-registered. Keep the bot scoped to `#website-tasks` and `#sandbox`.

## SOUL Requirements

Use `scripts/hermes/setup-website-agent-profile.js` to write the recommended `SOUL.md`. The key behavioral contract is:

- one case/thread equals one durable customer workstream;
- read `case.json`, `context-packet.json`, `timeline.jsonl`, and `customer-messages.jsonl` before deciding;
- use existing workflows for `route-funnel-event`, `agent:complete-task`, and `publish-approved`;
- push customer-facing site changes only to `dev`;
- publish `dev` to `main/live` only after explicit approval with matching order ID and checkout email;
- send or trigger customer emails for review/publish milestones.

## Verification

After creating the channel and setting the profile token:

```bash
npm run hermes:setup-website-agent -- --channel WEBSITE_TASKS_CHANNEL_ID
npm run hermes:set-website-agent-token -- --channel WEBSITE_TASKS_CHANNEL_ID
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/ai.hermes.gateway-website-agent.plist
launchctl print gui/$(id -u)/ai.hermes.gateway-website-agent
```

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

## Current Validation

Verified locally on 2026-05-05:

- `ai.hermes.gateway-website-agent` LaunchAgent starts and stays running.
- The dedicated bot can see `#website-tasks` (`1501072883001065614`).
- A bot/webhook-style message from another Discord app only triggers when it mentions `website-agent`.
- Hermes creates a dedicated Discord thread for the handoff message.
- `website-agent` completes a model smoke test in that thread with `openai-codex / gpt-5.4-mini`.

Known non-blocking warning: Discord slash command registration is over the server limit, so a few slash commands are skipped. Normal message/thread pickup works.
