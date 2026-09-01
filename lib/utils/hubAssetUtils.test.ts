import { describe, expect, it } from "vitest";
import { parseEther, parseUnits } from "viem";
import {
  calculateMeTokenVaultTvlUsd,
  resolveHubAsset,
} from "./hubAssetUtils";
import { DAI_HUB_ID, USDC_HUB_ID, USDS_HUB_ID, GHO_HUB_ID } from "@/lib/contracts/MeTokenHubs";

describe("hub collateral decimals", () => {
  it("uses 6 decimals for USDC hub and 18 for DAI/USDS/GHO", () => {
    expect(resolveHubAsset(USDC_HUB_ID).decimals).toBe(6);
    expect(resolveHubAsset(DAI_HUB_ID).decimals).toBe(18);
    expect(resolveHubAsset(USDS_HUB_ID).decimals).toBe(18);
    expect(resolveHubAsset(GHO_HUB_ID).decimals).toBe(18);
  });

  it("formats USDC vault collateral with 6 decimals", () => {
    // 25.5 USDC = 25_500_000 base units
    const tvl = calculateMeTokenVaultTvlUsd(
      parseUnits("25.5", 6),
      0n,
      USDC_HUB_ID
    );
    expect(tvl).toBeCloseTo(25.5, 6);
  });

  it("formats DAI vault collateral with 18 decimals", () => {
    const tvl = calculateMeTokenVaultTvlUsd(parseEther("25.5"), 0n, DAI_HUB_ID);
    expect(tvl).toBeCloseTo(25.5, 6);
  });

  it("does not treat USDC wei as 18-decimal ether", () => {
    // If we wrongly used formatEther on 1 USDC (1e6), we'd show ~0.000001
    const oneUsdc = parseUnits("1", 6);
    expect(calculateMeTokenVaultTvlUsd(oneUsdc, 0n, USDC_HUB_ID)).toBeCloseTo(1, 6);
    expect(Number(oneUsdc) / 1e18).toBeLessThan(0.001);
  });
});
