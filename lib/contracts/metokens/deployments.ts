import baseDeployment from '@/deployments/metokens/base.json';

export type MeTokensBaseDeployment = typeof baseDeployment;

export const METOKENS_BASE_DEPLOYMENT = baseDeployment;

export const METOKENS_BASE_CHAIN_ID = baseDeployment.chainId as 8453;

export const METOKENS_BASE_CONTRACTS = baseDeployment.contracts;

export const METOKEN_DIAMOND_BASE =
  baseDeployment.contracts.diamond.address as `0x${string}`;

export const METOKEN_FACTORY_BASE =
  baseDeployment.contracts.meTokenFactory.address as `0x${string}`;

export const METOKENS_BASE_FACETS = baseDeployment.contracts.facets;

export const METOKENS_BASE_HUBS = baseDeployment.contracts.hubs;

export const METOKENS_BASE_ASSETS = baseDeployment.contracts.assets;

/** @deprecated Use METOKEN_DIAMOND_BASE from deployments manifest */
export const METOKEN_DIAMOND_BASE_LEGACY = METOKEN_DIAMOND_BASE;
