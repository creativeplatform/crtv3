import { NextRequest, NextResponse } from 'next/server';
import { signAccessJwt } from "@livepeer/core/crypto";
import { getStreamByPlaybackId } from "@/services/streams";
import {
  requireWalletAuth,
  WalletAuthError,
} from "@/lib/auth/require-wallet";
import {
  checkMeTokenAccess,
  isMeTokenGateActive,
} from "@/lib/utils/metoken-access";
import { resolveVerifiedViewerAddresses } from "@/lib/utils/linked-identity";
import { serverLogger } from '@/lib/utils/logger';

export async function handleSignJwt(req: NextRequest): Promise<NextResponse> {
  try {
    const accessControlPrivateKey = process.env.ACCESS_CONTROL_PRIVATE_KEY;
    const accessControlPublicKey = process.env.NEXT_PUBLIC_ACCESS_CONTROL_PUBLIC_KEY;

    if (!accessControlPrivateKey || !accessControlPublicKey) {
      serverLogger.error("Missing Access Control Keys");
      return NextResponse.json(
        { message: "Server configuration error: Missing access keys" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { playbackId, companionAddress } = body;

    if (!playbackId) {
      return NextResponse.json(
        { message: "Missing playbackId" },
        { status: 400 }
      );
    }

    const stream = await getStreamByPlaybackId(playbackId);

    if (
      !stream ||
      !isMeTokenGateActive(stream.requires_metoken, stream.metoken_price)
    ) {
      const token = await signAccessJwt({
        privateKey: accessControlPrivateKey,
        publicKey: accessControlPublicKey,
        issuer: "https://crtv3.app",
        playbackId,
        expiration: 3600,
        custom: {
          userId: "anonymous",
        },
      });

      return NextResponse.json({ token });
    }

    const gatedStream = stream;
    const requiredAmount = gatedStream.metoken_price ?? 0;

    if (!gatedStream.creator_id) {
      return NextResponse.json(
        { message: "Stream creator not found" },
        { status: 400 }
      );
    }

    let verifiedViewerAddress: string;

    try {
      const verified = await requireWalletAuth(req);
      verifiedViewerAddress = verified.address;
    } catch (err) {
      if (err instanceof WalletAuthError) {
        const missingHeaders = err.message.includes("Missing wallet auth headers");
        const signingRejected =
          !missingHeaders &&
          (err.message.includes("Invalid wallet signature") ||
            err.message.includes("too old"));

        return NextResponse.json(
          {
            code: "METOKEN_REQUIRED",
            connectWallet: missingHeaders,
            signingRequired: signingRejected,
            creatorAddress: gatedStream.creator_id,
            required: String(requiredAmount),
            message: missingHeaders
              ? "Connect your wallet to verify MeToken balance"
              : err.message,
          },
          { status: 403 }
        );
      }
      throw err;
    }

    const viewerAddresses = await resolveVerifiedViewerAddresses(
      verifiedViewerAddress,
      companionAddress,
    );

    const access = await checkMeTokenAccess({
      viewerAddresses,
      creatorAddress: gatedStream.creator_id,
      requiredAmount,
    });

    if (!access.allowed) {
      return NextResponse.json(
        {
          code: "METOKEN_REQUIRED",
          connectWallet: access.reason === "no_viewer_address",
          meTokenAddress: access.meTokenAddress,
          symbol: access.symbol,
          required: access.requiredFormatted,
          balance: access.balanceFormatted,
          creatorAddress: gatedStream.creator_id,
          message:
            access.reason === "no_viewer_address"
              ? "Connect your wallet to verify MeToken balance"
              : "Insufficient MeToken balance to watch this stream",
        },
        { status: 403 }
      );
    }

    const token = await signAccessJwt({
      privateKey: accessControlPrivateKey,
      publicKey: accessControlPublicKey,
      issuer: "https://crtv3.app",
      playbackId,
      expiration: 3600,
      custom: {
        userId: verifiedViewerAddress,
      },
    });

    return NextResponse.json({ token });
  } catch (error) {
    serverLogger.error("Error signing JWT:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
