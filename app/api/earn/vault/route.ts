import { NextResponse } from "next/server";
import { isEarnConfigured } from "@/lib/sdk/privy/config";
import { fetchVaultDetails } from "@/lib/sdk/privy/earn";

export const revalidate = 60;

export async function GET() {
  if (!isEarnConfigured()) {
    return NextResponse.json(
      { error: "Earn is not configured" },
      { status: 503 },
    );
  }

  try {
    const vault = await fetchVaultDetails();
    return NextResponse.json({ vault });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch vault";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
