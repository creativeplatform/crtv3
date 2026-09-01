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

export type VerifiedStickerCreation = {
  tokenId: number;
  admin: Address;
  verifier: Address;
  proposalId: string;
  uri: string;
  txHash: Hex;
};

/**
 * Confirm a createSticker tx on Base and extract StickerCreated.
 */
export async function verifyStickerCreationTx(
  transactionHash: string,
  expectedBrand: string,
  expectedProposalId: string,
  expectedUri?: string,
): Promise<VerifiedStickerCreation> {
  if (
    !CAMPAIGN_STICKERS_ADDRESS ||
    CAMPAIGN_STICKERS_ADDRESS === "0x0000000000000000000000000000000000000000"
  ) {
    throw new TransactionVerificationError("Campaign stickers contract not configured");
  }

  const { receipt } = await getVerifiedTransactionReceipt(transactionHash, {
    maxAgeSeconds: 60 * 60, // 1 hour
  });

  const contract = getAddress(CAMPAIGN_STICKERS_ADDRESS);
  const brand = getAddress(expectedBrand as Address);

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
        verifier: Address;
        proposalId: string;
        uri: string;
      };

      if (getAddress(args.admin) !== brand) {
        throw new TransactionVerificationError(
          "Sticker admin does not match authenticated brand",
        );
      }
      if (args.proposalId !== expectedProposalId) {
        throw new TransactionVerificationError(
          "Proposal ID does not match on-chain sticker",
        );
      }
      if (expectedUri && args.uri !== expectedUri) {
        throw new TransactionVerificationError(
          "Metadata URI does not match on-chain sticker",
        );
      }

      return {
        tokenId: Number(args.tokenId),
        admin: args.admin,
        verifier: args.verifier,
        proposalId: args.proposalId,
        uri: args.uri,
        txHash: transactionHash as Hex,
      };
    } catch (err) {
      if (err instanceof TransactionVerificationError) throw err;
      // Not our event / failed decode — keep scanning
    }
  }

  throw new TransactionVerificationError(
    "StickerCreated event not found in transaction",
  );
}
