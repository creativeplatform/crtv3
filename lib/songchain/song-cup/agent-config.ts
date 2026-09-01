import {
  PINATA_AGENT_HOST_SUFFIX,
  resolvePinataAgentPublicBaseUrl,
} from "@/lib/pinata/api";
import { resolveServerDevicePrivateKeyPem } from "@/lib/pinata/device-identity";

export type SongCupAgentConfig = {
  enabled: boolean;
  agentId: string | null;
  baseUrl: string | null;
  gatewayToken: string | null;
  /** Pinata management JWT — used to verify/restart the agent before chat. */
  managementJwt: string | null;
  /** Stable Ed25519 device key (PKCS#8 PEM) for OpenClaw gateway pairing. */
  devicePrivateKeyPem: string | null;
};

function resolveSongCupAgentBaseUrl(): string | null {
  const explicit = process.env.SONG_CUP_PINATA_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const agentId = process.env.SONG_CUP_PINATA_AGENT_ID?.trim();
  if (!agentId) return null;

  return resolvePinataAgentPublicBaseUrl(agentId);
}

/**
 * Server-only Pinata agent routing for the Song Cup page search bar.
 * Set `SONG_CUP_PINATA_AGENT_ID` (or `SONG_CUP_PINATA_BASE_URL`) plus
 * `SONG_CUP_PINATA_GATEWAY_TOKEN` from the agent Danger page or
 * `GET /v0/agents/{agentId}/gateway-token`.
 */
export function getSongCupAgentConfig(): SongCupAgentConfig {
  const agentId = process.env.SONG_CUP_PINATA_AGENT_ID?.trim() || null;
  const baseUrl = resolveSongCupAgentBaseUrl();
  const gatewayToken = process.env.SONG_CUP_PINATA_GATEWAY_TOKEN?.trim() || null;
  const managementJwt = process.env.PINATA_JWT?.trim() || null;
  const devicePrivateKeyPem = resolveServerDevicePrivateKeyPem(
    process.env.SONG_CUP_PINATA_DEVICE_PRIVATE_KEY_PEM,
  );
  return {
    enabled: Boolean(baseUrl && gatewayToken),
    agentId,
    baseUrl,
    gatewayToken,
    managementJwt,
    devicePrivateKeyPem,
  };
}

export { PINATA_AGENT_HOST_SUFFIX };
