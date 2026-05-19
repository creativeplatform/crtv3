import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchAllViews,
  livepeerStudioApiBaseUrl,
  resolveLivepeerStudioAuthToken,
} from "./views";

describe("Livepeer view metrics helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("prefers the full Livepeer API key", () => {
    vi.stubEnv("LIVEPEER_FULL_API_KEY", "full-key");
    vi.stubEnv("LIVEPEER_API_KEY", "standard-key");

    expect(resolveLivepeerStudioAuthToken()).toBe("full-key");
  });

  it("normalizes the Studio API base URL", () => {
    vi.stubEnv("LIVEPEER_FULL_API_URL", "https://livepeer.example/");

    expect(livepeerStudioApiBaseUrl()).toBe("https://livepeer.example");
  });

  it("fetches view metrics without using cache", async () => {
    vi.stubEnv("LIVEPEER_FULL_API_KEY", "full-key");
    const fetchMock = vi.fn(async () =>
      Response.json({
        playbackId: "playback-1",
        viewCount: 12,
        playtimeMins: 34,
        legacyViewCount: 5,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchAllViews("playback-1")).resolves.toEqual({
      playbackId: "playback-1",
      viewCount: 12,
      playtimeMins: 34,
      legacyViewCount: 5,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://livepeer.studio/api/data/views/query/total/playback-1",
      expect.objectContaining({
        cache: "no-store",
        headers: expect.any(Headers),
      }),
    );
    const [, options] = fetchMock.mock.calls[0];
    expect((options?.headers as Headers).get("Authorization")).toBe(
      "Bearer full-key",
    );
  });
});
