import type { Helia } from 'helia';
import type { UnixFS } from '@helia/unixfs';
import { LighthouseService } from './lighthouse-service';
import { FilecoinFirstService } from './filecoin-first-service';
import { groveService } from '@/lib/sdk/grove/service';
import { serverLogger } from '@/lib/utils/logger';

export interface IPFSUploadResult {
  success: boolean;
  url?: string;
  hash?: string;
  error?: string;
  filecoinDealId?: string;
}

export interface IPFSConfig {
  /** Optional paid mirror; uploads try Lens Grove first. */
  lighthouseApiKey?: string;
  filecoinFirstApiKey?: string;
  gateway?: string;
  enableFilecoinArchival?: boolean;
  helia?: Helia;
  fs?: UnixFS;
}

let fallbackHeliaInstance: Helia | null = null;
let fallbackHeliaFs: UnixFS | null = null;

function toUploadableFile(file: File | Blob, fallbackName = 'upload'): File {
  if (file instanceof File) return file;
  return new File([file], fallbackName, {
    type: file.type || 'application/octet-stream',
  });
}

function isLikelyIpfsCid(value: string): boolean {
  return (
    value.startsWith('Qm') ||
    value.startsWith('bafy') ||
    value.startsWith('bafkq') ||
    value.startsWith('bafkr')
  );
}

export class IPFSService {
  private lighthouseApiKey?: string;
  private filecoinFirstApiKey?: string;
  private enableFilecoinArchival: boolean;
  private gateway: string;
  private lighthouseService?: LighthouseService;
  private filecoinFirstService?: FilecoinFirstService;
  private helia?: Helia;
  private fs?: UnixFS;
  private initialized = false;

  constructor(config: IPFSConfig) {
    this.lighthouseApiKey = config.lighthouseApiKey;
    this.filecoinFirstApiKey = config.filecoinFirstApiKey;
    this.enableFilecoinArchival = config.enableFilecoinArchival ?? false;
    this.gateway =
      config.gateway ||
      (config.lighthouseApiKey
        ? 'https://gateway.lighthouse.storage/ipfs'
        : 'https://w3s.link/ipfs');

    if (config.helia && config.fs) {
      this.helia = config.helia;
      this.fs = config.fs;
      this.initialized = true;
      serverLogger.debug('[IPFSService] Using Helia instance from context');
    }

    if (this.lighthouseApiKey) {
      this.lighthouseService = new LighthouseService({
        apiKey: this.lighthouseApiKey,
        gateway: this.gateway,
      });
    }

    if (this.filecoinFirstApiKey && this.enableFilecoinArchival) {
      this.filecoinFirstService = new FilecoinFirstService({
        apiKey: this.filecoinFirstApiKey,
      });
    }
  }

  /** Helia + native node-datachannel: load only when Grove/Lighthouse are insufficient (avoids SSR crash). */
  private async initializeFallbackHelia(): Promise<void> {
    if (this.initialized && this.fs) {
      return;
    }

    try {
      if (!fallbackHeliaInstance) {
        serverLogger.debug('[IPFSService] Initializing fallback Helia (dynamic import)...');
        const [{ createNode }, { unixfs }] = await Promise.all([
          import('./helia-config'),
          import('@helia/unixfs'),
        ]);
        fallbackHeliaInstance = await createNode();
        fallbackHeliaFs = unixfs(fallbackHeliaInstance);
      }
      this.helia = fallbackHeliaInstance;
      this.fs = fallbackHeliaFs!;
      this.initialized = true;
      serverLogger.debug('[IPFSService] Fallback Helia ready');
    } catch (error) {
      serverLogger.error('[IPFSService] Fallback Helia failed:', error);
      throw error;
    }
  }

  /**
   * Upload order: Lens Grove (primary) → Lighthouse (if API key) → Helia (context or dynamic fallback).
   */
  async uploadFile(
    file: File | Blob,
    options: {
      pin?: boolean;
      wrapWithDirectory?: boolean;
      maxSize?: number;
    } = {}
  ): Promise<IPFSUploadResult> {
    void options;
    const asFile = toUploadableFile(file);

    try {
      const groveResult = await groveService.uploadFile(asFile);
      if (groveResult.success && groveResult.url) {
        serverLogger.debug('[IPFSService] ✅ Grove upload successful');
        const hash = groveResult.hash ?? groveResult.url;
        this.maybeFilecoinArchival(hash);
        return {
          success: true,
          url: groveResult.url,
          hash,
        };
      }
      serverLogger.warn(
        '[IPFSService] Grove upload did not return a URL:',
        groveResult.error
      );
    } catch (err) {
      serverLogger.warn('[IPFSService] Grove upload failed:', err);
    }

    if (this.lighthouseService) {
      try {
        const lighthouseResult = await this.lighthouseService.uploadFile(asFile);
        if (lighthouseResult.success && lighthouseResult.hash) {
          serverLogger.debug('[IPFSService] ✅ Lighthouse upload successful');
          const finalHash = lighthouseResult.hash;
          const finalUrl =
            lighthouseResult.url || `${this.gateway}/${finalHash}`;
          this.maybeFilecoinArchival(finalHash);
          return { success: true, url: finalUrl, hash: finalHash };
        }
        serverLogger.warn(
          '[IPFSService] Lighthouse upload failed:',
          lighthouseResult.error
        );
      } catch (err) {
        serverLogger.warn('[IPFSService] Lighthouse upload error:', err);
      }
    }

    if (this.fs) {
      return this.uploadViaHelia(asFile);
    }

    try {
      await this.initializeFallbackHelia();
      if (!this.fs) {
        return {
          success: false,
          error:
            'IPFS upload failed: Grove and Lighthouse unavailable and Helia could not start.',
        };
      }
      return this.uploadViaHelia(asFile);
    } catch {
      return {
        success: false,
        error:
          'IPFS upload failed after Grove/Lighthouse; Helia fallback could not load (native node may be missing on server).',
      };
    }
  }

  private async uploadViaHelia(asFile: File): Promise<IPFSUploadResult> {
    if (!this.fs) {
      return {
        success: false,
        error: 'Helia UnixFS not available',
      };
    }
    const buffer = await asFile.arrayBuffer();
    const content = new Uint8Array(buffer);
    const cid = await this.fs.addBytes(content);
    const heliaHash = cid.toString();
    serverLogger.debug('[IPFSService] ✅ Helia upload:', heliaHash);
    const finalUrl = `${this.gateway}/${heliaHash}`;
    this.maybeFilecoinArchival(heliaHash);
    return {
      success: true,
      url: finalUrl,
      hash: heliaHash,
    };
  }

  private maybeFilecoinArchival(hash: string): void {
    if (
      !this.filecoinFirstService ||
      !this.enableFilecoinArchival ||
      !isLikelyIpfsCid(hash)
    ) {
      return;
    }
    this.createFilecoinDeal(hash)
      .then((result) => {
        if (result.success && result.dealId) {
          serverLogger.debug(
            `[IPFSService] Filecoin deal created for ${hash}:`,
            result.dealId
          );
        }
      })
      .catch((err) => {
        serverLogger.warn('[IPFSService] Filecoin archival failed:', err);
      });
  }

  private async createFilecoinDeal(
    cid: string
  ): Promise<{ success: boolean; dealId?: string; error?: string }> {
    if (!this.filecoinFirstService) {
      return { success: false, error: 'Filecoin First service not initialized' };
    }
    try {
      return await this.filecoinFirstService.pinCid(cid);
    } catch (error) {
      serverLogger.error(`Filecoin deal error for ${cid}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async uploadFiles(
    files: File[],
    options: {
      pin?: boolean;
      wrapWithDirectory?: boolean;
    } = {}
  ): Promise<IPFSUploadResult[]> {
    const results: IPFSUploadResult[] = [];
    for (const f of files) {
      results.push(await this.uploadFile(f, options));
    }
    return results;
  }

  getPublicUrl(hash: string): string {
    return `${this.gateway}/${hash}`;
  }
}

/** Default instance: Grove first; optional Lighthouse / Filecoin via env. */
export const ipfsService = new IPFSService({
  lighthouseApiKey: process.env.NEXT_PUBLIC_LIGHTHOUSE_API_KEY,
  filecoinFirstApiKey: process.env.NEXT_PUBLIC_FILECOIN_FIRST_API_KEY,
  enableFilecoinArchival:
    process.env.NEXT_PUBLIC_ENABLE_FILECOIN_ARCHIVAL === 'true',
  gateway:
    process.env.NEXT_PUBLIC_IPFS_GATEWAY ||
    (process.env.NEXT_PUBLIC_LIGHTHOUSE_API_KEY
      ? 'https://gateway.lighthouse.storage/ipfs'
      : 'https://w3s.link/ipfs'),
});
