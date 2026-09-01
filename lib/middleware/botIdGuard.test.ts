import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const mockCheckBotId = vi.fn();

vi.mock("botid/server", () => ({
  checkBotId: (...args: unknown[]) => mockCheckBotId(...args),
}));

vi.mock("@/lib/utils/logger", () => ({
  serverLogger: { warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { requireHumanOrVerifiedBot } from "./botIdGuard";

describe("requireHumanOrVerifiedBot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows humans", async () => {
    mockCheckBotId.mockResolvedValue({ isBot: false, isVerifiedBot: false });
    const result = await requireHumanOrVerifiedBot("test");
    expect(result.allowed).toBe(true);
  });

  it("allows verified bots", async () => {
    mockCheckBotId.mockResolvedValue({
      isBot: true,
      isVerifiedBot: true,
      verifiedBotName: "chatgpt-operator",
    });
    const result = await requireHumanOrVerifiedBot("test");
    expect(result.allowed).toBe(true);
  });

  it("blocks unverified bots", async () => {
    mockCheckBotId.mockResolvedValue({ isBot: true, isVerifiedBot: false });
    const result = await requireHumanOrVerifiedBot("test");
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.response.status).toBe(403);
      const body = await result.response.json();
      expect(body.code).toBe("BOTID_DENIED");
    }
  });
});
