import { request, gql } from 'graphql-request';
import { logger } from '@/lib/utils/logger';

// MeTokens subgraph endpoint - using local API proxy to avoid CORS issues
const getSubgraphEndpoint = () => {
  if (typeof window === 'undefined') {
    // Server-side: use relative path
    return '/api/metokens-subgraph';
  }
  // Client-side: construct full URL
  return `${window.location.origin}/api/metokens-subgraph`;
};


export interface MeToken {
  id: string;
  owner: string;
  hubId: string;
  balancePooled: string;
  balanceLocked: string;
  startTime: string;
  endTime: string;
  endCooldown: string;
  targetHubId: string;
  migration: string;
}

export interface Hub {
  id: string;
  asset: string;
  vault: string;
  owner: string;
}

export interface SubscribeEvent {
  id: string;
  meToken: string;
  hubId: string;
  assetsDeposited: string;
}

export interface MeTokenWithHub extends MeToken {
  hub: Hub;
}

// GraphQL query to get all Subscribe events (which create MeTokens)
const GET_ALL_SUBSCRIBES = gql`
  query GetAllSubscribes($first: Int = 100, $skip: Int = 0) {
    subscribes(first: $first, skip: $skip, orderBy: id, orderDirection: desc) {
      id
      meToken
      hubId
      assetsDeposited
    }
  }
`;

// GraphQL query to get Subscribe events by meToken address
const GET_SUBSCRIBE_BY_METOKEN = gql`
  query GetSubscribeByMeToken($meToken: String!) {
    subscribes(where: { meToken: $meToken }) {
      id
      meToken
      hubId
      assetsDeposited
    }
  }
`;

// GraphQL query to check if a specific MeToken exists with full details
const CHECK_METOKEN_EXISTS = gql`
  query CheckMeTokenExists($meToken: String!) {
    subscribes(where: { meToken: $meToken }, first: 1) {
      id
      meToken
      hubId
      assetsDeposited
    }
  }
`;

// GraphQL query to get all MeToken addresses from Subscribe events
const GET_ALL_METOKEN_ADDRESSES = gql`
  query GetAllMeTokenAddresses($first: Int = 100, $skip: Int = 0) {
    subscribes(first: $first, skip: $skip, orderBy: id, orderDirection: desc) {
      meToken
    }
  }
`;

// GraphQL query to get hub information
const GET_HUB = gql`
  query GetHub($id: String!) {
    hub(id: $id) {
      id
      asset
      vault
      owner
    }
  }
`;

// GraphQL query to get recent mints
const GET_RECENT_MINTS = gql`
  query GetRecentMints($first: Int = 10) {
    mints(first: $first, orderBy: timestamp_, orderDirection: desc) {
      id
      meToken
      depositor
      recipient
      assetsDeposited
      meTokensMinted
      timestamp_
    }
  }
`;

// GraphQL query to get recent burns
const GET_RECENT_BURNS = gql`
  query GetRecentBurns($first: Int = 10) {
    burns(first: $first, orderBy: timestamp_, orderDirection: desc) {
      id
      meToken
      burner
      recipient
      meTokensBurned
      assetsReturned
      timestamp_
    }
  }
`;

// GraphQL query to get subscribes by hub IDs
const GET_SUBSCRIBES_BY_HUB_ID = gql`
  query GetSubscribesByHubId($hubIds: [BigInt!]) {
    subscribes(where: { hubId_in: $hubIds }) {
      id
      meToken
      hubId
      assetsDeposited
      timestamp_
      block_number
      transactionHash_
    }
  }
`;

export class MeTokensSubgraphClient {
  private getEndpoint(): string {
    return getSubgraphEndpoint();
  }

  /**
   * Helper function to check if an error is an indexing error from the subgraph.
   * graphql-request may structure errors differently, so we check multiple places.
   */
  private isIndexingError(error: any): boolean {
    const errorMessage = error?.message || '';
    const responseErrors = error?.response?.errors || [];
    return (
      errorMessage.includes('indexing_error') ||
      responseErrors.some((err: any) => 
        err?.message === 'indexing_error' || 
        err?.message?.includes('indexing_error')
      )
    );
  }

  async getAllMeTokens(first: number = 100, skip: number = 0): Promise<MeToken[]> {
    if (typeof window === 'undefined') {
      return []; // Return empty array during SSR
    }

    try {
      const endpoint = this.getEndpoint();
      logger.debug('🔗 Querying subgraph at:', endpoint);

      const data = await request(endpoint, GET_ALL_SUBSCRIBES, { first, skip }) as any;

      // Check for GraphQL errors in the response
      if (data.errors) {
        logger.error('GraphQL errors:', data.errors);
        // Check if it's an indexing error
        const hasIndexingError = data.errors.some((err: any) => 
          err?.message === 'indexing_error' || err?.message?.includes('indexing_error')
        );
        if (hasIndexingError) {
          logger.warn('⚠️ Subgraph indexing error - falling back to Supabase (Turbo pipeline data)');
          return await this.getAllMeTokensFromSupabase(first, skip);
        }
        throw new Error(`GraphQL error: ${JSON.stringify(data.errors)}`);
      }

      const subscribeEvents = data.subscribes || [];
      logger.debug(`✅ Successfully fetched ${subscribeEvents.length} subscribe events from subgraph`);

      // Convert Subscribe events to MeToken format
      // Note: This is a simplified conversion - in practice, you'd need to fetch
      // additional data from the Diamond contract for complete MeToken info
      return subscribeEvents.map((event: SubscribeEvent) => ({
        id: event.meToken,
        owner: '', // This would need to be fetched from Diamond contract
        hubId: event.hubId,
        balancePooled: '0', // This would need to be fetched from Diamond contract
        balanceLocked: '0', // This would need to be fetched from Diamond contract
        startTime: '0', // Timestamp not available in subgraph, will be fetched from blockchain if needed
        endTime: '0',
        endCooldown: '0',
        targetHubId: '0',
        migration: '',
      }));
    } catch (error: any) {
      logger.error('❌ Failed to fetch MeTokens from subgraph:', error);

      // Handle indexing_error - subgraph is syncing or has indexing issues
      if (this.isIndexingError(error)) {
        logger.warn('⚠️ Subgraph indexing error - falling back to Supabase (Turbo pipeline data)');
        return await this.getAllMeTokensFromSupabase(first, skip);
      }

      // Provide more helpful error messages for other errors
      if (error instanceof Error) {
        if (error.message.includes('500')) {
          throw new Error('Subgraph server error (500). This may be due to: missing SUBGRAPH_QUERY_KEY, subgraph indexing issues, or server downtime.');
        }
        if (error.message.includes('ECONNREFUSED')) {
          throw new Error('Cannot connect to subgraph endpoint. Check your network connection.');
        }
        throw error;
      }

      throw new Error('Failed to fetch MeTokens from subgraph');
    }
  }

  /**
   * Fallback method to get MeTokens from Supabase when subgraph fails
   * Uses data from the Turbo pipeline that reads directly from blockchain
   */
  private async getAllMeTokensFromSupabase(first: number, skip: number): Promise<MeToken[]> {
    try {
      // Dynamically import to avoid SSR issues
      const { MeTokenSupabaseService } = await import('@/lib/sdk/supabase/metokens');
      const supabaseService = new MeTokenSupabaseService();

      logger.debug('📊 Fetching Subscribe events from Supabase (Turbo pipeline)...');
      const subscribeEvents = await supabaseService.getSubscribeEvents({
        limit: first,
        offset: skip,
        sortBy: 'block_timestamp',
        sortOrder: 'desc',
      });

      logger.debug(`✅ Successfully fetched ${subscribeEvents.length} subscribe events from Supabase`);

      // Convert Subscribe events to MeToken format (matching subgraph format)
      return subscribeEvents.map((event) => ({
        id: event.me_token,
        owner: event.owner,
        hubId: event.hub_id,
        balancePooled: '0', // This would need to be fetched from Diamond contract
        balanceLocked: '0', // This would need to be fetched from Diamond contract
        startTime: event.block_timestamp,
        endTime: '0',
        endCooldown: '0',
        targetHubId: '0',
        migration: '',
      }));
    } catch (supabaseError: any) {
      logger.error('❌ Failed to fetch MeTokens from Supabase fallback:', supabaseError);
      // Return empty array to allow app to continue
      return [];
    }
  }

  async getMeTokensByOwner(owner: string, first: number = 100, skip: number = 0): Promise<MeToken[]> {
    if (typeof window === 'undefined') {
      return []; // Return empty array during SSR
    }

    // Note: The subgraph doesn't support querying hubs or hub entities,
    // and subscribes don't contain owner information directly.
    // Owner information is stored on the Hub entity, which we cannot query.
    // Therefore, we cannot determine MeToken ownership through the subgraph alone.
    // This function returns an empty array, and the caller should rely on
    // Supabase or direct contract queries for owner-based filtering.
    logger.debug('⚠️ Subgraph does not support querying MeTokens by owner (hub queries unavailable). Returning empty array. Use Supabase or contract queries instead.');
    return [];
  }

  async getMeToken(id: string): Promise<MeToken | null> {
    if (typeof window === 'undefined') {
      return null; // Return null during SSR
    }

    try {
      const data = await request(this.getEndpoint(), GET_SUBSCRIBE_BY_METOKEN, { meToken: id }) as any;
      const subscribeEvents = data.subscribes || [];

      if (subscribeEvents.length === 0) {
        return null;
      }

      const event = subscribeEvents[0]; // Get the first Subscribe event for this MeToken

      // Convert Subscribe event to MeToken format
      // Note: This is a simplified conversion - in practice, you'd need to fetch
      // additional data from the Diamond contract for complete MeToken info
      return {
        id: event.meToken,
        owner: '', // This would need to be fetched from Diamond contract
        hubId: event.hubId,
        balancePooled: '0', // This would need to be fetched from Diamond contract
        balanceLocked: '0', // This would need to be fetched from Diamond contract
        startTime: '0', // Timestamp not available in subgraph, will be fetched from blockchain if needed
        endTime: '0',
        endCooldown: '0',
        targetHubId: '0',
        migration: '',
      };
    } catch (error: any) {
      logger.error('Failed to fetch MeToken:', error);
      // Handle indexing_error gracefully
      if (this.isIndexingError(error)) {
        logger.warn('⚠️ Subgraph indexing error - returning null');
        return null;
      }
      throw new Error('Failed to fetch MeToken from subgraph');
    }
  }

  async getHub(id: string): Promise<Hub | null> {
    if (typeof window === 'undefined') {
      return null; // Return null during SSR
    }

    try {
      const data = await request(this.getEndpoint(), GET_HUB, { id }) as any;
      return data.hub || null;
    } catch (error) {
      // The subgraph doesn't support hub queries or has indexing issues - return null gracefully
      logger.warn(`⚠️ Subgraph query failed (hub ${id}):`, error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  async getRecentMints(first: number = 10): Promise<any[]> {
    if (typeof window === 'undefined') {
      return []; // Return empty array during SSR
    }

    try {
      const data = await request(this.getEndpoint(), GET_RECENT_MINTS, { first }) as any;
      return data.mints || [];
    } catch (error: any) {
      logger.error('Failed to fetch recent mints:', error);
      // Handle indexing_error gracefully - return empty array instead of throwing
      if (this.isIndexingError(error)) {
        logger.warn('⚠️ Subgraph indexing error - returning empty array');
        return [];
      }
      throw new Error('Failed to fetch recent mints from subgraph');
    }
  }

  async getRecentBurns(first: number = 10): Promise<any[]> {
    if (typeof window === 'undefined') {
      return []; // Return empty array during SSR
    }

    try {
      const data = await request(this.getEndpoint(), GET_RECENT_BURNS, { first }) as any;
      return data.burns || [];
    } catch (error: any) {
      logger.error('Failed to fetch recent burns:', error);
      // Handle indexing_error gracefully - return empty array instead of throwing
      if (this.isIndexingError(error)) {
        logger.warn('⚠️ Subgraph indexing error - returning empty array');
        return [];
      }
      throw new Error('Failed to fetch recent burns from subgraph');
    }
  }

  async getMeTokenWithHub(id: string): Promise<MeTokenWithHub | null> {
    try {
      const meToken = await this.getMeToken(id);
      if (!meToken) return null;

      const hub = await this.getHub(meToken.hubId);
      // Return null if hub cannot be fetched (subgraph doesn't support hub queries)
      if (!hub) {
        logger.warn(`⚠️ Cannot fetch hub ${meToken.hubId} for MeToken ${id} - subgraph doesn't support hub queries`);
        return null;
      }

      return {
        ...meToken,
        hub,
      };
    } catch (error) {
      logger.error('Failed to fetch MeToken with Hub:', error);
      return null; // Return null instead of throwing to allow fallback to other data sources
    }
  }

  async checkMeTokenExists(meTokenAddress: string): Promise<SubscribeEvent | null> {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      logger.debug('🔍 Checking if MeToken exists in subgraph:', meTokenAddress);
      const data = await request(this.getEndpoint(), CHECK_METOKEN_EXISTS, {
        meToken: meTokenAddress.toLowerCase()
      }) as any;

      const subscribes = data.subscribes || [];
      logger.debug('📊 Subgraph found', subscribes.length, 'Subscribe events for this address');

      if (subscribes.length > 0) {
        logger.debug('✅ MeToken found in subgraph:', subscribes[0]);
        return subscribes[0];
      }

      logger.debug('⚠️ MeToken not found in subgraph');
      return null;
    } catch (error: any) {
      logger.error('Failed to check MeToken existence:', error);
      // Handle indexing_error gracefully
      if (this.isIndexingError(error)) {
        logger.warn('⚠️ Subgraph indexing error - cannot check MeToken existence');
      }
      return null;
    }
  }
}

// Export a default instance
export const meTokensSubgraph = new MeTokensSubgraphClient();
