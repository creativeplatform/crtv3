import { LOCK_ADDRESSES, type LockAddressValue } from "@/lib/sdk/unlock/services";

/**
 * Canonical human-readable names for each Creative Platform membership pass.
 *
 * The on-chain metadata for these Unlock Protocol locks sometimes contains
 * confusing or outdated names (e.g. "Creative Creator Pass"). UI code should
 * always display passes through this map so the label matches the actual tier.
 */
export const PASS_DISPLAY_NAMES: Record<LockAddressValue, string> = {
  [LOCK_ADDRESSES.BASE_CREATIVE_PASS]: "Creative Creator Pass",
  [LOCK_ADDRESSES.BASE_CREATIVE_CREATOR_PLUS]: "Creative Creator Plus",
  [LOCK_ADDRESSES.BASE_CREATIVE_PASS_2]: "Creative Investor Pass",
  [LOCK_ADDRESSES.BASE_CREATIVE_INVESTOR_PLUS]: "Creative Investor Plus",
  [LOCK_ADDRESSES.BASE_CREATIVE_PASS_3]: "Creative Brand Pass",
  [LOCK_ADDRESSES.BASE_CREATIVE_BRAND_PLUS]: "Creative Brand Plus",
} as const;

const PASS_DISPLAY_NAMES_BY_LOWER = Object.fromEntries(
  Object.entries(PASS_DISPLAY_NAMES).map(([address, name]) => [
    address.toLowerCase(),
    name,
  ])
);

/** Resolve the canonical display name for a membership lock address. */
export function getPassDisplayName(address?: string | null): string {
  if (!address) return "Creative Pass";
  return PASS_DISPLAY_NAMES_BY_LOWER[address.toLowerCase()] ?? "Creative Pass";
}
