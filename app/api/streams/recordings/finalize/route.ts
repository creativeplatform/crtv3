import { NextRequest, NextResponse } from "next/server";
import { requireHumanOrVerifiedBot } from "@/lib/middleware/botIdGuard";
import { rateLimiters } from "@/lib/middleware/rateLimit";
import { finalizeStreamRecordings } from "@/services/livestream-recordings";
import { serverLogger } from "@/lib/utils/logger";

export async function POST(request: NextRequest) {
  const botCheck = await requireHumanOrVerifiedBot("stream-recordings-finalize");
  if (!botCheck.allowed) {
    return botCheck.response;
  }

  const rl = await rateLimiters.standard(request);
  if (rl) return rl;

  let body: { streamId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { streamId } = body ?? {};
  if (!streamId?.trim()) {
    return NextResponse.json(
      { error: "streamId is required" },
      { status: 400 }
    );
  }

  try {
    const result = await finalizeStreamRecordings(streamId.trim());
    return NextResponse.json(result);
  } catch (e: unknown) {
    serverLogger.error("Failed to finalize stream recordings:", e);
    const message = e instanceof Error ? e.message : "Failed to finalize recordings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
