import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("viem", () => ({
  isAddress: (value: string) => /^0x[a-fA-F0-9]{40}$/.test(value),
}));

const CREATOR = "0xcccccccccccccccccccccccccccccccccccccccc";

const mockRequireWalletAuthFor = vi.fn();
const mockResolveStreamForCreator = vi.fn();
const mockCreateStreamRecord = vi.fn();
const mockFetch = vi.fn();

vi.mock("@/lib/middleware/rateLimit", () => ({
  rateLimiters: { standard: vi.fn(async () => null) },
}));

vi.mock("@/lib/auth/require-wallet", () => ({
  requireWalletAuthFor: (...args: unknown[]) => mockRequireWalletAuthFor(...args),
  WalletAuthError: class WalletAuthError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
      this.name = "WalletAuthError";
    }
  },
}));

vi.mock("@/services/streams", () => ({
  resolveStreamForCreator: (...args: unknown[]) => mockResolveStreamForCreator(...args),
  createStreamRecord: (...args: unknown[]) => mockCreateStreamRecord(...args),
}));

vi.mock("@/lib/utils/logger", () => ({
  serverLogger: { warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { POST } from "./route";

const validBody = {
  creatorAddress: CREATOR,
  name: "Test Stream",
  profiles: [
    {
      name: "720p",
      width: 1280,
      height: 720,
      bitrate: 2_500_000,
      fps: 30,
      fpsDen: 1,
      quality: 23,
      gop: "2",
      profile: "H264Baseline",
    },
  ],
  record: true,
  playbackPolicy: { type: "jwt" },
};

function streamRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/livepeer/livepeer-proxy", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/livepeer/livepeer-proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireWalletAuthFor.mockResolvedValue({ address: CREATOR });
    mockResolveStreamForCreator.mockResolvedValue(null);
    mockCreateStreamRecord.mockResolvedValue({ id: "db-1" });
    process.env.LIVEPEER_FULL_API_KEY = "test-full-key";
    global.fetch = mockFetch as typeof fetch;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns MISSING_API_KEY when full key is absent", async () => {
    delete process.env.LIVEPEER_FULL_API_KEY;

    const res = await POST(streamRequest(validBody));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("MISSING_API_KEY");
  });

  it("returns 401 without wallet auth", async () => {
    const { WalletAuthError } = await import("@/lib/auth/require-wallet");
    mockRequireWalletAuthFor.mockRejectedValue(new WalletAuthError(401, "Missing wallet auth"));

    const res = await POST(streamRequest(validBody));
    expect(res.status).toBe(401);
    expect(mockCreateStreamRecord).not.toHaveBeenCalled();
  });

  it("returns LIVEPEER_ERROR when upstream fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 402,
      json: async () => ({ error: "quota exceeded" }),
    });

    const res = await POST(streamRequest(validBody));
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.code).toBe("LIVEPEER_ERROR");
    expect(body.error).toBe("quota exceeded");
  });

  it("creates stream and persists record for authenticated creator", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: "stream-1",
        playbackId: "playback-1",
        streamKey: "secret-key",
      }),
    });

    const res = await POST(streamRequest(validBody));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.streamId).toBe("stream-1");
    expect(json.playbackId).toBe("playback-1");
    expect(json.streamKey).toBe("secret-key");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/stream"),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"creatorId"'),
      }),
    );
    expect(mockCreateStreamRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        creator_id: CREATOR,
        stream_key: "secret-key",
      }),
    );
  });
});
