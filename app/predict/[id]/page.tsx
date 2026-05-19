import React from "react";
import { Metadata, ResolvingMetadata } from "next";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Slash, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { PredictionDetails } from "@/components/predictions/PredictionDetails";
import { REALITY_ETH_DAPP_URL, REALITY_ETH_CHAIN_ID } from "@/context/context";
import { getRealityEthContractAddress } from "@/lib/sdk/reality-eth/reality-eth-client";
import { createPublicClient, http, fallback, formatEther } from "viem";
import { baseMainnet } from "@/lib/utils/chains/base";
import { getQuestion } from "@/lib/sdk/reality-eth/reality-eth-question-wrapper";
import { logger } from "@/lib/utils/logger";


interface PredictionDetailsPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(
  { params }: PredictionDetailsPageProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { id } = await params;

  // Default metadata
  const defaultTitle = "Prediction Market";
  const defaultDescription = "Predict the outcome of real-world events on Creative TV.";

  try {
    const publicClient = createPublicClient({
      chain: baseMainnet,
      transport: fallback([
        http(process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
          ? `https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
          : undefined),
        http("https://mainnet.base.org"),
      ]),
    });

    const questionData = await getQuestion(publicClient as any, id);
    let title = defaultTitle;
    let description = defaultDescription;

    if (questionData) {
      if (questionData.question) {
        // Try to parse the question if it's a template
        // For standard reality.eth questions, the question text is often the title
        title = questionData.question;
      }

      // Add bounty to description if it exists
      if (questionData.bounty && questionData.bounty > 0n) {
        const bountyEth = formatEther(questionData.bounty);
        description = `Reward: ${bountyEth} ETH - ${defaultDescription}`;
      }
    }

    return {
      title: `Prediction: ${title}`,
      description: description,
      openGraph: {
        title: `Prediction: ${title}`,
        description: description,
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title: `Prediction: ${title}`,
        description: description,
      }
    };
  } catch (error) {
    logger.error("Error generating metadata:", error);
    return {
      title: defaultTitle,
      description: defaultDescription,
    };
  }
}

export default async function PredictionDetailsPage({
  params,
}: PredictionDetailsPageProps) {
  const { id } = await params;
  const contractAddress = getRealityEthContractAddress();
  const realityEthUrl = `${REALITY_ETH_DAPP_URL}#!/network/${REALITY_ETH_CHAIN_ID}/question/${contractAddress}-${id}`;

  return (
    <div className="min-h-screen p-6 flex flex-col items-center">
      <div className="w-full max-w-3xl">
        <div className="my-5 mb-6">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/">
                    <span role="img" aria-label="home">
                      🏠
                    </span>{" "}
                    Home
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator>
                <Slash />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/predict">Predict</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator>
                <Slash />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                <BreadcrumbPage>Prediction Details</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <Card className="p-6 mb-6">
          <div className="mb-4">
            <Link
              href={realityEthUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-500 hover:text-blue-700 underline font-mono text-sm"
            >
              View on Reality.eth
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          <PredictionDetails questionId={id} />
        </Card>
      </div>
    </div>
  );
}
