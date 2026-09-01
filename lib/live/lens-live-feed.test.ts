import {
  buildGoingLivePostContent,
  getLiveLensFeedConfigError,
  getLiveLensFeedId,
} from "@/lib/live/lens-live-feed";

describe("lens-live-feed", () => {
  const prev = process.env.NEXT_PUBLIC_LIVE_LENS_FEED_ID;

  afterEach(() => {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_LIVE_LENS_FEED_ID;
    else process.env.NEXT_PUBLIC_LIVE_LENS_FEED_ID = prev;
    delete process.env.NEXT_PUBLIC_SONGCHAIN_FEED_ID;
  });

  it("builds going-live post content with watch url", () => {
    const text = buildGoingLivePostContent({
      streamName: "Jazz Night",
      watchUrl: "https://tv.example/watch/abc",
    });
    expect(text).toContain("🔴 LIVE now: Jazz Night");
    expect(text).toContain("https://tv.example/watch/abc");
    expect(text).toContain("Chat in the comments");
  });

  it("prefers LIVE_LENS_FEED_ID over songchain", () => {
    process.env.NEXT_PUBLIC_LIVE_LENS_FEED_ID =
      "0x1111111111111111111111111111111111111111";
    process.env.NEXT_PUBLIC_SONGCHAIN_FEED_ID =
      "0x2222222222222222222222222222222222222222";
    expect(getLiveLensFeedId()).toBe(
      "0x1111111111111111111111111111111111111111"
    );
    expect(getLiveLensFeedConfigError()).toBeNull();
  });
});
