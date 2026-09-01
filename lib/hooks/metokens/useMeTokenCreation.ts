/**
 * useMeTokenCreation Hook - Robust MeToken Creation with Timeout Handling
 *
 * Batches approve + subscribe under an ETH-sponsored Alchemy paymaster policy
 * (not the USDC any-token policy) to avoid approval UserOps that never land on-chain.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSmartAccountClient } from '@/lib/wallet/react';
import { useGasSponsorship } from '@/lib/hooks/wallet/useGasSponsorship';
import { formatEther, parseEther, encodeFunctionData, erc20Abi, maxUint256, type Address } from 'viem';
import { parseBundlerError } from '@/lib/utils/bundlerErrorParser';
import {
  parseHubAssetAmount,
  formatHubAssetAmount,
} from '@/lib/utils/hubAssetUtils';
import { fetchHubCreationContext } from '@/lib/metokens/hub-onchain';
import { logger } from '@/lib/utils/logger';
import { METOKEN_DIAMOND_BASE } from '@/lib/contracts/metokens/deployments';
import { publicClient, getErc20Balance, getEthBalance } from '@/lib/viem';
import { formatMeTokenCreationError } from '@/lib/metokens/metoken-gas';
import { appendBuilderCode } from '@/lib/utils/builder-code';
import {
  buildMeTokenCreationCalls,
  sendMeTokenCreationUserOp,
  waitForMeTokenCreationTx,
  verifyMeTokenCreationReceipt,
} from '@/lib/utils/metokenApproval';

const DIAMOND = METOKEN_DIAMOND_BASE;

export interface PendingMeTokenTransaction {
  userOpHash: string;
  creatorAddress: string;
  name: string;
  symbol: string;
  hubId: number;
  assetsDeposited: string;
  createdAt: number;
  status: 'pending' | 'confirming' | 'confirmed' | 'failed' | 'timeout';
  txHash?: string;
  meTokenAddress?: string;
  errorMessage?: string;
}

const PENDING_TX_KEY = 'metoken_pending_transactions';

export type CreationStatus =
  | 'idle'
  | 'checking_balance'
  | 'approving_dai'
  | 'waiting_approval'
  | 'creating_metoken'
  | 'waiting_confirmation'
  | 'polling_status'
  | 'success'
  | 'error';

export interface MeTokenCreationState {
  status: CreationStatus;
  message: string;
  progress: number;
  userOpHash?: string;
  txHash?: string;
  meTokenAddress?: string;
  meTokenId?: string;
  name?: string;
  symbol?: string;
  error?: string;
}

export interface UseMeTokenCreationReturn {
  state: MeTokenCreationState;
  createMeToken: (params: {
    name: string;
    symbol: string;
    hubId: number;
    assetsDeposited: string;
  }) => Promise<void>;
  checkPendingTransactions: () => Promise<void>;
  pendingTransactions: PendingMeTokenTransaction[];
  clearPendingTransaction: (userOpHash: string) => void;
  retryPendingTransaction: (tx: PendingMeTokenTransaction) => Promise<void>;
}

function savePendingTransaction(tx: PendingMeTokenTransaction): void {
  try {
    const existing = getPendingTransactions();
    const updated = existing.filter(t => t.userOpHash !== tx.userOpHash);
    updated.push(tx);
    localStorage.setItem(PENDING_TX_KEY, JSON.stringify(updated));
  } catch (e) {
    logger.error('Failed to save pending transaction:', e);
  }
}

function getPendingTransactions(): PendingMeTokenTransaction[] {
  try {
    const stored = localStorage.getItem(PENDING_TX_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    logger.error('Failed to get pending transactions:', e);
    return [];
  }
}

function removePendingTransaction(userOpHash: string): void {
  try {
    const existing = getPendingTransactions();
    const updated = existing.filter(t => t.userOpHash !== userOpHash);
    localStorage.setItem(PENDING_TX_KEY, JSON.stringify(updated));
  } catch (e) {
    logger.error('Failed to remove pending transaction:', e);
  }
}

export function useMeTokenCreation(): UseMeTokenCreationReturn {
  const { client, address: scaAddress } = useSmartAccountClient({});
  const { getGasContext, getMeTokenCreationGasContext } = useGasSponsorship();

  const [state, setState] = useState<MeTokenCreationState>({
    status: 'idle',
    message: '',
    progress: 0,
  });

  const [pendingTransactions, setPendingTransactions] = useState<PendingMeTokenTransaction[]>([]);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const address = scaAddress ?? client?.account?.address;

  useEffect(() => {
    setPendingTransactions(getPendingTransactions());
  }, []);

  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const updateState = useCallback((partial: Partial<MeTokenCreationState>) => {
    setState(prev => ({ ...prev, ...partial }));
  }, []);

  const pollForMeToken = useCallback(async (
    tx: PendingMeTokenTransaction,
    maxAttempts: number = 30
  ): Promise<string | null> => {
    let attempts = 0;

    return new Promise((resolve) => {
      const poll = async () => {
        attempts++;
        logger.debug(`🔄 Polling for MeToken (attempt ${attempts}/${maxAttempts})...`);

        try {
          const { meTokensSubgraph } = await import('@/lib/sdk/metokens/subgraph');
          const allMeTokens = await meTokensSubgraph.getAllMeTokens(50, 0);

          for (const meToken of allMeTokens) {
            try {
              const info = await publicClient.readContract({
                address: DIAMOND,
                abi: [{
                  inputs: [{ internalType: 'address', name: 'meToken', type: 'address' }],
                  name: 'getMeTokenInfo',
                  outputs: [{
                    components: [
                      { internalType: 'address', name: 'owner', type: 'address' },
                      { internalType: 'uint256', name: 'hubId', type: 'uint256' },
                      { internalType: 'uint256', name: 'balancePooled', type: 'uint256' },
                      { internalType: 'uint256', name: 'balanceLocked', type: 'uint256' },
                      { internalType: 'uint256', name: 'startTime', type: 'uint256' },
                      { internalType: 'uint256', name: 'endTime', type: 'uint256' },
                      { internalType: 'uint256', name: 'targetHubId', type: 'uint256' },
                      { internalType: 'address', name: 'migration', type: 'address' }
                    ],
                    internalType: 'struct MeTokenInfo',
                    name: '',
                    type: 'tuple'
                  }],
                  stateMutability: 'view',
                  type: 'function'
                }],
                functionName: 'getMeTokenInfo',
                args: [meToken.id as `0x${string}`],
              }) as { owner: string };

              if (info.owner.toLowerCase() === tx.creatorAddress.toLowerCase()) {
                logger.debug('✅ Found MeToken via polling:', meToken.id);
                if (pollingRef.current) {
                  clearInterval(pollingRef.current);
                  pollingRef.current = null;
                }
                resolve(meToken.id);
                return;
              }
            } catch {
              // Continue checking other tokens
            }
          }

          if (attempts >= maxAttempts) {
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }
            resolve(null);
          }
        } catch (err) {
          logger.error('❌ Polling error:', err);
          if (attempts >= maxAttempts) {
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }
            resolve(null);
          }
        }
      };

      pollingRef.current = setInterval(poll, 10000);
      poll();
    });
  }, []);

  const createMeToken = useCallback(async (params: {
    name: string;
    symbol: string;
    hubId: number;
    assetsDeposited: string;
  }) => {
    if (!client || !address) {
      updateState({
        status: 'error',
        message: 'Wallet not connected',
        error: 'Please connect your wallet to create a MeToken.',
        progress: 0,
      });
      throw new Error('Wallet not connected');
    }

    const { name, symbol, hubId, assetsDeposited } = params;
    const meTokenGas = getMeTokenCreationGasContext();

    try {
      const hubContext = await fetchHubCreationContext(hubId);
      if (!hubContext.active) {
        throw new Error(`Hub ${hubId} is not active on-chain. Choose another collateral hub.`);
      }

      const { collateral, vault: vaultAddress } = hubContext;
      const depositAmount = parseHubAssetAmount(assetsDeposited, collateral);

      updateState({
        status: 'checking_balance',
        message: `Checking ${collateral.symbol} balance...`,
        progress: 10,
      });

      if (depositAmount > BigInt(0)) {
        const balance = await getErc20Balance({
          token: collateral.address,
          owner: address as `0x${string}`,
        });

        if (balance < depositAmount) {
          throw new Error(
            `Insufficient ${collateral.symbol} balance. You have ${formatHubAssetAmount(balance, collateral)} ${collateral.symbol} but need ${formatHubAssetAmount(depositAmount, collateral)} ${collateral.symbol}.`
          );
        }
      }

      updateState({
        status: 'creating_metoken',
        message: depositAmount > BigInt(0)
          ? `Approving ${collateral.symbol}...`
          : 'Creating your MeToken...',
        progress: 40,
      });

      // When depositing collateral, send approve and subscribe as SEPARATE
      // UserOperations instead of a batched one. The batched approach fails
      // because the bundler's RPC node doesn't see the approval during
      // gas estimation of the subscribe call.
      if (depositAmount > BigInt(0)) {
        const approveData = encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [vaultAddress, maxUint256],
        });

        logger.debug('📝 Sending approve as separate UserOperation...');

        try {
          const approveOp = await sendMeTokenCreationUserOp({
            client,
            calls: [{
              target: collateral.address,
              data: appendBuilderCode(approveData),
              value: BigInt(0),
            }],
            gas: meTokenGas,
            ethFallback: () => getGasContext('eth'),
          });

          updateState({
            status: 'creating_metoken',
            message: 'Approval sent! Waiting for confirmation...',
            progress: 50,
            userOpHash: approveOp.hash,
          });

          try {
            const approveTx = await waitForMeTokenCreationTx(client, approveOp.hash);
            logger.debug('✅ Approve confirmed:', approveTx);
          } catch (waitErr) {
            logger.debug('⏰ Approve confirmation issue (continuing):', waitErr);
          }

          // Wait for state propagation
          await new Promise(resolve => setTimeout(resolve, 5000));
        } catch (approveErr) {
          logger.warn('⚠️ Separate approve failed, falling back to 0 deposit...', approveErr);
          // Fall back to 0 deposit if approve fails
          const zeroDepositCalls = buildMeTokenCreationCalls({
            collateral,
            vaultAddress,
            name,
            symbol,
            hubId,
            depositAmount: BigInt(0),
          });

          updateState({
            status: 'creating_metoken',
            message: 'Creating your MeToken (no initial deposit)...',
            progress: 55,
          });

          let fallbackOp: { hash: string; policyId?: string; usedEthFallback: boolean };
          try {
            fallbackOp = await sendMeTokenCreationUserOp({
              client,
              calls: zeroDepositCalls,
              gas: meTokenGas,
              ethFallback: () => getGasContext('eth'),
            });
          } catch (fbErr) {
            throw fbErr;
          }

          // Continue with the zero-deposit operation
          const pendingTx: PendingMeTokenTransaction = {
            userOpHash: fallbackOp.hash,
            creatorAddress: address,
            name,
            symbol,
            hubId,
            assetsDeposited: '0',
            createdAt: Date.now(),
            status: 'confirming',
          };
          savePendingTransaction(pendingTx);
          setPendingTransactions(prev => [...prev.filter(t => t.userOpHash !== fallbackOp.hash), pendingTx]);

          updateState({
            status: 'waiting_confirmation',
            message: 'Waiting for blockchain confirmation...',
            progress: 60,
            userOpHash: fallbackOp.hash,
          });

          // Jump to the confirmation flow
          let fbTxHash: string | null = null;
          try {
            fbTxHash = await waitForMeTokenCreationTx(client, fallbackOp.hash);
          } catch (waitErr) {
            logger.debug('⏰ Confirmation issue:', waitErr);
          }

          // Poll for MeToken address
          updateState({
            status: 'polling_status',
            message: 'Looking for your newly created MeToken...',
            progress: 80,
            userOpHash: fallbackOp.hash,
            txHash: fbTxHash || undefined,
          });

          let fbMeTokenAddress: Address | undefined;
          if (fbTxHash) {
            try {
              const receiptResult = await verifyMeTokenCreationReceipt({
                txHash: fbTxHash as `0x${string}`,
                owner: address as Address,
                vaultAddress,
                collateralToken: collateral.address,
                depositAmount: BigInt(0),
              });
              fbMeTokenAddress = receiptResult.meTokenAddress;
            } catch (e) {
              logger.debug('Receipt verification failed:', e);
            }
          }

          if (!fbMeTokenAddress) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            fbMeTokenAddress = (await pollForMeToken(pendingTx, 30)) as Address | undefined;
          }

          if (fbMeTokenAddress) {
            pendingTx.meTokenAddress = fbMeTokenAddress;
            pendingTx.status = 'confirmed';
            savePendingTransaction(pendingTx);
            setTimeout(() => {
              removePendingTransaction(pendingTx.userOpHash);
              setPendingTransactions(prev => prev.filter(t => t.userOpHash !== pendingTx.userOpHash));
            }, 5000);

            updateState({
              status: 'success',
              message: 'MeToken created with 0 initial deposit. You can add collateral later.',
              progress: 100,
              userOpHash: fallbackOp.hash,
              txHash: fbTxHash || undefined,
              meTokenAddress: fbMeTokenAddress,
              name,
              symbol,
            });
            return;
          }

          if (fbTxHash) {
            updateState({
              status: 'success',
              message: 'Transaction confirmed! Your MeToken should appear shortly.',
              progress: 100,
              userOpHash: fallbackOp.hash,
              txHash: fbTxHash,
              name,
              symbol,
            });
            return;
          }

          throw new Error('MeToken creation failed — no transaction hash or MeToken address found.');
        }

        updateState({
          status: 'creating_metoken',
          message: 'Creating your MeToken (with initial deposit)...',
          progress: 55,
        });
      }

      // Build subscribe-only calls (approve already done separately if deposit > 0)
      let calls = buildMeTokenCreationCalls({
        collateral,
        vaultAddress,
        name,
        symbol,
        hubId,
        depositAmount,
      });

      // If we already sent a separate approve, filter it out to avoid
      // sending a redundant approve+subscribe batch (bundler sync issue)
      if (depositAmount > BigInt(0)) {
        calls = calls.filter(call => call.target !== collateral.address);
      }

      logger.debug('📤 MeToken creation gas context:', {
        policyId: meTokenGas.policyId,
        isSponsored: meTokenGas.isSponsored,
        batched: depositAmount > BigInt(0),
        callCount: calls.length,
      });

      let operation: { hash: string; policyId?: string; usedEthFallback: boolean };

      try {
        operation = await sendMeTokenCreationUserOp({
          client,
          calls,
          gas: meTokenGas,
          ethFallback: () => getGasContext('eth'),
        });
      } catch (sendError) {
        const errorMessage = sendError instanceof Error ? sendError.message : String(sendError);
        const isDeploymentError =
          errorMessage.includes('AA13') ||
          errorMessage.includes('initCode') ||
          errorMessage.includes('account not deployed');

        // If the batched approve+subscribe reverts, retry with 0 initial deposit.
        // The approve+subscribe in a single UserOp can fail because the MeToken
        // contract's transferFrom may not see the approval within the same batch.
        // Retrying with 0 deposit creates the token; user can deposit later.
        const isExecutionRevert =
          errorMessage.includes('execution reverted') ||
          errorMessage.includes('0x') && depositAmount > BigInt(0);

        if (isExecutionRevert && depositAmount > BigInt(0)) {
          logger.debug('🔄 Batched approve+subscribe reverted — retrying with 0 initial deposit...');
          updateState({
            status: 'creating_metoken',
            message: 'Retrying without initial deposit (you can deposit later)...',
            progress: 45,
          });

          const zeroDepositCalls = buildMeTokenCreationCalls({
            collateral,
            vaultAddress,
            name,
            symbol,
            hubId,
            depositAmount: BigInt(0),
          });

          try {
            operation = await sendMeTokenCreationUserOp({
              client,
              calls: zeroDepositCalls,
              gas: meTokenGas,
              ethFallback: () => getGasContext('eth'),
            });
          } catch (retryError) {
            throw retryError;
          }
        } else if (isDeploymentError && meTokenGas.context) {
          logger.debug('⚠️ Account deployment required — retrying without paymaster...');
          const ethBalance = await getEthBalance(address as `0x${string}`);
          const minGasEth = parseEther('0.001');

          if (ethBalance < minGasEth) {
            const deployErrorMessage =
              `Your smart account needs to be deployed first. Send at least ${formatEther(minGasEth)} ETH to ${address}`;
            updateState({
              status: 'error',
              message: 'Account deployment required',
              error: deployErrorMessage,
              progress: 40,
            });
            throw new Error(deployErrorMessage);
          }

          operation = await sendMeTokenCreationUserOp({
            client,
            calls,
            gas: { context: undefined, isSponsored: false },
          });
        } else if (meTokenGas.context) {
          const ethBalance = await getEthBalance(address as `0x${string}`);
          const minGasEth = parseEther('0.0001');

          if (ethBalance < minGasEth) {
            const paymasterFailMessage = formatMeTokenCreationError({
              message:
                'Paymaster could not sponsor this MeToken creation and your account has insufficient ETH for gas.',
              policyId: meTokenGas.policyId,
            });
            updateState({
              status: 'error',
              message: 'Gas sponsorship failed',
              error: paymasterFailMessage,
              progress: 40,
            });
            throw new Error(paymasterFailMessage);
          }

          logger.debug('🔄 Paymaster failed, retrying MeToken creation with wallet ETH...');
          operation = await sendMeTokenCreationUserOp({
            client,
            calls,
            gas: { context: undefined, isSponsored: false },
          });
        } else {
          throw sendError;
        }
      }

      logger.debug('🎉 UserOperation sent!', {
        hash: operation.hash,
        policyId: operation.policyId,
        usedEthFallback: operation.usedEthFallback,
      });

      const pendingTx: PendingMeTokenTransaction = {
        userOpHash: operation.hash,
        creatorAddress: address,
        name,
        symbol,
        hubId,
        assetsDeposited,
        createdAt: Date.now(),
        status: 'confirming',
      };
      savePendingTransaction(pendingTx);
      setPendingTransactions(prev => [...prev.filter(t => t.userOpHash !== operation.hash), pendingTx]);

      updateState({
        status: 'waiting_confirmation',
        message: 'Waiting for blockchain confirmation...',
        progress: 60,
        userOpHash: operation.hash,
      });

      let txHash: string | null = null;
      let receiptMeTokenAddress: Address | undefined;

      try {
        txHash = await waitForMeTokenCreationTx(client, operation.hash);
        logger.debug('✅ Transaction confirmed:', txHash);

        const receiptResult = await verifyMeTokenCreationReceipt({
          txHash: txHash as `0x${string}`,
          owner: address as Address,
          vaultAddress,
          collateralToken: collateral.address,
          depositAmount,
        });

        receiptMeTokenAddress = receiptResult.meTokenAddress;

        pendingTx.txHash = txHash;
        pendingTx.status = 'confirmed';
        if (receiptMeTokenAddress) {
          pendingTx.meTokenAddress = receiptMeTokenAddress;
        }
        savePendingTransaction(pendingTx);
      } catch (waitError) {
        const waitMessage =
          waitError instanceof Error ? waitError.message : 'Confirmation timed out';

        logger.debug('⏰ Confirmation issue:', waitMessage);

        if (txHash) {
          throw waitError;
        }

        updateState({
          status: 'polling_status',
          message: 'Transaction is processing. Checking for your MeToken...',
          progress: 70,
          userOpHash: operation.hash,
        });

        pendingTx.status = 'timeout';
        pendingTx.errorMessage = waitMessage;
        savePendingTransaction(pendingTx);
      }

      updateState({
        status: 'polling_status',
        message: 'Looking for your newly created MeToken...',
        progress: 80,
        userOpHash: operation.hash,
        txHash: txHash || undefined,
        meTokenAddress: receiptMeTokenAddress,
      });

      let meTokenAddress = receiptMeTokenAddress;

      if (!meTokenAddress) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        meTokenAddress = (await pollForMeToken(pendingTx, 30)) as Address | undefined;
      }

      if (meTokenAddress) {
        let meTokenId: string | undefined;
        try {
          const syncResponse = await fetch('/api/metokens/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              meTokenAddress,
              transactionHash: txHash,
            }),
          });

          if (syncResponse.ok) {
            const syncData = await syncResponse.json();
            meTokenId = syncData.id || syncData.data?.id;
          }
        } catch (syncErr) {
          logger.error('Failed to sync MeToken to database:', syncErr);
        }

        pendingTx.meTokenAddress = meTokenAddress;
        pendingTx.status = 'confirmed';
        savePendingTransaction(pendingTx);

        setTimeout(() => {
          removePendingTransaction(pendingTx.userOpHash);
          setPendingTransactions(prev => prev.filter(t => t.userOpHash !== pendingTx.userOpHash));
        }, 5000);

        updateState({
          status: 'success',
          message: 'MeToken created successfully!',
          progress: 100,
          userOpHash: operation.hash,
          txHash: txHash || undefined,
          meTokenAddress,
          meTokenId,
          name,
          symbol,
        });

        return;
      }

      if (txHash) {
        updateState({
          status: 'success',
          message: 'Transaction confirmed! Your MeToken should appear shortly.',
          progress: 100,
          userOpHash: operation.hash,
          txHash,
          name,
          symbol,
        });
      } else {
        updateState({
          status: 'polling_status',
          message: formatMeTokenCreationError({
            message: 'Transaction submitted but not yet confirmed.',
            policyId: operation.policyId,
            userOpHash: operation.hash,
          }),
          progress: 90,
          userOpHash: operation.hash,
        });
      }
    } catch (err) {
      logger.error('❌ MeToken creation failed:', err);

      const rawMessage = err instanceof Error ? err.message : String(err);
      const parsed = parseBundlerError(err as Error);
      const errorText = rawMessage.includes('Paymaster policy')
        ? rawMessage
        : formatMeTokenCreationError({
            message: parsed.message,
            policyId: meTokenGas.policyId,
          });

      updateState({
        status: 'error',
        message: parsed.message,
        progress: 0,
        error: `${errorText}\n\n💡 ${parsed.suggestion}`,
      });

      throw err;
    }
  }, [
    client,
    address,
    getGasContext,
    getMeTokenCreationGasContext,
    pollForMeToken,
    updateState,
  ]);

  const checkPendingTransactions = useCallback(async () => {
    const pending = getPendingTransactions();
    if (pending.length === 0) return;

    for (const tx of pending) {
      if (Date.now() - tx.createdAt > 24 * 60 * 60 * 1000) {
        removePendingTransaction(tx.userOpHash);
        continue;
      }

      if (tx.status === 'confirmed' && tx.meTokenAddress) {
        continue;
      }

      const meTokenAddress = await pollForMeToken(tx, 3);

      if (meTokenAddress) {
        tx.meTokenAddress = meTokenAddress;
        tx.status = 'confirmed';
        savePendingTransaction(tx);
        setPendingTransactions(prev =>
          prev.map(t => t.userOpHash === tx.userOpHash ? tx : t)
        );
      }
    }

    setPendingTransactions(getPendingTransactions());
  }, [pollForMeToken]);

  const clearPendingTransaction = useCallback((userOpHash: string) => {
    removePendingTransaction(userOpHash);
    setPendingTransactions(prev => prev.filter(t => t.userOpHash !== userOpHash));
  }, []);

  const retryPendingTransaction = useCallback(async (tx: PendingMeTokenTransaction) => {
    const existing = await pollForMeToken(tx, 3);

    if (existing) {
      tx.meTokenAddress = existing;
      tx.status = 'confirmed';
      savePendingTransaction(tx);
      setPendingTransactions(prev =>
        prev.map(t => t.userOpHash === tx.userOpHash ? tx : t)
      );

      updateState({
        status: 'success',
        message: 'Found your existing MeToken!',
        progress: 100,
        meTokenAddress: existing,
      });

      return;
    }

    await createMeToken({
      name: tx.name,
      symbol: tx.symbol,
      hubId: tx.hubId,
      assetsDeposited: tx.assetsDeposited,
    });
  }, [createMeToken, pollForMeToken, updateState]);

  useEffect(() => {
    if (address) {
      checkPendingTransactions();
    }
  }, [address, checkPendingTransactions]);

  return {
    state,
    createMeToken,
    checkPendingTransactions,
    pendingTransactions,
    clearPendingTransaction,
    retryPendingTransaction,
  };
}
