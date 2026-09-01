import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("viem", () => ({
  createWalletClient: vi.fn(() => ({})),
  http: vi.fn(),
  privateKeyToAccount: vi.fn(() => ({ address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" })),
}));

const CREATOR = "0xcccccccccccccccccccccccccccccccccccccccc";

const mockRequireWalletAuthFor = vi.fn();
const mockDeployCreatorCollection = vi.fn();

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

vi.mock("@/lib/sdk/story/factory-contract-service", () => ({
  deployCreatorCollection: (...args: unknown[]) => mockDeployCreatorCollection(...args),
  getCollectionBytecode: () => "0x1234",
  getFactoryContractAddress: () => "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
}));

vi.mock("@/lib/sdk/story/client", () => ({
  getStoryRpcUrl: () => "https://rpc.story.test",
}));

vi.mock("@/lib/utils/logger", () => ({
  serverLogger: { error: vi.fn(), debug: vi.fn() },
}));

import { POST } from "./route";

function deployRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/story/factory/deploy-collection", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("deploy-collection POST security", () => {
  beforeEach(() => {
    process.env.FACTORY_OWNER_PRIVATE_KEY =
      "0x0000000000000000000000000000000000000000000000000000000000000001";
    mockRequireWalletAuthFor.mockResolvedValue({ address: CREATOR });
    mockDeployCreatorCollection.mockResolvedValue({
      collectionAddress: "0xdddddddddddddddddddddddddddddddddddddddd",
      txHash: "0xabc",
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when wallet auth fails", async () => {
    const { WalletAuthError } = await import("@/lib/auth/require-wallet");
    mockRequireWalletAuthFor.mockRejectedValue(new WalletAuthError(401, "Missing wallet auth"));

    const res = await POST(
      deployRequest({
        creatorAddress: CREATOR,
        collectionName: "Test",
        collectionSymbol: "TST",
      }),
    );
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toContain("Missing wallet auth");
    expect(mockDeployCreatorCollection).not.toHaveBeenCalled();
  });

  it("deploys when wallet auth succeeds", async () => {
    const res = await POST(
      deployRequest({
        creatorAddress: CREATOR,
        collectionName: "Test",
        collectionSymbol: "TST",
      }),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockRequireWalletAuthFor).toHaveBeenCalledWith(expect.any(NextRequest), CREATOR);
    expect(mockDeployCreatorCollection).toHaveBeenCalled();
  });
});
