import { NextRequest, NextResponse } from "next/server";
import { requirePrivyAuth } from "@/lib/auth/privy-server-auth";
import { isEarnConfigured } from "@/lib/sdk/privy/config";
import { depositToVault } from "@/lib/sdk/privy/earn";
import { getErc20Balance } from "@/lib/viem";
import { USDC_TOKEN_ADDRESSES, USDC_TOKEN_DECIMALS } from "@/lib/contracts/USDCToken";
import { parseUnits } from "viem";
import type { Address } from "viem";

export async function POST(request: NextRequest) {
  if (!isEarnConfigured()) {
    return NextResponse.json(
      { error: "Earn is not configured" },
      { status: 503 },
    );
  }

  const auth = await requirePrivyAuth(request);
  if (auth instanceof Response) return auth;

  let amount: string;
  try {
    const body = await request.json();
    amount = String(body.amount ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!amount || Number.parseFloat(amount) <= 0) {
    return NextResponse.json(
      { error: "Amount must be greater than zero" },
      { status: 400 },
    );
  }

  try {
    const required = parseUnits(amount, USDC_TOKEN_DECIMALS);
    const balance = await getErc20Balance({
      token: USDC_TOKEN_ADDRESSES.base as Address,
      owner: auth.embeddedWallet.address as Address,
    });

    if (balance < required) {
      return NextResponse.json(
        {
          error:
            "Insufficient USDC in embedded wallet. Earn uses your embedded wallet — transfer USDC via Send first.",
        },
        { status: 400 },
      );
    }

    const action = await depositToVault(
      auth.embeddedWallet.walletId,
      amount,
      auth.accessToken,
    );

    return NextResponse.json({
      action: {
        id: action.id,
        status: action.status,
        type: action.type,
      },
      walletId: auth.embeddedWallet.walletId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to deposit to vault";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
