import { useSmartAccountClient, useUser, useChain } from "@/lib/wallet/react";
import { base } from "@account-kit/infra";
import { modularAccountFactoryAddresses } from "@/lib/utils/modularAccount";
import { Chain } from "viem";
import { logger } from '@/lib/utils/logger';


interface UseModularAccountProps {
  chain?: Chain;
}

/**
 * Custom hook for managing a ModularAccountV2 instance using Account Kit React hooks
 *
 * @param props Configuration options
 * @returns Smart account client and related properties
 */
export default function useModularAccount(props?: UseModularAccountProps) {
  const { chain: customChain } = props || {};

  // Use built-in Account Kit hooks
  const { chain: currentChain } = useChain();
  const user = useUser();

  // Determine which chain to use
  const chain = customChain || currentChain || base;

  // Get the factory address for the current chain
  const factoryAddress = modularAccountFactoryAddresses[chain.id];

  // Use the Account Kit smart account client hook
  const {
    client: smartAccountClient,
    address,
    isLoadingClient,
    error,
  } = useSmartAccountClient({
    type: "ModularAccountV2",
  });

  /**
   * Get the address of the smart account
   */
  const getAddress = async (): Promise<string | null> => {
    if (!smartAccountClient) return null;

    try {
      return address as string;
    } catch (err) {
      logger.error("Error getting account address:", err);
      return null;
    }
  };

  return {
    account: smartAccountClient?.account,
    address, // Expose the smart account address directly
    smartAccountClient,
    loading: isLoadingClient,
    error,
    signerReady: !!user,
    getAddress,
  };
}
