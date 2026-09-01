import { describe, expect, it } from "vitest";
import {
  mergeViewCounts,
  resolveViewCountSource,
  sumLivepeerViewMetrics,
} from "./view-count";

describe("view-count helpers", () => {
  it("never decreases stored views when merging Livepeer totals", () => {
    expect(mergeViewCounts(100, 40)).toBe(100);
    expect(mergeViewCounts(40, 100)).toBe(100);
    expect(mergeViewCounts(0, 12)).toBe(12);
    expect(mergeViewCounts(7, 0)).toBe(7);
  });

  it("sums current and legacy Livepeer view metrics", () => {
    expect(sumLivepeerViewMetrics({ viewCount: 8, legacyViewCount: 4 })).toBe(
      12,
    );
    expect(sumLivepeerViewMetrics({ viewCount: 5 })).toBe(5);
    expect(sumLivepeerViewMetrics({})).toBe(0);
  });

  it("resolves display source for traffic metrics", () => {
    // Both positive and unequal → merged (max is used for display elsewhere)
    expect(resolveViewCountSource(10, 20)).toBe("merged");
    expect(resolveViewCountSource(20, 10)).toBe("merged");

    // Equal non-zero → livepeer
    expect(resolveViewCountSource(30, 30)).toBe("livepeer");

    // Only Livepeer
    expect(resolveViewCountSource(5, 0)).toBe("livepeer");

    // Only database
    expect(resolveViewCountSource(0, 5)).toBe("database");

    // Neither
    expect(resolveViewCountSource(0, 0)).toBe("merged");
  });
});
