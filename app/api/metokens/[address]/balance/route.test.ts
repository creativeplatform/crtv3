import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const METOKEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const USER = "0xcccccccccccccccccccccccccccccccccccccccc";

const mockRequireWalletAuthFor = vi.fn();
const mockVerifyMeTokenBalance = vi.fn();
const mockUpdateUserBalance = vi.fn();

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

vi.mock("@/lib/metokens/verifyMeTokenBalance", () => ({
  verifyMeTokenBalance: (...args: unknown[]) => mockVerifyMeTokenBalance(...args),
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
    updateUserBalance: (...args: unknown[]) => mockUpdateUserBalance(...args),
  },
}));

vi.mock("@/lib/utils/logger", () => ({
  serverLogger: { error: vi.fn(), debug: vi.fn() },
}));

import { PUT } from "./route";

function balanceRequest(body: Record<string, unknown>) {
  return new NextRequest(`http://localhost/api/metokens/${METOKEN}/balance`, {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("metokens balance PUT security", () => {
  beforeEach(() => {
    mockRequireWalletAuthFor.mockResolvedValue({ address: USER });
    mockVerifyMeTokenBalance.mockResolvedValue(2.5);
    mockUpdateUserBalance.mockResolvedValue({ user_address: USER, balance: 2.5 });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without wallet auth", async () => {
    const { WalletAuthError } = await import("@/lib/auth/require-wallet");
    mockRequireWalletAuthFor.mockRejectedValue(new WalletAuthError(401, "Missing wallet auth"));

    const res = await PUT(
      balanceRequest({ user_address: USER, balance: 2.5 }),
      { params: Promise.resolve({ address: METOKEN }) },
    );
    expect(res.status).toBe(401);
    expect(mockUpdateUserBalance).not.toHaveBeenCalled();
  });

  it("returns 400 when on-chain balance verification fails", async () => {
    const { TransactionVerificationError } = await import("@/lib/chain/verifyTransactionReceipt");
    mockVerifyMeTokenBalance.mockRejectedValue(
      new TransactionVerificationError("Claimed balance does not match on-chain balanceOf"),
    );

    const res = await PUT(
      balanceRequest({ user_address: USER, balance: 99 }),
      { params: Promise.resolve({ address: METOKEN }) },
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("balanceOf");
    expect(mockUpdateUserBalance).not.toHaveBeenCalled();
  });

  it("updates balance with verified on-chain value", async () => {
    const res = await PUT(
      balanceRequest({ user_address: USER, balance: 2.5 }),
      { params: Promise.resolve({ address: METOKEN }) },
    );

    expect(res.status).toBe(200);
    expect(mockUpdateUserBalance).toHaveBeenCalledWith(METOKEN, USER, 2.5);
  });
});
