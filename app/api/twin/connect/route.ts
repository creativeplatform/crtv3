import { NextRequest, NextResponse } from "next/server";
import { supabaseService } from "@/lib/sdk/supabase/service";
import { createClient } from "@/lib/sdk/supabase/server";
import { serverLogger } from "@/lib/utils/logger";
import { rateLimiters } from "@/lib/middleware/rateLimit";
import {
  findCreativeTwinTemplate,
  getAgentDetails,
  getGatewayToken,
  PinataApiError,
} from "@/lib/pinata/api";
import { requireWalletAuthFor, WalletAuthError } from "@/lib/auth/require-wallet";

interface ConnectBody {
  ownerAddress?: string;
  agentId?: string;
  pinataJwt?: string;
}

/**
 * Exchange a creator's Pinata JWT for the per-agent gateway token + base URLs
 * and persist them on creator_profiles. The JWT is in-memory only; only the
 * per-agent gateway token (column-locked to service-role reads) is stored.
 *
 * Also compares the agent's snapshotCid to the Creative AI Digital Twin
 * template's snapshotCid so we can render a "Verified Twin" badge.
 */
export async function POST(request: NextRequest) {
  const rl = await rateLimiters.standard(request);
  if (rl) return rl;

  let body: ConnectBody;
  try {
    body = (await request.json()) as ConnectBody;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { ownerAddress, agentId, pinataJwt } = body;
  if (!ownerAddress || !agentId || !pinataJwt) {
    return NextResponse.json(
      {
        success: false,
        error: "ownerAddress, agentId, and pinataJwt are required",
      },
      { status: 400 }
    );
  }

  // Verify the caller actually controls ownerAddress before persisting any
  // Pinata credentials against their profile.
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

  let agent, gateway, template;
  try {
    [agent, gateway, template] = await Promise.all([
      getAgentDetails(pinataJwt, agentId),
      getGatewayToken(pinataJwt, agentId),
      findCreativeTwinTemplate().catch(() => null),
    ]);
  } catch (err) {
    serverLogger.error("Pinata connect: API call failed:", err);
    if (err instanceof PinataApiError && err.status === 401) {
      return NextResponse.json(
        { success: false, error: "Pinata JWT was rejected. Double-check it and try again." },
        { status: 401 }
      );
    }
    if (err instanceof PinataApiError && err.status === 404) {
      return NextResponse.json(
        { success: false, error: "Agent not found under this Pinata account." },
        { status: 404 }
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to talk to Pinata",
      },
      { status: 502 }
    );
  }

  const verified =
    !!template?.snapshotCid &&
    !!agent.snapshotCid &&
    template.snapshotCid === agent.snapshotCid;

  const supabase = supabaseService ?? (await createClient());
  const payload = {
    owner_address: ownerAddress.toLowerCase(),
    twin_enabled: true,
    twin_pinata_agent_id: agentId,
    twin_pinata_gateway_token: gateway.token,
    twin_pinata_base_url: gateway.baseUrl,
    twin_pinata_ws_url: gateway.wsUrl,
    twin_pinata_snapshot_cid: agent.snapshotCid,
    twin_pinata_agent_name: agent.name,
    twin_pinata_connected_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("creator_profiles")
    .upsert(payload, { onConflict: "owner_address" });

  if (error) {
    serverLogger.error("Pinata connect: upsert failed:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save connection" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    verified,
    agentName: agent.name,
    agentStatus: agent.status,
    baseUrl: gateway.baseUrl,
    wsUrl: gateway.wsUrl,
  });
}
