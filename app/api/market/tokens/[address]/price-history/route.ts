import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/sdk/supabase/server';
import { formatEther, createPublicClient, http, fallback, parseAbi } from 'viem';
import { baseMainnet } from '@/lib/utils/chains/base';
import { METOKEN_ABI } from '@/lib/contracts/MeToken';
import { serverLogger } from '@/lib/utils/logger';

const DIAMOND = '0xba5502db2aC2cBff189965e991C07109B14eB3f5';

export interface PriceHistoryPoint {
  timestamp: number;
  price: number;
  volume: number;
  tvl: number;
}

// GET /api/market/tokens/[address]/price-history - Get price history for a token
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    const { searchParams } = new URL(request.url);

    const period = searchParams.get('period') as '7d' | '30d' | 'all' || '7d';
    const interval = searchParams.get('interval') as 'hour' | 'day' || 'hour';

    if (!address) {
      return NextResponse.json(
        { error: 'Token address is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get MeToken info
    const { data: meToken, error: meTokenError } = await supabase
      .from('metokens')
      .select('id, address, total_supply, tvl')
      .eq('address', address.toLowerCase())
      .single();

    if (meTokenError) {
      serverLogger.error('Error fetching MeToken:', meTokenError);
      // If it's a "not found" error, return 404
      if (meTokenError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Token not found' },
          { status: 404 }
        );
      }
      // Otherwise return 500
      return NextResponse.json(
        { error: 'Failed to fetch token information', details: meTokenError.message },
        { status: 500 }
      );
    }

    if (!meToken) {
      return NextResponse.json(
        { error: 'Token not found' },
        { status: 404 }
      );
    }

    // Calculate time range
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
        startDate = new Date(0); // Beginning of time
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Fetch transactions for this token
    const { data: transactions, error: txError } = await supabase
      .from('metoken_transactions')
      .select('created_at, transaction_type, amount, collateral_amount') // Removed non-existent columns
      .eq('metoken_id', meToken.id)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    // Calculate current price for fallback response
    // Calculate current price for fallback response
    let currentTotalSupply = BigInt(meToken.total_supply || 0);
    let currentTvl = meToken.tvl || 0;

    // Fallback to blockchain if data is zero/missing in DB
    // This ensures we show the correct price even if the DB indexer is lagging
    if (currentTotalSupply === BigInt(0) || currentTvl === 0) {
      try {
        serverLogger.debug('DB data missing/zero, fetching from blockchain for:', meToken.address);
        const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
        const alchemyRpc = process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL;
        const baseRpc = process.env.NEXT_PUBLIC_BASE_RPC_URL;
        const rpcUrls: string[] = [];
        if (apiKey) rpcUrls.push(`https://base-mainnet.g.alchemy.com/v2/${apiKey}`);
        if (alchemyRpc) rpcUrls.push(alchemyRpc);
        if (baseRpc) rpcUrls.push(baseRpc);
        rpcUrls.push('https://mainnet.base.org');

        const publicClient = createPublicClient({
          chain: baseMainnet,
          transport: fallback(rpcUrls.map((url) => http(url))),
        });

        // Fetch fresh data
        const [totalSupply, infoData] = await Promise.all([
          publicClient.readContract({
            address: meToken.address as `0x${string}`,
            abi: parseAbi(['function totalSupply() view returns (uint256)']),
            functionName: 'totalSupply',
          }) as Promise<bigint>,
          publicClient.readContract({
            address: DIAMOND,
            abi: METOKEN_ABI,
            functionName: 'getMeTokenInfo',
            args: [meToken.address as `0x${string}`],
          }) as Promise<any>
        ]);

        if (totalSupply) {
          currentTotalSupply = totalSupply;
        }

        if (infoData) {
          // TVL = pooled + locked (in DAI terms)
          // Note: The struct return might vary depending on viem version/ABI parsing, 
          // usually it returns an object if named outputs, or array.
          // Based on useMeTokensSupabase, it seems to return an object property access compatible result
          const balancePooled = BigInt(infoData.balancePooled || infoData[2] || 0);
          const balanceLocked = BigInt(infoData.balanceLocked || infoData[3] || 0);
          currentTvl = parseFloat(formatEther(balancePooled + balanceLocked));
        }

        serverLogger.debug('Fetched live data:', {
          supply: currentTotalSupply.toString(),
          tvl: currentTvl
        });

      } catch (chainErr) {
        serverLogger.warn('Failed to fetch live blockchain data:', chainErr);
      }
    }

    const currentPrice = currentTotalSupply > 0
      ? currentTvl / parseFloat(formatEther(currentTotalSupply))
      : 0;

    serverLogger.debug('Final price values (DB + Chain fallback):', {
      address: meToken.address,
      dbSupply: meToken.total_supply,
      dbTvl: meToken.tvl,
      finalSupply: currentTotalSupply.toString(),
      finalTvl: currentTvl,
      calculatedPrice: currentPrice,
    });

    if (txError) {
      serverLogger.error('Error fetching transactions:', txError);
      // Return empty history instead of error if query fails
      return NextResponse.json({
        data: [],
        token: {
          address: meToken.address,
          current_price: currentPrice,
          current_tvl: meToken.tvl,
        },
      });
    }

    // Group transactions by time interval
    const historyMap = new Map<string, {
      timestamp: number;
      prices: number[];
      volumes: number[];
      tvls: number[];
    }>();

    const currentTimestamp = Math.floor(now.getTime() / 1000);
    const currentKey = interval === 'hour'
      ? new Date(currentTimestamp * 1000).toISOString().slice(0, 13) + ':00:00'
      : new Date(currentTimestamp * 1000).toISOString().slice(0, 10);

    // Process transactions to build price history
    // Logic: We have the *Current* state (reliable) and the list of transactions in the period.
    // To find the *Start* state (at startDate), we must "reverse replay" the transactions from Current backwards.
    // Then we can forward replay to generate the points.

    let runningSupply = BigInt(0);
    let runningTvl = 0;

    // 1. Reverse Replay to find initial state
    let replaySupply = currentTotalSupply;
    let replayTvl = currentTvl;

    // Sort descending for reverse replay
    const reverseTxs = [...(transactions || [])].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    for (const tx of reverseTxs) {
      const amount = BigInt(Math.floor(tx.amount || 0));
      const collateral = parseFloat(tx.collateral_amount?.toString() || '0');

      // Price at this moment (approximate using current replay state)
      const replayPrice = replaySupply > 0n ? replayTvl / parseFloat(formatEther(replaySupply)) : 0;

      if (tx.transaction_type === 'mint') {
        // Undo Mint: Remove supply, remove collateral
        replaySupply -= amount;
        replayTvl -= collateral;
      } else if (tx.transaction_type === 'burn') {
        // Undo Burn: Add supply back, add collateral back
        replaySupply += amount;
        // Estimate collateral returned if not stored: amount * price
        // If collateral_amount exists (it should for burns in a perfect world, but might not), use it? 
        // DB schema says collateral_amount is there.
        // If assume collateral_amount is accurate:
        // replayTvl += collateral; 
        // But in `history` route we see collateral_amount is often used for mints.
        // Let's stick to estimation if collateral is 0 or low? 
        // For consistency with forward pass, let's use the price estimation derived from similar logic.
        // Forward pass says: `returnedEstimate = ... * preTxPrice`.

        // Undo burn: Tvl = Tvl_after + returned.
        // returned = amount * price_before_burn.  
        // price_before_burn = (Tvl_after + returned) / (Supply_after + amount).
        // This is circular if we don't know returned.

        // Let's use the simple approximation: 
        const estimatedValue = parseFloat(formatEther(amount)) * replayPrice;
        replayTvl += estimatedValue;
      }
    }

    // Set initial running values (clamped to 0 to avoid precision errors causing negatives)
    runningSupply = replaySupply > 0n ? replaySupply : 0n;
    runningTvl = replayTvl > 0 ? replayTvl : 0;

    serverLogger.debug('Reverse Replay Result:', {
      currentSupply: currentTotalSupply.toString(),
      currentTvl,
      startSupply: runningSupply.toString(),
      startTvl: runningTvl,
      txCount: transactions?.length
    });

    serverLogger.debug('Processing transactions (Forward):', {
      totalTxCount: transactions?.length || 0,
      firstTx: transactions?.[0],
      lastTx: transactions?.[transactions.length - 1],
    });

    for (const tx of transactions || []) {
      const txDate = new Date(tx.created_at);
      const txTimestamp = Math.floor(txDate.getTime() / 1000);

      // Determine time bucket key
      const bucketKey = interval === 'hour'
        ? txDate.toISOString().slice(0, 13) + ':00:00'
        : txDate.toISOString().slice(0, 10);

      // Calculate price BEFORE this transaction to estimate returned value for burns
      const preTxPrice = runningSupply > 0n
        ? runningTvl / parseFloat(formatEther(runningSupply))
        : 0;

      // Update running totals based on transaction type
      if (tx.transaction_type === 'mint') {
        // Fallback: Use 'amount' as proxy for minted tokens if better data unavailable
        const minted = BigInt(Math.floor(tx.amount || 0));
        const collateral = parseFloat(tx.collateral_amount?.toString() || '0');
        runningSupply += minted;
        runningTvl += collateral;
      } else if (tx.transaction_type === 'burn') {
        const burned = BigInt(Math.floor(tx.amount || 0));

        // ESTIMATION: We lack assets_returned in DB.
        // Estimate returned assets based on the price *before* the burn.
        // This assumes the burn happened at approximately the current calculated price.
        // returned = burned_tokens * price_per_token
        const returnedEstimate = parseFloat(formatEther(burned)) * preTxPrice;

        runningSupply -= burned;
        runningTvl -= returnedEstimate;

        // Safety check: TVL shouldn't go below 0 (though technically possible with slippage/fees, for display we clamp)
        if (runningTvl < 0) runningTvl = 0;
      }

      // Calculate price AFTER this transaction
      const price = runningSupply > 0n
        ? runningTvl / parseFloat(formatEther(runningSupply))
        : 0;

      // Get or create bucket
      if (!historyMap.has(bucketKey)) {
        historyMap.set(bucketKey, {
          timestamp: txTimestamp,
          prices: [],
          volumes: [],
          tvls: [],
        });
      }

      const bucket = historyMap.get(bucketKey)!;
      bucket.prices.push(price);
      bucket.tvls.push(runningTvl);

      const volume = tx.transaction_type === 'mint'
        ? parseFloat(tx.collateral_amount?.toString() || tx.amount?.toString() || '0')
        : parseFloat(tx.amount?.toString() || '0') * preTxPrice; // Estimate volume in DAI
      bucket.volumes.push(volume);
    }

    // Add Start Point (Crucial for Charts/Gains)
    // We use the state calculated after Reverse Replay (runningSupply, runningTvl)
    // This represents the state at 'startDate'
    const startTimestamp = Math.floor(startDate.getTime() / 1000);
    const startBucketKey = interval === 'hour'
      ? startDate.toISOString().slice(0, 13) + ':00:00'
      : startDate.toISOString().slice(0, 10);

    if (!historyMap.has(startBucketKey)) {
      const startPrice = runningSupply > 0n
        ? runningTvl / parseFloat(formatEther(runningSupply))
        : 0;

      historyMap.set(startBucketKey, {
        timestamp: startTimestamp,
        prices: [startPrice],
        volumes: [0], // No volume at the exact start snapshot
        tvls: [runningTvl],
      });
    }

    // Convert map to array and aggregate by bucket
    const history: PriceHistoryPoint[] = [];

    // Sort buckets by timestamp
    const sortedBuckets = Array.from(historyMap.entries()).sort(
      (a, b) => a[1].timestamp - b[1].timestamp
    );

    for (const [key, bucket] of sortedBuckets) {
      // Calculate averages for the bucket
      const avgPrice = bucket.prices.length > 0
        ? bucket.prices.reduce((sum, p) => sum + p, 0) / bucket.prices.length
        : 0;
      const totalVolume = bucket.volumes.reduce((sum, v) => sum + v, 0);
      const avgTvl = bucket.tvls.length > 0
        ? bucket.tvls.reduce((sum, t) => sum + t, 0) / bucket.tvls.length
        : 0;

      history.push({
        timestamp: bucket.timestamp,
        price: avgPrice,
        volume: totalVolume,
        tvl: avgTvl,
      });
    }

    // Add current point if not already included
    const lastPoint = history[history.length - 1];
    if (!lastPoint || lastPoint.timestamp < currentTimestamp - 3600) {
      history.push({
        timestamp: currentTimestamp,
        price: currentPrice,
        volume: 0,
        tvl: currentTvl,
      });
    }

    return NextResponse.json({
      data: history,
      token: {
        address: meToken.address,
        current_price: currentPrice,
        current_tvl: currentTvl,
      },
    });
  } catch (error) {
    serverLogger.error('Error fetching price history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch price history', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

