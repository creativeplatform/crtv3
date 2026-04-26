/**
 * @file SendTransaction.tsx
 * @description Enhanced send component supporting ETH, USDC, and DAI transfers
 * 
 * This component enables users to send tokens with their modular smart account using AccountKit.
 * It supports ETH transfers and ERC-20 tokens (USDC, DAI) with proper encoding.
 * 
 * Key features:
 * - Send ETH, USDC, or DAI to any address
 * - Token selection dropdown
 * - Balance display for each token
 * - Automatic calldata encoding for ERC-20 transfers
 * - Uses ERC-4337 User Operations for transaction processing
 * - Full transaction status tracking and error handling
 * 
 * Usage:
 * ```tsx
 * <SendTransaction />
 * ```
 * 
 * @dev Uses encodeFunctionData for ERC-20 transfers
 * @dev Validates recipient address and transaction parameters before submission
 * @dev Provides real-time user feedback through toast notifications
 * @dev Requires a connected wallet to function
 */

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSmartAccountClient } from "@account-kit/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Send, CheckCircle, XCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { type Address, type Hex, encodeFunctionData, parseAbi, parseUnits, formatUnits, erc20Abi } from "viem";
import { USDC_TOKEN_ADDRESSES, USDC_TOKEN_DECIMALS } from "@/lib/contracts/USDCToken";
import { DAI_TOKEN_ADDRESSES, DAI_TOKEN_DECIMALS } from "@/lib/contracts/DAIToken";
import { logger } from '@/lib/utils/logger';
import { appendBuilderCode } from "@/lib/utils/builder-code";


// Token configuration
type TokenSymbol = 'ETH' | 'USDC' | 'DAI';

const TOKEN_INFO = {
  ETH: { 
    decimals: 18, 
    symbol: "ETH",
    address: null, // Native token
  },
  USDC: { 
    decimals: USDC_TOKEN_DECIMALS, 
    symbol: "USDC",
    address: USDC_TOKEN_ADDRESSES.base,
  },
  DAI: { 
    decimals: DAI_TOKEN_DECIMALS, 
    symbol: "DAI",
    address: DAI_TOKEN_ADDRESSES.base,
  },
} as const;

/**
 * Component for sending tokens using Account Kit smart account
 */
export default function SendTransaction() {
  const [selectedToken, setSelectedToken] = useState<TokenSymbol>('ETH');
  const [recipient, setRecipient] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSendingUserOperation, setIsSendingUserOperation] = useState<boolean>(false);
  
  const [balances, setBalances] = useState<Record<TokenSymbol, string>>({
    ETH: '0',
    USDC: '0',
    DAI: '0',
  });

  const { address, client } = useSmartAccountClient({});

  // Fetch token balances
  const fetchBalances = useCallback(async () => {
    if (!address || !client) return;

    try {
      logger.debug('Fetching balances for address:', address);
      
      // Get ETH balance
      const ethBalance = await client.getBalance({
        address: address as Address,
      });
      
      // Get USDC balance
      const usdcBalance = await client.readContract({
        address: USDC_TOKEN_ADDRESSES.base as Address,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address as Address],
      }) as bigint;
      
      // Get DAI balance
      const daiBalance = await client.readContract({
        address: DAI_TOKEN_ADDRESSES.base as Address,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address as Address],
      }) as bigint;

      const newBalances: Record<TokenSymbol, string> = {
        ETH: formatUnits(ethBalance, 18),
        USDC: formatUnits(usdcBalance, USDC_TOKEN_DECIMALS),
        DAI: formatUnits(daiBalance, DAI_TOKEN_DECIMALS),
      };

      logger.debug('Fetched balances:', newBalances);
      setBalances(newBalances);
      
    } catch (error) {
      logger.error('Error fetching balances:', error);
    }
  }, [address, client]);

  // Fetch balances on mount and when address changes
  useEffect(() => {
    fetchBalances();
  }, [address, client, fetchBalances]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setTransactionHash(null);

    if (!recipient) {
      const errorMsg = "Please enter a recipient address";
      toast.error(errorMsg);
      setError(errorMsg);
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      const errorMsg = "Please enter a valid amount";
      toast.error(errorMsg);
      setError(errorMsg);
      return;
    }

    // Check balance
    const availableBalance = parseFloat(balances[selectedToken]);
    const requestedAmount = parseFloat(amount);
    
    if (requestedAmount > availableBalance) {
      const errorMsg = `Insufficient balance. You have ${availableBalance} ${selectedToken}, but trying to send ${requestedAmount} ${selectedToken}`;
      toast.error(errorMsg);
      setError(errorMsg);
      return;
    }

    setIsSendingUserOperation(true);
    try {
      const tokenInfo = TOKEN_INFO[selectedToken];
      
      let operation;
      
      if (selectedToken === 'ETH') {
        // Send native ETH
        const valueInWei = parseUnits(amount, tokenInfo.decimals);

        operation = await client!.sendUserOperation({
          uo: {
            target: recipient as Address,
            data: appendBuilderCode("0x" as Hex),
            value: valueInWei,
          },
        });
      } else {
        // Send ERC-20 token (USDC or DAI)
        const tokenAmount = parseUnits(amount, tokenInfo.decimals);
        
        // Encode the transfer calldata
        const transferCalldata = encodeFunctionData({
          abi: parseAbi(["function transfer(address,uint256) returns (bool)"]),
          functionName: "transfer",
          args: [recipient as Address, tokenAmount],
        });

        logger.debug('Sending ERC-20 transfer:', {
          token: selectedToken,
          tokenAddress: tokenInfo.address,
          recipient,
          amount: tokenAmount.toString(),
        });

        operation = await client!.sendUserOperation({
          uo: {
            target: tokenInfo.address as Address,
            data: appendBuilderCode(transferCalldata as Hex),
            value: BigInt(0), // No native value for ERC-20 transfers
          },
        });
      }

      // Wait for transaction to be mined
      const txHash = await client!.waitForUserOperationTransaction({
        hash: operation.hash,
      });

      // Success handling
      toast.success("Transaction sent successfully!");
      logger.debug("Transaction hash:", txHash);
      setTransactionHash(txHash);
      setRecipient("");
      setAmount("");
      // Refresh balances
      fetchBalances();
    } catch (error) {
      logger.error("Error preparing transaction:", error);
      const errorMsg = `Error preparing transaction: ${error instanceof Error ? error.message : 'Unknown error'}`;
      toast.error(errorMsg);
      setError(errorMsg);
    } finally {
      setIsSendingUserOperation(false);
    }
  };

  const handleMaxAmount = () => {
    const balance = balances[selectedToken];
    if (parseFloat(balance) > 0) {
      // For ETH, leave a small buffer for gas
      if (selectedToken === 'ETH') {
        const bufferAmount = parseFloat(balance) - 0.001; // Leave 0.001 ETH for gas
        setAmount(bufferAmount > 0 ? bufferAmount.toFixed(6) : '0');
      } else {
        setAmount(balance);
      }
    }
  };

  if (!address || !client) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send Tokens
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Connecting wallet...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          Send Tokens
        </CardTitle>
        <CardDescription>
          Send ETH, USDC, or DAI to any wallet address
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && !transactionHash && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {transactionHash && (
          <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="flex items-center gap-2">
              <span className="text-green-800 dark:text-green-200">Transfer completed successfully!</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`https://basescan.org/tx/${transactionHash}`, '_blank')}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                View on BaseScan
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Smart Account Address */}
        <div className="p-3 bg-muted rounded-lg">
          <p className="text-xs text-muted-foreground mb-1">From Account</p>
          <p className="text-sm font-mono break-all">{address}</p>
        </div>

        {/* Token Selection */}
        <div className="space-y-2">
          <Label htmlFor="token">Token</Label>
          <Select value={selectedToken} onValueChange={(value) => setSelectedToken(value as TokenSymbol)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ETH">ETH</SelectItem>
              <SelectItem value="USDC">USDC</SelectItem>
              <SelectItem value="DAI">DAI</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Balance: {parseFloat(balances[selectedToken]).toFixed(6)} {selectedToken}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleMaxAmount}
              className="h-5 px-2 text-xs"
              disabled={isSendingUserOperation}
            >
              MAX
            </Button>
          </div>
        </div>

        {/* Recipient Address */}
        <div className="space-y-2">
          <Label htmlFor="recipient">Recipient Address</Label>
          <Input
            id="recipient"
            placeholder="0x..."
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            disabled={isSendingUserOperation}
          />
        </div>

        {/* Amount */}
        <div className="space-y-2">
          <Label htmlFor="amount">Amount ({selectedToken})</Label>
          <Input
            id="amount"
            type="number"
            step="any"
            min="0"
            placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={isSendingUserOperation}
          />
        </div>

        {/* Send Button */}
        <Button
          onClick={handleSend}
          className="w-full"
          disabled={isSendingUserOperation || !recipient || !amount}
        >
          {isSendingUserOperation ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending {selectedToken}...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Send {selectedToken}
            </>
          )}
        </Button>

        {/* Info */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Supported tokens on Base: ETH, USDC, DAI</p>
          <p>• Transactions are powered by Alchemy Smart Wallets</p>
          {selectedToken === 'ETH' && (
            <p>• A small amount of ETH will be reserved for gas fees</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
