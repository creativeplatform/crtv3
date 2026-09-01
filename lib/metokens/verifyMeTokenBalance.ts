import { formatEther, parseAbi } from "viem";
import { publicClient } from "@/lib/viem";
import { TransactionVerificationError } from "@/lib/chain/verifyTransactionReceipt";
import { serverLogger } from "@/lib/utils/logger";

const erc20BalanceAbi = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
]);

export interface VerifyMeTokenBalanceParams {
  meTokenAddress: string;
  userAddress: string;
  claimedBalance?: number | string;
}

/**
 * Read on-chain MeToken balance for a user. Optionally assert it matches a claimed value.
 */
export async function verifyMeTokenBalance(
  params: VerifyMeTokenBalanceParams,
): Promise<number> {
  const meTokenAddress = params.meTokenAddress.trim().toLowerCase();
  const userAddress = params.userAddress.trim().toLowerCase();

  if (!/^0x[a-f0-9]{40}$/.test(meTokenAddress) || !/^0x[a-f0-9]{40}$/.test(userAddress)) {
    throw new TransactionVerificationError("Invalid address format");
  }

  let onChainBalance: bigint;
  try {
    onChainBalance = await publicClient.readContract({
      address: meTokenAddress as `0x${string}`,
      abi: erc20BalanceAbi,
      functionName: "balanceOf",
      args: [userAddress as `0x${string}`],
    });
  } catch (err) {
    serverLogger.warn("[verifyMeTokenBalance] readContract failed:", err);
    throw new TransactionVerificationError("Unable to verify balance on-chain");
  }

  const verifiedBalance = parseFloat(formatEther(onChainBalance));

  if (params.claimedBalance != null) {
    const claimed = Number(params.claimedBalance);
    if (!Number.isFinite(claimed) || claimed < 0) {
      throw new TransactionVerificationError("Invalid claimed balance");
    }
    const tolerance = Math.max(claimed * 0.01, 1e-9);
    if (Math.abs(verifiedBalance - claimed) > tolerance) {
      throw new TransactionVerificationError(
        "Claimed balance does not match on-chain balanceOf",
      );
    }
  }

  return verifiedBalance;
}
