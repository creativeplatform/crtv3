import crypto from "node:crypto";

const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export type PinataDeviceIdentity = {
  deviceId: string;
  publicKeyPem: string;
  privateKeyPem: string;
  publicKeyRawBase64Url: string;
};

function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64url");
}

function derivePublicKeyRaw(publicKeyPem: string): Buffer {
  const spki = crypto
    .createPublicKey(publicKeyPem)
    .export({ type: "spki", format: "der" }) as Buffer;
  if (
    spki.length === ED25519_SPKI_PREFIX.length + 32 &&
    spki.subarray(0, ED25519_SPKI_PREFIX.length).equals(ED25519_SPKI_PREFIX)
  ) {
    return spki.subarray(ED25519_SPKI_PREFIX.length);
  }
  return spki;
}

export function normalizeDeviceMetadataForAuth(value?: string | null): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.replace(/[A-Z]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) + 32),
  );
}

export function buildDeviceAuthPayloadV3(params: {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token?: string | null;
  nonce: string;
  platform?: string | null;
  deviceFamily?: string | null;
}): string {
  const scopes = params.scopes.join(",");
  const token = params.token ?? "";
  return [
    "v3",
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    scopes,
    String(params.signedAtMs),
    token,
    params.nonce,
    normalizeDeviceMetadataForAuth(params.platform),
    normalizeDeviceMetadataForAuth(params.deviceFamily),
  ].join("|");
}

export function signDevicePayload(
  privateKeyPem: string,
  payload: string,
): string {
  const sig = crypto.sign(
    null,
    Buffer.from(payload, "utf8"),
    crypto.createPrivateKey(privateKeyPem),
  );
  return base64UrlEncode(sig);
}

export function generateDeviceIdentity(): PinataDeviceIdentity {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }) as string;
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
  const raw = derivePublicKeyRaw(publicKeyPem);
  const deviceId = crypto.createHash("sha256").update(raw).digest("hex");
  return {
    deviceId,
    publicKeyPem,
    privateKeyPem,
    publicKeyRawBase64Url: base64UrlEncode(raw),
  };
}

export function loadDeviceIdentityFromPrivateKeyPem(
  privateKeyPem: string,
): PinataDeviceIdentity {
  const privateKey = crypto.createPrivateKey(privateKeyPem.trim());
  const publicKey = crypto.createPublicKey(privateKey);
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }) as string;
  const normalizedPrivateKeyPem = privateKey.export({
    type: "pkcs8",
    format: "pem",
  }) as string;
  const raw = derivePublicKeyRaw(publicKeyPem);
  const deviceId = crypto.createHash("sha256").update(raw).digest("hex");
  return {
    deviceId,
    publicKeyPem,
    privateKeyPem: normalizedPrivateKeyPem,
    publicKeyRawBase64Url: base64UrlEncode(raw),
  };
}

export function resolveDeviceIdentity(
  privateKeyPem?: string | null,
): PinataDeviceIdentity {
  if (privateKeyPem?.trim()) {
    return loadDeviceIdentityFromPrivateKeyPem(privateKeyPem);
  }
  return generateDeviceIdentity();
}

/** Stable server-side Ed25519 PEM for gateway pairing (shared across Pinata agents). */
export function resolveServerDevicePrivateKeyPem(
  preferred?: string | null,
): string | null {
  const explicit = preferred?.trim();
  if (explicit) return explicit;
  return (
    process.env.PINATA_SERVER_DEVICE_PRIVATE_KEY_PEM?.trim() ||
    process.env.SONG_CUP_PINATA_DEVICE_PRIVATE_KEY_PEM?.trim() ||
    process.env.PINATA_TWIN_DEVICE_PRIVATE_KEY_PEM?.trim() ||
    null
  );
}
