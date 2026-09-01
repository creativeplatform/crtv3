import { PublicClient } from "@lens-protocol/client";
import { mainnet, testnet, type EnvironmentConfig } from "@lens-protocol/env";

/**
 * Lens environments from `@lens-protocol/client` can resolve to a stub mainnet
 * that throws at runtime. Import the real configs from `@lens-protocol/env`.
 */
export function getLensSdkEnvironment(): EnvironmentConfig {
  return process.env.NEXT_PUBLIC_LENS_ENV === "production" ? mainnet : testnet;
}

/**
 * Creates a Lens Public Client.
 *
 * @param apiKey - Optional Server API Key for server-side context.
 *                 NEVER pass this in client-side code.
 * @returns PublicClient
 */
export const createLensClient = (apiKey?: string) => {
    return PublicClient.create({
        environment: getLensSdkEnvironment(),
        ...(apiKey && { apiKey }),
    });
};
