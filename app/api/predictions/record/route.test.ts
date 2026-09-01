import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const USER = "0x1111111111111111111111111111111111111111";
const TX = "0x" + "b".repeat(64);
const QUESTION_ID = "0x" + "c".repeat(64);
const VIDEO_UUID = "a1b2c3d4-e5f6-1234-9abc-def012345678";
const VIDEO_PK = 42;

const mockRequireWalletAuthFor = vi.fn();
const mockVerifyPredictionCreationTx = vi.fn();
const mockGetAllMemberships = vi.fn();
const mockCountPredictionMarketsThisMonthUtc = vi.fn();
const mockGetPremiumPredictionAccess = vi.fn();
const mockVideoLookup = vi.fn();
const mockLinkUpsert = vi.fn();
const mockQuotaInsert = vi.fn();

vi.mock("botid/server", () => ({
  checkBotId: vi.fn(async () => ({ isBot: false })),
}));

vi.mock("viem", () => ({
  isAddress: (value: string) => /^0x[a-fA-F0-9]{40}$/.test(value),
  getAddress: (value: string) => value.toLowerCase(),
}));

vi.mock("@/lib/middleware/rateLimit", () => ({
  rateLimiters: { generous: vi.fn(async () => null) },
}));

vi.mock("@/lib/auth/require-wallet", () => ({
  requireWalletAuthFor: (...args: unknown[]) => mockRequireWalletAuthFor(...args),
  WalletAuthError: class WalletAuthError extends Error {
    constructor(public status: number, message: string) {
      super(message);
      this.name = "WalletAuthError";
    }
  },
}));

vi.mock("@/lib/chain/verifyTransactionReceipt", () => ({
  TransactionVerificationError: class TransactionVerificationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "TransactionVerificationError";
    }
  },
}));

vi.mock("@/lib/predictions/verifyPredictionCreationTx", () => ({
  verifyPredictionCreationTx: (...args: unknown[]) => mockVerifyPredictionCreationTx(...args),
}));

vi.mock("@/lib/sdk/unlock/services", () => ({
  unlockService: {
    getAllMemberships: (...args: unknown[]) => mockGetAllMemberships(...args),
  },
}));

vi.mock("@/lib/predictions/prediction-quota", () => ({
  countPredictionMarketsThisMonthUtc: (...args: unknown[]) =>
    mockCountPredictionMarketsThisMonthUtc(...args),
  getPremiumPredictionAccess: (...args: unknown[]) => mockGetPremiumPredictionAccess(...args),
  normalizeCreatorAddress: (address: string) => address.toLowerCase(),
  PREDICTION_MARKETS_MONTHLY_LIMIT: 3,
}));

vi.mock("@/lib/access/platform-admin", () => ({
  isPlatformAdmin: () => false,
}));

vi.mock("@/lib/access/creator-membership", () => ({
  hasValidCreatorPass: () => false,
}));

// Supabase service-role double, routed by table name:
// - video_assets            -> select/eq/maybeSingle (Livepeer UUID -> internal PK)
// - prediction_video_links  -> upsert (video link, on question_id conflict)
// - prediction_market_creations -> insert (quota row)
type SupaChain = {
  select: (...args: unknown[]) => SupaChain;
  eq: (...args: unknown[]) => SupaChain;
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
  insert: (row: Record<string, unknown>) => PromiseLike<{ error: unknown }>;
  upsert: (
    row: Record<string, unknown>,
    opts?: Record<string, unknown>,
  ) => PromiseLike<{ error: unknown }>;
};

vi.mock("@/lib/sdk/supabase/service", () => ({
  supabaseService: {
    from: (table: string) => {
      const chain = {} as SupaChain;
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.maybeSingle = () => {
        if (table === "video_assets") return mockVideoLookup();
        return Promise.resolve({ data: null, error: null });
      };
      chain.insert = (row) => {
        if (table === "prediction_market_creations") return mockQuotaInsert(row);
        return Promise.resolve({ error: null });
      };
      chain.upsert = (row, opts) => {
        if (table === "prediction_video_links") return mockLinkUpsert(row, opts);
        return Promise.resolve({ error: null });
      };
      return chain;
    },
  },
}));

import { POST } from "./route";

function recordRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/predictions/record", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("predictions/record POST security", () => {
  beforeEach(() => {
    mockRequireWalletAuthFor.mockResolvedValue({ address: USER });
    mockVerifyPredictionCreationTx.mockResolvedValue({
      questionId: QUESTION_ID,
      creatorAddress: USER,
      transactionHash: TX,
    });
    mockGetAllMemberships.mockResolvedValue([]);
    mockGetPremiumPredictionAccess.mockReturnValue({ unlimited: false, premiumTier: null });
    mockCountPredictionMarketsThisMonthUtc.mockResolvedValue(0);
    mockVideoLookup.mockResolvedValue({ data: { id: VIDEO_PK }, error: null });
    mockLinkUpsert.mockResolvedValue({ error: null });
    mockQuotaInsert.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without wallet auth", async () => {
    const { WalletAuthError } = await import("@/lib/auth/require-wallet");
    mockRequireWalletAuthFor.mockRejectedValue(new WalletAuthError(401, "Missing wallet auth"));

    const res = await POST(recordRequest({ address: USER, transactionHash: TX }));
    expect(res.status).toBe(401);
    expect(mockQuotaInsert).not.toHaveBeenCalled();
    expect(mockLinkUpsert).not.toHaveBeenCalled();
  });

  it("returns 400 when tx verification fails", async () => {
    const { TransactionVerificationError } = await import("@/lib/chain/verifyTransactionReceipt");
    mockVerifyPredictionCreationTx.mockRejectedValue(
      new TransactionVerificationError("No valid Reality.eth question creation found in transaction"),
    );

    const res = await POST(recordRequest({ address: USER, transactionHash: TX }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("Reality.eth");
    expect(mockQuotaInsert).not.toHaveBeenCalled();
    expect(mockLinkUpsert).not.toHaveBeenCalled();
  });

  it("records quota usage when verification succeeds", async () => {
    const res = await POST(recordRequest({
      address: USER,
      transactionHash: TX,
      title: "Test market",
    }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.recorded).toBe(true);
    expect(mockQuotaInsert).toHaveBeenCalledWith(
      expect.objectContaining({ creator_address: USER }),
    );
  });

  it("writes a video link when videoAssetId is provided", async () => {
    const res = await POST(recordRequest({
      address: USER,
      transactionHash: TX,
      questionId: QUESTION_ID,
      videoAssetId: VIDEO_UUID,
    }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.recorded).toBe(true);
    expect(mockLinkUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        question_id: QUESTION_ID.toLowerCase(),
        video_asset_id: VIDEO_PK,
        created_by: USER,
      }),
      expect.objectContaining({ onConflict: "question_id", ignoreDuplicates: true }),
    );
  });

  it("falls back to the on-chain question ID when questionId is omitted", async () => {
    const res = await POST(recordRequest({
      address: USER,
      transactionHash: TX,
      videoAssetId: VIDEO_UUID,
    }));

    expect(res.status).toBe(200);
    expect(mockLinkUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ question_id: QUESTION_ID.toLowerCase() }),
      expect.anything(),
    );
  });

  it("does not touch links when videoAssetId is omitted", async () => {
    const res = await POST(recordRequest({
      address: USER,
      transactionHash: TX,
      questionId: QUESTION_ID,
    }));

    expect(res.status).toBe(200);
    expect(mockLinkUpsert).not.toHaveBeenCalled();
  });

  it("records with linked=false when the video asset does not exist", async () => {
    mockVideoLookup.mockResolvedValue({ data: null, error: null });

    const res = await POST(recordRequest({
      address: USER,
      transactionHash: TX,
      questionId: QUESTION_ID,
      videoAssetId: VIDEO_UUID,
    }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.recorded).toBe(true);
    expect(json.linked).toBe(false);
    expect(mockLinkUpsert).not.toHaveBeenCalled();
    expect(mockQuotaInsert).toHaveBeenCalled();
  });

  it("still writes the video link for premium creators who skip the quota insert", async () => {
    mockGetPremiumPredictionAccess.mockReturnValue({ unlimited: true, premiumTier: "investor" });

    const res = await POST(recordRequest({
      address: USER,
      transactionHash: TX,
      questionId: QUESTION_ID,
      videoAssetId: VIDEO_UUID,
    }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.recorded).toBe(false);
    expect(json.unlimited).toBe(true);
    expect(json.linked).toBe(true);
    expect(mockLinkUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ question_id: QUESTION_ID.toLowerCase(), video_asset_id: VIDEO_PK }),
      expect.objectContaining({ onConflict: "question_id" }),
    );
    expect(mockQuotaInsert).not.toHaveBeenCalled();
  });

  it("does not let a link failure block quota recording", async () => {
    mockLinkUpsert.mockResolvedValue({ error: { code: "23505", message: "duplicate" } });

    const res = await POST(recordRequest({
      address: USER,
      transactionHash: TX,
      questionId: QUESTION_ID,
      videoAssetId: VIDEO_UUID,
    }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.recorded).toBe(true);
    expect(json.linked).toBe(false);
    expect(mockQuotaInsert).toHaveBeenCalled();
  });
});