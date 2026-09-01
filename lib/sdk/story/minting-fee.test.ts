import { describe, expect, it } from "vitest";
import { mintingFeeToWei } from "./minting-fee";

describe("mintingFeeToWei", () => {
  it("parses normal amounts", () => {
    expect(mintingFeeToWei(1)).toBe(10n ** 18n);
    expect(mintingFeeToWei("1.5")).toBe(15n * 10n ** 17n);
  });

  it("does not collapse tiny fees to free via scientific notation", () => {
    // Number(0.0000001) stringifies as 1e-7 which parseEther rejects
    expect(mintingFeeToWei(0.0000001)).toBeGreaterThan(0n);
  });

  it("treats invalid/zero as free", () => {
    expect(mintingFeeToWei(0)).toBe(0n);
    expect(mintingFeeToWei(-1)).toBe(0n);
    expect(mintingFeeToWei(undefined)).toBe(0n);
  });
});
