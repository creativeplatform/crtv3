import { Address } from 'viem';
import { METOKEN_FACTORY_BASE } from '@/lib/contracts/metokens/deployments';

export const METOKEN_FACTORY_ADDRESSES = {
  base: METOKEN_FACTORY_BASE as Address,
  // Add other networks as needed
} as const;

export const METOKEN_FACTORY_ABI = [
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "name",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "symbol",
        "type": "string"
      },
      {
        "internalType": "address",
        "name": "diamond",
        "type": "address"
      }
    ],
    "name": "create",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

export const getMeTokenFactoryContract = (chainId: keyof typeof METOKEN_FACTORY_ADDRESSES) => ({
  address: METOKEN_FACTORY_ADDRESSES[chainId],
  abi: METOKEN_FACTORY_ABI,
});

export type MeTokenFactoryContract = ReturnType<typeof getMeTokenFactoryContract>;
