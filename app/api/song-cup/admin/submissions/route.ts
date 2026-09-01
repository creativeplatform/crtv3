import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireWalletAuth, WalletAuthError } from "@/lib/auth/require-wallet";
import { isSongCupAdminWallet } from "@/lib/songchain/song-cup/admin-config";
import { checkBotIdDeep } from "@/lib/middleware/botIdGuard";
import { rateLimiters } from "@/lib/middleware/rateLimit";
import {
  listSongCupSubmissionsAsAdmin,
  setSongCupSubmissionFavoriteAsAdmin,
  updateSongCupSubmissionStatusAsAdmin,
} from "@/lib/sdk/supabase/song-cup-admin";
import { serverLogger } from "@/lib/utils/logger";

/**
 * GET /api/song-cup/admin/submissions
 * Wallet-auth + admin-list check; returns all statuses via service role.
 */
export async function GET(req: NextRequest) {
  const verification = await checkBotIdDeep();
  if (verification.isBot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  const rl = await rateLimiters.standard(req);
  if (rl) return rl;

  try {
    const { address } = await requireWalletAuth(req);
    if (!isSongCupAdminWallet(address)) {
      return NextResponse.json({ error: "Admin wallet required" }, { status: 403 });
    }

    const submissions = await listSongCupSubmissionsAsAdmin();
    return NextResponse.json({ submissions });
  } catch (error) {
    if (error instanceof WalletAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    serverLogger.error("[song-cup/admin/submissions] GET failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list submissions" },
      { status: 500 },
    );
  }
}

const patchSchema = z
  .object({
    id: z.string().uuid(),
    status: z.enum(["pending", "approved", "rejected"]).optional(),
    is_favorite: z.boolean().optional(),
  })
  .refine((b) => b.status !== undefined || b.is_favorite !== undefined, {
    message: "Provide status and/or is_favorite",
  });

/**
 * PATCH /api/song-cup/admin/submissions
 * Approve/reject or favorite a submission (service role after wallet admin check).
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
    if (!isSongCupAdminWallet(address)) {
      return NextResponse.json({ error: "Admin wallet required" }, { status: 403 });
    }

    const json = await req.json();
    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { id, status, is_favorite } = parsed.data;

    if (is_favorite !== undefined) {
      const ok = await setSongCupSubmissionFavoriteAsAdmin(id, is_favorite);
      if (!ok) {
        return NextResponse.json({ error: "Failed to update favorite" }, { status: 500 });
      }
    }

    if (status !== undefined) {
      const ok = await updateSongCupSubmissionStatusAsAdmin(id, status);
      if (!ok) {
        return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof WalletAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    serverLogger.error("[song-cup/admin/submissions] PATCH failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update submission" },
      { status: 500 },
    );
  }
}
