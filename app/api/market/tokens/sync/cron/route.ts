import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/sdk/supabase/service';
import { getMeTokenProtocolInfo } from '@/lib/utils/metokenUtils';
import { createPublicClient, http, formatEther } from 'viem';
import { baseMainnet } from '@/lib/utils/chains/base';
import { serverLogger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for cron jobs

const ERC20_ABI = [
  {
    constant: true,
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    type: 'function',
  },
] as const;

/**
 * Cron job to sync token data from blockchain to Supabase
 * Runs once per day at 3:00 AM (Vercel Hobby plan limitation: once per day max)
 * 
 * Note: On Hobby plan, execution may occur anywhere between 3:00-3:59 AM.
 * For more frequent updates, upgrade to Pro plan and change schedule in vercel.json.
 * 
 * Security: Requires CRON_SECRET in Authorization header
 */
export async function GET(request: NextRequest) {
  try {
    // Verify the request is from Vercel Cron
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      serverLogger.error('Unauthorized cron job attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const startTime = Date.now();
    serverLogger.debug('[Cron] Starting market token data sync');

    const supabase = createServiceClient();
    const publicClient = createPublicClient({
      chain: baseMainnet,
      transport: http(process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL || process.env.NEXT_PUBLIC_BASE_RPC_URL),
    });

    // Fetch all MeTokens from Supabase
    const { data: meTokens, error } = await supabase
      .from('metokens')
      .select('id, address, tvl, total_supply');

    if (error) {
      serverLogger.error('[Cron] Failed to fetch MeTokens:', error);
      return NextResponse.json(
        { error: 'Database error', details: error.message },
        { status: 500 }
      );
    }

    if (!meTokens || meTokens.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No tokens to sync',
        totalTokens: 0,
      });
    }

    serverLogger.debug(`[Cron] Found ${meTokens.length} tokens to sync`);

    // Process in batches to avoid rate limits and timeouts
    const BATCH_SIZE = 5;
    const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds
    
    let successCount = 0;
    let errorCount = 0;
    let updatedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < meTokens.length; i += BATCH_SIZE) {
      const batch = meTokens.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(meTokens.length / BATCH_SIZE);
      
      serverLogger.debug(`[Cron] Processing batch ${batchNumber}/${totalBatches}`);

      await Promise.all(
        batch.map(async (token) => {
          try {
            // Only fetch protocol info and total supply - we don't need token metadata
            // (name, symbol, owner) as it's already stored in Supabase and doesn't change
            const [protocolInfo, totalSupply] = await Promise.all([
              getMeTokenProtocolInfo(token.address as `0x${string}`),
              publicClient.readContract({
                address: token.address as `0x${string}`,
                abi: ERC20_ABI,
                functionName: 'totalSupply',
              }) as Promise<bigint>,
            ]);

            if (!protocolInfo) {
              serverLogger.warn(`[Cron] No protocol info for token ${token.address}`);
              return;
            }

            const balancePooled = BigInt(protocolInfo.balancePooled || 0);
            const balanceLocked = BigInt(protocolInfo.balanceLocked || 0);
            const totalBalance = balancePooled + balanceLocked;
            const tvl = parseFloat(formatEther(totalBalance));
            const supply = parseFloat(formatEther(totalSupply));

            // Only update if values changed significantly (avoid unnecessary writes)
            // Use a small threshold to account for floating point precision
            const tvlChanged = Math.abs(tvl - (token.tvl || 0)) > 0.0001;
            const supplyChanged = token.total_supply !== totalSupply.toString();

            if (tvlChanged || supplyChanged) {
              const { error: updateError } = await supabase
                .from('metokens')
                .update({
                  tvl,
                  total_supply: totalSupply.toString(),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', token.id);

              if (updateError) {
                throw updateError;
              }

              serverLogger.debug(`[Cron] Updated token ${token.address}: TVL=${tvl.toFixed(4)}, Supply=${supply.toFixed(4)}`);
              updatedCount++;
            }

            successCount++;
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            serverLogger.error(`[Cron] Failed to sync token ${token.address}:`, err);
            errorCount++;
            errors.push(`${token.address}: ${errorMessage}`);
          }
        })
      );

      // Delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < meTokens.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }

    const duration = Date.now() - startTime;
    const result = {
      success: true,
      totalTokens: meTokens.length,
      successCount,
      updatedCount,
      errorCount,
      duration: `${(duration / 1000).toFixed(2)}s`,
      timestamp: new Date().toISOString(),
      errors: errorCount > 0 ? errors.slice(0, 10) : undefined, // Only include first 10 errors
    };

    serverLogger.debug('[Cron] Market token sync completed:', result);
    return NextResponse.json(result);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    serverLogger.error('[Cron] Fatal error in cron job:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}

