"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createPublicClient } from "viem";
import { alchemy, base } from "@account-kit/infra";
import { useChain, useAuthModal, useSigner } from "@/lib/wallet/react";
import { useWalletStatus } from "@/lib/hooks/accountkit/useWalletStatus";
import { useWalletAuth } from "@/lib/auth/useWalletAuth";
import { createProposal } from "@/app/vote/create/[address]/actions";
import { SNAPSHOT_SPACE } from "@/context/context";
import { CampaignFormSchema } from "@/lib/validations/campaign";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/utils/logger";

const formSchema = CampaignFormSchema.omit({ brandAddress: true });
type FormValues = z.infer<typeof formSchema>;

function toDateInputValue(d: Date) {
  return d.toISOString().slice(0, 10);
}

function toTimeInputValue(d: Date) {
  return d.toISOString().slice(11, 16);
}

export function CreateShoppableCampaign() {
  const router = useRouter();
  const { chain } = useChain();
  const { openAuthModal } = useAuthModal();
  const signer = useSigner();
  const {
    isConnected,
    walletAddress,
    smartAccountAddress,
  } = useWalletStatus();
  const { getAuthHeaders } = useWalletAuth();
  const brandAddress = (smartAccountAddress || walletAddress || "").toLowerCase();

  const [submitting, setSubmitting] = useState(false);

  const now = new Date();
  const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      brandName: "",
      brandHandle: "",
      brandLogoUrl: "",
      campaignTitle: "",
      campaignDescription: "",
      productImageUrl: "",
      purchaseUrl: "",
      startDate: now,
      endDate: weekLater,
      targetCreator: "",
      budgetUsdc: undefined,
    },
  });

  const onSubmit = async (values: FormValues) => {
    if (!isConnected || !walletAddress || !chain?.id) {
      openAuthModal?.();
      toast.error("Connect your wallet to create a campaign");
      return;
    }
    if (!brandAddress) {
      toast.error("Smart wallet address unavailable");
      return;
    }

    setSubmitting(true);
    try {
      const headers = await getAuthHeaders();
      const createRes = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify({
          ...values,
          brandAddress,
          targetCreator: values.targetCreator.toLowerCase(),
        }),
      });
      const created = await createRes.json();
      if (!createRes.ok) {
        throw new Error(
          typeof created.error === "string"
            ? created.error
            : "Failed to create campaign"
        );
      }

      const publicClient = createPublicClient({
        chain: base,
        transport: alchemy({ apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY! }),
      });
      const blockNumber = Number(await publicClient.getBlockNumber());
      const start = Math.floor(values.startDate.getTime() / 1000);
      const end = Math.floor(values.endDate.getTime() / 1000);
      const nowSec = Math.floor(Date.now() / 1000);

      const domain = {
        name: "snapshot",
        version: "0.1.4",
      } as const;

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
          { name: "privacy", type: "string" },
          { name: "app", type: "string" },
        ],
      } as const;

      const body = [
        values.campaignDescription,
        "",
        `Product kit: ${created.ipfsUri}`,
        `Campaign ID: ${created.campaignId}`,
        `Target creator: ${values.targetCreator.toLowerCase()}`,
      ].join("\n");

      const typedMessage = {
        from: walletAddress,
        space: SNAPSHOT_SPACE,
        timestamp: nowSec,
        type: "single-choice" as const,
        title: `[Shoppable] ${values.campaignTitle}`,
        body,
        discussion: "",
        choices: ["Yes", "No"],
        labels: [] as string[],
        start,
        end,
        snapshot: blockNumber,
        plugins: JSON.stringify({
          creativeTv: {
            smartWallet: smartAccountAddress || null,
            eoa: walletAddress,
            shoppableCampaignId: created.campaignId,
            ipfsUri: created.ipfsUri,
          },
        }),
        privacy: "",
        app: "creative-tv",
      };

      if (!signer) throw new Error("Signer unavailable");
      const signature = await signer.signTypedData({
        domain,
        types,
        primaryType: "Proposal",
        message: typedMessage,
      } as any);

      const envelope = {
        domain,
        types,
        message: typedMessage,
      };

      const result = await createProposal({
        title: typedMessage.title,
        content: typedMessage.body,
        choices: typedMessage.choices,
        start,
        end,
        address: walletAddress,
        chainId: chain.id,
        signature,
        proposalPayload: envelope,
      });

      const proposalId = result?.data?.id;
      if (!proposalId) {
        throw new Error(
          result?.serverError || "Snapshot proposal created without an id"
        );
      }

      const patchRes = await fetch(`/api/campaigns/${created.campaignId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify({ snapshotProposalId: proposalId }),
      });
      if (!patchRes.ok) {
        const patchErr = await patchRes.json().catch(() => ({}));
        throw new Error(patchErr.error || "Failed to link Snapshot proposal");
      }

      toast.success("Shoppable campaign submitted for governance");
      router.push(`/vote/${proposalId}`);
    } catch (err) {
      logger.error("[CreateShoppableCampaign]", err);
      toast.error(err instanceof Error ? err.message : "Campaign failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-xl">
        <FormField
          control={form.control}
          name="brandName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Brand name</FormLabel>
              <FormControl>
                <Input placeholder="Acme" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="brandHandle"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Brand handle</FormLabel>
              <FormControl>
                <Input placeholder="acme" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="brandLogoUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Brand logo URL</FormLabel>
              <FormControl>
                <Input placeholder="https://..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="campaignTitle"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Campaign title</FormLabel>
              <FormControl>
                <Input placeholder="Summer drip placement" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="campaignDescription"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea maxLength={500} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="productImageUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Product image URL</FormLabel>
              <FormControl>
                <Input placeholder="https://..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="purchaseUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Purchase URL</FormLabel>
              <FormControl>
                <Input placeholder="https://..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="targetCreator"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Target creator (0x…)</FormLabel>
              <FormControl>
                <Input placeholder="0x…" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start date</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    value={toDateInputValue(field.value)}
                    onChange={(e) => {
                      const time = toTimeInputValue(field.value);
                      field.onChange(new Date(`${e.target.value}T${time}:00`));
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>End date</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    value={toDateInputValue(field.value)}
                    onChange={(e) => {
                      const time = toTimeInputValue(field.value);
                      field.onChange(new Date(`${e.target.value}T${time}:00`));
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="budgetUsdc"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Budget USDC (optional)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={field.value ?? ""}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value === "" ? undefined : Number(e.target.value)
                    )
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting…
            </>
          ) : (
            "Create shoppable campaign"
          )}
        </Button>
      </form>
    </Form>
  );
}
