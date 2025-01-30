'use client';

import { useBlockNumber } from 'wagmi';
import { base } from 'viem/chains';

export function useCurrentBlockNumber() {
  const { data: blockNumber } = useBlockNumber({ 
    chainId: base.id,
    watch: false
  });
  
  return blockNumber;
}
