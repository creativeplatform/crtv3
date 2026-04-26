import { initBotId } from 'botid/client/core';

/**
 * BotID protected routes: client attaches headers for these paths so server
 * can call checkBotId(). Excludes cron routes (no browser context).
 */
initBotId({
  protect: [
    { path: '/api/swap/execute', method: 'POST' },
    { path: '/api/ipfs/upload', method: 'POST' },
    { path: '/api/creator-profiles/upsert', method: 'POST' },
    { path: '/api/creator-profiles', method: 'POST' },
    { path: '/api/creator-profiles', method: 'PUT' },
    { path: '/api/creator-profiles', method: 'DELETE' },
    { path: '/api/story/transfer', method: 'POST' },
    { path: '/api/story/mint', method: 'POST' },
    { path: '/api/story/register-stream', method: 'POST' },
    { path: '/api/story/mint-derivative', method: 'POST' },
    { path: '/api/story/prepare-mint', method: 'POST' },
    // rpc-proxy omitted: BotID blocks legitimate client RPC (e.g. eth_getBalance for funding wallet).
    // Mint/transfer remain protected; proxy is read/forward only.
    { path: '/api/story/factory/deploy-collection', method: 'POST' },
    { path: '/api/poap/create-event', method: 'POST' },
    { path: '/api/poap-proxy', method: 'POST' },
    { path: '/api/metokens/sync', method: 'POST' },
    { path: '/api/metokens/alchemy', method: 'POST' },
    { path: '/api/metokens', method: 'POST' },
    { path: '/api/metokens/*', method: 'PUT' },
    { path: '/api/metokens/*/balance', method: 'PUT' },
    { path: '/api/metokens-subgraph', method: 'POST' },
    { path: '/api/membership', method: 'POST' },
    { path: '/api/livepeer/sign-jwt', method: 'POST' },
    { path: '/api/livepeer/token-gate', method: 'POST' },
    { path: '/api/livepeer/livepeer-proxy', method: 'POST' },
    { path: '/api/livepeer', method: 'POST' },
    { path: '/api/livepeer/attestation', method: 'POST' },
    { path: '/api/ai/upload-to-ipfs', method: 'POST' },
    { path: '/api/ai/generate-thumbnail', method: 'POST' },
    { path: '/api/unlock-nft', method: 'POST' },
    { path: '/api/video-assets/sync-views/*', method: 'POST' },
    { path: '/api/video-assets/*/regenerate-thumbnail', method: 'POST' },
    { path: '/api/coinbase/session-token', method: 'POST' },
    { path: '/api/reality-eth-subgraph', method: 'POST' },
    { path: '/api/metokens/*/transactions', method: 'POST' },
    // Server actions: pages that invoke saveCreatorCollectionAction (Next.js POSTs to page URL)
    { path: '/', method: 'POST' },
    { path: '/studio', method: 'POST' },
    { path: '/studio/*', method: 'POST' },
  ],
});
