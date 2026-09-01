/**
 * Pinata agent chat — OpenClaw gateway over WebSocket (same path as `pinata agents chat`).
 * Bare HTTP POST /chat is not available on Pinata agent subdomains.
 */

import {
  gatewayWebSocketChat,
  resolveGatewayChatWsUrl,
  type GatewayChatResult,
} from "@/lib/pinata/gateway-ws";

export function extractReplyFromJsonl(body: string): string {
  const lines = body.split("\n");
  const parts: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    try {
      const evt = JSON.parse(line) as {
        type?: string;
        delta?: { text?: string };
      };
      if (evt?.type === "content_delta" && typeof evt.delta?.text === "string") {
        parts.push(evt.delta.text);
      }
    } catch {
      // ignore non-JSON lines
    }
  }
  return parts.join("");
}

export type PinataChatResult = GatewayChatResult;

export async function forwardPinataAgentChat(options: {
  baseUrl: string;
  gatewayToken: string;
  message: string;
  session?: string;
  devicePrivateKeyPem?: string | null;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<PinataChatResult> {
  const {
    baseUrl,
    gatewayToken,
    message,
    session,
    devicePrivateKeyPem,
    signal,
    timeoutMs,
  } = options;

  const wsUrl = resolveGatewayChatWsUrl(baseUrl, gatewayToken);

  try {
    return await gatewayWebSocketChat({
      wsUrl,
      gatewayToken,
      message,
      session,
      devicePrivateKeyPem,
      signal,
      timeoutMs: timeoutMs ?? 60_000,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes("missing scope")) {
      throw new Error(
        `${msg} The gateway token connected but lacks write scope — approve the server device in Pinata (Danger → Devices) or refresh SONG_CUP_PINATA_GATEWAY_TOKEN.`,
      );
    }
    if (msg.toLowerCase().includes("pairing")) {
      throw new Error(msg);
    }
    throw err instanceof Error ? err : new Error(msg);
  }
}
