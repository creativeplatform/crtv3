/**
 * Lighthouse IPFS Storage Service
 * Primary storage with better CDN distribution (especially for West Coast)
 * Includes IPNS (InterPlanetary Name System) support for mutable content pointers
 */

export interface LighthouseUploadResult {
  success: boolean;
  hash?: string;
  url?: string;
  error?: string;
}

export interface LighthouseConfig {
  apiKey: string;
  gateway?: string;
}

export interface IPNSKey {
  ipnsName: string;
  ipnsId: string;
}

export interface IPNSKeyResponse {
  success: boolean;
  data?: IPNSKey;
  error?: string;
}

export interface IPNSPublishResult {
  success: boolean;
  data?: {
    Name: string;
    Value: string;
  };
  error?: string;
}

export interface IPNSRecord {
  ipnsName: string;
  ipnsId: string;
  publicKey?: string;
  cid?: string;
  lastUpdate?: number;
}

export interface IPNSListResponse {
  success: boolean;
  data?: IPNSRecord[];
  error?: string;
}

export interface IPNSRemoveResponse {
  success: boolean;
  data?: {
    Keys: Array<{
      Name: string;
      Id: string;
    }>;
  };
  error?: string;
}

import { serverLogger } from '@/lib/utils/logger';

export interface FilecoinDealStatus {
  pieceCID: string;
  payloadCid: string;
  pieceSize: number;
  carFileSize: number;
  dealId: number;
  miner: string;
  content: number;
  dealStatus: string;
  startEpoch: number;
  endEpoch: number;
  publishCid: string;
  dealUUID: string;
  providerCollateral: string;
  chainDealID: number;
}

export interface FilecoinDealStatusResponse {
  success: boolean;
  data?: FilecoinDealStatus[];
  error?: string;
}

export class LighthouseService {
  private apiKey: string;
  private gateway: string;
  /** Upload API: https://upload.lighthouse.storage/api/v0/add (per Lighthouse docs) */
  private uploadBaseUrl = 'https://upload.lighthouse.storage/api/v0';
  private ipnsBaseUrl = 'https://api.lighthouse.storage/api/ipns';

  constructor(config: LighthouseConfig) {
    this.apiKey = config.apiKey;
    this.gateway = config.gateway || 'https://gateway.lighthouse.storage/ipfs';
  }

  /**
   * Uploads a file to Lighthouse IPFS
   * Uses https://upload.lighthouse.storage/api/v0/add (max 24GB per request)
   * @param file - File or Blob to upload
   * @returns Promise with IPFS hash and URL
   */
  async uploadFile(file: File | Blob): Promise<LighthouseUploadResult> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${this.uploadBaseUrl}/add`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        serverLogger.error('Lighthouse upload error:', errorText);
        return {
          success: false,
          error: `Lighthouse upload failed: ${response.status} ${errorText}`,
        };
      }

      const data = await response.json();
      const inner = data.data ?? data;
      const hash = inner.Hash ?? inner.hash;

      if (!hash) {
        return {
          success: false,
          error: 'No hash returned from Lighthouse',
        };
      }

      return {
        success: true,
        hash,
        url: `${this.gateway}/${hash}`,
      };
    } catch (error) {
      serverLogger.error('Lighthouse upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Uploads text or JSON to Lighthouse (lighthouse-text rule).
   * For JSON, pass an object and it will be JSON.stringified.
   * @param text - Raw text or object (JSON.stringify applied if object)
   * @param name - Optional name for the content (defaults to Hash in response)
   */
  async uploadText(
    text: string | object,
    name?: string
  ): Promise<LighthouseUploadResult> {
    const str = typeof text === 'object' ? JSON.stringify(text) : text;
    const mime = typeof text === 'object' ? 'application/json' : 'text/plain';
    const filename = name ?? `text-${Date.now()}.${typeof text === 'object' ? 'json' : 'txt'}`;
    const blob = new Blob([str], { type: mime });
    const file = new File([blob], filename, { type: mime });
    return this.uploadFile(file);
  }

  /**
   * Uploads a buffer or typed array to Lighthouse (lighthouse-buffer rule).
   * @param buffer - ArrayBuffer, Buffer, or Uint8Array
   */
  async uploadBuffer(
    buffer: ArrayBuffer | Buffer | Uint8Array
  ): Promise<LighthouseUploadResult> {
    const bytes =
      buffer instanceof ArrayBuffer
        ? new Uint8Array(buffer)
        : Uint8Array.from(buffer);
    const blob = new Blob([bytes]);
    return this.uploadFile(blob);
  }

  /**
   * Gets the public URL for an IPFS hash
   */
  getPublicUrl(hash: string): string {
    return `${this.gateway}/${hash}`;
  }

  /**
   * IPNS (InterPlanetary Name System) Methods
   * Allows creating mutable pointers to IPFS content
   */

  /**
   * Creates a new IPNS key
   * @returns Promise with IPNS name and ID
   */
  async generateKey(): Promise<IPNSKeyResponse> {
    try {
      const response = await fetch(`${this.ipnsBaseUrl}/generate_key`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        serverLogger.error('Lighthouse IPNS generate key error:', errorText);
        return {
          success: false,
          error: `Failed to generate IPNS key: ${response.status} ${errorText}`,
        };
      }

      const data = await response.json();
      const responseData = data.data || data;

      return {
        success: true,
        data: {
          ipnsName: responseData.ipnsName || responseData.name,
          ipnsId: responseData.ipnsId || responseData.id,
        },
      };
    } catch (error) {
      serverLogger.error('Lighthouse IPNS generate key error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Publishes an IPFS hash (CID) to an IPNS key
   * @param cid - The IPFS hash (CID) to publish
   * @param keyName - The IPNS key name (ipnsName) to publish to
   * @returns Promise with IPNS name and IPFS path
   */
  async publishRecord(cid: string, keyName: string): Promise<IPNSPublishResult> {
    try {
      // Extract CID from various formats (ipfs://, /ipfs/, or just the hash)
      const cleanCid = cid.replace(/^ipfs:\/\//, '').replace(/^\/ipfs\//, '');

      const response = await fetch(
        `${this.ipnsBaseUrl}/publish_record?cid=${encodeURIComponent(cleanCid)}&keyName=${encodeURIComponent(keyName)}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        serverLogger.error('Lighthouse IPNS publish error:', errorText);
        return {
          success: false,
          error: `Failed to publish IPNS record: ${response.status} ${errorText}`,
        };
      }

      const data = await response.json();
      const responseData = data.data || data;

      return {
        success: true,
        data: {
          Name: responseData.Name || responseData.name || responseData.ipnsId,
          Value: responseData.Value || responseData.value || `/ipfs/${cleanCid}`,
        },
      };
    } catch (error) {
      serverLogger.error('Lighthouse IPNS publish error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Updates an IPNS key to point to a new CID
   * This is the same as publishRecord - just call publishRecord again with a new CID
   * @param cid - The new IPFS hash (CID) to publish
   * @param keyName - The IPNS key name (ipnsName) to update
   * @returns Promise with IPNS name and IPFS path
   */
  async updateRecord(cid: string, keyName: string): Promise<IPNSPublishResult> {
    // Update is the same as publish - just publish a new CID to the same key
    return this.publishRecord(cid, keyName);
  }

  /**
   * Retrieves all IPNS keys for the account
   * @returns Promise with array of IPNS records
   */
  async getAllKeys(): Promise<IPNSListResponse> {
    try {
      const response = await fetch(`${this.ipnsBaseUrl}/get_ipns_records`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        serverLogger.error('Lighthouse IPNS get all keys error:', errorText);
        return {
          success: false,
          error: `Failed to get IPNS keys: ${response.status} ${errorText}`,
        };
      }

      const data = await response.json();
      const responseData = data.data || data;

      // Handle both array and object with array property
      const records = Array.isArray(responseData) ? responseData : (responseData.records || []);

      return {
        success: true,
        data: records.map((record: any) => ({
          ipnsName: record.ipnsName || record.name || record.Name,
          ipnsId: record.ipnsId || record.id || record.Id,
          publicKey: record.publicKey,
          cid: record.cid || record.CID,
          lastUpdate: record.lastUpdate || record.last_update,
        })),
      };
    } catch (error) {
      serverLogger.error('Lighthouse IPNS get all keys error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Removes an IPNS key
   * @param keyName - The IPNS key name (ipnsName) to remove
   * @returns Promise with remaining keys
   */
  async removeKey(keyName: string): Promise<IPNSRemoveResponse> {
    try {
      const response = await fetch(
        `${this.ipnsBaseUrl}/remove_key?keyName=${encodeURIComponent(keyName)}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        serverLogger.error('Lighthouse IPNS remove key error:', errorText);
        return {
          success: false,
          error: `Failed to remove IPNS key: ${response.status} ${errorText}`,
        };
      }

      const data = await response.json();
      const responseData = data.data || data;

      return {
        success: true,
        data: {
          Keys: (responseData.Keys || responseData.keys || []).map((key: any) => ({
            Name: key.Name || key.name || key.ipnsName,
            Id: key.Id || key.id || key.ipnsId,
          })),
        },
      };
    } catch (error) {
      serverLogger.error('Lighthouse IPNS remove key error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Gets the IPNS URL for a key
   * @param ipnsId - The IPNS ID (not the name)
   * @returns The IPNS gateway URL
   */
  getIPNSUrl(ipnsId: string): string {
    // Remove /ipns/ prefix if present
    const cleanId = ipnsId.replace(/^\/ipns\//, '');
    return `${this.gateway.replace('/ipfs', '')}/ipns/${cleanId}`;
  }

  /**
   * Gets the IPNS URL for a key name (requires lookup first)
   * @param ipnsName - The IPNS name (requires getAllKeys first to get the ID)
   * @returns Promise with IPNS gateway URL or null if key not found
   */
  async getIPNSUrlByName(ipnsName: string): Promise<string | null> {
    const keysResult = await this.getAllKeys();
    if (!keysResult.success || !keysResult.data) {
      return null;
    }

    const key = keysResult.data.find(k => k.ipnsName === ipnsName);
    if (!key) {
      return null;
    }

    return this.getIPNSUrl(key.ipnsId);
  }

  /**
   * File Retrieval Methods
   * Allows downloading files from IPFS using CIDs
   */

  /**
   * Retrieves a file from IPFS using its CID
   * @param cid - The IPFS Content Identifier (CID)
   * @returns Promise with file content as Blob and content type
   */
  async retrieveFile(cid: string): Promise<{
    success: boolean;
    blob?: Blob;
    contentType?: string;
    error?: string;
  }> {
    try {
      // Extract CID from various formats (ipfs://, /ipfs/, or just the hash)
      const cleanCid = cid.replace(/^ipfs:\/\//, '').replace(/^\/ipfs\//, '');
      const url = `${this.gateway}/${cleanCid}`;

      // Public gateways don't require authentication, but we include it in case of private gateways
      const headers: HeadersInit = {};
      
      // Only add Authorization header if we have an API key (for private gateways)
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        serverLogger.error('Lighthouse file retrieval error:', errorText);
        return {
          success: false,
          error: `Failed to retrieve file: ${response.status} ${errorText}`,
        };
      }

      const blob = await response.blob();
      const contentType = response.headers.get('content-type') || 'application/octet-stream';

      return {
        success: true,
        blob,
        contentType,
      };
    } catch (error) {
      serverLogger.error('Lighthouse file retrieval error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Retrieves a file from IPFS and saves it (Node.js only)
   * Note: This method is for server-side use only
   * @param cid - The IPFS Content Identifier (CID)
   * @param filePath - The file path to save to
   * @returns Promise with success status
   */
  async downloadFile(cid: string, filePath: string): Promise<{
    success: boolean;
    filePath?: string;
    size?: number;
    contentType?: string;
    error?: string;
  }> {
    try {
      // This method should only be used in Node.js environments
      if (typeof window !== 'undefined') {
        return {
          success: false,
          error: 'downloadFile can only be used in Node.js environments. Use retrieveFile for browser environments.',
        };
      }

      const result = await this.retrieveFile(cid);
      if (!result.success || !result.blob) {
        return {
          success: false,
          error: result.error || 'Failed to retrieve file',
        };
      }

      // Convert Blob to Buffer for Node.js
      const buffer = Buffer.from(await result.blob.arrayBuffer());
      
      // Use Node.js fs to write file
      const fs = await import('fs/promises');
      await fs.writeFile(filePath, buffer);

      return {
        success: true,
        filePath,
        size: buffer.length,
        contentType: result.contentType,
      };
    } catch (error) {
      serverLogger.error('Lighthouse file download error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Filecoin Deal Status Methods
   * Allows checking the status of Filecoin storage deals
   */

  /**
   * Checks the Filecoin deal status for a CID
   * @param cid - The IPFS Content Identifier (CID) to check deals for
   * @returns Promise with array of Filecoin deal statuses
   */
  async getDealStatus(cid: string): Promise<FilecoinDealStatusResponse> {
    try {
      // Extract CID from various formats
      const cleanCid = cid.replace(/^ipfs:\/\//, '').replace(/^\/ipfs\//, '');

      const response = await fetch(
        `https://api.lighthouse.storage/api/lighthouse/deal_status?cid=${encodeURIComponent(cleanCid)}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        serverLogger.error('Lighthouse deal status error:', errorText);
        return {
          success: false,
          error: `Failed to get deal status: ${response.status} ${errorText}`,
        };
      }

      const data = await response.json();
      const responseData = data.data || data;

      // Handle both array and object with array property
      const deals = Array.isArray(responseData) ? responseData : (responseData.deals || []);

      return {
        success: true,
        data: deals.map((deal: any) => ({
          pieceCID: deal.pieceCID || deal.piece_cid,
          payloadCid: deal.payloadCid || deal.payload_cid,
          pieceSize: deal.pieceSize || deal.piece_size || 0,
          carFileSize: deal.carFileSize || deal.car_file_size || 0,
          dealId: deal.dealId || deal.deal_id || 0,
          miner: deal.miner || deal.storageProvider || deal.storage_provider,
          content: deal.content || 0,
          dealStatus: deal.dealStatus || deal.deal_status || deal.status,
          startEpoch: deal.startEpoch || deal.start_epoch || 0,
          endEpoch: deal.endEpoch || deal.end_epoch || 0,
          publishCid: deal.publishCid || deal.publish_cid,
          dealUUID: deal.dealUUID || deal.deal_uuid,
          providerCollateral: deal.providerCollateral || deal.provider_collateral,
          chainDealID: deal.chainDealID || deal.chain_deal_id || deal.dealId || 0,
        })),
      };
    } catch (error) {
      serverLogger.error('Lighthouse deal status error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
