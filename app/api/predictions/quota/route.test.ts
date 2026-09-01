import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const ADMIN = "0x2953B96F9160955f6256c9D444F8F7950E6647Df";
const USER = "0x1111111111111111111111111111111111111111";

const mockGetAllMemberships = vi.fn();
const mockCountPredictionMarketsThisMonthUtc = vi.fn();

vi.mock("botid/server", () => ({
  checkBotId: vi.fn(async () => ({ isBot: false })),
}));

vi.mock("@/lib/middleware/rateLimit", () => ({
  rateLimiters: {
    generous: vi.fn(async () => null),
  },
}));

vi.mock("@/lib/sdk/unlock/services", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/sdk/unlock/services")>();
  return {
    ...actual,
    unlockService: {
      ...actual.unlockService,
      getAllMemberships: (...args: unknown[]) => mockGetAllMemberships(...args),
    },
  };
});

vi.mock("@/lib/predictions/prediction-quota", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/predictions/prediction-quota")>();
  return {
    ...actual,
    countPredictionMarketsThisMonthUtc: (...args: unknown[]) =>
      mockCountPredictionMarketsThisMonthUtc(...args),
  };
});

vi.mock("@/lib/sdk/supabase/service", () => ({
  supabaseService: {},
}));

describe("GET /api/predictions/quota", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAllMemberships.mockResolvedValue([]);
    mockCountPredictionMarketsThisMonthUtc.mockResolvedValue(1);
  });

  it("returns unlimited quota for platform admin", async () => {
    const { GET } = await import("./route");
    const req = new NextRequest(
      `http://localhost/api/predictions/quota?address=${ADMIN}`
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.unlimited).toBe(true);
    expect(body.remaining).toBeNull();
    expect(mockGetAllMemberships).not.toHaveBeenCalled();
  });

  it("returns monthly quota for non-admin users", async () => {
    const { GET } = await import("./route");
    const req = new NextRequest(
      `http://localhost/api/predictions/quota?address=${USER}`
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.unlimited).toBe(false);
    expect(body.usedThisMonth).toBe(1);
    expect(body.remaining).toBe(2);
    expect(mockGetAllMemberships).toHaveBeenCalled();
  });
});
