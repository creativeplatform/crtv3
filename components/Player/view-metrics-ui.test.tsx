/**
 * @vitest-environment jsdom
 */
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/lib/hooks/livepeer/useLivepeerViewMetrics", () => ({
  useLivepeerViewMetrics: vi.fn(),
}));

vi.mock("@/lib/hooks/livepeer/useLivepeerRealtimeMetrics", () => ({
  useLivepeerRealtimeMetrics: vi.fn(),
}));

import { useLivepeerViewMetrics } from "@/lib/hooks/livepeer/useLivepeerViewMetrics";
import { useLivepeerRealtimeMetrics } from "@/lib/hooks/livepeer/useLivepeerRealtimeMetrics";
import { ViewsComponent } from "@/components/Player/ViewsComponent";
import { RealtimeViewsComponent } from "@/components/Player/RealtimeViewsComponent";
import VideoViewMetrics from "@/components/Videos/VideoViewMetrics";

describe("restored view count UI", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("ViewsComponent renders total views from Livepeer metrics", () => {
    vi.mocked(useLivepeerViewMetrics).mockReturnValue({
      viewMetrics: {
        playbackId: "p1",
        viewCount: 120,
        playtimeMins: 3,
        legacyViewCount: 5,
        totalViews: 125,
      },
      totalViews: 125,
      loading: false,
      error: null,
    });

    const html = renderToStaticMarkup(
      React.createElement(ViewsComponent, { playbackId: "p1" }),
    );
    expect(html).toContain("125");
    expect(html.toLowerCase()).toContain("views");
    expect(useLivepeerViewMetrics).toHaveBeenCalledWith("p1");
  });

  it("ViewsComponent shows fallbackViews when Livepeer metrics are missing", () => {
    vi.mocked(useLivepeerViewMetrics).mockReturnValue({
      viewMetrics: null,
      totalViews: 0,
      loading: false,
      error: null,
    });

    const html = renderToStaticMarkup(
      React.createElement(ViewsComponent, {
        playbackId: "p1",
        fallbackViews: 42,
      }),
    );
    expect(html).toContain("42");
    expect(html.toLowerCase()).toContain("views");
  });

  it("ViewsComponent shows fallbackViews on metrics error", () => {
    vi.mocked(useLivepeerViewMetrics).mockReturnValue({
      viewMetrics: null,
      totalViews: 0,
      loading: false,
      error: "upstream down",
    });

    const html = renderToStaticMarkup(
      React.createElement(ViewsComponent, {
        playbackId: "p1",
        fallbackViews: 17,
      }),
    );
    expect(html).toContain("17");
    expect(html.toLowerCase()).toContain("views");
  });

  it("ViewsComponent hides when metrics and fallback are both empty", () => {
    vi.mocked(useLivepeerViewMetrics).mockReturnValue({
      viewMetrics: null,
      totalViews: 0,
      loading: false,
      error: null,
    });

    const html = renderToStaticMarkup(
      React.createElement(ViewsComponent, { playbackId: "p1" }),
    );
    expect(html).toBe("");
  });

  it("VideoViewMetrics renders total views label", () => {
    vi.mocked(useLivepeerViewMetrics).mockReturnValue({
      viewMetrics: {
        playbackId: "p2",
        viewCount: 42,
        playtimeMins: 1,
        legacyViewCount: 0,
        totalViews: 42,
      },
      totalViews: 42,
      loading: false,
      error: null,
    });

    const html = renderToStaticMarkup(
      React.createElement(VideoViewMetrics, { playbackId: "p2" }),
    );
    expect(html).toContain("42");
    expect(html.toLowerCase()).toContain("views");
  });

  it("VideoViewMetrics uses fallbackViews when Livepeer returns 0", () => {
    vi.mocked(useLivepeerViewMetrics).mockReturnValue({
      viewMetrics: {
        playbackId: "p2",
        viewCount: 0,
        playtimeMins: 0,
        legacyViewCount: 0,
        totalViews: 0,
      },
      totalViews: 0,
      loading: false,
      error: null,
    });

    const html = renderToStaticMarkup(
      React.createElement(VideoViewMetrics, {
        playbackId: "p2",
        fallbackViews: 99,
      }),
    );
    expect(html).toContain("99");
    expect(html.toLowerCase()).toContain("views");
  });

  it("VideoViewMetrics hides when both Livepeer and fallback are 0", () => {
    vi.mocked(useLivepeerViewMetrics).mockReturnValue({
      viewMetrics: {
        playbackId: "p2",
        viewCount: 0,
        playtimeMins: 0,
        legacyViewCount: 0,
        totalViews: 0,
      },
      totalViews: 0,
      loading: false,
      error: null,
    });

    const html = renderToStaticMarkup(
      React.createElement(VideoViewMetrics, { playbackId: "p2" }),
    );
    expect(html).toBe("");
  });

  it("ViewsComponent hides when Livepeer metrics exist but total is 0", () => {
    vi.mocked(useLivepeerViewMetrics).mockReturnValue({
      viewMetrics: {
        playbackId: "p1",
        viewCount: 0,
        playtimeMins: 3,
        legacyViewCount: 0,
        totalViews: 0,
      },
      totalViews: 0,
      loading: false,
      error: null,
    });

    const html = renderToStaticMarkup(
      React.createElement(ViewsComponent, { playbackId: "p1" }),
    );
    expect(html).toBe("");
  });

  it("RealtimeViewsComponent renders concurrent watching count", () => {
    vi.mocked(useLivepeerRealtimeMetrics).mockReturnValue({
      realtimeMetrics: { playbackId: "live-1", viewerCount: 17 },
      viewerCount: 17,
      loading: false,
      error: null,
    });

    const html = renderToStaticMarkup(
      React.createElement(RealtimeViewsComponent, { playbackId: "live-1" }),
    );
    expect(html).toContain("17");
    expect(html.toLowerCase()).toContain("watching");
    expect(useLivepeerRealtimeMetrics).toHaveBeenCalledWith("live-1");
  });

  it("RealtimeViewsComponent fails quietly on metrics error", () => {
    vi.mocked(useLivepeerRealtimeMetrics).mockReturnValue({
      realtimeMetrics: null,
      viewerCount: 0,
      loading: false,
      error: "Failed to fetch real-time metrics",
    });

    const html = renderToStaticMarkup(
      React.createElement(RealtimeViewsComponent, { playbackId: "live-1" }),
    );
    expect(html).toBe("");
  });
});
