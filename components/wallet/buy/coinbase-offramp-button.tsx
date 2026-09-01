"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useSmartAccountClient, useUser } from "@/lib/wallet/react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { logger } from '@/lib/utils/logger';


/**
 * CoinbaseOfframpButton Component
 * 
 * Coinbase CDP Offramp integration for selling crypto (USDC, ETH, DAI) to fiat.
 * Supports selling on Base network.
 * 
 * Required Environment Variables:
 * - COINBASE_CDP_API_KEY_ID
 * - COINBASE_CDP_API_KEY_SECRET
 */

interface CoinbaseOfframpButtonProps {
  onSuccess?: () => void;
  presetAmount?: number; // Optional preset crypto amount
  defaultAsset?: "USDC" | "ETH" | "DAI"; // Optional default asset to sell
  className?: string;
}

function CoinbaseOfframpButton({
  onSuccess,
  presetAmount,
  defaultAsset,
  className,
}: CoinbaseOfframpButtonProps) {
  const { address } = useSmartAccountClient({});
  const user = useUser();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /**
   * Fallback method to detect popup closure when COOP blocks window.closed access
   */
  function handlePopupCloseFallback(
    popupWindow: Window,
    baseCleanup: () => void,
    onSuccess?: () => void
  ) {
    let focusTimeoutId: NodeJS.Timeout | null = null;
    let maxWaitTimeoutId: NodeJS.Timeout | null = null;
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

    const handleFocus = () => {
      if (!wasFocused) {
        wasFocused = true;
        focusTimeoutId = setTimeout(() => {
          try {
            popupWindow.focus();
            wasFocused = false;
          } catch (error) {
            triggerSuccess();
          }
        }, 1000);
      }
    };

    window.addEventListener("focus", handleFocus);

    maxWaitTimeoutId = setTimeout(() => {
      fullCleanup();
    }, 5 * 60 * 1000);
  }

  async function handleSell() {
    setError(null);
    setLoading(true);

    if (!address) {
      setError("No wallet address found");
      setLoading(false);
      return;
    }

    // Generate a unique partner user ID (can use user ID, address, or generate one)
    const partnerUserId = user?.address || address.slice(0, 20);

    try {
      // Fetch session token from backend
      const res = await fetch("/api/coinbase/session-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          assets: ["USDC", "ETH", "DAI"], // Support all three assets
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

      // Generate the Offramp URL
      const urlParams = new URLSearchParams({
        sessionToken: data.sessionToken,
        partnerUserId: partnerUserId,
        redirectUrl: window.location.origin + window.location.pathname, // Redirect back to current page
        defaultNetwork: "base",
      });

      // Add default asset if specified
      if (defaultAsset) {
        urlParams.append("defaultAsset", defaultAsset);
      }

      // Add preset amount if specified
      if (presetAmount) {
        urlParams.append("presetCryptoAmount", presetAmount.toString());
      }

      const offrampUrl = `https://pay.coinbase.com/v3/sell/input?${urlParams.toString()}`;

      // Open in new tab/popup
      const newWindow = window.open(offrampUrl, "_blank");

      // Listen for the window to close (user completed or cancelled)
      if (newWindow) {
        let checkClosedIntervalId: NodeJS.Timeout | null = null;
        let messageListener: ((event: MessageEvent) => void) | null = null;
        let fallbackActive = false; // Track if fallback detection is active
        let successCallbackInvoked = false; // Guard against duplicate onSuccess calls

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

        // Safe success callback wrapper - ensures onSuccess is only called once
        const invokeSuccess = () => {
          if (!successCallbackInvoked) {
            successCallbackInvoked = true;
            cleanup();
            setTimeout(() => {
              onSuccess?.();
            }, 2000);
          }
        };

        // Method 1: Try to use window.closed (may be blocked by COOP)
        try {
          checkClosedIntervalId = setInterval(() => {
            try {
              if (newWindow.closed) {
                invokeSuccess();
              }
            } catch (error) {
              logger.warn(
                "Cannot access window.closed due to COOP policy, using alternative detection"
              );
              cleanup();
              fallbackActive = true;
              handlePopupCloseFallback(newWindow, cleanup, invokeSuccess);
            }
          }, 1000);
        } catch (error) {
          logger.warn(
            "Cannot set up window.closed check due to COOP policy, using alternative detection"
          );
          fallbackActive = true;
          handlePopupCloseFallback(newWindow, cleanup, invokeSuccess);
        }

        // Method 2: Listen for postMessage events
        // Only set up if fallback is not already active to avoid duplicate detection
        if (!fallbackActive) {
          messageListener = (event: MessageEvent) => {
            if (
              event.origin === "https://pay.coinbase.com" ||
              event.origin === window.location.origin
            ) {
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
      logger.error("Failed to start Coinbase offramp:", err);
      setError("Failed to start Coinbase offramp. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        onClick={handleSell}
        disabled={loading}
        variant="outline"
        className={className}
      >
        {loading ? "Loading..." : "Sell Crypto"}
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

export default CoinbaseOfframpButton;

