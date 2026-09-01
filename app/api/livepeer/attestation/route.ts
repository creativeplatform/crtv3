import { NextRequest, NextResponse } from "next/server";
import { checkBotIdDeep } from "@/lib/middleware/botIdGuard";

const LIVEPEER_ATTESTATION_BASE = "https://livepeer.studio/api/experiment/-/attestation";

/**
 * POST: Forward signed attestation payload to Livepeer.
 * Body: { primaryType, domain, message, signature } (message.timestamp as number for JSON).
 */
export async function POST(request: NextRequest) {
  const verification = await checkBotIdDeep();
  if (verification.isBot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  try {
    const body = await request.json();
    const { primaryType, domain, message, signature } = body;
    if (!domain || !message || !signature) {
      return NextResponse.json(
        { error: "Missing required fields: domain, message, signature" },
        { status: 400 }
      );
    }
    const payload = {
      primaryType: primaryType ?? "VideoAttestation",
      domain,
      message,
      signature,
    };
    const res = await fetch(LIVEPEER_ATTESTATION_BASE, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("[livepeer attestation POST]", error);
    return NextResponse.json(
      { error: "Failed to submit attestation" },
      { status: 500 }
    );
  }
}

/**
 * GET: Proxy to Livepeer to get attestation by id or list by creator.
 * Query: id=<attestationId> OR creator=<0x address>
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const creator = searchParams.get("creator");
    if (id) {
      const res = await fetch(`${LIVEPEER_ATTESTATION_BASE}/${id}`, {
        headers: { Accept: "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      return NextResponse.json(data, { status: res.status });
    }
    if (creator) {
      const res = await fetch(
        `${LIVEPEER_ATTESTATION_BASE}?creator=${encodeURIComponent(creator)}`,
        { headers: { Accept: "application/json" } }
      );
      const data = await res.json().catch(() => ({}));
      return NextResponse.json(data, { status: res.status });
    }
    return NextResponse.json(
      { error: "Provide query parameter: id or creator" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[livepeer attestation GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch attestation(s)" },
      { status: 500 }
    );
  }
}
