import { Button } from "@/components/ui/button";
import { getOnrampBuyUrl } from "@coinbase/onchainkit/fund";
import { useSmartAccountClient } from "@/lib/wallet/react";
import { useState } from "react";
import { logger } from '@/lib/utils/logger';


function CdpFundButton() {
  const { address } = useSmartAccountClient({});
  const [isLoading, setIsLoading] = useState(false);

  async function handleFund() {
    if (!address) return;

    setIsLoading(true);
    try {
      // Fetch session token from your backend
      const res = await fetch("/api/coinbase/session-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, assets: ["USDC", "ETH"] }), // DAI not available on Base for onramp
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

      // Generate the Onramp URL with the sessionToken
      const onrampBuyUrl = getOnrampBuyUrl({
        sessionToken,
        presetFiatAmount: 30,
        fiatCurrency: "USD",
        redirectUrl: "https://tv.creativeplatform.xyz",
      });

      window.open(onrampBuyUrl, "_blank");
    } catch (error) {
      logger.error("Failed to fund:", error);
      alert(error instanceof Error ? error.message : "Failed to get session token");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Button onClick={handleFund} disabled={isLoading}>
      {isLoading ? "Loading..." : "Fund"}
    </Button>
  );
}

export default CdpFundButton;
