"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from "react";
import type { Helia } from "helia";
import type { UnixFS } from "@helia/unixfs";
import { logger } from "@/lib/utils/logger";

/**
 * HeliaContext Type Definition
 *
 * Manages the Helia IPFS node instance throughout the application.
 * Following the helia-nextjs example pattern for Next.js integration.
 *
 * @property {Helia | null} helia - The Helia IPFS node instance
 * @property {UnixFS | null} fs - The UnixFS instance for file operations
 * @property {boolean} isReady - Whether Helia is initialized and ready
 * @property {Error | null} error - Any initialization error
 */
interface HeliaContextType {
  helia: Helia | null;
  fs: UnixFS | null;
  isReady: boolean;
  error: Error | null;
}

/**
 * Create the Helia Context with default values
 */
const HeliaContext = createContext<HeliaContextType>({
  helia: null,
  fs: null,
  isReady: false,
  error: null,
});

/**
 * Custom hook to access the Helia context
 *
 * Use this hook in any component that needs to interact with IPFS via Helia.
 *
 * Example usage:
 * ```tsx
 * function UploadComponent() {
 *   const { helia, fs, isReady } = useHelia();
 *
 *   const handleUpload = async (file: File) => {
 *     if (!isReady || !fs) return;
 *
 *     const buffer = await file.arrayBuffer();
 *     const content = new Uint8Array(buffer);
 *     const cid = await fs.addBytes(content);
 *     logger.debug('Uploaded:', cid.toString());
 *   };
 *
 *   return <button onClick={() => handleUpload(file)} disabled={!isReady}>Upload</button>;
 * }
 * ```
 *
 * @returns {HeliaContextType} The Helia context values
 */
export const useHelia = () => useContext(HeliaContext);

/**
 * Helia Provider Component
 *
 * Provides Helia IPFS node instance throughout the application.
 * Following the helia-nextjs example pattern for proper Next.js integration.
 *
 * Features:
 * - Single Helia instance shared across the app
 * - Proper initialization and cleanup
 * - Error handling
 * - Ready state tracking
 *
 * Usage:
 * ```tsx
 * <HeliaProvider>
 *   <YourApp />
 * </HeliaProvider>
 * ```
 *
 * @param {Object} props - Component props
 * @param {ReactNode} props.children - Child components
 */
export const HeliaProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [helia, setHelia] = useState<Helia | null>(null);
  const [fs, setFs] = useState<UnixFS | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const isInitializing = useRef(false);

  useEffect(() => {
    // Prevent multiple initialization attempts
    if (isInitializing.current) return;

    let mounted = true;
    let heliaInstance: Helia | null = null;

    const initHelia = async () => {
      if (isInitializing.current) return;
      isInitializing.current = true;

      try {
        logger.debug("[HeliaProvider] Initializing Helia...");

        // Load Helia only in the browser — static imports pull node-datachannel (native .node)
        // into the SSR bundle and crash Node (MODULE_NOT_FOUND for node_datachannel.node).
        const [{ createNode }, { unixfs }] = await Promise.all([
          import("@/lib/sdk/ipfs/helia-config"),
          import("@helia/unixfs"),
        ]);

        heliaInstance = await createNode();
        const fsInstance = unixfs(heliaInstance!);

        // Only update state if component is still mounted
        if (mounted) {
          setHelia(heliaInstance);
          setFs(fsInstance);
          setIsReady(true);
          setError(null);
          logger.debug("[HeliaProvider] Helia initialized successfully");
        } else {
          // Clean up if component unmounted during initialization
          await heliaInstance.stop();
        }
      } catch (err) {
        logger.error("[HeliaProvider] Failed to initialize Helia:", err);
        if (mounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsReady(false);
        }
        heliaInstance = null;
      } finally {
        isInitializing.current = false;
      }
    };

    // Initialize on mount
    initHelia();

    // Cleanup on unmount
    return () => {
      mounted = false;
      if (heliaInstance) {
        logger.debug("[HeliaProvider] Stopping Helia instance...");
        heliaInstance.stop().catch((err) => {
          logger.error("[HeliaProvider] Error stopping Helia:", err);
        });
        heliaInstance = null;
      }
      setHelia(null);
      setFs(null);
      setIsReady(false);
    };
  }, []); // Only run on mount

  return (
    <HeliaContext.Provider value={{ helia, fs, isReady, error }}>
      {children}
    </HeliaContext.Provider>
  );
};
