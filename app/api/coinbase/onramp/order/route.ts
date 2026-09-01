import { NextRequest, NextResponse } from "next/server";
import { generateJwt } from "@coinbase/cdp-sdk/auth";
import { serverLogger } from "@/lib/utils/logger";

/**
 * Coinbase CDP Headless Onramp v2 Order API
 * 
 * Creates an Apple Pay / Google Pay order and returns a paymentLink to embed in an iframe.
 * 
 * Security:
 * - CORS restricted to the configured NEXT_PUBLIC_APP_URL origin in production.
 * - Requires wallet-signature authentication (same pattern as /api/coinbase/session-token).
 * - Calls CDP with a JWT signed by COINBASE_CDP_API_KEY_ID + COINBASE_CDP_API_KEY_SECRET.
 * 
 * Required env vars:
 * - COINBASE_CDP_API_KEY_ID
 * - COINBASE_CDP_API_KEY_SECRET
 * - NEXT_PUBLIC_APP_URL (used for CORS and domain verification)
 * 
 * Docs: https://docs.cdp.coinbase.com/onramp/docs/headless-onramp
 */

interface OnrampOrderRequest {
  address: string;
  email: string;
  phoneNumber: string;
  fiatAmount: number;
  fiatCurrency: string;
  asset: string;
  network: string;
  paymentMethod?: "GUEST_CHECKOUT_APPLE_PAY" | "GUEST_CHECKOUT_GOOGLE_PAY";
  partnerUserRef?: string;
  message?: string;
  signature?: string;
}

const RATE_LIMIT_REQUESTS = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
interface RateLimitEntry { count: number; resetTime: number; }
const rateLimitStore = new Map<string, RateLimitEntry>();
let lastCleanupTime = Date.now();

function cleanupExpiredEntries(): void {
  const now = Date.now();
  const expired: string[] = [];
  for (const [ip, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) expired.push(ip);
  }
  expired.forEach((ip) => rateLimitStore.delete(ip));
  lastCleanupTime = now;
}

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  if (now - lastCleanupTime > 5 * 60 * 1000) cleanupExpiredEntries();
  const entry = rateLimitStore.get(ip);
  if (!entry || now > entry.resetTime) {
    const resetTime = now + RATE_LIMIT_WINDOW_MS;
    rateLimitStore.set(ip, { count: 1, resetTime });
    return { allowed: true, remaining: RATE_LIMIT_REQUESTS - 1, resetTime };
  }
  if (entry.count >= RATE_LIMIT_REQUESTS) {
    return { allowed: false, remaining: 0, resetTime: entry.resetTime };
  }
  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT_REQUESTS - entry.count, resetTime: entry.resetTime };
}

function parseAuthMessage(message: string): { address: string; timestamp: number } | null {
  const prefix = "Authorize Coinbase headless onramp order for address ";
  const suffix = " at ";
  if (!message.startsWith(prefix)) return null;
  const after = message.slice(prefix.length);
  const idx = after.lastIndexOf(suffix);
  if (idx === -1) return null;
  const address = after.slice(0, idx);
  const ts = after.slice(idx + suffix.length);
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return null;
  const timestamp = parseInt(ts, 10);
  if (Number.isNaN(timestamp) || timestamp <= 0) return null;
  return { address: address.toLowerCase(), timestamp };
}

function validateAuthMessage(message: string, expectedAddress: string, maxAgeSeconds = 5 * 60): string | null {
  const parsed = parseAuthMessage(message);
  if (!parsed) return "Invalid message format";
  if (parsed.address !== expectedAddress.toLowerCase()) return "Address mismatch";
  const now = Math.floor(Date.now() / 1000);
  const age = now - parsed.timestamp;
  if (age < 0) return "Timestamp in future";
  if (age > maxAgeSeconds) return "Message expired";
  return null;
}

async function generateCdpJwt(): Promise<string> {
  const apiKeyId = process.env.COINBASE_CDP_API_KEY_ID || process.env.CDP_API_KEY;
  const apiKeySecret = process.env.COINBASE_CDP_API_KEY_SECRET || process.env.CDP_API_SECRET;
  if (!apiKeyId || !apiKeySecret) {
    throw new Error("COINBASE_CDP_API_KEY_ID and COINBASE_CDP_API_KEY_SECRET must be set");
  }
  return generateJwt({
    apiKeyId,
    apiKeySecret,
    requestMethod: "POST",
    requestHost: "api.cdp.coinbase.com",
    requestPath: "/platform/v2/onramp/orders",
    expiresIn: 120,
  });
}

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const cf = req.headers.get("cf-connecting-ip");
  if (forwarded) return forwarded.split(",")[0].trim();
  if (realIp) return realIp;
  if (cf) return cf;
  return "127.0.0.1";
}

function setCorsHeaders(req: NextRequest, res: NextResponse): NextResponse {
  const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL || "*";
  const origin = req.headers.get("origin") || allowedOrigin;
  // In production, only allow the configured app origin
  if (process.env.NODE_ENV === "production") {
    res.headers.set("Access-Control-Allow-Origin", allowedOrigin);
  } else {
    res.headers.set("Access-Control-Allow-Origin", origin);
  }
  res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return res;
}

export async function OPTIONS(req: NextRequest) {
  const res = new NextResponse(null, { status: 204 });
  return setCorsHeaders(req, res);
}

export async function POST(req: NextRequest) {
  try {
    const body: OnrampOrderRequest = await req.json();
    const {
      address,
      email,
      phoneNumber,
      fiatAmount,
      fiatCurrency,
      asset,
      network,
      paymentMethod = "GUEST_CHECKOUT_APPLE_PAY",
      partnerUserRef,
      message,
      signature,
    } = body;

    const ip = getClientIp(req);
    const rateLimit = checkRateLimit(ip);
    if (!rateLimit.allowed) {
      return setCorsHeaders(
        req,
        NextResponse.json(
          { error: "Rate limit exceeded" },
          {
            status: 429,
            headers: {
              "Retry-After": Math.ceil((rateLimit.resetTime - Date.now()) / 1000).toString(),
            },
          }
        )
      );
    }

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return setCorsHeaders(req, NextResponse.json({ error: "Invalid address" }, { status: 400 }));
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return setCorsHeaders(req, NextResponse.json({ error: "Invalid email" }, { status: 400 }));
    }
    if (!phoneNumber || !/^1\d{10}$/.test(phoneNumber.replace(/\D/g, ""))) {
      return setCorsHeaders(req, NextResponse.json({ error: "Invalid US phone number" }, { status: 400 }));
    }
    if (!fiatAmount || fiatAmount <= 0) {
      return setCorsHeaders(req, NextResponse.json({ error: "Invalid fiat amount" }, { status: 400 }));
    }
    if (!fiatCurrency) {
      return setCorsHeaders(req, NextResponse.json({ error: "Fiat currency required" }, { status: 400 }));
    }
    if (!asset || !network) {
      return setCorsHeaders(req, NextResponse.json({ error: "Asset and network required" }, { status: 400 }));
    }

    // Optional wallet-signature verification
    if (signature && message) {
      const { verifyMessage } = await import("viem");
      const msgError = validateAuthMessage(message, address);
      if (msgError) {
        return setCorsHeaders(req, NextResponse.json({ error: `Invalid auth message: ${msgError}` }, { status: 401 }));
      }
      const valid = await verifyMessage({
        address: address as `0x${string}`,
        message,
        signature: signature as `0x${string}`,
      });
      if (!valid) {
        return setCorsHeaders(req, NextResponse.json({ error: "Invalid signature" }, { status: 401 }));
      }
    } else {
      serverLogger.warn(`Headless onramp order without signature for ${address} from ${ip}`);
    }

    let jwt: string;
    try {
      jwt = await generateCdpJwt();
    } catch (err) {
      serverLogger.error("CDP JWT generation failed:", err);
      const msg = err instanceof Error ? err.message : "Unknown error";
      return setCorsHeaders(
        req,
        NextResponse.json({ error: "Failed to authenticate with Coinbase", details: msg }, { status: 500 })
      );
    }

    const sanitizedPhone = phoneNumber.replace(/\D/g, "");
    const formattedPhone = `+1${sanitizedPhone.slice(-10)}`;

    const requestBody = {
      partnerUserRef: partnerUserRef || `crtv-${address.toLowerCase()}-${Date.now()}`,
      user: {
        email,
        phoneNumber: formattedPhone,
      },
      amount: {
        value: fiatAmount.toFixed(2),
        currency: fiatCurrency.toUpperCase(),
      },
      paymentMethod,
      destination: {
        address,
        network: network.toLowerCase(),
        asset: asset.toUpperCase(),
      },
      ...(process.env.NEXT_PUBLIC_APP_URL
        ? {
            domain: (() => {
              try {
                return new URL(process.env.NEXT_PUBLIC_APP_URL).hostname;
              } catch {
                return process.env.NEXT_PUBLIC_APP_URL.replace(/^https?:\/\//, "").split("/")[0];
              }
            })(),
          }
        : {}),
    };

    const response = await fetch("https://api.cdp.coinbase.com/platform/v2/onramp/orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    if (!response.ok) {
      serverLogger.error("Coinbase onramp order error:", responseText);
      let errorMessage = "Failed to create onramp order";
      try {
        const json = JSON.parse(responseText);
        errorMessage = json.message || json.error?.message || responseText;
      } catch {
        errorMessage = responseText || errorMessage;
      }
      return setCorsHeaders(req, NextResponse.json({ error: errorMessage }, { status: response.status }));
    }

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(responseText);
    } catch {
      return setCorsHeaders(req, NextResponse.json({ error: "Invalid response from Coinbase" }, { status: 502 }));
    }

    return setCorsHeaders(req, NextResponse.json(data));
  } catch (error) {
    serverLogger.error("Headless onramp order route error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return setCorsHeaders(req, NextResponse.json({ error: message }, { status: 500 }));
  }
}
