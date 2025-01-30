'use client';

import { viemAdapter } from 'thirdweb/adapters/viem';
import type { WalletClient } from 'viem';
import { client } from '@app/lib/sdk/thirdweb/client';
import { useBlockNumber } from 'thirdweb/react';
import { base } from 'thirdweb/chains';

/**
 * Converts a viem wallet client to a thirdweb account
 * @param walletClient - The viem wallet client to convert
 * @returns A thirdweb account that can be used with the SDK
 */
export async function viemWalletToThirdwebAccount(walletClient: WalletClient) {
  // Cast the wallet client to any to bypass type checking between different viem versions
  return await viemAdapter.walletClient.fromViem({
    walletClient: walletClient as any,
  });
}

/**
 * Converts a thirdweb account to a viem wallet client
 * @param account - The thirdweb account to convert
 * @returns A viem wallet client that can be used with viem
 */
export function thirdwebAccountToViemWallet(account: any) {
  return viemAdapter.walletClient.toViem({
    client,
    chain: base,
    account,
  });
}

/**
 * Gets the current block number
 * @returns The current block number
 */
export async function GetCurrentBlockNumber() {
  const blockNumber = useBlockNumber({ client, chain: base });
  return blockNumber;
}
