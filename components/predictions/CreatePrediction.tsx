"use client";

import React, { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useChain, useAuthModal, useSmartAccountClient } from "@/lib/wallet/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { base } from "@account-kit/infra";
import { createPublicClient, http, parseEther, type Address } from "viem";
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
import { Info, Loader2, Sparkles } from "lucide-react";
import { useWalletStatus } from "@/lib/hooks/accountkit/useWalletStatus";
import { useWalletAuth } from "@/lib/auth/useWalletAuth";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createQuestionWithData } from "@/lib/sdk/reality-eth/reality-eth-question-wrapper";
import { getCanonicalRealityEthArbitratorAddress } from "@/lib/sdk/reality-eth/reality-eth-client";
import type { QuestionType, QuestionData } from "@/lib/sdk/reality-eth/reality-eth-utils";
import { logger } from "@/lib/utils/logger";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { usePredictionAccess } from "@/lib/hooks/predictions/usePredictionAccess";
import { ShareDialog } from "@/components/Videos/ShareDialog";
import { useSongchainPost } from "@/hooks/useSongchainPost";
import { getSongchainConfig } from "@/lib/songchain/config";
import { getTemplateIdForQuestionType } from "@/lib/predictions/reality-template";
import {
  PREDICTION_CATEGORIES,
  type PredictionCategoryValue,
} from "@/lib/predictions/categories";
import {
  REALITY_QUESTION_TYPES,
  getRealityQuestionTypeOption,
} from "@/lib/predictions/reality-question-types";
import { cn } from "@/lib/utils/utils";

export type CreatePredictionProps = {
  /** Tighter layout for embedding (e.g. Song Cup Predict panel). */
  embedded?: boolean;
  /** Prefill category; defaults to general on the standalone create page. */
  defaultCategory?: PredictionCategoryValue;
  /** Where to send the user after create/share closes. */
  successHref?: string;
  /** Optional video asset UUID so the prediction is linked to a video page. */
  videoAssetId?: string;
  /**
   * Called once the on-chain create + record POST complete (before the share
   * dialog). VideoPredictButton uses it to router.refresh() so the strip's
   * server component re-renders with the new link.
   */
  onCreated?: () => void;
  /** If true, show one-tap preset suggestions above the form. */
  showPresets?: boolean;
};

const predictionSchema = z.object({
  title: z.string().min(3, "Title is required"),
  type: z.enum(["bool", "single-select", "multiple-select", "uint"]),
  outcomes: z
    .array(z.object({ value: z.string().min(1, "Outcome cannot be empty") }))
    .optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  closeDate: z.string().min(1, "Close date is required"),
  closeTime: z.string().min(1, "Close time is required"),
  bond: z.string().optional(),
}).refine((data) => {
  // For bool and uint types, outcomes are optional (will be auto-generated)
  if (data.type === "bool" || data.type === "uint") {
    return true;
  }
  // For select types, outcomes are required and must have at least 2 non-empty values
  if (data.type === "single-select" || data.type === "multiple-select") {
    return data.outcomes && data.outcomes.length >= 2 &&
           data.outcomes.every(o => o.value && o.value.trim().length > 0);
  }
  return true;
}, {
  message: "At least 2 outcomes with values are required for select questions",
  path: ["outcomes"],
});

function getUnixTimestamp(date: string, time: string) {
  if (!date || !time) return 0;
  // Interpret the date/time inputs as **local time** (what the user picked in the UI),
  // then convert to a unix timestamp (seconds).
  const d = new Date(`${date}T${time}:00`);
  const ms = d.getTime();
  if (Number.isNaN(ms)) return 0;
  return Math.floor(ms / 1000);
}

type PredictionForm = z.infer<typeof predictionSchema>;

type PredictionQuota = {
  unlimited: boolean;
  premiumTier: "investor" | "brand" | null;
  usedThisMonth: number;
  monthlyLimit: number;
  remaining: number | null;
};

/** Human-facing seed label. */
export type PredictionPreset = {
  id: string;
  label: string;
  /** bool or uint; bool always yields Yes/No outcomes. */
  type: QuestionType;
  /** Factory: receives a video title if available, returns the seed title. */
  makeTitle: (videoTitle?: string | null) => string;
  /** Days from now for the default close date. */
  closeDays: number;
  /** Category the preset should land in. */
  category: PredictionCategoryValue;
  /** Optional description seeded into the form. */
  description?: string;
};

/**
 * Resolvable-from-local-data presets for video pages.
 * Avoids view counts, likes, trending, mixtapes, and off-platform remixes,
 * all of which lack a write ledger today.
 */
export const VIDEO_PREDICTION_PRESETS: PredictionPreset[] = [
  {
    id: "5-comments",
    label: "5 comments",
    type: "bool",
    makeTitle: (videoTitle) =>
      `Will "${shortVideoTitle(videoTitle)}" get 5 comments?`,
    closeDays: 14,
    category: "general",
    description: "Resolves Yes once the video has 5 top-level comments.",
  },
  {
    id: "first-tip",
    label: "First sticker tip",
    type: "bool",
    makeTitle: (videoTitle) =>
      `Will "${shortVideoTitle(videoTitle)}" earn its first sticker tip?`,
    closeDays: 30,
    category: "general",
    description: "Resolves Yes once someone sends a sticker tip on this video.",
  },
  {
    id: "10-tips",
    label: "10 sticker tips",
    type: "bool",
    makeTitle: (videoTitle) =>
      `Will "${shortVideoTitle(videoTitle)}" earn 10 sticker tips?`,
    closeDays: 30,
    category: "general",
    description: "Resolves Yes once the video has received 10 sticker tips.",
  },
];

function shortVideoTitle(videoTitle?: string | null): string {
  if (!videoTitle) return "this video";
  const clean = videoTitle.trim();
  if (!clean) return "this video";
  if (clean.length <= 40) return clean;
  return `${clean.slice(0, 37).trim()}...`;
}

function formatLocalDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function CreatePrediction({
  embedded = false,
  defaultCategory = "general",
  successHref = "/predict",
  videoAssetId,
  onCreated,
  showPresets = false,
}: CreatePredictionProps) {
  const { chain } = useChain();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [quota, setQuota] = useState<PredictionQuota | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [quotaError, setQuotaError] = useState<string | null>(null);

  const {
    smartAccountClient,
    isLoadingClient,
    isConnected,
    walletAddress,
    smartAccountAddress: address,
  } = useWalletStatus();
  const { getAuthHeaders } = useWalletAuth();

  const { openAuthModal } = useAuthModal();
  const { client: accountKitClient } = useSmartAccountClient({});
  const { canCreatePrediction, blockReason, isBlockedTier, isAdmin } = usePredictionAccess();
  const { createPost, isPosting: isSongchainPosting } = useSongchainPost();
  const songchainConfig = getSongchainConfig();
  const [shareOpen, setShareOpen] = useState(false);
  const [createdMeta, setCreatedMeta] = useState<{
    title: string;
    category: string;
  } | null>(null);

  const form = useForm<PredictionForm>({
    resolver: zodResolver(predictionSchema),
    defaultValues: {
      title: "",
      type: "bool",
      outcomes: [{ value: "Yes" }, { value: "No" }],
      category: defaultCategory,
      description: "",
      closeDate: "",
      closeTime: "23:59",
      bond: "0",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "outcomes",
  });

  const questionType = form.watch("type");

  useEffect(() => {
    if (!address || typeof window === "undefined") {
      setQuota(null);
      return;
    }
    if (isAdmin) {
      setQuota({
        unlimited: true,
        premiumTier: null,
        usedThisMonth: 0,
        monthlyLimit: 3,
        remaining: null,
      });
      setQuotaLoading(false);
      setQuotaError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setQuotaLoading(true);
      setQuotaError(null);
      try {
        const res = await fetch(
          `/api/predictions/quota?address=${encodeURIComponent(address)}`
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(
            typeof data.error === "string" ? data.error : "Failed to load quota"
          );
        }
        if (!cancelled) {
          setQuota(data as PredictionQuota);
        }
      } catch (e) {
        if (!cancelled) {
          setQuotaError(e instanceof Error ? e.message : "Quota error");
        }
      } finally {
        if (!cancelled) setQuotaLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address, isAdmin]);

  // Auto-populate outcomes when type changes to bool
  useEffect(() => {
    if (questionType === "bool") {
      form.setValue("outcomes", [{ value: "Yes" }, { value: "No" }]);
    } else if (questionType === "single-select" || questionType === "multiple-select") {
      // Ensure at least 2 empty outcomes for select types
      const currentOutcomes = form.getValues("outcomes");
      if (!currentOutcomes || currentOutcomes.length < 2) {
        form.setValue("outcomes", [{ value: "" }, { value: "" }]);
      }
    }
  }, [questionType, form]);

  const applyPreset = (preset: PredictionPreset, videoTitle?: string | null) => {
    const close = new Date();
    close.setDate(close.getDate() + preset.closeDays);

    form.setValue("type", preset.type);
    form.setValue("title", preset.makeTitle(videoTitle));
    form.setValue("category", preset.category);
    form.setValue("description", preset.description ?? "");
    form.setValue("closeDate", formatLocalDateInput(close));
    form.setValue("closeTime", "23:59");
    if (preset.type === "bool") {
      form.setValue("outcomes", [{ value: "Yes" }, { value: "No" }]);
    }
  };

  async function onSubmit(values: PredictionForm) {
    setFormError(null);

    if (!isConnected || !walletAddress || !chain?.id) {
      setFormError("Please connect your wallet.");
      return;
    }

    if (!accountKitClient) {
      setFormError("Wallet client not ready. Please try again.");
      return;
    }

    if (!canCreatePrediction) {
      setFormError(blockReason ?? "You cannot create predictions with this account.");
      return;
    }

    if (
      quota &&
      !quota.unlimited &&
      quota.remaining !== null &&
      quota.remaining <= 0
    ) {
      setFormError(
        "You've reached your limit of 3 prediction markets this month (UTC). Investor or Brand members can create unlimited markets."
      );
      return;
    }

    // Validate date and time fields
    if (!values.closeDate || !values.closeTime) {
      setFormError("Please select both a close date and close time.");
      return;
    }

    // Validate outcomes for select types
    if (
      (values.type === "single-select" || values.type === "multiple-select") &&
      (!values.outcomes || values.outcomes.length < 2 || values.outcomes.some(o => !o?.value || o.value.trim() === ""))
    ) {
      setFormError("At least 2 outcomes are required for select questions, and all outcomes must have values.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (address) {
        const quotaRes = await fetch(
          `/api/predictions/quota?address=${encodeURIComponent(address)}`
        );
        const fresh = (await quotaRes.json()) as PredictionQuota;
        if (
          quotaRes.ok &&
          fresh &&
          !fresh.unlimited &&
          fresh.remaining !== null &&
          fresh.remaining <= 0
        ) {
          setFormError(
            "You've reached your limit of 3 prediction markets this month (UTC). Investor members can create unlimited markets."
          );
          setIsSubmitting(false);
          return;
        }
        if (quotaRes.ok && fresh) setQuota(fresh);
      }

      logger.debug("🚀 Starting prediction creation...", {
        title: values.title,
        type: values.type,
        closeDate: values.closeDate,
        closeTime: values.closeTime,
      });

      const publicClient = createPublicClient({
        chain: base,
        transport: http(),
      });

      // Ensure outcomes are set for bool type
      let finalOutcomes: string[] | undefined = undefined;

      if (values.type === "bool") {
        // For bool type, always use Yes/No
        finalOutcomes = ["Yes", "No"];
      } else if (values.type === "single-select" || values.type === "multiple-select") {
        // For select types, use the provided outcomes
        finalOutcomes = values.outcomes
          ?.map((o) => o?.value)
          .filter((o): o is string => !!o && typeof o === 'string' && o.trim().length > 0);

        if (!finalOutcomes || finalOutcomes.length === 0) {
          setFormError("At least 2 outcomes are required for select questions.");
          setIsSubmitting(false);
          return;
        }
      }
      // For uint type, outcomes can be undefined

      const questionData: QuestionData = {
        type: values.type,
        title: values.title,
        outcomes: finalOutcomes,
        category: values.category || "general",
        description: values.description,
        language: "en_US",
      };

      const openingTs = Math.floor(Date.now() / 1000);
      const closeTs = getUnixTimestamp(values.closeDate, values.closeTime);
      const nowTs = Math.floor(Date.now() / 1000);

      logger.debug("⏰ Time calculations:", {
        openingTs,
        closeTs,
        nowTs,
        closeDate: values.closeDate,
        closeTime: values.closeTime,
      });

      // Validate that close date/time is in the future
      if (closeTs === 0) {
        setFormError("Invalid date or time. Please check your selections.");
        setIsSubmitting(false);
        return;
      }

      if (closeTs <= nowTs) {
        setFormError("Close date and time must be in the future.");
        setIsSubmitting(false);
        return;
      }

      // Calculate timeout as the difference between opening time and close time (in seconds)
      const timeout = closeTs - openingTs;

      if (timeout <= 0) {
        setFormError("Close date and time must be after the current time.");
        setIsSubmitting(false);
        return;
      }

      logger.debug("✅ Validation passed, timeout:", timeout);

      const bond = values.bond ? parseEther(values.bond) : 0n;
      const nonce = BigInt(Date.now());

      // Must match Kleros proxy used for disputes / submitEvidence (see getCanonicalRealityEthArbitratorAddress).
      const arbitrator = getCanonicalRealityEthArbitratorAddress();

      const templateId = getTemplateIdForQuestionType(questionData.type);

      logger.debug("📝 Creating question with params:", {
        templateId,
        arbitrator,
        timeout,
        openingTs,
        nonce: nonce.toString(),
        bond: bond.toString(),
        questionData,
      });

      logger.debug("🔐 Account Kit Client:", {
        hasClient: !!accountKitClient,
        account: accountKitClient?.account?.address,
      });

      const hash = await createQuestionWithData(
        publicClient,
        accountKitClient as any,
        questionData,
        {
          templateId,
          arbitrator,
          timeout,
          openingTs,
          nonce,
          bond,
        }
      );

      logger.debug("✅ Transaction hash:", hash);

      let recData: { duplicate?: boolean; linked?: boolean | null } | null = null;
      try {
        const authHeaders = await getAuthHeaders();
        const rec = await fetch("/api/predictions/record", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({
            address,
            transactionHash: hash,
            title: values.title,
            category: values.category || "general",
            questionType: values.type,
            outcomes: finalOutcomes,
            videoAssetId,
          }),
        });
        recData = await rec.json();
        if (!rec.ok) {
          if (recData?.duplicate) {
            toast.warning(
              "Prediction submitted, but usage could not be synced. If your monthly count looks wrong, contact support."
            );
          } else {
            logger.warn("Prediction quota record failed:", recData);
            toast.warning(
              "Prediction submitted, but usage could not be synced. If your monthly count looks wrong, contact support."
            );
          }
        }
      } catch (recErr) {
        logger.warn("Prediction quota record error:", recErr);
        toast.warning(
          "Prediction submitted; monthly usage may update on the next page load."
        );
      }

      toast.success("Prediction created successfully! Transaction submitted.");
      if (recData?.linked === false && videoAssetId) {
        toast.warning("Prediction created, but it may not appear on the video page.");
      }
      setCreatedMeta({
        title: values.title,
        category: values.category || "general",
      });
      setShareOpen(true);
      // Let the host page (video strip) refresh its server data now, while
      // the user is still in the share dialog.
      onCreated?.();
    } catch (error: any) {
      logger.error("❌ Error creating prediction:", error);

      // Provide more detailed error messages
      let errorMessage = "Failed to create prediction. Please try again.";

      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.cause?.message) {
        errorMessage = error.cause.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      // Check for common error patterns
      if (errorMessage.includes("user rejected") || errorMessage.includes("User rejected")) {
        errorMessage = "Transaction was cancelled. Please try again.";
      } else if (errorMessage.includes("insufficient funds") || errorMessage.includes("balance")) {
        errorMessage = "Insufficient funds. Please ensure you have enough ETH for gas and bond.";
      } else if (errorMessage.includes("network") || errorMessage.includes("chain")) {
        errorMessage = "Network error. Please check your connection and try again.";
      }

      setFormError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    logger.debug("Form submit triggered:", {
      values: form.getValues(),
      errors: form.formState.errors,
    });

    // Check form validation
    const isValid = await form.trigger();
    logger.debug("Form is valid:", isValid);

    if (!isValid) {
      logger.debug("❌ Form validation failed:", form.formState.errors);
      return;
    }

    await form.handleSubmit(onSubmit)(e);
  };

  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-center",
        embedded ? "w-full p-0" : "p-2",
      )}
    >
      {embedded && !isConnected ? (
        <div className="mb-4 w-full rounded-xl border border-border/60 bg-muted/40 px-4 py-3 dark:bg-white/[0.06]">
          <p className="text-sm text-muted-foreground">
            Connect your wallet to create a prediction market.
          </p>
          <Button
            type="button"
            size="sm"
            className="mt-2"
            onClick={() => openAuthModal()}
          >
            Connect wallet
          </Button>
        </div>
      ) : null}
      <Form {...form}>
        <form
          onSubmit={handleFormSubmit}
          className={cn(
            "w-full",
            embedded ? "space-y-4 p-0" : "space-y-6 p-5 md:w-2/5",
          )}
        >
          {embedded && showPresets && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">
                  Quick predictions
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {VIDEO_PREDICTION_PRESETS.map((preset) => (
                  <Button
                    key={preset.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isSubmitting || !canCreatePrediction}
                    onClick={() => applyPreset(preset, createdMeta?.title ?? undefined)}
                    className="text-xs"
                  >
                    {preset.label}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isSubmitting || !canCreatePrediction}
                  onClick={() => {
                    form.setValue("type", "bool");
                    form.setValue("title", "");
                    form.setValue("description", "");
                    form.setValue("category", defaultCategory);
                  }}
                  className="text-xs"
                >
                  Custom
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Tap a preset to auto-fill, then edit the title or close date before submitting.
              </p>
            </div>
          )}

          {isBlockedTier && blockReason && (
            <Alert variant="destructive">
              <AlertTitle>Cannot create predictions</AlertTitle>
              <AlertDescription>{blockReason}</AlertDescription>
            </Alert>
          )}
          {!isConnected || !address ? null : quotaLoading ? (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Monthly allowance</AlertTitle>
              <AlertDescription>Loading…</AlertDescription>
            </Alert>
          ) : quotaError ? (
            <Alert variant="destructive">
              <AlertTitle>Could not load allowance</AlertTitle>
              <AlertDescription>{quotaError}</AlertDescription>
            </Alert>
          ) : quota ? (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Monthly allowance</AlertTitle>
              <AlertDescription>
                {quota.unlimited ? (
                  <>
                    {quota.premiumTier === "investor" && (
                      <span>Investor membership: unlimited prediction markets. </span>
                    )}
                    {quota.premiumTier === "brand" && (
                      <span>Brand membership: unlimited prediction markets. </span>
                    )}
                    {!quota.premiumTier && (
                      <span>Unlimited prediction markets for your account. </span>
                    )}
                  </>
                ) : (
                  <>
                    {quota.usedThisMonth} of {quota.monthlyLimit} markets used this
                    month (UTC).{" "}
                    {quota.remaining !== null && quota.remaining > 0 ? (
                      <span>
                        {quota.remaining} remaining.{" "}
                        <Link
                          href="/"
                          className="underline font-medium text-foreground"
                        >
                          Upgrade to Investor or Brand
                        </Link>{" "}
                        for unlimited markets.
                      </span>
                    ) : (
                      <span>
                        <Link
                          href="/"
                          className="underline font-medium text-foreground"
                        >
                          Upgrade to Investor or Brand
                        </Link>{" "}
                        for unlimited markets.
                      </span>
                    )}
                  </>
                )}
              </AlertDescription>
            </Alert>
          ) : null}

          <FormField
            name="title"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Question Title</FormLabel>
                <FormControl>
                  <Input placeholder="Will X happen?" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name="type"
            control={form.control}
            render={({ field }) => {
              const selected = getRealityQuestionTypeOption(field.value);
              return (
                <FormItem>
                  <FormLabel>Question type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select question type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {REALITY_QUESTION_TYPES.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selected && (
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {selected.description} (Reality.eth template{" "}
                      {selected.templateId})
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              );
            }}
          />

          {(questionType === "single-select" || questionType === "multiple-select") && (
            <div>
              <FormLabel>Outcomes</FormLabel>
              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-2 mb-2">
                  <FormField
                    control={form.control}
                    name={`outcomes.${index}.value`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input placeholder={`Outcome ${index + 1}`} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {fields.length > 2 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => remove(index)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => append({ value: "" })}
                className="mt-2"
              >
                Add Outcome
              </Button>
            </div>
          )}

          <FormField
            name="category"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {PREDICTION_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name="description"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description (optional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Additional context about this prediction..."
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              name="closeDate"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Close Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="closeTime"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Close Time</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            name="bond"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bond Amount (ETH, optional)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.001" placeholder="0" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {formError && (
            <div className="text-red-500 text-sm font-medium whitespace-pre-line">
              {formError}
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={
              isSubmitting ||
              !isConnected ||
              isLoadingClient ||
              !canCreatePrediction ||
              (quota !== null &&
                !quota.unlimited &&
                quota.remaining !== null &&
                quota.remaining <= 0)
            }
            onClick={(e) => {
              logger.debug("🔘 Create Prediction button clicked");
              logger.debug("🔘 isSubmitting:", isSubmitting);
              logger.debug("🔘 isConnected:", isConnected);
              logger.debug("🔘 isLoadingClient:", isLoadingClient);
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...
              </>
            ) : (
              "Create Prediction"
            )}
          </Button>
        </form>
      </Form>

      {createdMeta && (
        <div
          className={cn(
            "w-full space-y-3",
            embedded ? "p-0 pt-3" : "p-5 md:w-2/5",
          )}
        >
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            disabled={isSongchainPosting || !songchainConfig.publicFeedId}
            onClick={() => {
              const origin =
                typeof window !== "undefined" ? window.location.origin : "";
              void createPost({
                feedId: songchainConfig.publicFeedId!,
                content: `New prediction: ${createdMeta.title}\n\n${origin}${successHref}`,
                title: createdMeta.title,
              });
            }}
          >
            {isSongchainPosting ? "Posting to Songchain…" : "Post to Songchain"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => router.push(successHref)}
          >
            View all predictions
          </Button>
        </div>
      )}

      <ShareDialog
        open={shareOpen}
        onOpenChange={(open) => {
          setShareOpen(open);
          if (!open && createdMeta) {
            router.push(successHref);
          }
        }}
        videoTitle={createdMeta?.title ?? "Prediction"}
        videoId="new"
        shareUrlOverride={successHref}
        titleOverride={createdMeta?.title}
        dialogTitle="Share Prediction"
        shareNoun="prediction"
      />
    </div>
  );
}

export { CreatePrediction };
export default CreatePrediction;
