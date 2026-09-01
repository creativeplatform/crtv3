import { checkBotId } from "botid/server";
import { NextResponse } from "next/server";
import { serverLogger } from "@/lib/utils/logger";

export const BOTID_DENIED_CODE = "BOTID_DENIED" as const;

/** Must match Vercel Firewall → BotID → Deep Analysis and instrumentation-client.ts. */
export const BOTID_DEEP_ANALYSIS_OPTIONS = {
  advancedOptions: { checkLevel: "deepAnalysis" as const },
} satisfies NonNullable<Parameters<typeof checkBotId>[0]>;

export type BotIdGuardResult =
  | { allowed: true }
  | { allowed: false; response: NextResponse };

/** Server-side BotID check using Deep Analysis (Kasada). */
export async function checkBotIdDeep() {
  return checkBotId(BOTID_DEEP_ANALYSIS_OPTIONS);
}

/**
 * Run BotID verification. Blocks unverified bots; allows humans and verified bots.
 */
export async function requireHumanOrVerifiedBot(
  context?: string,
): Promise<BotIdGuardResult> {
  const verification = await checkBotIdDeep();

  if (verification.isBot && !verification.isVerifiedBot) {
    serverLogger.warn("[botIdGuard] access denied", {
      context,
      isBot: verification.isBot,
      isVerifiedBot: verification.isVerifiedBot,
    });

    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: "Access denied",
          code: BOTID_DENIED_CODE,
        },
        { status: 403 },
      ),
    };
  }

  return { allowed: true };
}
