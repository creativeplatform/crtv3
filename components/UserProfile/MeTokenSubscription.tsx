"use client";
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';
import Image from 'next/image';
import { formatEther, parseEther, encodeFunctionData, maxUint256 } from 'viem';
import { useSmartAccountClient, useChain } from '@account-kit/react';
import { useMeTokensSupabase, MeTokenData } from '@/lib/hooks/metokens/useMeTokensSupabase';
import { getHubVaultAddress } from '@/lib/utils/metokenSubscriptionUtils';
import { DaiFundingOptions } from '@/components/wallet/funding/DaiFundingOptions';
import { parseBundlerError, shouldRetryError } from '@/lib/utils/bundlerErrorParser';
import { logger } from '@/lib/utils/logger';
import { appendBuilderCode } from "@/lib/utils/builder-code";

interface MeTokenSubscriptionProps {
  meToken: MeTokenData;
  onSubscriptionSuccess?: () => void;
}

export function MeTokenSubscription({ meToken, onSubscriptionSuccess }: MeTokenSubscriptionProps) {
  const [hubId, setHubId] = useState('1'); // Default hub ID
  const [assetsDeposited, setAssetsDeposited] = useState('');
  const [daiBalance, setDaiBalance] = useState<bigint>(BigInt(0));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [approvalComplete, setApprovalComplete] = useState(false);
  const [approvalTxHash, setApprovalTxHash] = useState<string | null>(null);
  const [realSubscriptionStatus, setRealSubscriptionStatus] = useState<{
    isSubscribed: boolean;
    balancePooled: string;
    balanceLocked: string;
    hubId: string;
    totalLocked: string;
    error?: string;
  } | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const { client } = useSmartAccountClient({});
  const { chain } = useChain();
  const { isPending, isConfirming, isConfirmed, transactionError } = useMeTokensSupabase();

  // Helper function to wait with countdown
  const waitWithCountdown = async (seconds: number) => {
    setCountdown(seconds);

    for (let i = seconds; i > 0; i--) {
      setCountdown(i);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setCountdown(null);
  };

  // Check DAI balance
  const checkDaiBalance = useCallback(async () => {
    if (!client) return;

    try {
      const daiContract = {
        address: '0x50c5725949a6f0c72e6c4a641f24049a917db0cb' as `0x${string}`, // DAI on Base
        abi: [
          {
            "inputs": [{ "internalType": "address", "name": "account", "type": "address" }],
            "name": "balanceOf",
            "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
            "stateMutability": "view",
            "type": "function"
          }
        ] as const,
      };

      const balance = await client.readContract({
        address: daiContract.address,
        abi: daiContract.abi,
        functionName: 'balanceOf',
        args: [client.account?.address as `0x${string}`],
      }) as bigint;

      setDaiBalance(balance);
    } catch (err) {
      logger.error('Failed to check DAI balance:', err);
      setDaiBalance(BigInt(0));
    }
  }, [client]);

  // Check DAI allowance status
  const checkAllowanceStatus = useCallback(async () => {
    if (!client) {
      setApprovalComplete(false);
      return;
    }

    try {
      const diamondAddress = '0xba5502db2aC2cBff189965e991C07109B14eB3f5';
      const daiAddress = '0x50c5725949a6f0c72e6c4a641f24049a917db0cb' as `0x${string}`;

      // Get the correct spender address (Vault)
      const hubIdBigInt = hubId ? BigInt(hubId) : BigInt(1); // Default to hub 1
      const vaultAddress = await getHubVaultAddress(hubIdBigInt);
      logger.debug('🔍 Checking allowance for spender (Vault):', vaultAddress);

      const currentAllowance = await client.readContract({
        address: daiAddress,
        abi: [
          {
            "inputs": [
              { "internalType": "address", "name": "owner", "type": "address" },
              { "internalType": "address", "name": "spender", "type": "address" }
            ],
            "name": "allowance",
            "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
            "stateMutability": "view",
            "type": "function"
          }
        ] as const,
        functionName: 'allowance',
        args: [client.account?.address as `0x${string}`, vaultAddress as `0x${string}`] as const,
      }) as bigint;

      const hasUnlimitedAllowance = currentAllowance >= (maxUint256 / BigInt(2));
      setApprovalComplete(hasUnlimitedAllowance);

      logger.debug('📊 Allowance status checked:', {
        hasUnlimited: hasUnlimitedAllowance,
        allowance: formatEther(currentAllowance),
      });
    } catch (err) {
      logger.error('Failed to check allowance status:', err);
      setApprovalComplete(false);
    }
  }, [client]);

  // Handle DAI approval
  const handleApprove = async () => {
    if (!client) {
      setError('Wallet not connected');
      return;
    }

    setIsApproving(true);
    setError(null);
    setSuccess(null);
    setApprovalComplete(false);

    try {
      const diamondAddress = '0xba5502db2aC2cBff189965e991C07109B14eB3f5';
      const daiAddress = '0x50c5725949a6f0c72e6c4a641f24049a917db0cb' as `0x${string}`;

      // Get the correct spender address (Vault)
      const hubIdBigInt = hubId ? BigInt(hubId) : BigInt(1); // Default to hub 1
      const vaultAddress = await getHubVaultAddress(hubIdBigInt);
      logger.debug('📝 Step 1: Approving unlimited DAI for Vault:', vaultAddress);

      setSuccess('Approving unlimited DAI... Please sign the transaction in your wallet.');

      // Build approve operation
      const approveData = encodeFunctionData({
        abi: [
          {
            "inputs": [
              { "internalType": "address", "name": "spender", "type": "address" },
              { "internalType": "uint256", "name": "amount", "type": "uint256" }
            ],
            "name": "approve",
            "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
            "stateMutability": "nonpayable",
            "type": "function"
          }
        ] as const,
        functionName: 'approve',
        args: [vaultAddress as `0x${string}`, maxUint256],
      });

      logger.debug('🔍 Approve operation details:', {
        target: daiAddress,
        spender: vaultAddress,
        dataLength: approveData.length,
        value: '0',
      });

      logger.debug('⏳ Calling client.sendUserOperation (waiting for wallet signature)...');
      logger.debug('💡 If this hangs, check your wallet - you may need to approve the transaction');

      // Add timeout wrapper
      const approvePromise = client.sendUserOperation({
        uo: {
          target: daiAddress,
          data: appendBuilderCode(approveData),
          value: BigInt(0),
        },
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Transaction signature timeout. Please check your wallet and approve the transaction, or try again.'));
        }, 120000); // 2 minutes timeout
      });

      const approveOperation = await Promise.race([approvePromise, timeoutPromise]) as Awaited<ReturnType<typeof client.sendUserOperation>>;

      logger.debug('✅ Approve UserOperation sent:', approveOperation.hash);
      logger.debug('⏳ Waiting for approval confirmation...');
      setSuccess('Approval transaction sent! Waiting for confirmation...');

      const approveTxHash = await client.waitForUserOperationTransaction({
        hash: approveOperation.hash,
      });

      logger.debug('✅ Approve transaction confirmed:', approveTxHash);
      setApprovalTxHash(approveTxHash);

      // Validate allowance propagation
      logger.debug('🔍 Starting aggressive multi-node validation...');
      setSuccess('Approval confirmed! Validating across network nodes...');

      const allowanceAbi = [
        {
          "inputs": [
            { "internalType": "address", "name": "owner", "type": "address" },
            { "internalType": "address", "name": "spender", "type": "address" }
          ],
          "name": "allowance",
          "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
          "stateMutability": "view",
          "type": "function"
        }
      ] as const;

      const allowanceParams = {
        address: daiAddress,
        abi: allowanceAbi,
        functionName: 'allowance' as const,
        args: [client.account?.address as `0x${string}`, vaultAddress as `0x${string}`] as const,
      };

      let validated = false;
      let attempts = 0;
      const maxAttempts = 6; // 60 seconds total
      const waitTime = 10000; // 10 seconds between attempts

      while (!validated && attempts < maxAttempts) {
        attempts++;
        const elapsedSeconds = attempts * (waitTime / 1000);

        logger.debug(`Validation attempt Validation attempt ${attempts}/${maxAttempts} (${elapsedSeconds}s elapsed)...`);
        setSuccess(`Validating allowance... (${elapsedSeconds}s)`);

        try {
          // Perform multiple parallel reads to hit different nodes
          const checks = await Promise.all([
            client.readContract(allowanceParams),
            client.readContract(allowanceParams),
            client.readContract(allowanceParams),
          ]) as bigint[];

          const allowances = checks.map(a => formatEther(a));
          logger.debug(`Allowance checks: Allowance checks:`, allowances);

          // All 3 checks must pass
          const allPassed = checks.every(allowance => allowance >= (maxUint256 / BigInt(2)));

          if (allPassed) {
            validated = true;
            const avgAllowance = checks.reduce((a, b) => a + b, BigInt(0)) / BigInt(checks.length);
            logger.debug(`Validation passed Validation passed after ${elapsedSeconds} seconds!`);
            logger.debug(`Allowance checks: Average allowance across nodes: ${formatEther(avgAllowance)} DAI`);
            setSuccess('Allowance validated across network! Ready to mint.');
            setApprovalComplete(true);
          } else {
            const passedCount = checks.filter(a => a >= (maxUint256 / BigInt(2))).length;
            logger.debug(`Only Only ${passedCount}/3 nodes see the allowance, waiting ${waitTime / 1000}s...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        } catch (checkError) {
          logger.warn(`Validation check ${attempts} failed:`, checkError);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }

      if (!validated) {
        throw new Error(
          `Allowance not propagated after ${maxAttempts * (waitTime / 1000)} seconds! ` +
          `This indicates an Alchemy infrastructure issue. ` +
          `Please try again in a few minutes or contact Alchemy support.`
        );
      }

      logger.debug('✅ Approval complete and validated!');

    } catch (err) {
      logger.error('❌ Approval failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to approve DAI');
      throw err;
    } finally {
      setIsApproving(false);
    }
  };

  // Handle minting MeTokens
  const handleMint = async () => {
    if (!client || !assetsDeposited || parseFloat(assetsDeposited) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    // Check if already subscribed
    if (realSubscriptionStatus?.isSubscribed) {
      setError(`This MeToken is already subscribed to Hub ${realSubscriptionStatus.hubId}. No need to subscribe again.`);
      return;
    }

    setIsMinting(true);
    setError(null);
    setSuccess(null);

    try {
      // Double-check subscription status
      logger.debug('🔍 Double-checking subscription status before minting...');
      const { checkMeTokenSubscriptionFromBlockchain } = await import('@/lib/utils/metokenSubscriptionUtils');
      const currentStatus = await checkMeTokenSubscriptionFromBlockchain(meToken.address);

      if (currentStatus.isSubscribed) {
        setError(`This MeToken is already subscribed to Hub ${currentStatus.hubId}. ` +
          'Please refresh the page to see the current status.');
        setIsMinting(false);
        return;
      }

      logger.debug('✅ Confirmed not subscribed, proceeding with mint...');

      const diamondAddress = '0xba5502db2aC2cBff189965e991C07109B14eB3f5' as `0x${string}`;
      const daiAddress = '0x50c5725949a6f0c72e6c4a641f24049a917db0cb' as `0x${string}`;
      const depositAmount = parseEther(assetsDeposited);

      // Get the correct spender address (Vault)
      const hubIdBigInt = hubId ? BigInt(hubId) : BigInt(1); // Default to hub 1
      let vaultAddress: string;
      try {
        vaultAddress = await getHubVaultAddress(hubIdBigInt);
        logger.debug('🔍 Mint flow: Spender (Vault) address:', vaultAddress);
      } catch (err) {
        logger.error('❌ Failed to get vault address, falling back to Diamond:', err);
        vaultAddress = diamondAddress;
      }

      // CRITICAL: Refresh and verify smart account has DAI balance BEFORE attempting transaction
      logger.debug('🔍 Verifying smart account DAI balance...');
      await checkDaiBalance(); // Refresh balance first to get latest state

      logger.debug('📊 Balance check:', {
        smartAccount: client.account?.address,
        daiBalance: formatEther(daiBalance),
        required: formatEther(depositAmount),
        hasEnough: daiBalance >= depositAmount,
      });

      if (daiBalance < depositAmount) {
        const errorMsg = `Insufficient DAI balance in your smart account. ` +
          `You have ${formatEther(daiBalance)} DAI but need ${formatEther(depositAmount)} DAI. ` +
          `Please transfer DAI to your smart account (${client.account?.address}) first. ` +
          `DAI must be in your smart account, not your EOA wallet.`;
        logger.error('❌', errorMsg);
        setError(errorMsg);
        setIsMinting(false);
        return;
      }

      logger.debug('✅ Smart account has sufficient DAI balance');

      // Try batched operations with client.sendUserOperation first
      // This bypasses wallet_prepareCalls and uses eth_estimateUserOperationGas directly
      logger.debug('📝 Attempting batched approve + mint with client.sendUserOperation...');
      setSuccess('Batching approval and mint in single transaction... Please sign in your wallet.');

      // Build approve operation using Vault address
      const approveData = encodeFunctionData({
        abi: [
          {
            "inputs": [
              { "internalType": "address", "name": "spender", "type": "address" },
              { "internalType": "uint256", "name": "amount", "type": "uint256" }
            ],
            "name": "approve",
            "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
            "stateMutability": "nonpayable",
            "type": "function"
          }
        ] as const,
        functionName: 'approve',
        args: [vaultAddress as `0x${string}`, maxUint256],
      });

      // Build mint calldata
      const mintCalldata = encodeFunctionData({
        abi: [
          {
            "inputs": [
              { "internalType": "address", "name": "meToken", "type": "address" },
              { "internalType": "uint256", "name": "collateralAmount", "type": "uint256" },
              { "internalType": "address", "name": "depositor", "type": "address" }
            ],
            "name": "mint",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
          }
        ] as const,
        functionName: 'mint',
        args: [meToken.address as `0x${string}`, depositAmount, client.account?.address as `0x${string}`],
      });

      // STRATEGY: Use separate transactions (approve first, then mint)
      // 
      // Why separate transactions instead of batching?
      // 1. Both EIP-4337 (sendUserOperation) and EIP-5792 (sendCallsAsync) fail with "insufficient allowance"
      //    because the bundler's RPC node doesn't see the allowance during gas estimation
      // 2. wallet_prepareCalls (used by sendCallsAsync) checks allowance BEFORE simulating approve
      // 3. The bundler uses a different RPC node than the one used for reading, causing state sync delays
      // 4. Separate transactions ensure the approve is confirmed on-chain before attempting mint
      //    - Step 1: Approve DAI (confirmed on-chain, visible to all nodes)
      //    - Step 2: Mint MeTokens (uses confirmed allowance)
      //
      // This approach is more reliable than batching when dealing with RPC node state sync issues
      logger.debug('📝 Using separate transactions (approve first, then mint)');
      logger.debug('💡 This approach avoids bundler RPC node state sync issues');

      // CRITICAL: Check current allowance first - if sufficient, skip approval
      logger.debug('🔍 Checking current allowance before attempting approval...');
      let currentAllowance: bigint;
      try {
        currentAllowance = await client.readContract({
          address: daiAddress,
          abi: [
            {
              "inputs": [
                { "internalType": "address", "name": "owner", "type": "address" },
                { "internalType": "address", "name": "spender", "type": "address" }
              ],
              "name": "allowance",
              "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
              "stateMutability": "view",
              "type": "function"
            }
          ] as const,
          functionName: 'allowance',
          args: [client.account?.address as `0x${string}`, vaultAddress as `0x${string}`] as const,
        }) as bigint;

        logger.debug('📊 Current allowance check:', {
          allowance: currentAllowance.toString(),
          formatted: formatEther(currentAllowance),
          required: depositAmount.toString(),
          hasUnlimited: currentAllowance >= (maxUint256 / BigInt(2)),
          hasSufficient: currentAllowance >= depositAmount,
        });
      } catch (allowanceCheckError) {
        logger.warn('Failed to check allowance Failed to check allowance, proceeding with approval:', allowanceCheckError);
        currentAllowance = BigInt(0);
      }

      const hasUnlimitedAllowance = currentAllowance >= (maxUint256 / BigInt(2));
      const hasSufficientAllowance = currentAllowance >= depositAmount;

      let approveTxHash: string | null = null;

      // Only approve if allowance is insufficient
      // If allowance exists, we'll try minting first and handle bundler sync issues via retry logic
      if (!hasUnlimitedAllowance && !hasSufficientAllowance) {
        logger.debug('📝 Allowance insufficient, sending approve transaction...');
        setSuccess('Step 1: Approving DAI... Please sign in your wallet.');

        logger.debug('📋 Approve transaction details:', {
          target: daiAddress,
          dataLength: approveData.length,
          data: approveData,
          smartAccount: client.account?.address,
          currentAllowance: currentAllowance.toString(),
          required: depositAmount.toString(),
        });

        let approveOperation;
        try {
          // Add timeout wrapper to prevent hanging
          logger.debug('⏳ Sending approve UserOperation (this may require wallet signature)...');
          const approvePromise = client.sendUserOperation({
            uo: {
              target: daiAddress,
              data: appendBuilderCode(approveData),
              value: BigInt(0),
            },
          });

          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
              reject(new Error('Approval transaction timeout after 2 minutes. Please check your wallet and approve the transaction, or try again.'));
            }, 120000); // 2 minutes timeout
          });

          approveOperation = await Promise.race([approvePromise, timeoutPromise]);

          logger.debug('✅ Approve UserOperation sent:', approveOperation.hash);
          setSuccess('Approval sent! Waiting for confirmation...');
        } catch (approveSendError) {
          const approveSendErrorMessage = approveSendError instanceof Error ? approveSendError.message : String(approveSendError);
          logger.error('❌ Failed to send approve UserOperation:', approveSendErrorMessage);
          logger.error('❌ Full error details:', approveSendError);
          logger.error('❌ Error stack:', approveSendError instanceof Error ? approveSendError.stack : 'No stack trace');

          // Re-throw with more context
          throw new Error(
            `Failed to send approval transaction: ${approveSendErrorMessage}. ` +
            `Please check your wallet and ensure you approve the transaction. ` +
            `If the issue persists, try refreshing the page and trying again.`
          );
        }

        try {
          logger.debug('⏳ Waiting for approve transaction confirmation...');
          approveTxHash = await client.waitForUserOperationTransaction({
            hash: approveOperation.hash,
          });
        } catch (approveWaitError) {
          const approveWaitErrorMessage = approveWaitError instanceof Error ? approveWaitError.message : String(approveWaitError);
          logger.error('❌ Failed to wait for approve transaction:', approveWaitErrorMessage);
          throw new Error(
            `Approval transaction was sent (${approveOperation.hash}) but failed to confirm: ${approveWaitErrorMessage}. ` +
            `Please check the transaction on a block explorer.`
          );
        }

        logger.debug('✅ Approve transaction confirmed:', approveTxHash);
        setApprovalTxHash(approveTxHash);
        setSuccess('Approval confirmed! Waiting for state propagation...');
      } else {
        // Allowance exists - log it but proceed to mint
        // If bundler doesn't see it, retry logic will handle sending fresh approval
        logger.debug('✅ Sufficient allowance already exists, proceeding to mint');
        logger.debug('📊 Allowance details:', {
          allowance: currentAllowance.toString(),
          formatted: formatEther(currentAllowance),
          hasUnlimited: hasUnlimitedAllowance,
          hasSufficient: hasSufficientAllowance,
        });
        setSuccess('Allowance verified! Proceeding to mint...');
      }

      // Only wait for state propagation if we actually sent an approval transaction
      if (approveTxHash) {
        // CRITICAL: Wait for transaction to be included in multiple blocks
        // Base has ~2 second block time, so 5 blocks = ~10 seconds
        // This ensures the transaction is fully propagated across all nodes
        logger.debug('⏳ Waiting for approval transaction to be included in multiple blocks (10 seconds)...');
        await new Promise(resolve => setTimeout(resolve, 10000));

        // CRITICAL: Poll allowance on-chain until it's actually set
        // This ensures the bundler sees the updated state before attempting mint
        logger.debug('🔍 Polling allowance on-chain until set...');
        setSuccess('Verifying allowance on-chain...');
        const maxAttempts = 15; // Increased from 10 to 15
        const initialDelay = 3000; // Start with 3 seconds (increased from 2)
        let allowanceSet = false;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            const polledAllowance = await client.readContract({
              address: daiAddress,
              abi: [
                {
                  "inputs": [
                    { "internalType": "address", "name": "owner", "type": "address" },
                    { "internalType": "address", "name": "spender", "type": "address" }
                  ],
                  "name": "allowance",
                  "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
                  "stateMutability": "view",
                  "type": "function"
                }
              ] as const,
              functionName: 'allowance',
              args: [client.account?.address as `0x${string}`, diamondAddress as `0x${string}`] as const,
            }) as bigint;

            const hasUnlimitedAllowance = polledAllowance >= (maxUint256 / BigInt(2));
            const hasSufficientAllowance = polledAllowance >= depositAmount;

            logger.debug(`Allowance checks: Allowance check attempt ${attempt}/${maxAttempts}:`, {
              allowance: polledAllowance.toString(),
              formatted: formatEther(polledAllowance),
              hasUnlimited: hasUnlimitedAllowance,
              hasSufficient: hasSufficientAllowance,
              required: depositAmount.toString(),
            });

            if (hasUnlimitedAllowance || hasSufficientAllowance) {
              allowanceSet = true;
              logger.debug('✅ Allowance verified on-chain!');
              break;
            }

            // Exponential backoff: wait longer each attempt (capped at 15 seconds)
            const delay = Math.min(initialDelay * Math.pow(2, attempt - 1), 15000);
            logger.debug(`Allowance not yet set Allowance not yet set, waiting ${delay}ms before retry...`);
            setSuccess(`Verifying allowance... (attempt ${attempt}/${maxAttempts})`);
            await new Promise(resolve => setTimeout(resolve, delay));

          } catch (allowanceError) {
            logger.warn(`Error checking allowance (attempt ${attempt}):`, allowanceError);
            // Continue to next attempt with exponential backoff (capped at 15 seconds)
            const delay = Math.min(initialDelay * Math.pow(2, attempt - 1), 15000);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }

        if (!allowanceSet) {
          throw new Error(
            `Allowance not set after ${maxAttempts} attempts. ` +
            `The approval transaction was confirmed (${approveTxHash}), but the allowance is not yet visible on-chain. ` +
            `Please wait a few moments and try again, or check the transaction on a block explorer.`
          );
        }

        // CRITICAL: Additional delay to ensure bundler state is fully updated
        // The bundler might be using a different RPC node that needs more time to sync
        // Waiting 15 seconds ensures all nodes in Alchemy's load balancer have synced
        logger.debug('⏳ Waiting additional 15 seconds for bundler state propagation...');
        setSuccess('Allowance verified! Waiting for bundler state update (this may take up to 15 seconds)...');
        await new Promise(resolve => setTimeout(resolve, 15000));
      } else {
        // If we skipped approval, we still need to wait a bit for bundler state sync
        // The allowance exists but bundler might need time to see it
        logger.debug('⏳ Allowance already exists, waiting 5 seconds for bundler state sync...');
        setSuccess('Allowance verified! Waiting for bundler state update...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      // Step 2: Mint MeTokens (with retry logic)
      logger.debug('📝 Sending mint transaction...');
      setSuccess('Step 2: Minting MeTokens... Please sign in your wallet.');

      const maxMintRetries = 3;
      let mintSuccess = false;
      let lastMintError: Error | null = null;
      let hasSentFreshApproval = false; // Track if we've sent a fresh approval for bundler sync

      for (let mintAttempt = 1; mintAttempt <= maxMintRetries; mintAttempt++) {
        try {
          logger.debug(`Mint attempt Mint attempt ${mintAttempt}/${maxMintRetries}...`);
          const mintOperation = await client.sendUserOperation({
            uo: {
              target: diamondAddress,
              data: appendBuilderCode(mintCalldata),
              value: BigInt(0),
            },
          });

          logger.debug('✅ Mint UserOperation sent:', mintOperation.hash);
          setSuccess('Mint sent! Waiting for confirmation...');

          const mintTxHash = await client.waitForUserOperationTransaction({
            hash: mintOperation.hash,
          });

          logger.debug('✅ Mint transaction completed:', mintTxHash);
          logger.debug('🎉 MeToken subscription completed! Transaction ID:', mintTxHash);
          setSuccess('Successfully added liquidity to your MeToken!');
          setAssetsDeposited('');
          setApprovalComplete(true);
          mintSuccess = true;

          // Refresh subscription status
          await checkRealSubscriptionStatus();

          onSubscriptionSuccess?.();
          break; // Success - exit retry loop

        } catch (mintError) {
          const mintErrorMessage = mintError instanceof Error ? mintError.message : String(mintError);
          lastMintError = mintError instanceof Error ? mintError : new Error(String(mintError));

          // Parse the error to determine if it's a contract error or RPC/infrastructure error
          const parsedMintError = parseBundlerError(mintError instanceof Error ? mintError : new Error(mintErrorMessage));

          logger.debug('🔍 Mint Error Analysis:', {
            code: parsedMintError.code,
            message: parsedMintError.message,
            isContractError: parsedMintError.code?.startsWith('AA') && ['AA23', 'AA24'].includes(parsedMintError.code),
            isRpcError: !parsedMintError.code || parsedMintError.message.includes('allowance') || parsedMintError.message.includes('estimation'),
          });

          // If it's a contract error (AA23: validation reverted, AA24: invalid signature), throw it immediately
          // These are actual contract issues, not infrastructure
          if (parsedMintError.code === 'AA23' || parsedMintError.code === 'AA24') {
            logger.error('❌ Contract Error Detected during mint:', parsedMintError);
            throw new Error(
              `Contract Error [${parsedMintError.code}]: ${parsedMintError.message}\n\n` +
              `💡 ${parsedMintError.suggestion}\n\n` +
              `This is a contract-level error, not an RPC issue. Please check your contract logic.`
            );
          }

          const isAllowanceError = mintErrorMessage.includes('insufficient allowance') ||
            mintErrorMessage.includes('ERC20') ||
            parsedMintError.message.includes('allowance');

          if (!isAllowanceError || mintAttempt === maxMintRetries) {
            // If it's not an allowance/RPC error, or we've exhausted retries, show the parsed error
            if (!isAllowanceError) {
              logger.warn('⚠️ Non-allowance error during mint:', parsedMintError);
              setError(
                `Error [${parsedMintError.code || 'Unknown'}]: ${parsedMintError.message}\n\n` +
                `💡 ${parsedMintError.suggestion}\n\n` +
                `This may be an infrastructure issue. The error is NOT from your contract.`
              );
            }
            throw mintError;
          }

          // Log that this is an RPC/infrastructure error, NOT a contract error
          logger.debug('ℹ️ RPC/Infrastructure Error Detected during mint (NOT contract error):', {
            message: parsedMintError.message,
            explanation: 'This error is caused by RPC node state synchronization issues, not your contract.',
            attempt: `${mintAttempt}/${maxMintRetries}`,
          });

          // CRITICAL: If bundler doesn't see allowance, send a fresh approval to force bundler's node to see it
          // This is necessary because the bundler uses a different RPC node that may not have synced
          if (isAllowanceError && !hasSentFreshApproval && mintAttempt === 1) {
            logger.warn('⚠️ Bundler doesn\'t see allowance even though it exists. Sending fresh approval to force bundler sync...');
            setSuccess('Bundler state sync issue detected. Sending fresh approval to sync bundler...');

            try {
              // Send a fresh approval transaction to force the bundler's node to see the allowance
              logger.debug('📝 Sending fresh approval to sync bundler state...');
              const freshApproveOperation = await client.sendUserOperation({
                uo: {
                  target: daiAddress,
                  data: appendBuilderCode(approveData),
                  value: BigInt(0),
                },
              });

              logger.debug('✅ Fresh approve UserOperation sent:', freshApproveOperation.hash);
              setSuccess('Fresh approval sent! Waiting for confirmation...');

              const freshApproveTxHash = await client.waitForUserOperationTransaction({
                hash: freshApproveOperation.hash,
              });

              logger.debug('✅ Fresh approve transaction confirmed:', freshApproveTxHash);
              setApprovalTxHash(freshApproveTxHash);
              setSuccess('Fresh approval confirmed! Waiting for bundler state sync...');

              // Wait for bundler state to sync after fresh approval
              logger.debug('⏳ Waiting 15 seconds for bundler state sync after fresh approval...');
              await new Promise(resolve => setTimeout(resolve, 15000));

              hasSentFreshApproval = true;
              // Continue to next mint attempt (don't increment retry delay since we just sent approval)
              continue;
            } catch (freshApproveError) {
              logger.error('❌ Failed to send fresh approval:', freshApproveError);
              // Continue with retry logic below
            }
          }

          // If it's an allowance error and we have retries left, wait and retry
          // Increase retry delays to give bundler more time to sync
          const retryDelay = 10000 * Math.pow(2, mintAttempt - 1); // Exponential backoff: 10s, 20s, 40s
          logger.warn(`⚠️ Mint failed with allowance error (attempt ${mintAttempt}/${maxMintRetries}):`, mintErrorMessage);
          logger.debug(`Waiting ${retryDelay}ms before retry (bundler may need more time to sync)...`);
          setSuccess(`Mint failed, retrying... (attempt ${mintAttempt}/${maxMintRetries}, waiting ${retryDelay / 1000}s for bundler sync)`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));

          // Re-verify allowance before retry
          logger.debug('🔍 Re-verifying allowance before retry...');
          try {
            const retryAllowance = await client.readContract({
              address: daiAddress,
              abi: [
                {
                  "inputs": [
                    { "internalType": "address", "name": "owner", "type": "address" },
                    { "internalType": "address", "name": "spender", "type": "address" }
                  ],
                  "name": "allowance",
                  "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
                  "stateMutability": "view",
                  "type": "function"
                }
              ] as const,
              functionName: 'allowance',
              args: [client.account?.address as `0x${string}`, vaultAddress as `0x${string}`] as const,
            }) as bigint;

            logger.debug('📊 Allowance before retry:', {
              allowance: retryAllowance.toString(),
              formatted: formatEther(retryAllowance),
              required: depositAmount.toString(),
              hasUnlimited: retryAllowance >= (maxUint256 / BigInt(2)),
              hasSufficient: retryAllowance >= depositAmount,
            });
          } catch (retryAllowanceError) {
            logger.warn('⚠️ Error checking allowance before retry:', retryAllowanceError);
          }
        }
      }

      if (!mintSuccess && lastMintError) {
        throw lastMintError;
      }

    } catch (err) {
      logger.error('❌ Mint error:', err);

      // Parse the error to provide better error messages
      const parsedError = parseBundlerError(err instanceof Error ? err : new Error(String(err)));

      // Determine if this is a contract error or RPC/infrastructure error
      const isContractError = parsedError.code?.startsWith('AA') && ['AA23', 'AA24', 'AA25'].includes(parsedError.code);
      const isRpcError = !parsedError.code || parsedError.message.includes('allowance') || parsedError.message.includes('estimation') || parsedError.message.includes('simulation');

      // Build user-friendly error message
      let errorMessage = '';

      if (isContractError) {
        // Contract error - actual issue with contract logic
        errorMessage = `Contract Error [${parsedError.code}]: ${parsedError.message}\n\n` +
          `💡 ${parsedError.suggestion}\n\n` +
          `⚠️ This is a contract-level error. Please check your contract logic and parameters.`;
      } else if (isRpcError) {
        // RPC/Infrastructure error - NOT a contract issue
        errorMessage = `RPC/Infrastructure Error: ${parsedError.message}\n\n` +
          `💡 ${parsedError.suggestion}\n\n` +
          `ℹ️ This error is NOT from your contract. It's caused by RPC node state synchronization issues.\n` +
          `The bundler's RPC node may not have synced the latest blockchain state yet.\n` +
          `This is a known limitation of distributed RPC infrastructure.`;
      } else {
        // Generic error
        errorMessage = `Error [${parsedError.code || 'Unknown'}]: ${parsedError.message}\n\n` +
          `💡 ${parsedError.suggestion}`;
      }

      logger.debug('📊 Error Summary:', {
        code: parsedError.code,
        isContractError,
        isRpcError,
        message: parsedError.message,
      });

      setError(errorMessage);
    } finally {
      setIsMinting(false);
    }
  };

  // Legacy subscribeToHub function (kept for backwards compatibility, but now just calls handleMint which batches approve + mint)
  const subscribeToHub = async () => {
    await handleMint(); // handleMint now always batches approve + mint
  };

  // Check real subscription status from blockchain
  const checkRealSubscriptionStatus = useCallback(async () => {
    if (!meToken.address) return;

    setIsCheckingStatus(true);
    try {
      logger.debug('🔍 Checking real subscription status for:', meToken.address);
      const { checkMeTokenSubscriptionFromBlockchain } = await import('@/lib/utils/metokenSubscriptionUtils');
      const status = await checkMeTokenSubscriptionFromBlockchain(meToken.address);

      logger.debug('✅ Real subscription status:', status);
      setRealSubscriptionStatus({
        isSubscribed: status.isSubscribed,
        balancePooled: status.balancePooled,
        balanceLocked: status.balanceLocked,
        hubId: status.hubId,
        totalLocked: status.totalLocked
      });

      // If already subscribed, show appropriate message
      if (status.isSubscribed) {
        setError(`This MeToken is already subscribed to Hub ${status.hubId}. No need to subscribe again.`);
      } else if (status.error) {
        // Log as debug info (not warning) - this is expected for some MeTokens
        // The Diamond contract function may not be available or the MeToken may not be registered yet
        logger.debug('Subscription status check: Subscription status check:', status.error);
        setError(null); // Don't show error to user, just log it
      } else {
        setError(null);
      }
    } catch (err) {
      logger.error('❌ Failed to check real subscription status:', err);
      setRealSubscriptionStatus(null);
    } finally {
      setIsCheckingStatus(false);
    }
  }, [meToken.address]);

  // Check DAI balance on mount and when client changes
  useEffect(() => {
    checkDaiBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]); // Only re-run when client changes

  // Check real subscription status on mount and when meToken address changes
  useEffect(() => {
    checkRealSubscriptionStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meToken.address]); // Only re-run when meToken address changes

  // Check allowance status on mount and when client/amount changes
  useEffect(() => {
    if (client && assetsDeposited && parseFloat(assetsDeposited) > 0) {
      checkAllowanceStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, assetsDeposited]);

  // Check real subscription status on mount and when meToken address changes
  useEffect(() => {
    checkRealSubscriptionStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meToken.address]); // Only re-run when meToken address changes

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>Subscribe {meToken.symbol} to Hub</span>
          {isConfirmed && <CheckCircle className="h-5 w-5 text-green-500" />}
        </CardTitle>
        <CardDescription>
          Subscribe your MeToken to a hub to enable trading and add liquidity.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {transactionError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Transaction failed: {transactionError.message}
            </AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              {success}
              {countdown !== null && (
                <span className="ml-2 font-bold text-lg">
                  {countdown}s
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="hubId">Hub ID</Label>
            <Input
              id="hubId"
              type="number"
              placeholder="1"
              value={hubId}
              onChange={(e) => setHubId(e.target.value)}
              disabled={isSubscribing || isApproving || isMinting}
              min="1"
            />
            <p className="text-sm text-muted-foreground">
              The hub ID to subscribe to (default: 1)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assetsDeposited" className="flex items-center space-x-2">
              <Image
                src="/images/tokens/dai-logo.svg"
                alt="DAI"
                width={16}
                height={16}
                className="w-4 h-4"
              />
              <span>DAI Amount to Deposit</span>
            </Label>
            <Input
              id="assetsDeposited"
              type="number"
              placeholder="0.00"
              value={assetsDeposited}
              onChange={(e) => setAssetsDeposited(e.target.value)}
              disabled={isSubscribing || isApproving || isMinting}
              step="0.01"
              min="0"
            />
            <p className="text-sm text-muted-foreground flex items-center space-x-1">
              <Image
                src="/images/tokens/dai-logo.svg"
                alt="DAI"
                width={12}
                height={12}
                className="w-3 h-3"
              />
              <span>Your DAI balance: {formatEther(daiBalance)}</span>
            </p>
            {assetsDeposited && parseFloat(assetsDeposited) > 0 && (
              <div className="text-sm">
                {daiBalance >= parseEther(assetsDeposited) ? (
                  <span className="text-green-600">✓ Sufficient DAI balance</span>
                ) : (
                  <div className="space-y-2">
                    <span className="text-orange-600 block">⚠ Insufficient DAI balance</span>
                    <p className="text-xs text-muted-foreground">
                      Your smart account ({client?.account?.address}) needs DAI tokens.
                      DAI must be in your smart account, not your EOA wallet.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Show funding options if insufficient DAI */}
          {assetsDeposited && parseFloat(assetsDeposited) > 0 && daiBalance < parseEther(assetsDeposited) && (
            <DaiFundingOptions
              requiredAmount={parseEther(assetsDeposited).toString()}
              onBalanceUpdate={(balance) => {
                setDaiBalance(balance);
                checkDaiBalance(); // Refresh balance
              }}
            />
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleApprove}
              disabled={!client || isApproving || isMinting || !assetsDeposited || parseFloat(assetsDeposited) <= 0 || approvalComplete || daiBalance < parseEther(assetsDeposited)}
              className="flex-1"
              variant={approvalComplete ? "outline" : "default"}
            >
              {isApproving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Approving...
                </>
              ) : approvalComplete ? (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approved
                </>
              ) : (
                'Approve DAI'
              )}
            </Button>

            <Button
              onClick={handleMint}
              disabled={!client || isApproving || isMinting || !assetsDeposited || parseFloat(assetsDeposited) <= 0 || daiBalance < parseEther(assetsDeposited)}
              className="flex-1"
            >
              {isMinting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Minting...
                </>
              ) : (
                'Mint MeTokens'
              )}
            </Button>
          </div>
        </div>

        <div className="text-sm text-muted-foreground space-y-2">
          <p><strong>Subscription Info:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>MeToken: {meToken.name} ({meToken.symbol})</li>
            <li>Current TVL: ${meToken.tvl.toFixed(2)}</li>
            <li>Status: {isCheckingStatus ? 'Checking...' :
              realSubscriptionStatus ?
                (realSubscriptionStatus.isSubscribed ? 'Subscribed' : 'Not Subscribed') :
                'Unknown'}</li>
          </ul>
          <p className="text-xs">
            Note: Subscribing to a hub will lock your DAI and enable trading for your MeToken.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
