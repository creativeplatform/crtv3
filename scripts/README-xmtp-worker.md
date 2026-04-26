# XMTP Moderation Worker

Long-lived process that does two things across all live streams:

1. **History persistence** — appends every chat message to
   `public.stream_chat_messages` (idempotent on `(stream_id, message_id)`).
2. **Ban enforcement** — kicks any sender whose address appears in
   `public.stream_moderation_bans` from the XMTP group.

## Why a separate process?

XMTP's `streamAllMessages` is a long-lived async iterator. Vercel functions
(Edge or Node) can't host that — they time out. The worker therefore needs
a dedicated host: Railway, Render, Fly.io, a small VM, or any environment
that supports a `node` process running indefinitely.

The browser-side fallback in `lib/hooks/xmtp/useLiveChatModerated.ts`
performs the same persist + kick **while the host's tab is open**. The
worker is the always-on guarantor.

## Required env vars

For the worker process:

```
XMTP_MODERATION_BOT_PRIVATE_KEY=0x…   # EOA used as the bot identity
XMTP_ENV=production                   # or "dev"
NEXT_PUBLIC_SUPABASE_URL=…
SUPABASE_SERVICE_ROLE_KEY=…
```

For the Next.js app (so host browsers know which inbox to invite):

```
NEXT_PUBLIC_MODERATION_BOT_INBOX_ID=…  # from the worker's first boot log
```

If `NEXT_PUBLIC_MODERATION_BOT_INBOX_ID` is unset, the host page skips the
bot invitation but still registers the group → stream mapping, so flipping
the env var on later (after the worker is deployed) Just Works on the next
host page load — no code change needed.

## Install + run

The worker lives outside the Next.js build path (the `scripts/` directory
is excluded from `tsconfig.json`). Deploy it as its own package:

```bash
mkdir xmtp-worker && cd xmtp-worker
cp ../crtv3/scripts/xmtp-moderation-worker.ts .
npm init -y
npm i @xmtp/node-sdk @supabase/supabase-js viem dotenv tsx
npx tsx xmtp-moderation-worker.ts
```

For production, run under a process supervisor (PM2, systemd, the platform's
built-in restart policy).

## Inviting the bot to chat groups

The bot can only enforce bans on groups it's a member of with admin rights.
The host's browser handles the invitation automatically — the flow is:

1. Worker boots, prints `inboxId: …`. Set this as
   `NEXT_PUBLIC_MODERATION_BOT_INBOX_ID` in the app's env.
2. When the host (and only the host — the moderated hook gates this on
   `isCreator`) loads the chat for their stream, `useLiveChatModerated`
   runs a one-shot effect that:
   - Calls `group.addMembers([NEXT_PUBLIC_MODERATION_BOT_INBOX_ID])` if the
     bot isn't a member yet.
   - Calls `group.addAdmin(NEXT_PUBLIC_MODERATION_BOT_INBOX_ID)` if it's
     not an admin yet (so it can `removeMembers`).
   - Calls `registerChatGroup(streamId, groupId)` to upsert the mapping
     into `stream_chat_groups`. The worker reads from that table to
     resolve `conversationId → streamId`.
3. Each step is idempotent and best-effort: if the bot inbox isn't
   configured, the moderated hook silently skips invitation and the
   browser fallback continues to handle moderation while the host's tab
   is open.

The wiring lives in `lib/hooks/xmtp/useLiveChatModerated.ts` (search for
`botProvisioned`) and `services/stream-chat-groups.ts`.

## Operational notes

- The bot caches the bans table in memory and refreshes every 15s. Newly-
  added bans take effect on the next message from the offender, not
  retroactively against past messages — those still need `unbanUser` +
  `hideMessage` for older offending messages.
- The ban cache is per-stream; cross-stream isolation is guaranteed by the
  `stream_id` key.
- If the bot is removed from a group (e.g. accidentally by the host), it
  silently drops out of moderation for that stream. The browser fallback
  continues to work.
- The worker is **idempotent and safe to run alongside the browser fallback**
  — both write the same rows with `onConflict: do nothing`.
