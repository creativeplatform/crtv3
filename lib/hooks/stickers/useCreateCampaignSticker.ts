"use client";

import { useCallback, useState } from "react";
import {
  type Address,
  type Hex,
  encodeFunctionData,
  createPublicClient,
  http,
  decodeEventLog,
  getAddress,
} from "viem";
import { base } from "viem/chains";
import {
  CAMPAIGN_STICKERS_ADDRESS,
  campaignStickersAbi,
} from "@/lib/contracts/CampaignStickers";
import { useSmartAccountClient } from "@/lib/wallet/react";
import { useGasSponsorship } from "@/lib/hooks/wallet/useGasSponsorship";
import { useWalletAuth } from "@/lib/auth/useWalletAuth";
import { appendBuilderCode } from "@/lib/utils/builder-code";
import { logger } from "@/lib/utils/logger";

export type CreateStickerResult = {
  tokenId: number;
  metadataUri: string;
  imageUri: string;
  txHash: string;
};

function getVerifierAddress(): Address {
  const addr = process.env.NEXT_PUBLIC_STICKER_VERIFIER_ADDRESS;
  if (!addr || !/^0x[a-fA-F0-9]{40}$/.test(addr)) {
    throw new Error("NEXT_PUBLIC_STICKER_VERIFIER_ADDRESS is not configured");
  }
  return addr as Address;
}

async function tokenIdFromReceipt(txHash: Hex, brand: Address): Promise<number> {
  const publicClient = createPublicClient({
    chain: base,
    transport: http(),
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  const contract = getAddress(CAMPAIGN_STICKERS_ADDRESS);

  for (const log of receipt.logs) {
    if (getAddress(log.address) !== contract) continue;
    try {
      const decoded = decodeEventLog({
        abi: campaignStickersAbi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName !== "StickerCreated") continue;
      const args = decoded.args as {
        tokenId: bigint;
        admin: Address;
      };
      if (getAddress(args.admin) !== getAddress(brand)) continue;
      return Number(args.tokenId);
    } catch {
      // keep scanning
    }
  }
  throw new Error("StickerCreated event not found in transaction receipt");
}

/**
 * Brand-facing hook: upload sticker art to Grove, call permissionless
 * createSticker via sponsored user op, then register in Supabase.
 */
export function useCreateCampaignSticker() {
  const { client, address } = useSmartAccountClient({});
  const { getGasContext } = useGasSponsorship();
  const { getAuthHeaders } = useWalletAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createSticker = useCallback(
    async (opts: {
      file: File;
      name: string;
      description?: string;
      proposalId: string;
    }): Promise<CreateStickerResult | null> => {
      if (!client || !address) {
        setError(new Error("Wallet not connected"));
        return null;
      }
      if (
        !CAMPAIGN_STICKERS_ADDRESS ||
        CAMPAIGN_STICKERS_ADDRESS ===
          "0x0000000000000000000000000000000000000000"
      ) {
        setError(new Error("Campaign stickers contract not deployed"));
        return null;
      }

      setIsCreating(true);
      setError(null);

      try {
        const authHeaders = await getAuthHeaders();
        const form = new FormData();
        form.append("file", opts.file);
        form.append("name", opts.name);
        form.append("description", opts.description ?? "");
        form.append("proposalId", opts.proposalId);
        form.append("brandAddress", address);

        const uploadRes = await fetch("/api/stickers/upload", {
          method: "POST",
          headers: authHeaders,
          body: form,
        });
        const uploadJson = await uploadRes.json();
        if (!uploadRes.ok || !uploadJson.metadataUri) {
          throw new Error(uploadJson.error || "Grove upload failed");
        }

        const metadataUri = uploadJson.metadataUri as string;
        const imageUri = (uploadJson.imageUri as string) || metadataUri;
        const verifier = getVerifierAddress();

        const data = appendBuilderCode(
          encodeFunctionData({
            abi: campaignStickersAbi,
            functionName: "createSticker",
            args: [metadataUri, opts.proposalId, verifier],
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

        const tokenId = await tokenIdFromReceipt(txHash as Hex, address as Address);

        const registerRes = await fetch("/api/stickers/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
          body: JSON.stringify({
            tokenId,
            proposalId: opts.proposalId,
            ipfsHash: metadataUri,
            brandAddress: address,
            transactionHash: txHash,
            name: opts.name,
            imageUri,
            metadata: {
              name: opts.name,
              description: opts.description,
              image: imageUri,
            },
          }),
        });
        const registerJson = await registerRes.json();
        if (!registerRes.ok) {
          throw new Error(registerJson.error || "Failed to register sticker");
        }

        return {
          tokenId: registerJson.tokenId ?? tokenId,
          metadataUri,
          imageUri,
          txHash,
        };
      } catch (err) {
        logger.error("createSticker failed:", err);
        const e = err instanceof Error ? err : new Error("createSticker failed");
        setError(e);
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    [client, address, getGasContext, getAuthHeaders]
  );

  return { createSticker, isCreating, error };
}
