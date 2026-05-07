# Open Design Project Sync SOP

Updated: 2026-05-07

## Purpose

ProfitsLocal needs Open Design in two different ways:

1. Automated concept generation from Discord/Hermes or scripts.
2. Human-visible visual editing in the Open Design desktop/source app.

Both are useful. The rule is that Open Design remains the concept workspace, while Webjuice/Astro repos remain the production workspace.

## Workspace Model

```text
Discord thread / case memory
  owns customer conversation, decisions, task status

Open Design project
  owns high-fidelity concept, brand extraction, visual exploration

Customer repo
  owns production Astro implementation, dev/main branches, deploys

ProfitsLocal central repo
  owns evidence, content artifacts, case memory, QA, emails, domain, finance
```

## Modes

### 1. Isolated Automation Mode

Use when running background jobs or batch tests.

Command:

```bash
npm run open-design:run-concept -- \
  --client <client> \
  --mode isolated \
  --source-url <url>
```

Data directory:

```text
/tmp/profitslocal-open-design-<client>/
```

Pros:

- safe for automation;
- will not pollute the desktop app project list;
- easy to delete after tests.

Cons:

- the Open Design desktop/source app will not show the project unless pointed to the same `OD_DATA_DIR`.

### 2. App-Visible Source Mode

Use when Matthew wants to see and continue the project inside the Open Design source app.

Command:

```bash
npm run open-design:run-concept -- \
  --client <client> \
  --mode app-visible \
  --source-url <url>
```

Data directory:

```text
/Users/matthew/Developer/open-design/.od/
```

Pros:

- project appears in the source Open Design app that uses the repo `.od`;
- useful for visual inspection and manual continuation;
- still exports a ProfitsLocal concept folder.

Cons:

- the packaged desktop app may use a different app-support data root;
- projects can accumulate in the Open Design UI, so naming matters.

### 3. Explicit Data Directory Mode

Use when the packaged desktop app data path is known.

Command:

```bash
npm run open-design:run-concept -- \
  --client <client> \
  --data-dir "/absolute/path/to/open-design-data" \
  --source-url <url>
```

This is the safest way to make automation and a specific desktop app instance share the same project list.

## Continuing A Concept From Discord

When a Discord thread asks for visual concept changes, do not create a brand-new concept by default. Continue the existing Open Design project:

```bash
npm run open-design:continue-concept -- \
  --client <client> \
  --prompt "Make the menu page more editorial and add a stronger private dining section."
```

This reads:

```text
clients/<client>/concept/open-design/concept-manifest.json
```

Then it:

- starts the Open Design daemon with the same `dataDir`;
- verifies the existing project is visible;
- appends a new run to the same project/conversation;
- exports the updated files back to `clients/<client>/concept/open-design/`;
- updates `concept-manifest.json`;
- writes `.profitslocal-sync.json` into the Open Design project folder.

If the daemon is running but the project is not visible, the script stops. That usually means the daemon is using the wrong `OD_DATA_DIR`.

## Moving From Open Design Back To Production

After the visual concept is accepted, create/update the production handoff:

```bash
npm run open-design:build-production-handoff -- \
  --client <client> \
  --content <content-artifact> \
  --design <design-artifact> \
  --evidence <evidence-artifact> \
  --survey <website-survey> \
  --target-repo <customer-repo> \
  --target-branch dev
```

The production agent must read:

```text
clients/<client>/concept/open-design/production-handoff.md
clients/<client>/concept/open-design/production-handoff.json
```

Important rule:

```text
Open Design can improve layout, typography, visual rhythm, and concept copy.
Business facts must still come from ProfitsLocal evidence/content/survey artifacts.
```

## Sync Metadata

The runner writes this file into the Open Design project folder:

```text
.profitslocal-sync.json
```

It points back to:

- ProfitsLocal client slug;
- concept manifest;
- production handoff;
- Open Design project/run IDs;
- data directory;
- rule that production changes must be ported to Webjuice/Astro and pushed to `dev`.

This is the bridge that lets different tools understand the same project.

## No-Drift Operating Rule

Every website project has three working surfaces:

- Discord thread: where the operator and agents discuss the job.
- Open Design project: where the visual concept lives.
- Customer repo `dev`: where the deployable website lives.

They are allowed to be out of sync only while active work is in progress. Before a customer email, approval, publish, or domain handoff, they must be synced again.

Minimum sync check:

```text
client slug in case.json
  == client slug in concept-manifest.json
  == client slug in .profitslocal-sync.json
  == repo/client in task packet
```

If this check fails, the project is blocked until the binding is repaired.

## Scenario SOPs

### Scenario A: Discord Requests A Design Change

Use when the change starts in the project Discord thread.

1. Read `data/agent-tasks/<client>/<task>.json`.
2. Confirm `openDesign.status` is `bound`.
3. Run `open-design:continue-concept` with the user's requested change.
4. Export back to `clients/<client>/concept/open-design/`.
5. Run `open-design:build-production-handoff`.
6. Port the handoff into the customer repo `dev` branch.
7. Run build and QA.
8. Reply in the same Discord thread with project ID, preview URL, and QA path.

Hard evidence required:

- same Discord thread URL;
- same Open Design project ID;
- updated `production-handoff.json`;
- repo diff/commit on `dev`;
- QA screenshot/result after the repo update.

### Scenario B: Matthew Changes The Design In Open Design App

Use when the visual change starts in the desktop/source Open Design app.

1. Verify the Open Design project name matches the client/business.
2. Run `npm run open-design:sync-from-app -- --client <client>`.
3. Confirm `concept-manifest.json` updated.
4. Rebuild production handoff.
5. Ask `website-agent` in the same Discord thread to port the handoff to repo `dev`.
6. Run build and QA.
7. Post the result back to the same Discord thread.

Hard evidence required:

- `.profitslocal-sync.json` points to the client slug;
- concept folder timestamp changed;
- `production-handoff.json` timestamp changed;
- dev preview visually reflects the app change;
- QA screenshot/result exists.

### Scenario C: Small Repo-Only Fix

Use only for production fixes that do not change the design concept, such as typo, link, route, build, banner, SEO, sitemap, or redirect fixes.

1. Fix the customer repo `dev`.
2. Run build and QA.
3. Post the exact change and preview URL to Discord.
4. If the fix changes reusable design direction or page structure, update Open Design notes/handoff afterward.

Hard evidence required:

- repo diff/commit;
- build output;
- QA result;
- Discord timeline note.

### Scenario D: Two Places Changed At Once

This is a conflict. Do not guess silently.

Resolution order:

1. Evidence/survey/content wins for business facts.
2. Customer-approved case decisions win for scope.
3. Latest accepted Open Design handoff wins for design direction.
4. Customer repo `dev` wins for currently deployed preview behavior.

Post a short conflict summary in Discord before continuing:

```text
Sync conflict found:
- Open Design currently says: ...
- Repo dev currently says: ...
- Case/customer decision says: ...
Recommended source to keep: ...
```

Customer emails are blocked until the operator or agent resolves the conflict.

## Recommended Human Workflow

### If Matthew wants to see all projects in Open Design

Use `--mode app-visible` for new concept runs.

Then start the source Open Design app from `/Users/matthew/Developer/open-design`; it should read the repo `.od` project database.

### If Matthew edits visually in Open Design

1. Make visual changes in Open Design.
2. Sync the Open Design project back to the ProfitsLocal concept folder.
3. Run `open-design:build-production-handoff`.
4. Ask Discord/Hermes to port the accepted concept into the customer repo.
5. Run production QA and send customer review.

Sync command:

```bash
npm run open-design:sync-from-app -- --client <client>
```

### If Discord/Hermes edits visually

1. Use `open-design:continue-concept`.
2. Export updated concept files.
3. Rebuild production handoff.
4. Port to customer repo `dev`.
5. QA before customer review.

## Current Limitation

The installed packaged desktop app may not share the same data directory as the source Open Design repo. We need to identify its exact `OD_DATA_DIR` before promising that source-runner projects appear in a separately packaged app.

Until then, `--mode app-visible` means visible to the source Open Design app using:

```text
/Users/matthew/Developer/open-design/.od/
```

## Visibility Smoke Evidence

Run on 2026-05-07 after upgrading Open Design to `4c82e48e4f5f831e514eb26fbbe55a283ef1ed8a`:

```bash
npm run open-design:run-concept -- \
  --client mac-app-visible-smoke \
  --mode app-visible \
  --prompt "Skip questions. Mac app visibility smoke only. Do not fetch the web. Create index.html with heading 'Mac App Visible Smoke'." \
  --timeout-ms 240000
```

Result:

```text
Project: mac-app-visible-smoke-open-design-1778108761460
Run: 3a2fbd15-5969-4159-975d-e5cb9ba6e8d8
Output: clients/mac-app-visible-smoke/concept/open-design
```

Hard evidence:

- Open Design source app was restarted with `pnpm tools-dev start`.
- `tools-dev status` showed desktop window title `Open Design`.
- SQLite contained the project:

```sql
select id,name from projects where id like 'mac-app-visible-smoke%';
```

- Computer Use verified the Open Design Mac window project list showed `mac-app-visible-smoke Open Design concept`.
- Screenshot saved at `data/qa/open-design/mac-app-visible-smoke-project-list.png`.
- Project folder includes `.profitslocal-sync.json`:

```text
/Users/matthew/Developer/open-design/.od/projects/mac-app-visible-smoke-open-design-1778108761460/.profitslocal-sync.json
```

## Continuation / Discord Update Smoke Evidence

Run on 2026-05-07 against the same app-visible project:

```bash
npm run open-design:continue-concept -- \
  --client mac-app-visible-smoke \
  --prompt "Smoke update only. Keep the existing page, add a visible section with exact text 'Open Design Discord Update Smoke', and do not fetch the web." \
  --timeout-ms 240000
```

Result:

```text
Project: mac-app-visible-smoke-open-design-1778108761460
New run: 234582dc-9618-45b2-819e-341fb41fa52e
Output: clients/mac-app-visible-smoke/concept/open-design
```

Validation:

```bash
npm run open-design:validate-concept -- \
  --client mac-app-visible-smoke \
  --must-contain "Open Design Discord Update Smoke"
```

The validator now reports the latest continuation run as `runId` and keeps the original run as `initialRunId`.

Manual/app sync path also passed:

```bash
npm run open-design:sync-from-app -- --client mac-app-visible-smoke
```

Important remaining gap:

```text
Open Design -> ProfitsLocal concept folder is verified.
Discord handoff -> Open Design continuation is verified.
Production handoff generation exists.
Automatic port from production handoff into the Webjuice/Astro customer repo dev branch is now covered by the production port smoke below.
```

## Production Port Smoke Evidence

Run on 2026-05-07 against the real Rich & Rare generated repo:

```bash
npm run open-design:port-production-handoff -- \
  --client rich-and-rare-restaurant \
  --target-repo /Users/matthew/Developer/webjuice-generated/rich-and-rare-restaurant \
  --execute true
```

What the port does:

- writes `src/data/open-design.production-handoff.json`;
- writes `src/styles/open-design-handoff.css`;
- injects a sentinel token bridge into `src/styles/rich-rare-open-design.css`;
- copies Open Design assets into `public/open-design/rich-and-rare-restaurant/`;
- preserves verified business facts from content/evidence artifacts;
- does not copy the standalone Open Design `index.html` into production pages.

Hard evidence:

```bash
npm run open-design:test-port-production-handoff
npm run build
git -C /Users/matthew/Developer/webjuice-generated/rich-and-rare-restaurant status --short
```

Results:

```text
Customer repo commit: 22ad957 Port Open Design handoff into dev
GitHub Actions run: 25469570815
Deploy Dev: completed/success
Dev URL: https://rich-and-rare-restaurant-dev.pages.dev/ -> HTTP 200
Asset URL: /open-design/rich-and-rare-restaurant/rich-rare-logo.webp -> HTTP 200
```

This proves the design concept can move through:

```text
Open Design concept -> production handoff -> Webjuice/Astro repo dev -> Cloudflare Pages dev deploy
```

The port remains intentionally conservative. It imports structured design direction, tokens, and assets; production route/component edits still need a deliberate implementation pass for large visual changes.

## Safety Rule

Never use Open Design as the final deployed product directly for customer work. It is the design concept source, not the production source. Production delivery must pass through:

```text
production-handoff -> Webjuice/Astro repo -> dev deploy -> delivery QA -> customer approval -> live publish
```

## Truth Sources

Use this exact wording with agents:

```text
Open Design is the source of truth for visual concept and design direction.
The customer repo dev branch is the source of truth for the current development preview.
The customer repo main/live branch is the source of truth for the live customer site.
ProfitsLocal evidence/content/survey/case files are the source of truth for business facts and project memory.
```

Customer-facing versions:

- `dev` preview: work-in-progress review version;
- `live` preview/domain: approved production version.

Most work happens on `dev`.

## Discord / Hermes Contract

Every website task packet should include:

```json
{
  "openDesign": {
    "status": "bound",
    "mode": "app-visible",
    "dataDir": "/Users/matthew/Developer/open-design/.od",
    "projectId": "client-open-design-project-id",
    "conceptPath": "clients/client/concept/open-design",
    "manifestPath": "clients/client/concept/open-design/concept-manifest.json",
    "productionHandoffPath": "clients/client/concept/open-design/production-handoff.json",
    "continueCommand": "npm run open-design:continue-concept -- --client client --prompt \"<change request>\"",
    "syncCommand": "npm run open-design:sync-from-app -- --client client"
  },
  "productionHandoffPath": "clients/client/concept/open-design/production-handoff.json",
  "branch": "dev"
}
```

When Hermes receives a visual design request in Discord:

1. read the case/context/build packet first;
2. use the `openDesign` object from the task;
3. if `openDesign.status` is `bound`, call `continueCommand`;
4. if Matthew edited in Open Design manually, call `syncCommand`;
5. rebuild the production handoff;
6. port accepted concept changes to the Webjuice/Astro customer repo on `dev`;
7. run build/QA before sending customer review.

Hermes must not start a separate Open Design project unless the operator explicitly asks.
