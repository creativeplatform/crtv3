/** Base mainnet token icons (with Base network badge). */
export const BASE_TOKEN_ICONS = {
  ETH: '/images/tokens/ETH_on_Base.png',
  USDC: '/images/tokens/USDC_on_Base.png',
  DAI: '/images/tokens/DAI_on_Base.png',
  USDS: '/images/tokens/USDS_on_Base.png',
  GHO: '/images/tokens/GHO_on_Base.png',
} as const;

export type BaseTokenIconSymbol = keyof typeof BASE_TOKEN_ICONS;

/** Generic (non-Base) fallbacks. */
const GENERIC_TOKEN_ICONS: Record<string, string> = {
  ETH: '/images/tokens/eth-logo.svg',
  USDC: '/images/tokens/usdc-logo.svg',
  DAI: '/images/tokens/dai-logo.svg',
};

export function getTokenIcon(symbol: string, chainId?: number): string {
  const key = symbol.toUpperCase();
  const isBase = chainId === 8453 || chainId === undefined;

  if (isBase && key in BASE_TOKEN_ICONS) {
    return BASE_TOKEN_ICONS[key as BaseTokenIconSymbol];
  }

  return GENERIC_TOKEN_ICONS[key] ?? BASE_TOKEN_ICONS.ETH;
}

export function getHubAssetIcon(symbol: string, chainId?: number): string {
  return getTokenIcon(symbol, chainId);
}
