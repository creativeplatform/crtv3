import { supabase, CreatorProfile, CreateCreatorProfileData, UpdateCreatorProfileData } from './client';
import { serverLogger } from '@/lib/utils/logger';


// Re-export types for external use
export type { CreatorProfile, CreateCreatorProfileData, UpdateCreatorProfileData };

export class CreatorProfileSupabaseService {
  // Get creator profile by owner address
  async getCreatorProfileByOwner(ownerAddress: string): Promise<CreatorProfile | null> {
    try {
      // Use API route to bypass RLS issues
      const response = await fetch(`/api/creator-profiles?owner=${encodeURIComponent(ownerAddress)}`);
      
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Failed to fetch creator profile: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        if (result.error?.includes('not found')) return null;
        throw new Error(result.error || 'Failed to fetch creator profile');
      }

      return result.data;
    } catch (error) {
      // Handle case where creator_profiles table doesn't exist
      if (error instanceof Error && error.message.includes('relation "public.creator_profiles" does not exist')) {
        serverLogger.warn('Creator profiles table does not exist. Please run the database migration to create the table.');
        return null;
      }
      throw error;
    }
  }

  // Get creator profile by ID
  async getCreatorProfileById(id: string): Promise<CreatorProfile | null> {
    try {
      const { data, error } = await supabase
        .from('creator_profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw new Error(`Failed to fetch creator profile: ${error.message}`);
      }

      return data;
    } catch (error) {
      // Handle case where creator_profiles table doesn't exist
      if (error instanceof Error && error.message.includes('relation "public.creator_profiles" does not exist')) {
        serverLogger.warn('Creator profiles table does not exist. Please run the database migration to create the table.');
        return null;
      }
      throw error;
    }
  }

  // Create a new creator profile
  async createCreatorProfile(profileData: CreateCreatorProfileData): Promise<CreatorProfile> {
    try {
      const { data, error } = await supabase
        .from('creator_profiles')
        .insert({
          ...profileData,
          owner_address: profileData.owner_address.toLowerCase(),
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create creator profile: ${error.message}`);
      }

      return data;
    } catch (error) {
      // Handle case where creator_profiles table doesn't exist
      if (error instanceof Error && error.message.includes('relation "public.creator_profiles" does not exist')) {
        throw new Error('Creator profiles table does not exist. Please run the database migration to create the table.');
      }
      throw error;
    }
  }

  // Update creator profile
  async updateCreatorProfile(
    ownerAddress: string,
    updateData: UpdateCreatorProfileData,
    authHeaders?: Record<string, string>
  ): Promise<CreatorProfile> {
    try {
      // Use upsert to handle both create and update cases
      return await this.upsertCreatorProfile(
        {
          owner_address: ownerAddress,
          ...updateData,
        },
        authHeaders
      );
    } catch (error) {
      // Handle case where creator_profiles table doesn't exist
      if (error instanceof Error && error.message.includes('relation "public.creator_profiles" does not exist')) {
        throw new Error('Creator profiles table does not exist. Please run the database migration to create the table.');
      }
      throw error;
    }
  }

  /**
   * Upsert creator profile (create or update).
   *
   * The `/api/creator-profiles/upsert` route now requires wallet auth headers
   * proving the caller controls `owner_address`. Pass `authHeaders` (from
   * `useWalletAuth().getAuthHeaders()`) when calling from a client component
   * that has a wallet connected.
   */
  async upsertCreatorProfile(
    profileData: CreateCreatorProfileData,
    authHeaders?: Record<string, string>
  ): Promise<CreatorProfile> {
    try {
      // Use API route to bypass RLS issues
      const response = await fetch('/api/creator-profiles/upsert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeaders || {}),
        },
        body: JSON.stringify(profileData),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to upsert creator profile');
      }

      return result.data;
    } catch (error) {
      // Handle case where creator_profiles table doesn't exist
      if (error instanceof Error && error.message.includes('relation "public.creator_profiles" does not exist')) {
        throw new Error('Creator profiles table does not exist. Please run the database migration to create the table.');
      }
      throw error;
    }
  }

  // Delete creator profile
  async deleteCreatorProfile(ownerAddress: string): Promise<void> {
    const { error } = await supabase
      .from('creator_profiles')
      .delete()
      .eq('owner_address', ownerAddress.toLowerCase());

    if (error) {
      throw new Error(`Failed to delete creator profile: ${error.message}`);
    }
  }

  // Get all creator profiles with pagination
  async getAllCreatorProfiles(options: {
    limit?: number;
    offset?: number;
    search?: string;
  } = {}): Promise<CreatorProfile[]> {
    const {
      limit = 50,
      offset = 0,
      search
    } = options;

    let query = supabase
      .from('creator_profiles')
      .select('*')
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    // Add search functionality
    if (search) {
      query = query.or(`username.ilike.%${search}%,bio.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch creator profiles: ${error.message}`);
    }

    return data || [];
  }

  // Search creator profiles
  async searchCreatorProfiles(query: string, limit: number = 20): Promise<CreatorProfile[]> {
    const { data, error } = await supabase
      .from('creator_profiles')
      .select('*')
      .or(`username.ilike.%${query}%,bio.ilike.%${query}%`)
      .limit(limit)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to search creator profiles: ${error.message}`);
    }

    return data || [];
  }

  // Subscribe to real-time creator profile updates
  subscribeToCreatorProfileUpdates(ownerAddress: string, callback: (payload: any) => void) {
    return supabase
      .channel(`creator-profile-${ownerAddress}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'creator_profiles',
          filter: `owner_address=eq.${ownerAddress.toLowerCase()}`,
        },
        callback
      )
      .subscribe();
  }

  // Get creator profile with MeToken data
  async getCreatorProfileWithMeToken(ownerAddress: string): Promise<{
    profile: CreatorProfile | null;
    meToken: any | null;
  }> {
    try {
      // Get creator profile
      const profile = await this.getCreatorProfileByOwner(ownerAddress);

      // Get MeToken data
      const { data: meTokenData, error: meTokenError } = await supabase
        .from('metokens')
        .select('*')
        .eq('owner_address', ownerAddress.toLowerCase())
        .single();

      const meToken = meTokenError?.code === 'PGRST116' ? null : meTokenData;

      return { profile, meToken };
    } catch (error) {
      throw new Error(`Failed to fetch creator profile with MeToken: ${error}`);
    }
  }
}

// Export a default instance
export const creatorProfileSupabaseService = new CreatorProfileSupabaseService();

