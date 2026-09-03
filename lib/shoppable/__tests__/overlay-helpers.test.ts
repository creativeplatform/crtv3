import { describe, expect, it } from "vitest";

function withShopUtms(purchaseUrl: string, campaignId: string): string {
  const parsed = new URL(purchaseUrl);
  parsed.searchParams.set("utm_source", "creativetv");
  parsed.searchParams.set("utm_medium", "overlay");
  parsed.searchParams.set("utm_campaign", campaignId);
  return parsed.toString();
}

function clampOverlayPosition(boundingBox: [number, number, number, number]) {
  const [, xmin, ymax] = boundingBox;
  return {
    left: Math.min(xmin / 10, 72),
    top: Math.min(ymax / 10, 65),
  };
}

describe("shoppable overlay helpers", () => {
  it("appends creativetv UTM params", () => {
    const url = withShopUtms("https://shop.example/item?ref=1", "camp-1");
    expect(url).toContain("utm_source=creativetv");
    expect(url).toContain("utm_medium=overlay");
    expect(url).toContain("utm_campaign=camp-1");
    expect(url).toContain("ref=1");
  });

  it("clamps overlay position to viewport budgets", () => {
    // [ymin, xmin, ymax, xmax] — left from xmin, top from ymax
    expect(clampOverlayPosition([0, 900, 900, 990])).toEqual({
      left: 72,
      top: 65,
    });
    expect(clampOverlayPosition([100, 200, 400, 300])).toEqual({
      left: 20,
      top: 40,
    });
  });
});
