"use client";

import { useMemo } from "react";
import { useHelia } from "@/context/HeliaContext";
import { IPFSService, IPFSConfig } from "@/lib/sdk/ipfs/service";
import { logger } from '@/lib/utils/logger';


/**
 * Hook to get an IPFS service instance with Helia from context
 * Following the helia-nextjs pattern for Next.js integration
 * 
 * This hook provides an IPFS service that uses the Helia instance
 * from the HeliaProvider context, making it the primary method
 * for IPFS operations.
 * 
 * @param config - Optional IPFS configuration (Lighthouse mirror, Filecoin archival, gateway)
 *                 Note: For optimal performance, memoize this object with useMemo if passing config.
 * @returns IPFSService instance configured with Helia from context
 * 
 * Example usage:
 * ```tsx
 * function UploadComponent() {
 *   const ipfsService = useIpfsService();
 *   
 *   const handleUpload = async (file: File) => {
 *     const result = await ipfsService.uploadFile(file);
 *     if (result.success) {
 *       logger.debug('Uploaded:', result.hash);
 *     }
 *   };
 *   
 *   return <button onClick={() => handleUpload(file)}>Upload</button>;
 * }
 * 
 * // With config (memoize for performance):
 * function UploadComponentWithConfig() {
 *   const config = useMemo(() => ({
 *     lighthouseApiKey: process.env.NEXT_PUBLIC_LIGHTHOUSE_API_KEY,
 *   }), []);
 *   
 *   const { ipfsService } = useIpfsService(config);
 *   // ... rest of component
 * }
 * ```
 */
export function useIpfsService(config?: Omit<IPFSConfig, 'helia' | 'fs'>) {
  const { helia, fs, isReady, error } = useHelia();

  // Memoize the config object based on its primitive values to avoid
  // recreating the service instance on every render when config object reference changes
  const stableConfig = useMemo(() => {
    if (!config) return undefined;
    
    return {
      lighthouseApiKey: config.lighthouseApiKey,
      filecoinFirstApiKey: config.filecoinFirstApiKey,
      gateway: config.gateway,
      enableFilecoinArchival: config.enableFilecoinArchival,
    };
  }, [
    config?.lighthouseApiKey,
    config?.filecoinFirstApiKey,
    config?.gateway,
    config?.enableFilecoinArchival,
  ]);

  const ipfsService = useMemo(() => {
    // Create IPFS service with Helia from context (following helia-nextjs pattern)
    return new IPFSService({
      ...stableConfig,
      helia: helia || undefined,
      fs: fs || undefined,
    });
  }, [helia, fs, stableConfig]);

  return {
    ipfsService,
    isReady,
    error,
  };
}
