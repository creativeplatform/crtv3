"use client";
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { useMeTokensSupabase, MeTokenData } from '@/lib/hooks/metokens/useMeTokensSupabase';
import { useUser } from '@/lib/wallet/react';
import { RobustMeTokenCreator } from './RobustMeTokenCreator';
import { MeTokenTrading } from './MeTokenTrading';
import { MeTokenInfo } from './MeTokenInfo';
import { CreatorProfileManager } from './CreatorProfileManager';
import { MeTokenHistory } from './MeTokenHistory';
import { TokenPriceChart } from '@/components/Market/TokenPriceChart';
import { Loader2, AlertCircle, Plus, TrendingUp, Info, RefreshCw, Search, Wallet, User, History, Copy, Check, Coins, DollarSign, BarChart3 } from 'lucide-react';
import { formatEther } from 'viem';
import { logger } from '@/lib/utils/logger';

interface MeTokensSectionProps {
  walletAddress?: string;
}

export function MeTokensSection({ walletAddress }: MeTokensSectionProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [userMeToken, setUserMeToken] = useState<MeTokenData | null>(null);
  const [manualMeTokenAddress, setManualMeTokenAddress] = useState('');
  const [isCheckingManual, setIsCheckingManual] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const user = useUser();
  const { toast } = useToast();

  const {
    userMeToken: hookMeToken,
    loading,
    error,
    isConfirmed,
    checkSpecificMeToken,
    checkUserMeToken
  } = useMeTokensSupabase(walletAddress);

  // Update local state when hook data changes
  useEffect(() => {
    setUserMeToken(hookMeToken || null);
  }, [hookMeToken]);

  // Reset to overview tab when MeToken is created
  useEffect(() => {
    if (isConfirmed && !userMeToken) {
      setActiveTab('overview');
    }
  }, [isConfirmed, userMeToken]);

  const handleMeTokenCreated = (meTokenAddress: string) => {
    // Refresh the MeToken data
    logger.debug('MeToken created:', meTokenAddress);
    setActiveTab('overview');
  };

  const handleRefresh = async () => {
    // Refresh MeToken data without reloading the page
    if (checkUserMeToken) {
      await checkUserMeToken();
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAddress(label);
      toast({
        title: "Copied!",
        description: `${label} address copied to clipboard`,
      });
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please try again manually",
        variant: "destructive",
      });
    }
  };

  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleSyncExistingMeToken = async () => {
    // Early validation for walletAddress
    if (!walletAddress) {
      toast({
        title: "Wallet Not Connected",
        description: "No wallet address available. Please ensure you are logged in.",
        variant: "destructive",
      });
      return;
    }

    setIsSyncing(true);

    try {
      logger.debug('🔄 Attempting to sync existing MeToken from subgraph...');

      toast({
        title: "Syncing MeToken",
        description: "Searching for your MeToken in the subgraph...",
      });

      // Import the subgraph client
      const { meTokensSubgraph } = await import('@/lib/sdk/metokens/subgraph');

      // Get recent MeTokens from subgraph
      const allMeTokens = await meTokensSubgraph.getAllMeTokens(50, 0);
      logger.debug(`Found ${allMeTokens.length} recent MeTokens in subgraph`);

      if (allMeTokens.length > 0) {
        // Try to sync the most recent ones to database
        for (const meToken of allMeTokens.slice(0, 10)) {
          try {
            logger.debug('💾 Attempting to sync MeToken:', meToken.id);
            const syncResponse = await fetch('/api/metokens/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ meTokenAddress: meToken.id })
            });

            if (syncResponse.ok) {
              const syncData = await syncResponse.json();
              logger.debug('✅ Synced MeToken:', syncData);

              // Check if this one belongs to our user
              if (syncData.data?.owner_address?.toLowerCase() === walletAddress.toLowerCase()) {
                logger.debug('🎯 Found our MeToken!');
                toast({
                  title: "MeToken Found!",
                  description: "Your MeToken has been synced successfully.",
                });
                await handleRefresh(); // Refresh to show the synced MeToken
                return;
              }
            }
          } catch (syncErr) {
            logger.warn('Failed to sync MeToken:', meToken.id, syncErr);
          }
        }
      }

      toast({
        title: "No MeToken Found",
        description: "No existing MeToken found in the subgraph. If you recently created a MeToken, please wait a few minutes for the subgraph to sync, then try again.",
        variant: "destructive",
      });
    } catch (err) {
      logger.error('Failed to sync existing MeToken:', err);
      toast({
        title: "Sync Failed",
        description: "Failed to sync existing MeToken. Please try again or contact support.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCheckManualMeToken = async () => {
    if (!manualMeTokenAddress.trim()) return;

    const address = manualMeTokenAddress.trim();

    // Validate address format
    if (!address.startsWith('0x') || address.length !== 42) {
      toast({
        title: "Invalid Address Format",
        description: "Please enter a valid Ethereum address (0x followed by 40 hex characters). Note: Do not paste the transaction hash - you need to find the MeToken contract address from the \"Internal Txns\" tab on Basescan.",
        variant: "destructive",
      });
      return;
    }

    setIsCheckingManual(true);

    try {
      toast({
        title: "Checking MeToken",
        description: "Syncing MeToken from blockchain...",
      });

      // First, try to sync the MeToken from blockchain to database
      const syncResponse = await fetch('/api/metokens/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meTokenAddress: address })
      });

      if (syncResponse.ok) {
        const syncData = await syncResponse.json();
        logger.debug('MeToken synced:', syncData);

        // Now check if it belongs to this user
        const result = await checkSpecificMeToken(manualMeTokenAddress.trim());
        if (result) {
          toast({
            title: "MeToken Found!",
            description: "Your MeToken has been synced and loaded successfully.",
          });
          setActiveTab('overview');
          setManualMeTokenAddress('');
        } else {
          toast({
            title: "MeToken Not Yours",
            description: "MeToken found on blockchain, but it does not belong to this wallet address.",
            variant: "destructive",
          });
        }
      } else {
        const error = await syncResponse.json();
        logger.error('Sync failed:', error);
        toast({
          title: "Sync Failed",
          description: `Failed to sync MeToken: ${error.error || 'Unknown error'}`,
          variant: "destructive",
        });
      }
    } catch (err) {
      logger.error('Failed to check manual MeToken:', err);
      toast({
        title: "Check Failed",
        description: "Failed to check MeToken. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCheckingManual(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading MeTokens...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load MeTokens: {error}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-6 w-6" />
                MeTokens
              </CardTitle>
              <CardDescription>
                Create and manage your personal token to build a community around your success
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              MeTokens are personal tokens that allow your community to invest in your future success.
              They can be traded, appreciate in value, and provide utility through token-gated features.
            </AlertDescription>
          </Alert>

          {walletAddress && (
            <Alert>
              <Wallet className="h-4 w-4" />
              <AlertDescription className="space-y-3">
                <div className="font-semibold text-sm">Your Token Address:</div>
                <div className="space-y-3">

                  {/* MeToken Address - only show if MeToken exists */}
                  {userMeToken?.address && (
                    <div className="space-y-1 pt-2 border-t">
                      <p className="text-xs sm:text-sm font-medium text-muted-foreground">MeToken Address</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="relative rounded bg-muted px-2 py-1.5 font-mono text-xs sm:text-sm break-all sm:break-normal overflow-wrap-anywhere">
                          {formatAddress(userMeToken.address)}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 sm:h-6 sm:w-6 flex-shrink-0"
                          onClick={() => copyToClipboard(userMeToken.address, 'MeToken')}
                        >
                          {copiedAddress === 'MeToken' ? (
                            <Check className="h-3.5 w-3.5 sm:h-3 sm:w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
                          )}
                          <span className="sr-only">Copy MeToken address</span>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                {!userMeToken && (
                  <div className="text-xs text-muted-foreground pt-2 border-t">
                    💡 <strong>Note:</strong> When you create a MeToken, it will be owned by your{' '}
                    <strong>Account Address</strong> ({formatAddress(walletAddress)}).
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {userMeToken ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Mobile: Select dropdown */}
          <div className="sm:hidden mb-4">
            <Select value={activeTab} onValueChange={setActiveTab}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a tab" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overview">Overview</SelectItem>
                <SelectItem value="profile">Profile</SelectItem>
                <SelectItem value="trading">Trading</SelectItem>
                <SelectItem value="info">Details</SelectItem>
                <SelectItem value="history">History</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Desktop: Tab grid */}
          <TabsList className="hidden sm:grid h-auto w-full grid-cols-3 md:grid-cols-5 gap-1">
            <TabsTrigger value="overview" className="flex items-center justify-center gap-2">
              <Info className="h-4 w-4" />
              <span className="hidden sm:inline">Overview</span>
              <span className="sm:hidden">View</span>
            </TabsTrigger>
            <TabsTrigger value="profile" className="flex items-center justify-center gap-2">
              <User className="h-4 w-4" />
              <span>Profile</span>
            </TabsTrigger>
            <TabsTrigger value="trading" className="flex items-center justify-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Trading</span>
              <span className="sm:hidden">Trade</span>
            </TabsTrigger>
            <TabsTrigger value="info" className="flex items-center justify-center gap-2">
              <Info className="h-4 w-4" />
              <span className="hidden sm:inline">Details</span>
              <span className="sm:hidden">Info</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center justify-center gap-2">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">History</span>
              <span className="sm:hidden">Log</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Your MeToken: {userMeToken.name}</CardTitle>
                <CardDescription>
                  ${userMeToken.symbol} - Total Value Locked: ${userMeToken.tvl.toFixed(2)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                  {/* Your Balance */}
                  <div className="rounded-lg border bg-muted/30 p-4 sm:p-5 space-y-2 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-md bg-blue-500/10">
                        <Coins className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <p className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wide">Your Balance</p>
                    </div>
                    <p className="text-2xl sm:text-3xl font-bold tracking-tight truncate" title={(parseFloat(userMeToken.balance.toString()) / 1e18).toString()}>
                      {(parseFloat(userMeToken.balance.toString()) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 4 })} <span className="text-base sm:text-lg text-muted-foreground">{userMeToken.symbol}</span>
                    </p>
                  </div>

                  {/* Total Supply */}
                  <div className="rounded-lg border bg-muted/30 p-4 sm:p-5 space-y-2 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-md bg-purple-500/10">
                        <BarChart3 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      </div>
                      <p className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wide">Total Supply</p>
                    </div>
                    <p className="text-2xl sm:text-3xl font-bold tracking-tight truncate" title={(parseFloat(userMeToken.totalSupply.toString()) / 1e18).toString()}>
                      {(parseFloat(userMeToken.totalSupply.toString()) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 4 })} <span className="text-base sm:text-lg text-muted-foreground">{userMeToken.symbol}</span>
                    </p>
                  </div>

                  {/* TVL */}
                  <div className="rounded-lg border bg-muted/30 p-4 sm:p-5 space-y-2 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-md bg-green-500/10">
                        <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
                      </div>
                      <p className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wide">TVL</p>
                    </div>
                    <p className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-500 tracking-tight truncate" title={`$${userMeToken.tvl.toFixed(2)}`}>
                      ${userMeToken.tvl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>

                  {/* Price */}
                  <div className="rounded-lg border bg-muted/30 p-4 sm:p-5 space-y-2 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-md bg-orange-500/10">
                        <TrendingUp className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                      </div>
                      <p className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wide">Price</p>
                    </div>
                    <p className="text-2xl sm:text-3xl font-bold tracking-tight truncate">
                      {userMeToken.totalSupply > BigInt(0)
                        ? '$' + (userMeToken.tvl / parseFloat(formatEther(userMeToken.totalSupply))).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })
                        : '-'
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Price Chart */}
            {userMeToken.address && (
              <TokenPriceChart
                tokenAddress={userMeToken.address}
                tokenSymbol={userMeToken.symbol}
                height={400}
                showControls={true}
              />
            )}
          </TabsContent>

          <TabsContent value="profile">
            <CreatorProfileManager targetAddress={walletAddress} onProfileUpdated={() => { }} />
          </TabsContent>

          <TabsContent value="trading">
            <MeTokenTrading meToken={userMeToken} onRefresh={handleRefresh} />
          </TabsContent>

          <TabsContent value="info">
            <MeTokenInfo meToken={userMeToken} />
          </TabsContent>

          <TabsContent value="history">
            <MeTokenHistory meToken={userMeToken} />
          </TabsContent>
        </Tabs>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1">
            <TabsTrigger value="overview" className="flex items-center justify-center gap-2">
              <Info className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="create" className="flex items-center justify-center gap-2">
              <Plus className="h-4 w-4" />
              Create MeToken
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>No MeToken Found</CardTitle>
                <CardDescription>
                  You haven&apos;t created a MeToken yet. Create one to start building your community!
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    MeTokens are personal tokens that represent your future success.
                    Community members can buy and hold your token, and it can appreciate in value based on demand.
                  </AlertDescription>
                </Alert>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <h4 className="font-semibold">Benefits of Creating a MeToken:</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Build a community around your success</li>
                      <li>• Earn from trading fees and token appreciation</li>
                      <li>• Create token-gated features and utilities</li>
                      <li>• Access to DeFi yield strategies</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold">How It Works:</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Deploy your personal ERC20 token</li>
                      <li>• Integrated with automated market maker</li>
                      <li>• Built-in pump-and-dump protection</li>
                      <li>• Community can buy/sell anytime</li>
                    </ul>
                  </div>
                </div>

                {/* Manual MeToken Check Section */}
                <div className="border-t pt-4 mt-6">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    Already Created a MeToken?
                  </h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    If you&apos;ve already created a MeToken but it&apos;s not showing up, enter the contract address below to sync it.
                  </p>
                  <Alert className="mb-4">
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      <strong>How to find your MeToken address:</strong><br />
                      1. Go to your creation transaction on Basescan<br />
                      2. Click the <strong>&quot;Internal Txns&quot;</strong> tab<br />
                      3. Look for <strong>&quot;Contract Creation&quot;</strong><br />
                      4. Copy the contract address (42 characters starting with 0x)
                    </AlertDescription>
                  </Alert>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="manual-address">MeToken Contract Address (not transaction hash)</Label>
                      <Input
                        id="manual-address"
                        placeholder="0x1234...abcd (42 characters)"
                        value={manualMeTokenAddress}
                        onChange={(e) => setManualMeTokenAddress(e.target.value)}
                        disabled={isCheckingManual}
                      />
                    </div>
                    <Button
                      onClick={handleCheckManualMeToken}
                      disabled={!manualMeTokenAddress.trim() || isCheckingManual}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      {isCheckingManual ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                      Check MeToken
                    </Button>
                  </div>

                  {/* Auto-sync section */}
                  <div className="border-t pt-4 mt-4">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <RefreshCw className="h-4 w-4" />
                      Auto-Sync from Subgraph
                    </h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      If you recently created a MeToken but it&apos;s not showing up, try syncing from the subgraph.
                    </p>
                    <Button
                      onClick={handleSyncExistingMeToken}
                      disabled={isSyncing}
                      variant="secondary"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      {isSyncing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4" />
                          Sync Existing MeToken
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Error recovery section */}
                  <div className="border-t pt-4 mt-4">
                    <h4 className="font-semibold mb-3 flex items-center gap-2 text-orange-600">
                      <AlertCircle className="h-4 w-4" />
                      Getting &quot;Already Owns MeToken&quot; Error?
                    </h4>
                    <Alert className="mb-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>This error means you already have a MeToken!</strong><br />
                        The system detected that your wallet address already owns a MeToken.
                        Try the &quot;Sync Existing MeToken&quot; button above, or if that doesn&apos;t work,
                        you can manually enter your MeToken contract address.
                      </AlertDescription>
                    </Alert>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        <strong>Quick Fix:</strong> Use the &quot;Sync Existing MeToken&quot; button above to automatically find and load your MeToken.
                      </p>
                      <p className="text-sm text-muted-foreground">
                        <strong>Manual Fix:</strong> If auto-sync doesn&apos;t work, find your MeToken contract address from your creation transaction and enter it above.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="create">
            <RobustMeTokenCreator onMeTokenCreated={handleMeTokenCreated} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
