/**
 * Lens Chain definitions for Account Kit, viem, and Grove storage.
 *
 * Alchemy quickstart (Lens Sepolia, chain 37111, GRASS):
 * https://www.alchemy.com/docs/reference/lens-api-quickstart
 *
 * Alchemy’s docs emphasize Sepolia testnet; mainnet (232, GHO) uses the same
 * NEXT_PUBLIC_ALCHEMY_API_KEY when your app has Lens mainnet enabled, or public RPC.
 */
import { chains as lensSdkChains } from "@lens-chain/sdk/viem";
import type { Chain } from "viem";

export type LensNetwork = "mainnet" | "testnet";

/** Lens Sepolia testnet — Alchemy’s documented Lens network (chain 37111). */
export const LENS_SEPOLIA_CHAIN_ID = lensSdkChains.testnet.id;

/** Lens Chain mainnet (chain 232). */
export const LENS_MAINNET_CHAIN_ID = lensSdkChains.mainnet.id;

export function getLensNetwork(): LensNetwork {
  return process.env.NEXT_PUBLIC_LENS_ENV === "production" ? "mainnet" : "testnet";
}

/** Alchemy JSON-RPC base URLs per Lens network. */
export function lensAlchemyRpcUrl(network: LensNetwork, apiKey: string): string {
  return network === "mainnet"
    ? `https://lens-mainnet.g.alchemy.com/v2/${apiKey}`
    : `https://lens-sepolia.g.alchemy.com/v2/${apiKey}`;
}

/**
 * Resolves Lens Chain RPC URL (client-safe env vars only).
 * Priority: NEXT_PUBLIC_LENS_RPC_URL → NEXT_PUBLIC_ALCHEMY_API_KEY → public Lens RPC.
 */
export function resolveLensRpcUrl(network: LensNetwork = getLensNetwork()): string {
  const override = process.env.NEXT_PUBLIC_LENS_RPC_URL?.trim();
  if (override) return override;

  const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY?.trim();
  if (alchemyKey) return lensAlchemyRpcUrl(network, alchemyKey);

  const fallback = lensSdkChains[network].rpcUrls.default.http[0];
  if (fallback) return fallback;

  return network === "mainnet" ? "https://rpc.lens.xyz" : "https://rpc.testnet.lens.dev";
}

/** Lens chain for Account Kit / viem with Alchemy RPC when configured. */
export function getLensChain(network: LensNetwork = getLensNetwork()): Chain {
  const base = lensSdkChains[network];
  const rpc = resolveLensRpcUrl(network);
  return {
    ...base,
    rpcUrls: {
      ...base.rpcUrls,
      default: { http: [rpc] },
    },
  };
}

export function getLensChainId(network: LensNetwork = getLensNetwork()): number {
  return lensSdkChains[network].id;
}
