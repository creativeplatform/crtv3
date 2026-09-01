/**
 * Server-side wallet-signature authentication.
 *
 * Many of our mutating endpoints used to trust an `ownerAddress` (or `actor`)
 * field passed by the client, which let any caller modify any other user's
 * data. This helper closes that gap: it pulls a signed proof of address
 * ownership out of request headers and verifies it against the chain (works
 * for both EOAs and ERC-4337 smart accounts via EIP-1271).
 *
 * Pattern matches the one already used in app/api/coinbase/session-token,
 * generalized for reuse.
 *
 * Headers (set by `signWalletAuthHeaders` on the client):
 *   X-Wallet-Address    - the address the caller claims to control
 *   X-Wallet-Timestamp  - unix seconds; signature must be ≤ 5 minutes old
 *   X-Wallet-Signature  - hex signature over the canonical message below
 *
 * Canonical message:
 *   "Authorize Creative TV request for address {address} at {timestamp}"
 */

import { verifyMessage } from "viem";
import { fallbackPublicClient, publicClient } from "@/lib/viem";
import { serverLogger } from "@/lib/utils/logger";

const MAX_AGE_SECONDS = 5 * 60;

const HEADER_ADDRESS = "x-wallet-address";
const HEADER_TIMESTAMP = "x-wallet-timestamp";
const HEADER_SIGNATURE = "x-wallet-signature";
const HEX_SIGNATURE_RE = /^0x([0-9a-fA-F]{2})+$/;

function getWalletAuthHeaderValue(
  headers: Record<string, string>,
  headerName: string,
): string | undefined {
  const target = headerName.toLowerCase();
  if (headers[headerName] !== undefined) return headers[headerName];
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === target);
  return entry?.[1];
}

/** Case-insensitive read of the signed wallet address from client auth headers. */
export function getWalletAddressFromAuthHeaders(
  headers: Record<string, string>,
): string | undefined {
  const raw = getWalletAuthHeaderValue(headers, HEADER_ADDRESS);
  return raw?.trim().toLowerCase() || undefined;
}

export class WalletAuthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "WalletAuthError";
  }
}

export function buildWalletAuthMessage(address: string, timestamp: number): string {
  return `Authorize Creative TV request for address ${address.toLowerCase()} at ${timestamp}`;
}

export interface VerifiedWallet {
  address: string;
}

export type VerifyWalletSignatureResult =
  | { ok: true }
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "unavailable" };

/**
 * Verifies a wallet signature for EOAs (local) and smart accounts (EIP-1271).
 * Retries on-chain verification via the public Base RPC when Alchemy errors.
 */
export async function verifyWalletSignature(
  address: `0x${string}`,
  message: string,
  signature: `0x${string}`,
): Promise<VerifyWalletSignatureResult> {
  if (!HEX_SIGNATURE_RE.test(signature)) {
    return { ok: false, reason: "invalid" };
  }

  let valid = false;
  try {
    valid = await verifyMessage({ address, message, signature });
  } catch (err) {
    serverLogger.warn("EOA verifyMessage threw, falling through to EIP-1271:", err);
  }
  if (valid) return { ok: true };

  let primaryRpcFailed = false;
  try {
    valid = await publicClient.verifyMessage({ address, message, signature });
    if (valid) return { ok: true };
  } catch (err) {
    primaryRpcFailed = true;
    serverLogger.warn("EIP-1271 verifyMessage failed on primary RPC:", err);
  }

  if (primaryRpcFailed) {
    try {
      valid = await fallbackPublicClient.verifyMessage({
        address,
        message,
        signature,
      });
      if (valid) return { ok: true };
    } catch (err) {
      serverLogger.warn("EIP-1271 verifyMessage failed on fallback RPC:", err);
      return { ok: false, reason: "unavailable" };
    }
  }

  return { ok: false, reason: "invalid" };
}

function assertWalletSignatureValid(result: VerifyWalletSignatureResult): void {
  if (result.ok) return;
  if (result.reason === "unavailable") {
    throw new WalletAuthError(
      503,
      "Wallet verification temporarily unavailable. Please retry.",
    );
  }
  throw new WalletAuthError(401, "Invalid wallet signature");
}

/**
 * Pulls auth headers off a Next.js Request, validates the timestamp window,
 * and verifies the signature on-chain (EIP-1271 aware).
 *
 * Throws `WalletAuthError` with an HTTP status hint on any failure. Callers
 * should catch and translate into a 401/400 response.
 */
export async function requireWalletAuth(
  request: Request
): Promise<VerifiedWallet> {
  const address = request.headers.get(HEADER_ADDRESS)?.trim().toLowerCase();
  const timestampHeader = request.headers.get(HEADER_TIMESTAMP)?.trim();
  const signature = request.headers.get(HEADER_SIGNATURE)?.trim() as
    | `0x${string}`
    | undefined;

  if (!address || !timestampHeader || !signature) {
    throw new WalletAuthError(
      401,
      "Missing wallet auth headers (X-Wallet-Address, X-Wallet-Timestamp, X-Wallet-Signature)"
    );
  }

  if (!/^0x[0-9a-f]{40}$/.test(address)) {
    throw new WalletAuthError(400, "Malformed X-Wallet-Address");
  }

  const timestamp = Number(timestampHeader);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    throw new WalletAuthError(400, "Malformed X-Wallet-Timestamp");
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const age = nowSec - timestamp;
  if (age < -30) {
    // Allow 30s of clock skew, no more.
    throw new WalletAuthError(400, "Auth timestamp is in the future");
  }
  if (age > MAX_AGE_SECONDS) {
    throw new WalletAuthError(
      401,
      `Auth signature is too old (${Math.floor(age / 60)} min). Re-sign and retry.`
    );
  }

  const message = buildWalletAuthMessage(address, timestamp);
  const result = await verifyWalletSignature(
    address as `0x${string}`,
    message,
    signature,
  );
  assertWalletSignatureValid(result);

  return { address };
}

/**
 * Convenience: verify auth and additionally enforce that the verified
 * address matches an expected one (e.g. the `owner_address` in the body).
 */
export async function requireWalletAuthFor(
  request: Request,
  expectedAddress: string
): Promise<VerifiedWallet> {
  const { address } = await requireWalletAuth(request);
  if (address !== expectedAddress.toLowerCase()) {
    throw new WalletAuthError(
      403,
      "Authenticated address does not match the requested resource owner"
    );
  }
  return { address };
}

/**
 * Equivalent of `requireWalletAuth` but for Next.js Server Actions, which
 * can't accept custom request headers from the client. The client reads the
 * same {address, timestamp, signature} triple from `useWalletAuth` and
 * passes it through as a regular argument; the action verifies it the same
 * way the route handler would.
 */
export interface WalletAuthArgs {
  address: string;
  timestamp: number;
  signature: string;
}

/** Convert client auth headers into server-action args. */
export function walletAuthHeadersToArgs(
  headers: Record<string, string>,
): WalletAuthArgs {
  return {
    address: getWalletAuthHeaderValue(headers, HEADER_ADDRESS) ?? "",
    timestamp: Number(getWalletAuthHeaderValue(headers, HEADER_TIMESTAMP)),
    signature: getWalletAuthHeaderValue(headers, HEADER_SIGNATURE) ?? "",
  };
}

/**
 * Verify a wallet-auth triple. By default the signature must cover the
 * generic canonical message; pass `buildMessage` to bind the signature to a
 * purpose-specific message (e.g. sticker claim delegation) so a generic auth
 * signature can't be replayed for that action.
 */
export async function verifyWalletAuthArgs(
  auth: WalletAuthArgs | undefined,
  buildMessage: (
    address: string,
    timestamp: number,
  ) => string = buildWalletAuthMessage,
): Promise<VerifiedWallet> {
  if (!auth || !auth.address || !auth.timestamp || !auth.signature) {
    throw new WalletAuthError(
      401,
      "Missing wallet auth (address/timestamp/signature)"
    );
  }
  const address = auth.address.trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(address)) {
    throw new WalletAuthError(400, "Malformed auth address");
  }
  if (!Number.isFinite(auth.timestamp) || auth.timestamp <= 0) {
    throw new WalletAuthError(400, "Malformed auth timestamp");
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const age = nowSec - auth.timestamp;
  if (age < -30) {
    throw new WalletAuthError(400, "Auth timestamp is in the future");
  }
  if (age > MAX_AGE_SECONDS) {
    throw new WalletAuthError(
      401,
      `Auth signature is too old (${Math.floor(age / 60)} min). Re-sign and retry.`
    );
  }

  const message = buildMessage(address, auth.timestamp);
  const result = await verifyWalletSignature(
    address as `0x${string}`,
    message,
    auth.signature as `0x${string}`,
  );
  assertWalletSignatureValid(result);
  return { address };
}
