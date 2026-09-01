# Creative Guide — Local-First Onboarding & Navigation Agent

**Status:** Draft (RFC) · **Owner:** CTO · **Branch target:** `main` (staging first)
**Scope:** In-app AI agent that onboards, navigates, and coaches users across the
Creative Platform ecosystem while preserving continuity across apps.

---

## 1. Problem

New and returning users face a wide surface (`creator, clips, live, market,
marketplace, memberships, portfolio, predict, profile, send, songchain, upload,
vote, watch, news, mixtape`) plus web3 friction (wallet, gas, IP licensing).
Today there is **no in-app agent, tour, or copilot** — onboarding is the static
Privy/Orb modal only. We want a guide that explains *and* acts, and remembers
the user across sessions and across apps.

## 2. Goals (the five+ pillars)

| Pillar | Delivered by |
|---|---|
| Onboard | Conversational wallet provisioning layered over Privy + Alchemy migration |
| Navigate functions | Agent tool-calls into real route actions (upload, mint, mixtape, membership) |
| Usability | Plain-language coach, no jargon; falls back to existing `Toaster`/ErrorBoundary |
| Journey | Per-user state machine nudging the next meaningful step |
| Continuity | One guide, many apps (`.creativeplatform.xyz`) via shared identity + memory |
| UX | Local-first: private + fast for routine guidance; escalates to hosted only when needed |

## 3. Non-negotiable constraints

- **Local-first.** Routine guidance runs client-side/private; no data leaves the
  device for everyday help. Complex reasoning escalates behind the billing gate.
- **Reuse, don't reinvent.** Privy/Orb auth, `ai` SDK (`generateText`/`streamText`
  + `@ai-sdk/google`), Supabase, and the x402/USDC billing gate already exist.
- **Billing parity.** Any hosted/paid model call goes through the same
  CRTVAI-credit / x402 gate as `app/api/ai/generate-thumbnail/route.ts`.
- **Surgical & staged.** Minimal changes; staging → prod after final review +
  Gemini bot review; CI must be green. No global CSS changes for third-party widgets.

## 4. Current stack inventory (what we build on)

| Capability | Where |
|---|---|
| Embedded wallet + migration | `app/providers.tsx` (Privy + `MigrationProvider`), `@/lib/wallet/*` |
| Orb brand/session | `OrbSessionProvider`, `OrbLoginModal`, `OrbLinkingOverlay` |
| AI SDK + Gemini | `app/api/ai/generate-thumbnail/route.ts` (`ai` v4, `@ai-sdk/google`) |
| Paid-AI billing (x402) | same route: `verifyPaymentProof`, `MODEL_PRICE`, USDC transfer proof |
| On-chain read | `@/lib/viem` `publicClient`, `@/lib/contracts/*` |
| User data | Supabase (existing auth/state tables) |
| Local agent runtime (reference) | edit-pixels headless MCP: stdio tool server + `onToolCall` billing middleware |

## 5. Architecture (3 layers)

```
┌─ Layer 3: UI / Continuity ──────────────────────────────┐
│  OrbGuideChat (persistent, collapsible) in app shell     │
│  + coachmarks on key routes. Memory keyed to Privy ID.   │
├─ Layer 2: Agent Orchestrator (local-first) ─────────────┤
│  Client Orchestrator using `ai` SDK `streamText`+tools.  │
│  Routine = on-device/local. Hard queries → Layer 2b.     │
│  2b (optional/paid): thin server proxy through billing.  │
├─ Layer 1: Tool Surface (MCP-style, local stdio) ─────────┤
│  One tool per platform function. Reuses edit-pixels      │
│  billing middleware (onToolCall) for metered actions.    │
└──────────────────────────────────────────────────────────┘
```

**Layer 1 — Tool Surface.** Each platform function is a typed tool the agent can
call. Local stdio server (mirrors edit-pixels) so no central host is required
for staging. Metered/paid tools route through the x402 gate.

**Layer 2 — Orchestrator.** Same `ai` SDK already in the repo. Local
`streamText` with tool-calling. A *lightweight* server proxy is added only when a
query is too hard for the local path — and only behind billing.

**Layer 3 — Continuity + UX.** A `OrbGuideChat` component in the root layout,
bound to `OrbSessionProvider`. Supabase `agent_memory` table (§6) gives the
cross-session, cross-app continuity.

## 6. Continuity model (Supabase)

```sql
-- keyed to Privy user id, shared across all .creativeplatform.xyz apps
create table if not exists agent_memory (
  user_id     text primary key,        -- privy id
  stage       text not null,           -- new | uploaded | minted | earning | ...
  context     jsonb not null default '{}', -- last route, open tasks, prefs
  updated_at  timestamptz default now()
);
```

Journey state machine: `new → wallet_ready → first_upload → first_mint →
first_membership → earning`. Agent nudges the next step on each load.

## 7. Agent tool surface (v1 spike — marketplace route)

- `explain_current_route()` — plain-language summary of where the user is.
- `get_user_state()` — reads Privy id + on-chain holdings via `@/lib/viem`.
- `search_marketplace(query)` — discover/list assets.
- `create_mixtape(name)` / `add_to_mixtape(clipId)` — *never gate Mixtape on IP*.
- `start_upload()` — deep-link / coach into `app/upload`.

Metered tools (mint, membership buy) call the x402 gate before executing.

## 8. Phased rollout

1. **Spike (staging):** `OrbGuideChat` on **one** route (marketplace) with 4–5
   tools + Supabase memory. Prove the UX loop. No billing yet.
2. **Onboarding:** layer the guide into the Privy/Orb flow so wallet creation is
   explained, not just performed.
3. **Cross-app continuity:** share `agent_memory` with TV/Pixels/Mixtape/Finance.
4. **Monetize:** route paid/escalated calls through CRTVAI-credit / x402.
5. **Prod:** staging → final review → Gemini bot review → merge `main`.

## 9. Risks / open questions

- **Local inference weight:** true on-device WebGPU is heavy; spike uses the
  local orchestrator + optional server proxy. Decide hosted-vs-local per query cost.
- **Privy data access:** confirm what user state is readable client-side for
  `get_user_state()` without extra scopes.
- **Rate/privacy:** local-first keeps routine data off-server; document what
  *does* leave the device (only escalated hard queries).

## 10. Definition of Done (spike)

- `OrbGuideChat` renders in staging on `/marketplace` (and linked routes).
- Agent can `explain_current_route`, read `get_user_state`, and perform ≥1
  write action (mixtape) via tool-call.
- Memory persists across reload (Supabase `agent_memory`).
- No regressions; CI green; minimal surgical diff.
