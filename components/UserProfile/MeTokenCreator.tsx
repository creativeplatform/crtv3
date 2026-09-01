"use client";
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useMeTokensSupabase } from '@/lib/hooks/metokens/useMeTokensSupabase';
import { useMeTokenHubs } from '@/lib/hooks/metokens/useMeTokenHubs';
import { CollateralHubGuide, STABLECOIN_SUMMARY } from '@/components/metokens/CollateralHubGuide';
import { useUser } from '@/lib/wallet/react';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { logger } from '@/lib/utils/logger';
import Image from 'next/image';
import { getTokenIcon } from '@/lib/utils/token-icons';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface MeTokenCreatorProps {
  onMeTokenCreated?: (meTokenAddress: string) => void;
}

export function MeTokenCreator({ onMeTokenCreated }: MeTokenCreatorProps) {
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [collateralAmount, setCollateralAmount] = useState('0');
  const [selectedHubId, setSelectedHubId] = useState<number | undefined>(undefined);
  const [localError, setLocalError] = useState<string | null>(null);

  const user = useUser();
  const { toast } = useToast();
  const { activeHubs, loading: hubsLoading, defaultHub } = useMeTokenHubs();
  const { createMeToken, isPending, isConfirming, isConfirmed, transactionError, checkUserMeToken, userMeToken } = useMeTokensSupabase();

  const selectedHub = activeHubs.find((h) => h.hubId === selectedHubId) ?? defaultHub ?? activeHubs[0];
  const collateralSymbol = selectedHub?.symbol ?? 'USDC';

  useEffect(() => {
    if (
      activeHubs.length > 0 &&
      (selectedHubId === undefined || !activeHubs.some((h) => h.hubId === selectedHubId))
    ) {
      setSelectedHubId(defaultHub?.hubId ?? activeHubs[0].hubId);
    }
  }, [activeHubs, defaultHub, selectedHubId]);

  // Debug: Log user state
  useEffect(() => {
    logger.debug('👤 User state:', { user, address: user?.address });
  }, [user]);

  // Toast notifications for transaction states
  useEffect(() => {
    if (isPending) {
      toast({
        title: "Transaction Initiated",
        description: "Please confirm the transaction in your wallet...",
      });
    }
  }, [isPending, toast]);

  useEffect(() => {
    if (isConfirming) {
      toast({
        title: "Transaction Submitted",
        description: "Waiting for transaction confirmation...",
      });
    }
  }, [isConfirming, toast]);

  useEffect(() => {
    if (isConfirmed) {
      toast({
        title: "MeToken Created! 🎉",
        description: "Your personal token has been deployed successfully! Refreshing in 3 seconds...",
        duration: 3000,
      });
      setName('');
      setSymbol('');
      setLocalError(null);
    }
  }, [isConfirmed, toast]);

  useEffect(() => {
    if (transactionError) {
      toast({
        variant: "destructive",
        title: "Transaction Failed",
        description: transactionError.message || "An error occurred during the transaction",
      });
    }
  }, [transactionError, toast]);

  const handleCreateMeToken = async () => {
    logger.debug('🚀 handleCreateMeToken called', { name, symbol, collateralAmount });

    if (!name.trim() || !symbol.trim()) {
      setLocalError('Please fill in all fields');
      return;
    }

    if (symbol.length > 10) {
      setLocalError('Symbol must be 10 characters or less');
      return;
    }

    const depositValue = parseFloat(collateralAmount || '0');
    if (depositValue < 0) {
      setLocalError(`${collateralSymbol} amount cannot be negative`);
      return;
    }

    if (!selectedHub) {
      setLocalError('No active collateral hub available. DAI (Hub 1) is required.');
      return;
    }

    setLocalError(null);

    try {
      // First check if user already has a MeToken
      logger.debug('🔍 Checking for existing MeToken before creation...');
      try {
        await checkUserMeToken();
        if (userMeToken) {
          setLocalError('You already have a MeToken. Please use the existing one or contact support if you need to create a new one.');
          return;
        }

        // Also check subgraph for any MeTokens that might not be in database yet
        logger.debug('🔍 Checking subgraph for existing MeTokens...');
        const { meTokensSubgraph } = await import('@/lib/sdk/metokens/subgraph');
        const allMeTokens = await meTokensSubgraph.getAllMeTokens(20, 0);
        logger.debug(`Found ${allMeTokens.length} recent MeTokens in subgraph`);

        // Check if any of these MeTokens belong to our user
        const recentTokens = allMeTokens.slice(0, 5);
        if (recentTokens.length > 0) {
          try {
            const { getBulkMeTokenInfo } = await import('@/lib/utils/metokenUtils');
            const recentTokenIds = recentTokens.map(t => t.id);
            logger.debug('📦 Bulk checking ownership for:', recentTokenIds);
            const results = await getBulkMeTokenInfo(recentTokenIds);

            for (const id of recentTokenIds) {
              const info = results[id];
              if (info && info.owner.toLowerCase() === user?.address?.toLowerCase()) {
                logger.debug('✅ Found existing MeToken for user via bulk check:', id);
                setLocalError('You already have a MeToken. Please use the "Sync Existing MeToken" button to load it.');
                return;
              }
            }
          } catch (err) {
            logger.warn('Failed to check MeToken ownership via bulk info:', err);
          }
        }
      } catch (checkErr) {
        logger.debug('ℹ️ No existing MeToken found, proceeding with creation...');
      }

      logger.debug('📝 Calling createMeToken with:', name.trim(), symbol.trim().toUpperCase(), selectedHub.hubId, collateralAmount);
      await createMeToken(name.trim(), symbol.trim().toUpperCase(), selectedHub.hubId, collateralAmount);
      logger.debug('✅ createMeToken completed successfully');
      // Don't set success here - let the hook handle the state
    } catch (err) {
      logger.error('❌ Error in createMeToken:', err);

      // Handle specific error cases with user-friendly messages
      let errorMessage = 'Failed to create MeToken';
      if (err instanceof Error) {
        if (err.message.includes('already have a MeToken') || err.message.includes('already owns')) {
          errorMessage = 'You already have a MeToken! Please use the "Sync Existing MeToken" button to load it, ' +
            'or contact support if you need to create a new one.';
        } else if (err.message.includes('User denied') || err.message.includes('User rejected')) {
          errorMessage = 'Transaction was cancelled by user.';
        } else if (err.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient funds to complete the transaction.';
        } else if (err.message.includes('gas')) {
          errorMessage = 'Transaction failed due to gas issues. Please try again.';
        } else {
          errorMessage = err.message;
        }
      }

      setLocalError(errorMessage);
    }
  };

  const isLoading = isPending || isConfirming;
  const hasError = localError || transactionError;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>Create Your MeToken</span>
          {isConfirmed && <CheckCircle className="h-5 w-5 text-green-500" />}
        </CardTitle>
        <CardDescription>
          Create your personal token to build a community around your success.
          Your MeToken will be tradeable and can appreciate in value based on demand.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!user && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please connect your smart account wallet to create a MeToken.
            </AlertDescription>
          </Alert>
        )}

        {hasError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {localError || (transactionError?.message ? `Transaction failed: ${transactionError.message}` : 'An error occurred')}
            </AlertDescription>
          </Alert>
        )}

        {isPending && (
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>
              Creating MeToken... Please confirm the transaction in your wallet.
            </AlertDescription>
          </Alert>
        )}

        {isConfirming && (
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>
              Transaction submitted! Waiting for confirmation...
            </AlertDescription>
          </Alert>
        )}

        {isConfirmed && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              MeToken created successfully! Your personal token is now live.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">MeToken Name</Label>
            <Input
              id="name"
              placeholder="e.g., John's MeToken"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
            />
            <p className="text-sm text-muted-foreground">
              This will be the full name of your MeToken
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="symbol">Symbol</Label>
            <Input
              id="symbol"
              placeholder="e.g., JOHN"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              disabled={isLoading}
              maxLength={10}
            />
            <p className="text-sm text-muted-foreground">
              Short symbol for your MeToken (max 10 characters)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="hubId">Collateral Hub</Label>
            <Select
              value={selectedHubId !== undefined ? String(selectedHubId) : undefined}
              onValueChange={(v) => setSelectedHubId(Number(v))}
              disabled={isLoading || hubsLoading || activeHubs.length === 0}
            >
              <SelectTrigger id="hubId">
                <SelectValue placeholder="Select collateral asset" />
              </SelectTrigger>
              <SelectContent>
                {activeHubs.map((hub) => (
                  <SelectItem key={hub.hubId} value={String(hub.hubId)}>
                    <span className="flex items-center gap-2">
                      <Image
                        src={getTokenIcon(hub.symbol, 8453)}
                        alt={hub.symbol}
                        width={20}
                        height={20}
                        className="h-5 w-5 rounded-full"
                      />
                      Hub {hub.hubId} — {hub.displayName}
                      {hub.recommended ? ' (Recommended)' : ''}
                      {hub.deprecated ? ' (Legacy)' : ''}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Every MeToken is backed by a stablecoin you choose. <strong>USDC is recommended</strong> for broad appeal;
              USDS suits decentralized savings; GHO fits advanced DeFi users.
            </p>
            <CollateralHubGuide hub={selectedHub ?? null} className="py-3" />
            {activeHubs.length > 1 && (
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                {(['USDC', 'USDS', 'GHO'] as const).map((sym) => {
                  const hub = activeHubs.find((h) => h.symbol === sym);
                  if (!hub) return null;
                  return <li key={sym}>{STABLECOIN_SUMMARY[sym]}</li>;
                })}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="collateralAmount">Initial {collateralSymbol} Deposit (Optional)</Label>
            <Input
              id="collateralAmount"
              type="number"
              placeholder="0"
              value={collateralAmount}
              onChange={(e) => setCollateralAmount(e.target.value)}
              disabled={isLoading}
              min="0"
              step={collateralSymbol === 'USDC' ? '0.01' : '0.01'}
            />
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                Amount of {collateralSymbol} to deposit when creating your MeToken
              </p>
              {collateralSymbol === 'USDC' && (
              <Alert className="py-2">
                <Info className="h-3 w-3" />
                <AlertDescription className="text-xs">
                  <strong>Need USDC?</strong> Use the account menu to buy USDC with Coinbase or swap from other tokens.
                </AlertDescription>
              </Alert>
              )}
              {collateralSymbol === 'DAI' && (
              <Alert className="py-2">
                <Info className="h-3 w-3" />
                <AlertDescription className="text-xs">
                  DAI is legacy collateral. USDC is recommended for new MeTokens; USDS is the decentralized successor to DAI.
                </AlertDescription>
              </Alert>
              )}
              {collateralSymbol === 'USDS' && (
              <Alert className="py-2">
                <Info className="h-3 w-3" />
                <AlertDescription className="text-xs">
                  USDS is Sky&apos;s upgrade from DAI. Use the wallet swap tool to convert ETH or USDC into USDS before depositing.
                </AlertDescription>
              </Alert>
              )}
              {collateralSymbol === 'GHO' && (
              <Alert className="py-2">
                <Info className="h-3 w-3" />
                <AlertDescription className="text-xs">
                  Need GHO? Swap from ETH or other stables in the account menu, or mint via Aave on Base.
                </AlertDescription>
              </Alert>
              )}
            </div>
          </div>
        </div>

        <div className="pt-4">
          <Button
            onClick={handleCreateMeToken}
            disabled={!user || isLoading || !name.trim() || !symbol.trim() || isConfirmed}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isPending ? 'Creating...' : isConfirming ? 'Confirming...' : 'Creating MeToken...'}
              </>
            ) : isConfirmed ? (
              'MeToken Created!'
            ) : (
              'Create MeToken'
            )}
          </Button>
        </div>

        <div className="text-sm text-muted-foreground space-y-2">
          <p><strong>What happens when you create a MeToken:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Your token is backed by <strong>{selectedHub?.displayName ?? collateralSymbol}</strong> on Hub {selectedHub?.hubId ?? 1}</li>
            <li>It will be tradeable through the MeTokens bonding curve AMM</li>
            <li>Community members can buy and hold your token</li>
            <li>You can earn from trading fees and token appreciation</li>
            <li>Your token can be used for token-gated features</li>
          </ul>
          <Alert className="mt-4">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Pro Tip:</strong> You can start with 0 {collateralSymbol} and add liquidity later.
              Initial deposits help bootstrap your token&apos;s value.
            </AlertDescription>
          </Alert>
        </div>
      </CardContent>
    </Card>
  );
}
