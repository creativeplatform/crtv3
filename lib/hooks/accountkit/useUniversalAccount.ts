import useModularAccount from "./useModularAccount";
import { useAccount } from "@/lib/wallet/react";

/**
 * Returns the best available wallet address (SCA or EOA) and its type.
 */
export function useUniversalAccount() {
  // Modular Account (SCA)
  const modular = useModularAccount();
  // EOA (MetaMask, etc.)
  const { address: eoaAddress } = useAccount({ type: "ModularAccountV2" });

  // Prefer Modular Account, fallback to EOA
  const address = modular.account?.address || eoaAddress;
  const type = modular.account?.address
    ? "SCA"
    : eoaAddress
    ? "EOA"
    : undefined;

  return { address, type, loading: modular.loading };
}
