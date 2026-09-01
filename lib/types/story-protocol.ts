/**
 * Story Protocol TypeScript types for IP Asset registration and management
 */

/**
 * Story Protocol IP Asset data structure
 */
export interface StoryIPAsset {
  ipId: string; // IP Asset ID on Story Protocol
  nftContract: string; // NFT contract address
  tokenId: string; // NFT token ID
  metadataURI?: string; // IPFS metadata URI
  registeredAt: Date; // Registration timestamp
  registrationTx: string; // Registration transaction hash
}

/**
 * License terms configuration for Story Protocol
 */
export interface StoryLicenseTerms {
  termsId?: string; // License terms ID (if already registered)
  templateId?: string; // License template ID
  commercialUse: boolean; // Allow commercial use
  derivativesAllowed: boolean; // Allow derivatives/remixes
  derivativesAttribution: boolean; // Require attribution for derivatives
  derivativesApproval: boolean; // Require approval for derivatives
  derivativesReciprocal: boolean; // Require reciprocal licensing
  distributionMethod?: string; // Distribution method (if applicable)
  revenueShare?: number; // Revenue share percentage (0-100)
  /** URI for the license terms (e.g. app video page or license doc). Links IP license back to source video. */
  licenseTermsUri?: string;
  /**
   * Minting fee in whole WIP/$DATA tokens (human-readable).
   * Converted to wei (18 decimals) when attaching PIL terms. Default 0 = free.
   */
  defaultMintingFee?: number;
}

/**
 * Options for IP Asset registration
 */
export interface StoryIPRegistrationOptions {
  registerIP: boolean; // Whether to register IP
  licenseTerms?: StoryLicenseTerms; // License terms to attach
  metadataURI?: string; // Custom metadata URI (optional)
  /** Canonical URL of the source video (e.g. app watch page). Used for PIL terms uri and IP metadata reference. */
  sourceVideoUrl?: string;
}

/**
 * Result of IP Asset registration
 */
export interface StoryIPRegistrationResult {
  success: boolean;
  ipId?: string; // IP Asset ID if successful
  registrationTx?: string; // Transaction hash if successful
  licenseTermsId?: string; // License terms ID if attached
  error?: string; // Error message if failed
}

/**
 * IP Asset status from Story Protocol
 */
export interface StoryIPAssetStatus {
  ipId: string;
  exists: boolean;
  nftContract?: string;
  tokenId?: string;
  metadataURI?: string;
  licenseTermsId?: string;
}

/**
 * PIL (Programmable IP License) template/flavor options
 */
export interface PILTemplate {
  id: string;
  name: string;
  description: string;
  terms: Partial<StoryLicenseTerms>;
}

/**
 * Common PIL templates/flavors
 */
export const PIL_TEMPLATES: PILTemplate[] = [
  {
    id: 'commercial-remix',
    name: 'Commercial Remix',
    description: 'Allows commercial use and derivatives with attribution',
    terms: {
      commercialUse: true,
      derivativesAllowed: true,
      derivativesAttribution: true,
      derivativesApproval: false,
      derivativesReciprocal: false,
    },
  },
  {
    id: 'non-commercial-share-alike',
    name: 'Non-Commercial Share Alike',
    description: 'Non-commercial use only, derivatives must use same license',
    terms: {
      commercialUse: false,
      derivativesAllowed: true,
      derivativesAttribution: true,
      derivativesApproval: false,
      derivativesReciprocal: true,
    },
  },
  {
    id: 'commercial-no-derivatives',
    name: 'Commercial No Derivatives',
    description: 'Commercial use allowed, but no derivatives or remixes',
    terms: {
      commercialUse: true,
      derivativesAllowed: false,
      derivativesAttribution: false,
      derivativesApproval: false,
      derivativesReciprocal: false,
    },
  },
  {
    id: 'all-rights-reserved',
    name: 'All Rights Reserved',
    description: 'No commercial use, no derivatives allowed',
    terms: {
      commercialUse: false,
      derivativesAllowed: false,
      derivativesAttribution: false,
      derivativesApproval: false,
      derivativesReciprocal: false,
    },
  },
];

