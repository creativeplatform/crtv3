import { createSDK } from "@orbclub/modules";
import { backendTransportPlugin } from "@orbclub/modules/transport/backend";
import type { OrbEventGamesResponse } from "@/lib/songchain/song-cup/orb-event-types";
import mockGames from "@/lib/songchain/song-cup/fixtures/orb-event-games-mock.json";

export type OrbEventGamesConfig = {
  baseUrl: string;
  gamesPath: string;
  eventId: string;
  serviceToken?: string;
  useMock?: boolean;
};

function readEnvFlag(value: string | undefined): boolean {
  return value === "true" || value === "1";
}

export function getOrbEventGamesConfig(): OrbEventGamesConfig {
  return {
    baseUrl: process.env.ORB_EVENT_API_BASE_URL?.trim() || "https://orbapi.xyz",
    gamesPath: process.env.ORB_EVENT_GAMES_PATH?.trim() || "/football/event/games",
    eventId: process.env.ORB_EVENT_ID?.trim() || "",
    serviceToken: process.env.ORB_EVENT_SERVICE_TOKEN?.trim(),
    useMock: readEnvFlag(process.env.ORB_EVENT_GAMES_MOCK),
  };
}

function createEventGamesSdk(config: OrbEventGamesConfig) {
  const plugins = [
    backendTransportPlugin({
      baseUrl: config.baseUrl,
      timeoutMs: 15_000,
      ...(config.serviceToken
        ? {
            serviceCredential: {
              header: "x-service-token",
              value: config.serviceToken,
            },
          }
        : {}),
      accessToken: {
        header: "authorization",
        prefix: "Bearer ",
      },
    }),
  ];

  return createSDK({ plugins });
}

export async function fetchOrbEventGames(
  accessToken?: string | null,
): Promise<OrbEventGamesResponse> {
  const config = getOrbEventGamesConfig();

  if (config.useMock || !config.eventId) {
    return mockGames as OrbEventGamesResponse;
  }

  const sdk = createEventGamesSdk(config);
  const path = config.gamesPath.startsWith("/")
    ? config.gamesPath
    : `/${config.gamesPath}`;

  const payload = {
    eventId: config.eventId,
    category: "games",
  };

  const result = await sdk.transport.call<OrbEventGamesResponse>(
    path,
    payload,
    accessToken?.trim() ? { accessToken: accessToken.trim() } : undefined,
  );

  return result;
}
