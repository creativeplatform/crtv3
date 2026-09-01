import { NextRequest, NextResponse } from "next/server";
import { rateLimiters } from "@/lib/middleware/rateLimit";
import {
  extractBearerToken,
  isPlatformApiAccessConfigured,
  getPlatformApiKeysFromEnv,
  matchPlatformApiKey,
} from "@/lib/middleware/platformApiKeys";
import {
  buildX402PaymentRequiredResponse,
  getX402PriceForResource,
  getX402Recipient,
  PLATFORM_API_CORS_HEADERS,
  verifyX402PaymentFromRequest,
} from "@/lib/middleware/x402Gate";
import { serverLogger } from "@/lib/utils/logger";

export type PlatformApiAccessTier = "admin" | "partner" | "x402" | "public";

export type PlatformApiAccessOptions = {
  resource: string;
  priceUsdc?: string;
};

export type PlatformApiAccessResult =
  | { allowed: true; tier: PlatformApiAccessTier; keyId?: string }
  | { allowed: false; response: NextResponse };

function unauthorizedResponse(message: string): NextResponse {
  return NextResponse.json(
    { error: message, code: "UNAUTHORIZED" },
    { status: 401, headers: PLATFORM_API_CORS_HEADERS },
  );
}

function mergePlatformApiHeaders(response: NextResponse): NextResponse {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(PLATFORM_API_CORS_HEADERS)) {
    headers.set(key, value);
  }
  return new NextResponse(response.body, { status: response.status, headers });
}

/** Allow first-party Creative TV browser traffic without Platform API credentials. */
export function isSameOriginAppRequest(request: NextRequest): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  return fetchSite === "same-origin" || fetchSite === "same-site";
}

async function tryAllowSameOriginAppRequest(
  request: NextRequest,
  resource?: string,
): Promise<PlatformApiAccessResult | null> {
  if (!isSameOriginAppRequest(request)) {
    return null;
  }

  const rl =
    resource === 'playback.info'
      ? await rateLimiters.playbackInfo(request)
      : await rateLimiters.generous(request);
  if (rl) {
    return { allowed: false, response: mergePlatformApiHeaders(rl) };
  }

  return { allowed: true, tier: 'public' };
}

export async function requirePlatformApiAccess(
  request: NextRequest,
  options: PlatformApiAccessOptions,
): Promise<PlatformApiAccessResult> {
  if (!isPlatformApiAccessConfigured()) {
    return { allowed: true, tier: "public" };
  }

  const keys = getPlatformApiKeysFromEnv();
  const bearer = extractBearerToken(request.headers.get("authorization"));

  if (bearer) {
    const match = matchPlatformApiKey(bearer, keys);
    if (match) {
      if (match.tier === "partner") {
        const rl = await rateLimiters.apiKey(request, match.keyId ?? "partner");
        if (rl) {
          return {
            allowed: false,
            response: mergePlatformApiHeaders(rl),
          };
        }
      }

      serverLogger.debug("[platformApiAccess] allowed", {
        tier: match.tier,
        keyId: match.keyId,
        resource: options.resource,
      });

      return { allowed: true, tier: match.tier, keyId: match.keyId };
    }

    return { allowed: false, response: unauthorizedResponse("Invalid API key") };
  }

  const sameOriginResult = await tryAllowSameOriginAppRequest(request, options.resource);
  if (sameOriginResult) {
    return sameOriginResult;
  }

  const recipient = getX402Recipient();
  const priceUsdc = options.priceUsdc ?? getX402PriceForResource(options.resource);

  if (!recipient) {
    return {
      allowed: false,
      response: unauthorizedResponse(
        "API key required. Configure CREATIVE_PLATFORM_*_API_KEYS or X402_API_RECIPIENT.",
      ),
    };
  }

  const payment = await verifyX402PaymentFromRequest(request, {
    recipient,
    priceUsdc,
    resource: options.resource,
  });
  if (payment.ok) {
    serverLogger.debug("[platformApiAccess] x402 payment verified", {
      resource: options.resource,
    });
    return { allowed: true, tier: "x402" };
  }

  if (payment.error !== "Missing payment proof") {
    return {
      allowed: false,
      response: NextResponse.json(
        { error: payment.error, code: "PAYMENT_INVALID" },
        { status: 402, headers: PLATFORM_API_CORS_HEADERS },
      ),
    };
  }

  return {
    allowed: false,
    response: buildX402PaymentRequiredResponse({
      resource: options.resource,
      priceUsdc,
      recipient,
      requestUrl: request.url,
    }),
  };
}

export function platformApiOptionsResponse(): NextResponse {
  return new NextResponse(null, {
    status: 200,
    headers: PLATFORM_API_CORS_HEADERS,
  });
}
