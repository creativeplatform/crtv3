"use client";

/**
 * SmartAccountActions Component
 * 
 * This component provides a UI for interacting with ERC-4337 compliant smart contract accounts 
 * using Account Kit (https://accountkit.alchemy.com/).
 * 
 * Features:
 * - Send transactions from the smart account
 * - Sign messages using EIP-191 personal_sign format
 * - Sign typed data following the EIP-712 standard for structured data
 * 
 * Architecture:
 * - Main component that manages smart account connection state
 * - Three tab components for different actions (sending transactions, signing messages, and signing typed data)
 * - Uses Account Kit React hooks for smart account interactions
 * 
 * Dependencies:
 * - @account-kit/react: Provides hooks for smart account interactions
 * - useWalletStatus: Custom hook that manages wallet connection and smart account status
 * - UI components from shadcn/ui library (Button, Input, Label, Tabs)
 * - toast from sonner for notifications
 * 
 * Usage Notes:
 * - User must connect their wallet first to use this component
 * - Transactions are sent as ERC-4337 UserOperations (account abstraction)
 * - Message signing uses EIP-191 personal_sign
 * - Typed data signing follows EIP-712 standard
 * 
 * For more information on smart account standards:
 * - ERC-4337: https://eips.ethereum.org/EIPS/eip-4337
 * - EIP-191: https://eips.ethereum.org/EIPS/eip-191
 * - EIP-712: https://eips.ethereum.org/EIPS/eip-712
 */

import React, { useState, useEffect } from "react";
import {
  useSendUserOperation,
  useSignMessage,
  useSignTypedData,
} from "@account-kit/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useWalletStatus } from "@/lib/hooks/accountkit/useWalletStatus";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { logger } from '@/lib/utils/logger';
import { appendBuilderCode } from "@/lib/utils/builder-code";


/**
 * Component showcasing different Account Kit actions
 */
export default function SmartAccountActions() {
  const [address, setAddress] = useState<string | null>(null);

  // Get wallet status using our new hook
  const {
    smartAccountClient: client,
    isLoadingClient,
    isConnected,
    smartAccountAddress
  } = useWalletStatus();

  // Update address when smart account address changes
  useEffect(() => {
    setAddress(smartAccountAddress);
  }, [smartAccountAddress]);

  // Loading state
  if (isLoadingClient) {
    return <div className="p-4 text-center">Loading smart account...</div>;
  }

  // Not connected state
  if (!isConnected || !client || !address) {
    return (
      <div className="p-4 text-center">
        Please connect your wallet to use this feature
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Smart Account Actions</h2>

      <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
        <p className="text-sm">
          Smart Account:{" "}
          <span className="font-mono text-xs break-all">{address}</span>
        </p>
      </div>

      <Tabs defaultValue="send" className="w-full">
        <TabsList className="grid grid-cols-3 mb-4">
          <TabsTrigger value="send">Send Transaction</TabsTrigger>
          <TabsTrigger value="sign">Sign Message</TabsTrigger>
          <TabsTrigger value="typed">Sign Typed Data</TabsTrigger>
        </TabsList>

        <TabsContent value="send">
          <SendTransactionTab client={client} />
        </TabsContent>

        <TabsContent value="sign">
          <SignMessageTab client={client} />
        </TabsContent>

        <TabsContent value="typed">
          <SignTypedDataTab client={client} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * Tab component for sending transactions
 */
function SendTransactionTab({ client }: { client: any }) {
  const [recipient, setRecipient] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [data, setData] = useState<string>("0x");
  const [isPending, setIsPending] = useState<boolean>(false);

  // Set up the hook for sending user operations
  const { sendUserOperation, isSendingUserOperation, error } =
    useSendUserOperation({
      client,
      waitForTxn: true, // Wait for the transaction to be mined
      onSuccess: ({ hash, request }) => {
        toast.success("Transaction sent successfully!");
        logger.debug("Transaction hash:", hash);
        logger.debug("Request:", request);
        setRecipient("");
        setAmount("");
        setData("0x");
        setIsPending(false);
      },
      onError: (error) => {
        toast.error(`Transaction failed: ${error.message}`);
        logger.error("Transaction error:", error);
        setIsPending(false);
      },
    });

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!recipient) {
      toast.error("Please enter a recipient address");
      return;
    }

    // Ensure recipient address starts with 0x
    if (!recipient.startsWith("0x")) {
      toast.error("Recipient address must start with 0x");
      return;
    }

    if (!amount && !data) {
      toast.error("Please enter an amount or transaction data");
      return;
    }

    // Ensure data starts with 0x
    const formattedData = data.startsWith("0x") ? data : "0x";
    if (data && !data.startsWith("0x")) {
      toast.error("Transaction data must start with 0x");
      return;
    }

    try {
      // Convert amount to BigInt (in wei)
      const valueInWei = amount
        ? BigInt(Math.floor(parseFloat(amount) * 10 ** 18))
        : BigInt(0);

      // Ensure recipient is in the correct format (0x prefixed)
      const formattedRecipient = recipient as `0x${string}`;

      // Set the pending state
      setIsPending(true);

      // Send the transaction
      sendUserOperation({
        uo: {
          target: formattedRecipient,
          data: appendBuilderCode(formattedData as `0x${string}`),
          value: valueInWei,
        },
      });
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
      setIsPending(false);
    }
  };

  return (
    <form onSubmit={handleSend} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="recipient">Recipient Address</Label>
        <Input
          id="recipient"
          placeholder="0x..."
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="amount">Amount (ETH)</Label>
        <Input
          id="amount"
          type="number"
          step="0.000001"
          min="0"
          placeholder="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="data">Data (Optional)</Label>
        <Input
          id="data"
          placeholder="0x..."
          value={data}
          onChange={(e) => setData(e.target.value)}
        />
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={isSendingUserOperation || isPending}
      >
        {isSendingUserOperation || isPending
          ? "Sending..."
          : "Send Transaction"}
      </Button>

      {error && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-md">
          <p className="text-sm font-medium">Error:</p>
          <p className="text-xs font-mono mt-1">{error.message}</p>
        </div>
      )}
    </form>
  );
}

/**
 * Tab component for signing messages
 */
function SignMessageTab({ client }: { client: any }) {
  const [message, setMessage] = useState<string>("");
  const [signedMessage, setSignedMessageResult] = useState<string | null>(null);

  // Use the sign message hook
  const { signMessage, isSigningMessage, error } = useSignMessage({
    client,
    onSuccess: (result) => {
      toast.success("Message signed successfully!");
      setSignedMessageResult(result);
    },
    onError: (error) => {
      toast.error(`Error signing message: ${error.message}`);
    },
  });

  const handleSign = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!message) {
      toast.error("Please enter a message to sign");
      return;
    }

    try {
      await signMessage({ message });
    } catch (error) {
      logger.error("Error signing message:", error);
    }
  };

  return (
    <form onSubmit={handleSign} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="message">Message</Label>
        <Input
          id="message"
          placeholder="Enter a message to sign..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <p className="text-xs text-gray-500">
          This will sign a message using EIP-191 personal_sign format
        </p>
      </div>

      <Button type="submit" className="w-full" disabled={isSigningMessage}>
        {isSigningMessage ? "Signing..." : "Sign Message"}
      </Button>

      {signedMessage && (
        <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-md">
          <p className="text-sm font-medium">Signed Message:</p>
          <p className="text-xs font-mono mt-1 break-all">{signedMessage}</p>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-md">
          <p className="text-sm font-medium">Error:</p>
          <p className="text-xs font-mono mt-1">{error.message}</p>
        </div>
      )}
    </form>
  );
}

/**
 * Tab component for signing typed data
 */
function SignTypedDataTab({ client }: { client: any }) {
  const [signedData, setSignedData] = useState<string | null>(null);

  // Example typed data following EIP-712 standard
  // EIP-712 is important for smart accounts as it allows for structured data signing
  // with domain separation, preventing signature replay attacks across different chains or contracts
  const typedData = {
    domain: {
      name: "Creative TV",
      version: "1",
      chainId: 84532, // Base Sepolia
      verifyingContract:
        "0x00000000000017c61b5bEe81050EC8eFc9c6fecd" as `0x${string}`, // ModularAccount factory on Base Sepolia
    },
    types: {
      Person: [
        { name: "name", type: "string" },
        { name: "wallet", type: "address" },
      ],
      Mail: [
        { name: "from", type: "Person" },
        { name: "to", type: "Person" },
        { name: "contents", type: "string" },
      ],
    },
    primaryType: "Mail",
    message: {
      from: {
        name: "Alice",
        wallet: "0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826" as `0x${string}`,
      },
      to: {
        name: "Bob",
        wallet: "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB" as `0x${string}`,
      },
      contents: "Hello, Bob!",
    },
  };

  // Use the sign typed data hook
  const { signTypedData, isSigningTypedData, error } = useSignTypedData({
    client,
    onSuccess: (result) => {
      toast.success("Typed data signed successfully!");
      setSignedData(result);
    },
    onError: (error) => {
      toast.error(`Signing failed: ${error.message}`);
      logger.error("Signing error:", error);
    },
  });

  const handleSignTypedData = async () => {
    try {
      signTypedData({ typedData });
    } catch (error) {
      logger.error("Error signing typed data:", error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Typed Data (EIP-712)</Label>
        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
          <pre className="text-xs overflow-auto max-h-60">
            {JSON.stringify(typedData, null, 2)}
          </pre>
        </div>
        <p className="text-xs text-gray-500">
          This will sign structured data following the EIP-712 standard
        </p>
      </div>

      <Button
        onClick={handleSignTypedData}
        className="w-full"
        disabled={isSigningTypedData}
      >
        {isSigningTypedData ? "Signing..." : "Sign Typed Data"}
      </Button>

      {signedData && (
        <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-md">
          <p className="text-sm font-medium">Signed Data:</p>
          <p className="text-xs font-mono break-all">{signedData}</p>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-md">
          <p className="text-sm font-medium">Error:</p>
          <p className="text-xs">{error.message}</p>
        </div>
      )}
    </div>
  );
}
