import { beforeEach, describe, expect, it, vi } from "vitest";

const VICTIM_EOA = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const ATTACKER_SCA = "0xcccccccccccccccccccccccccccccccccccccccc";

const mockMaybeSingle = vi.fn();
const mockIlike = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = vi.fn(() => ({ ilike: mockIlike }));
const mockEq = vi.fn(() => ({ select: () => ({ single: vi.fn() }) }));
const mockUpdate = vi.fn(() => ({ eq: mockEq }));
const mockIsPermittedSigner = vi.fn();
const mockVerifyWalletAuthArgs = vi.fn();

vi.mock("../lib/sdk/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("../lib/sdk/supabase/service", () => ({
  createServiceClient: vi.fn(async () => ({
    from: () => ({
      select: mockSelect,
      update: mockUpdate,
      insert: vi.fn(),
      eq: mockEq,
      ilike: mockIlike,
    }),
  })),
}));

vi.mock("@/lib/utils/linked-identity", () => ({
  isPermittedSigner: (...args: unknown[]) => mockIsPermittedSigner(...args),
}));

vi.mock("@/lib/auth/require-wallet", () => ({
  verifyWalletAuthArgs: (...args: unknown[]) => mockVerifyWalletAuthArgs(...args),
  WalletAuthError: class WalletAuthError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
      this.name = "WalletAuthError";
    }
  },
  walletAuthHeadersToArgs: vi.fn(),
}));

vi.mock("@/lib/utils/logger", () => ({
  serverLogger: { warn: vi.fn(), error: vi.fn(), debug: vi.fn(), info: vi.fn() },
}));

import { resolveStreamForCreator, updateStream } from "./streams";
import { WalletAuthError } from "@/lib/auth/require-wallet";

const legacyStream = {
  id: "stream-1",
  creator_id: VICTIM_EOA,
  stream_key: "victim-secret-key",
  stream_id: "lp-1",
  playback_id: "pb-1",
  is_live: false,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("resolveStreamForCreator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPermittedSigner.mockResolvedValue(false);
  });

  it("does not return a legacy stream when on-chain signer check fails", async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: legacyStream, error: null });

    const result = await resolveStreamForCreator(ATTACKER_SCA, VICTIM_EOA);

    expect(result).toBeNull();
    expect(mockIsPermittedSigner).toHaveBeenCalledWith(VICTIM_EOA, ATTACKER_SCA);
  });
});

describe("updateStream", () => {
  const auth = {
    address: VICTIM_EOA,
    timestamp: Math.floor(Date.now() / 1000),
    signature: "0xsig",
  };

  const mockUpdateSingle = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockReturnValue({
      ilike: () => ({
        select: () => ({
          single: mockUpdateSingle,
        }),
      }),
    } as unknown as ReturnType<typeof mockUpdate>);
  });

  it("rejects callers who are not the stream owner", async () => {
    mockVerifyWalletAuthArgs.mockResolvedValue({ address: ATTACKER_SCA });
    mockIsPermittedSigner.mockResolvedValue(false);

    await expect(
      updateStream(VICTIM_EOA, { name: "Hijacked" }, auth),
    ).rejects.toBeInstanceOf(WalletAuthError);

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("strips sensitive fields before persisting", async () => {
    mockVerifyWalletAuthArgs.mockResolvedValue({ address: VICTIM_EOA });
    mockUpdateSingle.mockResolvedValue({
      data: { ...legacyStream, name: "Safe" },
      error: null,
    });

    await updateStream(
      VICTIM_EOA,
      {
        name: "Safe",
        stream_key: "attacker-key",
      } as never,
      auth,
    );

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Safe",
      }),
    );
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.not.objectContaining({
        stream_key: "attacker-key",
      }),
    );
  });
});
