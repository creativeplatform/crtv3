"use client";
import { useState, useEffect, useCallback } from 'react';
import { useSmartAccountClient } from '@/lib/wallet/react';
import { formatEther, type Address } from 'viem';
import { DAI_TOKEN_ADDRESSES } from '@/lib/contracts/DAIToken';
import { getErc20Balance } from '@/lib/viem';
import { logger } from '@/lib/utils/logger';


interface DaiBalanceCheckerProps {
  onBalanceUpdate?: (balance: bigint) => void;
  className?: string;
}

export function DaiBalanceChecker({ onBalanceUpdate, className }: DaiBalanceCheckerProps) {
  const [daiBalance, setDaiBalance] = useState<bigint>(BigInt(0));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { client } = useSmartAccountClient({});

  const checkDaiBalance = useCallback(async () => {
    if (!client) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const balance = await getErc20Balance({
        token: DAI_TOKEN_ADDRESSES.base as Address,
        owner: client.account?.address as Address,
      });
      
      setDaiBalance(balance);
      onBalanceUpdate?.(balance);
    } catch (err) {
      logger.error('Failed to check DAI balance:', err);
      setError('Failed to fetch DAI balance');
    } finally {
      setIsLoading(false);
    }
  }, [client, onBalanceUpdate]);

  useEffect(() => {
    if (client) {
      checkDaiBalance();
    }
  }, [client, checkDaiBalance]);

  return {
    daiBalance,
    isLoading,
    error,
    checkDaiBalance,
    hasDai: daiBalance > BigInt(0),
    formattedBalance: formatEther(daiBalance),
  };
}

export default DaiBalanceChecker;
