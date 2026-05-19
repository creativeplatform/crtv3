import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, formatEther } from 'viem';
import { baseMainnet } from '@/lib/utils/chains/base';
import { meTokensSubgraph } from '@/lib/sdk/metokens/subgraph';
import { getMeTokenInfoFromBlockchain, getMeTokenProtocolInfo } from '@/lib/utils/metokenUtils';
import { serverLogger } from '@/lib/utils/logger';

// ERC20 ABI for totalSupply
const ERC20_ABI = [
  {
    constant: true,
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    type: 'function',
  },
] as const;

// Create a public client for reading blockchain data
const publicClient = createPublicClient({
  chain: baseMainnet,
  transport: http(process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL || process.env.NEXT_PUBLIC_BASE_RPC_URL, {
    fetchOptions: {
      headers: {
        "Accept-Encoding": "gzip",
      },
    },
  }),
});

// GET /api/market/tokens/[address]/fresh - Get fresh MeToken data from blockchain
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    
    if (!address) {
      return NextResponse.json(
        { error: 'MeToken address is required' },
        { status: 400 }
      );
    }

    const meTokenAddress = address.toLowerCase() as `0x${string}`;

    // Fetch fresh data from blockchain
    const [tokenInfo, protocolInfo, totalSupply] = await Promise.all([
      getMeTokenInfoFromBlockchain(meTokenAddress),
      getMeTokenProtocolInfo(meTokenAddress),
      publicClient.readContract({
        address: meTokenAddress,
        abi: ERC20_ABI,
        functionName: 'totalSupply',
      }) as Promise<bigint>,
    ]);

    // Validate that we got the required data
    if (!tokenInfo) {
      return NextResponse.json(
        { error: 'Failed to fetch MeToken info from blockchain' },
        { status: 404 }
      );
    }

    if (!protocolInfo) {
      return NextResponse.json(
        { error: 'Failed to fetch MeToken protocol info from blockchain' },
        { status: 404 }
      );
    }

    // Calculate TVL
    const balancePooled = BigInt(protocolInfo.balancePooled || 0);
    const balanceLocked = BigInt(protocolInfo.balanceLocked || 0);
    const totalBalance = balancePooled + balanceLocked;
    const tvl = parseFloat(formatEther(totalBalance));

    // Calculate price
    const supply = parseFloat(formatEther(totalSupply));
    const price = supply > 0 ? tvl / supply : 0;

    // Get creation data from subgraph (optional, for metadata)
    let creationData = null;
    try {
      const subgraphData = await meTokensSubgraph.checkMeTokenExists(meTokenAddress);
      if (subgraphData) {
        creationData = {
          assetsDeposited: subgraphData.assetsDeposited,
        };
      }
    } catch (error) {
      serverLogger.warn('Failed to fetch subgraph data:', error);
      // Continue without subgraph data
    }

    return NextResponse.json({
      data: {
        address: meTokenAddress,
        owner_address: tokenInfo.owner.toLowerCase(),
        name: tokenInfo.name,
        symbol: tokenInfo.symbol,
        total_supply: totalSupply.toString(),
        tvl,
        price,
        balance_pooled: parseFloat(formatEther(balancePooled)),
        balance_locked: parseFloat(formatEther(balanceLocked)),
        hub_id: Number(protocolInfo.hubId),
        start_time: protocolInfo.startTime > 0 ? new Date(Number(protocolInfo.startTime) * 1000).toISOString() : null,
        end_time: protocolInfo.endTime > 0 ? new Date(Number(protocolInfo.endTime) * 1000).toISOString() : null,
        end_cooldown: protocolInfo.endCooldown > 0 ? new Date(Number(protocolInfo.endCooldown) * 1000).toISOString() : null,
        target_hub_id: protocolInfo.targetHubId > 0 ? Number(protocolInfo.targetHubId) : null,
        migration_address: protocolInfo.migration !== '0x0000000000000000000000000000000000000000' ? protocolInfo.migration : null,
        creation_data: creationData,
        fetched_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    serverLogger.error('Error fetching fresh MeToken data:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch fresh MeToken data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

