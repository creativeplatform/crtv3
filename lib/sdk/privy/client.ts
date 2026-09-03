import { PrivyClient } from "@privy-io/node";
import { getPrivyAppId, getPrivyAppSecret } from "./config";

let privyClient: PrivyClient | null = null;

export function getPrivyClient(): PrivyClient {
  if (!privyClient) {
    privyClient = new PrivyClient({
      appId: getPrivyAppId(),
      appSecret: getPrivyAppSecret(),
      ...(process.env.PRIVY_JWT_VERIFICATION_KEY
        ? { jwtVerificationKey: process.env.PRIVY_JWT_VERIFICATION_KEY }
        : {}),
    });
  }
  return privyClient;
}
