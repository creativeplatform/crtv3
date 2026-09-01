import { NextRequest, NextResponse } from 'next/server';
import { checkBotIdDeep } from '@/lib/middleware/botIdGuard';
import { meTokenSupabaseService } from '@/lib/sdk/supabase/metokens';
import { meTokensSubgraph } from '@/lib/sdk/metokens/subgraph';
import { createServiceClient } from '@/lib/sdk/supabase/service';
import { 
  extractMeTokenAddressFromTransaction, 
  getMeTokenInfoFromBlockchain, 
  getMeTokenProtocolInfo 
} from '@/lib/utils/metokenUtils';
import { serverLogger } from '@/lib/utils/logger';
import { rateLimiters } from '@/lib/middleware/rateLimit';
import { calculateMeTokenVaultTvlUsd, formatHubAssetAmount, resolveHubAsset } from '@/lib/utils/hubAssetUtils';
import { formatEther } from 'viem';

// POST /api/metokens/sync - Sync a MeToken from blockchain to database
export async function POST(request: NextRequest) {
  const verification = await checkBotIdDeep();
  if (verification.isBot) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }
  const rl = await rateLimiters.standard(request);
  if (rl) return rl;

  try {
    const body = await request.json();
    const { transactionHash, meTokenAddress } = body;

    serverLogger.debug('Sync request:', { transactionHash, meTokenAddress });

    if (!transactionHash && !meTokenAddress) {
      return NextResponse.json(
        { error: 'Either transactionHash or meTokenAddress is required' },
        { status: 400 }
      );
    }

    let targetMeTokenAddress = meTokenAddress;

    // If we have a transaction hash, extract the MeToken address from it
    if (transactionHash && !meTokenAddress) {
      targetMeTokenAddress = await extractMeTokenAddressFromTransaction(transactionHash);
      
      if (!targetMeTokenAddress) {
        return NextResponse.json(
          { error: 'Could not extract MeToken address from transaction' },
          { status: 400 }
        );
      }
    }

    if (!targetMeTokenAddress) {
      return NextResponse.json(
        { error: 'MeToken address is required' },
        { status: 400 }
      );
    }

    serverLogger.debug('Target MeToken address:', targetMeTokenAddress);

    // Check if MeToken already exists in database
    const existingMeToken = await meTokenSupabaseService.getMeTokenByAddress(targetMeTokenAddress);
    if (existingMeToken) {
      serverLogger.debug('MeToken already in database');
      return NextResponse.json(
        { 
          message: 'MeToken already exists in database',
          data: existingMeToken 
        },
        { status: 200 }
      );
    }

    // Check if the MeToken exists in the subgraph (informational, not required)
    // For newly created MeTokens, the subgraph may not have indexed them yet
    serverLogger.debug('Checking subgraph for MeToken...');
    const subgraphData = await meTokensSubgraph.checkMeTokenExists(targetMeTokenAddress);
    
    if (subgraphData) {
      serverLogger.debug('Found MeToken in subgraph');
    } else {
      serverLogger.warn('MeToken not found in subgraph - will sync from blockchain (subgraph may not have indexed it yet)');
    }

    serverLogger.debug('Fetching blockchain data...');

    // Get MeToken information from blockchain
    // Note: For newly created MeTokens, the Diamond might not be fully synced yet
    // So we'll be lenient and use default values if needed
    let tokenInfo, protocolInfo;
    
    try {
      [tokenInfo, protocolInfo] = await Promise.all([
        getMeTokenInfoFromBlockchain(targetMeTokenAddress),
        getMeTokenProtocolInfo(targetMeTokenAddress)
      ]);
    } catch (error) {
      serverLogger.warn('Failed to get full blockchain data, using subgraph data:', error);
    }

    if (!tokenInfo) {
      serverLogger.error('Token info not available from blockchain - cannot proceed');
      return NextResponse.json(
        { error: 'Unable to fetch token information from blockchain. The MeToken may not be fully registered yet. Please try again in a few moments.' },
        { status: 503 }
      );
    }

    if (!protocolInfo) {
      serverLogger.warn('Protocol info not available from blockchain, using defaults');
      // Use subgraph data if available, otherwise use defaults
      const hubId = subgraphData?.hubId ? parseInt(subgraphData.hubId) : 1;
      const assetsDeposited = subgraphData?.assetsDeposited || '0';
      protocolInfo = {
        hubId: hubId,
        balancePooled: assetsDeposited,
        balanceLocked: '0',
        startTime: 0,
        endTime: 0,
        endCooldown: 0,
        targetHubId: 0,
        migration: ''
      };
    }

    serverLogger.debug('Got blockchain data:', { tokenInfo, protocolInfo });

    // Calculate TVL (Total Value Locked) with hub-specific collateral decimals
    const balancePooled = BigInt(protocolInfo.balancePooled);
    const balanceLocked = BigInt(protocolInfo.balanceLocked);
    const hubId = protocolInfo.hubId;
    const hubAsset = resolveHubAsset(hubId);
    const tvl = calculateMeTokenVaultTvlUsd(balancePooled, balanceLocked, hubId);

    // Create MeToken data for database
    const meTokenData = {
      address: targetMeTokenAddress.toLowerCase(),
      owner_address: tokenInfo.owner.toLowerCase(),
      name: tokenInfo.name,
      symbol: tokenInfo.symbol,
      total_supply: Number(formatEther(BigInt(tokenInfo.totalSupply))), // MeToken ERC-20 is 18 decimals
      tvl: tvl,
      hub_id: hubId,
      balance_pooled: Number(formatHubAssetAmount(balancePooled, hubAsset)),
      balance_locked: Number(formatHubAssetAmount(balanceLocked, hubAsset)),
      start_time: protocolInfo.startTime > 0 ? new Date(protocolInfo.startTime * 1000).toISOString() : undefined,
      end_time: protocolInfo.endTime > 0 ? new Date(protocolInfo.endTime * 1000).toISOString() : undefined,
      end_cooldown: protocolInfo.endCooldown > 0 ? new Date(protocolInfo.endCooldown * 1000).toISOString() : undefined,
      target_hub_id: protocolInfo.targetHubId > 0 ? protocolInfo.targetHubId : undefined,
      migration_address: protocolInfo.migration !== '0x0000000000000000000000000000000000000000' ? protocolInfo.migration : undefined,
    };

    // Create the MeToken in the database using service client to bypass RLS
    // This is a server-side operation, so we use the service role client
    const supabase = createServiceClient();
    const { data: result, error: createError } = await supabase
      .from('metokens')
      .insert({
        ...meTokenData,
        address: meTokenData.address.toLowerCase(),
        owner_address: meTokenData.owner_address.toLowerCase(),
      })
      .select()
      .single();

    if (createError) {
      serverLogger.error('Error creating MeToken record:', createError);
      return NextResponse.json(
        { error: 'Failed to create MeToken record in database', details: createError.message },
        { status: 500 }
      );
    }

    // Record the creation transaction if we have a transaction hash
    if (transactionHash) {
      try {
        const { error: txError } = await supabase
          .from('metoken_transactions')
          .insert({
            metoken_id: result.id,
            user_address: tokenInfo.owner.toLowerCase(),
            transaction_type: 'create',
            amount: 0,
            transaction_hash: transactionHash,
            block_number: 0, // We could get this from the transaction receipt if needed
          });
        
        if (txError) {
          serverLogger.error('Failed to record creation transaction:', txError);
          // Don't fail the whole operation if we can't record the transaction
        }
      } catch (error) {
        serverLogger.error('Failed to record creation transaction:', error);
        // Don't fail the whole operation if we can't record the transaction
      }
    }

    return NextResponse.json({ 
      message: 'MeToken synced successfully',
      data: result 
    }, { status: 201 });

  } catch (error) {
    serverLogger.error('Error syncing MeToken:', error);
    return NextResponse.json(
      { error: 'Failed to sync MeToken', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
