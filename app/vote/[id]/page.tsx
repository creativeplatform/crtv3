import { Suspense } from "react";
import { notFound } from "next/navigation";
import { gql } from "@apollo/client";
import { makeServerClient } from "@/lib/apollo-server-client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Proposal } from "@/components/proposal-list/ProposalList";
import { VotingForm } from "@/components/proposal-list/ProposalList";
import { ClaimStickerButton } from "@/components/stickers/ClaimStickerButton";
import { shortenAddress } from "@/lib/utils/utils";
import { LinkedIdentityDisplay } from "@/components/vote/LinkedIdentityDisplay";
import { SNAPSHOT_SPACE } from "@/context/context";
import Link from "next/link";
import { ExternalLink, Slash } from "lucide-react";
import { Metadata, ResolvingMetadata } from "next";
import { CampaignShareButton } from "@/components/vote/CampaignShareButton";
import { CampaignPredictButton } from "@/components/vote/CampaignPredictButton";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

/**
 * Extract Smart Wallet address from proposal plugins metadata
 */
function extractSmartWalletFromPlugins(plugins: string | null | undefined): string | null {
  if (!plugins) return null;
  try {
    const parsed = typeof plugins === "string" ? JSON.parse(plugins) : plugins;
    return parsed?.creativeTv?.smartWallet || null;
  } catch {
    return null;
  }
}

const GET_PROPOSAL = gql`
  query Proposal($id: String!) {
  proposal(id: $id) {
    id
    title
    body
    choices
    start
    end
    snapshot
    state
    author
    scores
    scores_total
    votes
    plugins
  }
}
`;

interface ProposalDetailsPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(
  { params }: ProposalDetailsPageProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { id } = await params;

  try {
    const client = makeServerClient();
    const { data } = await client.query<{
      proposal: Proposal & { author: string; plugins?: string };
    }>({
      query: GET_PROPOSAL,
      variables: { id },
      fetchPolicy: "no-cache",
    });

    if (!data?.proposal) {
      return {
        title: "Campaign Not Found",
        description: "The requested campaign could not be found.",
      };
    }

    const proposal = data.proposal;
    const cleanDescription = proposal.body
      ? proposal.body.replace(/[#*`]/g, '').slice(0, 160) + (proposal.body.length > 160 ? '...' : '')
      : "View this campaign on Creative TV";

    return {
      title: proposal.title,
      description: cleanDescription,
      openGraph: {
        title: proposal.title,
        description: cleanDescription,
        type: "website",
        siteName: "Creative TV",
      },
      twitter: {
        card: "summary_large_image",
        title: proposal.title,
        description: cleanDescription,
      },
    };
  } catch (error) {
    console.error("Error generating metadata:", error);
    return {
      title: "Campaign Details",
      description: "View campaign details on Creative TV",
    };
  }
}

export default async function ProposalDetailsPage({
  params,
}: ProposalDetailsPageProps) {
  const { id } = await params;
  const client = makeServerClient();
  const { data } = await client.query<{
    proposal: Proposal & { author: string; plugins?: string };
  }>({
    query: GET_PROPOSAL,
    variables: { id },
    fetchPolicy: "no-cache",
  });

  if (!data?.proposal) return notFound();
  const proposal = data.proposal;

  const now = Math.floor(Date.now() / 1000);
  const isVotingActive = now >= proposal.start && now <= proposal.end;

  return (
    <Suspense
      fallback={
        <div className="min-h-screen p-6 flex flex-col items-center">
          <div className="w-full max-w-3xl">
            <Card className="p-6 mb-6">
              <div className="space-y-2">
                <Skeleton className="h-8 w-3/4" />
                <div className="flex flex-wrap gap-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <div className="space-y-2 mt-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
                <Skeleton className="h-4 w-1/2 mt-4" />
              </div>
            </Card>
            <Card className="p-6 mb-6">
              <Skeleton className="h-6 w-24 mb-4" />
              <Skeleton className="h-32 w-full" />
            </Card>
            <Card className="p-6 mb-6">
              <Skeleton className="h-6 w-32 mb-4" />
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                  <Skeleton className="h-2 w-full" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                  <Skeleton className="h-2 w-full" />
                </div>
              </div>
            </Card>
          </div>
        </div>
      }
    >
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
                    <Link href="/vote">Vote</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator>
                  <Slash />
                </BreadcrumbSeparator>
                <BreadcrumbItem>
                  <BreadcrumbPage>{proposal.title}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <Card className="p-6 mb-6 overflow-x-auto">
            <div className="flex justify-between items-start mb-2 gap-4">
              <h1 className="text-2xl font-bold break-words flex-1">
                {proposal.title}
              </h1>
              <div className="flex-shrink-0 flex items-center gap-2">
                <CampaignPredictButton
                  campaignId={proposal.id}
                  campaignTitle={proposal.title}
                />
                <CampaignShareButton
                  campaignId={proposal.id}
                  campaignTitle={proposal.title}
                />
              </div>
            </div>
            <div className="mb-4 text-gray-500 space-y-1 break-all">
              <div className="truncate max-w-full">
                <LinkedIdentityDisplay
                  authorEOA={proposal.author}
                  smartWalletAddress={extractSmartWalletFromPlugins(proposal.plugins)}
                  showFull={false}
                />
              </div>
              <div>
                Start: {new Date(proposal.start * 1000).toLocaleString()}
              </div>
              <div>End: {new Date(proposal.end * 1000).toLocaleString()}</div>
              <div>State: {proposal.state}</div>
            </div>
            <div className="mb-6 whitespace-pre-line break-words">
              {proposal.body}
            </div>
            <div className="mb-6">
              <span className="font-semibold">Snapshot:</span>{" "}
              <Link
                href={`https://snapshot.box/#/s:${SNAPSHOT_SPACE}/proposal/${proposal.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-500 hover:text-blue-700 underline font-mono"
              >
                {proposal.snapshot}
                < ExternalLink className="h-3 w-3" />
              </Link >
            </div >
          </Card >
          <Card className="p-6 mb-6">
            <h2 className="text-lg font-bold mb-2">Voting</h2>
            {isVotingActive ? (
              typeof VotingForm === "function" ? (
                <VotingForm proposal={proposal} />
              ) : (
                <div className="text-gray-400">Voting form placeholder</div>
              )
            ) : (
              <div className="text-gray-400">Voting is not active.</div>
            )}
          </Card>
          <Card className="p-6 mb-6">
            <h2 className="text-lg font-bold mb-2">Current Results</h2>
            {proposal.scores && proposal.choices ? (
              <ul className="mb-2">
                {proposal.choices.map((choice: string, idx: number) => {
                  const votes = proposal.scores?.[idx] ?? 0;
                  const total = proposal.scores_total ?? 0;
                  const percent =
                    total > 0 ? Math.round((votes / total) * 100) : 0;
                  return (
                    <li key={choice} className="mb-4">
                      <div className="flex justify-between items-center mb-1">
                        <span>{choice}</span>
                        <span className="font-semibold">{votes}</span>
                      </div>
                      <div
                        className="w-full bg-gray-200 rounded h-3"
                        role="progressbar"
                        aria-valuenow={percent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Votes for ${choice}`}
                      >
                        <div
                          className="bg-blue-500 h-3 rounded"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <div className="text-xs text-gray-500 mt-1 text-right">
                        {percent}%
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="text-gray-400">No results available</div>
            )}
            <div className="mt-2 text-sm text-gray-500">
              Total votes: {proposal.scores_total ?? 0}
            </div>
          </Card>
          <ClaimStickerButton proposalId={proposal.id} />
        </div >
      </div >
    </Suspense >
  );
}
