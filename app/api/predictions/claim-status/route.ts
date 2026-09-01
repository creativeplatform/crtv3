import { NextRequest, NextResponse } from "next/server";
import { isAddress, createPublicClient, http, fallback } from "viem";
import { base } from "@account-kit/infra";
import { rateLimiters } from "@/lib/middleware/rateLimit";
import {
  getFinalAnswer,
  getQuestion,
} from "@/lib/sdk/reality-eth/reality-eth-question-wrapper";
import { enrichPredictionDisplaySync } from "@/lib/predictions/enrich-prediction-display";
import { getUserClaimStatus } from "@/lib/predictions/claim-status";

export async function GET(request: NextRequest) {
  const rl = await rateLimiters.generous(request);
  if (rl) return rl;

  const questionId = request.nextUrl.searchParams.get("questionId")?.trim();
  const address = request.nextUrl.searchParams.get("address")?.trim();
  const smartAccount = request.nextUrl.searchParams
    .get("smartAccount")
    ?.trim();

  if (!questionId || !/^0x[a-fA-F0-9]{64}$/.test(questionId)) {
    return NextResponse.json(
      { error: "Valid questionId is required" },
      { status: 400 }
    );
  }

  if (!address || !isAddress(address)) {
    return NextResponse.json(
      { error: "Valid address is required" },
      { status: 400 }
    );
  }

  const publicClient = createPublicClient({
    chain: base,
    transport: fallback([
      http(
        process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
          ? `https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
          : undefined
      ),
      http("https://mainnet.base.org"),
    ]),
  });

  try {
    const [questionData, finalAnswer] = await Promise.all([
      getQuestion(publicClient, questionId),
      getFinalAnswer(publicClient, questionId).catch(() => null),
    ]);

    const { parsed } = enrichPredictionDisplaySync(
      questionData.question ?? "",
      questionData.template_id
    );

    const result = await getUserClaimStatus({
      publicClient,
      questionId,
      addresses: [address, smartAccount],
      finalAnswer,
      parsed,
    });

    return NextResponse.json({
      status: result.status,
      winningAnswerLabel: result.winningAnswerLabel,
      winningBondTotal: result.winningBondTotal.toString(),
      contractBalance: result.contractBalance.toString(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to check claim status" },
      { status: 500 }
    );
  }
}
