import { NextRequest, NextResponse } from 'next/server';
import { checkBotIdDeep } from '@/lib/middleware/botIdGuard';
import { meTokenSupabaseService } from '@/lib/sdk/supabase/metokens';
import { serverLogger } from '@/lib/utils/logger';
import { rateLimiters } from '@/lib/middleware/rateLimit';
import { requireWalletAuthFor, WalletAuthError } from '@/lib/auth/require-wallet';
import { isValidEthAddress } from '@/lib/auth/validate-address';
import { verifyMeTokenTransaction } from '@/lib/metokens/verifyMeTokenTransaction';
import { TransactionVerificationError } from '@/lib/chain/verifyTransactionReceipt';
import { syncMeTokenMarketData } from '@/lib/metokens/syncMeTokenMarketData';

// GET /api/metokens/[address]/transactions - Get MeToken transactions
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    const { searchParams } = new URL(request.url);

    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const userAddress = searchParams.get('userAddress');

    if (!address) {
      return NextResponse.json(
        { error: 'MeToken address is required' },
        { status: 400 }
      );
    }

    const transactions = await meTokenSupabaseService.getMeTokenTransactions(address, {
      limit,
      offset,
      userAddress: userAddress || undefined,
    });

    return NextResponse.json({ data: transactions });
  } catch (error) {
    serverLogger.error('Error fetching MeToken transactions:', error);

    // Handle specific error types
    if (error instanceof Error) {
      // Check for database connection errors
      if (error.message.includes('connection') || error.message.includes('timeout')) {
        return NextResponse.json(
          {
            error: 'Database connection error',
            details: 'Unable to connect to the database. Please try again later.'
          },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch transactions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/metokens/[address]/transactions - Record a new transaction
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const verification = await checkBotIdDeep();
  if (verification.isBot) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }
  const rl = await rateLimiters.standard(request);
  if (rl) return rl;

  let address: string | undefined;
  try {
    const resolvedParams = await params;
    address = resolvedParams.address;

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

    if (!address) {
      return NextResponse.json(
        { error: 'MeToken address is required' },
        { status: 400 }
      );
    }

    if (!isValidEthAddress(address)) {
      return NextResponse.json(
        { error: 'Invalid MeToken address format' },
        { status: 400 }
      );
    }

    const {
      user_address,
      transaction_type,
      amount,
      collateral_amount,
      transaction_hash,
      block_number,
      video_id,
      playback_id,
    } = body;

    // Validate required fields
    if (!user_address || !transaction_type || amount === undefined || !transaction_hash) {
      const missingFields = [];
      if (!user_address) missingFields.push('user_address');
      if (!transaction_type) missingFields.push('transaction_type');
      if (amount === undefined) missingFields.push('amount');
      if (!transaction_hash) missingFields.push('transaction_hash');

      return NextResponse.json(
        {
          error: 'Missing required fields',
          missingFields,
          hint: 'All of the following fields are required: user_address, transaction_type, amount, transaction_hash'
        },
        { status: 400 }
      );
    }

    const normalizedUserAddress = user_address.trim().toLowerCase();

    if (!isValidEthAddress(normalizedUserAddress)) {
      return NextResponse.json(
        {
          error: 'Invalid user_address format',
          details: 'user_address must be a valid Ethereum address (0x followed by 40 hex characters)'
        },
        { status: 400 }
      );
    }

    if (!/^0x[a-fA-F0-9]{64}$/.test(String(transaction_hash).trim())) {
      return NextResponse.json(
        { error: 'Invalid transaction_hash format' },
        { status: 400 }
      );
    }

    try {
      await requireWalletAuthFor(request, normalizedUserAddress);
    } catch (authErr) {
      if (authErr instanceof WalletAuthError) {
        return NextResponse.json({ error: authErr.message }, { status: authErr.status });
      }
      throw authErr;
    }

    // Validate transaction_type is valid
    const validTransactionTypes = ['mint', 'burn', 'buy', 'sell', 'subscribe', 'unsubscribe', 'contribute', 'create', 'transfer'];
    if (!validTransactionTypes.includes(transaction_type)) {
      return NextResponse.json(
        {
          error: 'Invalid transaction_type',
          details: `transaction_type must be one of: ${validTransactionTypes.join(', ')}`,
          received: transaction_type
        },
        { status: 400 }
      );
    }

    // Validate amount is a valid number
    const amountNum = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
    if (isNaN(amountNum) || amountNum < 0) {
      return NextResponse.json(
        {
          error: 'Invalid amount',
          details: 'amount must be a non-negative number'
        },
        { status: 400 }
      );
    }

    // Get the MeToken to get its ID
    const meToken = await meTokenSupabaseService.getMeTokenByAddress(address);
    if (!meToken) {
      return NextResponse.json(
        { error: 'MeToken not found' },
        { status: 404 }
      );
    }

    let verified;
    try {
      verified = await verifyMeTokenTransaction({
        meTokenAddress: address,
        userAddress: normalizedUserAddress,
        transactionHash: transaction_hash,
        transactionType: transaction_type,
        claimedAmount: amount,
      });
    } catch (verifyErr) {
      if (verifyErr instanceof TransactionVerificationError) {
        return NextResponse.json(
          { error: verifyErr.message },
          { status: 400 },
        );
      }
      throw verifyErr;
    }

    const transactionData = {
      metoken_id: meToken.id,
      user_address: normalizedUserAddress,
      transaction_type,
      amount: verified.amount,
      collateral_amount,
      transaction_hash: verified.transactionHash,
      block_number: Number(verified.blockNumber),
      video_id,
      playback_id,
    };

    const result = await meTokenSupabaseService.recordTransaction(transactionData);

    // Keep TVL/supply in sync after trades so market stats and charts update
    const tradeTypes = ['mint', 'burn', 'buy', 'sell'];
    if (tradeTypes.includes(transaction_type)) {
      try {
        await syncMeTokenMarketData(address);
      } catch (syncErr) {
        serverLogger.warn('Post-trade market sync failed (non-critical):', syncErr);
      }
    }

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    serverLogger.error('Error recording transaction:', error);

    // Handle specific error types
    if (error instanceof Error) {
      // Check for not found errors
      if (error.message.includes('not found') || error.message.includes('does not exist')) {
        return NextResponse.json(
          {
            error: 'MeToken not found',
            details: address ? `No MeToken found with address: ${address}` : 'MeToken not found'
          },
          { status: 404 }
        );
      }

      // Check for duplicate transaction errors
      if (error.message.includes('duplicate') || error.message.includes('unique constraint')) {
        return NextResponse.json(
          {
            error: 'Transaction already recorded',
            details: 'A transaction with this hash already exists'
          },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to record transaction',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
