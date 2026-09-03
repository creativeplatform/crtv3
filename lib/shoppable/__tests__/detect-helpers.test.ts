import { describe, expect, it } from "vitest";
import { DetectionResultArraySchema } from "@/lib/validations/campaign";
import { pickLowResMp4Url } from "@/lib/shoppable/trigger-detection";

describe("DetectionResultArraySchema", () => {
  it("accepts valid detection intervals", () => {
    const parsed = DetectionResultArraySchema.safeParse([
      { startTime: 1.2, endTime: 4.5, boundingBox: [10, 20, 300, 400] },
    ]);
    expect(parsed.success).toBe(true);
  });

  it("rejects incomplete bounding boxes", () => {
    const parsed = DetectionResultArraySchema.safeParse([
      { startTime: 1, endTime: 2, boundingBox: [1, 2, 3] },
    ]);
    expect(parsed.success).toBe(false);
  });
});

describe("pickLowResMp4Url", () => {
  it("prefers 360p over downloadUrl", () => {
    const url = pickLowResMp4Url({
      downloadUrl: "https://cdn.example/full.mp4",
      status: { phase: "ready" },
      files: [
        {
          type: "staticTranscodedMp4",
          resolution: "1080p",
          url: "https://cdn.example/1080.mp4",
        },
        {
          type: "staticTranscodedMp4",
          resolution: "360p",
          url: "https://cdn.example/360.mp4",
        },
      ],
    });
    expect(url).toBe("https://cdn.example/360.mp4");
  });

  it("falls back to downloadUrl", () => {
    const url = pickLowResMp4Url({
      downloadUrl: "https://cdn.example/full.mp4",
      files: [],
    });
    expect(url).toBe("https://cdn.example/full.mp4");
  });
});
