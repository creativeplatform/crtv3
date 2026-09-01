// NOTE: This module is not currently used - Account Kit manages its own signer
// The useSigner() hook from @/lib/wallet/react should be used instead
// 
// The aggressive iframe cleanup that was here has been removed because it was
// breaking the signer connection. Account Kit's AlchemyAccountProvider manages
// the Turnkey iframe lifecycle automatically.

import { AlchemyWebSigner } from "@account-kit/signer";
import { logger } from "@/lib/utils/logger";

/**
 * Clean up DUPLICATE iframes only.
 *
 * IMPORTANT: This should NOT remove the active Turnkey iframe that Account Kit
 * uses for signing. It only cleans up duplicates that can occur during hot reload.
 *
 * Kept here (instead of importing from a React component file) so this module
 * remains framework-agnostic and avoids `"use client"` import chains.
 */
export function cleanupExistingIframes() {
  if (typeof window === "undefined") return;

  // Only clean up if there are MULTIPLE iframes (duplicates)
  // Don't remove the single active iframe!
  const container = document.getElementById("alchemy-signer-iframe-container");
  if (container) {
    const iframes = container.querySelectorAll("iframe");
    // Only clean up if there are more than 1 iframe (keep the first one)
    if (iframes.length > 1) {
      logger.debug(
        `[IframeCleanup] Found ${iframes.length} iframes, removing duplicates...`
      );
      // Keep the first iframe, remove the rest
      for (let i = 1; i < iframes.length; i++) {
        try {
          iframes[i].remove();
        } catch (error) {
          logger.warn("Failed to remove duplicate iframe:", error);
        }
      }
    }
  }

  // For orphaned iframes outside the container, check for duplicates
  const turnkeyIframes = document.querySelectorAll(
    'iframe[id*="turnkey"], iframe[src*="turnkey"]'
  );
  if (turnkeyIframes.length > 1) {
    logger.debug(
      `[IframeCleanup] Found ${turnkeyIframes.length} Turnkey iframes, removing duplicates...`
    );
    // Keep the first one, remove duplicates
    for (let i = 1; i < turnkeyIframes.length; i++) {
      try {
        turnkeyIframes[i].remove();
      } catch (error) {
        logger.warn("Failed to remove duplicate Turnkey iframe:", error);
      }
    }
  }
}

// Lazy signer creation - only create when needed and in browser
let signerInstance: AlchemyWebSigner | null = null;

function createSigner(): AlchemyWebSigner {
  // Only create signer in browser environment
  if (typeof window === "undefined") {
    throw new Error("Signer can only be created in browser environment");
  }

  // Check if iframe container exists
  const container = document.getElementById("alchemy-signer-iframe-container");
  if (!container) {
    throw new Error("Iframe container 'alchemy-signer-iframe-container' not found in DOM");
  }

  // Run cleanup before creating signer
  cleanupExistingIframes();

  try {
    const newSigner = new AlchemyWebSigner({
      client: {
        connection: {
          apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY as string,
        },
        iframeConfig: {
          iframeContainerId: "alchemy-signer-iframe-container",
        },
      },
    });
    
    signerInstance = newSigner;
    return newSigner;
  } catch (error) {
    logger.error("Failed to create AlchemyWebSigner:", error);
    // If signer creation fails, try cleanup and retry once
    cleanupExistingIframes();
    
    try {
      const retrySigner = new AlchemyWebSigner({
        client: {
          connection: {
            apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY as string,
          },
          iframeConfig: {
            iframeContainerId: "alchemy-signer-iframe-container",
          },
        },
      });
      
      signerInstance = retrySigner;
      return retrySigner;
    } catch (retryError) {
      logger.error("Failed to create AlchemyWebSigner after retry:", retryError);
      throw retryError;
    }
  }
}

// Get signer instance (lazy creation)
function getSigner(): AlchemyWebSigner {
  if (!signerInstance) {
    return createSigner();
  }
  return signerInstance;
}

// Export getter function instead of direct instance
export const signer = {
  get instance() {
    return getSigner();
  }
};
