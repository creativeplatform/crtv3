import { NextRequest, NextResponse } from "next/server";
import { requirePrivyAuth } from "@/lib/auth/privy-server-auth";
import { isEarnConfigured } from "@/lib/sdk/privy/config";
import { fetchVaultPosition } from "@/lib/sdk/privy/earn";
import { getErc20Balance } from "@/lib/viem";
import { USDC_TOKEN_ADDRESSES } from "@/lib/contracts/USDCToken";
import type { Address } from "viem";

export async function GET(request: NextRequest) {
  if (!isEarnConfigured()) {
    return NextResponse.json(
      { error: "Earn is not configured" },
      { status: 503 },
    );
  }

  const auth = await requirePrivyAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const [position, embeddedUsdcBalance] = await Promise.all([
      fetchVaultPosition(auth.embeddedWallet.walletId),
      getErc20Balance({
        token: USDC_TOKEN_ADDRESSES.base as Address,
        owner: auth.embeddedWallet.address as Address,
      }),
    ]);

    return NextResponse.json({
      position,
      embeddedWallet: {
        walletId: auth.embeddedWallet.walletId,
        address: auth.embeddedWallet.address,
        usdcBalance: embeddedUsdcBalance.toString(),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch earn position";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
