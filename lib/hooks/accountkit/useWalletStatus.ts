import { useUser } from "@/lib/wallet/react";
import useModularAccount from "./useModularAccount";
import { isWalletConnected } from "@/lib/utils/wallet";

/**
 * Custom hook that combines wallet connection status checks
 * @returns Object containing wallet status information
 */
export function useWalletStatus() {
  const user = useUser();
  const {
    smartAccountClient,
    address: smartAccountAddress,
    loading: isLoadingClient,
    signerReady,
  } = useModularAccount();

  // Use our utility function to check wallet connection
  const isConnected = isWalletConnected(user, smartAccountClient);

  return {
    isConnected,
    isLoadingClient,
    signerReady,
    hasSmartAccount: !!smartAccountClient,
    walletAddress: user?.address || null,
    smartAccountAddress: smartAccountAddress || null,
    user,
    smartAccountClient,
  };
}
