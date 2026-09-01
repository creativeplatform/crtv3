import {
  type Address,
  type Hex,
  decodeEventLog,
  getAddress,
} from "viem";
import {
  CAMPAIGN_STICKERS_ADDRESS,
  campaignStickersAbi,
} from "@/lib/contracts/CampaignStickers";
import {
  getVerifiedTransactionReceipt,
  TransactionVerificationError,
} from "@/lib/chain/verifyTransactionReceipt";

/**
 * Confirm a claim tx minted the sticker to the expected wallet.
 */
export async function verifyStickerClaimTx(
  transactionHash: string,
  expectedTokenId: number,
  expectedClaimer: string,
): Promise<{ tokenId: number; claimer: Address }> {
  if (
    !CAMPAIGN_STICKERS_ADDRESS ||
    CAMPAIGN_STICKERS_ADDRESS === "0x0000000000000000000000000000000000000000"
  ) {
    throw new TransactionVerificationError("Campaign stickers contract not configured");
  }

  const { receipt } = await getVerifiedTransactionReceipt(transactionHash, {
    maxAgeSeconds: 60 * 60,
  });

  const contract = getAddress(CAMPAIGN_STICKERS_ADDRESS);
  const claimer = getAddress(expectedClaimer as Address);

  for (const log of receipt.logs) {
    if (getAddress(log.address) !== contract) continue;
    try {
      const decoded = decodeEventLog({
        abi: campaignStickersAbi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName !== "StickerClaimed") continue;

      const args = decoded.args as {
        tokenId: bigint;
        claimer: Address;
      };

      if (Number(args.tokenId) !== expectedTokenId) {
        throw new TransactionVerificationError("Claimed tokenId mismatch");
      }
      if (getAddress(args.claimer) !== claimer) {
        throw new TransactionVerificationError("Claimer address mismatch");
      }

      return { tokenId: Number(args.tokenId), claimer: args.claimer };
    } catch (err) {
      if (err instanceof TransactionVerificationError) throw err;
    }
  }

  throw new TransactionVerificationError(
    "StickerClaimed event not found in transaction",
  );
}

export type { Hex };
