import { initBotId } from 'botid/client/core';

/**
 * BotID protected routes: client attaches headers for these paths so server
 * can call checkBotId(). Excludes cron routes (no browser context).
 *
 * Orb QR sign-in (/api/auth/orb/qr/init, /api/auth/orb/qr/poll) is intentionally
 * omitted — poll loops every ~1–2s and Kasada/BotID flags that as bot traffic.
 *
 * livepeer/stream-key and livepeer/livepeer-proxy omitted: wallet-auth + rate
 * limits are sufficient; BotID 403 broke Create Stream for legitimate creators.
 *
 * checkLevel must match Vercel Firewall → BotID → Deep Analysis and
 * BOTID_DEEP_ANALYSIS_OPTIONS in lib/middleware/botIdGuard.ts.
 */
const botIdGlobal = globalThis as typeof globalThis & { __crtvBotIdInit?: boolean };

const botIdDeepAnalysisRoute = (path: string, method: string) => ({
  path,
  method,
  advancedOptions: { checkLevel: 'deepAnalysis' as const },
});

if (!botIdGlobal.__crtvBotIdInit) {
  botIdGlobal.__crtvBotIdInit = true;

  initBotId({
    protect: [
      botIdDeepAnalysisRoute('/api/swap/execute', 'POST'),
      botIdDeepAnalysisRoute('/api/ipfs/upload', 'POST'),
      botIdDeepAnalysisRoute('/api/creator-profiles/upsert', 'POST'),
      botIdDeepAnalysisRoute('/api/creator-profiles/link-orb', 'POST'),
      // Orb QR init/poll omitted: high-frequency polling; rate-limited server routes instead.
      botIdDeepAnalysisRoute('/api/creator-profiles', 'POST'),
      botIdDeepAnalysisRoute('/api/creator-profiles', 'PUT'),
      botIdDeepAnalysisRoute('/api/creator-profiles', 'DELETE'),
      botIdDeepAnalysisRoute('/api/story/transfer', 'POST'),
      botIdDeepAnalysisRoute('/api/story/mint', 'POST'),
      botIdDeepAnalysisRoute('/api/story/register-stream', 'POST'),
      botIdDeepAnalysisRoute('/api/story/mint-derivative', 'POST'),
      botIdDeepAnalysisRoute('/api/story/prepare-mint', 'POST'),
      // rpc-proxy omitted: BotID blocks legitimate client RPC (e.g. eth_getBalance for funding wallet).
      // metokens-subgraph omitted: read-only GraphQL proxy; BotID 403 breaks portfolio balance queries.
      // reality-eth-subgraph omitted: read-only GraphQL proxy; BotID 403 breaks predictions list queries.
      botIdDeepAnalysisRoute('/api/story/factory/deploy-collection', 'POST'),
      botIdDeepAnalysisRoute('/api/metokens/sync', 'POST'),
      botIdDeepAnalysisRoute('/api/metokens/alchemy', 'POST'),
      botIdDeepAnalysisRoute('/api/metokens', 'POST'),
      botIdDeepAnalysisRoute('/api/metokens/*', 'PUT'),
      botIdDeepAnalysisRoute('/api/metokens/*/balance', 'PUT'),
      // membership omitted: read-only Unlock lookup; BotID Deep Analysis caused profile 403s.
      // metokens-subgraph: read-only GraphQL proxy — excluded from BotID (see rpc-proxy note above).
      botIdDeepAnalysisRoute('/api/livepeer/sign-jwt', 'POST'),
      botIdDeepAnalysisRoute('/api/livepeer/stream/*/recording', 'POST'),
      botIdDeepAnalysisRoute('/api/streams/recordings/finalize', 'POST'),
      botIdDeepAnalysisRoute('/api/livepeer/clips', 'POST'),
      botIdDeepAnalysisRoute('/api/livepeer', 'POST'),
      botIdDeepAnalysisRoute('/api/livepeer/attestation', 'POST'),
      botIdDeepAnalysisRoute('/api/ai/upload-to-ipfs', 'POST'),
      botIdDeepAnalysisRoute('/api/ai/generate-thumbnail', 'POST'),
      botIdDeepAnalysisRoute('/api/unlock-nft', 'POST'),
      botIdDeepAnalysisRoute('/api/video-assets/sync-views/*', 'POST'),
      // views/increment omitted: Deep Analysis false-positives blocked legitimate play views;
      // route uses rateLimiters.viewIncrement instead.
      botIdDeepAnalysisRoute('/api/video-assets/*/regenerate-thumbnail', 'POST'),
      botIdDeepAnalysisRoute('/api/coinbase/session-token', 'POST'),
      botIdDeepAnalysisRoute('/api/metokens/*/transactions', 'POST'),
      botIdDeepAnalysisRoute('/api/predictions/quota', 'GET'),
      botIdDeepAnalysisRoute('/api/predictions/record', 'POST'),
      botIdDeepAnalysisRoute('/api/predictions/metadata', 'GET'),
      botIdDeepAnalysisRoute('/api/stickers/upload', 'POST'),
      botIdDeepAnalysisRoute('/api/stickers/register', 'POST'),
      botIdDeepAnalysisRoute('/api/stickers/verify-vote', 'POST'),
      botIdDeepAnalysisRoute('/api/stickers/record-claim', 'POST'),
      botIdDeepAnalysisRoute('/api/stickers/tips', 'POST'),
      botIdDeepAnalysisRoute('/api/hack-beta/submit', 'POST'),
      botIdDeepAnalysisRoute('/api/hack-beta/admin/submissions', 'GET'),
      botIdDeepAnalysisRoute('/api/hack-beta/admin/submissions', 'PATCH'),
      botIdDeepAnalysisRoute('/api/hack-beta/admin/settings', 'PATCH'),
      botIdDeepAnalysisRoute('/api/song-cup/submit', 'POST'),
      botIdDeepAnalysisRoute('/api/song-cup/admin/submissions', 'GET'),
      botIdDeepAnalysisRoute('/api/song-cup/admin/submissions', 'PATCH'),
      botIdDeepAnalysisRoute('/api/heartbit/mint', 'POST'),
      // claim-status omitted: read-only on-chain claim lookup; BotID 403 breaks list badges.
      botIdDeepAnalysisRoute('/api/search/videos', 'GET'),
      botIdDeepAnalysisRoute('/api/search/market', 'GET'),
      botIdDeepAnalysisRoute('/api/search/predictions', 'GET'),
      botIdDeepAnalysisRoute('/api/song-cup/agent/chat', 'POST'),
      botIdDeepAnalysisRoute('/api/agent/creative-guide', 'POST'),
      // Server actions: pages that invoke saveCreatorCollectionAction (Next.js POSTs to page URL)
      botIdDeepAnalysisRoute('/', 'POST'),
      botIdDeepAnalysisRoute('/studio', 'POST'),
      botIdDeepAnalysisRoute('/studio/*', 'POST'),
    ],
  });
}
