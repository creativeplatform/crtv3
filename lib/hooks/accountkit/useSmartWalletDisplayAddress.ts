import { useMemo } from "react";
import { useUser } from "@/lib/wallet/react";
import useModularAccount from "./useModularAccount";
import { shortenAddress } from "@/lib/utils/utils";

/**
 * Resolves the public wallet identity for UI: smart account first, EOA only for pure EOA users.
 * Avoids briefly showing the signer address while the modular account client is still loading.
 */
export function useSmartWalletDisplayAddress() {
  const user = useUser();
  const {
    address: smartAccountAddress,
    smartAccountClient: client,
    account,
    loading: isSmartAccountLoading,
  } = useModularAccount();

  const primaryAddress = useMemo(() => {
    if (smartAccountAddress) return smartAccountAddress;
    if (user?.type === "eoa" && user.address) return user.address;
    return undefined;
  }, [smartAccountAddress, user?.type, user?.address]);

  const signerAddress = useMemo(() => {
    if (!user?.address || !primaryAddress) return undefined;
    if (user.address.toLowerCase() === primaryAddress.toLowerCase()) return undefined;
    return user.address;
  }, [user?.address, primaryAddress]);

  const displayAddress = useMemo(() => {
    if (primaryAddress) return shortenAddress(primaryAddress);
    if (isSmartAccountLoading && user?.type === "sca") return "Loading...";
    return "";
  }, [primaryAddress, isSmartAccountLoading, user?.type]);

  const walletLabel =
    smartAccountAddress || user?.type === "sca"
      ? "Smart Wallet"
      : user?.address
        ? "EOA"
        : "Not Connected";

  return {
    primaryAddress,
    smartAccountAddress,
    signerAddress,
    displayAddress,
    walletLabel,
    isSmartAccountLoading,
    client,
    account,
    user,
  };
}
