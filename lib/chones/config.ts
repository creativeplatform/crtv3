import {
  buildHallidayInputAssets,
  buildHallidayOutputAsset,
  isHallidaySandboxEnabled,
  LENS_GHO_TOKEN_ADDRESS,
} from "@/lib/songchain/halliday";
import { getLensNetwork } from "@/lib/sdk/lens/chains";
import { normalizeLensPrimitiveId } from "@/lib/sdk/lens/primitive-id";
import type { SongchainConfig } from "@/lib/songchain/config";

export type ChonesConfig = SongchainConfig;

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
 * Reads Chones channel configuration from environment variables.
 */
export function getChonesConfig(): ChonesConfig {
  const appId = readLensPrimitiveEnv(
    "NEXT_PUBLIC_CHONES_APP_ID",
    "CHONES_APP_ID",
  );
  const publicFeedId = readLensPrimitiveEnv(
    "NEXT_PUBLIC_CHONES_FEED_ID",
    "CHONES_FEED_ID",
  );
  const exclusiveFeedId = readLensPrimitiveEnv(
    "NEXT_PUBLIC_CHONES_EXCLUSIVE_FEED_ID",
    "CHONES_EXCLUSIVE_FEED_ID",
  );
  const groupId = readLensPrimitiveEnv(
    "NEXT_PUBLIC_CHONES_GROUP_ID",
    "CHONES_GROUP_ID",
  );
  const graphId = readLensPrimitiveEnv(
    "NEXT_PUBLIC_CHONES_GRAPH_ID",
    "CHONES_GRAPH_ID",
  );

  const tokenOverride = readEnv(
    "NEXT_PUBLIC_HALLIDAY_DESTINATION_TOKEN",
    "HALLIDAY_DESTINATION_TOKEN",
  );

  const hallidayApiKey = readEnv(
    "NEXT_PUBLIC_HALLIDAY_API_KEY",
    "HALLIDAY_API_KEY",
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
    season2Enabled: false,
    season2PublicFeedId: null,
    season2ExclusiveFeedId: null,
    season2LockAddress: null,
  };
}

/**
 * HACKATHON BETA–specific Lens primitives (used on `/chones/hack-beta` only).
 */
export function getHackBetaConfig(): ChonesConfig {
  const shared = getChonesConfig();

  const appId = readLensPrimitiveEnv(
    "NEXT_PUBLIC_HACK_BETA_APP_ID",
    "HACK_BETA_APP_ID",
  );
  const publicFeedId = readLensPrimitiveEnv(
    "NEXT_PUBLIC_HACK_BETA_FEED_ID",
    "HACK_BETA_FEED_ID",
  );
  const exclusiveFeedId = readLensPrimitiveEnv(
    "NEXT_PUBLIC_HACK_BETA_EXCLUSIVE_FEED_ID",
    "HACK_BETA_EXCLUSIVE_FEED_ID",
  );
  const groupId = readLensPrimitiveEnv(
    "NEXT_PUBLIC_HACK_BETA_GROUP_ID",
    "HACK_BETA_GROUP_ID",
  );
  const graphId = readLensPrimitiveEnv(
    "NEXT_PUBLIC_HACK_BETA_GRAPH_ID",
    "HACK_BETA_GRAPH_ID",
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
