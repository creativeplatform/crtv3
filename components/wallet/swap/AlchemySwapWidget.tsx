"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowRightLeft, CheckCircle, XCircle, ExternalLink, DollarSign, ChevronDown } from 'lucide-react';
import Image from 'next/image';
import { useSmartAccountClient, useChain, usePrepareSwap, useSignAndSendPreparedCalls } from '@/lib/wallet/react';
import { type Hex, type Address, parseEther, formatEther, encodeFunctionData, erc20Abi, parseUnits, maxUint256 } from 'viem';
import { AlchemySwapService, type TokenSymbol, BASE_TOKENS, TOKEN_INFO, SWAP_UI_TOKENS, emptyTokenBalances, emptyTokenPrices } from '@/lib/sdk/alchemy/swap-service';
import { priceService, PriceService } from '@/lib/sdk/alchemy/price-service';
import { CurrencyConverter } from '@/lib/utils/currency-converter';
import { logger } from '@/lib/utils/logger';
import { getTokenIcon } from '@/lib/utils/token-icons';
import { getEthBalance, getErc20Balance } from '@/lib/viem';
import { cn } from '@/lib/utils';

function SwapTokenSelect({
  value,
  onValueChange,
  chainId,
  disabled,
}: {
  value: TokenSymbol;
  onValueChange: (token: TokenSymbol) => void;
  chainId?: number;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        'relative flex h-10 w-[7.25rem] shrink-0 items-center gap-1.5 overflow-hidden rounded-md border bg-background px-2',
        'sm:w-32 sm:gap-2 sm:px-3',
        disabled && 'opacity-50',
      )}
    >
      {/* Native select covers the box on mobile */}
      <select
        className="absolute inset-0 z-10 cursor-pointer opacity-0 md:hidden"
        value={value}
        disabled={disabled}
        onChange={(e) => onValueChange(e.target.value as TokenSymbol)}
        aria-label="Select token"
      >
        {SWAP_UI_TOKENS.map((token) => (
          <option key={token} value={token}>
            {token}
          </option>
        ))}
      </select>

      <Image
        src={getTokenIcon(value, chainId)}
        alt=""
        width={24}
        height={24}
        className="h-6 w-6 shrink-0"
        aria-hidden
      />

      {/* Mobile visual: label + chevron stay inside the box */}
      <span className="min-w-0 flex-1 truncate text-sm font-medium md:hidden">{value}</span>
      <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50 md:hidden" aria-hidden />

      {/* Desktop: Radix select */}
      <Select value={value} onValueChange={(v) => onValueChange(v as TokenSymbol)} disabled={disabled}>
        <SelectTrigger
          className={cn(
            'hidden h-auto min-w-0 flex-1 border-0 bg-transparent p-0 shadow-none',
            'focus:ring-0 focus:ring-offset-0 md:flex',
            '[&>span]:min-w-0 [&>span]:truncate',
          )}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SWAP_UI_TOKENS.map((token) => (
            <SelectItem key={token} value={token}>
              {token}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function formatSwapError(error: unknown): string {
  const errorStr = error instanceof Error ? error.message : String(error);
  const lower = errorStr.toLowerCase();

  if (
    lower.includes('typed signature') ||
    lower.includes('signpreparedcalls') ||
    lower.includes('secp256k1') ||
    lower.includes('eoa signature') ||
    lower.includes('not a function')
  ) {
    return 'Swap could not be signed. Please try again or contact support if this persists.';
  }
  if (errorStr.includes('AA23')) {
    return 'Transaction validation failed (AA23). Check balances and gas.';
  }
  if (errorStr.includes('Multicall3')) {
    return 'Swap failed (Multicall3). Ensure you have sufficient token balance and your account is deployed.';
  }
  if (errorStr.includes('User rejected')) {
    return 'User rejected the request.';
  }
  if (errorStr.includes('raw calls')) {
    return 'Swap route is unavailable for smart accounts. Try a different token pair.';
  }
  return errorStr || 'Swap execution failed';
}

const ERC20_BALANCE_ABI = [{
  name: 'balanceOf',
  type: 'function',
  stateMutability: 'view',
  inputs: [{ name: 'account', type: 'address' }],
  outputs: [{ name: 'balance', type: 'uint256' }],
}] as const;

interface AlchemySwapWidgetProps {
  onSwapSuccess?: () => void;
  className?: string;
  hideHeader?: boolean;
  defaultToToken?: TokenSymbol;
  /** If true, reduces spacing and presets for a compact side-panel view */
  compact?: boolean;
}

interface SwapState {
  fromToken: TokenSymbol;
  toToken: TokenSymbol;
  fromAmount: string;
  toAmount: string;
  isLoading: boolean;
  isSwapping: boolean;
  error: string | null;
  quote: any;
  transactionHash: string | null;
}

export function AlchemySwapWidget({ onSwapSuccess, className, hideHeader = false, defaultToToken = 'USDC', compact = false }: AlchemySwapWidgetProps) {

  const { address, client } = useSmartAccountClient({});
  const { chain } = useChain();
  const { prepareSwapAsync, isPreparingSwap } = usePrepareSwap({ client });
  const { signAndSendPreparedCallsAsync, isSigningAndSendingPreparedCalls } =
    useSignAndSendPreparedCalls({ client });

  const buildSwapParams = (amount: string, fromToken: TokenSymbol, toToken: TokenSymbol) => {
    const paymasterPolicyId = process.env.NEXT_PUBLIC_ALCHEMY_PAYMASTER_POLICY_ID?.replace(
      /^["']|["']$/g,
      '',
    );

    return {
      from: address as Address,
      fromToken: BASE_TOKENS[fromToken],
      toToken: BASE_TOKENS[toToken],
      fromAmount: AlchemySwapService.formatAmount(amount, fromToken),
      slippage: '0x32',
      ...(paymasterPolicyId
        ? {
            capabilities: {
              paymasterService: { policyId: paymasterPolicyId },
            },
          }
        : {}),
    };
  };

  const [swapState, setSwapState] = useState<SwapState>({
    fromToken: 'ETH',
    toToken: defaultToToken,
    fromAmount: '',
    toAmount: '',
    isLoading: false,
    isSwapping: false,
    error: null,
    quote: null,
    transactionHash: null,
  });

  const [isApprovingToken, setIsApprovingToken] = useState(false);

  const [balances, setBalances] = useState<Record<TokenSymbol, string>>(emptyTokenBalances());

  const [prices, setPrices] = useState<Record<TokenSymbol, number>>(emptyTokenPrices());

  const [usdValues, setUsdValues] = useState<{
    fromAmount: number;
    toAmount: number;
  }>({
    fromAmount: 0,
    toAmount: 0,
  });

  const [inputMode, setInputMode] = useState<'token' | 'usd'>('usd'); // Default to USD mode
  const [usdInput, setUsdInput] = useState<string>('');

  // Fetch token prices
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const tokenPrices = await priceService.getTokenPrices([...SWAP_UI_TOKENS]);
        setPrices(tokenPrices);
      } catch (error) {
        logger.error('Error fetching prices:', error);
      }
    };

    fetchPrices();
    // Refresh prices every minute
    const interval = setInterval(fetchPrices, 60000);
    return () => clearInterval(interval);
  }, []);

  // Calculate USD values when amounts change
  useEffect(() => {
    const calculateUsdValues = async () => {
      if (swapState.fromAmount && parseFloat(swapState.fromAmount) > 0) {
        const fromUsd = await priceService.convertToUSD(
          parseFloat(swapState.fromAmount),
          swapState.fromToken
        );
        setUsdValues(prev => ({ ...prev, fromAmount: fromUsd }));
      } else {
        setUsdValues(prev => ({ ...prev, fromAmount: 0 }));
      }

      if (swapState.toAmount && parseFloat(swapState.toAmount) > 0) {
        const toUsd = await priceService.convertToUSD(
          parseFloat(swapState.toAmount),
          swapState.toToken
        );
        setUsdValues(prev => ({ ...prev, toAmount: toUsd }));
      } else {
        setUsdValues(prev => ({ ...prev, toAmount: 0 }));
      }
    };

    calculateUsdValues();
  }, [swapState.fromAmount, swapState.toAmount, swapState.fromToken, swapState.toToken]);

  // Fetch token balances
  useEffect(() => {
    if (!address || !client) return;

    const fetchBalances = async () => {
      try {
        logger.debug('Fetching balances for address:', address);

        // Get ETH balance via public client (smart-account client is write-only)
        const ethBalance = await getEthBalance(address);

        logger.debug('ETH balance (wei):', ethBalance.toString());

        // Get ERC-20 balances
        const newBalances = emptyTokenBalances();
        newBalances.ETH = AlchemySwapService.parseAmount(`0x${ethBalance.toString(16)}` as Hex, 'ETH');

        for (const token of SWAP_UI_TOKENS.filter((t) => t !== 'ETH')) {
          try {
            const raw = await getErc20Balance({
              token: BASE_TOKENS[token] as Address,
              owner: address as Address,
            });
            newBalances[token] = AlchemySwapService.parseAmount(`0x${raw.toString(16)}` as Hex, token);
          } catch (e) {
            logger.warn(`Failed to fetch ${token} balance:`, e);
          }
        }

        logger.debug('Parsed balances:', newBalances);
        setBalances(newBalances);

        // Check if the account has any ETH at all
        if (ethBalance === 0n) {
          logger.warn('Account has zero ETH balance. This may cause swap failures.');
          setSwapState(prev => ({
            ...prev,
            error: 'Account has zero ETH balance. You need ETH for gas fees to perform swaps. Please add some ETH to your account first.'
          }));
        } else {
          // Clear any previous balance-related errors
          setSwapState(prev => ({
            ...prev,
            error: prev.error?.includes('zero ETH balance') ? null : prev.error
          }));
        }

      } catch (error) {
        logger.error('Error fetching balances:', error);
      }
    };

    fetchBalances();
  }, [address, client]);

  const fetchQuote = async (amount: string, fromToken: TokenSymbol, toToken: TokenSymbol) => {
    if (!amount || parseFloat(amount) <= 0 || !address || !client) {
      setSwapState(prev => ({ ...prev, fromAmount: amount, quote: null, error: null }));
      return;
    }

    try {
      setSwapState(prev => ({ ...prev, isLoading: true, error: null }));

      logger.debug('Requesting swap quote:', {
        from: address,
        fromToken,
        toToken,
        fromAmount: amount,
      });

      const result = await prepareSwapAsync(
        buildSwapParams(amount, fromToken, toToken),
      );

      if (!result) {
        throw new Error('Failed to prepare swap: No response received');
      }

      if ("rawCalls" in result && result.rawCalls) {
        throw new Error('Expected user operation calls, got raw calls');
      }

      if (result.quote?.minimumToAmount) {
        const toAmount = AlchemySwapService.parseAmount(
          result.quote.minimumToAmount,
          toToken,
        );

        setSwapState(prev => ({
          ...prev,
          fromAmount: amount,
          toAmount,
          quote: result.quote,
          isLoading: false,
        }));
      } else {
        setSwapState(prev => ({ ...prev, isLoading: false, quote: null }));
      }
    } catch (error) {
      logger.error('Error getting quote:', error);
      setSwapState(prev => ({
        ...prev,
        isLoading: false,
        quote: null,
        error: formatSwapError(error),
      }));
    }
  };

  const handleFromTokenChange = async (value: string) => {
    const newFromToken = value as TokenSymbol;
    const currentToToken = swapState.toToken;
    let newToToken = currentToToken;

    // If selecting same token as destination, swap them
    if (newFromToken === currentToToken) {
      newToToken = swapState.fromToken;
    }

    setSwapState(prev => ({
      ...prev,
      fromToken: newFromToken,
      toToken: newToToken,
    }));

    // Re-fetch quote if we have an amount
    if (swapState.fromAmount && parseFloat(swapState.fromAmount) > 0) {
      await fetchQuote(swapState.fromAmount, newFromToken, newToToken);
    }
  };

  const handleToTokenChange = async (value: string) => {
    const newToToken = value as TokenSymbol;
    const currentFromToken = swapState.fromToken;
    let newFromToken = currentFromToken;

    // If selecting same token as source, swap them
    if (newToToken === currentFromToken) {
      newFromToken = swapState.toToken;
    }

    setSwapState(prev => ({
      ...prev,
      fromToken: newFromToken,
      toToken: newToToken,
    }));

    // Re-fetch quote if we have an amount
    if (swapState.fromAmount && parseFloat(swapState.fromAmount) > 0) {
      await fetchQuote(swapState.fromAmount, newFromToken, newToToken);
    }
  };

  const handleFromAmountChange = async (value: string) => {
    setSwapState(prev => ({ ...prev, fromAmount: value }));
    await fetchQuote(value, swapState.fromToken, swapState.toToken);
  };

  const handleUSDInputChange = async (value: string) => {
    setUsdInput(value);

    if (!value || parseFloat(value) <= 0) {
      setSwapState(prev => ({ ...prev, fromAmount: '', toAmount: '', quote: null, error: null }));
      return;
    }

    if (!address || !client) return;

    try {
      setSwapState(prev => ({ ...prev, isLoading: true, error: null }));

      // Convert USD to token amount
      const tokenAmount = await priceService.convertFromUSD(
        parseFloat(value),
        swapState.fromToken
      );

      // Check balance before requesting quote
      const availableBalance = parseFloat(balances[swapState.fromToken]);
      if (tokenAmount > availableBalance) {
        const maxUSD = await priceService.convertToUSD(availableBalance, swapState.fromToken);
        setSwapState(prev => ({
          ...prev,
          isLoading: false,
          error: `Insufficient balance. You can swap up to ${PriceService.formatUSD(maxUSD)} (${availableBalance.toFixed(6)} ${swapState.fromToken})`
        }));
        return;
      }

      // Update the token amount and trigger quote
      await handleFromAmountChange(tokenAmount.toFixed(6));
    } catch (error) {
      logger.error('Error converting USD to token:', error);
      setSwapState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to convert USD amount'
      }));
    }
  };

  const handleInputModeToggle = () => {
    setInputMode(prev => {
      const newMode = prev === 'token' ? 'usd' : 'token';

      // When switching to USD mode, calculate USD value from token amount
      if (newMode === 'usd' && swapState.fromAmount) {
        const calculateUSD = async () => {
          const usd = await priceService.convertToUSD(
            parseFloat(swapState.fromAmount),
            swapState.fromToken
          );
          setUsdInput(usd.toFixed(2));
        };
        calculateUSD();
      }

      return newMode;
    });
  };

  const handlePresetAmount = async (usdAmount: number) => {
    setInputMode('usd');
    setUsdInput(usdAmount.toString());
    await handleUSDInputChange(usdAmount.toString());
  };

  const handleMaxAmount = async () => {
    const availableBalance = parseFloat(balances[swapState.fromToken]);

    if (availableBalance <= 0) {
      setSwapState(prev => ({ ...prev, error: `No ${swapState.fromToken} balance available` }));
      return;
    }

    if (inputMode === 'usd') {
      // Convert max balance to USD
      const maxUSD = await priceService.convertToUSD(availableBalance, swapState.fromToken);
      setUsdInput(maxUSD.toFixed(2));
      await handleUSDInputChange(maxUSD.toFixed(2));
    } else {
      // Use max token balance
      await handleFromAmountChange(availableBalance.toFixed(6));
    }
  };

  const handleSwapTokens = async () => {
    const newFrom = swapState.toToken;
    const newTo = swapState.fromToken;
    const newFromAmount = swapState.toAmount;

    setSwapState(prev => ({
      ...prev,
      fromToken: newFrom,
      toToken: newTo,
      fromAmount: newFromAmount,
      toAmount: '', // Clear toAmount until new quote comes in
      quote: null
    }));

    if (newFromAmount && parseFloat(newFromAmount) > 0) {
      await fetchQuote(newFromAmount, newFrom, newTo);
    }
  };


  const handleExecuteSwap = async () => {
    if (!address || !client || !swapState.fromAmount) return;

    try {
      setSwapState(prev => ({ ...prev, isSwapping: true, error: null }));

      logger.debug('Requesting fresh quote for execution...');

      const result = await prepareSwapAsync(
        buildSwapParams(swapState.fromAmount, swapState.fromToken, swapState.toToken),
      );

      if (!result) {
        throw new Error('Failed to prepare swap: No response received');
      }

      if ("rawCalls" in result && result.rawCalls) {
        throw new Error('Expected user operation calls, got raw calls');
      }

      const { quote: _quote, ...calls } = result;

      logger.debug('Signing and sending prepared calls...');
      const { preparedCallIds } = await signAndSendPreparedCallsAsync(calls);

      if (!preparedCallIds || preparedCallIds.length === 0) {
        throw new Error('No prepared call IDs returned');
      }

      const callId = preparedCallIds[0];
      logger.debug('Swap initiated, Call ID:', callId);

      const callStatusResult = await client.waitForCallsStatus({ id: callId });

      if (
        callStatusResult.status === 'success' &&
        callStatusResult.receipts &&
        callStatusResult.receipts[0]
      ) {
        const txHash = callStatusResult.receipts[0].transactionHash;
        logger.debug('Swap confirmed! TxHash:', txHash);

        setSwapState(prev => ({
          ...prev,
          transactionHash: txHash ?? null,
          isSwapping: false,
        }));

        onSwapSuccess?.();
      } else {
        logger.error('Swap failed status:', callStatusResult);
        throw new Error(`Transaction failed with status ${callStatusResult.status}`);
      }
    } catch (error) {
      logger.error('Swap failed:', error);
      setIsApprovingToken(false);

      setSwapState(prev => ({
        ...prev,
        error: formatSwapError(error),
        isSwapping: false,
      }));
    }
  };

  const isSwapBusy =
    swapState.isLoading ||
    swapState.isSwapping ||
    isPreparingSwap ||
    isSigningAndSendingPreparedCalls;

  const canExecuteSwap =
    swapState.fromAmount &&
    parseFloat(swapState.fromAmount) > 0 &&
    swapState.quote &&
    !swapState.isLoading &&
    !swapState.isSwapping &&
    !isPreparingSwap &&
    !isSigningAndSendingPreparedCalls &&
    swapState.fromToken !== swapState.toToken;

  // Show loading state while wallet is connecting
  if (!address || !client) {
    return (
      <Card className={className}>
        {(!hideHeader || !compact) && (
          <CardHeader className={compact ? "pb-2" : undefined}>
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowRightLeft className="h-4 w-4" />
              Token Swap
            </CardTitle>
          </CardHeader>
        )}
        <CardContent className={compact ? "p-4" : undefined}>
          <div className="flex items-center justify-center py-4 text-muted-foreground text-sm">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Connecting wallet...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      {(!hideHeader || !compact) && (
        <CardHeader className={compact ? "pb-2" : undefined}>
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowRightLeft className="h-4 w-4" />
            Token Swap
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className={`${compact ? 'p-4 space-y-3' : 'space-y-4'}`}>
        {swapState.error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              <div>{swapState.error}</div>
              {swapState.error.includes('Insufficient balance') && address && (
                <div className="mt-2 text-xs">
                  <a
                    href={`/send?address=${address}`}
                    className="underline hover:text-destructive-foreground"
                  >
                    Add funds to your wallet
                  </a>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {address && balances[swapState.fromToken] && parseFloat(balances[swapState.fromToken]) === 0 && !swapState.error && (
          <Alert>
            <AlertDescription className="text-sm">
              You don&apos;t have any {swapState.fromToken} to swap.
              <a
                href={`/send?address=${address}`}
                className="ml-1 underline hover:text-primary"
              >
                Add funds to get started
              </a>
            </AlertDescription>
          </Alert>
        )}

        {swapState.transactionHash && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="flex items-center gap-2">
              Swap completed successfully!
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`https://basescan.org/tx/${swapState.transactionHash}`, '_blank')}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                View on BaseScan
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* From Token */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">You Pay</label>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleMaxAmount}
                className="h-6 px-2 text-xs"
                disabled={isSwapBusy || !address}
              >
                MAX
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleInputModeToggle}
                className="h-6 px-2 text-xs"
                disabled={isSwapBusy}
              >
                <DollarSign className={`h-3 w-3 mr-1 ${inputMode === 'usd' ? 'text-green-600' : ''}`} />
                {inputMode === 'usd' ? 'USD' : swapState.fromToken}
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SwapTokenSelect
              value={swapState.fromToken}
              onValueChange={handleFromTokenChange}
              chainId={client?.chain?.id ?? chain?.id}
              disabled={isSwapBusy}
            />
            <div className="relative min-w-0 flex-1">
              <Input
                type="number"
                placeholder={inputMode === 'usd' ? '0.00' : '0.0'}
                value={inputMode === 'usd' ? usdInput : swapState.fromAmount}
                onChange={(e) =>
                  inputMode === 'usd'
                    ? handleUSDInputChange(e.target.value)
                    : handleFromAmountChange(e.target.value)
                }
                className={inputMode === 'usd' ? 'h-10 pl-6 pr-20' : 'h-10 pr-20'}
                disabled={isSwapBusy}
              />
              {inputMode === 'usd' && (
                <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </div>
              )}
              {inputMode === 'token' && usdValues.fromAmount > 0 && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  ≈ {PriceService.formatUSD(usdValues.fromAmount)}
                </div>
              )}
              {inputMode === 'usd' && swapState.fromAmount && parseFloat(swapState.fromAmount) > 0 && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  ≈ {parseFloat(swapState.fromAmount).toFixed(6)} {swapState.fromToken}
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <div className="flex items-center space-x-1">
              <Image
                src={getTokenIcon(swapState.fromToken, client?.chain?.id ?? chain?.id)}
                alt={swapState.fromToken}
                width={20}
                height={20}
                className="w-5 h-5"
              />
              <span>Balance: {balances[swapState.fromToken]}</span>
            </div>
            {prices[swapState.fromToken] > 0 && (
              <span>@ {PriceService.formatUSD(prices[swapState.fromToken])}</span>
            )}
          </div>

          {/* Quick Amount Presets */}
          {inputMode === 'usd' && !compact && (
            <div className="space-y-2">
              <div className="flex gap-2 pt-1">
                {[10, 25, 50, 100].map((amount) => (
                  <Button
                    key={amount}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handlePresetAmount(amount)}
                    disabled={isSwapBusy || !address}
                    className="flex-1 h-8 text-xs"
                  >
                    ${amount}
                  </Button>
                ))}
              </div>
              {address && balances[swapState.fromToken] && parseFloat(balances[swapState.fromToken]) > 0 && (
                <div className="text-xs text-muted-foreground text-right">
                  Max: ~{PriceService.formatUSD(
                    usdValues.fromAmount > 0
                      ? parseFloat(balances[swapState.fromToken]) * prices[swapState.fromToken]
                      : 0
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Swap Button */}
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSwapTokens}
            disabled={isSwapBusy}
          >
            <ArrowRightLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* To Token */}
        <div className="space-y-2">
          <label className="text-sm font-medium">You Receive</label>
          <div className="flex items-center gap-2">
            <SwapTokenSelect
              value={swapState.toToken}
              onValueChange={handleToTokenChange}
              chainId={client?.chain?.id ?? chain?.id}
              disabled={isSwapBusy}
            />
            <div className="relative min-w-0 flex-1">
              <Input
                type="number"
                placeholder="0.0"
                value={swapState.toAmount}
                readOnly
                className="h-10 bg-muted pr-20"
              />
              {usdValues.toAmount > 0 && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  ≈ {PriceService.formatUSD(usdValues.toAmount)}
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <div className="flex items-center space-x-1">
              <Image
                src={getTokenIcon(swapState.toToken, client?.chain?.id ?? chain?.id)}
                alt={swapState.toToken}
                width={20}
                height={20}
                className="w-5 h-5"
              />
              <span>Balance: {balances[swapState.toToken]}</span>
            </div>
            {prices[swapState.toToken] > 0 && (
              <span>@ {PriceService.formatUSD(prices[swapState.toToken])}</span>
            )}
          </div>
        </div>

        {/* Quote Information */}
        {swapState.quote && (
          <div className="p-3 bg-muted rounded-lg space-y-2">
            <div className="text-sm font-medium">Swap Quote</div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Exchange Rate</span>
                <span>1 {swapState.fromToken} = {
                  (parseFloat(swapState.toAmount) / parseFloat(swapState.fromAmount)).toFixed(6)
                } {swapState.toToken}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">You Pay</span>
                <span>{swapState.fromAmount} {swapState.fromToken} ({PriceService.formatUSD(usdValues.fromAmount)})</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">You Receive</span>
                <span>{swapState.toAmount} {swapState.toToken} ({PriceService.formatUSD(usdValues.toAmount)})</span>
              </div>
              {swapState.quote.feePayment?.sponsored && (
                <div className="text-xs text-green-600 mt-2">
                  ✓ Gas sponsored by paymaster
                </div>
              )}
            </div>
          </div>
        )}

        {/* Execute Swap Button */}
        <Button
          onClick={handleExecuteSwap}
          disabled={!canExecuteSwap}
          className="w-full"
        >
          {isApprovingToken ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Approving {swapState.fromToken}...
            </>
          ) : isSwapBusy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Executing Swap...
            </>
          ) : swapState.isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Getting Quote...
            </>
          ) : (
            <>
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              Execute Swap
            </>
          )}
        </Button>

        {/* Supported Tokens Info */}
        <div className={`text-xs text-muted-foreground ${compact ? 'hidden' : ''}`}>
          <p>Supported tokens on Base: ETH, USDC, USDS, DAI, GHO</p>
          <p>Swaps powered by Alchemy Smart Wallets</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default AlchemySwapWidget;