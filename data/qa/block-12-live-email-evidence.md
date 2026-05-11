# Block 12 — Live Email Send (闭环最后一步)

## Setup done via Cloudflare API

| Step | Action | Result |
|---|---|---|
| 1. Authenticate | `GET /accounts` with Global API Key | 2 accounts; selected `2b67d2288df946ac22f408b60a9bcc11` (Matthew6688) |
| 2. List Access apps | `GET /access/apps` | 1 app: `mail.profitslocal.com` (id `67e8644a...`) |
| 3. Inspect existing policy | `GET /access/apps/{id}/policies` | 1 existing "Allow ProfitsLocal Inbox Operators" |
| 4. Create service token | `POST /access/service_tokens` name=`profitslocal-outreach-sender` | client_id `1f8f5a5eaecfb8516b8ef40c363467ec.access` |
| 5. Add service-token policy | `POST /access/apps/{id}/policies` precedence=2, decision=non_identity, include service_token | policy `4d89ca6d-8aa9-4e6d-ac2c-d8bd6d2bb409` |
| 6. Write `.env.local` | 4 vars (`AGENTIC_INBOX_*`) | gitignored, secrets stay local |

## Live email send

```
npm run pl:email-send -- place_chijn587yc79k2sr7vyvy-egoam \
  --to matthewkiata@gmail.com \
  --subject "Test from ProfitsLocal — E2E live send 2" \
  --body-file /tmp/test-email-body.md \
  --variant v_2026-05_audit-led \
  --no-dry-run
```

Result:
```
{
  "ok": true,
  "send": {
    "ok": true,
    "status": 202,
    "messageId": "223b9d27-7215-458a-8e1e-e965b7e621bd",
    "response": { "id": "223b9d27...", "status": "sent" }
  },
  "advance": { "from": "replied", "to": "outreach-active" },
  "thread_append": { "ok": true, "messageId": "1503259281674211398" }
}
```

## Verified in agentic-inbox sent folder

```
GET /api/v1/mailboxes/hi@profitslocal.com/emails?folder=sent

{
  "id": "223b9d27-7215-458a-8e1e-e965b7e621bd",
  "subject": "Test from ProfitsLocal — E2E live send 2",
  "sender": "hi@profitslocal.com",
  "recipient": "matthewkiata@gmail.com",
  "date": "2026-05-11T04:55:41.507Z"
}
```

## Final entity state

```
entity.phase: outreach-active
entity.signals: { sent: 3, replied: 1 }
entity.last_contact_at: 2026-05-11T04:55:41.540Z
entity.last_sent_variant_id: v_2026-05_audit-led
entity.discord_thread_id: 1503256064244842547
```

## Bug found + fixed during E2E

URL double-encoding: `.env.local` originally had `AGENTIC_INBOX_MAILBOX_ID=hi%40profitslocal.com`
(URL-encoded), but `encodeURIComponent()` in client code re-encoded to `hi%2540profitslocal.com`.

**Fix**: store mailbox ID as raw email (`hi@profitslocal.com`). Doc-comment in
`core/integrations/agentic-inbox.js` updated to warn future operators.

## Discord thread now contains 9 messages

Live demo at <https://discord.com/channels/1493925728570310756/1503256064244842547>:

```
[04:42:54] profile card embed (edited timestamps reflect phase transitions)
[04:43:12] 🔄 outreach-active → replied (manual test)
[04:44:52] 📤 pl:thread-append CLI test
[04:46:16] 📤 Email sent (dry-run #1)
[04:46:17] 🔄 replied → outreach-active
[04:46:42] 💬 Reply received (class=interested 0.8)
[04:46:44] 🔄 outreach-active → replied
[04:55:25] 📤 Email sent (live send #1 — failed 400 from-mismatch)
[04:55:41] 📤 Email sent (live send #2 — succeeded 202)
[04:55:43] 🔄 replied → outreach-active
```

## E2E loop closure (post-reply)

Matthew replied to the test email. Verified:

1. **Reply landed in agentic-inbox** — `id: 14c49d24-1d1e-4479-bf13-6923779c0cd9`
   - sender: `matthewkiata@gmail.com`
   - subject: `Re: plain str test`
   - body: "Thanks for your email. We are interested in your service."
   - `in_reply_to: 9YghWzzhEl4HCcsm9pTE87H02TYenYzGTGEn@profitslocal.com` (chained to our outbound)

2. **agentic-inbox does NOT auto-fire reply webhook to profitslocal** — by design, the worker's `postProfitsLocalOutreachEvent` only fires on outbound (`status: outbound_sent`). Reply ingestion must be pulled.

3. **Built `pl:reply-poll`** CLI for pull-mode ingestion:
   - Lists inbox emails since last_seen
   - Matches each to entity via thread_id (preferred) or sender_email
   - Calls reply-classifier + lookupPlaybook + setEntityPhase
   - Appends rich auto-ingest message to Discord thread
   - Persists state to `data/leads/reply-poll-state.json`
   - Idempotent via processed_message_ids set

4. **LIVE pull run** processed 3 replies from matthewkiata@gmail.com → FIX MY ROOF entity:
   - "We are interested in your service" → `interested` (0.8)
   - "That's ok, we can do it" → `unclear` (operator review)
   - "Do you build websites?" → `unclear` (older, before E2E)
   - entity.signals.replied += 3
   - 3 auto-ingest messages + 3 phase transition messages posted to Discord thread

5. **Hermes cron `pl-reply-poll` registered + paused** (dev policy D3):
   - schedule: 5m
   - job id: `841963c06771`
   - paused; enable via `npm run cron:pl:enable` when production-ready

## Full loop now closed

```
Discord operator → pl:email-send → agentic-inbox → SMTP → recipient gmail
                                                              ↓ (reply)
                                              agentic-inbox inbox
                                                              ↓ (pl:reply-poll every 5m)
                                              classify → entity → Discord
                                                              ↓ (operator sees in thread)
                                              ✅ → next action
```

## Security follow-up

The Global API Key was shared in chat. **Rotate now**:
1. Cloudflare dashboard → My Profile → API Tokens → Global API Key → Roll
2. The new key only matters for future API operations; the service token (already created)
   continues to authenticate the agentic-inbox calls independently

For future automation prefer **scoped API Tokens** (not Global Key):
- Cloudflare → API Tokens → Create Token
- Scope to: Account.Access (Read+Write) + Account (Read)
- Add to .env.local as `CLOUDFLARE_API_TOKEN`
