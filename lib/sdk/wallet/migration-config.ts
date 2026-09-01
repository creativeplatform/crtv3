import { createMigrationConfig } from "@privy-io/alchemy-migration";
import { alchemy, base } from "@account-kit/infra";

const migrationRedirectUrl =
  process.env.NEXT_PUBLIC_URL ??
  (process.env.NEXT_PUBLIC_VERCEL_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
    : "http://localhost:3000");

export const alchemyMigrationConfig = createMigrationConfig(
  {
    transport: alchemy({
      apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY!,
    }),
    chain: base,
    ssr: true,
  } as never,
  {
    auth: {
      sections: [
        [{ type: "email", emailMode: "otp" }, { type: "passkey" }],
        [
          {
            type: "social",
            authProviderId: "google",
            mode: "redirect",
            redirectUrl: migrationRedirectUrl,
          },
          {
            type: "social",
            authProviderId: "twitch",
            mode: "redirect",
            redirectUrl: migrationRedirectUrl,
          },
        ],
      ],
    },
  },
);
