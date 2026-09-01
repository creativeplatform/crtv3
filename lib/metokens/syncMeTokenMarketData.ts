import { createPublicClient, http, formatEther, parseAbi } from 'viem';
import { baseMainnet } from '@/lib/utils/chains/base';
import { getMeTokenProtocolInfo } from '@/lib/utils/metokenUtils';
import { createServiceClient } from '@/lib/sdk/supabase/service';
import { serverLogger } from '@/lib/utils/logger';
import { calculateMeTokenVaultTvlUsd } from '@/lib/utils/hubAssetUtils';

const ERC20_ABI = parseAbi(['function totalSupply() view returns (uint256)']);

export const MIN_ACTIVE_MARKET_TVL = 0.1;

export interface SyncedMeTokenMarketData {
  tvl: number;
  total_supply: string;
  price: number;
}

/**
 * Fetch live TVL/supply from chain and persist to Supabase.
 * Called after trades so market stats and charts reflect on-chain state.
 */
export async function syncMeTokenMarketData(
  address: string
): Promise<SyncedMeTokenMarketData | null> {
  const meTokenAddress = address.toLowerCase() as `0x${string}`;

  try {
    const publicClient = createPublicClient({
      chain: baseMainnet,
      transport: http(
        process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL || process.env.NEXT_PUBLIC_BASE_RPC_URL
      ),
    });

    const [protocolInfo, totalSupply] = await Promise.all([
      getMeTokenProtocolInfo(meTokenAddress),
      publicClient.readContract({
        address: meTokenAddress,
        abi: ERC20_ABI,
        functionName: 'totalSupply',
      }) as Promise<bigint>,
    ]);

    if (!protocolInfo) {
      serverLogger.warn(`syncMeTokenMarketData: no protocol info for ${meTokenAddress}`);
      return null;
    }

    const balancePooled = BigInt(protocolInfo.balancePooled || 0);
    const balanceLocked = BigInt(protocolInfo.balanceLocked || 0);
    // Collateral decimals depend on hub (USDC=6; DAI/USDS/GHO=18). MeToken supply is always 18.
    const tvl = calculateMeTokenVaultTvlUsd(
      balancePooled,
      balanceLocked,
      protocolInfo.hubId
    );
    const supply = parseFloat(formatEther(totalSupply));
    const price = supply > 0 ? tvl / supply : 0;

    const supabase = createServiceClient();
    const { error } = await supabase
      .from('metokens')
      .update({
        tvl,
        total_supply: totalSupply.toString(),
        updated_at: new Date().toISOString(),
      })
      .eq('address', meTokenAddress);

    if (error) {
      serverLogger.error(`syncMeTokenMarketData: failed to update ${meTokenAddress}:`, error);
      return null;
    }

    return {
      tvl,
      total_supply: totalSupply.toString(),
      price,
    };
  } catch (error) {
    serverLogger.error(`syncMeTokenMarketData: error for ${meTokenAddress}:`, error);
    return null;
  }
}

export function isActiveMarketToken(tvl: number): boolean {
  return tvl >= MIN_ACTIVE_MARKET_TVL;
}
