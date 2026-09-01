"use client";

import { useState } from "react";
import { useSuspenseQuery, gql } from "@apollo/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useForm, FormProvider } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormField,
} from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Clock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useChain, useAuthModal, useSignTypedData } from "@/lib/wallet/react";
import { useWalletStatus } from "@/lib/hooks/accountkit/useWalletStatus";
import { createVote } from "@/app/vote/[id]/actions";
import { SNAPSHOT_SPACE } from "@/context/context";
import { LinkedIdentityDisplay } from "@/components/vote/LinkedIdentityDisplay";
import { useMembershipVerification } from "@/lib/hooks/unlock/useMembershipVerification";
import { logger } from "@/lib/utils/logger";

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

function ProposalList({ space }: ProposalListProps) {
  const { data, error } = useSuspenseQuery<{ proposals: Proposal[] }>(
    GET_PROPOSALS,
    {
      variables: { space, first: 10 },
      errorPolicy: "all",
    }
  );

  // Log for debugging
  if (typeof window !== "undefined") {
    logger.debug("ProposalList query:", {
      space,
      hasData: !!data,
      proposalCount: data?.proposals?.length || 0,
      error: error?.message,
    });
  }

  if (error) {
    logger.error("ProposalList error:", error);
    return (
      <div className="p-4 text-red-500">
        <div className="font-semibold">Failed to load proposals</div>
        <div className="text-sm mt-1">{error.message}</div>
        <div className="text-xs mt-2 text-gray-400">
          Space: {space}
        </div>
        {error.networkError && (
          <div className="text-xs mt-1 text-gray-400">
            Network error: {error.networkError.message}
          </div>
        )}
      </div>
    );
  }
  
  if (!data?.proposals?.length) {
    return (
      <div className="p-4">
        <div>No proposals found in space: <span className="font-mono text-sm">{space}</span></div>
        <div className="text-sm text-gray-500 mt-2">
          {data?.proposals ? "The space exists but has no proposals yet." : "Unable to query the space."}
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 w-full overflow-x-auto">
      {data.proposals.map((proposal) => {
        // Calculate if voting is currently active
        const now = Math.floor(Date.now() / 1000);
        const isVotingActive = now >= proposal.start && now <= proposal.end;
        const isVotingClosed = now > proposal.end;
        const isVotingPending = now < proposal.start;

        // Determine status badge styling
        const getStatusBadge = () => {
          if (isVotingActive) {
            return (
              <Badge 
                variant="default" 
                className="bg-green-500 hover:bg-green-600 text-white border-green-600"
              >
                <Clock className="h-3 w-3 mr-1" />
                Active
              </Badge>
            );
          } else if (isVotingClosed) {
            return (
              <Badge 
                variant="secondary" 
                className="bg-gray-500 hover:bg-gray-600 text-white border-gray-600"
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Closed
              </Badge>
            );
          } else {
            return (
              <Badge 
                variant="outline" 
                className="bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border-yellow-300"
              >
                <Clock className="h-3 w-3 mr-1" />
                Pending
              </Badge>
            );
          }
        };

        return (
          <Link key={proposal.id} href={`/vote/${proposal.id}`} className="block">
            <Card 
              className={`p-2 sm:p-4 w-full cursor-pointer hover:shadow-lg transition-shadow ${
                isVotingActive 
                  ? "border-l-4 border-l-green-500 bg-green-50/30 dark:bg-green-950/20" 
                  : isVotingClosed
                  ? "border-l-4 border-l-gray-400 bg-gray-50/30 dark:bg-gray-950/20 opacity-90"
                  : "border-l-4 border-l-yellow-400 bg-yellow-50/30 dark:bg-yellow-950/20"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h2 className="text-base sm:text-lg font-semibold truncate flex-1">
                  {proposal.title}
                </h2>
                {getStatusBadge()}
              </div>
              <p className="hidden sm:block text-sm sm:text-base text-gray-500 mb-2">
                {proposal.body.slice(0, 120)}
                {proposal.body.length > 120 ? "..." : ""}
              </p>
              {proposal.author && (
                <div className="text-xs text-gray-400 mb-2">
                  <LinkedIdentityDisplay
                    authorEOA={proposal.author}
                    smartWalletAddress={extractSmartWalletFromPlugins(proposal.plugins)}
                    showFull={false}
                  />
                </div>
              )}
              <div className="flex flex-col sm:flex-row sm:items-center text-xs sm:text-sm text-gray-400 gap-1 sm:gap-2">
                <span>
                  Start: {new Date(proposal.start * 1000).toLocaleString()}
                </span>
                <span className="hidden sm:inline">|</span>
                <span>End: {new Date(proposal.end * 1000).toLocaleString()}</span>
                <span className="hidden sm:inline">|</span>
                <span>State: {proposal.state}</span>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

export { ProposalList, VotingForm };
export default ProposalList;

const GET_PROPOSALS = gql`
  query Proposals($space: String!, $first: Int!) {
    proposals(
      first: $first
      skip: 0
      where: { space_in: [$space] }
      orderBy: "created"
      orderDirection: desc
    ) {
      id
      title
      body
      choices
      start
      end
      snapshot
      state
      author
      plugins
    }
  }
`;

interface ProposalListProps {
  space: string;
}

export interface Proposal {
  id: string;
  title: string;
  body: string;
  choices: string[];
  start: number;
  end: number;
  snapshot: string;
  state: string;
  author?: string;
  plugins?: string;
  scores?: number[];
  scores_total?: number;
  votes?: number;
}

function VotingForm({ proposal }: { proposal: Proposal }) {
  const schema = z.object({
    choice: z.string().min(1, "Please select a choice"),
  });
  const methods = useForm<{ choice: string }>({
    resolver: zodResolver(schema),
    defaultValues: { choice: "" },
  });
  const { handleSubmit, reset } = methods;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { chain } = useChain();
  const { isConnected, walletAddress, smartAccountAddress, smartAccountClient } = useWalletStatus();
  const { openAuthModal } = useAuthModal();
  const { isVerified, hasMembership, isLoading: isMembershipLoading } = useMembershipVerification();
  
  /**
   * IDENTITY STRATEGY:
   * - Smart Wallet: Primary public identity (what users see) - holds membership NFT
   * - We must sign with the smart account because:
   *   1. Voting power comes from membership NFT in the smart account
   *   2. The signature must match the 'from' address in the vote message
   *   3. Snapshot validates signatures against the 'from' address
   */
  const [signaturePromise, setSignaturePromise] = useState<{
    resolve: (value: string) => void;
    reject: (error: Error) => void;
  } | null>(null);

  const { signTypedData } = useSignTypedData({
    client: smartAccountClient || undefined,
    onSuccess: (signature) => {
      logger.debug("Smart account vote signature created successfully:", signature);
      if (signaturePromise) {
        signaturePromise.resolve(signature);
        setSignaturePromise(null);
      }
    },
    onError: (error) => {
      logger.error("Error signing vote with smart account:", error);
      if (signaturePromise) {
        signaturePromise.reject(error);
        setSignaturePromise(null);
      }
    },
  });

  // Check if user has creative membership (one of the three tiers)
  const canVote = isVerified && hasMembership;

  async function onSubmit(values: { choice: string }) {
    setError(null);

    // Check membership first
    if (!canVote) {
      setError("You need a Creative Platform membership (Creative Creator Pass, Creative Investor Pass, or Creative Brand Pass) to vote. Please purchase a membership to participate in voting.");
      return;
    }

    // Validate connection state
    if (!isConnected || !walletAddress || !chain?.id) {
      setError("Please connect your wallet.");
      return;
    }

    // Smart account address is required for voting (membership NFT is stored there)
    if (!smartAccountAddress) {
      setError("Smart account not available. Please ensure your wallet is properly connected.");
      return;
    }

    // Smart account client is required for signing
    if (!smartAccountClient) {
      logger.error("Smart account client is not available:", {
        smartAccountAddress,
        walletAddress,
        isConnected,
      });
      setError("Smart account not available. Please ensure your wallet is properly connected and your smart account is initialized.");
      return;
    }

    // Find the choice index (Snapshot uses 1-based indexing)
    const choiceIndex = proposal.choices.findIndex((c) => c === values.choice);
    if (choiceIndex === -1) {
      setError("Invalid choice selected.");
      return;
    }
    // Snapshot uses 1-based indexing for choices
    const snapshotChoice = choiceIndex + 1;

    setIsSubmitting(true);

    try {
      logger.debug("Starting vote submission:", {
        walletAddress,
        smartAccountAddress,
        proposalId: proposal.id,
        choice: values.choice,
        snapshotChoice,
      });

      // Prepare EIP-712 typed data for signing (similar to proposal creation)
      const domain = {
        name: "snapshot",
        version: "0.1.4",
      } as const;

      // Snapshot's vote types - must match their schema exactly
      const types = {
        Vote: [
          { name: "from", type: "string" },
          { name: "space", type: "string" },
          { name: "timestamp", type: "uint64" },
          { name: "proposal", type: "string" },
          { name: "choice", type: "uint32" },
          { name: "reason", type: "string" },
          { name: "app", type: "string" },
          { name: "metadata", type: "string" },
        ],
      } as const;

      const now = Math.floor(Date.now() / 1000);

      // Build the message for signing
      // IMPORTANT: Use smart account address in 'from' field because voting power
      // comes from membership NFT stored in the smart account. The signature will
      // still be from the EOA (walletAddress), but Snapshot will check voting power
      // for the smart account address.
      // Use plain numbers for uint fields — not BigInt.
      // Privy's eth_signTypedData_v4 path JSON-serializes the payload and cannot
      // handle BigInt ("Do not know how to serialize a BigInt").
      const typedMessage = {
        from: smartAccountAddress, // Smart account address (holds membership NFT for voting power)
        space: SNAPSHOT_SPACE,
        timestamp: now,
        proposal: proposal.id,
        choice: snapshotChoice,
        reason: "",
        app: "creative-tv",
        metadata: JSON.stringify({}),
      };

      logger.debug("Signing Vote Typed Data:", { domain, types, message: typedMessage });

      // Verify wallet address is available
      if (!walletAddress) {
        setError("Wallet address not available. Please connect your wallet.");
        return;
      }

      logger.debug("Using smart account signTypedData (signature will match smart account address)...");

      // Sign the typed data using the smart account
      // This is required because the 'from' address is the smart account, so the signature must match
      let signature: string;
      try {
        // Create a promise that will be resolved by the hook's onSuccess callback
        const signPromise = new Promise<string>((resolve, reject) => {
          setSignaturePromise({ resolve, reject });
          
          // Set a timeout to reject if signing takes too long
          setTimeout(() => {
            reject(new Error("Signing timed out after 120s - user may have cancelled"));
          }, 120000);
        });

        // Trigger the signing with the smart account
        signTypedData({
          typedData: {
            domain,
            types,
            primaryType: "Vote",
            message: typedMessage,
          },
        });

        // Wait for the signature from the callback
        signature = await signPromise;
      } catch (signError) {
        logger.error("Error during signing:", signError);
        setSignaturePromise(null); // Clean up
        if (signError instanceof Error) {
          if (signError.message.includes("cancelled") || signError.message.includes("rejected")) {
            setError("Signing was cancelled. Please try again.");
          } else if (signError.message.includes("timed out")) {
            setError("Signing timed out. Please try again.");
          } else {
            setError(`Failed to sign vote: ${signError.message}`);
          }
        } else {
          setError("Failed to sign vote. Please try again.");
        }
        return;
      }

      logger.debug("Vote Typed Data Signed successfully with smart account:", signature);

      // Prepare EIP-712 envelope for submission
      // Use smart account address in the message (for voting power check)
      // but pass EOA address for signature validation
      const envelope = {
        domain,
        types,
        message: {
          from: smartAccountAddress, // Smart account address (for voting power)
          space: SNAPSHOT_SPACE,
          timestamp: now, // number for JSON
          proposal: proposal.id,
          choice: snapshotChoice, // number for JSON
          reason: "",
          app: "creative-tv",
          metadata: JSON.stringify({}),
        },
      };

      logger.debug("Submitting vote to server:", {
        fromAddress: smartAccountAddress,
        signature: signature,
      });

      const result = await createVote({
        proposalId: proposal.id,
        choice: snapshotChoice,
        address: smartAccountAddress, // Use smart account address for the vote
        signature,
        votePayload: envelope,
      });

      if (result?.serverError) {
        logger.error("Server error:", result.serverError);
        let errorMsg = result.serverError;
        if (errorMsg.includes("no voting power")) {
          errorMsg =
            "You don't have voting power in this Snapshot space.\n\n" +
            "Voting power is determined by the space's voting strategy. " +
            "You may need to:\n" +
            "• Hold specific tokens (ERC-20)\n" +
            "• Own specific NFTs\n" +
            "• Meet other criteria defined by the space\n\n" +
            "Check the space settings to see what gives voting power: " +
            "https://snapshot.org/#/vote.thecreative.eth/settings";
        } else if (errorMsg.includes("validation failed")) {
          errorMsg =
            "Vote validation failed. Possible reasons:\n• You don't have permission to vote in this space\n• You don't meet the minimum voting power requirement\n• The voting period has ended\n• You've already voted on this proposal";
        }
        setError(errorMsg || "Failed to submit vote.");
        return;
      }

      if (result?.validationErrors) {
        logger.error("Validation errors:", result.validationErrors);
        setError("Validation failed. Please check your input.");
        return;
      }

      if (!result?.data) {
        logger.error("No data in result:", result);
        setError("Failed to submit vote.");
        return;
      }

      logger.debug("Vote submitted successfully:", result.data);
      toast.success("Vote submitted successfully!");
      reset();
      // Optionally refresh the page to show updated results
      window.location.reload();
    } catch (error) {
      logger.error("Error submitting vote:", error);
      setError(
        error instanceof Error ? error.message : "Failed to submit vote. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  // Show membership requirement message if user doesn't have membership
  // Only show this if membership check is complete (not loading) and user is connected but doesn't have membership
  if (!isMembershipLoading && isConnected && !canVote) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <h3 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
            Membership Required to Vote
          </h3>
          <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
            You need a Creative Platform membership to participate in voting. Choose from one of our three tiers:
          </p>
          <ul className="text-sm text-yellow-700 dark:text-yellow-300 list-disc list-inside space-y-1 mb-3">
            <li>Creative Creator Pass</li>
            <li>Creative Investor Pass</li>
            <li>Creative Brand Pass</li>
          </ul>
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            You can view all proposals and results, but voting requires an active membership NFT.
          </p>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg">
          <FormProvider {...methods}>
            <form className="space-y-4 opacity-60 pointer-events-none">
              <FormField
                name="choice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="mb-3">Vote</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="flex flex-col gap-4"
                      >
                        {proposal.choices.map((choice, idx) => (
                          <div key={choice} className="flex items-center space-x-3 py-1">
                            <RadioGroupItem
                              value={choice}
                              id={`choice-${proposal.id}-${idx}`}
                              disabled
                            />
                            <Label
                              htmlFor={`choice-${proposal.id}-${idx}`}
                              className="font-normal"
                            >
                              {choice}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="button" className="mt-6 w-full" disabled>
                Submit Vote
              </Button>
            </form>
          </FormProvider>
        </div>
      </div>
    );
  }

  // Show connect wallet message if user is not connected
  if (!isConnected && !isMembershipLoading) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
            Connect Your Wallet to Vote
          </h3>
          <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
            You can view all proposals and results without connecting, but you need to connect your wallet to participate in voting.
          </p>
          <Button
            onClick={() => openAuthModal()}
            className="mt-2"
          >
            Connect Wallet
          </Button>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg">
          <FormProvider {...methods}>
            <form className="space-y-4 opacity-60 pointer-events-none">
              <FormField
                name="choice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="mb-3">Vote</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="flex flex-col gap-4"
                      >
                        {proposal.choices.map((choice, idx) => (
                          <div key={choice} className="flex items-center space-x-3 py-1">
                            <RadioGroupItem
                              value={choice}
                              id={`choice-${proposal.id}-${idx}`}
                              disabled
                            />
                            <Label
                              htmlFor={`choice-${proposal.id}-${idx}`}
                              className="font-normal"
                            >
                              {choice}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="button" className="mt-6 w-full" disabled>
                Submit Vote
              </Button>
            </form>
          </FormProvider>
        </div>
      </div>
    );
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          name="choice"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="mb-3">Vote</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  value={field.value}
                  className="flex flex-col gap-4"
                  disabled={!canVote || isMembershipLoading}
                >
                  {proposal.choices.map((choice, idx) => (
                    <div key={choice} className="flex items-center space-x-3 py-1">
                      <RadioGroupItem
                        value={choice}
                        id={`choice-${proposal.id}-${idx}`}
                        disabled={!canVote || isMembershipLoading}
                      />
                      <Label
                        htmlFor={`choice-${proposal.id}-${idx}`}
                        className={canVote && !isMembershipLoading ? "cursor-pointer font-normal" : "font-normal"}
                      >
                        {choice}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {error && (
          <div className="text-red-500 text-sm font-medium mt-4 whitespace-pre-line">
            {error}
          </div>
        )}
        <Button 
          type="submit" 
          className="mt-6 w-full" 
          disabled={isSubmitting || !canVote || isMembershipLoading}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...
            </>
          ) : (
            "Submit Vote"
          )}
        </Button>
      </form>
    </FormProvider>
  );
}
