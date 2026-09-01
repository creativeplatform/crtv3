"use client";

import { useEffect, useState } from "react";
import { useSmartAccountClient } from "@/lib/wallet/react";
import { getOnrampBuyUrl } from "@coinbase/onchainkit/fund";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { logger } from "@/lib/utils/logger";

interface EmbeddedCdpOnrampProps {
  presetFiatAmount?: number;
  fiatCurrency?: string;
  defaultAsset?: "USDC" | "ETH";
  onSuccess?: () => void;
}

export function EmbeddedCdpOnramp({
  presetFiatAmount = 10,
  fiatCurrency = "USD",
  defaultAsset,
  onSuccess,
}: EmbeddedCdpOnrampProps) {
  const { address } = useSmartAccountClient({});
  const [buyUrl, setBuyUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setLoading(false);
      setError("No wallet address found");
      return;
    }

    let cancelled = false;

    async function init() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/coinbase/session-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address,
            assets: ["USDC", "ETH"], // DAI is not available on Base for onramp
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to create Coinbase session");
        }
        if (!data.sessionToken) {
          throw new Error("Failed to get session token");
        }

        const params: Record<string, string> = {
          sessionToken: data.sessionToken,
          defaultNetwork: "base",
          presetFiatAmount: presetFiatAmount.toString(),
          fiatCurrency,
        };
        if (defaultAsset) {
          params.defaultAsset = defaultAsset;
        }

        const url = getOnrampBuyUrl({
          sessionToken: data.sessionToken,
          defaultNetwork: "base",
          presetFiatAmount,
          fiatCurrency,
          defaultAsset,
        });

        if (!cancelled) {
          setBuyUrl(url);
        }
      } catch (err) {
        logger.error("Failed to load embedded Coinbase onramp:", err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load onramp");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void init();

    // Listen for Coinbase Onramp postMessage events
    function handleMessage(event: MessageEvent) {
      const trustedOrigins = ["https://pay.coinbase.com"];
      if (!trustedOrigins.includes(event.origin)) return;

      let data = event.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }

      if (
        data?.event === "onramp_purchase_success" ||
        data?.event === "onramp_purchase_complete" ||
        data?.type === "success"
      ) {
        onSuccess?.();
      }
    }

    window.addEventListener("message", handleMessage);

    return () => {
      cancelled = true;
      window.removeEventListener("message", handleMessage);
    };
  }, [address, presetFiatAmount, fiatCurrency, defaultAsset, onSuccess]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!buyUrl) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Unable to load the onramp.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="w-full">
      <div className="relative w-full overflow-hidden rounded-lg border bg-background">
        <iframe
          src={buyUrl}
          title="Coinbase Onramp"
          className="w-full min-h-[500px] border-0"
          allow="payment"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation"
        />
      </div>
    </div>
  );
}
