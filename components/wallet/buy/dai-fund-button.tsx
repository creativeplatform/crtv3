import { Button } from "@/components/ui/button";
import { useSmartAccountClient } from "@/lib/wallet/react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { logger } from '@/lib/utils/logger';


interface DaiFundButtonProps {
  onSuccess?: () => void;
  presetAmount?: number;
  className?: string;
}

export function DaiFundButton({ onSuccess, presetAmount = 50, className }: DaiFundButtonProps) {
  const { address, client } = useSmartAccountClient({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fallback method to detect popup closure when COOP blocks window.closed access
   * Uses focus detection, window reference checking, and timeout as alternatives
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

    // Note: We can't reliably poll window.closed or window.location for cross-origin popups
    // due to COOP restrictions. We rely on focus detection and postMessage instead.

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

    // Set a maximum wait time (5 minutes) - cleanup after timeout
    maxWaitTimeoutId = setTimeout(() => {
      fullCleanup();
      // Don't call onSuccess automatically after timeout - user may have cancelled
    }, 5 * 60 * 1000);
  }

  async function handleFund() {
    if (!address || !client) return;

    setIsLoading(true);
    setError(null);
    try {
      // Fetch session token from your backend
      // Coinbase CDP session token API doesn't require wallet signatures
      // Note: DAI is not available on Base for onramp, so we request USDC/ETH and set DAI as default
      // Users can buy USDC/ETH and swap to DAI if needed
      const res = await fetch("/api/coinbase/session-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          address, 
          assets: ["USDC", "ETH"], // DAI not available on Base for onramp
        }),
      });
      
      // Parse response body once - can only be read once
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || `Failed to get session token: ${res.status}`);
      }
      
      const { sessionToken } = data;

      if (!sessionToken) {
        throw new Error("Failed to get session token");
      }

      // Generate the One-Click-Buy URL as per Coinbase documentation
      const urlParams = new URLSearchParams({
        sessionToken: sessionToken,
        presetFiatAmount: presetAmount.toString(),
        fiatCurrency: 'USD',
        defaultAsset: 'DAI',
      });
      
      const onrampBuyUrl = `https://pay.coinbase.com/buy?${urlParams.toString()}`;

      // Open in new tab
      const newWindow = window.open(onrampBuyUrl, "_blank");
      
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
              // Check if window is closed
              if (newWindow.closed) {
                invokeSuccess();
              }
            } catch (error) {
              // COOP policy blocked access to window.closed
              // Fall back to alternative detection methods
              logger.warn("Cannot access window.closed due to COOP policy, using alternative detection");
              cleanup();
              // Use focus-based detection as fallback
              fallbackActive = true;
              handlePopupCloseFallback(newWindow, cleanup, invokeSuccess);
            }
          }, 1000);
        } catch (error) {
          logger.warn("Cannot set up window.closed check due to COOP policy, using alternative detection");
          // Use focus-based detection as fallback
          fallbackActive = true;
          handlePopupCloseFallback(newWindow, cleanup, invokeSuccess);
        }
        
        // Method 2: Listen for postMessage events (if Coinbase sends them)
        // Only set up if fallback is not already active to avoid duplicate detection
        if (!fallbackActive) {
          messageListener = (event: MessageEvent) => {
            // Verify origin for security
            if (event.origin === "https://pay.coinbase.com" || 
                event.origin === window.location.origin) {
              // Handle any messages from Coinbase (if they send completion messages)
              if (event.data === "payment-complete" || 
                  event.data === "popup-closed" ||
                  event.data === "payment-success") {
                invokeSuccess();
              }
            }
          };
          window.addEventListener("message", messageListener);
        }
      }
    } catch (error) {
      logger.error('Failed to fund DAI:', error);
      setError(error instanceof Error ? error.message : 'Failed to fund DAI');
    } finally {
      // Set loading to false after all operations complete (or fail)
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button 
        onClick={handleFund} 
        disabled={isLoading}
        className={className}
      >
        {isLoading ? "Loading..." : `Buy DAI ($${presetAmount})`}
      </Button>
    </div>
  );
}

export default DaiFundButton;
