"use client";

import { useState, useEffect } from "react";
import { useSmartAccountClient } from "@/lib/wallet/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, InfoIcon, XCircle, CheckCircle, ExternalLink, FuelIcon } from "lucide-react";
import { CrossChainSwap } from "./CrossChainSwap";
import { HallidayOnramp } from "@/components/songchain/HallidayOnramp";
import {
  buildHallidayInputAssets,
  buildHallidayStoryOutputAsset,
  isHallidaySandboxEnabled,
} from "@/lib/songchain/halliday";
import { createStoryPublicClient } from "@/lib/sdk/story/client";
import { getNFTContractAddress, mintVideoNFT } from "@/lib/sdk/nft/minting-service";
import { formatEther, type Address } from "viem";
import { STORY_CHAIN_ID } from "@/lib/sdk/story/constants";
import { logger } from '@/lib/utils/logger';


export interface NFTMintingStepProps {
  videoAssetId: number;
  metadataURI: string;
  recipientAddress?: Address;
  onMintSuccess: (result: {
    tokenId: string;
    contractAddress: Address;
    txHash: string;
  }) => void;
  onSkip?: () => void;
}

export function NFTMintingStep({
  videoAssetId,
  metadataURI,
  recipientAddress,
  onMintSuccess,
  onSkip,
}: NFTMintingStepProps) {
  const { client } = useSmartAccountClient({});
  const [isMinting, setIsMinting] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);
  const [mintSuccess, setMintSuccess] = useState<{
    tokenId: string;
    collectionAddress: string;
    txHash: string;
    ipId?: string;
  } | null>(null);
  const [nftContractAddress, setNftContractAddress] = useState<Address | null>(null);

  // Funding wallet state
  const [fundingWalletAddress, setFundingWalletAddress] = useState<string | null>(null);
  const [fundingWalletBalance, setFundingWalletBalance] = useState<string | null>(null);
  const [isCheckingFunding, setIsCheckingFunding] = useState(false);

  // Get current Story Network from env
  const network = process.env.NEXT_PUBLIC_STORY_NETWORK || "testnet";
  const isMainnet = network === "mainnet";
  const storyScanBaseUrl = isMainnet
    ? "https://www.storyscan.io"
    : "https://aeneid.storyscan.io";

  // When Alchemy Story Gas policy is set, gas is sponsored — don't gate on funding wallet balance
  const hasStoryPolicy = Boolean(
    (process.env.NEXT_PUBLIC_STORY_POLICY_ID ?? "").replace(/^["']|["']$/g, "").trim()
  );

  const hallidayApiKey = process.env.NEXT_PUBLIC_HALLIDAY_API_KEY?.trim() || null;
  const hallidayOutputAsset = buildHallidayStoryOutputAsset();
  const hallidayInputAssets = buildHallidayInputAssets();
  const hallidaySandbox = isHallidaySandboxEnabled();

  useEffect(() => {
    const address = getNFTContractAddress();
    setNftContractAddress(address);
    if (!hasStoryPolicy) checkFundingWallet();
  }, [hasStoryPolicy]);

  const checkFundingWallet = async (retryCount = 0) => {
    setIsCheckingFunding(true);
    try {
      // 1. Get the funding wallet address from our API
      const response = await fetch("/api/story/funding-wallet");
      if (!response.ok) {
        throw new Error("Failed to fetch funding wallet address");
      }
      const data = await response.json();

      if (data.success && data.address) {
        setFundingWalletAddress(data.address);

        // 2. Check its balance on Story Protocol
        const publicClient = createStoryPublicClient();
        const balance = await publicClient.getBalance({
          address: data.address as Address,
        });

        const formattedBalance = formatEther(balance);
        setFundingWalletBalance(formattedBalance);

        logger.debug("✅ Funding Wallet Status:", {
          address: data.address,
          balance: formattedBalance
        });
      }
    } catch (error) {
      logger.error("Error checking funding wallet:", error);
      // Retry logic
      if (retryCount < 2) {
        setTimeout(() => checkFundingWallet(retryCount + 1), 2000);
      }
    } finally {
      setIsCheckingFunding(false);
    }
  };

  const handleMint = async () => {
    if (!client || !client.account) return;

    setIsMinting(true);
    setMintError(null);

    try {
      if (nftContractAddress) {
        // Existing logic for base chain minting...
        const result = await mintVideoNFT(
          client,
          nftContractAddress,
          recipientAddress || client.account.address,
          metadataURI
        );

        onMintSuccess(result);
      } else {
        // Story Protocol Minting
        // Generate default collection details
        const collectionName = "My Creative Videos";
        const collectionSymbol = "CRTV";

        // Call the server action which uses STORY_PROTOCOL_PRIVATE_KEY
        const response = await fetch("/api/story/mint", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            creatorAddress: client.account.address,
            recipient: recipientAddress || client.account.address,
            metadataURI,
            collectionName,
            collectionSymbol,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to mint on Story Protocol");
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Minting failed");
        }

        // Clear any previous errors
        setMintError(null);

        // Show success state
        setMintSuccess({
          tokenId: result.tokenId,
          collectionAddress: result.collectionAddress,
          txHash: result.txHash,
          ipId: result.ipId,
        });

        // Callback
        onMintSuccess({
          tokenId: result.tokenId,
          contractAddress: result.collectionAddress,
          txHash: result.txHash
        });
      }
    } catch (e) {
      logger.error("Minting failed:", e);
      const errorMessage = e instanceof Error ? e.message : "Minting failed";
      setMintError(errorMessage);
    } finally {
      setIsMinting(false);
    }
  };

  // When policy is set, treat as sponsored (no balance required). Otherwise require >= 0.5 IP.
  const hasFundingFunds = hasStoryPolicy
    ? true
    : (fundingWalletBalance ? parseFloat(fundingWalletBalance) >= 0.5 : false);

  const expectedChainId = network === "mainnet" ? 1514 : 1315;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {nftContractAddress ? "Mint NFT for Your Video" : "Mint & Register on Story Protocol"}
        </CardTitle>
        <CardDescription>
          {nftContractAddress
            ? "Mint an NFT for your video to enable Story Protocol IP registration"
            : "Create a new NFT collection and register your video as an IP Asset"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Gas status: when policy set show "Gas sponsored"; otherwise show funding wallet balance */}
        {hasStoryPolicy ? (
          <div className="flex items-center justify-between text-sm p-3 rounded-md border bg-green-50 border-green-200 dark:bg-green-950/50 dark:border-green-800">
            <div className="flex items-center gap-2">
              <FuelIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
              <div className="flex flex-col">
                <span className="font-medium text-foreground">Story Protocol Gas</span>
                <span className="text-xs text-muted-foreground">Gas sponsored by Alchemy</span>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className={`flex items-center justify-between text-sm p-3 rounded-md border ${hasFundingFunds
              ? "bg-green-50 border-green-200 dark:bg-green-950/50 dark:border-green-800"
              : "bg-amber-50 border-amber-200 dark:bg-amber-950/50 dark:border-amber-800"
            }`}>
              <div className="flex items-center gap-2">
                <FuelIcon className={`h-4 w-4 ${hasFundingFunds ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`} />
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">
                    Story Protocol Gas Status
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Network: {network}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`font-mono text-sm ${hasFundingFunds ? "text-green-700 dark:text-green-200 font-medium" : "text-amber-700 dark:text-amber-200 font-medium"}`}>
                  {fundingWalletBalance ? `${parseFloat(fundingWalletBalance).toFixed(4)} IP` : "Loading..."}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => checkFundingWallet()}
                  disabled={isCheckingFunding}
                >
                  <Loader2 className={`h-3 w-3 ${isCheckingFunding ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>

            {/* Swap Component if system funds are low */}
            {!hasFundingFunds && fundingWalletAddress && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-3">
            <Alert className="bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-100">
              <InfoIcon className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <AlertDescription className="text-amber-800 dark:text-amber-100">
                The system gas wallet is low on IP tokens. You can help by swapping some ETH to IP.
                The funds will be sent directly to the gas wallet to pay for your minting transaction.
              </AlertDescription>
            </Alert>

            <CrossChainSwap
              recipientAddress={fundingWalletAddress}
              onSwapSuccess={() => {
                logger.debug("🔄 Swap completed, checking funding balance in 3 seconds...");
                setTimeout(() => {
                  checkFundingWallet(0);
                }, 3000);
              }}
            />

            {hallidayApiKey && (
              <HallidayOnramp
                variant="story"
                hallidayApiKey={hallidayApiKey}
                hallidayOutputAsset={hallidayOutputAsset}
                hallidayInputAssets={hallidayInputAssets}
                hallidaySandbox={hallidaySandbox}
                destinationAddressOverride={fundingWalletAddress}
                lazyInit
              />
            )}
          </div>
            )}
          </>
        )}

        {/* Info Alert */}
        <Alert>
          <InfoIcon className="h-4 w-4" />
          <AlertDescription>
            {nftContractAddress
              ? "Minting an NFT will create a unique token for your video."
              : hasStoryPolicy
                ? "Gas is sponsored. This action will register your video as an IP Asset on Story Protocol."
                : "We handle the gas fees! This action will register your video as an IP Asset on Story Protocol using our sponsored gas wallet."}
          </AlertDescription>
        </Alert>

        {mintSuccess && (
          <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="space-y-2">
              <div className="font-semibold text-green-800 dark:text-green-200">
                ✅ Successfully minted and registered on Story Protocol!
              </div>
              <div className="text-sm space-y-1 text-green-700 dark:text-green-300">
                <div>
                  <strong>Token ID:</strong> {mintSuccess.tokenId}
                </div>
                {mintSuccess.ipId && (
                  <div>
                    <strong>IP ID:</strong> {mintSuccess.ipId}
                  </div>
                )}
                <div>
                  <strong>Collection:</strong>{" "}
                  <span className="font-mono text-xs">
                    {mintSuccess.collectionAddress.slice(0, 6)}...{mintSuccess.collectionAddress.slice(-4)}
                  </span>
                </div>
                <div className="pt-2 space-y-1">
                  <a
                    href={`${storyScanBaseUrl}/tx/${mintSuccess.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 hover:underline font-medium"
                  >
                    View transaction on StoryScan <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {mintError && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{mintError}</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-3">
          <Button
            onClick={handleMint}
            disabled={isMinting || !hasFundingFunds || !!mintSuccess}
            className="flex-1"
          >
            {isMinting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {nftContractAddress ? "Minting..." : "Minting & Registering..."}
              </>
            ) : mintSuccess ? (
              "✅ Minted Successfully"
            ) : (
              nftContractAddress ? "Mint NFT" : "Mint & Register IP"
            )}
          </Button>
          {onSkip && (
            <Button
              variant="outline"
              onClick={onSkip}
              disabled={isMinting || !!mintSuccess}
            >
              Skip for Now
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
