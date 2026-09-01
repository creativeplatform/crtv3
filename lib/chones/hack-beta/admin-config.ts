/** Hack Beta admin wallets (submissions review + mixtape URL). */
export const HACK_BETA_ADMIN_WALLETS = [
  "0xdE4b0371BBa20602685916ceeE5B22025a811734",
  "0x6aBAa01C84b8b962D197E8a62598fea3Cfe0c5AD",
] as const;

export function isHackBetaAdminWallet(address: string | null | undefined): boolean {
  if (!address) return false;
  const normalized = address.toLowerCase();
  return HACK_BETA_ADMIN_WALLETS.some((w) => w.toLowerCase() === normalized);
}

export function truncateWalletAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
