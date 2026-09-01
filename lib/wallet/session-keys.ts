import type { Hex } from "viem";
import type { SendUserOperationArgs } from "@/lib/wallet/smart-wallet-client";

/**
 * Build v5 sendCalls permissions context for legacy ModularAccountV2 session keys.
 * Pass via sendUserOperation({ context: buildSessionKeyContext(entityId) }).
 */
export function buildSessionKeyContext(entityId: number): NonNullable<
  SendUserOperationArgs["context"]
> {
  const entityIdHex = `0x${entityId.toString(16).padStart(64, "0")}` as Hex;
  return {
    permissions: {
      context: entityIdHex,
    },
  };
}
