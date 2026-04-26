import { NextRequest, NextResponse } from "next/server";
import { supabaseService } from "@/lib/sdk/supabase/service";
import { createClient } from "@/lib/sdk/supabase/server";
import { serverLogger } from "@/lib/utils/logger";
import { rateLimiters } from "@/lib/middleware/rateLimit";
import { requireWalletAuthFor, WalletAuthError } from "@/lib/auth/require-wallet";

export async function POST(request: NextRequest) {
  const rl = await rateLimiters.standard(request);
  if (rl) return rl;

  let body: { ownerAddress?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }
  const ownerAddress = body.ownerAddress?.toLowerCase();
  if (!ownerAddress) {
    return NextResponse.json(
      { success: false, error: "ownerAddress is required" },
      { status: 400 }
    );
  }

  // Verify the caller actually controls ownerAddress.
  try {
    await requireWalletAuthFor(request, ownerAddress);
  } catch (authErr) {
    if (authErr instanceof WalletAuthError) {
      return NextResponse.json(
        { success: false, error: authErr.message },
        { status: authErr.status }
      );
    }
    throw authErr;
  }

  const supabase = supabaseService ?? (await createClient());
  const { error } = await supabase
    .from("creator_profiles")
    .update({
      twin_pinata_agent_id: null,
      twin_pinata_gateway_token: null,
      twin_pinata_base_url: null,
      twin_pinata_ws_url: null,
      twin_pinata_snapshot_cid: null,
      twin_pinata_agent_name: null,
      twin_pinata_connected_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("owner_address", ownerAddress);

  if (error) {
    serverLogger.error("twin/disconnect: update failed:", error);
    return NextResponse.json(
      { success: false, error: "Failed to disconnect" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
