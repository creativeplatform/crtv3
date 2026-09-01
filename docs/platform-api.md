# Creative TV Platform API

Tiered access for read-only Platform API routes used by Creative Platform apps (Mixtape), administrators, and external AI agents.

## Canonical playback resolver URL

```
GET https://tv.creativeplatform.xyz/api/video-assets/by-asset-id/{uuid}/playback
```

- `{uuid}` is the Livepeer asset id from `/discover/{uuid}` (not the playback id).
- For watch pages, use `/watch/{playbackId}` directly — no resolver call needed.
- There is no `/api/platform/...` prefix in Phase 1.

## Tiers

| Tier | Auth | Fee |
|------|------|-----|
| **Admin** | `Authorization: Bearer <admin secret>` | None |
| **Partner** | `Authorization: Bearer <partner secret>` | None |
| **Public / agents** | `X-Payment-Proof` header after USDC payment | Micro-USDC per call |
| **Unauthenticated** | — | HTTP 402 Payment Required |

Gating is active when `PLATFORM_API_ACCESS_ENABLED=true`, or when admin/partner keys or `X402_API_RECIPIENT` are configured. Set `PLATFORM_API_ACCESS_ENABLED=false` to disable gating in local dev.

Same-origin browser traffic from the Creative TV web app (`Sec-Fetch-Site: same-origin` or `same-site`) is exempt from x402/key checks so in-app playback works. External cross-origin callers still require partner/admin keys or x402 payment. Same-origin requests are rate-limited per IP.

## Generate API keys (local only)

```bash
pnpm tsx scripts/generate-platform-api-key.ts --tier admin
pnpm tsx scripts/generate-platform-api-key.ts --tier partner --id mixtape
```

Never commit generated secrets. Store in Vercel env vars only.

## Environment variables (CRTV)

```env
PLATFORM_API_ACCESS_ENABLED=true
CREATIVE_PLATFORM_ADMIN_API_KEYS=crtv_admin_...
CREATIVE_PLATFORM_PARTNER_API_KEYS=mixtape:crtv_pk_mixtape_...
X402_API_RECIPIENT=0x...
X402_PLAYBACK_RESOLVE_PRICE=10000
X402_PUBLISHED_LIST_PRICE=25000
X402_PLAYBACK_INFO_PRICE=50000
X402_VIEWS_METRICS_PRICE=50000
```

Prices are USDC base units (6 decimals). `10000` = $0.01 USDC.

## Gated routes (Phase 1 + 2)

| Route | Resource id | Default price |
|-------|-------------|---------------|
| `GET /api/video-assets/by-asset-id/{uuid}/playback` | `playback.resolve` | 10000 |
| `GET /api/video-assets/published` | `videos.published` | 25000 |
| `GET /api/livepeer/playback-info?playbackId=` | `playback.info` | 50000 |
| `GET /api/livepeer/views/{playbackId}` | `views.metrics` | 50000 |

## Mixtape integration (air.creativeplatform.xyz)

**Use a server-side proxy.** Do not expose the partner key in the browser.

1. Generate a partner key: `--tier partner --id mixtape`
2. Set on CRTV: `CREATIVE_PLATFORM_PARTNER_API_KEYS=mixtape:<secret>`
3. Set on Mixtape server: `MIXTAPE_CRTV_API_KEY=<secret>` and `CRTV_API_BASE=https://tv.creativeplatform.xyz`

### Mixtape server route example

```ts
// app/api/crtv/resolve-playback/route.ts (Mixtape)
export async function POST(request: Request) {
  const { url } = await request.json();
  const uuid = extractDiscoverUuid(url);
  if (!uuid) {
    return Response.json({ error: "Invalid discover URL" }, { status: 400 });
  }

  const res = await fetch(
    `${process.env.CRTV_API_BASE}/api/video-assets/by-asset-id/${uuid}/playback`,
    {
      headers: {
        Authorization: `Bearer ${process.env.MIXTAPE_CRTV_API_KEY}`,
      },
    },
  );

  return Response.json(await res.json(), { status: res.status });
}
```

Mixtape client calls `/api/crtv/resolve-playback`, not CRTV directly.

## x402 payment flow (agents)

1. `GET` a gated route without auth → **402** with `accepts[]` (USDC on Base).
2. Send USDC to `payTo` for at least `maxAmountRequired`.
3. Retry with header:

```
X-Payment-Proof: <base64url(JSON.stringify({ transactionHash, amount }))>
```

Example proof JSON before encoding:

```json
{ "transactionHash": "0x...", "amount": "10000" }
```

## Discover URL → playbackId

```bash
curl -H "Authorization: Bearer $ADMIN_KEY" \
  "https://tv.creativeplatform.xyz/api/video-assets/by-asset-id/{uuid}/playback"
```

Response:

```json
{
  "playbackId": "...",
  "title": "...",
  "thumbnailUri": "...",
  "requiresMetoken": false,
  "fallbackUrl": "https://tv.creativeplatform.xyz/discover/{uuid}"
}
```

`requiresMetoken` applies to **VOD** assets (`video_assets`). Live stream gating uses the same MeToken semantics on the `streams` table — see [Live stream MeToken gate](./live-stream-metoken-gate.md).
