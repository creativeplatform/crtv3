import {
  isEmbeddedWalletLinkedAccount,
  type User,
} from "@privy-io/node";

export type ResolvedEmbeddedWallet = {
  walletId: string;
  address: string;
};

/** Resolve the user's Privy embedded Ethereum wallet used for Earn operations. */
export function resolveEmbeddedEthereumWallet(
  user: User,
): ResolvedEmbeddedWallet | null {
  for (const account of user.linked_accounts ?? []) {
    if (
      !isEmbeddedWalletLinkedAccount(account) ||
      account.chain_type !== "ethereum"
    ) {
      continue;
    }
    if (!account.id) continue;
    return { walletId: account.id, address: account.address };
  }
  return null;
}
