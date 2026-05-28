# Open Design Headless Orchestration

Updated: 2026-05-06

## Purpose

This document records how ProfitsLocal can call Open Design through its native daemon/API instead of manually operating the desktop app every time.

The goal is still to use Open Design as the upstream design engine and then bring its concept output back into the ProfitsLocal production workflow. We now maintain a small ProfitsLocal fork so business-critical patches can land safely without waiting for the upstream release cadence.

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
2. **Headless completion / artifact capture**: this looked like the blocker, but the root cause turned out to be more specific:
   - we had a false-positive fallback bug in ProfitsLocal;
   - and several “native failures” were actually short-timeout false negatives.

Current ProfitsLocal runner behavior:

- start the run normally through the daemon API;
- watch the real Open Design project directory under `.od/projects/<projectId>`;
- ignore dot-directories such as `.od-skills`;
- require at least one real visible `.html` page before declaring success;
- if the project has gone quiet for the configured window, cancel the run and export files directly from disk with `completionMode: artifact_quiet_fallback`.

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

### Mode 0: false-positive fallback because `source-*.html` was miscounted

This was a **ProfitsLocal runner bug**, not an Open Design success.

Before the fix, our quiet-artifact scanner accepted any visible `.html` file. That accidentally included captured
source pages such as `source-darkshepherd.html`.

That allowed this bad sequence:

- the run captures a source page;
- assets are downloaded;
- the directory goes quiet for the configured window;
- ProfitsLocal cancels the still-live run;
- the run is recorded as `completionMode: artifact_quiet_fallback`;
- but no generated `index.html` or other concept page ever existed.

Reproduced evidence:

- client: `od-rootcause-smoke`
- run: `a38c36ca-6f50-4ef2-a877-201756bec187`
- exported files: only `source-darkshepherd.html` plus metadata
- `run-events.sse` still showed the agent saying it would write the brand spec and HTML files next

This is now fixed:

- `source-*.html` no longer counts toward fallback readiness;
- a project must contain at least one **non-source** html artifact before quiet fallback may fire.

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

### Mode B: no generated HTML artifact ever appears

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

Additional evidence after fixing the false-positive scanner:

- client: `od-rootcause-smoke-fixed`
- run: `8cefc208-e04b-4f4f-8487-00983e7b3687`
- result: timeout
- project folder contained only downloaded assets
- no generated `index.html` / `menu.html` / `contact.html` existed
- the event stream showed the agent planning to write HTML next, then only keepalives

### Mode C: short-timeout false failure

This is the main 2026-05-08 business root cause.

What happened:

- investigation runs were being launched with `--timeout-ms 120000` or `--timeout-ms 180000`;
- those values are too short for `codex + web-prototype` to reliably finish a real restaurant redesign flow;
- that made ordinary long Codex runs look like native Open Design failures.

Hard evidence:

- `od-rootcause-appvisible` timed out at `180000ms` before a visible generated html page appeared;
- `od-rootcause-appvisible-long` used the same source site with `600000ms` timeout and succeeded;
- `od-rootcause-appvisible-nofallback` used `600000ms` timeout plus `artifact-quiet-ms=3600000`, then reached:
  - generated `brand-spec.md`
  - generated `index.html/menu.html/functions.html/drinks-menu.html/contact.html`
  - final artifact payload
  - usage payload
  - terminal `event: end`

This proves the earlier short-timeout samples were not valid evidence that native clean finish was broken.

### Practical conclusion

The current best operating model is:

- **trust the shared Open Design project as the design workspace;**
- **normal business runs must use the default no-fallback path and finish with native `event:end` / terminal success;**
- **use `artifact_quiet_fallback` only as explicit rescue mode with `--allow-artifact-fallback`, and only when real visible artifacts already exist;**
- **treat "no visible HTML" as a hard failure;**
- **for `codex + web-prototype`, do not use a timeout below `600000ms` unless you are deliberately running a failure experiment;**
- **when ProfitsLocal triggers `/api/runs` directly, also persist an assistant message with `run_id/run_status`, otherwise Open Design's Pipeline/Kanban will keep showing the project as `Not started`;**
- **do not claim native clean finish unless `run-events.sse` actually contains `event: end` or the run status endpoint reaches terminal success before fallback.**
- **if Open Design asks a question form, automation must answer from the lead handoff and rerun; unresolved question forms block validation.**
- **every accepted concept must pass `open-design:audit-concept`; native finish only proves the run ended, not that the generated website is good enough.**

Reference summary:

- `data/qa/open-design/headless-completion-investigation-20260508.json`

## 2026-05-08 Additional Finding: nested source pages must not count as generated artifacts

One more false-success path was identified during the long-term restaurant redesign smoke:

- the project contained only seeded source pages under `source/home.html`, `source/menu.html`, etc.;
- ProfitsLocal's quiet-artifact scanner was already fixed to ignore `source-*.html`;
- but it still treated nested `source/<page>.html` files as generated HTML.

That caused another premature `artifact_quiet_fallback` success even when the concept had not yet produced a canonical `index.html`.

This is now fixed:

- `isSourceCaptureHtml(...)` ignores both:
  - `source-*.html`
  - `source/<page>.html`
- `validate-concept` accepts both source-page layouts when checking redesign preservation output.

Result:

- source capture pages are still preserved and exported;
- but they can no longer masquerade as a finished concept entry page.

## 2026-05-08 Stable Pattern For Real Restaurant Redesign Smoke

For real redesign verification, the most stable path is now:

1. pre-capture the official source pages ourselves;
2. seed them into the Open Design project under `source/`;
3. ask Open Design to design from the local source captures first;
4. require a canonical `index.html` and `brand-spec.md` before the smoke passes.

Why this is better:

- it matches the real ProfitsLocal business flow: `survey/evidence -> design`;
- it reduces fragile live recrawling during the design run;
- it still preserves official source pages for redesign auditability.

Verified example:

- client: `rich-and-rare-longterm-smoke-v4`
- project: `rich-and-rare-longterm-smoke-v4-open-design-1778193842482`
- run: `faad21c0-1f3a-465b-a90a-1d789d01df7d`
- result:
  - `status: succeeded`
  - `completionMode: artifact_quiet_fallback`
  - exported:
    - `index.html`
    - `brand-spec.md`
    - `source/home.html`
    - `source/menu.html`
    - `source/functions.html`
    - `source/contact.html`
    - `source/bookings.html`
    - local official assets
- validation:
  - `files: 11`
  - `htmlFiles: 6`
  - `sourcePages: 5`
  - `imageAssets: 3`
  - `errors: []`

Evidence:

- `data/qa/open-design/rich-and-rare-longterm-smoke-v4-summary.json`

## 2026-05-09 Core Website Generation SOP

Open Design website generation is now a core ProfitsLocal production capability, not a casual prototype step. A run is not accepted just because an HTML file exists. It must finish natively, use the intended assets, preserve verified business facts, and pass the website quality gate.

### Stable Input Contract

Before starting a real Open Design website run, ProfitsLocal must prepare one clear handoff packet:

- verified business facts: name, niche, service area, contact paths, website/contact page/social links when available;
- selected offer mode: one-page preview, multi-page preview, redesign preview, or paid build handoff;
- design language: reference screenshots/links, extracted design signals, palette/typography direction, section rhythm, and any `DESIGN.md` contract;
- approved image pack: seeded raster assets under `assets/` with manifest and hashes; these are primary visual inputs, not optional decoration;
- content plan: hero angle, service list, trust/proof modules, FAQ, process, CTA, contact form, and footer;
- local SEO requirements: one H1 with business type and service area, LocalBusiness or niche-specific JSON-LD, real Google Maps/directions URL when an address or service-area placeholder is available, image alt text, and lazy loading;
- copy guardrails: no internal audit language, no fake phone/email/address/licence/award/review, and demo reviews must be marked as placeholders.

The best current pattern is **medium framework with visual freedom**: give Open Design enough structure and evidence, but do not over-prescribe every layout detail. Heavy constraints made earlier outputs stiff and text-heavy. Minimal prompts can look better, but are less reliable for facts and conversion requirements. Template-lab should keep testing this balance.

### Daemon And Asset Alignment

The Open Design daemon must be the daemon that sees the same project workspace and seeded assets as the ProfitsLocal runner.

Required rule:

- `OD_DATA_DIR and seeded assets stay aligned`.

The runner now refuses silent reuse of a daemon on an explicitly requested port when that daemon may point at a different data directory. If a default daemon is already healthy and no explicit daemon URL was requested, the runner chooses a fresh available port for isolated runs.

This prevents the repeated failure pattern where Open Design ran against a different project/data directory than the one ProfitsLocal seeded, causing missing assets, poor pages, or misleading fallback results.

### Native Completion Gate

For business-critical website generation:

- accepted completion requires native clean finish: terminal `event:end` or terminal success from the run status endpoint;
- `artifact_quiet_fallback` is rescue-only and must be explicitly allowed with `--allow-artifact-fallback`;
- fallback can never be used to approve a public template, outreach mockup, or paid customer handoff;
- no visible generated HTML is a hard failure;
- source captures under `source/` or `source-*.html` never count as generated concept pages;
- question forms must be answered automatically from the handoff packet and then the run continues;
- Open Design should receive enough timeout for real work. For `codex + web-prototype`, use at least `600000ms`; template runs commonly need close to 10 minutes.
- the SSE stream must stop watching immediately when a terminal `event:end` frame is parsed. Do not wait for the HTTP/SSE connection itself to close; some daemon/client combinations keep the stream open after native success, which makes the app and outer runner look stuck even though Open Design already finished.

### Quality Gate

Native finish only proves the agent stopped cleanly. It does not prove the website is good.

Every accepted website concept must pass a separate quality gate:

- approved image pack used, with SHA-256 matches where possible;
- first viewport looks like a real local business website, not a text article or generic placeholder;
- no horizontal strip / broken layout / low-density page that clearly missed the reference style;
- strong niche-relevant imagery or approved generated imagery;
- business facts are accurate or clearly marked as demo placeholders;
- CTA path is visible: call, quote, booking, contact form, or directions;
- contact form exists when the offer expects lead capture;
- local SEO basics exist: title, H1, schema, map/directions URL, service area, meaningful alt text;
- copy is customer-facing and specific enough for outreach;
- redesigns must show what the current site does poorly and what the mockup improves.

Hard reject if any of these are true:

- completion used fallback without explicit rescue approval;
- seeded/approved assets were ignored and replaced by generic SVGs or unrelated images;
- internal terms appear in the customer-facing page, such as audit notes, skill names, or pipeline language;
- fake verified claims appear, such as invented licences, awards, years in business, prices, reviews, addresses, phone numbers, or emails;
- the page looks like the old failed outputs: thin text blocks, poor image use, repeated horizontal bands, or no credible local-business conversion path.

### Evidence Checklist

Each accepted run must leave hard evidence in repo artifacts:

- `concept-manifest.json`;
- `run-status.json`;
- `run-events.sse`;
- generated HTML and asset files;
- desktop and mobile screenshots;
- approved asset manifest / hashes;
- quality audit JSON/Markdown;
- Open Design start/end time, run ID, completion mode, question-form rounds, tool count, and produced file list.

For template experiments, current evidence format lives under:

```text
data/template-experiments/<niche>/<family>/<page>-<run-id>/<variant>/
```

Latest stable roofing evidence:

- run: `home-live-medium-v6-2026-05-09`
- variant: `medium-framework-no-llm`
- score: `96`
- native clean finish: `true`
- completion mode: `native`
- approved assets matched: `5/5`
- local business score: `94`
- important pass: real Google Maps URL, JSON-LD, H1 with service area, image alt/lazy hygiene, review placeholder provenance.

This v6 run is the current minimum bar for future Open Design website work.

### Watcher Recommendation

ProfitsLocal should not build a separate second Open Design orchestration system. The right path is a **runner-integrated watcher**:

```text
existing run-concept / continue-concept
  -> stream SSE events
  -> poll run status
  -> scan project files
  -> detect question forms
  -> run checkpoint decisions
  -> write repo/admin state
  -> send special Discord alerts when human attention is needed
```

The watcher should treat timeout as a checkpoint, not an automatic kill:

- no generated HTML and no recent activity: mark stuck/failed and notify special alerts webhook;
- generated HTML exists but no native end: keep waiting or continue same project; do not approve yet;
- recent tool/file activity exists: extend the watch window;
- question form appears: auto-answer from handoff packet and continue;
- native end arrives: export, screenshot, audit, score, and update admin.
- if the Mac app does not show a running project, first check the runner mode. `isolated` runs write to `/tmp/profitslocal-open-design-*` and are intentionally invisible in the normal app. Use `--mode app-visible` when Matthew needs to watch the project in Open Design; this writes into `/Users/matthew/Developer/open-design/.od/projects`.

Special alerts should use:

```text
SPECIAL_ALERTS_DISCORD_WEBHOOK_URL
```

Use this only for exceptional states: stuck Open Design run, repeated question-form loop, timeout with artifacts but no native finish, quality-gate failure after generation, or manual approval checkpoint. Normal progress should continue to use the existing case/thread/project state so Discord does not become noisy.

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
  --timeout-ms 600000
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
