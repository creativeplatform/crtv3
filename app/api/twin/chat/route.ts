import { NextRequest, NextResponse } from "next/server";
import { supabaseService } from "@/lib/sdk/supabase/service";
import { createClient } from "@/lib/sdk/supabase/server";
import { serverLogger } from "@/lib/utils/logger";
import { rateLimiters } from "@/lib/middleware/rateLimit";

interface TwinChatBody {
  creatorAddress?: string;
  message?: string;
  streamId?: string;
  /** Optional session key for multi-turn conversations. */
  session?: string;
}

interface TwinRouting {
  baseUrl: string;
  gatewayToken: string;
  // Legacy fallback for profiles still on the old free-form endpoint field.
  legacyEndpoint?: string | null;
}

async function loadRouting(creatorAddress: string): Promise<TwinRouting | null> {
  const supabase = supabaseService ?? (await createClient());
  const { data, error } = await supabase
    .from("creator_profiles")
    .select(
      "twin_enabled, twin_pinata_base_url, twin_pinata_gateway_token, twin_chat_endpoint"
    )
    .eq("owner_address", creatorAddress.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  if (!data?.twin_enabled) return null;
  if (data.twin_pinata_base_url && data.twin_pinata_gateway_token) {
    return {
      baseUrl: data.twin_pinata_base_url.replace(/\/+$/, ""),
      gatewayToken: data.twin_pinata_gateway_token,
      legacyEndpoint: null,
    };
  }
  if (data.twin_chat_endpoint) {
    return {
      baseUrl: "",
      gatewayToken: "",
      legacyEndpoint: data.twin_chat_endpoint,
    };
  }
  return null;
}

/**
 * Walk a JSONL response and concatenate the text from every `content_delta`
 * event. Other event types (tool_use_start, thinking_delta, etc.) are
 * intentionally dropped — the viewer chat panel only renders the reply text.
 */
function extractReplyFromJsonl(body: string): string {
  const lines = body.split("\n");
  const parts: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    try {
      const evt = JSON.parse(line);
      if (evt && evt.type === "content_delta" && typeof evt.delta?.text === "string") {
        parts.push(evt.delta.text);
      }
    } catch {
      // Not JSON — ignore. Some servers send a heartbeat line or a stray comment.
    }
  }
  return parts.join("");
}

export async function POST(request: NextRequest) {
  const rl = await rateLimiters.standard(request);
  if (rl) return rl;

  let body: TwinChatBody;
  try {
    body = (await request.json()) as TwinChatBody;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { creatorAddress, message, streamId, session } = body;
  if (!creatorAddress || !message) {
    return NextResponse.json(
      { success: false, error: "creatorAddress and message are required" },
      { status: 400 }
    );
  }

  let routing: TwinRouting | null;
  try {
    routing = await loadRouting(creatorAddress);
  } catch (err) {
    serverLogger.error("Twin routing lookup failed:", err);
    return NextResponse.json(
      { success: false, error: "Failed to look up twin routing" },
      { status: 500 }
    );
  }

  if (!routing) {
    return NextResponse.json(
      {
        success: false,
        error: "This creator has not connected a twin yet.",
      },
      { status: 503 }
    );
  }

  const url = routing.legacyEndpoint
    ? routing.legacyEndpoint
    : `${routing.baseUrl}/chat`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (routing.gatewayToken) {
    headers.Authorization = `Bearer ${routing.gatewayToken}`;
  }

  // We deliberately do NOT forward a viewerAddress here. Headers are
  // spoofable by any client and the upstream agent has no way to verify the
  // claim — passing one through is a classic impersonation footgun. If the
  // agent ever needs viewer identity, it will require a signed proof and a
  // first-class field, not a soft hint.
  const requestBody = routing.legacyEndpoint
    ? {
        creatorAddress,
        streamId: streamId || null,
        message,
      }
    : {
        message,
        ...(session ? { session } : {}),
      };

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(30_000),
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      return NextResponse.json(
        {
          success: false,
          error: `Twin endpoint returned ${upstream.status}`,
          detail: text.slice(0, 500),
        },
        { status: 502 }
      );
    }

    const contentType = upstream.headers.get("content-type") || "";
    const raw = await upstream.text();

    // Pinata agent chat returns JSONL by default. Other content types fall
    // back to legacy JSON / plain-text shapes for the deprecated path.
    if (contentType.includes("ndjson") || contentType.includes("event-stream") || /\n\s*\{/.test(raw)) {
      const reply = extractReplyFromJsonl(raw);
      return NextResponse.json({ success: true, reply });
    }
    if (contentType.includes("application/json")) {
      try {
        const json = JSON.parse(raw);
        return NextResponse.json({
          success: true,
          ...json,
          reply: json.reply ?? json.message ?? json.content ?? "",
        });
      } catch {
        return NextResponse.json({ success: true, reply: raw });
      }
    }
    return NextResponse.json({ success: true, reply: raw });
  } catch (err) {
    serverLogger.error("Twin endpoint request failed:", err);
    const msg = err instanceof Error ? err.message : "Twin endpoint unreachable";
    return NextResponse.json({ success: false, error: msg }, { status: 503 });
  }
}
