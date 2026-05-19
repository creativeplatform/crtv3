/**
 * viem public client for Lens Chain RPC (Alchemy or public fallback).
 * Mirrors Alchemy Lens quickstart: https://www.alchemy.com/docs/reference/lens-api-quickstart
 */
import { createPublicClient, http } from "viem";
import { getLensChain, resolveLensRpcUrl, getLensNetwork } from "@/lib/sdk/lens/chains";

export function createLensViemPublicClient() {
  const network = getLensNetwork();
  const chain = getLensChain(network);
  const rpcUrl = resolveLensRpcUrl(network);

  return createPublicClient({
    chain,
    transport: http(rpcUrl),
  });
}
