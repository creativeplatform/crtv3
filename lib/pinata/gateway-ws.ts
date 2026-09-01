/**
 * OpenClaw gateway chat over WebSocket (Pinata CLI uses the same transport).
 * HTTP POST {baseUrl}/chat is not exposed on Pinata agents; chat is WS-only.
 */

import crypto from "node:crypto";
import {
  buildDeviceAuthPayloadV3,
  resolveDeviceIdentity,
  signDevicePayload,
  type PinataDeviceIdentity,
} from "@/lib/pinata/device-identity";

export const GATEWAY_CLIENT_ID = "gateway-client";
export const GATEWAY_CLIENT_MODE = "backend";
export const GATEWAY_OPERATOR_SCOPES = [
  "operator.read",
  "operator.write",
] as const;

const PROTOCOL_VERSION = 3;
const DEFAULT_SESSION = "agent:main:song-cup";

type GatewayFrame = {
  type?: string;
  id?: string;
  event?: string;
  ok?: boolean;
  error?: {
    code?: string;
    message?: string;
    details?: Record<string, unknown>;
  };
  payload?: Record<string, unknown>;
};

export type GatewayChatOptions = {
  /** e.g. wss://{agentId}.agents.pinata.cloud/chat */
  wsUrl: string;
  gatewayToken: string;
  message: string;
  session?: string;
  devicePrivateKeyPem?: string | null;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type GatewayChatResult = {
  reply: string;
  session?: string;
};

function buildWsUrl(baseUrl: string, gatewayToken: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  const wsBase = trimmed.replace(/^https:/i, "wss:").replace(/^http:/i, "ws:");
  const url = new URL(`${wsBase}/chat`);
  url.searchParams.set("token", gatewayToken);
  return url.toString();
}

export function resolveGatewayChatWsUrl(
  baseUrl: string,
  gatewayToken: string,
): string {
  return buildWsUrl(baseUrl, gatewayToken);
}

function parsePairingRequestId(error: GatewayFrame["error"]): string | null {
  if (!error) return null;
  const details = error.details;
  const fromDetails =
    typeof details?.requestId === "string" ? details.requestId : null;
  if (fromDetails) return fromDetails;
  const msg = error.message ?? "";
  const match = msg.match(/requestId[=:\s]+([a-zA-Z0-9-]+)/i);
  return match?.[1] ?? null;
}

function resolveSessionFromChatPayload(
  payload: Record<string, unknown>,
  fallback: string,
): string {
  for (const key of ["session", "sessionKey", "session_key"] as const) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return fallback;
}

function isChatMessageComplete(payload: Record<string, unknown>): boolean {
  return payload.done === true || payload.finished === true;
}

function isPairingRequired(error: GatewayFrame["error"]): boolean {
  if (!error) return false;
  const code = (error.code ?? "").toUpperCase();
  const msg = (error.message ?? "").toLowerCase();
  return (
    code.includes("PAIR") ||
    msg.includes("pairing required") ||
    msg.includes("pair required")
  );
}

async function connectAndChat(options: {
  wsUrl: string;
  gatewayToken: string;
  message: string;
  session: string;
  deviceIdentity: PinataDeviceIdentity;
  signal?: AbortSignal;
  timeoutMs: number;
}): Promise<GatewayChatResult> {
  const {
    wsUrl,
    gatewayToken,
    message,
    session,
    deviceIdentity,
    signal,
    timeoutMs,
  } = options;

  return new Promise((resolve, reject) => {
    if (typeof WebSocket === "undefined") {
      reject(
        new Error(
          "WebSocket is not defined in this environment. Upgrade to Node.js 22+ or polyfill globalThis.WebSocket.",
        ),
      );
      return;
    }

    const ws = new WebSocket(wsUrl);

    let settled = false;
    const parts: string[] = [];
    let reqId = 1;
    let connectReqId: string | null = null;
    let chatReqId: string | null = null;

    const finish = (err?: Error, result?: GatewayChatResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      try {
        ws.close();
      } catch {
        // ignore
      }
      if (err) reject(err);
      else resolve(result ?? { reply: parts.join("") || "(no reply)", session });
    };

    const onAbort = () => {
      finish(new Error("Pinata agent chat timed out or was aborted"));
    };

    const timer = setTimeout(() => {
      finish(new Error(`Pinata agent chat timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    signal?.addEventListener("abort", onAbort);

    ws.addEventListener("error", () => {
      finish(new Error("Pinata gateway WebSocket connection failed"));
    });

    ws.addEventListener("close", (event) => {
      if (settled) return;
      finish(
        new Error(
          `Pinata gateway WebSocket connection closed (code: ${event.code}${event.reason ? `: ${event.reason}` : ""})`,
        ),
      );
    });

    ws.addEventListener("message", (event) => {
      let frame: GatewayFrame;
      try {
        const parsed: unknown = JSON.parse(String(event.data));
        if (!parsed || typeof parsed !== "object") return;
        frame = parsed as GatewayFrame;
      } catch {
        return;
      }

      if (frame.event === "connect.challenge") {
        const nonce =
          typeof frame.payload?.nonce === "string" ? frame.payload.nonce : "";
        if (!nonce) {
          finish(new Error("Pinata gateway connect challenge missing nonce"));
          return;
        }

        const signedAtMs = Date.now();
        const scopes = [...GATEWAY_OPERATOR_SCOPES];
        const authPayload = buildDeviceAuthPayloadV3({
          deviceId: deviceIdentity.deviceId,
          clientId: GATEWAY_CLIENT_ID,
          clientMode: GATEWAY_CLIENT_MODE,
          role: "operator",
          scopes,
          signedAtMs,
          token: gatewayToken,
          nonce,
          platform: process.platform,
          deviceFamily: null,
        });

        connectReqId = String(reqId++);
        ws.send(
          JSON.stringify({
            type: "req",
            id: connectReqId,
            method: "connect",
            params: {
              minProtocol: PROTOCOL_VERSION,
              maxProtocol: PROTOCOL_VERSION,
              client: {
                id: GATEWAY_CLIENT_ID,
                version: "1.0.0",
                platform: process.platform,
                mode: GATEWAY_CLIENT_MODE,
              },
              role: "operator",
              scopes,
              caps: [],
              commands: [],
              permissions: {},
              auth: { token: gatewayToken },
              locale: "en-US",
              userAgent: "crtv3-song-cup/1.0.0",
              device: {
                id: deviceIdentity.deviceId,
                publicKey: deviceIdentity.publicKeyRawBase64Url,
                signature: signDevicePayload(
                  deviceIdentity.privateKeyPem,
                  authPayload,
                ),
                signedAt: signedAtMs,
                nonce,
              },
            },
          }),
        );
        return;
      }

      if (frame.type === "res" && connectReqId && frame.id === connectReqId) {
        if (!frame.ok) {
          const err = new Error(
            frame.error?.message ??
              `Pinata gateway connect failed (${frame.error?.code ?? "unknown"})`,
          );
          (err as Error & { pairingRequired?: boolean; requestId?: string }).pairingRequired =
            isPairingRequired(frame.error);
          (err as Error & { pairingRequired?: boolean; requestId?: string }).requestId =
            parsePairingRequestId(frame.error) ?? undefined;
          finish(err);
          return;
        }

        chatReqId = String(reqId++);
        ws.send(
          JSON.stringify({
            type: "req",
            id: chatReqId,
            method: "chat.send",
            params: {
              sessionKey: session,
              message,
              idempotencyKey: crypto.randomUUID(),
            },
          }),
        );
        return;
      }

      if (frame.type === "res" && chatReqId && frame.id === chatReqId) {
        if (!frame.ok) {
          finish(
            new Error(
              frame.error?.message ??
                `Pinata chat.send failed (${frame.error?.code ?? "unknown"})`,
            ),
          );
          return;
        }
        return;
      }

      if (frame.type === "event" && frame.event === "chat") {
        const payload = frame.payload ?? {};
        const type = payload.type;
        if (type === "content_delta") {
          const delta = payload.delta as { text?: string } | undefined;
          if (typeof delta?.text === "string") parts.push(delta.text);
        }
        if (type === "message" && isChatMessageComplete(payload)) {
          finish(undefined, {
            reply: parts.join("") || "(no reply)",
            session: resolveSessionFromChatPayload(payload, session),
          });
        }
      }
    });
  });
}

export async function gatewayWebSocketChat(
  options: GatewayChatOptions,
): Promise<GatewayChatResult> {
  const wsUrl = options.wsUrl.includes("://")
    ? options.wsUrl
    : resolveGatewayChatWsUrl(options.wsUrl, options.gatewayToken);
  const session = options.session?.trim() || DEFAULT_SESSION;
  const timeoutMs = options.timeoutMs ?? 60_000;
  const deviceIdentity = resolveDeviceIdentity(options.devicePrivateKeyPem);

  try {
    return await connectAndChat({
      wsUrl,
      gatewayToken: options.gatewayToken,
      message: options.message,
      session,
      deviceIdentity,
      signal: options.signal,
      timeoutMs,
    });
  } catch (err) {
    if (
      err instanceof Error &&
      (err as Error & { pairingRequired?: boolean }).pairingRequired
    ) {
      throw new Error(
        `${err.message} Approve the pending device in Pinata (Danger → Devices) or set PINATA_JWT so the server can auto-approve pairing.`,
      );
    }
    throw err;
  }
}
