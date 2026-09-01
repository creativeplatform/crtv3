"use client";

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/lib/wallet/react';
import { logger } from '@/lib/utils/logger';
import { useWalletAuth } from '@/lib/auth/useWalletAuth';
import { formatWalletAuthError } from '@/lib/auth/format-wallet-auth-error';

import { 
  creatorProfileSupabaseService, 
  CreatorProfile, 
  CreateCreatorProfileData, 
  UpdateCreatorProfileData 
} from '@/lib/sdk/supabase/creator-profiles';

export interface UseCreatorProfileResult {
  profile: CreatorProfile | null;
  loading: boolean;
  error: string | null;
  createProfile: (data: CreateCreatorProfileData) => Promise<void>;
  updateProfile: (data: UpdateCreatorProfileData) => Promise<void>;
  upsertProfile: (data: CreateCreatorProfileData) => Promise<void>;
  deleteProfile: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export function useCreatorProfile(targetAddress?: string): UseCreatorProfileResult {
  const user = useUser();
  const { getAuthHeaders, address: authAddress } = useWalletAuth();
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reads use the requested owner; mutations sign with the connected wallet.
  const address = targetAddress || user?.address;
  const mutationOwnerAddress = authAddress || address;

  // Fetch creator profile
  const fetchProfile = useCallback(async () => {
    if (!address) {
      setProfile(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const profileData = await creatorProfileSupabaseService.getCreatorProfileByOwner(address);
      setProfile(profileData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch creator profile');
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [address]);

  // Create a new creator profile
  const createProfile = useCallback(async (data: CreateCreatorProfileData) => {
    if (!address) {
      throw new Error('No address available');
    }

    setLoading(true);
    setError(null);

    try {
      const profileData = await creatorProfileSupabaseService.createCreatorProfile({
        ...data,
        owner_address: address,
      });
      setProfile(profileData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create creator profile');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [address]);

  const requireMutationAuth = useCallback(async () => {
    if (!mutationOwnerAddress) {
      throw new Error('No address available');
    }
    try {
      return await getAuthHeaders();
    } catch (err) {
      throw new Error(formatWalletAuthError(err));
    }
  }, [mutationOwnerAddress, getAuthHeaders]);

  // Update creator profile
  const updateProfile = useCallback(async (data: UpdateCreatorProfileData) => {
    if (!mutationOwnerAddress) {
      throw new Error('No address available');
    }

    setLoading(true);
    setError(null);

    try {
      const authHeaders = await requireMutationAuth();
      const profileData = await creatorProfileSupabaseService.updateCreatorProfile(
        mutationOwnerAddress,
        data,
        authHeaders,
      );
      setProfile(profileData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update creator profile');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [mutationOwnerAddress, requireMutationAuth]);

  // Upsert creator profile (create or update)
  const upsertProfile = useCallback(async (data: CreateCreatorProfileData) => {
    if (!mutationOwnerAddress) {
      throw new Error('No address available');
    }

    setLoading(true);
    setError(null);

    try {
      const authHeaders = await requireMutationAuth();
      const profileData = await creatorProfileSupabaseService.upsertCreatorProfile(
        {
          ...data,
          owner_address: mutationOwnerAddress,
        },
        authHeaders,
      );
      setProfile(profileData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upsert creator profile');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [mutationOwnerAddress, requireMutationAuth]);

  // Delete creator profile
  const deleteProfile = useCallback(async () => {
    if (!address) {
      throw new Error('No address available');
    }

    setLoading(true);
    setError(null);

    try {
      await creatorProfileSupabaseService.deleteCreatorProfile(address);
      setProfile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete creator profile');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [address]);

  // Refresh profile data
  const refreshProfile = useCallback(async () => {
    await fetchProfile();
  }, [fetchProfile]);

  // Initial fetch
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!address) return;

    const subscription = creatorProfileSupabaseService.subscribeToCreatorProfileUpdates(
      address,
      (payload) => {
        logger.debug('Creator profile update received:', payload);
        
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          setProfile(payload.new);
        } else if (payload.eventType === 'DELETE') {
          setProfile(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [address]);

  return {
    profile,
    loading,
    error,
    createProfile,
    updateProfile,
    upsertProfile,
    deleteProfile,
    refreshProfile,
  };
}

// Hook for getting creator profile with MeToken data
export function useCreatorProfileWithMeToken(targetAddress?: string) {
  const user = useUser();
  const [data, setData] = useState<{
    profile: CreatorProfile | null;
    meToken: any | null;
  }>({ profile: null, meToken: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const address = targetAddress || user?.address;

  const fetchData = useCallback(async () => {
    if (!address) {
      setData({ profile: null, meToken: null });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await creatorProfileSupabaseService.getCreatorProfileWithMeToken(address);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch creator data');
      setData({ profile: null, meToken: null });
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    ...data,
    loading,
    error,
    refresh: fetchData,
  };
}

