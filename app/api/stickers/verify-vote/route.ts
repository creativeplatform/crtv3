import { NextRequest, NextResponse } from "next/server";
import {
  type Address,
  type Hex,
  createWalletClient,
  http,
  isAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { z } from "zod";
import {
  CAMPAIGN_STICKERS_ADDRESS,
  CAMPAIGN_STICKERS_CLAIM_TYPES,
  CAMPAIGN_STICKERS_EIP712,
} from "@/lib/contracts/CampaignStickers";
import { getStickerByProposal } from "@/lib/sdk/supabase/campaign-stickers";
import { serverLogger } from "@/lib/utils/logger";
import { checkBotIdDeep } from "@/lib/middleware/botIdGuard";
import { rateLimiters } from "@/lib/middleware/rateLimit";
import {
  requireWalletAuthFor,
  verifyWalletAuthArgs,
  WalletAuthError,
} from "@/lib/auth/require-wallet";
import { buildStickerClaimAuthMessage } from "@/lib/stickers/claimAuthMessage";

const SNAPSHOT_HUB = "https://hub.snapshot.org/graphql";

const CHECK_VOTE_QUERY = `
  query CheckUserVote($proposalId: String!, $voterAddress: String!) {
    votes(
      where: {
        proposal: $proposalId,
        voter: $voterAddress
      }
    ) {
      id
      voter
      choice
      created
      vp
    }
  }
`;

const bodySchema = z.object({
  proposalId: z.string().min(1),
  /** Snapshot voter (EOA that cast the vote) */
  voterEOA: z.string().refine(isAddress, "Invalid voterEOA"),
  /** Smart account that will receive the sticker NFT */
  claimerAddress: z.string().refine(isAddress, "Invalid claimerAddress"),
  /** EOA wallet-auth proof that voterEOA authorizes this claim */
  voterAuth: z.object({
    address: z.string(),
    timestamp: z.number(),
    signature: z.string(),
  }),
});

type SnapshotVote = {
  id: string;
  voter: string;
  choice: number | string;
  created: number;
  vp: number;
};

async function querySnapshotVotes(
  proposalId: string,
  voterAddress: string
): Promise<SnapshotVote[]> {
  const response = await fetch(SNAPSHOT_HUB, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: CHECK_VOTE_QUERY,
      variables: {
        proposalId,
        voterAddress: voterAddress.toLowerCase(),
      },
    }),
    next: { revalidate: 30 },
  });

  if (!response.ok) {
    throw new Error(`Snapshot Hub error: ${response.status}`);
  }

  const json = (await response.json()) as {
    data?: { votes?: SnapshotVote[] };
    errors?: unknown[];
  };

  if (json.errors?.length) {
    serverLogger.error("Snapshot GraphQL errors:", json.errors);
    throw new Error("Snapshot GraphQL query failed");
  }

  return json.data?.votes ?? [];
}

function getVerifierAccount() {
  const pk = process.env.STICKER_VERIFIER_PRIVATE_KEY;
  if (!pk) {
    throw new Error("STICKER_VERIFIER_PRIVATE_KEY is not configured");
  }
  const normalized = (pk.startsWith("0x") ? pk : `0x${pk}`) as Hex;
  return privateKeyToAccount(normalized);
}

/**
 * POST /api/stickers/verify-vote
 * Verifies Snapshot vote for voterEOA, then signs a claim voucher for claimerAddress.
 */
export async function POST(req: NextRequest) {
  const verification = await checkBotIdDeep();
  if (verification.isBot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  const rl = await rateLimiters.strict(req);
  if (rl) return rl;

  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { proposalId, voterEOA, claimerAddress, voterAuth } = parsed.data;
    const claimer = claimerAddress.toLowerCase() as Address;
    const voter = voterEOA.toLowerCase() as Address;

    try {
      await requireWalletAuthFor(req, claimer);
      // The voter signs a message that binds this specific claimer + proposal,
      // so a generic wallet-auth signature from another user can't be replayed
      // to mint a voucher to an attacker's smart account.
      const voterVerified = await verifyWalletAuthArgs(
        voterAuth,
        (address, timestamp) =>
          buildStickerClaimAuthMessage({
            voter: address,
            claimer,
            proposalId,
            timestamp,
          })
      );
      if (voterVerified.address !== voter) {
        return NextResponse.json(
          { error: "voterAuth does not match voterEOA" },
          { status: 403 }
        );
      }
    } catch (authErr) {
      if (authErr instanceof WalletAuthError) {
        return NextResponse.json(
          { error: authErr.message },
          { status: authErr.status }
        );
      }
      throw authErr;
    }

    if (
      !CAMPAIGN_STICKERS_ADDRESS ||
      CAMPAIGN_STICKERS_ADDRESS === "0x0000000000000000000000000000000000000000"
    ) {
      return NextResponse.json(
        { error: "Campaign stickers contract is not configured" },
        { status: 503 }
      );
    }

    const sticker = await getStickerByProposal(proposalId);
    if (!sticker) {
      return NextResponse.json(
        { eligible: false, error: "No sticker registered for this proposal" },
        { status: 404 }
      );
    }

    const votes = await querySnapshotVotes(proposalId, voter);
    if (votes.length === 0) {
      return NextResponse.json({
        eligible: false,
        tokenId: sticker.token_id,
        name: sticker.name,
        imageUri: sticker.image_uri,
        ipfsHash: sticker.ipfs_hash,
        votes: [],
      });
    }

    const vote = votes[0];
    const account = getVerifierAccount();
    const walletClient = createWalletClient({
      account,
      chain: base,
      transport: http(),
    });

    const tokenId = BigInt(sticker.token_id);
    const signature = await walletClient.signTypedData({
      account,
      domain: {
        name: CAMPAIGN_STICKERS_EIP712.name,
        version: CAMPAIGN_STICKERS_EIP712.version,
        chainId: base.id,
        verifyingContract: CAMPAIGN_STICKERS_ADDRESS,
      },
      types: CAMPAIGN_STICKERS_CLAIM_TYPES,
      primaryType: "Claim",
      message: {
        tokenId,
        claimer,
      },
    });

    return NextResponse.json({
      eligible: true,
      tokenId: sticker.token_id,
      ipfsHash: sticker.ipfs_hash,
      name: sticker.name,
      imageUri: sticker.image_uri,
      signature,
      claimer,
      voterEOA: voter,
      vote: {
        id: vote.id,
        choice: vote.choice,
        vp: vote.vp,
        created: vote.created,
      },
      contractAddress: CAMPAIGN_STICKERS_ADDRESS,
    });
  } catch (error) {
    serverLogger.error("verify-vote failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to verify vote",
      },
      { status: 500 }
    );
  }
}
