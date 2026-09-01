import { decodeEventLog, formatEther, parseAbi } from "viem";
import { METOKEN_DIAMOND_BASE, METOKEN_FACTORY_BASE } from '@/lib/contracts/metokens/deployments';
import {
  getVerifiedTransactionReceipt,
  getVerifiedTransaction,
  TransactionVerificationError,
} from "@/lib/chain/verifyTransactionReceipt";

const DIAMOND_ADDRESS = METOKEN_DIAMOND_BASE;
const METOKEN_FACTORY = METOKEN_FACTORY_BASE;

const transferAbi = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

const meTokenCreatedAbi = parseAbi([
  "event MeTokenCreated(address indexed meToken, address indexed owner, string name, string symbol)",
]);

const CREDIT_TYPES = new Set([
  "mint",
  "buy",
  "subscribe",
  "contribute",
  "create",
]);

const DEBIT_TYPES = new Set(["burn", "sell", "unsubscribe", "transfer"]);

export interface VerifyMeTokenTransactionParams {
  meTokenAddress: string;
  userAddress: string;
  transactionHash: string;
  transactionType: string;
  claimedAmount?: number | string;
}

export interface VerifiedMeTokenTransaction {
  transactionHash: string;
  blockNumber: bigint;
  amount: number;
  userAddress: string;
  meTokenAddress: string;
  transactionType: string;
}

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

function parseTransferAmount(value: bigint): number {
  return parseFloat(formatEther(value));
}

/**
 * Verify a Base-chain MeToken-related transaction involves the user and MeToken.
 */
export async function verifyMeTokenTransaction(
  params: VerifyMeTokenTransactionParams,
): Promise<VerifiedMeTokenTransaction> {
  const meTokenAddress = normalizeAddress(params.meTokenAddress);
  const userAddress = normalizeAddress(params.userAddress);
  const transactionType = params.transactionType;

  if (!/^0x[a-f0-9]{40}$/.test(meTokenAddress) || !/^0x[a-f0-9]{40}$/.test(userAddress)) {
    throw new TransactionVerificationError("Invalid address format");
  }

  const { receipt, blockNumber } = await getVerifiedTransactionReceipt(
    params.transactionHash,
    { maxAgeSeconds: 60 * 60 * 24 * 7 },
  );

  const tx = await getVerifiedTransaction(params.transactionHash);

  const involvedAddresses = new Set(
    receipt.logs.map((log) => log.address.toLowerCase()),
  );
  const touchesMeToken =
    involvedAddresses.has(meTokenAddress) ||
    tx.to?.toLowerCase() === DIAMOND_ADDRESS.toLowerCase() ||
    tx.to?.toLowerCase() === METOKEN_FACTORY.toLowerCase();

  if (!touchesMeToken) {
    throw new TransactionVerificationError(
      "Transaction does not involve the specified MeToken",
    );
  }

  if (transactionType === "create") {
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== METOKEN_FACTORY.toLowerCase()) {
        continue;
      }
      try {
        const decoded = decodeEventLog({
          abi: meTokenCreatedAbi,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName !== "MeTokenCreated") {
          continue;
        }
        const args = decoded.args as { meToken: string; owner: string };
        if (args.meToken.toLowerCase() !== meTokenAddress) {
          throw new TransactionVerificationError("MeToken address mismatch in creation tx");
        }
        if (args.owner.toLowerCase() !== userAddress) {
          throw new TransactionVerificationError(
            "Transaction creator does not match authenticated address",
          );
        }
        return {
          transactionHash: params.transactionHash.toLowerCase(),
          blockNumber,
          amount: params.claimedAmount != null ? Number(params.claimedAmount) : 0,
          userAddress,
          meTokenAddress,
          transactionType,
        };
      } catch (err) {
        if (err instanceof TransactionVerificationError) {
          throw err;
        }
      }
    }
    throw new TransactionVerificationError("No MeToken creation event found in transaction");
  }

  const transfers: { from: string; to: string; value: bigint }[] = [];
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== meTokenAddress) {
      continue;
    }
    try {
      const decoded = decodeEventLog({
        abi: transferAbi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName !== "Transfer") {
        continue;
      }
      const args = decoded.args as { from: string; to: string; value: bigint };
      transfers.push({
        from: args.from.toLowerCase(),
        to: args.to.toLowerCase(),
        value: args.value,
      });
    } catch {
      // Not a Transfer log.
    }
  }

  if (transfers.length === 0) {
    throw new TransactionVerificationError(
      "No MeToken Transfer events found in transaction",
    );
  }

  let matchedAmount: bigint | null = null;

  if (CREDIT_TYPES.has(transactionType)) {
    const credit = transfers.find((t) => t.to === userAddress);
    if (!credit) {
      throw new TransactionVerificationError(
        "User did not receive MeTokens in this transaction",
      );
    }
    matchedAmount = credit.value;
  } else if (DEBIT_TYPES.has(transactionType)) {
    const debit = transfers.find((t) => t.from === userAddress);
    if (!debit) {
      throw new TransactionVerificationError(
        "User did not send MeTokens in this transaction",
      );
    }
    matchedAmount = debit.value;
  } else {
    throw new TransactionVerificationError(`Unsupported transaction_type: ${transactionType}`);
  }

  const verifiedAmount = parseTransferAmount(matchedAmount);
  if (params.claimedAmount != null) {
    const claimed = Number(params.claimedAmount);
    if (!Number.isFinite(claimed) || claimed < 0) {
      throw new TransactionVerificationError("Invalid claimed amount");
    }
    const tolerance = Math.max(claimed * 0.01, 1e-9);
    if (Math.abs(verifiedAmount - claimed) > tolerance) {
      throw new TransactionVerificationError("Claimed amount does not match on-chain transfer");
    }
  }

  return {
    transactionHash: params.transactionHash.toLowerCase(),
    blockNumber,
    amount: verifiedAmount,
    userAddress,
    meTokenAddress,
    transactionType,
  };
}
