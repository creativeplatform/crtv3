import { NextRequest, NextResponse } from 'next/server';
import { checkBotIdDeep } from '@/lib/middleware/botIdGuard';
import { createClient } from '@/lib/sdk/supabase/server';
import { MeTokenCreationParams } from '@/lib/sdk/alchemy/metoken-service';
import { serverLogger } from '@/lib/utils/logger';
import { rateLimiters } from '@/lib/middleware/rateLimit';
import { METOKEN_DIAMOND_BASE } from '@/lib/contracts/metokens/deployments';

// Force dynamic route to avoid build-time evaluation
export const dynamic = 'force-dynamic';

async function getAllchemyService() {
  const { alchemyMeTokenService } = await import('@/lib/sdk/alchemy/metoken-service');
  return alchemyMeTokenService.instance;
}

export async function POST(request: NextRequest) {
  const verification = await checkBotIdDeep();
  if (verification.isBot) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }
  const rl = await rateLimiters.standard(request);
  if (rl) return rl;

  const alchemyMeTokenService = await getAllchemyService();
  try {
    const supabase = await createClient();
    
    // Handle JSON parsing errors
    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      serverLogger.error('Invalid JSON in request body:', jsonError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      name,
      symbol,
      hubId,
      assetsDeposited,
      creatorAddress,
      transactionHash,
    } = body;

    // Validate required fields
    if (!name || !symbol || !hubId || !assetsDeposited || !creatorAddress) {
      const missingFields = [];
      if (!name) missingFields.push('name');
      if (!symbol) missingFields.push('symbol');
      if (!hubId) missingFields.push('hubId');
      if (!assetsDeposited) missingFields.push('assetsDeposited');
      if (!creatorAddress) missingFields.push('creatorAddress');
      
      return NextResponse.json(
        { 
          error: 'Missing required fields',
          missingFields,
          hint: 'All of the following fields are required: name, symbol, hubId, assetsDeposited, creatorAddress'
        },
        { status: 400 }
      );
    }
    
    // Validate hubId is a positive number
    const hubIdNum = typeof hubId === 'string' ? parseInt(hubId, 10) : Number(hubId);
    if (isNaN(hubIdNum) || hubIdNum <= 0) {
      return NextResponse.json(
        { 
          error: 'Invalid hubId',
          details: 'hubId must be a positive number'
        },
        { status: 400 }
      );
    }
    
    // Validate assetsDeposited is a non-negative number
    const assetsDepositedNum = typeof assetsDeposited === 'string' ? parseFloat(assetsDeposited) : Number(assetsDeposited);
    if (isNaN(assetsDepositedNum) || assetsDepositedNum < 0) {
      return NextResponse.json(
        { 
          error: 'Invalid assetsDeposited',
          details: 'assetsDeposited must be a non-negative number'
        },
        { status: 400 }
      );
    }
    
    // Validate creatorAddress format
    const addressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!addressRegex.test(creatorAddress)) {
      return NextResponse.json(
        { 
          error: 'Invalid creatorAddress format',
          details: 'creatorAddress must be a valid Ethereum address (0x followed by 40 hex characters)'
        },
        { status: 400 }
      );
    }

    // Validate that the creator address matches the authenticated user
    if (creatorAddress.toLowerCase() !== user.id.toLowerCase()) {
      return NextResponse.json(
        { error: 'Creator address does not match authenticated user' },
        { status: 403 }
      );
    }

    serverLogger.debug('Processing Alchemy MeToken creation:', {
      name,
      symbol,
      hubId,
      assetsDeposited,
      creatorAddress,
      transactionHash,
    });

    // Check if MeToken already exists for this creator
    const { data: existingMeToken, error: checkError } = await supabase
      .from('metokens')
      .select('*')
      .eq('owner_address', creatorAddress.toLowerCase())
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
      serverLogger.error('Error checking existing MeToken:', checkError);
      return NextResponse.json(
        { error: 'Failed to check existing MeToken' },
        { status: 500 }
      );
    }

    if (existingMeToken) {
      return NextResponse.json(
        { 
          error: 'Creator already has a MeToken. Each address can only create one MeToken.',
          existingMeToken: {
            address: existingMeToken.address,
            name: existingMeToken.name,
            symbol: existingMeToken.symbol,
          }
        },
        { status: 409 }
      );
    }

    // If transaction hash is provided, track the existing transaction
    if (transactionHash) {
      serverLogger.debug('Tracking existing MeToken creation transaction:', transactionHash);
      
      // Wait for blockchain confirmation and extract MeToken address
      const meTokenAddress = await waitForMeTokenCreation(transactionHash);
      
      if (!meTokenAddress) {
        return NextResponse.json(
          { error: 'Failed to extract MeToken address from transaction' },
          { status: 400 }
        );
      }

      // Get MeToken info from blockchain
      const meTokenInfo = await alchemyMeTokenService.getMeTokenInfo(meTokenAddress);
      
      if (!meTokenInfo) {
        return NextResponse.json(
          { error: 'Failed to retrieve MeToken information from blockchain' },
          { status: 400 }
        );
      }

      // Store the MeToken in database
      const meTokenData = {
        address: meTokenAddress.toLowerCase(),
        owner_address: creatorAddress.toLowerCase(),
        name,
        symbol,
        total_supply: parseFloat(assetsDeposited), // Initial supply equals deposited amount
        tvl: parseFloat(assetsDeposited),
        hub_id: hubId,
        balance_pooled: parseFloat(meTokenInfo.balancePooled),
        balance_locked: parseFloat(meTokenInfo.balanceLocked),
        start_time: meTokenInfo.startTime > 0 ? new Date(meTokenInfo.startTime * 1000).toISOString() : new Date().toISOString(),
        end_time: meTokenInfo.endTime > 0 ? new Date(meTokenInfo.endTime * 1000).toISOString() : undefined,
        target_hub_id: meTokenInfo.targetHubId > 0 ? meTokenInfo.targetHubId : undefined,
        migration_address: meTokenInfo.migration !== '0x0000000000000000000000000000000000000000' ? meTokenInfo.migration : undefined,
      };

      const { data: createdMeToken, error: createError } = await supabase
        .from('metokens')
        .insert(meTokenData)
        .select()
        .single();

      if (createError) {
        serverLogger.error('Error creating MeToken record:', createError);
        return NextResponse.json(
          { error: 'Failed to create MeToken record in database' },
          { status: 500 }
        );
      }

      // Record the creation transaction
      await supabase
        .from('metoken_transactions')
        .insert({
          metoken_id: createdMeToken.id,
          user_address: creatorAddress.toLowerCase(),
          transaction_type: 'create',
          amount: parseFloat(assetsDeposited),
          transaction_hash: transactionHash,
          created_at: new Date().toISOString(),
        });

      return NextResponse.json({ 
        success: true,
        meToken: createdMeToken,
        meTokenAddress,
        transactionHash,
        blockchainInfo: meTokenInfo
      }, { status: 201 });
    }

    // For new transactions, provide instructions for client-side execution
    return NextResponse.json({
      success: false,
      error: 'Transaction hash required. Please create the MeToken on the client side and provide the transaction hash.',
      instructions: {
        step1: 'Use the Alchemy SDK on the client side to create the MeToken',
        step2: 'Call the Diamond contract subscribe function',
        step3: 'Provide the resulting transaction hash to this endpoint',
        step4: 'This endpoint will track and store the MeToken data'
      },
      contractInfo: {
        diamondAddress: '0xba5502db2aC2cBff189965e991C07109B14eB3f5',
        daiAddress: '0x50c5725949a6f0c72e6c4a641f24049a917db0cb',
        hubId: hubId,
        assetsDeposited: assetsDeposited
      }
    }, { status: 400 });

  } catch (error) {
    serverLogger.error('Alchemy MeToken creation error:', error);
    
    // Handle specific error types
    if (error instanceof Error) {
      // Check for authentication errors
      if (error.message.includes('Unauthorized') || error.message.includes('authentication')) {
        return NextResponse.json(
          { 
            error: 'Authentication failed',
            details: 'User authentication is required to create MeTokens'
          },
          { status: 401 }
        );
      }
      
      // Check for network/connection errors
      if (error.message.includes('network') || error.message.includes('fetch') || error.message.includes('ECONNREFUSED')) {
        return NextResponse.json(
          { 
            error: 'Network error',
            details: 'Unable to connect to blockchain or Alchemy service. Please check your network connection and try again.'
          },
          { status: 503 }
        );
      }
      
      // Check for transaction errors
      if (error.message.includes('transaction') || error.message.includes('revert') || error.message.includes('execution reverted')) {
        return NextResponse.json(
          { 
            error: 'Transaction failed',
            details: error.message
          },
          { status: 400 }
        );
      }
      
      // Check for insufficient funds errors
      if (error.message.includes('insufficient') || error.message.includes('balance') || error.message.includes('gas')) {
        return NextResponse.json(
          { 
            error: 'Insufficient funds',
            details: 'Insufficient balance to create MeToken or pay for gas fees'
          },
          { status: 400 }
        );
      }
    }
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        details: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * Wait for MeToken creation transaction and extract the MeToken address
 * This function uses the Alchemy SDK to get transaction details and parse logs
 */
async function waitForMeTokenCreation(transactionHash: string): Promise<string | null> {
  try {
    serverLogger.debug('Waiting for transaction confirmation:', transactionHash);
    
    const alchemyMeTokenService = await getAllchemyService();
    
    // Use Alchemy SDK to get transaction receipt
    const receipt = await alchemyMeTokenService['alchemy'].core.getTransactionReceipt(transactionHash);
    
    if (!receipt) {
      serverLogger.error('Transaction receipt not found');
      return null;
    }

    serverLogger.debug('Transaction confirmed, extracting MeToken address...');
    
    // Parse logs to find the Subscribe event
    const diamondAddress = METOKEN_DIAMOND_BASE;
    
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() === diamondAddress.toLowerCase()) {
        // Look for the Subscribe event
        // The Subscribe event has the MeToken address as the first indexed parameter
        if (log.topics && log.topics.length > 1) {
          const topic = log.topics[1];
          
          // Validate topic format: should start with '0x' and be 66 chars (32 bytes hex)
          if (typeof topic === 'string' && topic.startsWith('0x') && topic.length === 66) {
            // The MeToken address is in the second topic (first indexed parameter)
            // Remove '0x' prefix and first 24 characters (12 bytes of padding)
            const meTokenAddress = '0x' + topic.slice(26);
            serverLogger.debug('Extracted MeToken address:', meTokenAddress);
            return meTokenAddress;
          } else {
            serverLogger.warn('Invalid topic format, skipping log:', { topic, length: topic?.length });
          }
        }
      }
    }
    
    serverLogger.error('MeToken address not found in transaction logs');
    return null;
    
  } catch (error) {
    serverLogger.error('Failed to wait for MeToken creation:', error);
    return null;
  }
}
