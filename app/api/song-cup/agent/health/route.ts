import { NextResponse } from "next/server";
import {
  getAgentDetailsResponse,
  PinataApiError,
  resolveAgentRuntimeStatus,
  resolvePinataAgentGatewayWsUrl,
} from "@/lib/pinata/api";
import { getSongCupAgentConfig } from "@/lib/songchain/song-cup/agent-config";

export async function GET() {
  const config = getSongCupAgentConfig();
  const {
    enabled,
    agentId,
    baseUrl,
    gatewayToken,
    managementJwt,
    devicePrivateKeyPem,
  } = config;

  if (!enabled || !baseUrl || !gatewayToken) {
    return NextResponse.json({
      success: true,
      configured: false,
      chatTransport: "websocket",
      hint: "Set SONG_CUP_PINATA_AGENT_ID and SONG_CUP_PINATA_GATEWAY_TOKEN.",
    });
  }

  let processStatus: string | null = null;
  let managementOk = false;
  let managementError: string | null = null;

  if (managementJwt && agentId) {
    try {
      const details = await getAgentDetailsResponse(managementJwt, agentId);
      processStatus = resolveAgentRuntimeStatus(details);
      managementOk = true;
    } catch (err) {
      managementError =
        err instanceof PinataApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "management API error";
    }
  }

  return NextResponse.json({
    success: true,
    configured: true,
    agentId,
    baseUrl,
    chatTransport: "websocket",
    chatPath: agentId ? resolvePinataAgentGatewayWsUrl(agentId) : null,
    hasManagementJwt: Boolean(managementJwt),
    hasDeviceKey: Boolean(devicePrivateKeyPem),
    processStatus,
    managementOk,
    managementError,
  });
}
