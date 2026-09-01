import { parseUnits } from "viem";
import { LENS_GHO_TOKEN_ADDRESS } from "@/lib/songchain/halliday";
import { LENS_MAINNET_CHAIN_ID } from "@/lib/sdk/lens/chains";

/**
 * Songchain Season 2 Unlock (Lens mainnet) — deploy PublicLock offline, then set
 * NEXT_PUBLIC_SONGCHAIN_SEASON_2_LOCK_ADDRESS.
 *
 * Deploy checklist (not called from the app):
 * 1. createLock on SEASON_2_UNLOCK_FACTORY (chain 232)
 *    - keyPrice = SEASON_2_UNLOCK_KEY_PRICE (10 GHO)
 *    - tokenAddress = SEASON_2_UNLOCK_CURRENCY (Lens WGHO 0x…800a)
 *    - name/symbol for Season 2; set expirationDuration / maxNumberOfKeys as needed
 * 2. Set NEXT_PUBLIC_SONGCHAIN_SEASON_2_LOCK_ADDRESS to the deployed lock
 * 3. Enable Season 2 with NEXT_PUBLIC_SONGCHAIN_SEASON_2_ENABLED=true
 *
 * Factory startBlock (for future subgraph indexing): 6079300
 */
export const SEASON_2_UNLOCK_FACTORY =
  "0xbD32e0ea3b3a5b038E942A15De61508b4A61Bd23" as const;

export const SEASON_2_UNLOCK_START_BLOCK = 6079300;

export const SEASON_2_UNLOCK_CHAIN_ID = LENS_MAINNET_CHAIN_ID;

export const SEASON_2_UNLOCK_CURRENCY = LENS_GHO_TOKEN_ADDRESS;

/** GHO / WGHO on Lens uses 18 decimals. */
export const SEASON_2_UNLOCK_GHO_DECIMALS = 18;

export const SEASON_2_UNLOCK_PRICE_GHO = "10";

export const SEASON_2_UNLOCK_KEY_PRICE = parseUnits(
  SEASON_2_UNLOCK_PRICE_GHO,
  SEASON_2_UNLOCK_GHO_DECIMALS,
);
