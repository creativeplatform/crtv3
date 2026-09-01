"use server";
import { NextRequest, NextResponse } from "next/server";
import { checkBotIdDeep } from "@/lib/middleware/botIdGuard";
import { generateJwt } from "@coinbase/cdp-sdk/auth";
import { verifyMessage } from "viem";
import { serverLogger } from "@/lib/utils/logger";

/**
 * Coinbase CDP Session Token API
 * 
 * Generates a session token for Coinbase Onramp/Offramp using Secure Init.
 * 
 * Security:
 * - Rate limiting: 10 requests per IP per minute
 * - Signature verification: Optional but recommended (proves address ownership)
 * 
 * Required Environment Variables:
 * - CDP_API_KEY (or COINBASE_CDP_API_KEY_ID): Your CDP API Key ID
 * - CDP_API_SECRET (or COINBASE_CDP_API_KEY_SECRET): Your CDP Secret API Key
 * 
 * @see https://docs.cdp.coinbase.com/onramp-&-offramp/session-token-authentication
 */

interface SessionTokenRequest {
  address: string;
  assets?: string[]; // Optional: ["USDC", "ETH"] - Note: DAI not available on Base for onramp
  clientIp?: string; // Optional: Client IP for security validation
  signature?: string; // Optional: Signed message proving address ownership
  message?: string; // Optional: Message that was signed (must match expected format)
}

// Simple in-memory rate limiting store
// In production, consider using Redis or a dedicated rate limiting service
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Rate limiting configuration
const RATE_LIMIT_REQUESTS = 10; // Max requests per window
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window

// Cleanup interval - remove expired entries every 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanupTime = Date.now();

/**
 * Remove expired entries from the rate limit store to prevent memory leaks
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  const entriesToDelete: string[] = [];

  for (const [ip, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      entriesToDelete.push(ip);
    }
  }

  // Delete expired entries
  entriesToDelete.forEach((ip) => {
    rateLimitStore.delete(ip);
  });

  if (entriesToDelete.length > 0) {
    serverLogger.debug(`Cleaned up ${entriesToDelete.length} expired rate limit entries`);
  }
}

/**
 * Check if request exceeds rate limit
 * Also performs periodic cleanup of expired entries to prevent memory leaks
 */
function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();

  // Periodic cleanup: remove expired entries every 5 minutes
  if (now - lastCleanupTime > CLEANUP_INTERVAL_MS) {
    cleanupExpiredEntries();
    lastCleanupTime = now;
  }

  const entry = rateLimitStore.get(ip);

  if (!entry || now > entry.resetTime) {
    // Create new entry or reset expired entry
    // If entry exists but is expired, it will be overwritten (no need to delete first)
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

/**
 * Verify signature proves ownership of address
 * 
 * verifyMessage from viem returns a boolean indicating if the signature
 * was created by the specified address for the given message.
 */
async function verifyAddressOwnership(
  address: string,
  message: string,
  signature: string
): Promise<boolean> {
  try {
    // verifyMessage returns a boolean - true if signature is valid for the address and message
    const isValid = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });
    return isValid;
  } catch (error) {
    serverLogger.error("Signature verification error:", error);
    return false;
  }
}

/**
 * Generate expected message for signature verification
 */
function generateAuthMessage(address: string, timestamp: number): string {
  return `Authorize Coinbase CDP session token generation for address ${address} at ${timestamp}`;
}

/**
 * Validate and parse the authentication message format
 * Expected format: "Authorize Coinbase CDP session token generation for address {address} at {timestamp}"
 * 
 * @returns Object with parsed address and timestamp, or null if invalid
 */
function parseAuthMessage(message: string): { address: string; timestamp: number } | null {
  const expectedPrefix = "Authorize Coinbase CDP session token generation for address ";
  const expectedSuffix = " at ";

  if (!message.startsWith(expectedPrefix)) {
    return null;
  }

  const afterPrefix = message.slice(expectedPrefix.length);
  const suffixIndex = afterPrefix.lastIndexOf(expectedSuffix);

  if (suffixIndex === -1) {
    return null;
  }

  const address = afterPrefix.slice(0, suffixIndex);
  const timestampStr = afterPrefix.slice(suffixIndex + expectedSuffix.length);

  // Validate address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return null;
  }

  // Validate and parse timestamp
  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp) || timestamp <= 0) {
    return null;
  }

  return { address: address.toLowerCase(), timestamp };
}

/**
 * Validate message format and timestamp before signature verification
 * 
 * @param message - The message that was signed
 * @param expectedAddress - The address that should be in the message
 * @param maxAgeSeconds - Maximum age of the message in seconds (default: 5 minutes)
 * @returns Error message if invalid, null if valid
 */
function validateAuthMessage(
  message: string,
  expectedAddress: string,
  maxAgeSeconds: number = 5 * 60
): string | null {
  const parsed = parseAuthMessage(message);

  if (!parsed) {
    return "Invalid message format. Message must follow the expected format: 'Authorize Coinbase CDP session token generation for address {address} at {timestamp}'";
  }

  // Verify address matches
  if (parsed.address !== expectedAddress.toLowerCase()) {
    return "Message address does not match requested address";
  }

  // Verify timestamp is recent (not too old, not from the future)
  const now = Math.floor(Date.now() / 1000);
  const age = now - parsed.timestamp;

  if (age < 0) {
    return "Message timestamp is in the future";
  }

  if (age > maxAgeSeconds) {
    return `Message is too old (${Math.floor(age / 60)} minutes). Please sign a new message.`;
  }

  return null; // Message is valid
}

/**
 * Generate JWT token for Coinbase CDP API authentication using the CDP SDK
 * 
 * The CDP SDK handles JWT generation automatically, including:
 * - Correct algorithm (ES256)
 * - Proper payload structure
 * - Key format handling
 */
async function generateJWT(): Promise<string> {
  // Support both naming conventions for flexibility
  const apiKeyId = process.env.CDP_API_KEY || process.env.COINBASE_CDP_API_KEY_ID;
  const apiKeySecret = process.env.CDP_API_SECRET || process.env.COINBASE_CDP_API_KEY_SECRET;

  if (!apiKeyId || !apiKeySecret) {
    throw new Error(
      "CDP_API_KEY and CDP_API_SECRET (or COINBASE_CDP_API_KEY_ID and COINBASE_CDP_API_KEY_SECRET) must be set in environment variables"
    );
  }

  const requestMethod = "POST";
  const requestHost = "api.developer.coinbase.com";
  const requestPath = "/onramp/v1/token";

  try {
    // Use the CDP SDK to generate the JWT
    // This handles key format and algorithm automatically
    const token = await generateJwt({
      apiKeyId: apiKeyId,
      apiKeySecret: apiKeySecret,
      requestMethod: requestMethod,
      requestHost: requestHost,
      requestPath: requestPath,
      expiresIn: 120, // 120 seconds (2 minutes)
    });

    return token;
  } catch (error) {
    throw new Error(
      `Failed to generate JWT: ${error instanceof Error ? error.message : "Unknown error"}. ` +
      `Ensure your CDP_API_SECRET is a valid API key secret from the Coinbase CDP portal.`
    );
  }
}

/**
 * Check if an IP address is private/local (not routable on the public internet)
 * Private IP ranges:
 * - IPv4: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8, 169.254.0.0/16
 * - IPv6: ::1 (loopback), fc00::/7 (unique local), fe80::/10 (link-local)
 */
function isPrivateIp(ip: string): boolean {
  if (!ip) return true;

  // IPv6 loopback
  if (ip === "::1" || ip.toLowerCase() === "::1") return true;

  // IPv4 addresses
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = ip.match(ipv4Regex);
  
  if (match) {
    const [_, a, b, c, d] = match.map(Number);
    
    // 127.0.0.0/8 (loopback)
    if (a === 127) return true;
    
    // 10.0.0.0/8 (private)
    if (a === 10) return true;
    
    // 172.16.0.0/12 (private)
    if (a === 172 && b >= 16 && b <= 31) return true;
    
    // 192.168.0.0/16 (private)
    if (a === 192 && b === 168) return true;
    
    // 169.254.0.0/16 (link-local)
    if (a === 169 && b === 254) return true;
  }

  // IPv6 unique local (fc00::/7) and link-local (fe80::/10)
  const ipLower = ip.toLowerCase();
  if (ipLower.startsWith("fc") || ipLower.startsWith("fd") || ipLower.startsWith("fe80")) {
    return true;
  }

  return false;
}

/**
 * Get client IP from request headers
 */
function getClientIp(request: NextRequest): string {
  // Try various headers that might contain the real IP
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const cfConnectingIp = request.headers.get("cf-connecting-ip");

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  if (realIp) {
    return realIp;
  }
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  // Fallback to a default (not recommended for production)
  return "127.0.0.1";
}

export async function POST(req: NextRequest) {
  const verification = await checkBotIdDeep();
  if (verification.isBot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  try {
    const body: SessionTokenRequest = await req.json();
    // Default to USDC and ETH - DAI is not available on Base for onramp
    // DAI is only available on: Ethereum, Avalanche C-Chain, Optimism, Arbitrum
    const { address, assets = ["USDC", "ETH"], clientIp, signature, message } = body;
    
    // Filter out DAI since we're using Base network (DAI not supported on Base for onramp)
    const filteredAssets = (assets || []).filter(asset => 
      asset.toUpperCase() !== "DAI"
    );

    // Validate required fields
    if (!address) {
      return NextResponse.json(
        { error: "Address is required" },
        { status: 400 }
      );
    }

    // Validate address format (basic Ethereum address check)
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json(
        { error: "Invalid address format" },
        { status: 400 }
      );
    }

    // Get client IP (required for security validation and rate limiting)
    const ip = clientIp || getClientIp(req);

    // Rate limiting check
    const rateLimit = checkRateLimit(ip);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded. Please try again later.",
          retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": RATE_LIMIT_REQUESTS.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": new Date(rateLimit.resetTime).toISOString(),
            "Retry-After": Math.ceil((rateLimit.resetTime - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // Verify signature if provided (recommended for production)
    if (signature && message) {
      // First, validate the message format and content
      const messageError = validateAuthMessage(message, address);
      if (messageError) {
        return NextResponse.json(
          { error: `Invalid authentication message: ${messageError}` },
          { status: 401 }
        );
      }

      // Then verify the signature
      const isValid = await verifyAddressOwnership(address, message, signature);
      if (!isValid) {
        return NextResponse.json(
          { error: "Invalid signature. Signature must prove ownership of the requested address." },
          { status: 401 }
        );
      }
    } else {
      // Log warning if signature is not provided (for monitoring)
      serverLogger.warn(
        `Session token request without signature verification for address ${address} from IP ${ip}. ` +
        `Consider implementing signature verification for enhanced security.`
      );
    }

    // Generate JWT token
    let jwtToken: string;
    try {
      jwtToken = await generateJWT();
    } catch (error) {
      serverLogger.error("JWT generation error:", error);
      
      // Provide more specific error messages for debugging
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      let userFriendlyMessage = "Failed to generate authentication token.";
      
      if (errorMessage.includes("must be set in environment variables")) {
        userFriendlyMessage = "Coinbase CDP API keys are not configured. Please set CDP_API_KEY and CDP_API_SECRET (or COINBASE_CDP_API_KEY_ID and COINBASE_CDP_API_KEY_SECRET) in your environment variables.";
      } else if (errorMessage.includes("ECDSA") || errorMessage.includes("PEM") || errorMessage.includes("key")) {
        userFriendlyMessage = "Invalid API key format. Please ensure your CDP_API_SECRET is the correct secret key from the Coinbase CDP portal. If you're using a new key, make sure it was created with the ECDSA signature algorithm.";
      } else {
        userFriendlyMessage = `Failed to generate authentication token: ${errorMessage}`;
      }
      
      return NextResponse.json(
        {
          error: userFriendlyMessage,
          details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
        },
        { status: 500 }
      );
    }

    // Prepare addresses array for Coinbase API
    // Base network is the primary network we support
    // Note: DAI is NOT available on Base for onramp (only on Ethereum, Avalanche C-Chain, Optimism, Arbitrum)
    const addresses = [
      {
        address: address,
        blockchains: ["base"], // Base network supports USDC and ETH for onramp
      },
    ];

    // Use filtered assets or default to USDC and ETH (DAI not supported on Base for onramp)
    const finalAssets = filteredAssets.length > 0 ? filteredAssets : ["USDC", "ETH"];

    // Prepare request body - only include clientIp if it's a public IP
    // Coinbase CDP rejects private IP addresses (e.g., 127.0.0.1, ::1)
    // For local development, we omit clientIp (it's optional)
    const requestBody: {
      addresses: typeof addresses;
      assets: string[];
      clientIp?: string;
    } = {
      addresses: addresses,
      assets: finalAssets, // USDC and ETH only for Base (DAI not available)
    };

    // Only include clientIp if it's a public IP address
    // This allows local development to work without Coinbase rejecting private IPs
    if (!isPrivateIp(ip)) {
      requestBody.clientIp = ip;
    } else {
      // Log in development that we're omitting the private IP
      if (process.env.NODE_ENV === "development") {
        serverLogger.debug(
          `Omitting private IP ${ip} from Coinbase API request (private IPs are not allowed)`
        );
      }
    }

    // Call Coinbase Session Token API
    const response = await fetch(
      "https://api.developer.coinbase.com/onramp/v1/token",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${jwtToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      serverLogger.error("Coinbase API error:", errorText);
      
      let errorMessage = "Failed to create session token";
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Return session token with rate limit headers
    return NextResponse.json(
      {
        sessionToken: data.data?.token || data.token,
        channelId: data.data?.channel_id || data.channel_id,
      },
      {
        headers: {
          "X-RateLimit-Limit": RATE_LIMIT_REQUESTS.toString(),
          "X-RateLimit-Remaining": rateLimit.remaining.toString(),
          "X-RateLimit-Reset": new Date(rateLimit.resetTime).toISOString(),
        },
      }
    );
  } catch (error) {
    serverLogger.error("Session token error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create session token",
      },
      { status: 500 }
    );
  }
}

