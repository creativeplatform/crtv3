import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAddress } from "viem";
import { rateLimiters } from "@/lib/middleware/rateLimit";
import { requireWalletAuthFor, WalletAuthError } from "@/lib/auth/require-wallet";
import { createStreamRecord, resolveStreamForCreator } from "@/services/streams";
import {
  hasLivepeerPrivateApiKey,
  livepeerStudioApiBaseUrl,
} from "@/lib/sdk/livepeer/studioAuth";
import { serverLogger } from "@/lib/utils/logger";

const streamProfileSchema = z.object({
  name: z.string(),
  width: z.number(),
  height: z.number(),
  bitrate: z.number(),
  fps: z.number(),
  fpsDen: z.number(),
  quality: z.number(),
  gop: z.string(),
  profile: z.string(),
});

const bodySchema = z.object({
  creatorAddress: z.string().refine(isAddress, "Invalid creatorAddress"),
  legacyCreatorAddress: z.string().refine(isAddress, "Invalid legacyCreatorAddress").optional(),
  name: z.string().min(1),
  profiles: z.array(streamProfileSchema).min(1),
  record: z.boolean(),
  playbackPolicy: z.record(z.unknown()),
});

export async function POST(req: NextRequest) {
  const rl = await rateLimiters.standard(req);
  if (rl) return rl;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "INVALID_REQUEST" },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors, code: "INVALID_REQUEST" },
      { status: 400 },
    );
  }

  const { creatorAddress, legacyCreatorAddress, name, profiles, record, playbackPolicy } =
    parsed.data;
  const normalizedCreator = creatorAddress.toLowerCase();

  try {
    await requireWalletAuthFor(req, normalizedCreator);
  } catch (authErr) {
    if (authErr instanceof WalletAuthError) {
      return NextResponse.json({ error: authErr.message }, { status: authErr.status });
    }
    throw authErr;
  }

  const existing = await resolveStreamForCreator(
    normalizedCreator,
    legacyCreatorAddress?.toLowerCase(),
  );
  if (existing) {
    return NextResponse.json(
      {
        error: "Stream already exists for this creator",
        code: "STREAM_EXISTS",
        streamId: existing.stream_id,
        playbackId: existing.playback_id,
        streamKey: existing.stream_key,
      },
      { status: 409 },
    );
  }

  if (!hasLivepeerPrivateApiKey()) {
    serverLogger.error("[livepeer-proxy] LIVEPEER_FULL_API_KEY is not configured");
    return NextResponse.json(
      {
        error: "Missing Livepeer API key",
        code: "MISSING_API_KEY",
      },
      { status: 500 },
    );
  }

  try {
    const baseUrl = livepeerStudioApiBaseUrl();
    const livepeerRes = await fetch(`${baseUrl}/api/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.LIVEPEER_FULL_API_KEY}`,
      },
      body: JSON.stringify({
        name,
        profiles,
        record,
        playbackPolicy,
        creatorId: {
          type: "unverified",
          value: normalizedCreator,
        },
      }),
    });

    let data: Record<string, unknown> = {};
    try {
      data = (await livepeerRes.json()) as Record<string, unknown>;
    } catch {
      serverLogger.error("[livepeer-proxy] Livepeer returned non-JSON response", {
        status: livepeerRes.status,
      });
      return NextResponse.json(
        {
          error: "Invalid response from streaming provider",
          code: "LIVEPEER_ERROR",
        },
        { status: 502 },
      );
    }

    if (!livepeerRes.ok) {
      const message =
        typeof data.error === "string"
          ? data.error
          : typeof data.message === "string"
            ? data.message
            : "Failed to create stream";

      serverLogger.error("[livepeer-proxy] Livepeer stream create failed", {
        status: livepeerRes.status,
        message,
      });

      return NextResponse.json(
        {
          error: message,
          code: "LIVEPEER_ERROR",
          details: data,
        },
        { status: livepeerRes.status },
      );
    }

    const streamKeyValue =
      (data.streamKey as string | undefined) ||
      ((data.stream as Record<string, unknown> | undefined)?.streamKey as
        | string
        | undefined);
    const streamIdValue =
      (data.id as string | undefined) ||
      ((data.stream as Record<string, unknown> | undefined)?.id as
        | string
        | undefined);
    const playbackIdValue =
      (data.playbackId as string | undefined) ||
      ((data.stream as Record<string, unknown> | undefined)?.playbackId as
        | string
        | undefined);

    if (!streamKeyValue || !streamIdValue || !playbackIdValue) {
      serverLogger.error("[livepeer-proxy] Livepeer create stream missing fields:", data);
      return NextResponse.json(
        {
          error: "Livepeer response missing stream identifiers",
          code: "INVALID_RESPONSE",
        },
        { status: 502 },
      );
    }

    await createStreamRecord({
      creator_id: normalizedCreator,
      stream_key: streamKeyValue,
      stream_id: streamIdValue,
      playback_id: playbackIdValue,
      name: name || `Channel-${normalizedCreator.slice(0, 6)}`,
      is_live: false,
      save_recording: record,
    });

    serverLogger.debug("[livepeer-proxy] stream created", {
      streamId: streamIdValue,
      playbackId: playbackIdValue,
    });

    return NextResponse.json({
      streamId: streamIdValue,
      playbackId: playbackIdValue,
      streamKey: streamKeyValue,
    });
  } catch (error) {
    serverLogger.error("[livepeer-proxy] Livepeer stream creation error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create stream",
        code: "LIVEPEER_ERROR",
      },
      { status: 500 },
    );
  }
}
