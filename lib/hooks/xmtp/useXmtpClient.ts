"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Client } from "@xmtp/browser-sdk";
import { useUser, useSignMessage, useSmartAccountClient } from "@account-kit/react";
import { createXmtpSigner } from "@/lib/utils/xmtp/signer";
import useModularAccount from "@/lib/hooks/accountkit/useModularAccount";
import { logger } from '@/lib/utils/logger';

// Import WASM patch early to ensure it's applied before XMTP initialization
import "@/lib/utils/xmtp/wasm-patch";
// Import debug utility (only in development)
if (process.env.NODE_ENV === 'development') {
  import("@/lib/utils/xmtp/wasm-debug").then(({ logWasmDebugInfo }) => {
    // Log debug info after a short delay to ensure patches are applied
    setTimeout(() => {
      logWasmDebugInfo();
    }, 100);
  });
}

export interface UseXmtpClientReturn {
  client: Client | null;
  isLoading: boolean;
  error: Error | null;
  isConnected: boolean;
  retry: () => void;
}

// Configuration constants
const INIT_TIMEOUT_MS = 45000; // 45 seconds (increased from 30)
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 2000; // 2 seconds
const MAX_RETRY_DELAY_MS = 10000; // 10 seconds

// Must match XMTP_ENV used by scripts/xmtp-moderation-worker.ts.
// Browser SDK defaults to 'dev' if omitted, which silently isolates users
// from the production network and from the moderation bot's inbox.
type XmtpEnv = 'local' | 'dev' | 'production';
const XMTP_ENV: XmtpEnv =
  (process.env.NEXT_PUBLIC_XMTP_ENV as XmtpEnv | undefined) ?? 'production';

/**
 * Hook to initialize and manage XMTP client
 * 
 * Uses Account Kit wallet (EOA or Smart Account) to create XMTP client
 * The client is automatically created when wallet is connected
 * 
 * Features:
 * - Retry logic with exponential backoff
 * - Timeout handling with proper cancellation
 * - Prevents concurrent initialization attempts
 */
export function useXmtpClient(): UseXmtpClientReturn {
  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Refs to track initialization state and cancel timeouts
  const isInitializingRef = useRef(false);
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const user = useUser();
  const { smartAccountClient, address: smartAccountAddress } = useModularAccount();
  
  // Get smart account client (prefer from useModularAccount, fallback to useSmartAccountClient)
  const { client: fallbackClient } = useSmartAccountClient({});
  const accountClient = smartAccountClient || fallbackClient;

  // Get the wallet address (prefer smart account, fallback to EOA)
  const walletAddress = smartAccountAddress || user?.address || null;

  // Initialize signMessage hook with client
  // We'll use a Promise wrapper to capture the signature from callbacks
  const signMessagePromiseRef = useRef<{
    resolve: (value: string) => void;
    reject: (error: Error) => void;
  } | null>(null);
  
  const { signMessage } = useSignMessage({
    client: accountClient || undefined,
    onSuccess: (result: string) => {
      if (signMessagePromiseRef.current) {
        signMessagePromiseRef.current.resolve(result);
        signMessagePromiseRef.current = null;
      }
    },
    onError: (error: Error) => {
      if (signMessagePromiseRef.current) {
        signMessagePromiseRef.current.reject(error);
        signMessagePromiseRef.current = null;
      }
    },
  });

  /**
   * Creates a timeout promise that can be cancelled
   */
  const createTimeoutPromise = (timeoutMs: number, abortSignal?: AbortSignal): Promise<never> => {
    return new Promise<never>((_, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error("XMTP client initialization timeout"));
      }, timeoutMs);
      
      timeoutIdRef.current = timeoutId;
      
      // Cancel timeout if abort signal is triggered
      if (abortSignal) {
        abortSignal.addEventListener('abort', () => {
          clearTimeout(timeoutId);
          timeoutIdRef.current = null;
        });
      }
    });
  };

  /**
   * Cleans up any pending timeouts and abort controllers
   */
  const cleanupInit = useCallback(() => {
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    isInitializingRef.current = false;
  }, []);

  /**
   * Calculates exponential backoff delay with jitter
   */
  const calculateRetryDelay = (attempt: number): number => {
    const baseDelay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
    const jitter = Math.random() * 1000; // Add up to 1 second of jitter
    return Math.min(baseDelay + jitter, MAX_RETRY_DELAY_MS);
  };

  const initializeClient = useCallback(async (attempt: number = 0): Promise<void> => {
    const isDev = process.env.NODE_ENV === 'development';
    
    // Prevent concurrent initialization attempts
    if (isInitializingRef.current) {
      if (isDev) {
        logger.debug("useXmtpClient: Initialization already in progress, skipping");
      }
      return;
    }

    if (isDev) {
      logger.debug("useXmtpClient: Checking initialization prerequisites", {
        hasWalletAddress: !!walletAddress,
        hasSignMessage: !!signMessage,
        hasAccountClient: !!accountClient,
        xmtpEnv: XMTP_ENV,
        attempt,
        retryCount: attempt,
      });
    }

    if (!walletAddress || !signMessage || !accountClient) {
      if (isDev) {
        logger.debug("useXmtpClient: Missing prerequisites, clearing client");
      }
      setClient(null);
      cleanupInit();
      return;
    }

    isInitializingRef.current = true;
    setIsLoading(true);
    setError(null);
    setRetryCount(attempt);

    // Create abort controller for this initialization attempt
    abortControllerRef.current = new AbortController();
    const abortSignal = abortControllerRef.current.signal;

    try {
      if (isDev) {
        logger.debug(`useXmtpClient: Starting client initialization (attempt ${attempt + 1}/${MAX_RETRIES + 1})`);
      }

      // WASM patching is handled by wasm-patch.ts import above
      // No need to call initializeWasmLoader() here as it's auto-initialized
      
      // Create signer for XMTP
      const signer = createXmtpSigner(walletAddress, async (message: string): Promise<string> => {
        if (abortSignal.aborted) {
          throw new Error("Initialization cancelled");
        }
        
        // Wrap signMessage (which uses callbacks) in a Promise
        return new Promise<string>((resolve, reject) => {
          // Store the resolve/reject functions so callbacks can use them
          signMessagePromiseRef.current = { resolve, reject };
          
          try {
            // Call signMessage - the result will be captured by onSuccess/onError callbacks
            signMessage({ message });
          } catch (error) {
            // If signMessage throws synchronously, reject immediately
            if (signMessagePromiseRef.current) {
              signMessagePromiseRef.current.reject(error instanceof Error ? error : new Error(String(error)));
              signMessagePromiseRef.current = null;
            }
          }
        });
      });
      
      // Create XMTP client with timeout and abort signal.
      // dbEncryptionKey is a no-op in the browser SDK (OPFS storage is not encrypted).
      const initPromise = Client.create(signer, {
        env: XMTP_ENV,
      });
      
      // Check if already aborted
      if (abortSignal.aborted) {
        throw new Error("Initialization cancelled");
      }
      
      const timeoutPromise = createTimeoutPromise(INIT_TIMEOUT_MS, abortSignal);
      
      const xmtpClient = await Promise.race([initPromise, timeoutPromise]);

      // Check if aborted after race
      if (abortSignal.aborted) {
        throw new Error("Initialization cancelled");
      }

      // Clear timeout since we succeeded
      cleanupInit();

      if (isDev) {
        logger.debug("useXmtpClient: Client created successfully");
      }

      setClient(xmtpClient);
      setError(null);
      setRetryCount(0);
    } catch (err) {
      // Clean up on error
      cleanupInit();

      const errorMessage = err instanceof Error ? err.message : String(err);
      const fullError = err instanceof Error ? err : new Error(`Failed to initialize XMTP client: ${errorMessage}`);
      
      // Check if this is a retryable error
      const isRetryable = errorMessage.includes('timeout') || 
                         errorMessage.includes('fetch') ||
                         errorMessage.includes('network') ||
                         errorMessage.includes('wasm') ||
                         errorMessage.includes('WASM');

      // Always log init errors so production outages are diagnosable from real-user logs.
      logger.error(`Error initializing XMTP client (attempt ${attempt + 1}):`, {
        error: err,
        xmtpEnv: XMTP_ENV,
      });

      // Retry logic for retryable errors
      if (isRetryable && attempt < MAX_RETRIES) {
        const delay = calculateRetryDelay(attempt);
        if (isDev) {
          logger.debug(`useXmtpClient: Retrying initialization after ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Retry (don't set error state yet)
        return initializeClient(attempt + 1);
      }

      // No more retries or non-retryable error - set error state
      if (errorMessage.includes('wasm') || errorMessage.includes('WASM') || errorMessage.includes('fetch')) {
        if (isDev) {
          logger.error("WASM loading error detected. This may be due to Web Worker initialization issues.");
        }
        setError(new Error("Failed to load chat (WASM error). Please refresh the page and try again."));
      } else if (errorMessage.includes('timeout')) {
        setError(new Error(`Chat initialization timed out after ${attempt + 1} attempt(s). Please check your connection and try again.`));
      } else {
        setError(fullError);
      }
      
      setClient(null);
    } finally {
      setIsLoading(false);
      isInitializingRef.current = false;
    }
  }, [walletAddress, signMessage, accountClient, cleanupInit]);

  /**
   * Manual retry function exposed to consumers
   */
  const retry = useCallback(() => {
    if (isInitializingRef.current) {
      return; // Already initializing
    }
    cleanupInit();
    setError(null);
    setRetryCount(0);
    initializeClient(0);
  }, [initializeClient, cleanupInit]);

  // Initialize client when wallet address or signMessage changes
  useEffect(() => {
    // Cancel any pending initialization before starting a new one
    cleanupInit();
    initializeClient(0);
    
    // Cleanup on unmount or dependency change
    return () => {
      cleanupInit();
    };
  }, [initializeClient, cleanupInit]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupInit();
      // XMTP client cleanup is handled automatically
      setClient(null);
    };
  }, [cleanupInit]);

  return {
    client,
    isLoading,
    error,
    isConnected: !!client && !!walletAddress,
    retry,
  };
}

