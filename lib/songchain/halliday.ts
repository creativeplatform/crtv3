import { getLensNetwork, type LensNetwork } from '@/lib/sdk/lens/chains';

/** Lens GHO (wrapped gas token) — matches Lens + Halliday onramp docs. */
export const LENS_GHO_TOKEN_ADDRESS =
  '0x000000000000000000000000000000000000800a' as const;

const DEFAULT_CHAIN_SLUG: Record<LensNetwork, string> = {
  mainnet: 'lens',
  testnet: 'lens-testnet',
};

const DEFAULT_STORY_CHAIN_SLUG: Record<'mainnet' | 'testnet', string> = {
  mainnet: 'story',
  testnet: 'story-testnet',
};

function getStoryNetwork(): 'mainnet' | 'testnet' {
  return process.env.NEXT_PUBLIC_STORY_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
}

function readEnv(...keys: string[]): string | null {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return null;
}

/**
 * Normalizes a Halliday Payments SDK asset id.
 * Fiat symbols → lowercase (`usd`). Tokens → `chain:0x…` with lowercase chain slug and hex.
 * @see https://docs.halliday.xyz/pages/payments-sdk-docs
 */
export function normalizeHallidayAssetId(asset: string): string {
  const trimmed = asset.trim();
  if (!trimmed) return trimmed;

  if (!trimmed.includes(':')) {
    return trimmed.toLowerCase();
  }

  const colon = trimmed.indexOf(':');
  const chain = trimmed.slice(0, colon).trim().toLowerCase();
  const token = trimmed.slice(colon + 1).trim().toLowerCase();

  return `${chain}:${token}`;
}

/**
 * Halliday Payments SDK output asset id (`chain:tokenAddress`).
 * @see https://docs.halliday.xyz/pages/payments-sdk-docs
 */
export function buildHallidayOutputAsset(
  network: LensNetwork = getLensNetwork(),
  tokenAddress?: string | null,
): string {
  const assetOverride = readEnv(
    'NEXT_PUBLIC_HALLIDAY_OUTPUT_ASSET',
    'HALLIDAY_OUTPUT_ASSET',
  );
  if (assetOverride) return normalizeHallidayAssetId(assetOverride);

  const chainSlug =
    readEnv('NEXT_PUBLIC_HALLIDAY_CHAIN_SLUG', 'HALLIDAY_CHAIN_SLUG') ??
    DEFAULT_CHAIN_SLUG[network];

  const token = (tokenAddress ?? LENS_GHO_TOKEN_ADDRESS).toLowerCase();
  return normalizeHallidayAssetId(`${chainSlug}:${token}`);
}

/**
 * Halliday output asset for native $IP on Story Protocol (gas funding).
 * @see https://docs.halliday.xyz/pages/payments-sdk-docs
 */
export function buildHallidayStoryOutputAsset(
  network: 'mainnet' | 'testnet' = getStoryNetwork(),
): string {
  const assetOverride = readEnv(
    'NEXT_PUBLIC_HALLIDAY_STORY_OUTPUT_ASSET',
    'HALLIDAY_STORY_OUTPUT_ASSET',
  );
  if (assetOverride) return normalizeHallidayAssetId(assetOverride);

  const chainSlug =
    readEnv('NEXT_PUBLIC_HALLIDAY_STORY_CHAIN_SLUG', 'HALLIDAY_STORY_CHAIN_SLUG') ??
    DEFAULT_STORY_CHAIN_SLUG[network];

  return normalizeHallidayAssetId(`${chainSlug}:0x`);
}

export function isHallidaySandboxEnabled(): boolean {
  const value = readEnv('NEXT_PUBLIC_HALLIDAY_SANDBOX', 'HALLIDAY_SANDBOX');
  return value === '1' || value?.toLowerCase() === 'true';
}

/** True when the Halliday asset id targets Lens mainnet or testnet. */
export function isHallidayLensChainAsset(asset: string): boolean {
  const chain = normalizeHallidayAssetId(asset).split(':')[0];
  return chain === 'lens' || chain === 'lens-testnet';
}

/**
 * Halliday production rejects `lens:*` outputs (`Unknown Chain: 'lens'`).
 * Opt in with NEXT_PUBLIC_HALLIDAY_LENS_ENABLED=true once Halliday ships support.
 */
export function isHallidayLensOnrampSupported(): boolean {
  const value = readEnv(
    'NEXT_PUBLIC_HALLIDAY_LENS_ENABLED',
    'HALLIDAY_LENS_ENABLED',
  );
  return value === '1' || value?.toLowerCase() === 'true';
}

/**
 * Default fiat input for Halliday onramp (debit/credit → crypto).
 * Single `usd` pre-selects pay currency in the widget; add `eur` via env if needed.
 */
export const HALLIDAY_DEFAULT_INPUT_ASSETS = ['usd'] as const;

/**
 * Halliday Payments SDK input asset id (fiat symbol or `chain:tokenAddress`).
 * @see https://docs.halliday.xyz/pages/payments-sdk-docs
 */
export function buildHallidayInputAssets(): string[] {
  const override = readEnv(
    'NEXT_PUBLIC_HALLIDAY_INPUT_ASSET',
    'HALLIDAY_INPUT_ASSET',
  );
  if (override) {
    const assets = override
      .split(',')
      .map((value) => normalizeHallidayAssetId(value))
      .filter(Boolean);
    if (assets.length > 0) {
      return assets;
    }
  }
  return [...HALLIDAY_DEFAULT_INPUT_ASSETS];
}
