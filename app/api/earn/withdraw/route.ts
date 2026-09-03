import { NextRequest, NextResponse } from "next/server";
import { requirePrivyAuth } from "@/lib/auth/privy-server-auth";
import { isEarnConfigured } from "@/lib/sdk/privy/config";
import {
  fetchVaultPosition,
  withdrawAllFromVault,
  withdrawFromVault,
} from "@/lib/sdk/privy/earn";

export async function POST(request: NextRequest) {
  if (!isEarnConfigured()) {
    return NextResponse.json(
      { error: "Earn is not configured" },
      { status: 503 },
    );
  }

  const auth = await requirePrivyAuth(request);
  if (auth instanceof Response) return auth;

  let amount: string | undefined;
  let withdrawAll = false;
  try {
    const body = await request.json();
    withdrawAll = Boolean(body.withdrawAll);
    amount = body.amount != null ? String(body.amount).trim() : undefined;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!withdrawAll && (!amount || Number.parseFloat(amount) <= 0)) {
    return NextResponse.json(
      { error: "Amount must be greater than zero" },
      { status: 400 },
    );
  }

  try {
    const walletId = auth.embeddedWallet.walletId;

    let action;
    if (withdrawAll) {
      const position = await fetchVaultPosition(walletId);
      if (BigInt(position.assetsInVault) <= 0n) {
        return NextResponse.json(
          { error: "No assets available to withdraw" },
          { status: 400 },
        );
      }
      action = await withdrawAllFromVault(
        walletId,
        position.assetsInVault,
        auth.accessToken,
      );
    } else {
      action = await withdrawFromVault(
        walletId,
        amount!,
        auth.accessToken,
      );
    }

    return NextResponse.json({
      action: {
        id: action.id,
        status: action.status,
        type: action.type,
      },
      walletId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to withdraw from vault";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
