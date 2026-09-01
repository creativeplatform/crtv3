import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireWalletAuth, WalletAuthError } from "@/lib/auth/require-wallet";
import { isHackBetaAdminWallet } from "@/lib/chones/hack-beta/admin-config";
import { checkBotIdDeep } from "@/lib/middleware/botIdGuard";
import { rateLimiters } from "@/lib/middleware/rateLimit";
import { updateHackBetaMixtapeUrlAsAdmin } from "@/lib/sdk/supabase/hack-beta-admin";
import { serverLogger } from "@/lib/utils/logger";

const bodySchema = z.object({
  mixtape_playlist_url: z.string().nullable(),
});

/**
 * PATCH /api/hack-beta/admin/settings — update mixtape URL (admin + service role).
 */
export async function PATCH(req: NextRequest) {
  const verification = await checkBotIdDeep();
  if (verification.isBot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  const rl = await rateLimiters.standard(req);
  if (rl) return rl;

  try {
    const { address } = await requireWalletAuth(req);
    if (!isHackBetaAdminWallet(address)) {
      return NextResponse.json({ error: "Admin wallet required" }, { status: 403 });
    }

    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const settings = await updateHackBetaMixtapeUrlAsAdmin(
      parsed.data.mixtape_playlist_url,
      address,
    );
    if (!settings) {
      return NextResponse.json({ error: "Failed to save mixtape URL" }, { status: 500 });
    }

    return NextResponse.json({ settings });
  } catch (error) {
    if (error instanceof WalletAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    serverLogger.error("[hack-beta/admin/settings] PATCH failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update settings" },
      { status: 500 },
    );
  }
}
