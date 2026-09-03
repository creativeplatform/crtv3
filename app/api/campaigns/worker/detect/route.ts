import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { detectProductInVideo } from "@/lib/shoppable/detect-product";
import {
  replaceShoppableAnnotations,
  updateShoppableVideoDetection,
} from "@/lib/sdk/supabase/shoppable-campaigns";
import { serverLogger } from "@/lib/utils/logger";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  campaignId: z.string().uuid(),
  videoId: z.string().uuid(),
  videoDownloadUrl: z.string().url(),
  productImageUrl: z.string().url(),
  productKitId: z.string().uuid(),
});

async function handler(request: Request) {
  const json = await request.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { videoId, videoDownloadUrl, productImageUrl, productKitId } =
    parsed.data;

  try {
    await updateShoppableVideoDetection(videoId, {
      detectionStatus: "processing",
    });

    const annotations = await detectProductInVideo(
      videoDownloadUrl,
      productImageUrl
    );

    await replaceShoppableAnnotations({
      videoId,
      productKitId,
      annotations,
    });

    await updateShoppableVideoDetection(videoId, {
      detectionStatus: "ready",
      detectionError: null,
    });

    return NextResponse.json({
      success: true,
      count: annotations.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Worker failed";
    serverLogger.error("[campaigns/worker/detect] failed:", error);

    try {
      await updateShoppableVideoDetection(videoId, {
        detectionStatus: "failed",
        detectionError: message,
      });
    } catch (dbErr) {
      serverLogger.error("[campaigns/worker/detect] status update failed:", dbErr);
    }

    // 500 triggers QStash exponential backoff retries.
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const POST = verifySignatureAppRouter(handler);
