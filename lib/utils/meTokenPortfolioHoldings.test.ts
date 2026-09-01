import { describe, expect, it } from "vitest";
import { parseEther } from "viem";
import type { MeTokenHolding } from "@/lib/hooks/metokens/useMeTokenHoldings";
import type { MeTokenData } from "@/lib/hooks/metokens/useMeTokensSupabase";
import {
  buildOwnHoldingFallback,
  mergeHoldingsWithOwnMeToken,
} from "./meTokenPortfolioHoldings";

function stubHolding(
  overrides: Partial<MeTokenHolding> & Pick<MeTokenHolding, "address">
): MeTokenHolding {
  return {
    name: "Token",
    symbol: "TKN",
    balance: "1",
    balanceRaw: parseEther("1"),
    totalSupply: parseEther("10"),
    tvl: 100,
    holdingValueUsd: 10,
    creatorProfile: null,
    ownerAddress: "0xowner",
    isOwnMeToken: false,
    hubId: 2,
    balancePooled: BigInt(0),
    balanceLocked: BigInt(0),
    startTime: BigInt(0),
    endTime: BigInt(0),
    endCooldown: BigInt(0),
    targetHubId: 0,
    migration: false,
    collateralSymbol: "USDC",
    collateralDisplayName: "USDC",
    ...overrides,
  };
}

function stubOwnMeToken(overrides: Partial<MeTokenData> = {}): MeTokenData {
  return {
    address: "0xOwnToken",
    name: "Mine",
    symbol: "MINE",
    totalSupply: parseEther("100"),
    balance: parseEther("40"),
    info: {
      owner: "0xCreator",
      hubId: BigInt(2),
      balancePooled: BigInt(0),
      balanceLocked: BigInt(0),
      startTime: BigInt(0),
      endTime: BigInt(0),
      endCooldown: BigInt(0),
      targetHubId: BigInt(0),
      migration: "0x0000000000000000000000000000000000000000",
    },
    tvl: 200,
    hubId: 2,
    balancePooled: BigInt(0),
    balanceLocked: BigInt(0),
    owner: "0xCreator",
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("mergeHoldingsWithOwnMeToken", () => {
  it("prepends fallback when own address is missing from holdings", () => {
    const holdings = [stubHolding({ address: "0xOther" })];
    const merged = mergeHoldingsWithOwnMeToken(
      holdings,
      stubOwnMeToken(),
      "0xCreator"
    );
    expect(merged).toHaveLength(2);
    expect(merged[0].address).toBe("0xOwnToken");
    expect(merged[0].isOwnMeToken).toBe(true);
  });

  it("does not double-count when own address is already present with isOwnMeToken false", () => {
    const holdings = [
      stubHolding({
        address: "0xOwnToken",
        isOwnMeToken: false,
        holdingValueUsd: 25,
      }),
    ];
    const merged = mergeHoldingsWithOwnMeToken(
      holdings,
      stubOwnMeToken(),
      "0xCreator"
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].isOwnMeToken).toBe(true);
    expect(merged[0].holdingValueUsd).toBe(25);
  });

  it("treats null/undefined holdings as empty", () => {
    const merged = mergeHoldingsWithOwnMeToken(null, stubOwnMeToken(), "0xCreator");
    expect(merged).toHaveLength(1);
    expect(merged[0].isOwnMeToken).toBe(true);
  });

  it("buildOwnHoldingFallback computes pro-rata value from TVL", () => {
    const holding = buildOwnHoldingFallback(
      stubOwnMeToken({ tvl: 200, balance: parseEther("40"), totalSupply: parseEther("100") }),
      "0xCreator"
    );
    expect(holding.holdingValueUsd).toBeCloseTo(80, 5);
    expect(holding.isOwnMeToken).toBe(true);
  });
});
