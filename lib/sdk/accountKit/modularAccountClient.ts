import { createModularAccountV2Client } from "@account-kit/smart-contracts";
import { alchemy, base } from "@account-kit/infra";
import { generatePrivateKey } from "viem/accounts";
import { type Chain } from "viem";
import { modularAccountFactoryAddresses } from "@/lib/utils/modularAccount";
import { signer } from "./signer";
import { serverLogger } from "@/lib/utils/logger";
import { appendBuilderCode } from "@/lib/utils/builder-code";

interface CreateModularAccountClientParams {
  chain?: Chain;
  apiKey: string;
  privateKey?: string;
}

/**
 * Creates a standalone Modular Account V2 client instance
 * Use this for non-React contexts (API routes, services, etc.)
 * For React components, use the useModularAccount hook instead
 *
 * @param params Configuration parameters
 * @returns ModularAccountV2Client instance
 */
export async function createModularAccountClient({
  chain = base,
  apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY as string,
  privateKey = generatePrivateKey(),
}: CreateModularAccountClientParams) {
  // Get the factory address for the chain
  const factoryAddress = modularAccountFactoryAddresses[chain.id];
  if (!factoryAddress) {
    throw new Error(`No factory address found for chain ${chain.id}`);
  }

  const accountClient = await createModularAccountV2Client({
    mode: "default", // Use default mode for standard functionality
    chain,
    transport: alchemy({
      apiKey,
    }),
    signer: signer.instance,
  });

  return accountClient;
}

/**
 * Helper function to send a user operation
 * For React components, use useSendUserOperation from @account-kit/react instead
 */
export async function sendUserOperation({
  client,
  target,
  data = "0x",
  value = BigInt(0),
}: {
  client: Awaited<ReturnType<typeof createModularAccountClient>>;
  target: `0x${string}`;
  data?: `0x${string}`;
  value?: bigint;
}) {
  try {
    const operation = await client.sendUserOperation({
      uo: {
        target,
        data: appendBuilderCode(data ?? "0x"),
        value,
      },
    });

    return {
      hash: operation.hash,
      sender: operation.request.sender,
      success: true,
    };
  } catch (error) {
    serverLogger.error("Error sending user operation:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
