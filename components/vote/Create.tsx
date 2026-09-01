"use client";

import React, { useState, Suspense, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useChain, useAuthModal, useSigner } from "@/lib/wallet/react";
import { useRouter } from "next/navigation";
import { createProposal } from "@/app/vote/create/[address]/actions";
import { SNAPSHOT_SPACE } from "@/context/context";
import { createPublicClient } from "viem";
import { alchemy, base } from "@account-kit/infra";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useWalletStatus } from "@/lib/hooks/accountkit/useWalletStatus";
import { useLinkedIdentity } from "@/lib/hooks/useLinkedIdentity";
import { formatProposalAuthor } from "@/lib/utils/linked-identity";
import { shortenAddress } from "@/lib/utils/utils";
import { logger } from "@/lib/utils/logger";
import { useCreateCampaignSticker } from "@/lib/hooks/stickers/useCreateCampaignSticker";
import { toast } from "sonner";

const proposalSchema = z.object({
  title: z.string().min(3, "Title is required"),
  content: z.string().min(3, "Content is required"),
  choices: z
    .array(z.object({ value: z.string().min(1, "Choice cannot be empty") }))
    .min(2, "At least two choices required"),
  start: z.string().min(1, "Start date required"),
  startTime: z.string().min(1, "Start time required"),
  end: z.string().min(1, "End date required"),
  endTime: z.string().min(1, "End time required"),
  // Campaign sticker (optional)
  createSticker: z.boolean(),
  stickerName: z.string().optional(),
  stickerDescription: z.string().optional(),
});
type ProposalForm = z.infer<typeof proposalSchema>;

function getUnixTimestamp(date: string, time: string) {
  if (!date || !time) return 0;
  // Interpret the date/time inputs as **local time** (what the user picked in the UI),
  // then convert to a unix timestamp (seconds).
  //
  // Using Date.UTC here can shift the timestamp and accidentally place `end` in the past
  // for users outside UTC, which Snapshot rejects.
  const d = new Date(`${date}T${time}:00`);
  const ms = d.getTime();
  if (Number.isNaN(ms)) return 0;
  return Math.floor(ms / 1000);
}

function Create() {
  const { chain } = useChain();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Use the shared wallet status hook to ensure we're using the correct client context
  const {
    smartAccountClient,
    isLoadingClient,
    isConnected,
    walletAddress, // EOA address (for signing)
    smartAccountAddress: address, // Smart Wallet address (primary identity)
  } = useWalletStatus();

  // Get linked identity information
  const { linkedIdentity, isPermitted, isVerifying } = useLinkedIdentity();

  // Auth modal for re-authentication if connection is lost
  const { openAuthModal } = useAuthModal();

  /**
   * IDENTITY STRATEGY FOR CREATIVE TV:
   * 
   * Primary Identity (Public): Smart Wallet Address
   * - This is what users see and interact with
   * - Used for receiving assets, tips, IP sales
   * - Better security, social recovery, Web2-like UX
   * 
   * Functional Identity (Background): EOA Address
   * - Used for signing operations (Snapshot, approvals, etc.)
   * - Many governance tools (like Snapshot) require ECDSA signatures from EOA
   * - Kept in background for permissions and author roles
   * 
   * SNAPSHOT SPECIFIC:
   * Snapshot sequencer validates signatures as EOA ECDSA (ecrecover). It does NOT accept
   * smart account / ERC-1271 / ERC-6492 signatures for proposal creation.
   * 
   * Therefore, we must sign the Snapshot EIP-712 payload with the underlying EOA signer,
   * and submit `address` + `message.from` as the EOA address (walletAddress).
   * 
   * FUTURE ENHANCEMENT:
   * Consider using Delegate.cash to link EOA to Smart Wallet, allowing Smart Wallet
   * to get "credit" for proposals while EOA does the actual signing.
   */
  const signer = useSigner();
  const { createSticker, isCreating: isCreatingSticker } = useCreateCampaignSticker();
  const [stickerFile, setStickerFile] = useState<File | null>(null);

  // Debug info on mount
  useEffect(() => {
    logger.debug("Wallet Debug Info:", {
      smartAccountClient: smartAccountClient ? "exists" : "null",
      smartAccountAddress: address || "not available",
      walletAddress: walletAddress || "not available",
    });
  }, [smartAccountClient, address, walletAddress]);

  const form = useForm<ProposalForm>({
    resolver: zodResolver(proposalSchema),
    defaultValues: {
      title: "",
      content: "",
      choices: [{ value: "Yes" }, { value: "No" }],
      start: "",
      startTime: "",
      end: "",
      endTime: "",
      createSticker: false,
      stickerName: "",
      stickerDescription: "",
    },
    mode: "onTouched",
  });

  const createStickerEnabled = form.watch("createSticker");

  const { fields, append, remove } = useFieldArray<ProposalForm>({
    control: form.control,
    name: "choices",
  });

  async function onSubmit(values: ProposalForm) {
    setFormError(null);

    // Validate connection state
    if (!isConnected || !walletAddress || !chain?.id) {
      setFormError("Please connect your wallet.");
      return;
    }

    // Snapshot requires EOA signature
    if (!signer) {
      setFormError("Signer not available. Please sign in again.");
      openAuthModal();
      return;
    }

    // Verify EOA is a permitted signer for Smart Wallet (if Smart Wallet exists)
    if (address && walletAddress && address.toLowerCase() !== walletAddress.toLowerCase()) {
      if (isVerifying) {
        setFormError("Verifying signer permissions...");
        return;
      }
      if (isPermitted === false) {
        setFormError(
          "Your EOA is not a permitted signer for your Smart Wallet. " +
          "Please ensure you're using the correct wallet or contact support."
        );
        return;
      }
    }

    const start = getUnixTimestamp(values.start, values.startTime);
    const end = getUnixTimestamp(values.end, values.endTime);
    const nowTs = Math.floor(Date.now() / 1000);

    if (end <= start) {
      setFormError("End time must be after start time.");
      return;
    }
    // Snapshot requires proposal end date to be in the future
    if (end <= nowTs) {
      setFormError("End time must be in the future.");
      return;
    }

    setIsSubmitting(true);

    try {
      logger.debug("Starting proposal creation:", {
        walletAddress,
        smartAccountAddress: address,
      });

      // Get current block number before signing
      logger.debug("Fetching block number...");
      const publicClient = createPublicClient({
        chain: base,
        transport: alchemy({
          apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY as string,
        }),
      });
      const block = await publicClient.getBlockNumber();
      const blockNumber = Number(block);
      logger.debug("Block number fetched:", blockNumber);

      // Prepare EIP-712 typed data for signing
      // Using Snapshot's exact proposal types from @snapshot-labs/snapshot.js
      logger.debug("Preparing typed data to sign...");

      const domain = {
        name: "snapshot",
        version: "0.1.4",
      } as const;

      // Snapshot's exact proposal types - must match their schema exactly
      const types = {
        Proposal: [
          { name: "from", type: "string" },
          { name: "space", type: "string" },
          { name: "timestamp", type: "uint64" },
          { name: "type", type: "string" },
          { name: "title", type: "string" },
          { name: "body", type: "string" },
          { name: "discussion", type: "string" },
          { name: "choices", type: "string[]" },
          { name: "labels", type: "string[]" },
          { name: "start", type: "uint64" },
          { name: "end", type: "uint64" },
          { name: "snapshot", type: "uint64" },
          { name: "plugins", type: "string" },
          // Some Snapshot sequencer configs reject proposals that explicitly set `privacy`,
          // but still expect `privacy` to exist in `types`. To handle this, we:
          // - include `privacy` in the EIP-712 types (matches Snapshot.js)
          // - sign with `privacy: ""`
          // - omit `privacy` from the submitted message payload (server should default it)
          { name: "privacy", type: "string" },
          { name: "app", type: "string" },
        ],
      } as const;

      const now = Math.floor(Date.now() / 1000);

      // Build the message with all required fields matching Snapshot's schema.
      // Message used for SIGNING (includes privacy, because it's in the types).
      //
      // IMPORTANT: Use plain numbers for uint fields — not BigInt.
      // Privy's toViemAccount signs via eth_signTypedData_v4, which JSON-serializes
      // the payload. JSON.stringify throws "Do not know how to serialize a BigInt".
      const typedMessage = {
        from: walletAddress, // EOA address (Snapshot requires EOA signature)
        space: SNAPSHOT_SPACE,
        timestamp: now,
        type: "single-choice" as const,
        title: values.title,
        body: values.content,
        discussion: "",
        choices: values.choices.map((c) => c.value),
        labels: [] as string[],
        start,
        end,
        snapshot: blockNumber,
        plugins: JSON.stringify({
          // Store Smart Wallet address for linked identity display
          creativeTv: {
            smartWallet: address || null, // Primary identity (Smart Wallet)
            eoa: walletAddress, // Signing identity (EOA)
          },
        }),
        privacy: "",
        app: "creative-tv",
      };

      logger.debug("Signing Typed Data:", { domain, types, message: typedMessage });

      // Best-effort: verify signer is responsive and bound to the expected EOA.
      // Some environments report waitForConnected timeouts even when signing works, so do not hard-fail on it.
      try {
        const signerAddr = signer?.address;
        logger.debug("Signer getAddress():", signerAddr);
        if (signerAddr?.toLowerCase?.() !== walletAddress.toLowerCase()) {
          logger.warn(
            "Signer address mismatch; expected walletAddress",
            walletAddress,
            "got",
            signerAddr,
          );
        }
      } catch (e) {
        logger.warn("Signer getAddress failed/timed out:", e);
        setFormError("Wallet signer is not ready. Please sign in again.");
        openAuthModal();
        return;
      }

      if (typeof (signer as any).waitForConnected === "function") {
        try {
          await Promise.race([
            (signer as any).waitForConnected(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("waitForConnected timed out")), 30000),
            ),
          ]);
          logger.debug("Signer waitForConnected(): connected");
        } catch (e) {
          logger.warn("Signer waitForConnected failed/timed out:", e);
          // Continue anyway; signing may still succeed.
        }
      }

      logger.debug("Using EOA signer.signTypedData (Snapshot-compatible)...");

      const signature = await Promise.race([
        signer.signTypedData({
          domain,
          types,
          primaryType: "Proposal",
          message: typedMessage,
        } as any),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Signing timed out after 120s")), 120000),
        ),
      ]);

      logger.debug("Typed Data Signed successfully:", signature);

      logger.debug("Submitting proposal to server...");

      // Snapshot.js expects the EIP-712 envelope format: { domain, types, message }
      // Keep uint fields as numbers so they match the signed typed data exactly.
      const envelope = {
        domain,
        types,
        message: {
          from: walletAddress,
          space: SNAPSHOT_SPACE,
          timestamp: now, // number for JSON
          type: "single-choice",
          title: values.title,
          body: values.content,
          discussion: "",
          choices: values.choices.map((c) => c.value),
          labels: [],
          start: start, // number for JSON
          end: end, // number for JSON
          snapshot: blockNumber, // number for JSON
          plugins: JSON.stringify({
            // Store Smart Wallet address for linked identity display
            creativeTv: {
              smartWallet: address || null, // Primary identity (Smart Wallet)
              eoa: walletAddress, // Signing identity (EOA)
            },
          }),
          // Must match the signed typed data exactly for signature validation to pass
          privacy: "",
          app: "creative-tv",
        },
      };

      const result = await createProposal({
        title: values.title,
        content: values.content,
        choices: values.choices.map((c) => c.value),
        start,
        end,
        // Snapshot expects the signing address here (EOA)
        address: walletAddress,
        chainId: chain.id,
        signature,
        // Pass the EIP-712 envelope - this is what Snapshot's API expects
        proposalPayload: envelope,
      });

      if (result?.serverError) {
        logger.error("Server error:", result.serverError);
        // Format the error message to be more user-friendly
        let errorMsg = result.serverError;
        if (errorMsg.includes("validation failed")) {
          const spaceUrl = `https://snapshot.org/#/${SNAPSHOT_SPACE}/settings`;
          errorMsg = `Proposal validation failed. This usually means:\n\n• You don't have permission to create proposals (check if you're a member/admin)\n• You don't meet the minimum voting power requirement\n• The proposal doesn't meet the space's validation rules\n• The voting period might be too short\n\nCheck space settings: ${spaceUrl}\n\nIf you believe this is an error, contact the space admin.`;
        }
        setFormError(errorMsg || "Failed to create proposal.");
        return;
      }
      if (result?.validationErrors) {
        logger.error("Validation errors:", result.validationErrors);
        setFormError("Validation failed. Please check your input.");
        return;
      }
      if (!result?.data) {
        logger.error("No data in result:", result);
        setFormError("Failed to create proposal.");
        return;
      }

      logger.debug("Proposal created successfully:", result.data);

      // Optionally deploy campaign sticker for this proposal (permissionless)
      const proposalId = result.data.id as string;
      if (values.createSticker && stickerFile && proposalId) {
        try {
          const stickerResult = await createSticker({
            file: stickerFile,
            name: values.stickerName || values.title,
            description: values.stickerDescription || values.content.slice(0, 200),
            proposalId,
          });
          if (stickerResult) {
            toast.success(`Sticker #${stickerResult.tokenId} deployed`);
          } else {
            toast.warning(
              "Proposal created, but sticker deployment failed. You can retry later."
            );
          }
        } catch (stickerErr) {
          logger.error("Sticker deployment error:", stickerErr);
          toast.warning("Proposal created, but sticker deployment failed.");
        }
      }
      
      // Show success message with linked identity
      const authorDisplay = linkedIdentity?.isLinked
        ? formatProposalAuthor(address || null, walletAddress)
        : shortenAddress(walletAddress);
      
      logger.debug(`Proposal submitted by: ${authorDisplay}`);
      router.push("/vote");
    } catch (error) {
      logger.error("Error creating proposal:", error);
      setFormError(
        error instanceof Error
          ? error.message
          : "Failed to create proposal. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <div className="flex flex-wrap items-start justify-center p-2">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="w-full p-5 md:w-2/5 space-y-6"
          >
            <FormField
              name="title"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="[#BrandName] Campaign Voting"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="content"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Content</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe your proposal..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div>
              <FormLabel>Choices</FormLabel>
              {fields.map((field, idx) => (
                <div key={field.id} className="flex items-center gap-2 mb-2">
                  <FormField
                    name={`choices.${idx}.value`}
                    control={form.control}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input placeholder={`Choice ${idx + 1}`} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {fields.length > 2 && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      onClick={() => remove(idx)}
                      aria-label="Remove choice"
                    >
                      ×
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                onClick={() => append({ value: "" })}
              >
                Add Choice
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                name="start"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="startTime"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="end"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="endTime"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Campaign Sticker Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <FormLabel className="text-base font-semibold">
                    Campaign Sticker
                  </FormLabel>
                  <p className="text-sm text-muted-foreground">
                    Deploy an ERC-1155 sticker on Base that voters can claim
                  </p>
                </div>
                <FormField
                  name="createSticker"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Switch
                          checked={field.value ?? false}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              {createStickerEnabled && (
                <div className="space-y-4 pl-4 border-l-2">
                  <FormField
                    name="stickerName"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sticker Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Pizza Day Sticker"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    name="stickerDescription"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sticker Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe the sticker..."
                            rows={2}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormItem>
                    <FormLabel>Sticker Artwork</FormLabel>
                    <FormControl>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) =>
                          setStickerFile(e.target.files?.[0] ?? null)
                        }
                      />
                    </FormControl>
                    {!stickerFile && (
                      <p className="text-xs text-muted-foreground">
                        Upload PNG/JPG/WebP artwork (uploaded to IPFS)
                      </p>
                    )}
                  </FormItem>
                </div>
              )}
            </div>

            {formError && (
              <div className="text-red-500 text-sm font-medium">
                {formError}
              </div>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || isCreatingSticker}
            >
              {isSubmitting || isCreatingSticker ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                  {isCreatingSticker ? "Deploying sticker..." : "Submitting..."}
                </>
              ) : (
                "Submit"
              )}
            </Button>
          </form>
        </Form>
      </div>
    </Suspense>
  );
}

export { Create };
