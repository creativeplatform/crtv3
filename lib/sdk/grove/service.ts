
import { StorageClient, immutable } from "@lens-chain/storage-client";
import { getLensChainId } from "@/lib/sdk/lens/chains";
import { serverLogger } from '@/lib/utils/logger';

export interface GroveUploadResult {
    success: boolean;
    url?: string;
    hash?: string; // This will map to the Grove storage key or URI
    error?: string;
}

export class GroveService {
    private client: StorageClient;

    constructor() {
        this.client = StorageClient.create();
    }

    /**
     * Uploads a file to Grove.
     * Uses immutable ACL by default for simplicity and asset permanence.
     * 
     * @param file - The file to upload
     * @returns GroveUploadResult
     */
    async uploadFile(file: File): Promise<GroveUploadResult> {
        try {
            const acl = immutable(getLensChainId());

            const response = await this.client.uploadFile(file, { acl });

            if (response && response.gatewayUrl) {
                serverLogger.debug('[GroveService] ✅ Upload successful:', response.gatewayUrl);
                return {
                    success: true,
                    url: response.gatewayUrl,
                    hash: response.storageKey, // or response.uri
                };
            }

            return {
                success: false,
                error: "Upload response missing gateway URL"
            };

        } catch (error) {
            serverLogger.error('[GroveService] ❌ Upload error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown Grove upload error"
            };
        }
    }

    /**
     * Uploads a JSON object to Grove.
     * Useful for metadata uploads.
     * 
     * @param json - The JSON object to upload
     * @returns GroveUploadResult
     */
    async uploadJson(json: unknown): Promise<GroveUploadResult> {
        try {
            const acl = immutable(getLensChainId());

            const response = await this.client.uploadAsJson(json, { acl });

            if (response && response.gatewayUrl) {
                serverLogger.debug('[GroveService] ✅ JSON Upload successful:', response.gatewayUrl);
                return {
                    success: true,
                    url: response.gatewayUrl,
                    hash: response.storageKey,
                };
            }

            return {
                success: false,
                error: "Upload response missing gateway URL"
            };
        } catch (error) {
            serverLogger.error('[GroveService] ❌ JSON Upload error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown Grove JSON upload error"
            };
        }
    }
}

export const groveService = new GroveService();
