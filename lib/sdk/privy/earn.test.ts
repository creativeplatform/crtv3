import { describe, expect, it } from "vitest";
import { basisPointsToPercent } from "@/lib/sdk/privy/config";
import { resolveEmbeddedEthereumWallet } from "@/lib/sdk/privy/wallet-resolver";
import type { User } from "@privy-io/node";

describe("privy earn helpers", () => {
  it("converts basis points to percent", () => {
    expect(basisPointsToPercent(361)).toBe("3.61");
    expect(basisPointsToPercent(null)).toBeNull();
  });

  it("resolves embedded ethereum wallet from linked accounts", () => {
    const user = {
      linked_accounts: [
        {
          type: "wallet",
          chain_type: "ethereum",
          wallet_client_type: "privy",
          connector_type: "embedded",
          wallet_client: "privy",
          id: "wallet-123",
          address: "0xabc",
        },
      ],
    } as unknown as User;

    expect(resolveEmbeddedEthereumWallet(user)).toEqual({
      walletId: "wallet-123",
      address: "0xabc",
    });
  });

  it("returns null when no embedded wallet exists", () => {
    const user = { linked_accounts: [] } as unknown as User;
    expect(resolveEmbeddedEthereumWallet(user)).toBeNull();
  });
});
