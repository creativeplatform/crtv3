import type { Hash, Transaction, TransactionReceipt } from "viem";
import { publicClient } from "@/lib/viem";
import { serverLogger } from "@/lib/utils/logger";

export class TransactionVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransactionVerificationError";
  }
}

export interface VerifiedReceipt {
  receipt: TransactionReceipt;
  blockNumber: bigint;
}

export interface VerifyReceiptOptions {
  /** Reject receipts older than this many seconds (by block timestamp). */
  maxAgeSeconds?: number;
}

function wrapRpcError(context: string, err: unknown): TransactionVerificationError {
  serverLogger.warn(`[verifyTransactionReceipt] ${context}:`, err);
  return new TransactionVerificationError("Unable to verify transaction on-chain");
}

/**
 * Fetch a successful on-chain transaction receipt on Base.
 */
export async function getVerifiedTransactionReceipt(
  transactionHash: string,
  options: VerifyReceiptOptions = {},
): Promise<VerifiedReceipt> {
  const hash = transactionHash.trim().toLowerCase() as Hash;
  if (!/^0x[a-f0-9]{64}$/.test(hash)) {
    throw new TransactionVerificationError("Invalid transaction hash format");
  }

  let receipt: TransactionReceipt | null;
  try {
    receipt = await publicClient.getTransactionReceipt({ hash });
  } catch (err) {
    throw wrapRpcError("getTransactionReceipt failed", err);
  }

  if (!receipt) {
    throw new TransactionVerificationError("Transaction not found");
  }
  if (receipt.status !== "success") {
    throw new TransactionVerificationError("Transaction did not succeed");
  }

  if (options.maxAgeSeconds != null && options.maxAgeSeconds > 0) {
    try {
      const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });
      const ageSec = Math.floor(Date.now() / 1000) - Number(block.timestamp);
      if (ageSec > options.maxAgeSeconds) {
        throw new TransactionVerificationError("Transaction is too old");
      }
    } catch (err) {
      if (err instanceof TransactionVerificationError) {
        throw err;
      }
      throw wrapRpcError("getBlock failed", err);
    }
  }

  return { receipt, blockNumber: receipt.blockNumber };
}

/**
 * Fetch the original transaction (for `to` / input inspection).
 */
export async function getVerifiedTransaction(transactionHash: string): Promise<Transaction> {
  const hash = transactionHash.trim().toLowerCase() as Hash;
  if (!/^0x[a-f0-9]{64}$/.test(hash)) {
    throw new TransactionVerificationError("Invalid transaction hash format");
  }

  try {
    const tx = await publicClient.getTransaction({ hash });
    if (!tx) {
      throw new TransactionVerificationError("Transaction not found");
    }
    return tx;
  } catch (err) {
    if (err instanceof TransactionVerificationError) {
      throw err;
    }
    throw wrapRpcError("getTransaction failed", err);
  }
}
