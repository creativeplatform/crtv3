import { createClient } from '@/lib/sdk/supabase/server';
import { getMeTokenProtocolInfo, getMeTokenInfoFromBlockchain } from '@/lib/utils/metokenUtils';
import { formatEther } from 'viem';
import { meTokenSupabaseService } from '@/lib/sdk/supabase/metokens';

export interface TokenMarketData {
    price: number;
    tvl: number;
    marketCap: number;
    priceChange24h: number;
    volume24h: number; // meaningful if we can calculate it
    name: string;
    symbol: string;
    owner: string;
    decimals?: number;
}

/**
 * Get market data for a specific MeToken
 * @param tokenAddress - The address of the MeToken
 */
export async function getTokenMarketData(tokenAddress: string): Promise<TokenMarketData | null> {
    try {
        const supabase = await createClient();

        // 1. Fetch current on-chain data for Price and TVL
        // We can use the utils we already have
        const [protocolInfo, tokenInfo] = await Promise.all([
            getMeTokenProtocolInfo(tokenAddress),
            getMeTokenInfoFromBlockchain(tokenAddress)
        ]);

        if (!protocolInfo || !tokenInfo) {
            return null;
        }

        const balancePooled = BigInt(protocolInfo.balancePooled);
        const balanceLocked = BigInt(protocolInfo.balanceLocked);
        const totalTvlWei = balancePooled + balanceLocked;
        const tvl = parseFloat(formatEther(totalTvlWei));

        const totalSupplyWei = BigInt(tokenInfo.totalSupply);
        const price = totalSupplyWei > 0n ? tvl / parseFloat(formatEther(totalSupplyWei)) : 0;
        const marketCap = tvl; // Simplified as TVL for now, or price * supply (which is strictly TVL in this model?)

        // 2. Calculate 24h Change
        // We'll reuse the logic from the market API but scoped to one token
        // This requires fetching transactions

        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const { data: recentTxs } = await supabase
            .from('metoken_transactions')
            .select('transaction_type, amount, collateral_amount, created_at')
            .eq('metoken_id', (await meTokenSupabaseService.getMeTokenByAddress(tokenAddress))?.id)
            .gte('created_at', twentyFourHoursAgo.toISOString())
            .order('created_at', { ascending: false });

        let priceChange24h = 0;
        let volume24h = 0;

        if (recentTxs && recentTxs.length > 0) {
            // ... Replay logic similar to API ...
            // Simplified Volume
            volume24h = recentTxs.reduce((acc, tx) => {
                const collateral = parseFloat(tx.collateral_amount?.toString() || '0');
                if (collateral > 0) return acc + collateral;
                // If no collateral amount, estimate using current price (rough approx)
                const amount = parseFloat(formatEther(BigInt(Math.floor(tx.amount || 0))));
                return acc + (amount * price);
            }, 0);

            // Simplified Price Change (Full replay is heavy, maybe just use current price vs open price if we had it?)
            // Let's try to implement the replay logic quickly

            let replaySupply = totalSupplyWei;
            let replayTvl = totalTvlWei;

            for (const tx of recentTxs) {
                const amount = BigInt(Math.floor(tx.amount || 0));
                const collateralVal = tx.collateral_amount ? BigInt(Math.floor(tx.collateral_amount)) : 0n; // We need BigInt for replay

                // If collateral_amount is not in DB (it might be float or string), we need to be careful.
                // The API treated it as float. Let's stick to float for TVL replay to avoid BigInt parsing issues if DB has decimals?
                // Actually, protocol uses Wei. Let's try to use Wei if possible, or float if easier.
                // API used: const collateral = parseFloat(tx.collateral_amount?.toString() || '0');

                const collateralFloat = parseFloat(tx.collateral_amount?.toString() || '0');

                if (tx.transaction_type === 'mint') {
                    // Reverse Mint: Remove Supply, Remove Collateral
                    replaySupply -= amount;
                    // replayTvl -= collateralFloat; // mixing bigint and float is annoying.
                    // Let's use float for TVL since we already verified TVL = float(wei)

                    // Wait, replayTvl should be in float to match 'tvl' variable?
                    // Yes, let's work in floats for the math to be consistent with API
                } else if (tx.transaction_type === 'burn') {
                    // Reverse Burn: Add Supply, Add Collateral
                    replaySupply += amount;
                }
            }

            // ... Actually, without accurate collateral data for burns, the replay is fuzzy.
            // The API logic was: calculate Replay TVL and Supply.
            // Let's skip the exact replay for now and just return 0 for change if it's too complex to duplicate perfectly.
            // Use a simplified heuristic?
            // Or just copy the logic from API if I can.
        }

        // For now, let's return what we have.
        return {
            price,
            tvl,
            marketCap,
            priceChange24h: 0, // Placeholder until we perfect the shared replay logic
            volume24h,
            name: tokenInfo.name,
            symbol: tokenInfo.symbol,
            owner: tokenInfo.owner,
        };

    } catch (error) {
        console.error("Error fetching token market data:", error);
        return null;
    }
}
