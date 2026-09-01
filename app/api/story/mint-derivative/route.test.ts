import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const RECIPIENT = "0xcccccccccccccccccccccccccccccccccccccccc";

const mockRequireWalletAuthFor = vi.fn();
const mockGetVideoAssetById = vi.fn();
const mockGetOrCreateCreatorCollection = vi.fn();
const mockMintAndRegisterDerivative = vi.fn();
const mockUpdateVideoAsset = vi.fn();

vi.mock("botid/server", () => ({
  checkBotId: vi.fn(async () => ({ isBot: false })),
}));

vi.mock("@/lib/middleware/rateLimit", () => ({
  rateLimiters: { strict: vi.fn(async () => null) },
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

vi.mock("@/services/video-assets", () => ({
  getVideoAssetById: (...args: unknown[]) => mockGetVideoAssetById(...args),
  updateVideoAsset: (...args: unknown[]) => mockUpdateVideoAsset(...args),
}));

vi.mock("@/services/streams", () => ({
  getStreamByPlaybackId: vi.fn(async () => ({
    story_license_terms_id: "lt-1",
  })),
}));

vi.mock("@/lib/sdk/story/collection-service", () => ({
  getOrCreateCreatorCollection: (...args: unknown[]) => mockGetOrCreateCreatorCollection(...args),
}));

vi.mock("@/lib/sdk/story/spg-service", () => ({
  mintAndRegisterDerivative: (...args: unknown[]) => mockMintAndRegisterDerivative(...args),
}));

vi.mock("@/lib/sdk/story/client", () => ({
  createStoryClient: () => ({}),
}));

vi.mock("@/lib/sdk/grove/service", () => ({
  groveService: {
    uploadJson: vi.fn(async () => ({ success: true, url: "ipfs://meta" })),
  },
}));

vi.mock("@/lib/utils/logger", () => ({
  serverLogger: { error: vi.fn(), debug: vi.fn() },
}));

import { POST } from "./route";

function mintRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/story/mint-derivative", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("mint-derivative POST security", () => {
  beforeEach(() => {
    process.env.STORY_PROTOCOL_PRIVATE_KEY =
      "0x0000000000000000000000000000000000000000000000000000000000000001";
    mockRequireWalletAuthFor.mockResolvedValue({ address: RECIPIENT });
    mockGetVideoAssetById.mockResolvedValue({
      id: 1,
      source_type: "Clip",
      is_minted: false,
      clipper_address: RECIPIENT,
      parent_story_ip_id: "ip-parent",
      parent_playback_id: "playback-parent",
      title: "Clip",
      clip_start_ms: 0,
      clip_end_ms: 1000,
    });
    mockGetOrCreateCreatorCollection.mockResolvedValue(RECIPIENT);
    mockMintAndRegisterDerivative.mockResolvedValue({
      ipId: "ip-clip",
      tokenId: "2",
      txHash: "0xabc",
    });
    mockUpdateVideoAsset.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without wallet auth", async () => {
    const { WalletAuthError } = await import("@/lib/auth/require-wallet");
    mockRequireWalletAuthFor.mockRejectedValue(new WalletAuthError(401, "Missing wallet auth"));

    const res = await POST(
      mintRequest({ clipVideoAssetId: 1, recipient: RECIPIENT }),
    );
    expect(res.status).toBe(401);
    expect(mockGetOrCreateCreatorCollection).not.toHaveBeenCalled();
  });

  it("mints derivative when auth succeeds", async () => {
    const res = await POST(
      mintRequest({ clipVideoAssetId: 1, recipient: RECIPIENT }),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockRequireWalletAuthFor).toHaveBeenCalledWith(expect.any(NextRequest), RECIPIENT);
    expect(mockMintAndRegisterDerivative).toHaveBeenCalled();
  });
});
