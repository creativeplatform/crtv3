"use client";

import { useState } from "react";
import {
  useSmartAccountClient,
} from "@account-kit/react";
import { toast } from "sonner";
import { logger } from '@/lib/utils/logger';
import { appendBuilderCode } from "@/lib/utils/builder-code";


export type Transaction = {
  target: string; // Ethereum address (0x-prefixed)
  value: string; // Amount in ETH as string
  data: string; // Hex data (with or without 0x prefix)
};

/**
 * Custom hook for managing and sending batch transactions
 */
export function useBatchTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isSendingUserOperation, setIsSendingUserOperation] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Get smart account client
  const { client, address, isLoadingClient } = useSmartAccountClient({});

  // Add a transaction to the batch
  const addTransaction = (transaction: Transaction) => {
    setTransactions((prev) => [...prev, transaction]);
    toast.success("Transaction added to batch");
  };

  // Remove a transaction from the batch
  const removeTransaction = (index: number) => {
    setTransactions((prev) => prev.filter((_, i) => i !== index));
    toast.success("Transaction removed from batch");
  };

  // Clear all transactions
  const clearTransactions = () => {
    setTransactions([]);
    toast.success("All transactions cleared");
  };

  // Send all transactions in a batch
  const sendBatchTransactions = async () => {
    if (transactions.length === 0) {
      toast.error("No transactions to send");
      return;
    }

    if (!client) {
      toast.error("Smart account client not initialized");
      return;
    }

    setIsSendingUserOperation(true);
    setError(null);

    try {
      // Convert transactions to the format expected by sendUserOperation
      const userOperationTransactions = transactions.map((tx) => ({
        target: tx.target as `0x${string}`,
        value: tx.value ? BigInt(Math.floor(parseFloat(tx.value) * 10 ** 18)) : BigInt(0),
        data: appendBuilderCode(
          tx.data && tx.data.startsWith("0x")
            ? (tx.data as `0x${string}`)
            : ("0x" + (tx.data || "")) as `0x${string}`
        ),
      }));

      // Send the batch transaction
      const operation = await client.sendUserOperation({
        uo: userOperationTransactions,
      });

      // Wait for the transaction to be mined
      await client.waitForUserOperationTransaction({
        hash: operation.hash,
      });

      toast.success("Batch transactions sent successfully!");
      // Clear transactions after successful execution
      setTransactions([]);
    } catch (err) {
      logger.error("Error sending batch transactions:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to send batch transactions";
      toast.error(errorMessage);
      setError(err instanceof Error ? err : new Error(errorMessage));
    } finally {
      setIsSendingUserOperation(false);
    }
  };

  return {
    transactions,
    addTransaction,
    removeTransaction,
    clearTransactions,
    sendBatchTransactions,
    isLoadingClient,
    isSendingUserOperation,
    error,
    smartAccountAddress: address,
  };
}
