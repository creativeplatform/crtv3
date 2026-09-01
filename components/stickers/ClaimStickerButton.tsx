"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { type Address, type Hex, encodeFunctionData } from "viem";
import {
  CAMPAIGN_STICKERS_ADDRESS,
  campaignStickersAbi,
} from "@/lib/contracts/CampaignStickers";
import { useSmartAccountClient, useSigner } from "@/lib/wallet/react";
import { useGasSponsorship } from "@/lib/hooks/wallet/useGasSponsorship";
import { useWalletStatus } from "@/lib/hooks/accountkit/useWalletStatus";
import { useWalletAuth } from "@/lib/auth/useWalletAuth";
import { buildStickerClaimAuthMessage } from "@/lib/stickers/claimAuthMessage";
import { appendBuilderCode } from "@/lib/utils/builder-code";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/utils/logger";

type VerifyResponse = {
  eligible: boolean;
  tokenId?: number;
  signature?: Hex;
  ipfsHash?: string;
  name?: string | null;
  imageUri?: string | null;
  vote?: { id: string; choice: number | string; vp: number; created: number };
  error?: string;
};

type PreviewResponse = {
  tokenId: number;
  name: string | null;
  imageUri: string | null;
  ipfsHash?: string;
  proposalId?: string;
  error?: string;
};

type ClaimStickerButtonProps = {
  proposalId: string;
};

type UiState =
  | "loading"
  | "no_sticker"
  | "not_voted"
  | "eligible"
  | "claiming"
  | "claimed"
  | "error";

const PLACEHOLDER_HEADER =
  "https://snapshotsplugin.s3.us-west-2.amazonaws.com/empty.svg";
const VOTE_HEADER =
  "https://snapshotsplugin.s3.us-west-2.amazonaws.com/vote.svg";
const CLAIM_HEADER =
  "https://snapshotsplugin.s3.us-west-2.amazonaws.com/claim.svg";
const SUCCESS_HEADER =
  "https://snapshotsplugin.s3.us-west-2.amazonaws.com/succes.svg";
const PLACEHOLDER_ART =
  "https://snapshotsplugin.s3.us-west-2.amazonaws.com/placeholder.png";

function toDisplayImage(uri: string | null | undefined): string {
  if (!uri) return PLACEHOLDER_ART;
  return uri.replace("ipfs://", "https://ipfs.io/ipfs/");
}

function headerForState(state: UiState): { image: string; text: string } {
  switch (state) {
    case "no_sticker":
      return {
        image: PLACEHOLDER_HEADER,
        text: "A campaign sticker hasn't been set up for this proposal yet",
      };
    case "not_voted":
      return {
        image: VOTE_HEADER,
        text: "Vote to unlock this sticker",
      };
    case "eligible":
      return {
        image: CLAIM_HEADER,
        text: "Claim your campaign sticker",
      };
    case "claiming":
      return {
        image: SUCCESS_HEADER,
        text: "Minting your sticker…",
      };
    case "claimed":
      return {
        image: SUCCESS_HEADER,
        text: "Sticker minted to your smart wallet",
      };
    case "error":
      return {
        image: PLACEHOLDER_HEADER,
        text: "Something went wrong checking this sticker",
      };
    default:
      return {
        image: PLACEHOLDER_HEADER,
        text: "Loading sticker…",
      };
  }
}

export function ClaimStickerButton({ proposalId }: ClaimStickerButtonProps) {
  const { client, address: smartAddress } = useSmartAccountClient({});
  const { walletAddress } = useWalletStatus();
  const signer = useSigner();
  const { getAuthHeaders } = useWalletAuth();
  const { getGasContext } = useGasSponsorship();

  const [uiState, setUiState] = useState<UiState>("loading");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [verify, setVerify] = useState<VerifyResponse | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const name = verify?.name ?? preview?.name ?? null;
  const imageUri = verify?.imageUri ?? preview?.imageUri ?? null;

  const loadPreview = useCallback(async () => {
    if (!proposalId) return;
    try {
      const res = await fetch(
        `/api/stickers/by-proposal/${encodeURIComponent(proposalId)}`
      );
      if (res.status === 404) {
        setPreview(null);
        setUiState("no_sticker");
        return;
      }
      if (!res.ok) {
        setUiState("error");
        setMessage("Could not load sticker preview.");
        return;
      }
      const data = (await res.json()) as PreviewResponse;
      setPreview(data);
      // Default until eligibility check finishes (or wallet connects).
      setUiState((prev) =>
        prev === "eligible" || prev === "claimed" || prev === "claiming"
          ? prev
          : "not_voted"
      );
    } catch (err) {
      logger.error("sticker preview failed:", err);
      setUiState("error");
      setMessage("Could not load sticker preview.");
    }
  }, [proposalId]);

  const checkEligibility = useCallback(async () => {
    if (!smartAddress || !walletAddress || !proposalId) return;

    setMessage(null);
    try {
      if (!signer) {
        setUiState("error");
        setMessage("EOA signer not ready. Please reconnect.");
        return;
      }

      const authHeaders = await getAuthHeaders();
      const voterTimestamp = Math.floor(Date.now() / 1000);
      const voterMessage = buildStickerClaimAuthMessage({
        voter: walletAddress,
        claimer: smartAddress,
        proposalId,
        timestamp: voterTimestamp,
      });
      const voterSignature = await signer.signMessage({
        message: voterMessage,
      });

      const res = await fetch("/api/stickers/verify-vote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({
          proposalId,
          voterEOA: walletAddress,
          claimerAddress: smartAddress,
          voterAuth: {
            address: walletAddress,
            timestamp: voterTimestamp,
            signature: voterSignature,
          },
        }),
      });
      const data = (await res.json()) as VerifyResponse;
      setVerify(data);

      if (!res.ok && res.status === 404) {
        setUiState("no_sticker");
        setMessage("No campaign sticker for this proposal yet.");
        return;
      }
      if (!res.ok && res.status === 401) {
        setUiState("error");
        setMessage(data.error || "Wallet auth failed.");
        return;
      }
      if (data.eligible && data.signature) {
        setUiState("eligible");
        setMessage(
          data.vote
            ? `Voted with ${data.vote.vp} VP — claim your sticker!`
            : "You're eligible to claim."
        );
      } else {
        setUiState("not_voted");
        setMessage("Vote on this proposal to unlock the sticker claim.");
      }
    } catch (err) {
      logger.error("eligibility check failed:", err);
      setUiState("error");
      setMessage("Could not verify vote eligibility.");
    }
  }, [smartAddress, walletAddress, proposalId, signer, getAuthHeaders]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  // Only prompt for claim auth after we know a sticker exists for this proposal.
  useEffect(() => {
    if (!smartAddress || !walletAddress) return;
    if (!preview?.tokenId) return;
    void checkEligibility();
  }, [smartAddress, walletAddress, proposalId, preview?.tokenId, checkEligibility]);

  const claim = useCallback(async () => {
    if (
      !client ||
      !smartAddress ||
      !verify?.signature ||
      verify.tokenId === undefined
    ) {
      toast.error("Connect your wallet and verify eligibility first.");
      return;
    }
    if (
      !CAMPAIGN_STICKERS_ADDRESS ||
      CAMPAIGN_STICKERS_ADDRESS ===
        "0x0000000000000000000000000000000000000000"
    ) {
      toast.error("Sticker contract not configured.");
      return;
    }

    setUiState("claiming");
    try {
      const data = appendBuilderCode(
        encodeFunctionData({
          abi: campaignStickersAbi,
          functionName: "claim",
          args: [BigInt(verify.tokenId), verify.signature],
        })
      );

      const gasContext = getGasContext("sponsored");
      const operation = await client.sendUserOperation({
        uo: {
          target: CAMPAIGN_STICKERS_ADDRESS,
          data: data as Hex,
          value: 0n,
        },
        context: gasContext.context,
      });

      const txHash = await client.waitForUserOperationTransaction({
        hash: operation.hash,
      });

      const authHeaders = await getAuthHeaders();
      const recordRes = await fetch("/api/stickers/record-claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({
          tokenId: verify.tokenId,
          wallet: smartAddress as Address,
          txHash,
          vp: verify.vote?.vp,
          choice: verify.vote?.choice,
        }),
      });
      const recordJson = await recordRes.json().catch(() => ({}));
      if (!recordRes.ok) {
        const recordError =
          typeof recordJson.error === "string"
            ? recordJson.error
            : "Failed to sync claim to inventory";
        logger.error("record-claim failed after on-chain mint:", recordJson);
        setUiState("claimed");
        toast.warning(
          `Sticker minted on-chain, but inventory sync failed: ${recordError}`
        );
        setMessage(
          "Minted to your smart wallet; inventory sync pending. Try Recheck later."
        );
        return;
      }

      setUiState("claimed");
      toast.success("Sticker claimed!");
      setMessage("Sticker minted to your smart wallet.");
    } catch (err) {
      logger.error("claim failed:", err);
      setUiState("eligible");
      const msg = err instanceof Error ? err.message : "Claim failed";
      toast.error(msg);
      setMessage(msg);
    }
  }, [client, smartAddress, verify, getGasContext, getAuthHeaders]);

  if (uiState === "no_sticker") {
    return null;
  }

  const header = headerForState(uiState);
  const artSrc = toDisplayImage(imageUri);
  const showClaim =
    uiState === "eligible" || uiState === "claiming" || uiState === "claimed";

  return (
    <div className="rounded-lg border p-6 mb-6">
      <h2 className="text-lg font-bold mb-4 text-center">
        Claim Campaign Sticker
      </h2>
      <div className="flex flex-col items-center justify-center text-center space-y-3">
        <Image
          src={header.image}
          alt=""
          width={125}
          height={125}
          unoptimized
        />
        <p className="mb-1 font-semibold max-w-xs">{header.text}</p>
        {name && (
          <p className="text-sm text-muted-foreground">{name}</p>
        )}
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={artSrc}
            alt={name || "Campaign sticker"}
            width={125}
            height={125}
            className="align-middle w-[125px] h-[125px] object-cover rounded-md"
          />
        </div>
        {message && (
          <p className="text-sm text-muted-foreground max-w-xs">{message}</p>
        )}
        {!smartAddress || !walletAddress ? (
          <p className="text-sm text-muted-foreground">
            Connect your wallet to check claim eligibility.
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void checkEligibility()}
              disabled={uiState === "claiming" || uiState === "loading"}
            >
              Recheck
            </Button>
            {showClaim && (
              <Button
                type="button"
                size="sm"
                onClick={() => void claim()}
                disabled={uiState !== "eligible"}
              >
                {uiState === "claiming" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Claiming…
                  </>
                ) : uiState === "claimed" ? (
                  "Claimed"
                ) : (
                  "Claim Sticker"
                )}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
