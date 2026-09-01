import { describe, expect, it } from "vitest";
import { formatAccountKitAuthError } from "./format-account-kit-auth-error";

describe("formatAccountKitAuthError", () => {
  it("maps passkey invalid origin to localhost guidance", () => {
    expect(formatAccountKitAuthError(new Error("Invalid origin"))).toMatch(
      /created on another site/i,
    );
    expect(formatAccountKitAuthError(new Error("Invalid origin"))).toMatch(
      /email instead/i,
    );
  });
});
