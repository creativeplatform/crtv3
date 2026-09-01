"use client";

/**
 * RobustMeTokenCreator - MeToken creation component with timeout handling
 *
 * This component uses the useMeTokenCreation hook to provide:
 * 1. Progressive status updates
 * 2. Timeout recovery with background polling
 * 3. Pending transaction persistence and recovery
 * 4. Better UX for long blockchain transactions
 */

import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Loader2,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Info,
  Clock,
  RefreshCw,
  Wallet,
  ArrowRight,
  X,
} from 'lucide-react';
import { useSmartAccountClient } from '@/lib/wallet/react';
import { useToast } from '@/components/ui/use-toast';
import {
  useMeTokenCreation,
  type PendingMeTokenTransaction,
  type CreationStatus,
} from '@/lib/hooks/metokens/useMeTokenCreation';
import { useMeTokenHubs } from '@/lib/hooks/metokens/useMeTokenHubs';
import {
  HUB_ASSET_CONFIGS,
  DEFAULT_HUB_ASSET,
  type HubAssetConfig,
  type HubAssetSymbol,
} from '@/lib/contracts/MeTokenHubs';
import {
  formatHubAssetAmount,
  parseHubAssetAmount,
  resolveHubAsset,
} from '@/lib/utils/hubAssetUtils';
import { logger } from '@/lib/utils/logger';
import { getErc20Balance } from '@/lib/viem';
import { cn } from '@/lib/utils';

interface RobustMeTokenCreatorProps {
  onMeTokenCreated?: (meTokenAddress: string, transactionHash?: string, meTokenId?: string) => void;
  onClose?: () => void;
}

const STATUS_STEPS: Record<
  CreationStatus,
  { label: string; icon: ReactNode; color: string }
> = {
  idle: { label: 'Ready to create', icon: <Wallet className="h-4 w-4" />, color: 'text-muted-foreground' },
  checking_balance: { label: 'Checking balance...', icon: <Loader2 className="h-4 w-4 animate-spin" />, color: 'text-blue-500' },
  approving_dai: { label: 'Approving collateral...', icon: <Loader2 className="h-4 w-4 animate-spin" />, color: 'text-blue-500' },
  waiting_approval: { label: 'Waiting for approval...', icon: <Clock className="h-4 w-4 animate-pulse" />, color: 'text-yellow-500' },
  creating_metoken: { label: 'Creating MeToken...', icon: <Loader2 className="h-4 w-4 animate-spin" />, color: 'text-blue-500' },
  waiting_confirmation: { label: 'Waiting for confirmation...', icon: <Clock className="h-4 w-4 animate-pulse" />, color: 'text-yellow-500' },
  polling_status: { label: 'Checking for your MeToken...', icon: <RefreshCw className="h-4 w-4 animate-spin" />, color: 'text-purple-500' },
  success: { label: 'MeToken created!', icon: <CheckCircle className="h-4 w-4" />, color: 'text-green-500' },
  error: { label: 'Error', icon: <AlertCircle className="h-4 w-4" />, color: 'text-red-500' },
};

/** Page-specific collateral logos for the creation form backing selector. */
const CREATOR_COLLATERAL_LOGOS: Partial<Record<HubAssetSymbol, string>> = {
  USDS: '/images/tokens/s_usds.webp',
  GHO: '/images/tokens/gho-coin.png',
};

export function RobustMeTokenCreator({ onMeTokenCreated, onClose }: RobustMeTokenCreatorProps) {
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [assetsDeposited, setAssetsDeposited] = useState('');
  const [assetBalances, setAssetBalances] = useState<Record<string, bigint>>({});
  const [showPendingTransactions, setShowPendingTransactions] = useState(false);

  // Keep the latest callback in a ref so the success effect below can depend on
  // a stable value instead of re-firing every time the parent re-renders with a
  // new inline `onMeTokenCreated` reference (React error #185 loop).
  const onMeTokenCreatedRef = useRef(onMeTokenCreated);
  useEffect(() => {
    onMeTokenCreatedRef.current = onMeTokenCreated;
  }, [onMeTokenCreated]);

  const { client } = useSmartAccountClient({});
  const { toast } = useToast();
  const { activeHubs, defaultHub, loading: hubsLoading, error: hubsError } = useMeTokenHubs();

  const {
    state,
    createMeToken,
    pendingTransactions,
    checkPendingTransactions,
    clearPendingTransaction,
    retryPendingTransaction,
  } = useMeTokenCreation();

  const hubOptions = useMemo(() => {
    return activeHubs.map((hub) => {
      const config =
        hub.symbol !== 'UNKNOWN'
          ? HUB_ASSET_CONFIGS[hub.symbol as HubAssetSymbol]
          : null;

      return {
        hubId: hub.hubId,
        symbol: hub.symbol,
        displayName: config?.displayName ?? hub.displayName,
        tagline: config?.tagline ?? hub.description,
        logo: config?.logo,
        decimals: hub.decimals,
        address: hub.asset,
        recommended: config?.recommended,
        deprecated: config?.deprecated,
      };
    });
  }, [activeHubs]);

  const fallbackHubId = HUB_ASSET_CONFIGS[DEFAULT_HUB_ASSET].hubId;
  const [selectedHubId, setSelectedHubId] = useState<number>(fallbackHubId);

  useEffect(() => {
    if (defaultHub && selectedHubId === fallbackHubId) {
      setSelectedHubId(defaultHub.hubId);
    }
  }, [defaultHub, fallbackHubId, selectedHubId]);

  const selectedHubOption =
    hubOptions.find((hub) => hub.hubId === selectedHubId) ?? hubOptions[0];
  const selectedAsset = selectedHubOption
    ? resolveHubAsset(selectedHubOption.hubId)
    : resolveHubAsset(fallbackHubId);

  const fetchBalances = useCallback(async () => {
    if (!client?.account?.address || hubOptions.length === 0) return;

    const entries = await Promise.all(
      hubOptions.map(async (hub) => {
        try {
          const balance = await getErc20Balance({
            token: hub.address,
            owner: client.account.address,
          });
          return [hub.symbol, balance] as const;
        } catch (err) {
          logger.error(`Failed to check ${hub.symbol} balance:`, err);
          return [hub.symbol, BigInt(0)] as const;
        }
      })
    );

    setAssetBalances(Object.fromEntries(entries));
  }, [client, hubOptions]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  // Handle successful creation
  useEffect(() => {
    if (state.status === 'success' && state.meTokenAddress) {
      const tokenName = state.name || name;
      const tokenSymbol = state.symbol || symbol;
      toast({
        title: 'MeToken Created Successfully!',
        description: `Your MeToken "${tokenName}" (${tokenSymbol}) is ready for trading.`,
      });

      onMeTokenCreatedRef.current?.(state.meTokenAddress, state.txHash, state.meTokenId);

      // Reset form
      setName('');
      setSymbol('');
      setAssetsDeposited('');
      setSelectedHubId(defaultHub?.hubId ?? fallbackHubId);
      fetchBalances();
    }
  }, [
    state.status,
    state.meTokenAddress,
    state.txHash,
    state.meTokenId,
    state.name,
    state.symbol,
    name,
    symbol,
    toast,
    fetchBalances,
    defaultHub,
    fallbackHubId,
  ]);

  // Handle creation
  const handleCreate = async () => {
    if (!name.trim() || !symbol.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please enter a name and symbol for your MeToken.',
        variant: 'destructive',
      });
      return;
    }

    const depositAmount = parseHubAssetAmount(assetsDeposited || '0', selectedAsset);
    const selectedBalance = assetBalances[selectedAsset.symbol] ?? BigInt(0);

    if (depositAmount > BigInt(0) && selectedBalance < depositAmount) {
      toast({
        title: `Insufficient ${selectedAsset.symbol}`,
        description: `You need ${formatHubAssetAmount(depositAmount, selectedAsset)} ${selectedAsset.symbol} but only have ${formatHubAssetAmount(selectedBalance, selectedAsset)} ${selectedAsset.symbol}.`,
        variant: 'destructive',
      });
      return;
    }

    try {
      await createMeToken({
        name: name.trim(),
        symbol: symbol.trim().toUpperCase(),
        hubId: selectedHubId,
        assetsDeposited: assetsDeposited || '0',
      });
    } catch (err) {
      // Error is handled in the hook
      toast({
        title: 'Creation Failed',
        description: err instanceof Error ? err.message : 'Failed to create MeToken',
        variant: 'destructive',
      });
    }
  };

  const isProcessing = !['idle', 'success', 'error'].includes(state.status);
  const selectedBalance = assetBalances[selectedAsset.symbol] ?? BigInt(0);
  const depositAmount = parseHubAssetAmount(assetsDeposited || '0', selectedAsset);
  const hasEnoughCollateral = selectedBalance >= depositAmount;
  const currentStep = STATUS_STEPS[state.status];

  const getExplorerUrl = (type: 'tx' | 'address', hash: string) => {
    return `https://basescan.org/${type}/${hash}`;
  };

  return (
    <div className="space-y-4">
      {/* Pending Transactions Recovery Banner */}
      {pendingTransactions.length > 0 && (
        <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
          <Clock className="h-4 w-4" />
          <AlertTitle>Pending Transactions Found</AlertTitle>
          <AlertDescription>
            <p className="mb-2">
              You have {pendingTransactions.length} pending MeToken transaction(s) that may have been interrupted.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPendingTransactions(!showPendingTransactions)}
            >
              {showPendingTransactions ? 'Hide' : 'View'} Pending Transactions
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Pending Transactions List */}
      {showPendingTransactions && pendingTransactions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Pending Transactions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingTransactions.map((tx) => (
              <PendingTransactionCard
                key={tx.userOpHash}
                tx={tx}
                onRetry={() => retryPendingTransaction(tx)}
                onClear={() => clearPendingTransaction(tx.userOpHash)}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Main Creation Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>Create MeToken</span>
            {state.status === 'success' && <CheckCircle className="h-5 w-5 text-green-500" />}
          </CardTitle>
          <CardDescription>
            Create your personal token that fans can buy and sell on the bonding curve.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress Indicator */}
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className={currentStep.color}>{currentStep.icon}</span>
                <span className="text-sm font-medium">{state.message || currentStep.label}</span>
              </div>
              <Progress value={state.progress} className="h-2" />

              {/* Show transaction hashes when available */}
              {state.userOpHash && (
                <p className="text-xs text-muted-foreground">
                  UserOp: {state.userOpHash.slice(0, 10)}...{state.userOpHash.slice(-8)}
                </p>
              )}
            </div>
          )}

          {state.status === 'success' ? (
            /* Success View */
            <div className="space-y-4">
              <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <AlertTitle>Success!</AlertTitle>
                <AlertDescription>
                  <div className="space-y-2">
                    <p>{state.message || 'Your MeToken has been created successfully.'}</p>
                    {state.txHash && (
                      <a
                        href={getExplorerUrl('tx', state.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                      >
                        View Transaction <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {state.meTokenAddress && (
                      <a
                        href={getExplorerUrl('address', state.meTokenAddress)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                      >
                        View MeToken Contract <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </AlertDescription>
              </Alert>

              <Button
                onClick={() => onClose?.()}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                size="lg"
              >
                Done
              </Button>
            </div>
          ) : (
            /* Form View */
            <div className="space-y-4">
              {/* Error Message */}
              {state.status === 'error' && state.error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription className="whitespace-pre-line">
                    {state.error}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">MeToken Name</Label>
                    <Input
                      id="name"
                      placeholder="My Creative Token"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={isProcessing}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="symbol">Symbol</Label>
                    <Input
                      id="symbol"
                      placeholder="MCT"
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                      disabled={isProcessing}
                      maxLength={10}
                    />
                  </div>
                </div>

                {/* Hub / Backing Collateral Selector */}
                <div className="space-y-2">
                  <Label>Backing Collateral</Label>
                  {hubsLoading ? (
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading active hubs...
                    </p>
                  ) : hubsError ? (
                    <Alert variant="destructive">
                      <AlertDescription>{hubsError}</AlertDescription>
                    </Alert>
                  ) : hubOptions.length === 0 ? (
                    <Alert>
                      <AlertDescription>
                        No active MeToken hubs are registered on-chain yet.
                      </AlertDescription>
                    </Alert>
                  ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {hubOptions.map((hub) => {
                      const config =
                        hub.symbol !== 'UNKNOWN'
                          ? HUB_ASSET_CONFIGS[hub.symbol as HubAssetSymbol]
                          : undefined;

                      return (
                      <button
                        key={hub.hubId}
                        type="button"
                        onClick={() => setSelectedHubId(hub.hubId)}
                        disabled={isProcessing}
                        className={cn(
                          'flex items-start gap-3 p-3 border rounded-lg text-left transition-colors',
                          selectedHubId === hub.hubId
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-muted-foreground'
                        )}
                      >
                        {config ? (
                        <TokenLogo
                          config={config}
                          className="h-10 w-10 flex-shrink-0"
                          logoSrc={CREATOR_COLLATERAL_LOGOS[config.symbol]}
                        />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                            {hub.symbol.slice(0, 2)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center flex-wrap gap-2">
                            <span className="font-semibold">{hub.displayName}</span>
                            {hub.recommended && (
                              <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                                Recommended
                              </span>
                            )}
                            {hub.deprecated && (
                              <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                                Legacy
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {hub.tagline}
                          </p>
                          <p className="text-xs mt-1">
                            Balance:{' '}
                            {formatHubAssetAmount(
                              assetBalances[hub.symbol] ?? BigInt(0),
                              resolveHubAsset(hub.hubId)
                            )}{' '}
                            {hub.symbol}
                          </p>
                        </div>
                      </button>
                    );})}
                  </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assetsDeposited">
                    Initial {selectedAsset.symbol} Deposit (Optional)
                  </Label>
                  <Input
                    id="assetsDeposited"
                    type="number"
                    placeholder="0.00"
                    value={assetsDeposited}
                    onChange={(e) => setAssetsDeposited(e.target.value)}
                    disabled={isProcessing}
                    step="0.01"
                    min="0"
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Your {selectedAsset.symbol} balance:{' '}
                      {formatHubAssetAmount(selectedBalance, selectedAsset)} {selectedAsset.symbol}
                    </span>
                    {assetsDeposited && depositAmount > BigInt(0) && (
                      <span className={hasEnoughCollateral ? 'text-green-600' : 'text-red-600'}>
                        {hasEnoughCollateral ? '✓ Sufficient' : '✗ Insufficient'}
                      </span>
                    )}
                  </div>
                </div>

                <Button
                  onClick={handleCreate}
                  disabled={
                    isProcessing ||
                    !name ||
                    !symbol ||
                    hubOptions.length === 0 ||
                    (depositAmount > BigInt(0) && !hasEnoughCollateral)
                  }
                  className="w-full"
                  size="lg"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {currentStep.label}
                    </>
                  ) : (
                    <>
                      Create MeToken
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Info Section */}
          <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground space-y-2">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p><strong>What happens next:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Your MeToken will be created on the Base blockchain</li>
                  <li>Gas is sponsored via Alchemy paymaster (no ETH required in most cases)</li>
                  <li>If depositing {selectedAsset.symbol}, approval and subscribe run in one transaction</li>
                  <li>Transaction may take 30 seconds to 2 minutes</li>
                  <li>If it times out, we&apos;ll keep checking in the background</li>
                  <li>Your MeToken will be tradeable immediately after creation</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TokenLogo({
  config,
  className,
  logoSrc,
}: {
  config: HubAssetConfig;
  className?: string;
  logoSrc?: string;
}) {
  const [errored, setErrored] = useState(false);
  const src = logoSrc ?? config.logo;
  const [prevSrc, setPrevSrc] = useState(src);

  if (src !== prevSrc) {
    setPrevSrc(src);
    setErrored(false);
  }

  if (errored || !src) {
    return (
      <div
        className={cn(
          'rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground',
          className
        )}
      >
        {config.symbol.slice(0, 2)}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={config.symbol}
      className={cn('rounded-full object-contain', className)}
      onError={() => setErrored(true)}
    />
  );
}

// Pending Transaction Card Component
function PendingTransactionCard({
  tx,
  onRetry,
  onClear,
}: {
  tx: PendingMeTokenTransaction;
  onRetry: () => void;
  onClear: () => void;
}) {
  const txAsset = resolveHubAsset(tx.hubId);

  const getStatusBadge = () => {
    switch (tx.status) {
      case 'pending':
        return <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">Pending</span>;
      case 'confirming':
        return <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded">Confirming</span>;
      case 'confirmed':
        return <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded">Confirmed</span>;
      case 'timeout':
        return <span className="px-2 py-0.5 bg-orange-100 text-orange-800 text-xs rounded">Timeout</span>;
      case 'failed':
        return <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded">Failed</span>;
    }
  };

  const timeSince = () => {
    const seconds = Math.floor((Date.now() - tx.createdAt) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{tx.name} ({tx.symbol})</span>
          {getStatusBadge()}
        </div>
        <div className="text-xs text-muted-foreground">
          {formatHubAssetAmount(parseHubAssetAmount(tx.assetsDeposited, txAsset), txAsset)} {txAsset.symbol} • {timeSince()}
        </div>
        {tx.meTokenAddress && (
          <a
            href={`https://basescan.org/address/${tx.meTokenAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            {tx.meTokenAddress.slice(0, 8)}...{tx.meTokenAddress.slice(-6)}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      <div className="flex items-center gap-2">
        {(tx.status === 'timeout' || tx.status === 'failed') && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

export default RobustMeTokenCreator;
