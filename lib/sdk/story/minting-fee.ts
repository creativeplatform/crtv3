/**
 * Helpers for Story Protocol PIL minting fees (WIP / $DATA, 18 decimals).
 */

import { parseEther } from "viem";
import { WIP_TOKEN_ADDRESS } from "@/lib/sdk/story/constants";

/** Story WIP / $DATA payment token for PIL minting fees. */
export const STORY_LICENSE_FEE_CURRENCY = WIP_TOKEN_ADDRESS;

/**
 * Convert a human-readable WIP amount (e.g. 1.5) to wei bigint.
 * Invalid / negative / empty values become 0n (free).
 */
export function mintingFeeToWei(amount: number | string | undefined | null): bigint {
  if (amount === undefined || amount === null || amount === "") return 0n;
  const n = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(n) || n <= 0) return 0n;
  try {
    // Avoid scientific notation (e.g. 1e-7) which parseEther rejects.
    const fixed = n.toFixed(18).replace(/\.?0+$/, "");
    return parseEther(fixed);
  } catch {
    return 0n;
  }
}
