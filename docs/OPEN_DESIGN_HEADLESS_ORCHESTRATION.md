# Open Design Headless Orchestration

Updated: 2026-05-06

## Purpose

This document records how ProfitsLocal can call Open Design through its native daemon/API instead of manually operating the desktop app every time.

The goal is not to fork Open Design. The goal is to use Open Design as a design engine and then bring its concept output back into the ProfitsLocal production workflow.

## Current Finding

Open Design does not currently expose a simple `od generate` command for design artifacts.

The supported headless path is:

1. Start the Open Design daemon.
2. Create a project through the daemon API.
3. Start a chat run through the daemon API.
4. Stream run events.
5. Read generated project files from the daemon project workspace.

The daemon handles:

- agent detection;
- skill loading;
- design-system loading;
- prompt composition;
- project workspace creation;
- agent process spawning;
- SSE run event streaming;
- artifact file serving.

## 2026-05-07 Update

Two different concerns must stay separate:

1. **Project creation / app visibility**: this already works in `app-visible` mode. New ProfitsLocal projects do appear in the Mac Open Design app because they are created inside the shared `.od/projects/<projectId>` workspace.
2. **Headless completion / artifact capture**: this was the real blocker. Some long Codex runs created a valid project and real concept files but never emitted a clean terminal `end` event before timeout.

Current ProfitsLocal runner behavior:

- start the run normally through the daemon API;
- watch the real Open Design project directory under `.od/projects/<projectId>`;
- ignore dot-directories such as `.od-skills`;
- require at least one real visible `.html` page before declaring success;
- if the project has gone quiet for the configured window, cancel the hanging run and export files directly from disk with `completionMode: artifact_quiet_fallback`.

Latest verified evidence:

- project: `od-fallback-proof-3`
- run: `8691a4c6-35bd-4f0a-9e7f-a1202ca794d2`
- status: `succeeded`
- completion mode: `artifact_quiet_fallback`
- exported files:
  - `index.html`
  - `menu.html`
  - `functions.html`
  - `contact.html`
  - `brand-spec.md`
  - local `assets/*`

This means the remaining problem is no longer "can Open Design create visible projects?" The proven path now is: **create project in app-visible mode, let the headless run work until artifacts exist, then recover the real concept files from the same shared project workspace if the run hangs.**

## 2026-05-08 Deeper Finding

After tracing both ProfitsLocal's runner and Open Design daemon internals, the failure is now much more precise:

1. **Open Design daemon only emits `event: end` after the spawned child process actually closes.**
   - `apps/daemon/src/runs.ts` emits the terminal `end` SSE frame inside `finish(...)`.
   - `apps/daemon/src/server.ts` calls `design.runs.finish(...)` from the child `close` handler.
   - Therefore, if the Codex child has written real files but has not naturally exited yet, the daemon will not emit `event: end`.

2. **ProfitsLocal's fallback is not replacing native generation. It is only replacing native completion detection.**
   - The project, files, and design work are still produced inside the real Open Design project workspace.
   - The fallback only says: "there is already a real concept on disk, but no terminal event arrived."

3. **There are two different failure modes and they must not be mixed together.**

### Mode A: artifacts exist, but there is no clean terminal end

This is the current `artifact_quiet_fallback` case.

Observed evidence:

- `clients/od-fallback-proof-3/concept/open-design/run-events.sse`
  - no `event: end`
  - no terminal `status: succeeded` payload
- `clients/od-fallback-proof-3/concept/open-design/run-status.json`
  - `completionMode: artifact_quiet_fallback`
- real files already existed:
  - `index.html`
  - `menu.html`
  - `functions.html`
  - `contact.html`
  - `brand-spec.md`

Meaning:

- native Open Design project creation worked;
- native Open Design run work happened;
- the remaining missing part was only the terminal completion event.

### Mode B: no visible HTML artifact ever appears

This is **not** a fallback-success case. It is an actual failed or hung run.

2026-05-08 isolated smoke evidence:

- default run:
  - client: `od-clean-finish-smoke-default`
  - run: `dc300fa9-6072-4c9f-9f64-2cd1b2f1c3b1`
  - result: timeout
  - project folder had downloaded assets but no visible `.html` artifact
- plugins-disabled run:
  - client: `od-clean-finish-smoke-noplugins`
  - run: `3b1575c9-f259-49b4-863a-f74418c26610`
  - result: timeout
  - disabling plugins did **not** by itself restore native clean finish or even first-html completion in this reproduction

Meaning:

- if there is no first visible HTML page, quiet fallback must not declare success;
- this case should be treated as a run failure / timeout and investigated separately.

### Practical conclusion

The current best operating model is:

- **trust the shared Open Design project as the design workspace;**
- **treat `artifact_quiet_fallback` as acceptable only when real visible artifacts already exist;**
- **treat "no visible HTML" as a hard failure;**
- **do not claim native clean finish unless `run-events.sse` actually contains `event: end` or the run status endpoint reaches terminal success before fallback.**

Reference summary:

- `data/qa/open-design/headless-completion-investigation-20260508.json`

## Runtime Requirement

Open Design currently declares Node `~24`. On this machine, the default `node` is `v25.6.1`, which failed to start the daemon because `better-sqlite3` was compiled against the Node 24 ABI.

Working command:

```bash
/Users/matthew/.local/share/mise/installs/node/24.15.0/bin/node apps/daemon/dist/cli.js --port 7466 --no-open
```

Observed failure with Node 25:

```text
better_sqlite3.node was compiled against NODE_MODULE_VERSION 137.
Node.js v25.6.1 requires NODE_MODULE_VERSION 141.
```

ProfitsLocal automation should pin Open Design runs to Node 24, or run through `mise exec node@24 -- ...`.

## Build / Start

Build daemon:

```bash
cd /Users/matthew/Developer/open-design
pnpm --filter @open-design/daemon build
```

Start daemon with isolated data for smoke tests:

```bash
OD_PORT=7466 \
OD_DATA_DIR=/tmp/open-design-headless-smoke \
/Users/matthew/.local/share/mise/installs/node/24.15.0/bin/node \
  apps/daemon/dist/cli.js --port 7466 --no-open
```

Health check:

```bash
curl -s http://127.0.0.1:7466/api/health
```

Verified response:

```json
{"ok":true,"version":"0.3.0"}
```

## Key APIs

### List Agents

```bash
curl -s http://127.0.0.1:7466/api/agents
```

Detected locally during smoke:

| Agent | Available | Notes |
|---|---:|---|
| `claude` | yes | Claude Code, stream JSON |
| `codex` | yes | Codex CLI, JSON event stream |
| `opencode` | yes | OpenCode, JSON event stream |
| `hermes` | yes | ACP JSON-RPC |
| `kimi` | yes | ACP JSON-RPC |
| `devin` | no | Not installed |
| `gemini` | no | Not installed |
| `cursor-agent` | no | Not installed |
| `qwen` | no | Not installed |
| `copilot` | no | Not installed |

### List Skills

```bash
curl -s http://127.0.0.1:7466/api/skills
```

Relevant skills found:

- `web-prototype`
- `saas-landing`
- `design-brief`
- `critique`
- `tweaks`

### List Design Systems

```bash
curl -s http://127.0.0.1:7466/api/design-systems
```

Relevant available systems include `cafe`, `atelier-zero`, `apple`, `airbnb`, `stripe`, `vercel`, and many others.

### Create Project

```bash
curl -s -X POST http://127.0.0.1:7466/api/projects \
  -H 'content-type: application/json' \
  -d '{
    "id": "rich-rare-redesign-concept",
    "name": "Rich & Rare redesign concept",
    "skillId": "web-prototype",
    "designSystemId": null,
    "metadata": {
      "kind": "prototype",
      "fidelity": "high"
    }
  }'
```

Response includes:

- `project.id`
- `conversationId`

### Start Run

```bash
curl -s -X POST http://127.0.0.1:7466/api/runs \
  -H 'content-type: application/json' \
  -d '{
    "agentId": "codex",
    "projectId": "rich-rare-redesign-concept",
    "conversationId": "<conversationId>",
    "assistantMessageId": "assistant-<timestamp>",
    "clientRequestId": "client-<timestamp>",
    "skillId": "web-prototype",
    "designSystemId": null,
    "model": "default",
    "reasoning": "low",
    "message": "Skip questions. Redesign https://www.richandrare.com.au/ as a responsive luxury steak and seafood restaurant website. Match the existing brand. Preserve logo, menu, booking, contact, sitemap intent, and existing core content. Build a full concept with 3-4 key pages."
  }'
```

Response:

```json
{"runId":"..."}
```

### Stream Events

```bash
curl -N http://127.0.0.1:7466/api/runs/<runId>/events
```

The stream includes:

- `start`
- `stderr`
- `agent`
- `end`

### Read Files

```bash
curl -s http://127.0.0.1:7466/api/projects/<projectId>/files
curl -s http://127.0.0.1:7466/api/projects/<projectId>/raw/index.html
```

## Smoke Test Evidence

### Direct Daemon API Smoke

Smoke project:

```text
pl-od-headless-smoke-1778064622
```

Run:

```text
c8c79376-3118-480b-b611-dd369435d6c4
```

Run status:

```json
{
  "status": "succeeded",
  "agentId": "codex",
  "exitCode": 0
}
```

Generated file:

```text
/tmp/open-design-headless-smoke/projects/pl-od-headless-smoke-1778064622/index.html
```

File API verified:

```json
{
  "name": "index.html",
  "kind": "html",
  "mime": "text/html; charset=utf-8",
  "artifactKind": "html"
}
```

Generated content included:

```html
<main>OD headless smoke ok</main>
```

### ProfitsLocal Runner Smoke

Command:

```bash
npm run open-design:run-concept -- \
  --client od-runner-smoke \
  --agent codex \
  --scope smoke \
  --business-type "restaurant" \
  --tone "clean smoke test" \
  --prompt "Skip questions. Headless ProfitsLocal integration smoke. Do not fetch the web. Use Open Design web-prototype skill context. Create a tiny standalone index.html saying 'ProfitsLocal Open Design runner ok'. Keep it under 80 lines. Emit the artifact." \
  --timeout-ms 240000
```

Verified output:

```text
clients/od-runner-smoke/concept/open-design/
├── concept-manifest.json
├── index.html
├── prompt.txt
├── run-events.sse
└── run-status.json
```

Manifest evidence:

```json
{
  "clientSlug": "od-runner-smoke",
  "projectId": "od-runner-smoke-open-design-1778065065620",
  "runId": "5619ec8b-4c9b-4487-a584-be618f76548c",
  "status": "succeeded",
  "agentId": "codex",
  "skillId": "web-prototype",
  "files": [
    {
      "path": "index.html",
      "kind": "html",
      "artifactKind": "html"
    }
  ]
}
```

Generated HTML contains:

```html
<h1>ProfitsLocal Open Design runner ok</h1>
```

The script automatically started the Open Design daemon with Node 24, created the project, launched the run, streamed events, exported files to the ProfitsLocal client concept folder, wrote `concept-manifest.json`, and stopped the daemon.

### Real Rich & Rare Concept Smoke

Command:

```bash
npm run open-design:run-concept -- \
  --client rich-and-rare-restaurant \
  --agent codex \
  --source-url https://www.richandrare.com.au/ \
  --business-type "restaurant - steak and seafood restaurant" \
  --tone "Luxury / refined, match existing Rich & Rare brand" \
  --scope "Full concept with 3-4 key pages" \
  --prompt "[form answers — discovery]
- Primary surface: Responsive — all sizes
- Who is this redesign for?: restaurant - steak and seafood restaurant
- Visual tone: Luxury / refined
- Brand context: Match a reference site / screenshot — I'll attach it
- What should I redesign first?: Full concept with 3–4 key pages
- Source website: https://www.richandrare.com.au/
- Anything else I should know?: Preserve the existing Rich & Rare brand, logo, menu, booking/contact/location intent, current sitemap intent, and official business facts. This is concept generation only. Do not deploy and do not edit any ProfitsLocal production repo." \
  --timeout-ms 900000
```

Verified output:

```text
clients/rich-and-rare-restaurant/concept/open-design/
├── assets/
│   ├── dining-room-service.webp
│   ├── dining-room.webp
│   ├── location.webp
│   ├── rich-rare-logo.webp
│   └── seafood-plate.webp
├── screenshots/
│   ├── desktop.png
│   └── mobile.png
├── brand-spec.md
├── concept-manifest.json
├── index.html
├── prompt.txt
├── run-events.sse
├── run-status.json
└── source-*.html
```

Manifest evidence:

```json
{
  "clientSlug": "rich-and-rare-restaurant",
  "projectId": "rich-and-rare-restaurant-open-design-1778065212163",
  "runId": "2a69100b-a214-4488-ad6c-0a58277b00b5",
  "status": "succeeded",
  "agentId": "codex",
  "skillId": "web-prototype",
  "fileCount": 15
}
```

The concept run generated:

- `brand-spec.md` with extracted Rich & Rare tokens, Montserrat body typography, logo/photo notes, menu intent, contact facts, and layout posture;
- `source-home.html`, `source-lunch-dinner.html`, `source-bookings.html`, `source-contact.html`, and other captured source pages;
- local `.webp` assets including the Rich & Rare logo and restaurant photography;
- `index.html` concept using official facts such as West Village, 97 Boundary Street, West End, and `(07) 3638 8888`;
- desktop/mobile screenshots rendered with Playwright.

The run event log shows Open Design/Codex completed the expected design workflow steps: read seed/layout/checklist, confirm brand spec, plan concept rhythm, fill sourced copy and imagery, replace placeholders, run checklist, critique five dimensions, and emit the artifact.

Latest validator evidence:

```bash
npm run open-design:validate-concept -- \
  --client rich-and-rare-restaurant \
  --require-source-pages \
  --require-screenshots \
  --must-contain "West Village" \
  --must-contain "(07) 3638 8888"
```

Result on 2026-05-06:

```json
{
  "ok": true,
  "clientSlug": "rich-and-rare-restaurant",
  "projectId": "rich-and-rare-restaurant-open-design-1778065212163",
  "runId": "2a69100b-a214-4488-ad6c-0a58277b00b5",
  "status": "succeeded",
  "counts": {
    "files": 15,
    "htmlFiles": 9,
    "sourcePages": 8,
    "imageAssets": 5,
    "screenshots": 2,
    "requiredTextChecks": 2
  },
  "warnings": [],
  "errors": []
}
```

Important cost note: even a tiny run showed a very large composed prompt because Open Design injects its discovery layer, official designer prompt, skill body, and supporting context. This is acceptable for high-value redesign concept runs, but we should avoid using this path for tiny utility edits.

## Adapter Behavior

### Codex

Open Design runs Codex as:

```text
codex exec --json --skip-git-repo-check --full-auto \
  -c sandbox_workspace_write.network_access=true \
  -C <project-dir>
```

Prompt is passed through stdin.

Notes:

- Works in local smoke.
- Current Codex prints a deprecation warning for `--full-auto`; future Open Design may need to update to `--sandbox workspace-write`.
- `OD_CODEX_DISABLE_PLUGINS=1` can be set for cleaner non-plugin runs.

### Claude Code

Open Design runs Claude Code as:

```text
claude -p --output-format stream-json --verbose --permission-mode bypassPermissions
```

Prompt is passed through stdin. Extra skill/design-system directories may be exposed with `--add-dir` when supported.

### OpenCode

Open Design runs OpenCode as:

```text
opencode run --format json --dangerously-skip-permissions -
```

Prompt is passed through stdin.

### Hermes

Open Design runs Hermes through ACP:

```text
hermes acp --accept-hooks
```

This is especially relevant for ProfitsLocal because our internal operating model already uses Hermes plus Discord. Open Design can be used as the design engine while Hermes remains the internal project operator.

## Recommended ProfitsLocal Automation Shape

### Phase 1: Import/Export Path

Use this first because it is highest quality and lowest risk:

1. Operator or automation creates Open Design concept.
2. Export or copy concept files.
3. Store under:

```text
clients/<client>/concept/open-design/
```

4. Run ProfitsLocal concept importer.
5. Translate concept into Webjuice/Astro.
6. Run QA and deploy.

Current production handoff command:

```bash
npm run open-design:build-production-handoff -- \
  --client rich-and-rare-restaurant \
  --content data/collect-smoke/rich-and-rare/client/content.restaurant.json \
  --design data/collect-smoke/rich-and-rare/client/design.restaurant.json \
  --evidence data/collect-smoke/rich-and-rare/evidence.json \
  --survey data/collect-smoke/rich-and-rare/client/intake/website-survey.json \
  --target-repo /Users/matthew/Developer/webjuice-generated/rich-and-rare-restaurant \
  --target-branch dev
```

Verified output:

```text
clients/rich-and-rare-restaurant/concept/open-design/production-handoff.json
clients/rich-and-rare-restaurant/concept/open-design/production-handoff.md
```

The handoff is intentionally not a blind HTML copier. It tells the production
agent to use Open Design for visual direction and layout rhythm, while business
facts still come from evidence/content/design/survey artifacts.

Rich & Rare handoff evidence on 2026-05-06:

```json
{
  "ok": true,
  "status": "ready",
  "conceptFiles": 15,
  "sourcePages": 8,
  "assets": 5,
  "branch": "dev",
  "warnings": []
}
```

### Phase 2: Headless Open Design Runner

Build a wrapper script:

```text
scripts/open-design/run-concept.js
```

Implemented command:

```bash
npm run open-design:run-concept -- \
  --client rich-and-rare-restaurant \
  --source-url https://www.richandrare.com.au/ \
  --business-type "restaurant - steak and seafood restaurant" \
  --tone "luxury/refined, match the existing brand" \
  --scope "full concept with 3-4 key pages" \
  --agent codex
```

Workspace mode:

```bash
# safe background automation; desktop/source app will not show the project
--mode isolated

# writes into /Users/matthew/Developer/open-design/.od so the source app can show the project
--mode app-visible

# use a known desktop-app data root explicitly
--data-dir /absolute/path/to/open-design-data
```

Inputs:

- `--client`
- `--source-url`
- `--agent codex|claude|opencode|hermes`
- `--skill web-prototype|saas-landing`
- `--design-system <optional>`
- `--scope homepage|multi-page`
- `--out clients/<client>/concept/open-design`

Responsibilities:

1. Ensure Open Design daemon is running with Node 24.
2. Create project.
3. Start run.
4. Stream and save run events.
5. Copy project files to the ProfitsLocal concept folder.
6. Write `concept-manifest.json`.
7. Write `.profitslocal-sync.json` into the Open Design project folder when possible.

Validation command:

```bash
npm run open-design:validate-concept -- \
  --client rich-and-rare-restaurant \
  --require-source-pages \
  --require-screenshots \
  --must-contain "West Village" \
  --must-contain "(07) 3638 8888"
```

The validator checks:

- `concept-manifest.json` exists and has `status: succeeded`;
- `run-status.json` exists and succeeded;
- exported files listed in the manifest exist on disk;
- `index.html` is a complete HTML document;
- `brand-spec.md` exists when `sourceUrl` is present;
- captured `source-*.html` pages exist when required;
- screenshots exist when required;
- critical business facts are present in the concept output or brand spec.

This does not replace delivery QA. It only proves the Open Design concept folder
is complete enough to hand to the production import step.

Continue command for Discord/thread follow-up changes:

```bash
npm run open-design:continue-concept -- \
  --client rich-and-rare-restaurant \
  --prompt "Make the private dining section feel more premium and keep the existing brand."
```

This continues the existing Open Design project from the concept manifest instead
of creating a new project.

See also:

- `docs/OPEN_DESIGN_PROJECT_SYNC.md`
- `docs/OPEN_DESIGN_UPGRADE_SOP.md`

### Phase 3: Discord/Hermes Integration

For a paid or internal redesign task, the Discord thread should include:

- `openDesignConceptPath`
- `openDesignProjectId`
- `openDesignRunId`
- `brandSpecPath`
- `preservationPacketPath`
- `productionRepo`
- `targetBranch: dev`

The thread remains the human/agent workspace. Open Design provides the concept artifact.

## Open Questions

1. Whether Open Design has or will add a first-class `od generate` command.
2. Whether we should use `codex`, `claude`, or `hermes` as the default agent for Open Design concept runs.
3. How to reduce prompt/token cost for automated batches without losing design quality.
4. Whether concept imports should preserve Open Design's SQLite project id or only copy output files.
5. How to capture Open Design preview screenshots automatically for concept QA.
