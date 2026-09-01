"use server";

import { NextRequest, NextResponse } from "next/server";
import { checkBotIdDeep } from "@/lib/middleware/botIdGuard";
import { rateLimiters } from "@/lib/middleware/rateLimit";

export async function GET(request: NextRequest) {
  const baseUrl = process.env.LIVEPEER_FULL_API_URL ?? "https://livepeer.studio";
  const livepeerUrl = `${baseUrl}/api/stream`;

  if (!process.env.LIVEPEER_FULL_API_KEY)
    return NextResponse.json(
      { error: "Missing Livepeer API key" },
      { status: 500 }
    );

  const response = await fetch(livepeerUrl, {
    headers: {
      Authorization: `Bearer ${process.env.LIVEPEER_FULL_API_KEY}`,
    },
    cache: "no-store",
  });

  if (!response.ok)
    return NextResponse.json(
      { error: "Failed to fetch streams", details: await response.text() },
      { status: response.status }
    );

  const json = await response.json();
  return NextResponse.json(json);
}

export async function POST(request: NextRequest) {
  const verification = await checkBotIdDeep();
  if (verification.isBot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  const rl = await rateLimiters.standard(request);
  if (rl) return rl;

  const baseUrl = process.env.LIVEPEER_FULL_API_URL ?? "https://livepeer.studio";
  const livepeerUpload = `${baseUrl}/api/asset/request-upload`;

  if (!process.env.LIVEPEER_FULL_API_KEY)
    return NextResponse.json(
      { error: "Missing Livepeer API key" },
      { status: 500 }
    );

  let body: string;
  try {
    body = await request.text();
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const response = await fetch(livepeerUpload, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.LIVEPEER_FULL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body,
  });

  if (!response.ok)
    return NextResponse.json(
      { error: "Failed to upload asset", details: await response.text() },
      { status: response.status }
    );

  const json = await response.json();
  return NextResponse.json(json);
}
