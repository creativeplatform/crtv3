"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle, ExternalLink, Info } from 'lucide-react';
import { formatEther, parseEther, encodeFunctionData, maxUint256 } from 'viem';
import { useSmartAccountClient, useChain } from '@account-kit/react';
import { useToast } from '@/components/ui/use-toast';
import { DaiFundingOptions } from '@/components/wallet/funding/DaiFundingOptions';
import { logger } from '@/lib/utils/logger';
import { appendBuilderCode } from "@/lib/utils/builder-code";

// Contract addresses and ABIs
const METOKEN_CONTRACTS = {
  DIAMOND: '0xba5502db2aC2cBff189965e991C07109B14eB3f5',
  DAI: '0x50c5725949a6f0c72e6c4a641f24049a917db0cb',
} as const;

const DIAMOND_ABI = [
  {
    "inputs": [
      {"internalType": "string", "name": "name", "type": "string"},
      {"internalType": "string", "name": "symbol", "type": "string"},
      {"internalType": "uint256", "name": "hubId", "type": "uint256"},
      {"internalType": "uint256", "name": "assetsDeposited", "type": "uint256"}
    ],
    "name": "subscribe",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

const ERC20_ABI = [
  {
    "inputs": [
      {"internalType": "address", "name": "owner", "type": "address"},
      {"internalType": "address", "name": "spender", "type": "address"}
    ],
    "name": "allowance",
    "outputs": [
      {"internalType": "uint256", "name": "", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "spender", "type": "address"},
      {"internalType": "uint256", "name": "amount", "type": "uint256"}
    ],
    "name": "approve",
    "outputs": [
      {"internalType": "bool", "name": "", "type": "bool"}
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "account", "type": "address"}
    ],
    "name": "balanceOf",
    "outputs": [
      {"internalType": "uint256", "name": "", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

interface AlchemyMeTokenCreatorProps {
  onMeTokenCreated?: (meTokenAddress: string, transactionHash: string) => void;
}

export function AlchemyMeTokenCreator({ onMeTokenCreated }: AlchemyMeTokenCreatorProps) {
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [hubId, setHubId] = useState('1');
  const [assetsDeposited, setAssetsDeposited] = useState('');
  const [daiBalance, setDaiBalance] = useState<bigint>(BigInt(0));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [meTokenAddress, setMeTokenAddress] = useState<string | null>(null);

  const { client } = useSmartAccountClient({});
  const { chain } = useChain();
  const { toast } = useToast();

  // Check DAI balance
  const checkDaiBalance = useCallback(async () => {
    if (!client?.account?.address) return;
    
    try {
      const balance = await client.readContract({
        address: METOKEN_CONTRACTS.DAI,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [client.account.address],
      }) as bigint;
      
      setDaiBalance(balance);
    } catch (err) {
      logger.error('Failed to check DAI balance:', err);
      setDaiBalance(BigInt(0));
    }
  }, [client]);

  // Create MeToken using Alchemy SDK approach
  const createMeToken = async () => {
    if (!client?.account?.address) {
      setError('Please connect your wallet first');
      return;
    }

    if (!name.trim() || !symbol.trim() || !assetsDeposited || parseFloat(assetsDeposited) <= 0) {
      setError('Please fill in all required fields with valid values');
      return;
    }

    const depositAmount = parseEther(assetsDeposited);
    const hasEnoughDai = daiBalance >= depositAmount;

    if (!hasEnoughDai) {
      setError(`Insufficient DAI balance. Required: ${assetsDeposited} DAI, Available: ${formatEther(daiBalance)} DAI`);
      return;
    }

    setIsCreating(true);
    setError(null);
    setSuccess(null);

    try {
      logger.debug('🚀 Creating MeToken with Alchemy SDK approach...');

      // Step 1: Check current DAI allowance
      setSuccess('Checking DAI allowance...');
      const currentAllowance = await client.readContract({
        address: METOKEN_CONTRACTS.DAI,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [client.account.address, METOKEN_CONTRACTS.DIAMOND],
      }) as bigint;

      logger.debug('📊 Current DAI allowance:', {
        current: currentAllowance.toString(),
        required: depositAmount.toString(),
        hasEnough: currentAllowance >= depositAmount,
        smartAccount: client.account.address,
        diamondSpender: METOKEN_CONTRACTS.DIAMOND
      });

      // Step 2: Approve DAI first
      logger.debug('🔓 Approving DAI for MeToken creation...');
      setSuccess('Approving DAI...');
      
      const approveOperation = await client.sendUserOperation({
        uo: {
          target: METOKEN_CONTRACTS.DAI,
          data: appendBuilderCode(encodeFunctionData({
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [METOKEN_CONTRACTS.DIAMOND, depositAmount],
          })),
          value: BigInt(0),
        },
      });
      
      logger.debug('⏳ Waiting for approval confirmation...');
      const approveTxHash = await client.waitForUserOperationTransaction({ 
        hash: approveOperation.hash 
      });
      
      logger.debug('✅ DAI approval confirmed:', approveTxHash);
      setSuccess('Approval confirmed! Creating MeToken...');
      
      // Wait a moment for state to settle
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Step 3: Create MeToken
      logger.debug('🪙 Creating MeToken...');
      setSuccess('Creating MeToken...');
      setIsConfirming(true);
      
      const createOperation = await client.sendUserOperation({
        uo: {
          target: METOKEN_CONTRACTS.DIAMOND,
          data: appendBuilderCode(encodeFunctionData({
            abi: DIAMOND_ABI,
            functionName: 'subscribe',
            args: [name, symbol, BigInt(hubId), depositAmount],
          })),
          value: BigInt(0),
        },
      });
      
      logger.debug('⏳ Waiting for MeToken creation confirmation...');
      const txHash = await client.waitForUserOperationTransaction({ 
        hash: createOperation.hash 
      });
      
      logger.debug('✅ MeToken creation completed:', txHash);
      setTransactionHash(txHash);
      setIsConfirming(false);
      setIsConfirmed(true);
      setSuccess('MeToken created successfully!');

      // Step 4: Extract MeToken address from transaction logs
      // Note: In a real implementation, you would parse the transaction logs
      // For now, we'll simulate this process
      const extractedMeTokenAddress = await extractMeTokenAddress(txHash);
      if (extractedMeTokenAddress) {
        setMeTokenAddress(extractedMeTokenAddress);
      }

      // Step 5: Store MeToken in Supabase
      await storeMeTokenInSupabase({
        name,
        symbol,
        hubId: parseInt(hubId),
        assetsDeposited,
        creatorAddress: client.account.address,
        transactionHash: txHash,
        meTokenAddress: extractedMeTokenAddress,
      });

      // Step 6: Show success message and call callback
      toast({
        title: "MeToken Created Successfully!",
        description: `Your MeToken "${name}" (${symbol}) has been created and is ready for trading.`,
      });

      onMeTokenCreated?.(extractedMeTokenAddress || '', txHash);

      // Reset form
      setName('');
      setSymbol('');
      setAssetsDeposited('');
      setHubId('1');

    } catch (err) {
      logger.error(' MeToken creation failed:', err);
      
      // Handle different error types
      if (err instanceof Error) {
        // Check for abort errors
        if (err.message.includes('aborted') || err.message.includes('abort')) {
          setError('Transaction was cancelled. Please try again.');
        } else if (err.message.includes('rejected') || err.message.includes('denied')) {
          setError('Transaction was rejected. Please approve the transaction to continue.');
        } else if (err.message.includes('insufficient')) {
          setError('Insufficient balance. Please check your DAI balance.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to create MeToken. Please try again.');
      }
      
      setIsConfirming(false);
      setIsConfirmed(false);
    } finally {
      setIsCreating(false);
    }
  };

  // Extract MeToken address from transaction logs
  const extractMeTokenAddress = async (txHash: string): Promise<string | null> => {
    try {
      // In a real implementation, you would:
      // 1. Get the transaction receipt
      // 2. Parse the logs to find the Subscribe event
      // 3. Extract the MeToken address from the event data
      
      logger.debug('🔍 Extracting MeToken address from transaction:', txHash);
      
      // For demonstration, we'll return a placeholder
      // In production, implement proper log parsing
      return null;
    } catch (error) {
      logger.error('Failed to extract MeToken address:', error);
      return null;
    }
  };

  // Store MeToken in Supabase
  const storeMeTokenInSupabase = async (data: {
    name: string;
    symbol: string;
    hubId: number;
    assetsDeposited: string;
    creatorAddress: string;
    transactionHash: string;
    meTokenAddress: string | null;
  }) => {
    try {
      logger.debug('💾 Storing MeToken in Supabase...');
      
      const response = await fetch('/api/metokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: data.name,
          symbol: data.symbol,
          hubId: data.hubId,
          assetsDeposited: data.assetsDeposited,
          creatorAddress: data.creatorAddress,
          transactionHash: data.transactionHash,
          meTokenAddress: data.meTokenAddress,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to store MeToken in database');
      }

      logger.debug('✅ MeToken stored in Supabase successfully');
    } catch (error) {
      logger.error('Failed to store MeToken in Supabase:', error);
      // Don't throw here - the MeToken was created successfully on-chain
    }
  };

  // Check DAI balance on mount and when client changes
  useEffect(() => {
    checkDaiBalance();
  }, [checkDaiBalance]);

  const isLoading = isCreating || isConfirming;
  const hasEnoughDai = daiBalance >= parseEther(assetsDeposited || '0');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>Create MeToken with Alchemy SDK</span>
          {isConfirmed && <CheckCircle className="h-5 w-5 text-green-500" />}
        </CardTitle>
        <CardDescription>
          Create a new MeToken using the Alchemy SDK and Diamond contract. This will subscribe your token to a hub and enable trading.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {isConfirmed && transactionHash && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p>MeToken created successfully!</p>
                <div className="flex items-center gap-2">
                  <span>Transaction:</span>
                  <a
                    href={`https://basescan.org/tx/${transactionHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
                  >
                    {transactionHash.slice(0, 10)}...{transactionHash.slice(-8)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                {meTokenAddress && (
                  <div className="flex items-center gap-2">
                    <span>MeToken Address:</span>
                    <a
                      href={`https://basescan.org/address/${meTokenAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
                    >
                      {meTokenAddress.slice(0, 10)}...{meTokenAddress.slice(-8)}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">MeToken Name</Label>
              <Input
                id="name"
                placeholder="My Creative Token"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="symbol">Symbol</Label>
              <Input
                id="symbol"
                placeholder="MCT"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                disabled={isLoading}
                maxLength={10}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="hubId">Hub ID</Label>
            <Input
              id="hubId"
              type="number"
              placeholder="1"
              value={hubId}
              onChange={(e) => setHubId(e.target.value)}
              disabled={isLoading}
              min="1"
            />
            <p className="text-sm text-muted-foreground">
              The hub ID determines the trading parameters for your MeToken
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assetsDeposited">DAI Amount to Deposit</Label>
            <Input
              id="assetsDeposited"
              type="number"
              placeholder="100.00"
              value={assetsDeposited}
              onChange={(e) => setAssetsDeposited(e.target.value)}
              disabled={isLoading}
              step="0.01"
              min="0"
            />
            <p className="text-sm text-muted-foreground">
              Your DAI balance: {formatEther(daiBalance)} DAI
            </p>
            {assetsDeposited && parseFloat(assetsDeposited) > 0 && (
              <div className="text-sm">
                {hasEnoughDai ? (
                  <span className="text-green-600">✓ Sufficient DAI balance</span>
                ) : (
                  <span className="text-orange-600">⚠ Insufficient DAI balance</span>
                )}
              </div>
            )}
          </div>

          {!hasEnoughDai && assetsDeposited && parseFloat(assetsDeposited) > 0 && (
            <DaiFundingOptions
              requiredAmount={parseEther(assetsDeposited).toString()}
              onBalanceUpdate={setDaiBalance}
            />
          )}

          <Button 
            onClick={createMeToken}
            disabled={isLoading || !name || !symbol || !assetsDeposited || parseFloat(assetsDeposited) <= 0 || !hasEnoughDai}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isCreating ? 'Creating MeToken...' : isConfirming ? 'Confirming...' : 'Processing...'}
              </>
            ) : (
              'Create MeToken'
            )}
          </Button>
        </div>

        <div className="text-sm text-muted-foreground space-y-2">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p><strong>How it works:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Uses Alchemy SDK for reliable blockchain interactions</li>
                <li>Calls the Diamond contract&apos;s subscribe function</li>
                <li>Automatically approves DAI if needed</li>
                <li>Stores MeToken data in Supabase for fast queries</li>
                <li>Enables trading and liquidity provision</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
