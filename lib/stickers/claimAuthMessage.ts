/**
 * Canonical message a Snapshot voter (EOA) signs to authorize minting a
 * campaign-sticker claim voucher to a specific claimer (smart account).
 *
 * Binding the claimer + proposal into the signed message prevents replaying a
 * generic wallet-auth signature to redirect a voucher to an attacker's
 * account. Shared between the client (ClaimStickerButton) and the server
 * (/api/stickers/verify-vote); keep both sides in sync.
 */
export function buildStickerClaimAuthMessage(opts: {
  voter: string;
  claimer: string;
  proposalId: string;
  timestamp: number;
}): string {
  return `Creative TV sticker claim: voter ${opts.voter.toLowerCase()} authorizes claimer ${opts.claimer.toLowerCase()} for proposal ${opts.proposalId} at ${opts.timestamp}`;
}
