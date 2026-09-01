import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getSiteOrigin,
  getVideoOgImagePath,
  getVideoOgImageUrl,
  resolveSharePreviewThumbnail,
} from "./og-image";

describe("getSiteOrigin", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers NEXT_PUBLIC_SITE_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://tv.creativeplatform.xyz/");
    vi.stubEnv("NEXT_PUBLIC_URL", "https://other.example");
    vi.stubEnv("VERCEL_URL", "preview.vercel.app");
    expect(getSiteOrigin()).toBe("https://tv.creativeplatform.xyz");
  });

  it("falls back to NEXT_PUBLIC_URL then NEXT_PUBLIC_APP_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_URL", "https://app.example.com/");
    expect(getSiteOrigin()).toBe("https://app.example.com");

    vi.stubEnv("NEXT_PUBLIC_URL", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app2.example.com");
    expect(getSiteOrigin()).toBe("https://app2.example.com");
  });

  it("uses production origin instead of VERCEL_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_URL", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("VERCEL_URL", "crtv3-git-preview.vercel.app");
    expect(getSiteOrigin()).toBe("https://tv.creativeplatform.xyz");
  });
});

describe("getVideoOgImagePath", () => {
  it("builds relative proxy path for video id", () => {
    expect(getVideoOgImagePath({ id: "abc-123" })).toBe(
      "/api/og/video?id=abc-123"
    );
  });

  it("builds relative proxy path for playbackId", () => {
    expect(getVideoOgImagePath({ playbackId: "pb_1" })).toBe(
      "/api/og/video?playbackId=pb_1"
    );
  });

  it("prefers id over playbackId", () => {
    expect(getVideoOgImagePath({ id: "abc", playbackId: "pb" })).toBe(
      "/api/og/video?id=abc"
    );
  });

  it("falls back to default thumbnail path", () => {
    expect(getVideoOgImagePath({})).toBe("/Creative_TV.png");
  });
});

describe("getVideoOgImageUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds absolute proxy URL for video id", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://tv.creativeplatform.xyz");
    expect(getVideoOgImageUrl({ id: "abc-123" })).toBe(
      "https://tv.creativeplatform.xyz/api/og/video?id=abc-123"
    );
  });

  it("builds absolute proxy URL for playbackId", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://tv.creativeplatform.xyz");
    expect(getVideoOgImageUrl({ playbackId: "pb_1" })).toBe(
      "https://tv.creativeplatform.xyz/api/og/video?playbackId=pb_1"
    );
  });
});

describe("resolveSharePreviewThumbnail", () => {
  it("uses OG proxy for standard discover video shares", () => {
    expect(
      resolveSharePreviewThumbnail({
        videoId: "asset-uuid",
        playbackId: "pb_1",
      })
    ).toBe("/api/og/video?id=asset-uuid");
  });

  it("uses OG proxy for /watch share URLs (matches watch page unfurl)", () => {
    expect(
      resolveSharePreviewThumbnail({
        videoId: "pb_1",
        shareUrlOverride: "/watch/pb_1",
        thumbnailUrlOverride: "https://example.com/custom.png",
      })
    ).toBe("/api/og/video?playbackId=pb_1");
  });

  it("uses OG proxy for /discover share URL overrides", () => {
    expect(
      resolveSharePreviewThumbnail({
        videoId: "x",
        shareUrlOverride: "/discover/vid-99",
      })
    ).toBe("/api/og/video?id=vid-99");
  });

  it("uses thumbnail override for non-video share targets", () => {
    expect(
      resolveSharePreviewThumbnail({
        videoId: "campaign-1",
        shareUrlOverride: "/vote/campaign-1",
        thumbnailUrlOverride: "https://example.com/campaign.png",
      })
    ).toBe("https://example.com/campaign.png");
  });

  it("falls back to default for non-video shares without override", () => {
    expect(
      resolveSharePreviewThumbnail({
        videoId: "pred-1",
        shareUrlOverride: "/predict/pred-1",
      })
    ).toBe("/Creative_TV.png");
  });
});
