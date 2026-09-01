import { describe, expect, it } from "vitest";
import { StreamProxyError, userMessageForStreamProxyError } from "./stream-proxy-errors";

describe("stream-proxy-errors", () => {
  it("maps StreamProxyError codes to user messages", () => {
    const err = new StreamProxyError(
      "quota exceeded",
      "LIVEPEER_ERROR",
      402,
    );
    expect(userMessageForStreamProxyError(err)).toBe("quota exceeded");
  });

  it("maps BOTID_DENIED to security message", () => {
    const err = new StreamProxyError("denied", "BOTID_DENIED", 403);
    expect(userMessageForStreamProxyError(err)).toContain("Security check");
  });
});
