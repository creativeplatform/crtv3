import {
  buildHallidayInputAssets,
  buildHallidayOutputAsset,
  isHallidaySandboxEnabled,
  LENS_GHO_TOKEN_ADDRESS,
} from '@/lib/songchain/halliday';
import { SONG_CUP_CLUB_FEED_ID, SONG_CUP_CLUB_GROUP_ID } from '@/lib/songchain/events';
import { getLensNetwork } from '@/lib/sdk/lens/chains';
import { normalizeLensPrimitiveId } from '@/lib/sdk/lens/primitive-id';

export type SongchainConfig = {
  enabled: boolean;
  /** Lens app contract — used to resolve feed addresses (not a post target). */
  appId: string | null;
  publicFeedId: string | null;
  exclusiveFeedId: string | null;
  groupId: string | null;
  /** Lens social graph — required for follow/unfollow on Songchain. */
  graphId: string | null;
  hallidayApiKey: string | null;
  /** Halliday Payments SDK `outputs` entry, e.g. `lens:0x…800a`. */
  hallidayOutputAsset: string;
  /** Halliday Payments SDK `inputs` entries, e.g. `usd` for fiat onramp. */
  hallidayInputAssets: string[];
  hallidaySandbox: boolean;
  /** When true, /songchain/season-2 is publicly accessible. */
  season2Enabled: boolean;
  season2PublicFeedId: string | null;
  season2ExclusiveFeedId: string | null;
  /** Unlock PublicLock on Lens mainnet for Season 2 exclusive access (10 GHO). */
  season2LockAddress: string | null;
};

function readEnv(...keys: string[]): string | null {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return null;
}

function readLensPrimitiveEnv(...keys: string[]): string | null {
  const value = readEnv(...keys);
  return normalizeLensPrimitiveId(value);
}

/**
 * Reads Songchain configuration from environment variables.
 *
 * Prefer calling this from Server Components or Route Handlers so values reflect
 * runtime env (e.g. Vercel) without requiring a client rebuild. Client
 * components should receive the result via props instead of calling this directly.
 */
export function getSongchainConfig(): SongchainConfig {
  const appId = readLensPrimitiveEnv(
    'NEXT_PUBLIC_SONGCHAIN_APP_ID',
    'SONGCHAIN_APP_ID',
    'NEXT_PUBLIC_LENS_APP_ID',
    'LENS_APP_ID',
  );
  const publicFeedId = readLensPrimitiveEnv(
    'NEXT_PUBLIC_SONGCHAIN_FEED_ID',
    'SONGCHAIN_FEED_ID',
  );
  const exclusiveFeedId = readLensPrimitiveEnv(
    'NEXT_PUBLIC_SONGCHAIN_EXCLUSIVE_FEED_ID',
    'SONGCHAIN_EXCLUSIVE_FEED_ID',
  );
  const groupId = readLensPrimitiveEnv(
    'NEXT_PUBLIC_SONGCHAIN_GROUP_ID',
    'SONGCHAIN_GROUP_ID',
  );
  const graphId = readLensPrimitiveEnv(
    'NEXT_PUBLIC_SONGCHAIN_GRAPH_ID',
    'SONGCHAIN_GRAPH_ID',
  );

  const tokenOverride = readEnv(
    'NEXT_PUBLIC_HALLIDAY_DESTINATION_TOKEN',
    'HALLIDAY_DESTINATION_TOKEN',
  );

  const hallidayApiKey = readEnv(
    'NEXT_PUBLIC_HALLIDAY_API_KEY',
    'HALLIDAY_API_KEY',
  );

  const season2Enabled =
    readEnv('NEXT_PUBLIC_SONGCHAIN_SEASON_2_ENABLED')?.toLowerCase() === 'true';
  const season2PublicFeedId = readLensPrimitiveEnv(
    'NEXT_PUBLIC_SONGCHAIN_SEASON_2_FEED_ID',
    'SONGCHAIN_SEASON_2_FEED_ID',
  );
  const season2ExclusiveFeedId = readLensPrimitiveEnv(
    'NEXT_PUBLIC_SONGCHAIN_SEASON_2_EXCLUSIVE_FEED_ID',
    'SONGCHAIN_SEASON_2_EXCLUSIVE_FEED_ID',
  );
  const season2LockAddress = readLensPrimitiveEnv(
    'NEXT_PUBLIC_SONGCHAIN_SEASON_2_LOCK_ADDRESS',
    'SONGCHAIN_SEASON_2_LOCK_ADDRESS',
  );

  const network = getLensNetwork();

  return {
    enabled: Boolean(appId || publicFeedId || exclusiveFeedId || groupId || graphId),
    appId,
    publicFeedId,
    exclusiveFeedId,
    groupId,
    graphId,
    hallidayApiKey,
    hallidayOutputAsset: buildHallidayOutputAsset(
      network,
      tokenOverride ?? LENS_GHO_TOKEN_ADDRESS,
    ),
    hallidayInputAssets: buildHallidayInputAssets(),
    hallidaySandbox: isHallidaySandboxEnabled(),
    season2Enabled,
    season2PublicFeedId,
    season2ExclusiveFeedId,
    season2LockAddress,
  };
}

/**
 * Song Cup–specific Lens primitives (used on `/songchain/song-cup` only).
 * Does not inherit main Songchain app/feed/group/graph IDs.
 */
export function getSongCupConfig(): SongchainConfig {
  const shared = getSongchainConfig();

  const appId = readLensPrimitiveEnv(
    'NEXT_PUBLIC_SONG_CUP_APP_ID',
    'SONG_CUP_APP_ID',
  );
  const publicFeedId =
    readLensPrimitiveEnv(
      'NEXT_PUBLIC_SONG_CUP_FEED_ID',
      'SONG_CUP_FEED_ID',
    ) ?? normalizeLensPrimitiveId(SONG_CUP_CLUB_FEED_ID);
  const exclusiveFeedId = readLensPrimitiveEnv(
    'NEXT_PUBLIC_SONG_CUP_EXCLUSIVE_FEED_ID',
    'SONG_CUP_EXCLUSIVE_FEED_ID',
  );
  const groupId =
    readLensPrimitiveEnv(
      'NEXT_PUBLIC_SONG_CUP_GROUP_ID',
      'SONG_CUP_GROUP_ID',
    ) ?? normalizeLensPrimitiveId(SONG_CUP_CLUB_GROUP_ID);
  const graphId = readLensPrimitiveEnv(
    'NEXT_PUBLIC_SONG_CUP_GRAPH_ID',
    'SONG_CUP_GRAPH_ID',
  );

  return {
    enabled: Boolean(appId || publicFeedId || exclusiveFeedId || groupId || graphId),
    appId,
    publicFeedId,
    exclusiveFeedId,
    groupId,
    graphId,
    hallidayApiKey: shared.hallidayApiKey,
    hallidayOutputAsset: shared.hallidayOutputAsset,
    hallidayInputAssets: shared.hallidayInputAssets,
    hallidaySandbox: shared.hallidaySandbox,
    season2Enabled: false,
    season2PublicFeedId: null,
    season2ExclusiveFeedId: null,
    season2LockAddress: null,
  };
}
