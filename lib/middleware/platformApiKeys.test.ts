import { describe, expect, it } from "vitest";
import {
  extractBearerToken,
  matchPlatformApiKey,
  parsePlatformApiKeysFromEnv,
} from "@/lib/middleware/platformApiKeys";

describe("platformApiKeys", () => {
  it("parses admin and partner keys from env", () => {
    const keys = parsePlatformApiKeysFromEnv({
      NODE_ENV: "test",
      CREATIVE_PLATFORM_ADMIN_API_KEYS: "admin_a,admin_b",
      CREATIVE_PLATFORM_PARTNER_API_KEYS: "mixtape:secret_mixtape,create:secret_create",
    });

    expect(keys.adminSecrets).toEqual(["admin_a", "admin_b"]);
    expect(keys.partnerKeys.get("mixtape")).toBe("secret_mixtape");
    expect(keys.partnerKeys.get("create")).toBe("secret_create");
  });

  it("extracts bearer token", () => {
    expect(extractBearerToken("Bearer crtv_admin_abc")).toBe("crtv_admin_abc");
    expect(extractBearerToken("Basic abc")).toBeNull();
  });

  it("matches admin and partner keys with constant-time compare semantics", () => {
    const keys = parsePlatformApiKeysFromEnv({
      NODE_ENV: "test",
      CREATIVE_PLATFORM_ADMIN_API_KEYS: "crtv_admin_test",
      CREATIVE_PLATFORM_PARTNER_API_KEYS: "mixtape:partner_secret",
    });

    expect(matchPlatformApiKey("crtv_admin_test", keys)?.tier).toBe("admin");
    expect(matchPlatformApiKey("partner_secret", keys)).toEqual({
      tier: "partner",
      keyId: "mixtape",
    });
    expect(matchPlatformApiKey("wrong", keys)).toBeNull();
  });
});
