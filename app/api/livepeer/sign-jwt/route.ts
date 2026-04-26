import { signAccessJwt } from "@livepeer/core/crypto";
import { NextRequest, NextResponse } from "next/server";
import { checkBotId } from "botid/server";
import { rateLimiters } from "@/lib/middleware/rateLimit";

export async function POST(req: NextRequest) {
    const verification = await checkBotId();
    if (verification.isBot) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    const rl = await rateLimiters.standard(req);
    if (rl) return rl;

    try {
        const accessControlPrivateKey = process.env.ACCESS_CONTROL_PRIVATE_KEY;
        const accessControlPublicKey = process.env.NEXT_PUBLIC_ACCESS_CONTROL_PUBLIC_KEY;

        if (!accessControlPrivateKey || !accessControlPublicKey) {
            console.error("Missing Access Control Keys");
            return NextResponse.json(
                { message: "Server configuration error: Missing access keys" },
                { status: 500 }
            );
        }

        const body = await req.json();
        const { playbackId, userAddress } = body;

        if (!playbackId) {
            return NextResponse.json(
                { message: "Missing playbackId" },
                { status: 400 }
            );
        }

        const token = await signAccessJwt({
            privateKey: accessControlPrivateKey,
            publicKey: accessControlPublicKey,
            issuer: "https://crtv3.app",
            playbackId,
            expiration: 3600, // 1 hour
            custom: {
                userId: userAddress || "anonymous"
            }
        });

        return NextResponse.json({ token });
    } catch (error) {
        console.error("Error signing JWT:", error);
        return NextResponse.json(
            { message: "Internal server error" },
            { status: 500 }
        );
    }
}
