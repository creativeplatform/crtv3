import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const METOKEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const USER = "0xcccccccccccccccccccccccccccccccccccccccc";

const mockRequireWalletAuthFor = vi.fn();
const mockVerifyMeTokenTransaction = vi.fn();
const mockGetMeTokenByAddress = vi.fn();
const mockRecordTransaction = vi.fn();

vi.mock("botid/server", () => ({
  checkBotId: vi.fn(async () => ({ isBot: false })),
}));

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

vi.mock("@/lib/metokens/verifyMeTokenTransaction", () => ({
  verifyMeTokenTransaction: (...args: unknown[]) => mockVerifyMeTokenTransaction(...args),
}));

vi.mock("@/lib/chain/verifyTransactionReceipt", () => ({
  TransactionVerificationError: class TransactionVerificationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "TransactionVerificationError";
    }
  },
}));

vi.mock("@/lib/sdk/supabase/metokens", () => ({
  meTokenSupabaseService: {
    getMeTokenByAddress: (...args: unknown[]) => mockGetMeTokenByAddress(...args),
    recordTransaction: (...args: unknown[]) => mockRecordTransaction(...args),
  },
}));

vi.mock("@/lib/utils/logger", () => ({
  serverLogger: { error: vi.fn(), debug: vi.fn() },
}));

import { POST } from "./route";

function txRequest(body: Record<string, unknown>) {
  return new NextRequest(`http://localhost/api/metokens/${METOKEN}/transactions`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("metokens transactions POST security", () => {
  beforeEach(() => {
    mockRequireWalletAuthFor.mockResolvedValue({ address: USER });
    mockGetMeTokenByAddress.mockResolvedValue({ id: 1, address: METOKEN });
    mockVerifyMeTokenTransaction.mockResolvedValue({
      transactionHash: "0x" + "a".repeat(64),
      blockNumber: 123n,
      amount: 1.5,
      userAddress: USER,
      meTokenAddress: METOKEN,
      transactionType: "mint",
    });
    mockRecordTransaction.mockResolvedValue({ id: 99 });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without wallet auth", async () => {
    const { WalletAuthError } = await import("@/lib/auth/require-wallet");
    mockRequireWalletAuthFor.mockRejectedValue(new WalletAuthError(401, "Missing wallet auth"));

    const res = await POST(txRequest({
      user_address: USER,
      transaction_type: "mint",
      amount: 1,
      transaction_hash: "0x" + "a".repeat(64),
    }), { params: Promise.resolve({ address: METOKEN }) });

    expect(res.status).toBe(401);
    expect(mockRecordTransaction).not.toHaveBeenCalled();
  });

  it("returns 400 when transaction_hash is missing", async () => {
    const res = await POST(txRequest({
      user_address: USER,
      transaction_type: "mint",
      amount: 1,
    }), { params: Promise.resolve({ address: METOKEN }) });

    expect(res.status).toBe(400);
    expect(mockVerifyMeTokenTransaction).not.toHaveBeenCalled();
  });

  it("returns 400 when on-chain verification fails", async () => {
    const { TransactionVerificationError } = await import("@/lib/chain/verifyTransactionReceipt");
    mockVerifyMeTokenTransaction.mockRejectedValue(
      new TransactionVerificationError("No MeToken Transfer events found in transaction"),
    );

    const res = await POST(txRequest({
      user_address: USER,
      transaction_type: "mint",
      amount: 1,
      transaction_hash: "0x" + "a".repeat(64),
    }), { params: Promise.resolve({ address: METOKEN }) });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("Transfer");
    expect(mockRecordTransaction).not.toHaveBeenCalled();
  });

  it("records verified transaction on success", async () => {
    const res = await POST(txRequest({
      user_address: USER,
      transaction_type: "mint",
      amount: 1.5,
      transaction_hash: "0x" + "a".repeat(64),
    }), { params: Promise.resolve({ address: METOKEN }) });

    expect(res.status).toBe(201);
    expect(mockRecordTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        user_address: USER,
        amount: 1.5,
      }),
    );
  });
});
