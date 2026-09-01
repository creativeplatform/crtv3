import { Network } from "alchemy-sdk";
import { alchemyClient } from "@/lib/sdk/alchemy/alchemy-client";
import { BASE_TOKENS, type TokenSymbol } from "./swap-service";
import { serverLogger } from "@/lib/utils/logger";

export interface TokenPrice {
  symbol: TokenSymbol;
  price: number;
  lastUpdated: number;
}

const priceCache = new Map<TokenSymbol, TokenPrice>();
const CACHE_DURATION = 60000;

const FALLBACK_PRICES: Record<TokenSymbol, number> = {
  ETH: 3000,
  USDC: 1,
  DAI: 1,
  USDS: 1,
  GHO: 1,
};

/** Base canonical WETH — used as ETH price proxy when symbol lookup fails. */
const BASE_WETH_ADDRESS = "0x4200000000000000000000000000000000000006";

const ADDRESS_FALLBACK_SYMBOLS: TokenSymbol[] = [
  "USDC",
  "DAI",
  "USDS",
  "GHO",
];

const ADDRESS_TO_SYMBOL: Record<string, TokenSymbol> = Object.fromEntries(
  ADDRESS_FALLBACK_SYMBOLS.map((symbol) => [
    BASE_TOKENS[symbol].toLowerCase(),
    symbol,
  ])
) as Record<string, TokenSymbol>;

function isValidAddress(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function parseUsdPrice(
  prices: Array<{ currency: string; value: string }>
): number {
  const usd = prices.find((p) => p.currency.toLowerCase() === "usd");
  if (!usd) return 0;
  const value = parseFloat(usd.value);
  return Number.isFinite(value) ? value : 0;
}

function cachePrice(symbol: TokenSymbol, price: number): void {
  priceCache.set(symbol, {
    symbol,
    price,
    lastUpdated: Date.now(),
  });
}

export class PriceService {
  private static instance: PriceService;

  static getInstance(): PriceService {
    if (!PriceService.instance) {
      PriceService.instance = new PriceService();
    }
    return PriceService.instance;
  }

  async getTokenPrice(symbol: TokenSymbol): Promise<number> {
    const cached = priceCache.get(symbol);
    if (cached && Date.now() - cached.lastUpdated < CACHE_DURATION) {
      return cached.price;
    }

    try {
      const prices = await this.getTokenPrices([symbol]);
      return prices[symbol];
    } catch (error) {
      serverLogger.error(`Failed to fetch price for ${symbol}:`, error);
      if (cached) return cached.price;
      return FALLBACK_PRICES[symbol];
    }
  }

  private async fetchPricesBySymbol(
    symbols: TokenSymbol[]
  ): Promise<Partial<Record<TokenSymbol, number>>> {
    if (symbols.length === 0) return {};

    try {
      const response = await alchemyClient.prices.getTokenPriceBySymbol(symbols);
      const prices: Partial<Record<TokenSymbol, number>> = {};

      for (const result of response.data) {
        try {
          const symbol = result.symbol.toUpperCase() as TokenSymbol;
          if (result.error) {
            serverLogger.error(
              `Alchemy price error for ${symbol}:`,
              result.error.message
            );
            continue;
          }
          const price = parseUsdPrice(result.prices);
          if (price > 0) {
            prices[symbol] = price;
          }
        } catch (itemErr) {
          serverLogger.error('Failed to parse price result:', itemErr);
        }
      }

      return prices;
    } catch (batchErr) {
      serverLogger.error('Failed to fetch prices by symbol:', batchErr);
      return {};
    }
  }

  private async fetchPricesByAddress(
    symbols: TokenSymbol[]
  ): Promise<Partial<Record<TokenSymbol, number>>> {
    if (symbols.length === 0) return {};

    try {
      const response = await alchemyClient.prices.getTokenPriceByAddress(
        symbols
          .filter((symbol) => isValidAddress(BASE_TOKENS[symbol]))
          .map((symbol) => ({
            network: Network.BASE_MAINNET,
            address: BASE_TOKENS[symbol],
          }))
      );

      const prices: Partial<Record<TokenSymbol, number>> = {};

      for (const result of response.data) {
        try {
          if (!isValidAddress(result.address)) continue;
          const symbol = ADDRESS_TO_SYMBOL[result.address.toLowerCase()];
          if (!symbol) continue;

          if (result.error) {
            serverLogger.error(
              `Alchemy price error for ${symbol}:`,
              result.error.message
            );
            continue;
          }

          const price = parseUsdPrice(result.prices);
          if (price > 0) {
            prices[symbol] = price;
          }
        } catch (itemErr) {
          serverLogger.error('Failed to parse price result by address:', itemErr);
        }
      }

      return prices;
    } catch (batchErr) {
      serverLogger.error('Failed to fetch prices by address:', batchErr);
      return {};
    }
  }

  private async fetchEthPriceByWeth(): Promise<number | undefined> {
    try {
      const response = await alchemyClient.prices.getTokenPriceByAddress([
        {
          network: Network.BASE_MAINNET,
          address: BASE_WETH_ADDRESS,
        },
      ]);

      const result = response.data[0];
      if (!result || result.error) {
        if (result?.error) {
          serverLogger.error(
            "Alchemy WETH price error for ETH fallback:",
            result.error.message
          );
        }
        return undefined;
      }

      const price = parseUsdPrice(result.prices);
      return price > 0 ? price : undefined;
    } catch (batchErr) {
      serverLogger.error('Failed to fetch WETH price for ETH fallback:', batchErr);
      return undefined;
    }
  }

  async getTokenPrices(
    symbols: TokenSymbol[]
  ): Promise<Record<TokenSymbol, number>> {
    const prices = {} as Record<TokenSymbol, number>;
    const uncachedSymbols: TokenSymbol[] = [];

    for (const symbol of symbols) {
      const cached = priceCache.get(symbol);
      if (cached && Date.now() - cached.lastUpdated < CACHE_DURATION) {
        prices[symbol] = cached.price;
      } else {
        uncachedSymbols.push(symbol);
      }
    }

    if (uncachedSymbols.length === 0) return prices;

    try {
      const symbolPrices = await this.fetchPricesBySymbol(uncachedSymbols);
      let missingSymbols = uncachedSymbols.filter(
        (symbol) => symbolPrices[symbol] === undefined
      );

      if (missingSymbols.includes("ETH")) {
        const ethPrice = await this.fetchEthPriceByWeth();
        if (ethPrice !== undefined) {
          symbolPrices.ETH = ethPrice;
          missingSymbols = missingSymbols.filter((symbol) => symbol !== "ETH");
        }
      }

      const addressPrices =
        missingSymbols.length > 0
          ? await this.fetchPricesByAddress(
              missingSymbols.filter((symbol) => symbol !== "ETH")
            )
          : {};

      for (const symbol of uncachedSymbols) {
        const apiPrice = symbolPrices[symbol] ?? addressPrices[symbol];

        const price =
          apiPrice ??
          priceCache.get(symbol)?.price ??
          FALLBACK_PRICES[symbol];

        prices[symbol] = price;

        if (apiPrice !== undefined) {
          cachePrice(symbol, apiPrice);
        }
      }
    } catch (error) {
      serverLogger.error("Failed to fetch Alchemy token prices:", error);

      for (const symbol of uncachedSymbols) {
        prices[symbol] =
          priceCache.get(symbol)?.price ?? FALLBACK_PRICES[symbol];
      }
    }

    return prices;
  }

  async convertToUSD(amount: number, symbol: TokenSymbol): Promise<number> {
    const price = await this.getTokenPrice(symbol);
    return amount * price;
  }

  async convertFromUSD(usdAmount: number, symbol: TokenSymbol): Promise<number> {
    const price = await this.getTokenPrice(symbol);
    return usdAmount / price;
  }

  static formatUSD(amount: number): string {
    if (amount < 0.01) {
      return "< $0.01";
    }
    if (amount < 1) {
      return `$${amount.toFixed(4)}`;
    }
    if (amount < 100) {
      return `$${amount.toFixed(2)}`;
    }
    if (amount < 1000) {
      return `$${amount.toFixed(2)}`;
    }
    if (amount < 1000000) {
      return `$${(amount / 1000).toFixed(1)}K`;
    }
    return `$${(amount / 1000000).toFixed(1)}M`;
  }

  static formatTokenWithUSD(
    amount: number,
    symbol: TokenSymbol,
    usdValue: number
  ): string {
    const formattedAmount = amount.toFixed(6).replace(/\.?0+$/, "");
    const formattedUSD = PriceService.formatUSD(usdValue);
    return `${formattedAmount} ${symbol} (${formattedUSD})`;
  }
}

export const priceService = PriceService.getInstance();
