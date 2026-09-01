import { afterEach, describe, expect, it, vi } from "vitest";
import { isAddress, getAddress } from "viem";
import {
  AlchemySwapService,
  BASE_TOKENS,
  SWAP_UI_TOKENS,
  TOKEN_INFO,
  type TokenSymbol,
  emptyTokenBalances,
  emptyTokenPrices,
} from "./swap-service";
import { USDS_TOKEN_ADDRESSES } from "@/lib/contracts/USDSToken";
import { GHO_TOKEN_ADDRESSES } from "@/lib/contracts/GHOToken";

/** Canonical Base mainnet addresses used by the swap UI. */
const EXPECTED_BASE_ADDRESSES: Record<TokenSymbol, string> = {
  ETH: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEee",
  USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  DAI: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
  USDS: USDS_TOKEN_ADDRESSES.base,
  GHO: GHO_TOKEN_ADDRESSES.base,
};

describe("Alchemy swap token wiring", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("exposes ETH, USDC, USDS, DAI, and GHO in the swap UI list", () => {
    expect(SWAP_UI_TOKENS).toEqual(
      expect.arrayContaining(["ETH", "USDC", "USDS", "DAI", "GHO"]),
    );
    expect(SWAP_UI_TOKENS).toHaveLength(5);
    expect(new Set(SWAP_UI_TOKENS).size).toBe(5);
  });

  it("maps every UI token to a valid Base address used by Alchemy quotes", () => {
    for (const symbol of SWAP_UI_TOKENS) {
      const address = BASE_TOKENS[symbol];
      // Native ETH uses Alchemy's sentinel address (not a checksummed EOA/contract).
      if (symbol === "ETH") {
        expect(address.toLowerCase()).toBe(
          "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        );
      } else {
        expect(isAddress(address), `${symbol} address invalid`).toBe(true);
        expect(() => getAddress(address as `0x${string}`)).not.toThrow();
      }
      expect(address.toLowerCase()).toBe(
        EXPECTED_BASE_ADDRESSES[symbol].toLowerCase(),
      );
    }
  });

  it("uses correct decimals for amount encoding", () => {
    expect(TOKEN_INFO.ETH.decimals).toBe(18);
    expect(TOKEN_INFO.USDC.decimals).toBe(6);
    expect(TOKEN_INFO.DAI.decimals).toBe(18);
    expect(TOKEN_INFO.USDS.decimals).toBe(18);
    expect(TOKEN_INFO.GHO.decimals).toBe(18);
  });

  it("formats and parses amounts for every swap UI token", () => {
    for (const symbol of SWAP_UI_TOKENS) {
      const hex = AlchemySwapService.formatAmount("1.5", symbol);
      expect(hex.startsWith("0x")).toBe(true);
      const parsed = AlchemySwapService.parseAmount(hex, symbol);
      expect(Number(parsed)).toBeCloseTo(1.5, 5);
    }

    // USDC 6-decimal edge: 1 USDC = 1e6
    expect(AlchemySwapService.formatAmount("1", "USDC")).toBe("0xf4240");
  });

  it("empty balance/price helpers cover every UI token", () => {
    const balances = emptyTokenBalances();
    const prices = emptyTokenPrices();
    for (const symbol of SWAP_UI_TOKENS) {
      expect(balances[symbol]).toBe("0");
      expect(prices[symbol]).toBe(0);
    }
  });

  it("requestSwapQuote rejects same-token and missing API key", async () => {
    const noKey = new AlchemySwapService("");
    await expect(
      noKey.requestSwapQuote({
        from: "0x1111111111111111111111111111111111111111",
        fromToken: "ETH",
        toToken: "USDC",
        fromAmount: "0xde0b6b3a7640000",
      }),
    ).rejects.toThrow(/API key/i);

    const svc = new AlchemySwapService("test-key");
    await expect(
      svc.requestSwapQuote({
        from: "0x1111111111111111111111111111111111111111",
        fromToken: "USDC",
        toToken: "USDC",
        fromAmount: "0xf4240",
      }),
    ).rejects.toThrow(/Cannot swap token to itself/);
  });

  it("requestSwapQuote sends Base token addresses for every directed UI pair", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        method: string;
        params: Array<{
          fromToken: string;
          toToken: string;
          fromAmount: string;
          chainId: string;
        }>;
      };
      expect(body.method).toBe("wallet_requestQuote_v0");
      expect(body.params[0].chainId).toBe("0x2105");

      return Response.json({
        id: 1,
        jsonrpc: "2.0",
        result: {
          quote: { minimumToAmount: "0x1", expiry: "0x1" },
          type: "prepared",
          data: {},
          signatureRequest: {
            type: "secp256k1",
            data: { raw: "0x" },
            rawPayload: "0x",
          },
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const svc = new AlchemySwapService("test-alchemy-key");
    const from = "0x1111111111111111111111111111111111111111" as const;

    for (const fromToken of SWAP_UI_TOKENS) {
      for (const toToken of SWAP_UI_TOKENS) {
        if (fromToken === toToken) continue;

        await svc.requestSwapQuote({
          from,
          fromToken,
          toToken,
          fromAmount: AlchemySwapService.formatAmount("1", fromToken),
        });

        const lastCall = fetchMock.mock.calls.at(-1);
        const body = JSON.parse(String(lastCall?.[1]?.body)) as {
          params: Array<{ fromToken: string; toToken: string }>;
        };
        expect(body.params[0].fromToken.toLowerCase()).toBe(
          BASE_TOKENS[fromToken].toLowerCase(),
        );
        expect(body.params[0].toToken.toLowerCase()).toBe(
          BASE_TOKENS[toToken].toLowerCase(),
        );
      }
    }

    // 5 tokens → 5*4 = 20 directed pairs
    expect(fetchMock).toHaveBeenCalledTimes(20);
  });

  it("requestSwapQuote surfaces a successful quote result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          id: 1,
          jsonrpc: "2.0",
          result: {
            quote: {
              minimumToAmount: "0xf4240",
              expiry: "0x64",
              fromAmount: "0xde0b6b3a7640000",
            },
            type: "prepared",
            data: { calls: [] },
            signatureRequest: {
              type: "secp256k1",
              data: { raw: "0xabc" },
              rawPayload: "0xabc",
            },
            feePayment: { sponsored: true },
          },
        }),
      ),
    );

    const svc = new AlchemySwapService("test-alchemy-key");
    const result = await svc.requestSwapQuote({
      from: "0x1111111111111111111111111111111111111111",
      fromToken: "ETH",
      toToken: "GHO",
      fromAmount: AlchemySwapService.formatAmount("0.01", "ETH"),
    });

    expect(result.result?.quote.minimumToAmount).toBe("0xf4240");
    expect(result.result?.feePayment?.sponsored).toBe(true);
    expect(result.error).toBeUndefined();
  });
});
