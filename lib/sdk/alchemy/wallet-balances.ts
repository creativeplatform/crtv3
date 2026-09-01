import { alchemyClient } from "@/lib/sdk/alchemy/alchemy-client";
import {
  BASE_TOKENS,
  type TokenSymbol,
} from "@/lib/sdk/alchemy/swap-service";
import { logger } from "@/lib/utils/logger";

export type WalletTokenBalances = Record<TokenSymbol, bigint | null>;

const EMPTY_BALANCES: WalletTokenBalances = {
  ETH: null,
  USDC: null,
  DAI: null,
  USDS: null,
  GHO: null,
};

const ERC20_SYMBOLS = ["USDC", "DAI", "USDS", "GHO"] as const;

const CONTRACT_TO_SYMBOL = Object.fromEntries(
  ERC20_SYMBOLS.map((symbol) => [BASE_TOKENS[symbol].toLowerCase(), symbol])
) as Record<string, (typeof ERC20_SYMBOLS)[number]>;

function hexBalanceToBigInt(hex: string | null | undefined): bigint {
  if (!hex || hex === "0x" || hex === "0x0") return 0n;
  return BigInt(hex);
}

/**
 * Fetch ETH + known stablecoin balances via Alchemy Token API.
 * Partial failures return whatever balances could be fetched.
 */
export async function fetchWalletTokenBalances(
  address: string
): Promise<WalletTokenBalances> {
  const nextBalances: WalletTokenBalances = { ...EMPTY_BALANCES };
  const erc20Addresses = ERC20_SYMBOLS.map((symbol) => BASE_TOKENS[symbol]);

  const [ethResult, tokenResult] = await Promise.allSettled([
    alchemyClient.core.getBalance(address),
    alchemyClient.core.getTokenBalances(address, erc20Addresses),
  ]);

  if (ethResult.status === "fulfilled") {
    nextBalances.ETH = BigInt(ethResult.value.toString());
  } else {
    logger.error("Error fetching ETH balance:", ethResult.reason);
  }

  if (tokenResult.status === "fulfilled") {
    for (const entry of tokenResult.value.tokenBalances ?? []) {
      if (entry.error) {
        logger.error(
          `Alchemy token balance error for ${entry.contractAddress}:`,
          entry.error
        );
        continue;
      }

      const symbol = CONTRACT_TO_SYMBOL[entry.contractAddress.toLowerCase()];
      if (!symbol) continue;

      nextBalances[symbol] = hexBalanceToBigInt(entry.tokenBalance);
    }
  } else {
    logger.error("Error fetching ERC-20 balances:", tokenResult.reason);
  }

  return nextBalances;
}
