import { createSDK } from "@orbclub/modules";
import { backendTransportPlugin } from "@orbclub/modules/transport/backend";
import type {
  OrbPollApiResponse,
  OrbPollCreatePostData,
  OrbPollCreatePostRequest,
  OrbPollVotersData,
} from "./types";

export type OrbPollsConfig = {
  baseUrl: string;
};

export function getOrbPollsConfig(): OrbPollsConfig {
  return {
    baseUrl: process.env.ORB_POLLS_API_BASE_URL?.trim() || "https://orbapi.xyz",
  };
}

function createPollsSdk(config: OrbPollsConfig) {
  return createSDK({
    plugins: [
      backendTransportPlugin({
        baseUrl: config.baseUrl,
        timeoutMs: 15_000,
        accessToken: {
          header: "x-access-token",
          prefix: "Bearer ",
        },
      }),
    ],
  });
}

export async function fetchOrbPollVoters(
  pollPostId: string,
  accessToken?: string | null,
  limit = 25,
): Promise<OrbPollVotersData | null> {
  const sdk = createPollsSdk(getOrbPollsConfig());
  const result = await sdk.transport.call<OrbPollApiResponse<OrbPollVotersData>>(
    "/get-voters",
    { id: pollPostId, limit },
    accessToken?.trim() ? { accessToken: accessToken.trim() } : undefined,
  );

  if (result.status !== "SUCCESS" || !result.data) return null;
  return result.data;
}

export async function createOrbPollPost(
  body: OrbPollCreatePostRequest,
  accessToken: string,
): Promise<OrbPollCreatePostData | null> {
  const sdk = createPollsSdk(getOrbPollsConfig());
  const result = await sdk.transport.call<OrbPollApiResponse<OrbPollCreatePostData>>(
    "/create-post",
    body,
    { accessToken: accessToken.trim() },
  );

  if (result.status !== "SUCCESS" || !result.data) return null;
  return result.data;
}
