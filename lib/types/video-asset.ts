/**
 * Subtitle chunk type - represents a single subtitle entry with text and timing
 */
export type Chunk = {
  text: string;
  timestamp: number[];
};

/**
 * Subtitles type - maps language codes to arrays of subtitle chunks
 * Example: { "English": [{text: "Hello", timestamp: [0, 2]}], "Spanish": [...] }
 */
export type Subtitles = Record<string, Chunk[]>;

export interface VideoAsset {
  id: number;
  title: string;
  asset_id: string;
  category: string;
  location: string;
  playback_id: string;
  description: string | null;
  thumbnailUri: string;
  creator_id: string;
  status: "draft" | "published" | "minted" | "archived";
  duration: number | null;
  views_count: number;
  likes_count: number;
  is_minted: boolean;
  token_id: string | null;
  contract_address: string | null;
  minted_at: Date | null;
  mint_transaction_hash: string | null;
  royalty_percentage: number | null;
  price: number | null;
  max_supply: number | null;
  current_supply: number;
  metadata_uri: string | null;
  attributes: Record<string, any> | null;
  requires_metoken: boolean;
  metoken_price: number | null;
  creator_metoken_id: string | null;  // UUID reference to creator's MeToken
  // Subtitle fields
  subtitles_uri: string | null;  // IPFS URI for decentralized storage
  subtitles: Subtitles | null;    // Cached JSONB data for fast access
  // Story Protocol fields
  story_ip_registered: boolean;
  story_ip_id: string | null;  // Story Protocol IP Asset ID (ipId)
  story_ip_registration_tx: string | null;  // Transaction hash of IP registration
  story_ip_registered_at: Date | null;  // When IP was registered
  story_license_terms_id: string | null;  // ID of attached license terms
  story_license_template_id: string | null;  // ID of license template used
  // Splits.org fields
  splits_address: string | null;  // Address of the Splits contract for revenue distribution
  // Livepeer Verifiable Video
  livepeer_attestation_id: string | null;  // Livepeer attestation id (creator attestation)
  // Clip / source origin (defaults to 'Upload' for non-clip content)
  source_type?: "Upload" | "Livestream" | "Clip";
  parent_playback_id?: string | null;  // For clips: playback_id of the source stream
  parent_story_ip_id?: string | null;  // For clips: Story IP ID of the source stream (if registered)
  clip_start_ms?: number | null;
  clip_end_ms?: number | null;
  clipper_address?: string | null;     // For clips: wallet that created the clip
  created_at: Date;
  updated_at: Date;
}

export interface NFTConfig {
  isMintable: boolean;
  maxSupply: number;
  price: number;
  royaltyPercentage: number;
}
