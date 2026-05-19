import { createSDK } from '@orbclub/modules';
import { groveUploadPlugin } from '@orbclub/modules/upload/grove';
import { getOrbGroveUploadConfig } from '@/lib/sdk/orb/config';

const groveSdk = createSDK({
  plugins: [groveUploadPlugin(getOrbGroveUploadConfig())],
});

export type OrbGroveUploadInput = {
  file: File;
  account: string;
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
};

export type OrbGroveUploadResult = {
  uri: string;
  gatewayUrl: string;
  storageKey: string;
};

export async function uploadFileToGrove(
  input: OrbGroveUploadInput,
): Promise<OrbGroveUploadResult> {
  return groveSdk.upload.uploadFile(input);
}
