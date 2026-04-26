import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create client-side Supabase client
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

// Types for our MeToken tables
export interface MeToken {
  id: string;
  address: string;
  owner_address: string;
  name: string;
  symbol: string;
  total_supply: number;
  tvl: number;
  hub_id: number;
  balance_pooled: number;
  balance_locked: number;
  start_time?: string;
  end_time?: string;
  end_cooldown?: string;
  target_hub_id?: number;
  migration_address?: string;
  created_at: string;
  updated_at: string;
}

export interface MeTokenBalance {
  id: string;
  metoken_id: string;
  user_address: string;
  balance: number;
  updated_at: string;
  metoken?: MeToken; // Joined data
}

export interface MeTokenTransaction {
  id: string;
  metoken_id: string;
  user_address: string;
  transaction_type: 'mint' | 'burn' | 'transfer' | 'create';
  amount: number;
  collateral_amount?: number;
  transaction_hash?: string;
  block_number?: number;
  created_at: string;
}

export interface CreateMeTokenData {
  address: string;
  owner_address: string;
  name: string;
  symbol: string;
  total_supply: number;
  tvl?: number;
  hub_id: number;
  balance_pooled?: number;
  balance_locked?: number;
  start_time?: string;
  end_time?: string;
  end_cooldown?: string;
  target_hub_id?: number;
  migration_address?: string;
}

export interface UpdateMeTokenData {
  total_supply?: number;
  tvl?: number;
  balance_pooled?: number;
  balance_locked?: number;
  end_time?: string;
  end_cooldown?: string;
}

// Types for Creator Profiles (replacing OrbisDB metadata)
export interface CreatorProfile {
  id: string;
  owner_address: string;
  username?: string;
  bio?: string;
  avatar_url?: string;
  twin_enabled?: boolean;
  twin_address?: string | null;
  twin_avatar_glb_url?: string | null;
  /** @deprecated superseded by twin_pinata_* fields, kept for backwards compatibility. */
  twin_chat_endpoint?: string | null;
  twin_pinata_agent_id?: string | null;
  twin_pinata_base_url?: string | null;
  twin_pinata_ws_url?: string | null;
  twin_pinata_snapshot_cid?: string | null;
  twin_pinata_agent_name?: string | null;
  twin_pinata_connected_at?: string | null;
  // twin_pinata_gateway_token deliberately omitted from client-readable type;
  // it's column-locked to service-role reads.
  created_at: string;
  updated_at: string;
}

export interface CreateCreatorProfileData {
  owner_address: string;
  username?: string;
  bio?: string;
  avatar_url?: string;
  twin_enabled?: boolean;
  twin_address?: string | null;
  twin_avatar_glb_url?: string | null;
  twin_chat_endpoint?: string | null;
}

export interface UpdateCreatorProfileData {
  username?: string;
  bio?: string;
  avatar_url?: string;
  twin_enabled?: boolean;
  twin_address?: string | null;
  twin_avatar_glb_url?: string | null;
  twin_chat_endpoint?: string | null;
}
