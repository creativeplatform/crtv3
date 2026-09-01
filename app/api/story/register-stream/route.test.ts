import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("viem", () => ({
  parseEther: (value: string) => BigInt(value),
}));

const CREATOR = "0xcccccccccccccccccccccccccccccccccccccccc";

const mockRequireWalletAuthFor = vi.fn();
const mockGetStreamByCreator = vi.fn();
const mockGetOrCreateCreatorCollection = vi.fn();
const mockMintAndRegisterIpAndAttachPilTerms = vi.fn();
const mockUpdateStreamStoryIp = vi.fn();

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

vi.mock("@/services/streams", () => ({
  getStreamByCreator: (...args: unknown[]) => mockGetStreamByCreator(...args),
  updateStreamStoryIp: (...args: unknown[]) => mockUpdateStreamStoryIp(...args),
}));

vi.mock("@/lib/sdk/story/collection-service", () => ({
  getOrCreateCreatorCollection: (...args: unknown[]) => mockGetOrCreateCreatorCollection(...args),
}));

vi.mock("@/lib/sdk/story/spg-service", () => ({
  mintAndRegisterIpAndAttachPilTerms: (...args: unknown[]) =>
    mockMintAndRegisterIpAndAttachPilTerms(...args),
}));

vi.mock("@/lib/sdk/story/client", () => ({
  createStoryClient: () => ({}),
}));

vi.mock("@/lib/sdk/grove/service", () => ({
  groveService: {
    uploadJson: vi.fn(async () => ({ success: true, url: "ipfs://meta" })),
  },
}));

vi.mock("@/lib/sdk/story/constants", () => ({
  WIP_TOKEN_ADDRESS: "0x1111111111111111111111111111111111111111",
}));

vi.mock("@story-protocol/core-sdk", () => ({
  PILFlavor: {
    commercialRemix: () => ({}),
  },
}));

vi.mock("@/lib/utils/logger", () => ({
  serverLogger: { error: vi.fn(), debug: vi.fn() },
}));

import { POST } from "./route";

function registerRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/story/register-stream", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("register-stream POST security", () => {
  beforeEach(() => {
    process.env.STORY_PROTOCOL_PRIVATE_KEY =
      "0x0000000000000000000000000000000000000000000000000000000000000001";
    mockRequireWalletAuthFor.mockResolvedValue({ address: CREATOR });
    mockGetStreamByCreator.mockResolvedValue({
      playback_id: "playback-1",
      name: "My Stream",
      story_ip_id: null,
    });
    mockGetOrCreateCreatorCollection.mockResolvedValue(CREATOR);
    mockMintAndRegisterIpAndAttachPilTerms.mockResolvedValue({
      ipId: "ip-1",
      tokenId: "1",
      txHash: "0xabc",
      licenseTermsIds: ["lt-1"],
    });
    mockUpdateStreamStoryIp.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without wallet auth", async () => {
    const { WalletAuthError } = await import("@/lib/auth/require-wallet");
    mockRequireWalletAuthFor.mockRejectedValue(new WalletAuthError(401, "Missing wallet auth"));

    const res = await POST(registerRequest({ creatorAddress: CREATOR }));
    expect(res.status).toBe(401);
    expect(mockGetOrCreateCreatorCollection).not.toHaveBeenCalled();
  });

  it("registers stream IP when auth succeeds", async () => {
    const res = await POST(registerRequest({ creatorAddress: CREATOR }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockRequireWalletAuthFor).toHaveBeenCalledWith(expect.any(NextRequest), CREATOR);
    expect(mockGetOrCreateCreatorCollection).toHaveBeenCalled();
  });
});
