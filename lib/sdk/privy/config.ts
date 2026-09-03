export function getPrivyAppId(): string {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId) {
    throw new Error("Missing NEXT_PUBLIC_PRIVY_APP_ID");
  }
  return appId;
}

export function getPrivyAppSecret(): string {
  const secret = process.env.PRIVY_APP_SECRET;
  if (!secret) {
    throw new Error("Missing PRIVY_APP_SECRET");
  }
  return secret;
}

export function getEarnVaultId(): string {
  const vaultId = process.env.PRIVY_EARN_VAULT_ID;
  if (!vaultId) {
    throw new Error("Missing PRIVY_EARN_VAULT_ID");
  }
  return vaultId;
}

export function isEarnConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_PRIVY_APP_ID &&
      process.env.PRIVY_APP_SECRET &&
      process.env.PRIVY_EARN_VAULT_ID,
  );
}

/** Convert basis points (e.g. 361) to a display percentage string (e.g. "3.61"). */
export function basisPointsToPercent(bps: number | null | undefined): string | null {
  if (bps == null) return null;
  return (bps / 100).toFixed(2);
}
