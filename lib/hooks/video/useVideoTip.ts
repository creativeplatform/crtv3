"use client";

import { useState, useCallback, useEffect } from "react";
import { useSmartAccountClient } from "@/lib/wallet/react";
import { type Address, type Hex, encodeFunctionData, parseAbi, parseUnits, formatUnits } from "viem";
import { getEthBalance, getErc20Balance } from "@/lib/viem";
import { USDC_TOKEN_ADDRESSES, USDC_TOKEN_DECIMALS } from "@/lib/contracts/USDCToken";
import { useGasSponsorship } from "@/lib/hooks/wallet/useGasSponsorship";
import { DAI_TOKEN_ADDRESSES, DAI_TOKEN_DECIMALS } from "@/lib/contracts/DAIToken";
import { USDS_TOKEN_ADDRESSES, USDS_TOKEN_DECIMALS } from "@/lib/contracts/USDSToken";
import { GHO_TOKEN_ADDRESSES, GHO_TOKEN_DECIMALS } from "@/lib/contracts/GHOToken";
import { SWAP_UI_TOKENS, BASE_TOKENS, type TokenSymbol as SwapTokenSymbol } from "@/lib/sdk/alchemy/swap-service";
import { priceService } from "@/lib/sdk/alchemy/price-service";
import { toast } from "sonner";
import { logger } from '@/lib/utils/logger';
import { meTokenSupabaseService } from '@/lib/sdk/supabase/metokens';
import { appendBuilderCode } from "@/lib/utils/builder-code";


export type TokenSymbol = SwapTokenSymbol | `metoken:${string}`;

export interface MeTokenInfo {
  address: string;
  symbol: string;
  name?: string;
  decimals?: number;
}

interface TokenConfig {
  decimals: number;
  symbol: string;
  address: string | null;
}

const NATIVE_TOKEN_INFO: Record<'ETH', TokenConfig> = {
  ETH: {
    decimals: 18,
    symbol: "ETH",
    address: null,
  },
};

const ERC20_TOKEN_INFO: Record<Exclude<SwapTokenSymbol, 'ETH'>, TokenConfig> = {
  USDC: {
    decimals: USDC_TOKEN_DECIMALS,
    symbol: "USDC",
    address: USDC_TOKEN_ADDRESSES.base,
  },
  DAI: {
    decimals: DAI_TOKEN_DECIMALS,
    symbol: "DAI",
    address: DAI_TOKEN_ADDRESSES.base,
  },
  USDS: {
    decimals: USDS_TOKEN_DECIMALS,
    symbol: "USDS",
    address: USDS_TOKEN_ADDRESSES.base,
  },
  GHO: {
    decimals: GHO_TOKEN_DECIMALS,
    symbol: "GHO",
    address: GHO_TOKEN_ADDRESSES.base,
  },
};

export const TIP_TOKEN_OPTIONS: TokenSymbol[] = [...SWAP_UI_TOKENS];

function isMeTokenSymbol(token: TokenSymbol): token is `metoken:${string}` {
  return token.startsWith('metoken:');
}

function isAddressLike(value: string): boolean {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function parseMeTokenSymbol(token: TokenSymbol): { address: string } | null {
  if (!isMeTokenSymbol(token)) return null;
  const address = token.slice('metoken:'.length);
  if (!isAddressLike(address)) return null;
  return { address };
}

function getTokenConfig(token: TokenSymbol, meToken?: MeTokenInfo | null): TokenConfig {
  if (isMeTokenSymbol(token)) {
    const parsed = parseMeTokenSymbol(token);
    return {
      decimals: meToken?.decimals ?? 18,
      symbol: meToken?.symbol ?? 'MeToken',
      address: parsed?.address ?? null,
    };
  }
  if (token === 'ETH') return NATIVE_TOKEN_INFO[token];
  return ERC20_TOKEN_INFO[token];
}

function validateTipToken(token: TokenSymbol, meToken?: MeTokenInfo | null): TokenConfig | null {
  const config = getTokenConfig(token, meToken);
  if (isMeTokenSymbol(token)) {
    const parsed = parseMeTokenSymbol(token);
    if (!parsed || !isAddressLike(parsed.address)) return null;
    // Accept any well-formed metoken address; a specific creator meToken can be
    // passed in for display/decimals, but we no longer block tipping a creator
    // meToken that the user holds just because it doesn't match a single address.
  }
  return config;
}

export interface TipResult {
  txHash: string;
  amount: string;
  token: TokenSymbol;
}

export interface UseVideoTipReturn {
  sendTip: (amount: string, token: TokenSymbol, creatorAddress: string, meToken?: MeTokenInfo | null) => Promise<TipResult | null>;
  isTipping: boolean;
  error: Error | null;
  balances: Record<TokenSymbol, string>;
  heldMeTokens: MeTokenInfo[];
  fetchBalances: (meToken?: MeTokenInfo | null) => Promise<void>;
  getUsdValue: (amount: string, token: TokenSymbol, meToken?: MeTokenInfo | null) => Promise<number>;
  isLoadingPrice: boolean;
}

/**
 * Hook for sending tips to video creators
 * Supports ETH, USDC, DAI, USDS, GHO, and creator meTokens
 */
export function useVideoTip(): UseVideoTipReturn {
  const [isTipping, setIsTipping] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [balances, setBalances] = useState<Record<TokenSymbol, string>>({
    ETH: '0',
    USDC: '0',
    DAI: '0',
    USDS: '0',
    GHO: '0',
  });
  const [heldMeTokens, setHeldMeTokens] = useState<MeTokenInfo[]>([]);
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);
  const [prices, setPrices] = useState<Partial<Record<SwapTokenSymbol, number>>>({});

  const { address, client } = useSmartAccountClient({});
  const { getGasContext } = useGasSponsorship();

  // Fetch token prices
  const fetchPrices = useCallback(async () => {
    try {
      const tokenPrices = await priceService.getTokenPrices([...SWAP_UI_TOKENS]);
      setPrices(tokenPrices);
    } catch (err) {
      logger.error("Error fetching token prices:", err);
    }
  }, []);

  // Fetch token balances
  const fetchBalances = useCallback(async (meToken?: MeTokenInfo | null) => {
    if (!address) return;

    try {
      // Get ETH balance via public client (smart-account client is write-only)
      const ethBalance = await getEthBalance(address as Address);

      // Get ERC-20 balances for known tokens in parallel
      const newBalances: Record<TokenSymbol, string> = {
        ETH: formatUnits(ethBalance, 18),
        USDC: '0',
        DAI: '0',
        USDS: '0',
        GHO: '0',
      };

      const balanceResults = await Promise.all(
        (Object.keys(ERC20_TOKEN_INFO) as Array<Exclude<SwapTokenSymbol, 'ETH'>>).map(async (symbol) => {
          try {
            const info = ERC20_TOKEN_INFO[symbol];
            const balance = await getErc20Balance({
              token: info.address as Address,
              owner: address as Address,
            });
            return { symbol, balance: formatUnits(balance, info.decimals) };
          } catch (err) {
            logger.debug(`Failed to fetch ${symbol} balance:`, err);
            return { symbol, balance: '0' };
          }
        })
      );
      balanceResults.forEach(({ symbol, balance }) => {
        newBalances[symbol] = balance;
      });

      // Get creator meToken balance if provided (single-creator mode)
      if (meToken?.address) {
        try {
          const balance = await getErc20Balance({
            token: meToken.address as Address,
            owner: address as Address,
          });
          newBalances[`metoken:${meToken.address}` as TokenSymbol] = formatUnits(balance, meToken.decimals ?? 18);
        } catch (err) {
          logger.debug('Failed to fetch meToken balance:', err);
          newBalances[`metoken:${meToken.address}` as TokenSymbol] = '0';
        }
      }

      // Discover any creator meTokens this wallet holds across the registry
      try {
        const registryTokens = await meTokenSupabaseService.getAllMeTokens({ limit: 500 });
        const held: MeTokenInfo[] = [];
        await Promise.all(
          registryTokens.map(async (token) => {
            try {
              const balance = await getErc20Balance({
                token: token.address as Address,
                owner: address as Address,
              });
              const balanceFormatted = formatUnits(BigInt(balance), 18);
              const key = `metoken:${token.address.toLowerCase()}` as TokenSymbol;
              newBalances[key] = balanceFormatted;
              if (BigInt(balance) > 0n) {
                held.push({
                  address: token.address,
                  symbol: token.symbol,
                  decimals: 18,
                });
              }
            } catch (err) {
              logger.debug(`Failed to fetch balance for meToken ${token.address}:`, err);
            }
          })
        );
        setHeldMeTokens(held);
      } catch (err) {
        logger.debug('Failed to discover held meTokens:', err);
      }

      setBalances(newBalances);
    } catch (err) {
      logger.error("Error fetching balances:", err);
    }
  }, [address]);

  const getUsdValue = useCallback(async (amount: string, token: TokenSymbol, meToken?: MeTokenInfo | null): Promise<number> => {
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) return 0;

    if (isMeTokenSymbol(token)) {
      // meTokens are stablecoin-backed; approximate $1 unless a real price is provided
      return amountNum;
    }

    try {
      const price = await priceService.getTokenPrice(token as SwapTokenSymbol);
      return amountNum * price;
    } catch (err) {
      logger.error("Failed to compute USD value:", err);
      return 0;
    }
  }, []);

  // Send tip to creator
  const sendTip = useCallback(
    async (amount: string, token: TokenSymbol, creatorAddress: string, meToken?: MeTokenInfo | null): Promise<TipResult | null> => {
      if (!client || !address) {
        setError(new Error("Wallet not connected"));
        return null;
      }

      // Validate creator address
      if (!creatorAddress || !creatorAddress.startsWith("0x")) {
        setError(new Error("Invalid creator address"));
        return null;
      }

      // Prevent self-tipping
      if (creatorAddress.toLowerCase() === address.toLowerCase()) {
        setError(new Error("You cannot tip yourself"));
        return null;
      }

      // Validate amount
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        setError(new Error("Invalid amount"));
        return null;
      }

      setIsTipping(true);
      setError(null);

      try {
        const tokenInfo = validateTipToken(token, meToken);
        if (!tokenInfo) {
          setError(new Error("Invalid tip token"));
          setIsTipping(false);
          return null;
        }
        // Only ETH is native; never treat a missing token address as native.
        const isNative = token === 'ETH';
        if (!isNative && !tokenInfo.address) {
          setError(new Error(`Invalid token address for ${tokenInfo.symbol}`));
          setIsTipping(false);
          return null;
        }

        let transferCalldata: Hex | undefined;
        if (!isNative && tokenInfo.address) {
          const tokenAmount = parseUnits(amount, tokenInfo.decimals);
          transferCalldata = encodeFunctionData({
            abi: parseAbi(["function transfer(address,uint256) returns (bool)"]),
            functionName: "transfer",
            args: [creatorAddress as Address, tokenAmount],
          });
        }

        let operation;

        // Define helper for fallback execution
        const executeOperation = async (context: any) => {
          const uo = {
            target: isNative ? (creatorAddress as Address) : (tokenInfo.address as Address),
            data: appendBuilderCode(isNative ? ("0x" as Hex) : (transferCalldata as Hex)),
            value: isNative ? (parseUnits(amount, tokenInfo.decimals)) : BigInt(0),
          };

          return await client.sendUserOperation({
            uo,
            context,
            overrides: {
              paymasterAndData: context ? undefined : undefined,
            }
          });
        };

        // Get Gas Context
        const gasContext = getGasContext('usdc');
        const primaryContext = gasContext.context;

        try {
          operation = await executeOperation(primaryContext);
        } catch (err) {
          logger.warn("Primary gas payment failed, retrying with standard gas...", err);
          // Fallback to standard gas if primary fails (e.g. USDC paymaster failure)
          if (primaryContext) {
            operation = await executeOperation(undefined);
          } else {
            throw err;
          }
        }

        // Wait for transaction to be mined
        const txHash = await client.waitForUserOperationTransaction({
          hash: operation.hash,
        });

        // Success
        toast.success(`Tip of ${amount} ${tokenInfo.symbol} sent successfully!`);

        // Refresh balances
        await fetchBalances(meToken);

        return {
          txHash,
          amount,
          token,
        };
      } catch (err) {
        logger.error("Error sending tip:", err);
        const errorMsg = err instanceof Error ? err.message : "Failed to send tip";
        setError(new Error(errorMsg));
        toast.error(`Failed to send tip: ${errorMsg}`);
        return null;
      } finally {
        setIsTipping(false);
      }
    },
    [client, address, fetchBalances, getGasContext]
  );

  // Fetch balances and prices on mount and when address changes
  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  return {
    sendTip,
    isTipping,
    error,
    balances,
    heldMeTokens,
    fetchBalances,
    getUsdValue,
    isLoadingPrice,
  };
}
