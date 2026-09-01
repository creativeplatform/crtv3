import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const mockVerifyX402PaymentFromRequest = vi.fn();

vi.mock("@/lib/middleware/rateLimit", () => ({
  rateLimiters: {
    apiKey: vi.fn(async () => null),
    generous: vi.fn(async () => null),
    playbackInfo: vi.fn(async () => null),
  },
}));

vi.mock("@/lib/middleware/x402Gate", () => ({
  PLATFORM_API_CORS_HEADERS: {
    "Access-Control-Allow-Origin": "*",
  },
  buildX402PaymentRequiredResponse: vi.fn(() =>
    Response.json({ error: "Payment Required", accepts: [{ payTo: "0xrecipient" }] }, { status: 402 }),
  ),
  getX402PriceForResource: vi.fn(() => "10000"),
  getX402Recipient: vi.fn(() => "0xrecipient"),
  verifyX402PaymentFromRequest: (...args: unknown[]) =>
    mockVerifyX402PaymentFromRequest(...args),
}));

vi.mock("@/lib/utils/logger", () => ({
  serverLogger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { requirePlatformApiAccess } from "@/lib/middleware/platformApiAccess";

describe("requirePlatformApiAccess", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.PLATFORM_API_ACCESS_ENABLED = "true";
    process.env.CREATIVE_PLATFORM_ADMIN_API_KEYS = "crtv_admin_test";
    process.env.CREATIVE_PLATFORM_PARTNER_API_KEYS = "mixtape:crtv_pk_mixtape_test";
    process.env.X402_API_RECIPIENT = "0x31ee83aef931a1af321c505053040e98545a5614";
    process.env.X402_PLAYBACK_RESOLVE_PRICE = "10000";
    mockVerifyX402PaymentFromRequest.mockResolvedValue({
      ok: false,
      error: "Missing payment proof",
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  it("allows admin API key", async () => {
    const request = new NextRequest("http://localhost/api/test", {
      headers: { Authorization: "Bearer crtv_admin_test" },
    });

    const result = await requirePlatformApiAccess(request, { resource: "playback.resolve" });
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.tier).toBe("admin");
    }
  });

  it("allows partner API key", async () => {
    const request = new NextRequest("http://localhost/api/test", {
      headers: { Authorization: "Bearer crtv_pk_mixtape_test" },
    });

    const result = await requirePlatformApiAccess(request, { resource: "playback.resolve" });
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.tier).toBe("partner");
      expect(result.keyId).toBe("mixtape");
    }
  });

  it("returns 401 for invalid API key", async () => {
    const request = new NextRequest("http://localhost/api/test", {
      headers: { Authorization: "Bearer invalid" },
    });

    const result = await requirePlatformApiAccess(request, { resource: "playback.resolve" });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.response.status).toBe(401);
    }
  });

  it("returns 402 when no auth and no payment", async () => {
    const request = new NextRequest("http://localhost/api/test");
    const result = await requirePlatformApiAccess(request, { resource: "playback.resolve" });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.response.status).toBe(402);
    }
  });

  it("allows x402 payment proof", async () => {
    mockVerifyX402PaymentFromRequest.mockResolvedValueOnce({ ok: true });
    const request = new NextRequest("http://localhost/api/test", {
      headers: { "X-Payment-Proof": "proof" },
    });

    const result = await requirePlatformApiAccess(request, { resource: "playback.resolve" });
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.tier).toBe("x402");
    }
  });

  it("bypasses gating when access is disabled", async () => {
    process.env.PLATFORM_API_ACCESS_ENABLED = "false";
    delete process.env.CREATIVE_PLATFORM_ADMIN_API_KEYS;
    delete process.env.CREATIVE_PLATFORM_PARTNER_API_KEYS;
    delete process.env.X402_API_RECIPIENT;

    const request = new NextRequest("http://localhost/api/test");
    const result = await requirePlatformApiAccess(request, { resource: "playback.resolve" });
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.tier).toBe("public");
    }
  });

  it("allows same-origin requests without auth when gating is enabled", async () => {
    const request = new NextRequest("http://localhost/api/livepeer/playback-info", {
      headers: { "Sec-Fetch-Site": "same-origin" },
    });

    const result = await requirePlatformApiAccess(request, { resource: "playback.info" });
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.tier).toBe("public");
    }
  });

  it("allows same-site requests without auth when gating is enabled", async () => {
    const request = new NextRequest("http://localhost/api/livepeer/playback-info", {
      headers: { "Sec-Fetch-Site": "same-site" },
    });

    const result = await requirePlatformApiAccess(request, { resource: "playback.info" });
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.tier).toBe("public");
    }
  });

  it("returns 402 for cross-site requests without auth", async () => {
    const request = new NextRequest("http://localhost/api/livepeer/playback-info", {
      headers: {
        "Sec-Fetch-Site": "cross-site",
        Origin: "https://evil.example.com",
      },
    });

    const result = await requirePlatformApiAccess(request, { resource: "playback.info" });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.response.status).toBe(402);
    }
  });

  it("allows partner API key on cross-origin requests", async () => {
    const request = new NextRequest("https://tv.creativeplatform.xyz/api/video-assets/by-asset-id/uuid/playback", {
      headers: {
        Authorization: "Bearer crtv_pk_mixtape_test",
        Origin: "https://air.creativeplatform.xyz",
        "Sec-Fetch-Site": "cross-site",
      },
    });

    const result = await requirePlatformApiAccess(request, { resource: "playback.resolve" });
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.tier).toBe("partner");
      expect(result.keyId).toBe("mixtape");
    }
  });

  it("prefers partner API key over same-origin bypass", async () => {
    const request = new NextRequest("http://localhost/api/livepeer/playback-info", {
      headers: {
        Authorization: "Bearer crtv_pk_mixtape_test",
        "Sec-Fetch-Site": "same-origin",
      },
    });

    const result = await requirePlatformApiAccess(request, { resource: "playback.info" });
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.tier).toBe("partner");
      expect(result.keyId).toBe("mixtape");
    }
  });
});
