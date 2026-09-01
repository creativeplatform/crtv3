import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/sdk/supabase/server';
import { meTokenSupabaseService } from '@/lib/sdk/supabase/metokens';
import { formatEther } from 'viem';
import { getMeTokenProtocolInfo, getMeTokenInfoFromBlockchain, getBulkMeTokenInfo } from '@/lib/utils/metokenUtils';
import { isActiveMarketToken } from '@/lib/metokens/syncMeTokenMarketData';
import { serverLogger } from '@/lib/utils/logger';

export interface MarketToken {
  id: string;
  address: string;
  name: string;
  symbol: string;
  owner_address: string;
  type: 'metoken' | 'content_coin';
  /** MeToken collateral hub (1=DAI, 2=USDC, 3=USDS, 4=GHO) */
  hubId?: number;
  price: number;
  tvl: number;
  total_supply: string;
  market_cap: number;
  price_change_24h?: number;
  volume_24h?: number;
  created_at: string;
  // Content Coin specific fields
  video_id?: number;
  video_title?: string;
  playback_id?: string;
  thumbnail_url?: string;
  // Creator info
  creator_username?: string;
  creator_avatar_url?: string;
}

export interface MarketStats {
  total_tokens: number;
  total_tvl: number;
  volume_24h: number;
  top_gainers: MarketToken[];
  top_losers: MarketToken[];
}

// GET /api/market/tokens - Get market tokens with filtering and sorting
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Query parameters
    const type = searchParams.get('type') as 'all' | 'metoken' | 'content_coin' | null;
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') as 'price' | 'tvl' | 'market_cap' | 'volume_24h' | 'price_change_24h' | 'created_at' || 'tvl';
    const sortOrder = searchParams.get('sortOrder') as 'asc' | 'desc' || 'desc';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const includeStats = searchParams.get('includeStats') === 'true';
    // Only fetch fresh data from blockchain if explicitly requested (disabled by default for performance)
    // Background cron job keeps Supabase data fresh
    const useFreshData = searchParams.get('fresh') === 'true';

    const supabase = await createClient();

    // Fetch MeTokens
    const meTokenOptions = {
      limit: type === 'content_coin' ? 0 : 1000, // Get all if not filtering to content coins only
      offset: 0,
      sortBy: 'tvl' as const,
      sortOrder: 'desc' as const,
      search: search || undefined,
    };

    let meTokens = type === 'content_coin' ? [] : await meTokenSupabaseService.getAllMeTokens(meTokenOptions);

    // If Supabase has very few tokens, try to sync from subgraph (similar to profile page)
    // This ensures the market shows data even if Supabase hasn't been fully synced yet
    if (type !== 'content_coin' && meTokens.length < 5 && !search) {
      try {
        serverLogger.debug('Market API: Supabase has few tokens, checking subgraph for sync...');

        // Use the proxy endpoint which has better error handling and fallback logic
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
          (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
        const subgraphEndpoint = `${baseUrl}/api/metokens-subgraph`;

        const GET_ALL_SUBSCRIBES = `
          query GetAllSubscribes($first: Int = 100, $skip: Int = 0) {
            subscribes(first: $first, skip: $skip, orderBy: id, orderDirection: desc) {
              id
              meToken
              hubId
              assetsDeposited
            }
          }
        `;

        // Use fetch instead of graphql-request to go through the proxy
        const subgraphResponse = await fetch(subgraphEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: GET_ALL_SUBSCRIBES,
            variables: { first: 50, skip: 0 },
          }),
        });

        if (!subgraphResponse.ok) {
          const errorText = await subgraphResponse.text();
          serverLogger.warn('Market API: Subgraph sync failed (non-critical):', {
            status: subgraphResponse.status,
            error: errorText,
          });
          // Continue with existing Supabase data - this is a fallback, not critical
        } else {
          const subgraphData = await subgraphResponse.json() as any;

          // Check for GraphQL errors in response
          if (subgraphData.errors && subgraphData.errors.length > 0) {
            serverLogger.warn('Market API: GraphQL errors in subgraph response:', subgraphData.errors);
            // Continue with existing Supabase data
          } else {
            const subscribeEvents = subgraphData?.data?.subscribes || [];

            if (subscribeEvents.length > 0) {
              serverLogger.debug(`Found ${subscribeEvents.length} MeTokens in subgraph, syncing recent ones...`);

              // Sync the most recent tokens from subgraph to Supabase
              // Limit to 10 to avoid timeout
              for (const event of subscribeEvents.slice(0, 10)) {
                try {
                  const meTokenAddress = event.meToken;

                  // Check if already in Supabase
                  const existing = await meTokenSupabaseService.getMeTokenByAddress(meTokenAddress);
                  if (existing) continue; // Skip if already synced

                  // Sync from subgraph to Supabase using internal API call
                  // Use absolute URL for server-side fetch
                  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

                  const syncResponse = await fetch(`${baseUrl}/api/metokens/sync`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ meTokenAddress })
                  });

                  if (syncResponse.ok) {
                    serverLogger.debug(`Synced MeToken: ${meTokenAddress}`);
                  }
                } catch (syncErr) {
                  serverLogger.warn(`Failed to sync MeToken ${event.meToken}:`, syncErr);
                  // Continue with other tokens even if one fails
                }
              }

              // Re-fetch from Supabase after syncing
              meTokens = await meTokenSupabaseService.getAllMeTokens(meTokenOptions);
              serverLogger.debug(`After sync, found ${meTokens.length} MeTokens in Supabase`);
            }
          }
        }
      } catch (subgraphErr) {
        serverLogger.warn('Market API: Subgraph sync failed (non-critical):', subgraphErr);
        // Continue with existing Supabase data - this is a fallback, not critical
      }
    }

    // Fetch Content Coins (MeTokens that are referenced in video_assets)
    let contentCoins: any[] = [];
    if (type !== 'metoken') {
      const { data: videoAssets, error: videoError } = await supabase
        .from('video_assets')
        .select(`
          id,
          title,
          playback_id,
          thumbnail_url,
          attributes,
          creator_id,
          created_at
        `)
        .not('attributes->content_coin_id', 'is', null)
        .in('status', ['published', 'minted']);

      if (!videoError && videoAssets) {
        // Get unique content coin addresses
        const contentCoinAddresses = new Set<string>();
        const videoMap = new Map<string, any>();

        for (const video of videoAssets) {
          const contentCoinId = video.attributes?.content_coin_id;
          if (contentCoinId) {
            contentCoinAddresses.add(contentCoinId);
            videoMap.set(contentCoinId, video);
          }
        }

        // Fetch MeToken data for content coins
        if (contentCoinAddresses.size > 0) {
          const { data: contentCoinTokens, error: tokenError } = await supabase
            .from('metokens')
            .select('*')
            .in('address', Array.from(contentCoinAddresses));

          if (!tokenError && contentCoinTokens) {
            contentCoins = contentCoinTokens.map((token) => {
              const video = videoMap.get(token.address);
              return {
                ...token,
                video_id: video?.id,
                video_title: video?.title,
                playback_id: video?.playback_id,
                thumbnail_url: video?.thumbnail_url,
              };
            });
          }
        }
      }
    }

    // Combine and transform tokens
    let allTokens: MarketToken[] = [];

    // Transform MeTokens with Supabase data first
    for (const meToken of meTokens) {
      const hubId = Number(meToken.hub_id);
      allTokens.push({
        id: meToken.id,
        address: meToken.address,
        name: meToken.name,
        symbol: meToken.symbol,
        owner_address: meToken.owner_address,
        type: 'metoken' as const,
        hubId: Number.isFinite(hubId) && hubId > 0 ? hubId : undefined,
        price: 0, // Will update below
        tvl: meToken.tvl,
        total_supply: meToken.total_supply?.toString() || '0',
        market_cap: meToken.tvl,
        created_at: meToken.created_at,
      });
    }

    // Transform Content Coins with Supabase data first
    for (const contentCoin of contentCoins) {
      const hubId = Number(contentCoin.hub_id);
      allTokens.push({
        id: contentCoin.id,
        address: contentCoin.address,
        name: contentCoin.name,
        symbol: contentCoin.symbol,
        owner_address: contentCoin.owner_address,
        type: 'content_coin' as const,
        hubId: Number.isFinite(hubId) && hubId > 0 ? hubId : undefined,
        price: 0, // Will update below
        tvl: contentCoin.tvl,
        total_supply: contentCoin.total_supply?.toString() || '0',
        market_cap: contentCoin.tvl,
        video_id: contentCoin.video_id,
        video_title: contentCoin.video_title,
        playback_id: contentCoin.playback_id,
        thumbnail_url: contentCoin.thumbnail_url,
        created_at: contentCoin.created_at,
      });
    }

    // Always refresh TVL/price from blockchain so stats reflect recent trades
    if (allTokens.length > 0) {
      const addresses = allTokens.map((t) => t.address);
      const bulkData = await getBulkMeTokenInfo(addresses);

      allTokens = allTokens.map((token) => {
        const fresh = bulkData ? bulkData[token.address] : undefined;

        if (fresh) {
          return {
            ...token,
            tvl: fresh.tvl,
            price: fresh.price,
            total_supply: fresh.totalSupply,
            market_cap: fresh.tvl,
          };
        }

        const totalSupply = BigInt(token.total_supply || 0);
        const price = totalSupply > 0n ? token.tvl / parseFloat(formatEther(totalSupply)) : 0;

        return {
          ...token,
          price,
        };
      });
    }

    // Hide liquidated / zero-liquidity tokens from the market
    allTokens = allTokens.filter((token) => isActiveMarketToken(token.tvl));

    // Apply search filter if provided
    if (search) {
      const searchLower = search.toLowerCase();
      allTokens = allTokens.filter((token) =>
        token.name.toLowerCase().includes(searchLower) ||
        token.symbol.toLowerCase().includes(searchLower) ||
        token.owner_address.toLowerCase().includes(searchLower) ||
        (token.video_title && token.video_title.toLowerCase().includes(searchLower))
      );
    }

    // Apply type filter
    if (type && type !== 'all') {
      allTokens = allTokens.filter((token) => token.type === type);
    }

    // Calculate 24h price change and volume
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Fetch recent transactions for stats calculation
    const { data: recentTxs } = await supabase
      .from('metoken_transactions')
      .select('metoken_id, transaction_type, amount, collateral_amount, created_at')
      .gte('created_at', twentyFourHoursAgo.toISOString())
      .order('created_at', { ascending: false }); // Descending for reverse replay

    // Stats map by metoken_id
    const statsMap = new Map<string, { volume: number; priceCheck: { supplyDelta: bigint; tvlDelta: number } }>();

    if (recentTxs) {
      for (const tx of recentTxs) {
        if (!statsMap.has(tx.metoken_id)) {
          statsMap.set(tx.metoken_id, { volume: 0, priceCheck: { supplyDelta: 0n, tvlDelta: 0 } });
        }
        const stats = statsMap.get(tx.metoken_id)!;

        // Volume calculation (in ETH/DAI terms)
        // For MINT: collateral_amount is the volume
        // For BURN: we estimate volume based on amount * current_price (since we process in batch, we might simplify)
        // Better: Use collateral_amount for MINT. For BURN, use an estimate if collateral is missing.
        // Assuming collateral_amount is present for MINTs

        // Note: The Price History route estimates volume for burns using price * amounts.
        // Here we'll do a simplified volume sum.
        let txVolume = 0;
        const amount = BigInt(Math.floor(tx.amount || 0));
        const collateral = parseFloat(tx.collateral_amount?.toString() || '0');

        if (tx.transaction_type === 'mint') {
          // Mint: Volume is the collateral amount (incoming value)
          txVolume = collateral;
          
          // Reverse replay: User +Collateral -> +Supply. To go back to state "before", we subtract.
          stats.priceCheck.supplyDelta += amount;
          stats.priceCheck.tvlDelta += collateral;
        } else if (tx.transaction_type === 'burn') {
          // Burn: User -Supply -> +Collateral (outgoing value). 
          // Reverse replay: To go back, we add supply and put collateral back.
          stats.priceCheck.supplyDelta -= amount;
          
          // We don't have exact collateral returned in DB for burns usually (unless collateral_amount is populated).
          // If collateral_amount is present, use it. Otherwise, we'll have to estimate during the replay loop or here using current token price.
          // For global volume, we want to count this activity.
          
          if (collateral > 0) {
            txVolume = collateral;
             stats.priceCheck.tvlDelta -= collateral; // Reverse: we passed out collateral, so to go back we add it? No.
             // Wait. 
             // Current TVL = Prev TVL + MintCollateral - BurnCollateral.
             // Prev TVL = Current TVL - MintCollateral + BurnCollateral.
             
             // So for Mint (which added collateral): Delta should be +Collateral. (We subtract this Delta from Current to get Prev)
             // For Burn (which removed collateral): Delta should be -Collateral. (We subtract this Delta [-Val] -> Add Val to Current)
             
             stats.priceCheck.tvlDelta -= collateral;
          } else {
             // We will estimate the value using the token's current price for the volume metric
             // But for TVL Replay, we need to be careful. We'll handle TVL replay calculation more precisely in the per-token loop.
             // For now, let's try to estimate volume here if possible, or defer volume calculation to the token loop too?
             // Actually, 'token.price' is available in the outer loop but not easily accessible here inside the tx loop unless we look it up.
             // Let's defer exact volume summation to the token loop where we have price data, OR look up price here.
             
             // Optimization: Look up token in allTokens map? We haven't built a map, but we can find it.
             const tokenForPrice = allTokens.find(t => t.id === tx.metoken_id);
             if (tokenForPrice && tokenForPrice.price > 0) {
               txVolume = parseFloat(formatEther(amount)) * tokenForPrice.price;
             }
          }
        } else {
             // Other types (e.g. transfer)? Usually doesn't affect TVL/Supply directly in the same way, but 'swap' might be here if recorded.
             // If it's a recorded 'swap' or 'trade', count volume.
             if (collateral > 0) {
                 txVolume = collateral;
             } else {
                 const tokenForPrice = allTokens.find(t => t.id === tx.metoken_id);
                 if (tokenForPrice && tokenForPrice.price > 0) {
                   txVolume = parseFloat(formatEther(amount)) * tokenForPrice.price;
                 }
             }
        }

        stats.volume += txVolume;
      }
    }

    // Apply calculated stats
    allTokens = allTokens.map((token) => {
      const tokenStats = statsMap.get(token.id);

      let price_change_24h = 0;
      let volume_24h = 0;

      if (tokenStats) {
        
        // Use the volume we summed up (including estimates)
        volume_24h = tokenStats.volume;

        // Calculate Price Change
        // Current Price is known: token.price
        // Price 24h ago = (CurrentTVL - DeltaTVL) / (CurrentSupply - DeltaSupply)

        const currentSupply = BigInt(token.total_supply || 0);
        const currentTvl = token.tvl;

        // Re-scan recentTxs for this token to do accurate Replay
        const tokenTxs = recentTxs?.filter(tx => tx.metoken_id === token.id) || [];

        let replaySupply = currentSupply;
        let replayTvl = currentTvl;

        for (const tx of tokenTxs) {
          const amount = BigInt(Math.floor(tx.amount || 0));
          const collateral = parseFloat(tx.collateral_amount?.toString() || '0');

          // Current State in Replay (initially Current Actual State)
          // We want to walk BACKWARDS to find state 24h ago.
          
          if (tx.transaction_type === 'mint') {
            // Mint happened: Supply increased, TVL increased.
            // Action: ONE step back means Removing that Supply and TVL.
            replaySupply -= amount;
            replayTvl -= collateral;
          } else if (tx.transaction_type === 'burn') {
            // Burn happened: Supply decreased, TVL decreased.
            // Action: ONE step back means Adding that Supply and TVL back.
            replaySupply += amount;
            
            if (collateral > 0) {
                replayTvl += collateral;
            } else {
                // Estimate collateral returned using the price AT THAT MOMENT (approx)
                // Since verification is hard without exact logs, we use the Replay Price
                // Replay Price = Price *after* the action. We want Price *at* the action?
                // Approximation: Use current replay state price (which is "after" the action in forward time, "before" undoing in reverse)
                // Actually, if we are at state T, and burn happened to get to T. State T-1 had more TVL.
                // Value burned = Amount * Price(T-1)? Or Price(T)?
                // Let's use the current calculated price in the loop.
                const currentReplayPrice = replaySupply > 0n ? replayTvl / parseFloat(formatEther(replaySupply)) : 0;
                const estCollateral = parseFloat(formatEther(amount)) * currentReplayPrice;
                replayTvl += estCollateral;
            }
          }
        }
        
        // Calculate price 24h ago
        // Avoid division by zero
        if (replayTvl < 0) replayTvl = 0; // Safety
        if (replaySupply < 0n) replaySupply = 0n; // Safety

        const price24hAgo = replaySupply > 0n ? replayTvl / parseFloat(formatEther(replaySupply)) : 0;

        if (price24hAgo > 0) {
          price_change_24h = ((token.price - price24hAgo) / price24hAgo) * 100;
        } else if (token.price > 0) {
            // If price was 0 and now is > 0, that's 100% (or infinite) gain. Cap or show 100?
            price_change_24h = 0; 
        }
      }

      return {
        ...token,
        price_change_24h,
        volume_24h,
      };
    });

    // Sort tokens
    allTokens.sort((a, b) => {
      let aValue: number;
      let bValue: number;

      switch (sortBy) {
        case 'price':
          aValue = a.price;
          bValue = b.price;
          break;
        case 'tvl':
          aValue = a.tvl;
          bValue = b.tvl;
          break;
        case 'market_cap':
          aValue = a.market_cap;
          bValue = b.market_cap;
          break;
        case 'volume_24h':
          aValue = a.volume_24h || 0;
          bValue = b.volume_24h || 0;
          break;
        case 'price_change_24h':
          aValue = a.price_change_24h || 0;
          bValue = b.price_change_24h || 0;
          break;
        case 'created_at':
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        default:
          aValue = a.tvl;
          bValue = b.tvl;
      }

      if (sortOrder === 'asc') {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });

    // Fetch creator profiles for tokens
    const ownerAddresses = [...new Set(allTokens.map((t) => t.owner_address))];
    if (ownerAddresses.length > 0) {
      const { data: profiles } = await supabase
        .from('creator_profiles')
        .select('owner_address, username, avatar_url')
        .in('owner_address', ownerAddresses);

      if (profiles) {
        const profileMap = new Map(
          profiles.map((p) => [p.owner_address.toLowerCase(), p])
        );

        allTokens = allTokens.map((token) => {
          const profile = profileMap.get(token.owner_address.toLowerCase());
          return {
            ...token,
            creator_username: profile?.username,
            creator_avatar_url: profile?.avatar_url,
          };
        });
      }
    }

    // Paginate
    const paginatedTokens = allTokens.slice(offset, offset + limit);
    const total = allTokens.length;

    // Calculate market stats if requested
    let stats: MarketStats | undefined;
    if (includeStats) {
      const totalTvl = allTokens.reduce((sum, token) => sum + token.tvl, 0);
      const totalVolume24h = allTokens.reduce((sum, token) => sum + (token.volume_24h || 0), 0);

      // Top gainers: positive changes only (floor at 0%)
      const topGainers = [...allTokens]
        .filter((t) => (t.price_change_24h ?? 0) > 0)
        .sort((a, b) => (b.price_change_24h ?? 0) - (a.price_change_24h ?? 0))
        .slice(0, 5);

      // Top losers: negative changes only (ceiling at 0%)
      const topLosers = [...allTokens]
        .filter((t) => (t.price_change_24h ?? 0) < 0)
        .sort((a, b) => (a.price_change_24h ?? 0) - (b.price_change_24h ?? 0))
        .slice(0, 5);

      stats = {
        total_tokens: total,
        total_tvl: totalTvl,
        volume_24h: totalVolume24h,
        top_gainers: topGainers,
        top_losers: topLosers,
      };
    }

    const response = NextResponse.json({
      data: paginatedTokens,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      ...(stats && { stats }),
    });

    // Add caching headers for Vercel Edge Cache
    // Shorter cache for search queries or fresh data requests, longer for standard queries
    const cacheDuration = search || useFreshData
      ? "no-store, no-cache, must-revalidate"
      : "public, s-maxage=30, stale-while-revalidate=60";

    response.headers.set("Cache-Control", cacheDuration);

    // Add cache tags for Vercel cache invalidation
    const cacheTags = ['market', 'tokens', type || 'all'];
    if (search) cacheTags.push(`search:${search}`);
    response.headers.set("x-vercel-cache-tags", cacheTags.join(','));

    return response;
  } catch (error) {
    serverLogger.error('Error fetching market tokens:', error);
    return NextResponse.json(
      { error: 'Failed to fetch market tokens', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

