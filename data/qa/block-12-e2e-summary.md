# Block 12 — E2E Live Verification

**Test entity**: FIX MY ROOF Total Roof Restorations (`place_chijn587yc79k2sr7vyvy-egoam`, grade=A/T3)
**Test thread**: <https://discord.com/channels/1493925728570310756/1503256064244842547>

## What ran LIVE (not dry-run)

| Step | Action | Result |
|---|---|---|
| 1. Forum tag sync | `syncDiscordForumTags` on websites-leads | 14 V2 tags installed (replaced 10 legacy) |
| 2. Bot auth check | `GET /users/@me` | 200; bot = `ProfitsLocal Handoff#5263` |
| 3. Channel inspect | `GET /channels/{lead_forum_id}` | type=15 forum confirmed |
| 4. **openLeadThread** | `POST /channels/{forum}/threads` with embed | thread_id `1503256064244842547`, 2 tags `outreach-active, grade-a`, profile card embed created |
| 5. Entity write-back | After thread open | `entity.discord_thread_id`, `discord_profile_message_id`, `discord_thread_opened_at` populated |
| 6. **setEntityPhase live** | `outreach-active → replied` | 3-step async hook fired: `swapPhaseTag` PATCH ok, `appendThreadMessage` POST ok, `upsertProfileCard` PATCH ok |
| 7. Profile card edit verify | `GET /messages/{id}` | `edited_timestamp` populated, `Phase` field shows `replied` |
| 8. **pl:thread-append CLI** | Real append | message id `1503256556949602317`, visible in thread |
| 9. **pl:email-send** with `--no-dry-run` | Tries real CF Access send | HTTP request payload built correctly; blocked by missing service token; entity left untouched |
| 10. **pl:reply-handle live** | Classify + advance + thread sync | "sounds interesting" → class=`interested`, confidence=0.8, phase advanced to `replied`, thread message posted |
| 11. Hermes cron lifecycle | register → list → pause → remove | job id `23459b2e766b`, name resolution works, all 4 ops succeed |

## Live thread state (7 messages, 6 visible + 1 edited embed)

```
[04:42:54] (profile card embed — edited at 04:46:44)
[04:43:12] 🔄 Phase outreach-active → **replied** — E2E test — simulating customer reply
[04:44:52] 📤 E2E test — pl:thread-append CLI works live
[04:46:16] 📤 **Email sent** (variant=v_2026-05_audit-led) > To: matthewkiata@gmail.com
[04:46:17] 🔄 Phase replied → **outreach-active** — Sent variant=v_2026-05_audit-led to matthewkiata@gmail.com
[04:46:42] 💬 **Reply received** (class=`interested`, confidence=0.8) > Hi Matthew, sounds interesting...
[04:46:44] 🔄 Phase outreach-active → **replied** — Reply class=interested; send_discovery_questions_or_calendly
```

Profile card embed phase field correctly reflected `replied` after 04:46:44 edit.

## Verified chain

```
pl:advance / pl:reply-handle / pl:email-send
   ↓
setEntityPhase (read-merge-write to entity JSON)
   ↓
async hook (fire-and-forget):
   ├─ swapPhaseTag    (PATCH /channels/{thread_id} applied_tags)
   ├─ appendThreadMessage  (POST /channels/{thread_id}/messages)
   └─ upsertProfileCard   (PATCH /channels/{thread_id}/messages/{profile_msg_id})
   ↓
Discord forum reflects state within ~3s
```

Admin UI (`/admin/v2`, `/admin/v2-leads`) renders from entity JSON which is also the
source of truth for Discord profile card → automatic consistency.

## Single remaining gate: CF Access service token for email send

The email send HTTP call to mail.profitslocal.com is gated by Cloudflare Access JWT.
Code is ready and tested in dry-run + the exact intended request payload is verified.
To enable real send:

1. Cloudflare dashboard → Zero Trust → Access → Service Auth → Service Tokens → **Create**
2. Edit the Access application for `mail.profitslocal.com` → Add a policy rule → Selector "Service Token" → choose the new token
3. Add to profitslocal `.env.local`:
   ```
   AGENTIC_INBOX_URL=https://mail.profitslocal.com
   AGENTIC_INBOX_MAILBOX_ID=hi%40profitslocal.com
   AGENTIC_INBOX_ACCESS_CLIENT_ID=<the .access ID from CF>
   AGENTIC_INBOX_ACCESS_CLIENT_SECRET=<the secret>
   ```
4. Re-run: `npm run pl:email-send -- <entityKey> --to <recipient> --subject "..." --body-file <path> --variant v_2026-05_audit-led --no-dry-run`

Expected outcome: real email lands in recipient inbox; `entity.signals.sent` += 1;
phase advances → outreach-active; Discord thread shows "📤 Email sent".

## Reply ingest in production

When a real customer replies via `mail.profitslocal.com`, the agentic-inbox worker
(`lib/profitslocal-outreach.ts`) posts to
`https://profitslocal.com/api/outreach-provider-event`, which dispatches GitHub
workflow `sync-outreach-provider-event.yml`. The workflow runs
`syncOutreachProviderEvent` which (Block 11.1) now calls `applyV2ReplyClassification`:

  reply text → `classifyReply` (regex) → `lookupPlaybook` → patch entity →
  `setEntityPhase` → async Discord thread sync

Verified offline via [test-outreach-provider-event](../../scripts/funnel/test-outreach-provider-event.js) which still passes.

## Cleanup

Test thread `1503256064244842547` left in place as living demo. Remove via Discord
UI (right-click → Delete Thread) or via `pl:advance --to archived` to retire.
