/**
 * MeToken hub configuration and collateral stablecoin helpers (Base mainnet).
 */
import { erc20Abi } from 'viem';
import { DAI_TOKEN_ADDRESSES, DAI_TOKEN_DECIMALS, DAI_TOKEN_SYMBOL } from '@/lib/contracts/DAIToken';
import { USDC_TOKEN_ADDRESSES, USDC_TOKEN_DECIMALS, USDC_TOKEN_SYMBOL } from '@/lib/contracts/USDCToken';
import { USDS_TOKEN_ADDRESSES, USDS_TOKEN_DECIMALS, USDS_TOKEN_SYMBOL } from '@/lib/contracts/USDSToken';
import { GHO_TOKEN_ADDRESSES, GHO_TOKEN_DECIMALS, GHO_TOKEN_SYMBOL } from '@/lib/contracts/GHOToken';
import {
  METOKEN_DIAMOND_BASE,
  METOKEN_FACTORY_BASE,
} from '@/lib/contracts/metokens/deployments';

export { METOKEN_DIAMOND_BASE, METOKEN_FACTORY_BASE };

/** Hub 1 — legacy DAI collateral (live on Base). */
export const DAI_HUB_ID = 1;
/** Hub 2 — USDC (recommended default for new MeTokens). */
export const USDC_HUB_ID = 2;
/** Hub 3 — USDS (Sky Protocol). */
export const USDS_HUB_ID = 3;
/** Hub 4 — GHO (Aave). */
export const GHO_HUB_ID = 4;

export type HubAssetSymbol = 'DAI' | 'USDS' | 'USDC' | 'GHO';

export interface HubAssetConfig {
  symbol: HubAssetSymbol;
  address: `0x${string}`;
  decimals: number;
  hubId: number;
  displayName: string;
  description: string;
  /** One-line positioning for UI. */
  tagline: string;
  /** Primary use case on Creative. */
  bestFor: string;
  /** Honest tradeoff users should know. */
  tradeoff: string;
  /** Logo path for UI. */
  logo: string;
  /** Legacy token — still supported for existing MeTokens on Hub 1. */
  deprecated?: boolean;
  /** Preferred collateral for newly created MeTokens. */
  recommended?: boolean;
}

export const HUB_ASSET_CONFIGS: Record<HubAssetSymbol, HubAssetConfig> = {
  DAI: {
    symbol: 'DAI',
    address: DAI_TOKEN_ADDRESSES.base as `0x${string}`,
    decimals: DAI_TOKEN_DECIMALS,
    hubId: DAI_HUB_ID,
    displayName: 'DAI (Legacy)',
    description: 'Legacy MakerDAO stablecoin. Existing Hub 1 MeTokens only.',
    tagline: 'Legacy stable — being replaced by USDS',
    bestFor: 'Existing MeTokens already on Hub 1',
    tradeoff: 'DAI is phased out on major exchanges; use USDS or USDC for new tokens.',
    logo: '/images/tokens/dai-logo.svg',
    deprecated: true,
  },
  USDS: {
    symbol: 'USDS',
    address: USDS_TOKEN_ADDRESSES.base as `0x${string}`,
    decimals: USDS_TOKEN_DECIMALS,
    hubId: USDS_HUB_ID,
    displayName: 'USDS',
    description: 'Sky Protocol stablecoin — the upgraded successor to DAI (1:1 convertible).',
    tagline: 'Decentralized stable with Sky savings rewards',
    bestFor: 'Creators and holders who want decentralized backing and built-in savings perks',
    tradeoff: 'The DAI → USDS rename may need a quick explainer; crypto-backed stability can wobble in extreme market crashes.',
    logo: '/images/tokens/USDS_on_Base.png',
  },
  USDC: {
    symbol: 'USDC',
    address: USDC_TOKEN_ADDRESSES.base as `0x${string}`,
    decimals: USDC_TOKEN_DECIMALS,
    hubId: USDC_HUB_ID,
    displayName: 'USDC',
    description: 'Circle USD Coin — dominant stable on Base, backed 1:1 by US dollars in bank reserves.',
    tagline: 'Industry standard for everyday payments on Base',
    bestFor: 'Fast onboarding, paying creators, casual use, and smooth cash-out to banks',
    tradeoff: 'Centralized — Circle can freeze funds if required by law enforcement.',
    logo: '/images/tokens/usdc-logo.svg',
    recommended: true,
  },
  GHO: {
    symbol: 'GHO',
    address: GHO_TOKEN_ADDRESSES.base as `0x${string}`,
    decimals: GHO_TOKEN_DECIMALS,
    hubId: GHO_HUB_ID,
    displayName: 'GHO',
    description: 'Aave GHO — decentralized stable designed for lending and borrowing.',
    tagline: 'Aave stable for DeFi power users',
    bestFor: 'Advanced lending, borrowing, and yield vaults without selling other assets',
    tradeoff: 'Smaller market and not widely used for everyday spending; loan health must be managed in volatile markets.',
    logo: '/images/tokens/GHO_on_Base.png',
  },
};

/** Preferred order when selecting default hub for new MeTokens. */
export const HUB_PREFERENCE_ORDER: HubAssetSymbol[] = ['USDC', 'USDS', 'GHO', 'DAI'];

export const DEFAULT_HUB_ASSET: HubAssetSymbol = 'USDC';

export function getHubAssetByAddress(assetAddress: string): HubAssetConfig | null {
  const normalized = assetAddress.toLowerCase();
  for (const config of Object.values(HUB_ASSET_CONFIGS)) {
    if (config.address.toLowerCase() === normalized) {
      return config;
    }
  }
  return null;
}

export function getHubAssetByHubId(hubId: number): HubAssetConfig | null {
  for (const config of Object.values(HUB_ASSET_CONFIGS)) {
    if (config.hubId === hubId) {
      return config;
    }
  }
  return null;
}

export function getHubAssetBySymbol(symbol: HubAssetSymbol): HubAssetConfig {
  return HUB_ASSET_CONFIGS[symbol];
}

export function getHubErc20Contract(hubId: number) {
  const asset = getHubAssetByHubId(hubId) ?? HUB_ASSET_CONFIGS[DEFAULT_HUB_ASSET];
  return {
    address: asset.address,
    abi: erc20Abi,
    symbol: asset.symbol,
    decimals: asset.decimals,
  } as const;
}

export function formatMeTokenBackingLabel(hubId: number): string {
  const asset = getHubAssetByHubId(hubId);
  if (!asset) return `Hub ${hubId}`;
  return `Backed by ${asset.displayName}`;
}

/** Default curve params matching Hub 1 (DAI) on Base. refundRatio is ppm (max 1e6); 800000 = 80%. */
export const DEFAULT_HUB_CURVE_PARAMS = {
  refundRatio: '800000',
  baseY: '224',
  reserveWeight: 32,
} as const;

export const DAI_HUB_VAULT_BASE = '0xff6Eb470bf0D817B17DFD596F1B2b3110682a40f' as const;

/** All stable hubs registered on Base (2026-06). */
export const PENDING_STABLE_HUBS: HubAssetSymbol[] = [];
