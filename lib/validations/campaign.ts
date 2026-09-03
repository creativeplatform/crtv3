import { z } from "zod";

const ethAddress = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address");

export const CampaignFormSchema = z
  .object({
    brandName: z.string().min(2),
    brandHandle: z.string().min(2),
    brandLogoUrl: z.string().url(),
    campaignTitle: z.string().min(5),
    campaignDescription: z.string().max(500),
    productImageUrl: z.string().url(),
    purchaseUrl: z.string().url(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    targetCreator: ethAddress,
    budgetUsdc: z.number().nonnegative().optional(),
    brandAddress: ethAddress.optional(),
  })
  .refine((data) => data.endDate > data.startDate, {
    message: "endDate must be after startDate",
    path: ["endDate"],
  });

export type CampaignFormInput = z.infer<typeof CampaignFormSchema>;

export const CampaignProposalPatchSchema = z.object({
  snapshotProposalId: z.string().min(1).max(128),
});

export const AttachVideoSchema = z.object({
  playbackId: z.string().min(1).max(128),
});

export const DetectionResultSchema = z.object({
  startTime: z.number(),
  endTime: z.number(),
  boundingBox: z.tuple([
    z.number(),
    z.number(),
    z.number(),
    z.number(),
  ]),
});

export const DetectionResultArraySchema = z.array(DetectionResultSchema);
