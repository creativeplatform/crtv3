import { createPublicClient, erc20Abi, formatEther, getAddress, parseEther } from "viem";
import { alchemy, base } from "@account-kit/infra";
import { createServiceClient } from "@/lib/sdk/supabase/service";

const publicClient = createPublicClient({
  chain: base,
  transport: alchemy({
    apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY as string,
  }),
});

export type MeTokenAccessDenyReason =
  | "no_metoken"
  | "insufficient_balance"
  | "no_viewer_address";

export interface MeTokenAccessResult {
  allowed: boolean;
  meTokenAddress?: string;
  symbol?: string;
  name?: string;
  balance?: bigint;
  required?: bigint;
  requiredFormatted?: string;
  balanceFormatted?: string;
  reason?: MeTokenAccessDenyReason | "creator_bypass";
}

async function getMeTokenByOwner(ownerAddress: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("metokens")
    .select("address, symbol, name, owner_address")
    .eq("owner_address", ownerAddress.toLowerCase())
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch MeToken: ${error.message}`);
  }

  return data;
}

function normalizeAddresses(addresses: (string | undefined | null)[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const addr of addresses) {
    if (!addr) continue;
    const lower = addr.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    result.push(lower);
  }

  return result;
}

export async function checkMeTokenAccess(params: {
  viewerAddresses: (string | undefined | null)[];
  creatorAddress: string;
  requiredAmount: number | string | null;
  bypassForCreator?: boolean;
}): Promise<MeTokenAccessResult> {
  const {
    viewerAddresses,
    creatorAddress,
    requiredAmount,
    bypassForCreator = true,
  } = params;

  const normalizedCreator = creatorAddress.toLowerCase();
  const normalizedViewers = normalizeAddresses(viewerAddresses);

  if (
    bypassForCreator &&
    normalizedViewers.some((viewer) => viewer === normalizedCreator)
  ) {
    return { allowed: true, reason: "creator_bypass" };
  }

  const required = parseEther(String(requiredAmount ?? 0));
  const meToken = await getMeTokenByOwner(normalizedCreator);

  if (!meToken?.address) {
    return { allowed: false, reason: "no_metoken" };
  }

  const baseResult = {
    meTokenAddress: meToken.address,
    symbol: meToken.symbol,
    name: meToken.name,
    required,
    requiredFormatted: formatEther(required),
  };

  if (normalizedViewers.length === 0) {
    return {
      allowed: false,
      reason: "no_viewer_address",
      ...baseResult,
    };
  }

  let maxBalance = BigInt(0);
  for (const viewer of normalizedViewers) {
    try {
      const balance = await publicClient.readContract({
        address: meToken.address as `0x${string}`,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [getAddress(viewer)],
      });
      if (balance > maxBalance) {
        maxBalance = balance;
      }
    } catch {
      // Skip unreadable addresses
    }
  }

  const allowed = maxBalance >= required;

  return {
    allowed,
    ...baseResult,
    balance: maxBalance,
    balanceFormatted: formatEther(maxBalance),
    reason: allowed ? undefined : "insufficient_balance",
  };
}

export function isMeTokenGateActive(
  requiresMetoken?: boolean | null,
  metokenPrice?: number | string | null,
): boolean {
  return Boolean(requiresMetoken) && metokenPrice !== null && metokenPrice !== undefined;
}
