import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const CREATOR = "0xcccccccccccccccccccccccccccccccccccccccc";

const mockRequireWalletAuthFor = vi.fn();
const mockGetOrCreateCreatorCollection = vi.fn();
const mockMintAndRegisterIp = vi.fn();

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

vi.mock("@/lib/sdk/story/collection-service", () => ({
  getOrCreateCreatorCollection: (...args: unknown[]) => mockGetOrCreateCreatorCollection(...args),
}));

vi.mock("@/lib/sdk/story/spg-service", () => ({
  mintAndRegisterIp: (...args: unknown[]) => mockMintAndRegisterIp(...args),
}));

vi.mock("@/lib/sdk/story/capture-transport", () => ({
  createCaptureTransport: () => ({}),
  getCapturedTxs: () => [
    { to: CREATOR, data: "0x1234", value: 0n, gas: 100n, gasPrice: 1n, chainId: 1315 },
  ],
}));

vi.mock("@/lib/sdk/story/client", () => ({
  createStoryClient: () => ({}),
  getStoryRpcUrl: () => "https://rpc.story.test",
}));

vi.mock("@/lib/utils/logger", () => ({
  serverLogger: { error: vi.fn(), debug: vi.fn() },
}));

import { POST } from "./route";

function prepareRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/story/prepare-mint", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("prepare-mint POST security", () => {
  beforeEach(() => {
    process.env.STORY_PROTOCOL_PRIVATE_KEY =
      "0x0000000000000000000000000000000000000000000000000000000000000001";
    mockRequireWalletAuthFor.mockResolvedValue({ address: CREATOR });
    mockGetOrCreateCreatorCollection.mockResolvedValue(CREATOR);
    mockMintAndRegisterIp.mockRejectedValue(new Error("capture"));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("does not create collection when wallet auth fails", async () => {
    const { WalletAuthError } = await import("@/lib/auth/require-wallet");
    mockRequireWalletAuthFor.mockRejectedValue(new WalletAuthError(401, "Invalid wallet signature"));

    const res = await POST(
      prepareRequest({
        creatorAddress: CREATOR,
        recipient: CREATOR,
        metadataURI: "ipfs://test",
        collectionName: "Test",
        collectionSymbol: "TST",
      }),
    );

    expect(res.status).toBe(401);
    expect(mockGetOrCreateCreatorCollection).not.toHaveBeenCalled();
  });

  it("rejects recipient mismatch", async () => {
    const res = await POST(
      prepareRequest({
        creatorAddress: CREATOR,
        recipient: "0x1111111111111111111111111111111111111111",
        metadataURI: "ipfs://test",
        collectionName: "Test",
        collectionSymbol: "TST",
      }),
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("recipient must match");
    expect(mockGetOrCreateCreatorCollection).not.toHaveBeenCalled();
  });

  it("prepares mint when auth succeeds", async () => {
    const res = await POST(
      prepareRequest({
        creatorAddress: CREATOR,
        recipient: CREATOR,
        metadataURI: "ipfs://test",
        collectionName: "Test",
        collectionSymbol: "TST",
      }),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockGetOrCreateCreatorCollection).toHaveBeenCalled();
  });
});
