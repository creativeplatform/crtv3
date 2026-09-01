import { groveService } from "@/lib/sdk/grove/service";

export type GroveUploadPayload = {
  url: string;
  hash?: string;
};

export async function uploadToGrove(file: File): Promise<GroveUploadPayload> {
  const result = await groveService.uploadFile(file);
  if (!result.success || !result.url) {
    throw new Error(result.error || "Grove upload failed");
  }
  return {
    url: result.url,
    hash: result.hash,
  };
}
