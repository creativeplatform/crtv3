/** Song Cup admin wallets (submissions review + matchup curation). */
export const SONG_CUP_ADMIN_WALLETS = [
  "0xdE4b0371BBa20602685916ceeE5B22025a811734",
  /** creative.eth */
  "0xf00f94794cE5B989e751b9D229b2786fBA8f6d63",
] as const;

export function isSongCupAdminWallet(address: string | null | undefined): boolean {
  if (!address) return false;
  const normalized = address.toLowerCase();
  return SONG_CUP_ADMIN_WALLETS.some((w) => w.toLowerCase() === normalized);
}

export function truncateWalletAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
