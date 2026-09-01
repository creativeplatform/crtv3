import { NextRequest, NextResponse } from "next/server";
import { requireHumanOrVerifiedBot } from "@/lib/middleware/botIdGuard";
import { rateLimiters } from "@/lib/middleware/rateLimit";
import { enableStreamRecording } from "@/lib/livepeer/studio-api";
import { serverLogger } from "@/lib/utils/logger";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ streamId: string }> }
) {
  const botCheck = await requireHumanOrVerifiedBot("stream-recording");
  if (!botCheck.allowed) {
    return botCheck.response;
  }

  const rl = await rateLimiters.standard(request);
  if (rl) return rl;

  const { streamId } = await params;
  if (!streamId?.trim()) {
    return NextResponse.json({ error: "streamId is required" }, { status: 400 });
  }

  let body: { record?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    // no body is fine
  }

  // Default to true unless explicitly false.
  const record = body.record !== false;

  try {
    await enableStreamRecording(streamId.trim(), record);
    return NextResponse.json({ ok: true, record });
  } catch (e: unknown) {
    serverLogger.error("Failed to set stream recording state:", e);
    const message =
      e instanceof Error ? e.message : "Failed to set stream recording state";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
