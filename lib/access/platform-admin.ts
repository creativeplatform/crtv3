import { getAddress, isAddress } from "viem";

export const PLATFORM_ADMIN_ADDRESS =
  "0x2953B96F9160955f6256c9D444F8F7950E6647Df" as const;

export function isPlatformAdmin(address: string | null | undefined): boolean {
  if (!address || !isAddress(address)) return false;
  try {
    return getAddress(address).toLowerCase() === PLATFORM_ADMIN_ADDRESS.toLowerCase();
  } catch {
    return false;
  }
}
