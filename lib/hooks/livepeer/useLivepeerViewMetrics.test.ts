import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchLivepeerViewMetrics } from "./useLivepeerViewMetrics";

describe("fetchLivepeerViewMetrics", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("parses a successful payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          success: true,
          playbackId: "playback-1",
          viewCount: 3,
          playtimeMins: 10,
          legacyViewCount: 2,
        }),
      ),
    );

    await expect(fetchLivepeerViewMetrics("playback-1")).resolves.toEqual({
      playbackId: "playback-1",
      viewCount: 3,
      playtimeMins: 10,
      legacyViewCount: 2,
    });
  });

  it("throws with server error message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ error: "Server broke" }, { status: 503 }),
      ),
    );

    await expect(fetchLivepeerViewMetrics("p1")).rejects.toThrow(
      "Server broke",
    );
  });

  it("aborts when signal is aborted", async () => {
    const ac = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((_resolve, reject) => {
            ac.signal.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          }),
      ),
    );

    const pending = fetchLivepeerViewMetrics("p1", ac.signal);
    ac.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
});
