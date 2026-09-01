import { NextRequest, NextResponse } from 'next/server';
import { getSongchainConfig, getSongCupConfig } from '@/lib/songchain/config';
import { getLensNetwork } from '@/lib/sdk/lens/chains';
import {
  getLensNetworkLabel,
  truncateFeedId,
} from '@/lib/songchain/feed-diagnostics';
import { checkLensFeedExists } from '@/lib/songchain/lens-feed';
import { checkLensGraphExists } from '@/lib/songchain/lens-graph';
import { resolveSongchainConfig } from '@/lib/songchain/resolve-lens-app';

export const dynamic = 'force-dynamic';

async function checkConfiguredFeed(
  feedId: string | null,
): Promise<{ configured: boolean; feedId: string; registered: boolean; error: string | null }> {
  if (!feedId) {
    return {
      configured: false,
      feedId: 'not configured',
      registered: false,
      error: null,
    };
  }

  const check = await checkLensFeedExists(feedId);
  return {
    configured: true,
    feedId: truncateFeedId(feedId),
    registered: check.exists,
    error: check.error,
  };
}

async function checkConfiguredGraph(
  graphId: string | null,
): Promise<{ configured: boolean; graphId: string; registered: boolean; error: string | null }> {
  if (!graphId) {
    return {
      configured: false,
      graphId: 'not configured',
      registered: false,
      error: null,
    };
  }

  const check = await checkLensGraphExists(graphId);
  return {
    configured: true,
    graphId: truncateFeedId(graphId),
    registered: check.exists,
    error: check.error,
  };
}

/** Public health check for Songchain / Lens env (no secrets). */
export async function GET(request: NextRequest) {
  const context = request.nextUrl.searchParams.get('context');
  const isSongCup = context === 'song-cup';
  const raw = isSongCup ? getSongCupConfig() : getSongchainConfig();
  const config = await resolveSongchainConfig(raw);
  const network = getLensNetwork();
  const envPrefix = isSongCup ? 'SONG_CUP' : 'SONGCHAIN';

  const [publicFeed, exclusiveFeed, graph] = await Promise.all([
    checkConfiguredFeed(config.publicFeedId),
    checkConfiguredFeed(config.exclusiveFeedId),
    checkConfiguredGraph(config.graphId),
  ]);

  const hints: string[] = [];
  if (!config.enabled) {
    hints.push(
      `Set NEXT_PUBLIC_${envPrefix}_FEED_ID (and related vars) in your deployment environment.`,
      'Ensure NEXT_PUBLIC_LENS_ENV matches the network where feeds were created.',
    );
    if (config.resolutionNotes.length > 0) {
      hints.push(...config.resolutionNotes);
    }
  }
  if (publicFeed.configured && !publicFeed.registered) {
    hints.push(
      `Public feed is not registered on Lens. Use a feed contract address — not your Lens app contract. Set NEXT_PUBLIC_${envPrefix}_APP_ID for the app and leave FEED_ID empty to auto-resolve, or set FEED_ID to a feed linked in the app dashboard.`,
    );
  }
  if (exclusiveFeed.configured && !exclusiveFeed.registered) {
    hints.push(
      `Exclusive feed address is set but not registered on Lens. Verify NEXT_PUBLIC_${envPrefix}_EXCLUSIVE_FEED_ID.`,
    );
  }
  if (graph.configured && !graph.registered) {
    hints.push(
      `Graph address is not registered on Lens. Set NEXT_PUBLIC_${envPrefix}_GRAPH_ID or resolve via NEXT_PUBLIC_${envPrefix}_APP_ID.`,
    );
  }

  return NextResponse.json({
    ok:
      config.enabled &&
      (!publicFeed.configured || publicFeed.registered) &&
      (!exclusiveFeed.configured || exclusiveFeed.registered) &&
      (!graph.configured || graph.registered),
    context: isSongCup ? 'song-cup' : 'songchain',
    lensNetwork: network,
    lensNetworkLabel: getLensNetworkLabel(network),
    appId: truncateFeedId(config.appId),
    resolutionNotes: config.resolutionNotes,
    feeds: {
      public: publicFeed,
      exclusive: exclusiveFeed,
      groupConfigured: Boolean(config.groupId),
      groupId: truncateFeedId(config.groupId),
      graph,
    },
    hints,
  });
}
