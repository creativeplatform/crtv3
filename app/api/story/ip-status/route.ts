import { NextRequest, NextResponse } from "next/server";

const STORY_API_BASE = process.env.STORY_API_BASE_URL ?? "https://api.storyapis.com/api/v4";

/** Infringement status from Story List IP Assets API (per provider). */
export interface InfringementStatusItem {
  status: string;
  isInfringing: boolean;
  providerName: string;
  providerURL: string;
  infringementDetails: string;
  customData?: string;
  responseTime?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StoryIPStatusResponse {
  ipId: string;
  infringementStatus: InfringementStatusItem[] | null;
  error?: string;
}

/**
 * GET /api/story/ip-status?ipId=0x...
 * Fetches IP asset from Story Protocol API and returns infringement status.
 * Requires STORY_API_KEY env for Story API (X-Api-Key). If not set, returns 503.
 */
export async function GET(request: NextRequest) {
  const ipId = request.nextUrl.searchParams.get("ipId");
  if (!ipId || typeof ipId !== "string" || !ipId.trim()) {
    return NextResponse.json(
      { error: "Missing or invalid ipId query parameter" },
      { status: 400 }
    );
  }

  const apiKey = process.env.STORY_API_KEY ?? process.env.NEXT_PUBLIC_STORY_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Story API key not configured" },
      { status: 503 }
    );
  }

  try {
    const res = await fetch(`${STORY_API_BASE}/assets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify({
        where: { ipIds: [ipId.trim()] },
        pagination: { limit: 1, offset: 0 },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: `Story API error: ${res.status}`, details: errText },
        { status: 502 }
      );
    }

    const json = await res.json();
    const asset = Array.isArray(json?.data) ? json.data[0] : null;

    if (!asset) {
      return NextResponse.json<StoryIPStatusResponse>({
        ipId: ipId.trim(),
        infringementStatus: null,
      });
    }

    return NextResponse.json<StoryIPStatusResponse>({
      ipId: asset.ipId ?? ipId.trim(),
      infringementStatus: asset.infringementStatus ?? null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to fetch IP status", details: String(e) },
      { status: 500 }
    );
  }
}
