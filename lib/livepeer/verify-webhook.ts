import { createHmac, timingSafeEqual } from "crypto";
import { parseSignatureHeader } from "@/lib/livepeer/parse-webhook-event";
import { normalizeEnvSecret } from "@/lib/sdk/livepeer/studioAuth";

/**
 * Verifies Livepeer webhook signatures (`Livepeer-Signature: t=...,v1=...`).
 * Returns true when no secret is configured (dev) or signature matches.
 */
export function verifyLivepeerWebhookSignature(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  const secret = normalizeEnvSecret(process.env.LIVEPEER_WEBHOOK_SECRET);
  if (!secret) return true;
  if (!signatureHeader) return false;

  const parts = parseSignatureHeader(signatureHeader);
  const timestamp = parts.t;
  // Livepeer signs with scheme `v1`; keep `s` as a legacy fallback.
  const signature = parts.v1 ?? parts.s;
  if (!timestamp || !signature) return false;

  const payload = `${timestamp}.${rawBody}`;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) {
    return false;
  }
  return timingSafeEqual(sigBuf, expBuf);
}
