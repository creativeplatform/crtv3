import { describe, expect, it } from "vitest";
import { parseEther } from "viem";
import {
  estimateMeTokenHoldingValueUsd,
  formatMeTokenHoldingUsd,
  sumMeTokenHoldingValuesUsd,
} from "./meTokenHoldingValue";

describe("estimateMeTokenHoldingValueUsd", () => {
  it("returns pro-rata share of vault TVL", () => {
    // 25% of supply with $1000 TVL → $250
    const value = estimateMeTokenHoldingValueUsd({
      balanceRaw: parseEther("250"),
      totalSupply: parseEther("1000"),
      vaultTvlUsd: 1000,
    });
    expect(value).toBeCloseTo(250, 5);
  });

  it("returns 0 when supply or balance is empty", () => {
    expect(
      estimateMeTokenHoldingValueUsd({
        balanceRaw: parseEther("10"),
        totalSupply: BigInt(0),
        vaultTvlUsd: 100,
      })
    ).toBe(0);

    expect(
      estimateMeTokenHoldingValueUsd({
        balanceRaw: BigInt(0),
        totalSupply: parseEther("10"),
        vaultTvlUsd: 100,
      })
    ).toBe(0);
  });

  it("values creator self-holdings the same as any other holder", () => {
    const creatorBag = estimateMeTokenHoldingValueUsd({
      balanceRaw: parseEther("800"),
      totalSupply: parseEther("1000"),
      vaultTvlUsd: 500,
    });
    expect(creatorBag).toBeCloseTo(400, 5);
  });

  it("returns 0 when vault TVL is zero", () => {
    expect(
      estimateMeTokenHoldingValueUsd({
        balanceRaw: parseEther("100"),
        totalSupply: parseEther("100"),
        vaultTvlUsd: 0,
      })
    ).toBe(0);
  });

  it("does not underflow tiny ownership shares to zero", () => {
    // 1 of 10,000,000 tokens with $10,000 TVL ≈ $0.001
    const value = estimateMeTokenHoldingValueUsd({
      balanceRaw: parseEther("1"),
      totalSupply: parseEther("10000000"),
      vaultTvlUsd: 10_000,
    });
    expect(value).toBeGreaterThan(0);
    expect(value).toBeCloseTo(0.001, 6);
  });
});

describe("formatMeTokenHoldingUsd", () => {
  it("formats dust and larger amounts", () => {
    expect(formatMeTokenHoldingUsd(0)).toBe("$0.00");
    expect(formatMeTokenHoldingUsd(0.004)).toBe("<$0.01");
    expect(formatMeTokenHoldingUsd(12.345)).toBe("$12.35");
    expect(formatMeTokenHoldingUsd(2500)).toBe("$2.5K");
  });
});

describe("sumMeTokenHoldingValuesUsd", () => {
  it("sums portfolio estimates", () => {
    expect(
      sumMeTokenHoldingValuesUsd([
        { holdingValueUsd: 10 },
        { holdingValueUsd: 5.5 },
        {},
      ])
    ).toBeCloseTo(15.5);
  });
});
