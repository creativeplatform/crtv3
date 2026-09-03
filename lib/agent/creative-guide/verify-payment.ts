import { decodeEventLog } from 'viem';
import { publicClient } from '@/lib/viem';
import { USDC_TOKEN_ADDRESSES } from '@/lib/contracts/USDCToken';
import { serverLogger } from '@/lib/utils/logger';
import {
  CREATIVE_GUIDE_PAYMENT_MAX_AGE_MS,
  CREATIVE_GUIDE_PRICE,
  CREATIVE_GUIDE_RECIPIENT,
} from './constants';

/**
 * Verifies a USDC transfer to the Creative Guide recipient with amount >= CREATIVE_GUIDE_PRICE.
 */
export async function verifyCreativeGuidePaymentProof(
  transactionHash: string,
  amount: string,
): Promise<{ valid: boolean; error?: string }> {
  const requiredAmount = BigInt(CREATIVE_GUIDE_PRICE);

  let claimedAmount: bigint;
  try {
    claimedAmount = BigInt(amount);
  } catch {
    return { valid: false, error: 'Invalid payment amount' };
  }

  if (claimedAmount < requiredAmount) {
    return { valid: false, error: 'Payment amount is less than required' };
  }

  try {
    const receipt = await publicClient.getTransactionReceipt({
      hash: transactionHash as `0x${string}`,
    });

    if (!receipt) {
      return { valid: false, error: 'Transaction not found' };
    }
    if (receipt.status !== 'success') {
      return { valid: false, error: 'Transaction failed' };
    }

    const now = Date.now();
    const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });
    const blockTime = Number(block.timestamp) * 1000;
    if (now - blockTime > CREATIVE_GUIDE_PAYMENT_MAX_AGE_MS) {
      return { valid: false, error: 'Payment too old; please pay again and retry' };
    }

    const usdcAddress = USDC_TOKEN_ADDRESSES.base.toLowerCase();
    let foundTransfer = false;
    let transferValue = 0n;

    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== usdcAddress) continue;
      try {
        const decoded = decodeEventLog({
          abi: [
            {
              type: 'event',
              name: 'Transfer',
              inputs: [
                { name: 'from', type: 'address', indexed: true },
                { name: 'to', type: 'address', indexed: true },
                { name: 'value', type: 'uint256', indexed: false },
              ],
            },
          ],
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === 'Transfer') {
          const args = decoded.args as { from: string; to: string; value: bigint };
          if (args.to.toLowerCase() === CREATIVE_GUIDE_RECIPIENT.toLowerCase()) {
            foundTransfer = true;
            transferValue = args.value;
            break;
          }
        }
      } catch {
        continue;
      }
    }

    if (!foundTransfer || transferValue < requiredAmount) {
      return {
        valid: false,
        error: 'No valid USDC transfer to the service recipient found for this transaction',
      };
    }

    return { valid: true };
  } catch (err) {
    serverLogger.error('[CreativeGuide] Payment verification error:', err);
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Payment verification failed',
    };
  }
}
