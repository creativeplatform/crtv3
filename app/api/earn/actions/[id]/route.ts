import { NextRequest, NextResponse } from "next/server";
import { requirePrivyAuth } from "@/lib/auth/privy-server-auth";
import { isEarnConfigured } from "@/lib/sdk/privy/config";
import { fetchWalletAction } from "@/lib/sdk/privy/earn";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isEarnConfigured()) {
    return NextResponse.json(
      { error: "Earn is not configured" },
      { status: 503 },
    );
  }

  const auth = await requirePrivyAuth(request);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const walletId =
    request.nextUrl.searchParams.get("walletId") ??
    auth.embeddedWallet.walletId;

  if (!id) {
    return NextResponse.json({ error: "Missing action id" }, { status: 400 });
  }

  try {
    const action = await fetchWalletAction(walletId, id);
    return NextResponse.json({
      action: {
        id: action.id,
        status: action.status,
        type: action.type,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch action status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
