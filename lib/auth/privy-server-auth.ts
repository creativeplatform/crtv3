import { NextRequest } from "next/server";
import { getPrivyClient } from "@/lib/sdk/privy/client";
import {
  isEmbeddedWalletLinkedAccount,
  type User,
} from "@privy-io/node";
import {
  resolveEmbeddedEthereumWallet,
  type ResolvedEmbeddedWallet,
} from "@/lib/sdk/privy/wallet-resolver";

export type PrivyAuthContext = {
  userId: string;
  accessToken: string;
  user: User;
  embeddedWallet: ResolvedEmbeddedWallet;
};

function extractBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

export async function requirePrivyAuth(
  request: NextRequest,
): Promise<PrivyAuthContext | Response> {
  const accessToken = extractBearerToken(request);
  if (!accessToken) {
    return new Response(JSON.stringify({ error: "Missing authorization token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const privy = getPrivyClient();
    const claims = await privy.utils().auth().verifyAccessToken(accessToken);
    const user = await privy.users()._get(claims.user_id);

    const embeddedWallet = resolveEmbeddedEthereumWallet(user);
    if (!embeddedWallet) {
      return new Response(
        JSON.stringify({ error: "No embedded wallet found for user" }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    return {
      userId: claims.user_id,
      accessToken,
      user,
      embeddedWallet,
    };
  } catch {
    return new Response(JSON.stringify({ error: "Invalid authorization token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export function getEmbeddedWalletAddress(user: User): string | null {
  for (const account of user.linked_accounts ?? []) {
    if (
      isEmbeddedWalletLinkedAccount(account) &&
      account.chain_type === "ethereum"
    ) {
      return account.address;
    }
  }
  return null;
}
