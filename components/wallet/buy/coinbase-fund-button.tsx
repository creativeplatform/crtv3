"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useSmartAccountClient } from "@/lib/wallet/react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { logger } from '@/lib/utils/logger';


/**
 * CoinbaseFundButton Component
 * 
 * Replaces WertFundButton with Coinbase CDP Onramp integration.
 * Supports USDC and ETH on Base network.
 * Note: DAI is not available on Base for onramp (only on Ethereum, Avalanche C-Chain, Optimism, Arbitrum)
 * 
 * Required Environment Variables:
 * - COINBASE_CDP_API_KEY_ID
 * - COINBASE_CDP_API_KEY_SECRET
 */

interface CoinbaseFundButtonProps {
  onClose?: () => void;
  presetAmount?: number; // Optional preset fiat amount in USD
  defaultAsset?: "USDC" | "ETH"; // Optional default asset (DAI not available on Base for onramp)
  className?: string;
}

function CoinbaseFundButton({
  onClose,
  presetAmount = 10,
  defaultAsset,
  className,
}: CoinbaseFundButtonProps) {
  const { address } = useSmartAccountClient({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /**
   * Fallback method to detect popup closure when COOP blocks window.closed access
   * Uses focus detection, window reference checking, and timeout as alternatives
   */
  function handlePopupCloseFallback(
    popupWindow: Window,
    baseCleanup: () => void,
    onSuccess?: () => void
  ) {
    let focusTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let maxWaitTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let wasFocused = false;

    const fullCleanup = () => {
      baseCleanup();
      if (focusTimeoutId) {
        clearTimeout(focusTimeoutId);
        focusTimeoutId = null;
      }
      if (maxWaitTimeoutId) {
        clearTimeout(maxWaitTimeoutId);
        maxWaitTimeoutId = null;
      }
      window.removeEventListener("focus", handleFocus);
    };

    const triggerSuccess = () => {
      fullCleanup();
      setTimeout(() => {
        onSuccess?.();
      }, 2000);
    };

    // Track when main window regains focus (indicates popup may have closed)
    const handleFocus = () => {
      if (!wasFocused) {
        wasFocused = true;
        // Wait a bit to see if popup is still open
        focusTimeoutId = setTimeout(() => {
          try {
            // Try to access popup - if it throws, it's likely closed
            popupWindow.focus();
            // If we can focus it, it's still open, reset the flag
            wasFocused = false;
          } catch (error) {
            // Popup is likely closed or inaccessible
            triggerSuccess();
          }
        }, 1000);
      }
    };

    window.addEventListener("focus", handleFocus);

    // Set a maximum wait time (5 minutes) - cleanup and reset state after timeout
    // This ensures loading state is reset even if popup closure wasn't detected
    maxWaitTimeoutId = setTimeout(() => {
      triggerSuccess();
    }, 5 * 60 * 1000);
  }

  async function handleDeposit() {
    setError(null);
    setLoading(true);

    if (!address) {
      setError("No wallet address found");
      setLoading(false);
      return;
    }

    try {
      // Fetch session token from backend
      const res = await fetch("/api/coinbase/session-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          assets: ["USDC", "ETH"], // USDC and ETH only - DAI not available on Base for onramp
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create Coinbase session");
        setLoading(false);
        return;
      }

      if (!data.sessionToken) {
        setError("Failed to get session token");
        setLoading(false);
        return;
      }

      // Generate the Onramp URL
      const urlParams = new URLSearchParams({
        sessionToken: data.sessionToken,
        defaultNetwork: "base",
        presetFiatAmount: presetAmount.toString(),
        fiatCurrency: "USD",
      });

      // Add default asset if specified
      if (defaultAsset) {
        urlParams.append("defaultAsset", defaultAsset);
      }

      const onrampBuyUrl = `https://pay.coinbase.com/buy?${urlParams.toString()}`;

      // Open in new tab/popup
      const newWindow = window.open(onrampBuyUrl, "_blank");

      // If popup was blocked, reset loading state
      if (!newWindow) {
        setError("Popup was blocked. Please allow popups for this site and try again.");
        setLoading(false);
        return;
      }

      // Listen for the window to close (user completed or cancelled)
      // Note: Loading state remains true until popup closes (handled in invokeSuccess)
      if (newWindow) {
        let checkClosedIntervalId: ReturnType<typeof setInterval> | null = null;
        let messageListener: ((event: MessageEvent) => void) | null = null;
        let fallbackActive = false; // Track if fallback detection is active
        let successCallbackInvoked = false; // Guard against duplicate onClose calls

        // Cleanup function
        const cleanup = () => {
          if (checkClosedIntervalId) {
            clearInterval(checkClosedIntervalId);
            checkClosedIntervalId = null;
          }
          if (messageListener) {
            window.removeEventListener("message", messageListener);
            messageListener = null;
          }
        };

        // Safe success callback wrapper - ensures onClose is only called once
        const invokeSuccess = () => {
          if (!successCallbackInvoked) {
            successCallbackInvoked = true;
            cleanup();
            setLoading(false); // Set loading to false when popup closes
            setTimeout(() => {
              onClose?.();
            }, 2000);
          }
        };

        // Method 1: Try to use window.closed (may be blocked by COOP)
        try {
          checkClosedIntervalId = setInterval(() => {
            try {
              // Check if window is closed
              if (newWindow.closed) {
                invokeSuccess();
              }
            } catch (error) {
              // COOP policy blocked access to window.closed
              // Fall back to alternative detection methods
              // Clear the interval immediately to prevent repeated errors
              if (checkClosedIntervalId) {
                clearInterval(checkClosedIntervalId);
                checkClosedIntervalId = null;
              }
              
              // Only set up fallback if not already active to prevent duplicate handlers
              if (!fallbackActive) {
                logger.warn(
                  "Cannot access window.closed due to COOP policy, using alternative detection"
                );
                fallbackActive = true;
                handlePopupCloseFallback(newWindow, cleanup, invokeSuccess);
              }
            }
          }, 1000);
        } catch (error) {
          logger.warn(
            "Cannot set up window.closed check due to COOP policy, using alternative detection"
          );
          // Use focus-based detection as fallback
          if (!fallbackActive) {
            fallbackActive = true;
            handlePopupCloseFallback(newWindow, cleanup, invokeSuccess);
          }
        }

        // Method 2: Listen for postMessage events (if Coinbase sends them)
        // Only set up if fallback is not already active to avoid duplicate detection
        if (!fallbackActive) {
          messageListener = (event: MessageEvent) => {
            // Verify origin for security
            if (
              event.origin === "https://pay.coinbase.com" ||
              event.origin === window.location.origin
            ) {
              // Handle any messages from Coinbase (if they send completion messages)
              if (
                event.data === "payment-complete" ||
                event.data === "popup-closed" ||
                event.data === "payment-success"
              ) {
                invokeSuccess();
              }
            }
          };
          window.addEventListener("message", messageListener);
        }
      }
    } catch (err) {
      logger.error("Failed to start Coinbase onramp:", err);
      setError("Failed to start Coinbase onramp. Please try again.");
      setLoading(false); // Set loading to false on error
    }
    // Note: Don't set loading to false in finally block - it should remain true
    // until the popup closes (handled in invokeSuccess callback)
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        onClick={handleDeposit}
        disabled={loading}
        className={className || "w-full mb-4"}
      >
        {loading ? "Loading..." : "Deposit Funds"}
      </Button>
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export default CoinbaseFundButton;

