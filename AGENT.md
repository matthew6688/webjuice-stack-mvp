# AGENT.md

## Always-On Operating Rules

These rules apply to all work in this repository.

### -1. Karpathy-style engineering discipline

All agents working in this repository should follow these defaults:

1. Think before coding.
   - State assumptions explicitly.
   - Do not silently pick between multiple interpretations.
   - If the problem is unclear, name the uncertainty before implementing.

2. Simplicity first.
   - Solve the requested problem with the minimum code needed.
   - Do not add speculative abstraction, flexibility, or future-proofing.
   - If the solution feels bigger than the problem, simplify it.

3. Surgical changes only.
   - Touch only the lines needed for the requested outcome.
   - Do not refactor or "clean up" unrelated nearby code.
   - Remove only the unused code that this change itself creates.

4. Goal-driven verification.
   - Turn work into verifiable goals.
   - Define what will prove success before changing code.
   - Do not stop at implementation when verification is possible.

### 0. Truth over convenience

Never present a convenient assumption as a verified fact.

If something is only true locally, say it is only true locally.
If something is only inferred, say it is inferred.
If something has not been checked, say it has not been checked.

### 1. Local is not production

Passing local tests, generating a build, or seeing routes in `dist/` does not prove production is correct.

Do not collapse:

- implemented locally
- built successfully
- deployed successfully
- verified in production

These are different states and must be described separately.

### 2. Hard Evidence Rule

For this project, local completion is **not** enough to claim success.

Do **not** say a page, flow, or system is "done", "live", "viewable", "working", or "verified" unless the correct evidence level has been reached.

### 2.1 Local evidence

Local evidence means:

- the file exists
- the code is wired up
- relevant tests pass
- `npm run build` passes

This is enough to say:

- "implemented locally"
- "build passes"
- "ready for deployment verification"

This is **not** enough to say:

- "you can view it"
- "it is live"
- "it works in production"
- "hard evidence confirmed"

### 2.2 Production hard evidence

For any production page or route, hard evidence requires **all** of:

1. the real production URL was checked
2. the HTTP status code is correct
3. the returned page content matches the intended page
4. the page is not a fallback, homepage, stale deployment, auth wall, or error page

Preferred proof:

- status code
- page title
- unique on-page text
- screenshot when practical

### 2.3 Workflow hard evidence

For workflows, automations, payments, revisions, approvals, deploys, or agent handoffs, hard evidence requires:

- command or API result
- output artifact path
- before/after state change when relevant
- external run ID / workflow URL / message ID / email ID / thread ID when available

### 2.4 Required wording discipline

If only local evidence exists, say:

- "implemented locally"
- "build verified locally"
- "not yet verified in production"

If production evidence exists, say:

- "verified in production"
- "live URL checked"
- "hard evidence confirmed"

Never collapse these two states into one sentence.

### 2.5 Deployment verification checklist

Before claiming a new page is available on production:

1. confirm deployment happened on the intended environment
2. open the real URL
3. verify status code
4. verify title or unique content
5. record the evidence in the response

If any of these are missing, do not claim production success.

### 2.6 Failure handling

If production does not match local code:

- state that clearly
- say whether the gap is build, deploy, auth, routing, or stale environment
- do not present the work as finished
- continue until the production state is verified or the blocker is explicit

### 3. Do not claim user-visible success without user-visible proof

If telling the user:

- "you can open this"
- "this page is live"
- "this flow works"
- "this is available now"

then verify the actual user-facing surface first.

For pages, that means the real URL.
For emails, that means the sent artifact or provider result.
For Discord, that means the real message/thread result.
For deploys, that means the live environment.

### 4. Separate implementation from verification in every report

Status updates should distinguish:

1. what code changed
2. what was tested locally
3. what was verified externally
4. what still remains unverified

Do not merge these into a single vague success statement.

### 5. When wrong, correct quickly and explicitly

If a previous claim was too strong:

- say exactly what was wrong
- replace it with the correct status
- explain what evidence is missing
- then go get that evidence

Do not hide the mismatch behind vague language.

### 6. Prefer direct verification over confidence

If a real check is possible, do the real check.

Examples:

- use the real production URL instead of assuming from build output
- inspect the real returned HTML instead of assuming the route rendered correctly
- check the real status code instead of assuming auth or redirects behaved correctly

### 7. Evidence should be reproducible

Whenever practical, include evidence that another operator can repeat:

- URL
- command
- file path
- run ID
- workflow URL
- artifact path

The goal is that another person can retrace the proof without relying on memory.
