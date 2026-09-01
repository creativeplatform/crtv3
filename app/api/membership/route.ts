import { NextRequest, NextResponse } from "next/server";
import { unlockService } from "@/lib/sdk/unlock/services";
import { rateLimiters } from "@/lib/middleware/rateLimit";

// POST /api/membership — read-only Unlock lookup; excluded from BotID (see instrumentation-client.ts).
export async function POST(req: NextRequest) {
  const rl = await rateLimiters.standard(req);
  if (rl) return rl;

  let address: string | undefined;

  try {
    const body = await req.json();
    address = body.address;
  } catch (error) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!address) {
    return NextResponse.json({ error: "Missing address" }, { status: 400 });
  }

  try {
    // This runs server-side, so no CORS issues!
    const memberships = await unlockService.getAllMemberships(address);
    return NextResponse.json({ memberships }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
