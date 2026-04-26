"use client";

/**
 * AccountDropdown Component
 *
 * This component serves as the primary user account interface for the application,
 * handling wallet connections, network switching integrations.
 *
 * KEY ARCHITECTURE NOTES:
 * 1. INTEGRATION POINTS:
 *    - Account Kit: For wallet connection and chain management
 *
 *
 * 2. STATE MANAGEMENT:
 *    - EOA Signer: Required for Account Kit authentication (ECDSA signatures)
 *    - Unified Session Signer: Manages session authentication with Account Kit
 *    - Chain state: Handles network switching between supported chains
 *
 * 3. IMPORTANT WORKFLOWS:
 *    - Authentication: EOA signer must be initialized before Account Kit auth
 *    - Session Signatures: By Account Kit
 *    - Chain Switching: Changes the network for Account Kit integration
 */

import { useState, useEffect } from "react";
import {
  useAuthModal,
  useLogout,
  useUser,
  useChain,
  useSmartAccountClient,
  useSendUserOperation,
} from "@account-kit/react";
import { base } from "@account-kit/infra";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Copy,
  LogOut,
  Send,
  ArrowUpRight,
  ArrowUpDown,
  Key,
  Loader2,
  CloudUpload,
  RadioTower,
  Bot,
  ShieldUser,
  Plus,
  ArrowRight,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import { CheckIcon } from "@radix-ui/react-icons";
import Image from "next/image";
import { GatewayImage } from "@/components/ui/gateway-image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogDescription,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import CoinbaseFundButton from "@/components/wallet/buy/coinbase-fund-button";
import { LoginButton } from "@/components/auth/LoginButton";
import { AlchemySwapWidget } from "@/components/wallet/swap/AlchemySwapWidget";
import useModularAccount from "@/lib/hooks/accountkit/useModularAccount";
import { TokenBalance } from "@/components/wallet/balance/TokenBalance";
import { MeTokenBalances } from "@/components/wallet/balance/MeTokenBalances";
import makeBlockie from "ethereum-blockies-base64";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { useSessionKey } from "@/lib/hooks/accountkit/useSessionKey";
import {
  HookType,
  getDefaultSingleSignerValidationModuleAddress,
  SingleSignerValidationModule,
  getDefaultTimeRangeModuleAddress,
  TimeRangeModule,
  getDefaultNativeTokenLimitModuleAddress,
  NativeTokenLimitModule,
  getDefaultAllowlistModuleAddress,
  AllowlistModule,
  installValidationActions,
} from "@account-kit/smart-contracts/experimental";
import { parseEther, type Address, type Hex, encodeFunctionData, parseAbi, parseUnits, formatUnits, erc20Abi } from "viem";
import { logger } from "@/lib/utils/logger";
import { appendBuilderCode } from "@/lib/utils/builder-code";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { USDC_TOKEN_ADDRESSES, USDC_TOKEN_DECIMALS } from "@/lib/contracts/USDCToken";
import { DAI_TOKEN_ADDRESSES, DAI_TOKEN_DECIMALS } from "@/lib/contracts/DAIToken";
import { useSessionKeyStorage } from "@/lib/hooks/accountkit/useSessionKeyStorage";
import { MembershipSection } from "./MembershipSection";
import { shortenAddress } from "@/lib/utils/utils";
import Link from "next/link";
import { useMembershipVerification } from "@/lib/hooks/unlock/useMembershipVerification";
import { Skeleton } from "@/components/ui/skeleton";
import { useMeTokensSupabase } from "@/lib/hooks/metokens/useMeTokensSupabase";
import { useMeTokenHoldings } from "@/lib/hooks/metokens/useMeTokenHoldings";
import { chains } from "@/config";
import { HydrationSafe } from "@/components/ui/hydration-safe";
import { useMembershipNFTs, type MembershipNFT } from "@/lib/hooks/unlock/useMembershipNFTs";
import { LOCK_ADDRESSES } from "@/lib/sdk/unlock/services";

const chainIconMap: Record<number, string> = {
  [base.id]: "/images/chains/base.svg",
};

function getChainIcon(chain: { id: number }) {
  return chainIconMap[chain.id] || "/images/chains/default-chain.svg";
}

function NetworkStatus({ isConnected }: { isConnected: boolean }) {
  return (
    <div className="flex items-center">
      {isConnected ? (
        <svg
          className="h-3 w-3 text-green-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="2"
            fill="currentColor"
          />
        </svg>
      ) : (
        <svg
          className="h-3 w-3 text-red-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="2"
            fill="currentColor"
          />
        </svg>
      )}
    </div>
  );
}

interface SessionKeyConfig {
  type: "global" | "time-limited" | "token-limited" | "allowlist";
  permissions: {
    isGlobal: boolean;
    timeLimit?: number;
    spendingLimit?: bigint;
    allowedAddresses?: string[];
    allowedFunctions?: string[];
  };
}

// Token configuration for send modal
type TokenSymbol = 'ETH' | 'USDC' | 'DAI';

const getTokenIcon = (symbol: TokenSymbol, chainId?: number) => {
  const isBase = chainId === 8453;
  switch (symbol) {
    case "ETH":
      return isBase ? "/images/tokens/ETH_on_Base.svg" : "/images/tokens/eth-logo.svg";
    case "USDC":
      return isBase ? "/images/tokens/USDC_on_Base.svg" : "/images/tokens/usdc-logo.svg";
    case "DAI":
      return isBase ? "/images/tokens/DAI_on_Base.svg" : "/images/tokens/dai-logo.svg";
    default:
      return "/images/tokens/eth-logo.svg";
  }
};

// Helper function to get token info for the current chain
const getTokenInfo = (chainId?: number) => {
  const chainKey = chainId === base.id ? "base" : undefined;

  return {
    ETH: {
      decimals: 18,
      symbol: "ETH",
      address: null, // Native token
    },
    USDC: {
      decimals: USDC_TOKEN_DECIMALS,
      symbol: "USDC",
      address: chainKey ? (USDC_TOKEN_ADDRESSES as any)[chainKey] : undefined,
    },
    DAI: {
      decimals: DAI_TOKEN_DECIMALS,
      symbol: "DAI",
      address: chainKey ? (DAI_TOKEN_ADDRESSES as any)[chainKey] : undefined,
    },
  } as const;
};

const SESSION_KEY_TYPES: SessionKeyConfig[] = [
  {
    type: "global",
    permissions: {
      isGlobal: true,
    },
  },
  {
    type: "time-limited",
    permissions: {
      isGlobal: false,
      timeLimit: 24 * 60 * 60, // 24 hours
    },
  },
  {
    type: "token-limited",
    permissions: {
      isGlobal: false,
      spendingLimit: parseEther("1"), // 1 ETH
    },
  },
  {
    type: "allowlist",
    permissions: {
      isGlobal: false,
      allowedAddresses: [],
      allowedFunctions: [],
    },
  },
];

export function AccountDropdown() {
  const { openAuthModal } = useAuthModal();
  const user = useUser();
  const { logout } = useLogout();
  const { chain, setChain, isSettingChain } = useChain();
  const [displayAddress, setDisplayAddress] = useState<string>("");
  const [isNetworkConnected, setIsNetworkConnected] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isArrowUp, setIsArrowUp] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [dialogAction, setDialogAction] = useState<
    "buy" | "send" | "swap" | "session-keys"
  >("buy");
  const { sessionKeys, addSessionKey, removeSessionKey } =
    useSessionKeyStorage();
  const [selectedKeyType, setSelectedKeyType] = useState<SessionKeyConfig>(
    SESSION_KEY_TYPES[0]
  );
  const [customAddress, setCustomAddress] = useState<string>("");
  const [customSpendLimit, setCustomSpendLimit] = useState<string>("1");
  const [customTimeLimit, setCustomTimeLimit] = useState<string>("24");
  const [recipientAddress, setRecipientAddress] = useState<string>("");
  const [sendAmount, setSendAmount] = useState<string>("");
  const [isSending, setIsSending] = useState(false);
  const [selectedToken, setSelectedToken] = useState<TokenSymbol>('ETH');
  const [sendType, setSendType] = useState<'token' | 'nft'>('token');
  const [selectedNFT, setSelectedNFT] = useState<MembershipNFT | null>(null);
  const [tokenBalances, setTokenBalances] = useState<Record<TokenSymbol, string>>({
    ETH: '0',
    USDC: '0',
    DAI: '0',
  });
  const { nfts: membershipNFTs, isLoading: isLoadingNFTs } = useMembershipNFTs();
  const { toast } = useToast();
  const [isLinksLoading, setIsLinksLoading] = useState(false);

  const { createSessionKey, isInstalling } = useSessionKey({
    permissions: {
      isGlobal: false,
      allowedFunctions: [],
      timeLimit: 24 * 60 * 60, // 24 hours
      spendingLimit: BigInt(1e18), // 1 ETH
    },
  });

  const { account, address: smartAccountAddress } = useModularAccount();
  const { client } = useSmartAccountClient({});
  const validationClient = chain
    ? (client?.extend(installValidationActions as any) as any)
    : undefined;

  const { isVerified, hasMembership, isLoading: isMembershipLoading, error: membershipError, membershipDetails } = useMembershipVerification();

  const isBrandMember = membershipDetails?.some((m) => m.isValid && m.address === LOCK_ADDRESSES.BASE_CREATIVE_PASS_3);

  // Check for MeTokens to conditionally render the section
  const { userMeToken, loading: meTokenLoading } = useMeTokensSupabase();
  const { holdings, loading: holdingsLoading } = useMeTokenHoldings();
  const hasMetokens = !!userMeToken || holdings.length > 0;
  const shouldShowMetokens = hasMetokens || meTokenLoading || holdingsLoading;

  useEffect(() => {
    logger.debug('Account state:', {
      "EOA Address (user.address)": user?.address,
      "Smart Contract Account Address": smartAccountAddress,
    });
  }, [smartAccountAddress, user]);

  useEffect(() => {
    let newDisplayAddress = "";
    // Smart Wallet is the primary public identity for Creative TV
    // EOA is kept in background for signing and permissions
    if (smartAccountAddress) {
      newDisplayAddress = `${smartAccountAddress.slice(0, 6)}...${smartAccountAddress.slice(-4)}`;
    } else if (user?.address) {
      // Fallback to EOA only if Smart Wallet is not available
      newDisplayAddress = `${user.address.slice(0, 6)}...${user.address.slice(-4)}`;
    }
    // Only update if value actually changes
    if (displayAddress !== newDisplayAddress)
      setDisplayAddress(newDisplayAddress);
  }, [user, smartAccountAddress, displayAddress]);

  useEffect(() => {
    const checkNetworkStatus = async () => {
      try {
        if (user?.type === "eoa") {
          setIsNetworkConnected(true);
          return;
        }
        setIsNetworkConnected(true);
      } catch {
        setIsNetworkConnected(false);
      }
    };
    const interval = setInterval(checkNetworkStatus, 10000);
    checkNetworkStatus();
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    setIsDialogOpen(false);
  }, [user]);

  // Fetch token balances when dialog opens with send action
  useEffect(() => {
    const fetchTokenBalances = async () => {
      if (!client || !smartAccountAddress || dialogAction !== 'send' || !isDialogOpen) return;

      try {
        // Get ETH balance
        const ethBalance = await client.getBalance({
          address: smartAccountAddress as Address,
        });

        // Resolve per-chain ERC-20 addresses (Base only for now)
        const chainKey = chain?.id === base.id ? "base" : undefined;
        let usdc = 0n;
        let dai = 0n;

        if (chainKey) {
          const usdcAddr = (USDC_TOKEN_ADDRESSES as any)[chainKey] as Address | undefined;
          const daiAddr = (DAI_TOKEN_ADDRESSES as any)[chainKey] as Address | undefined;

          if (usdcAddr) {
            usdc = await client.readContract({
              address: usdcAddr,
              abi: erc20Abi,
              functionName: 'balanceOf',
              args: [smartAccountAddress as Address],
            }) as bigint;
          }

          if (daiAddr) {
            dai = await client.readContract({
              address: daiAddr,
              abi: erc20Abi,
              functionName: 'balanceOf',
              args: [smartAccountAddress as Address],
            }) as bigint;
          }
        }

        setTokenBalances({
          ETH: formatUnits(ethBalance, 18),
          USDC: formatUnits(usdc, USDC_TOKEN_DECIMALS),
          DAI: formatUnits(dai, DAI_TOKEN_DECIMALS),
        });
      } catch (error) {
        logger.error('Error fetching token balances:', error);
      }
    };

    fetchTokenBalances();
  }, [client, smartAccountAddress, dialogAction, isDialogOpen, chain?.id]);

  const copyToClipboard = async () => {
    // Copy Smart Wallet address as primary identity
    // EOA is kept in background for signing operations
    const addressToCopy = smartAccountAddress || user?.address;
    if (addressToCopy) {
      try {
        await navigator.clipboard.writeText(addressToCopy);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
        // Optionally close dropdown after copying
        // setIsDropdownOpen(false);
      } catch { }
    }
  };

  const handleActionClick = (
    action: "buy" | "send" | "swap" | "session-keys"
  ) => {
    setDialogAction(action);
    setIsDialogOpen(true);
    setIsDropdownOpen(false); // Close dropdown when action is clicked
  };

  const handleChainSwitch = async (newChain: any) => {
    if (isSettingChain) return;
    if (chain.id === newChain.id) return;
    setChain({ chain: newChain });
  };

  const handleCreateSessionKey = async () => {
    if (!smartAccountAddress) return;

    try {
      const sessionKeyEntityId = sessionKeys.length + 1;
      const ecdsaValidationModuleAddress =
        getDefaultSingleSignerValidationModuleAddress(chain);
      const hookEntityId = sessionKeys.length; // Use different hook IDs for each key

      let hooks = [];

      switch (selectedKeyType.type) {
        case "time-limited":
          hooks.push({
            hookConfig: {
              address: getDefaultTimeRangeModuleAddress(chain),
              entityId: hookEntityId,
              hookType: HookType.VALIDATION,
              hasPreHooks: true,
              hasPostHooks: false,
            },
            initData: TimeRangeModule.encodeOnInstallData({
              entityId: hookEntityId,
              validAfter: Math.floor(Date.now() / 1000),
              validUntil:
                Math.floor(Date.now() / 1000) +
                parseInt(customTimeLimit) * 60 * 60,
            }),
          });
          break;

        case "token-limited":
          hooks.push({
            hookConfig: {
              address: getDefaultNativeTokenLimitModuleAddress(chain),
              entityId: hookEntityId,
              hookType: HookType.VALIDATION,
              hasPreHooks: true,
              hasPostHooks: false,
            },
            initData: NativeTokenLimitModule.encodeOnInstallData({
              entityId: hookEntityId,
              spendLimit: parseEther(customSpendLimit),
            }),
          });
          break;

        case "allowlist":
          if (customAddress) {
            hooks.push({
              hookConfig: {
                address: getDefaultAllowlistModuleAddress(chain),
                entityId: hookEntityId,
                hookType: HookType.VALIDATION,
                hasPreHooks: true,
                hasPostHooks: false,
              },
              initData: AllowlistModule.encodeOnInstallData({
                entityId: hookEntityId,
                inputs: [
                  {
                    target: customAddress as `0x${string}`,
                    hasSelectorAllowlist: false,
                    hasERC20SpendLimit: false,
                    erc20SpendLimit: parseEther("0"),
                    selectors: [],
                  },
                ],
              }),
            });
          }
          break;
      }

      const result = await createSessionKey();
      if (result) {
        const newSessionKey = {
          address: result.sessionKeyAddress,
          privateKey: result.sessionKeyPrivate,
          entityId: result.entityId,
          permissions: {
            ...selectedKeyType.permissions,
            timeLimit:
              selectedKeyType.type === "time-limited"
                ? parseInt(customTimeLimit) * 60 * 60
                : undefined,
            spendingLimit:
              selectedKeyType.type === "token-limited"
                ? parseEther(customSpendLimit)
                : undefined,
            allowedAddresses:
              selectedKeyType.type === "allowlist"
                ? [customAddress]
                : undefined,
          },
        };
        addSessionKey(newSessionKey);
      }
    } catch (error) {
      logger.error("Error creating session key:", error);
    }
  };

  const handleSend = async () => {
    if (!client || !recipientAddress) return;

    // Validate based on send type
    if (sendType === 'token' && !sendAmount) {
      toast({
        variant: "destructive",
        title: "Amount Required",
        description: "Please enter an amount to send.",
      });
      return;
    }
    if (sendType === 'nft' && !selectedNFT) {
      toast({
        variant: "destructive",
        title: "No NFT Selected",
        description: "Please select a membership NFT to send.",
      });
      return;
    }

    try {
      setIsSending(true);

      let operation;

      if (sendType === 'nft' && selectedNFT) {
        // Send ERC-721 NFT (membership)
        toast({
          title: "Transaction Initiated",
          description: `Sending membership NFT...`,
        });

        // Encode the safeTransferFrom calldata
        const transferCalldata = encodeFunctionData({
          abi: parseAbi([
            "function safeTransferFrom(address from, address to, uint256 tokenId)",
          ]),
          functionName: "safeTransferFrom",
          args: [
            smartAccountAddress as Address,
            recipientAddress as Address,
            BigInt(selectedNFT.tokenId),
          ],
        });

        logger.debug('Sending ERC-721 transfer:', {
          contract: selectedNFT.lockAddress,
          tokenId: selectedNFT.tokenId,
          recipient: recipientAddress,
        });

        operation = await client!.sendUserOperation({
          uo: {
            target: selectedNFT.lockAddress as Address,
            data: appendBuilderCode(transferCalldata as Hex),
            value: BigInt(0), // No native value for NFT transfers
          },
        });
      } else {
        // Send token (existing logic)
        // Check balance
        const availableBalance = parseFloat(tokenBalances[selectedToken]);
        const requestedAmount = parseFloat(sendAmount);

        if (requestedAmount > availableBalance) {
          toast({
            variant: "destructive",
            title: "Insufficient Balance",
            description: `You have ${availableBalance} ${selectedToken}, but trying to send ${requestedAmount} ${selectedToken}`,
          });
          setIsSending(false);
          return;
        }

        toast({
          title: "Transaction Initiated",
          description: `Sending ${sendAmount} ${selectedToken}...`,
        });

        const tokenInfo = getTokenInfo(chain?.id)[selectedToken];

        if (selectedToken === 'ETH') {
          // Send native ETH
          const valueInWei = parseUnits(sendAmount, tokenInfo.decimals);

          operation = await client!.sendUserOperation({
            uo: {
              target: recipientAddress as `0x${string}`,
              data: appendBuilderCode("0x" as Hex),
              value: valueInWei,
            },
          });
        } else {
          // Send ERC-20 token (USDC or DAI)
          // Check if token is supported on current chain
          if (!tokenInfo.address) {
            toast({
              title: "Unsupported Network",
              description: `${selectedToken} is not available on the current network. Please switch to Base.`,
              variant: "destructive",
            });
            setIsSending(false);
            return;
          }

          const tokenAmount = parseUnits(sendAmount, tokenInfo.decimals);

          // Encode the transfer calldata
          const transferCalldata = encodeFunctionData({
            abi: parseAbi(["function transfer(address,uint256) returns (bool)"]),
            functionName: "transfer",
            args: [recipientAddress as Address, tokenAmount],
          });

          logger.debug('Sending ERC-20 transfer:', {
            token: selectedToken,
            tokenAddress: tokenInfo.address,
            recipient: recipientAddress,
            amount: tokenAmount.toString(),
          });

          operation = await client!.sendUserOperation({
            uo: {
              target: tokenInfo.address as Address,
              data: appendBuilderCode(transferCalldata as Hex),
              value: BigInt(0), // No native value for ERC-20 transfers
            },
          });
        }
      }

      // Wait for transaction to be mined
      const txHash = await client!.waitForUserOperationTransaction({
        hash: operation.hash,
      });

      // Success handling
      const explorerUrl = `${chain.blockExplorers?.default.url}/tx/${txHash}`;
      logger.debug("Transaction hash:", txHash);
      toast({
        title: "Transaction Successful!",
        description: sendType === 'nft'
          ? "Your membership NFT has been transferred."
          : "Your transaction has been confirmed.",
        action: (
          <ToastAction
            altText="View on Explorer"
            onClick={() => window.open(explorerUrl, "_blank")}
          >
            View on Explorer
          </ToastAction>
        ),
      });

      // Reset sending state before closing dialog (explicit reset for immediate feedback)
      setIsSending(false);

      // Reset form
      setIsDialogOpen(false);
      setRecipientAddress("");
      setSendAmount("");
      setSelectedNFT(null);
      setSendType('token');

      // Refresh balances - refetch on next render
      // Token balances will be refreshed on next component update
    } catch (error: unknown) {
      logger.error("Error sending transaction:", error);
      toast({
        variant: "destructive",
        title: "Transaction Failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to initiate transaction.",
      });
    } finally {
      // Ensure sending state is always reset, even if an error occurs
      setIsSending(false);
    }
  };

  const handleRemoveSessionKey = async (sessionKey: any) => {
    if (!validationClient || !smartAccountAddress || !chain) return;

    try {
      const sessionKeyEntityId = sessionKeys.indexOf(sessionKey) + 1;

      const tx = await validationClient.uninstallValidation({
        moduleAddress: getDefaultSingleSignerValidationModuleAddress(chain),
        entityId: sessionKeyEntityId,
        uninstallData: SingleSignerValidationModule.encodeOnUninstallData({
          entityId: sessionKeyEntityId,
        }),
        hookUninstallDatas: [],
      });

      // Wait for transaction confirmation
      await tx.wait();

      // Only remove from local storage after successful on-chain removal
      removeSessionKey(sessionKey.address);

      toast({
        title: "Session Key Removed",
        description:
          "The session key has been successfully uninstalled on-chain.",
        action: (
          <ToastAction
            altText="View on Explorer"
            onClick={() =>
              window.open(
                `${chain.blockExplorers?.default.url}/tx/${tx.hash}`,
                "_blank"
              )
            }
          >
            View on Explorer
          </ToastAction>
        ),
      });
    } catch (error) {
      logger.error("Error removing session key:", error);
      toast({
        variant: "destructive",
        title: "Error Removing Session Key",
        description:
          error instanceof Error
            ? error.message
            : "An error occurred while removing the session key.",
      });
      // Re-throw to prevent local storage removal on failure
      throw error;
    }
  };

  const getDialogContent = () => {
    switch (dialogAction) {
      case "buy":
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Purchase crypto directly to your wallet.
            </p>
            <div className="flex flex-col gap-4">
              <CoinbaseFundButton onClose={() => setIsDialogOpen(false)} />
            </div>
          </div>
        );
      case "send":
        return (
          <div className="space-y-4">
            <div className="flex flex-col gap-4">
              {/* Send Type Selection */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-900 dark:text-gray-100">Send Type</label>
                <div className="flex flex-col sm:grid sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSendType('token');
                      setSelectedNFT(null);
                    }}
                    className={`flex items-center justify-center space-x-2 p-3 sm:p-2.5 border rounded-lg transition-colors min-h-[44px] w-full ${sendType === 'token'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400'
                      : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'
                      }`}
                  >
                    <span className={`text-sm font-medium ${sendType === 'token'
                      ? 'text-blue-700 dark:text-blue-300'
                      : 'text-gray-900 dark:text-gray-100'
                      }`}>
                      Token
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSendType('nft');
                      setSendAmount('');
                    }}
                    disabled={membershipNFTs.length === 0}
                    className={`flex items-center justify-center space-x-2 p-3 sm:p-2.5 border rounded-lg transition-colors min-h-[44px] w-full ${sendType === 'nft'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400'
                      : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'
                      } ${membershipNFTs.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span className={`text-sm font-medium ${sendType === 'nft'
                      ? 'text-blue-700 dark:text-blue-300'
                      : 'text-gray-900 dark:text-gray-100'
                      }`}>
                      Membership NFT
                    </span>
                  </button>
                </div>
                {membershipNFTs.length === 0 && sendType === 'nft' && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 px-1">
                    You don't have any membership NFTs to send.
                  </p>
                )}
              </div>

              {sendType === 'token' ? (
                <>
                  {/* Token Selection */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-900 dark:text-gray-100">Token</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {(['ETH', 'USDC', 'DAI'] as TokenSymbol[]).map((token) => (
                        <button
                          key={token}
                          type="button"
                          onClick={() => setSelectedToken(token)}
                          className={`flex items-center justify-center space-x-2 p-3 sm:p-2.5 border rounded-lg transition-colors min-h-[44px] ${selectedToken === token
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400'
                            : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'
                            }`}
                        >
                          <Image
                            src={getTokenIcon(token, chain?.id)}
                            alt={token}
                            width={32}
                            height={32}
                            className="w-8 h-8 sm:w-7 sm:h-7 flex-shrink-0"
                          />
                          <span className={`text-sm font-medium ${selectedToken === token
                            ? 'text-blue-700 dark:text-blue-300'
                            : 'text-gray-900 dark:text-gray-100'
                            }`}>
                            {token}
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex items-center space-x-2">
                        <Image
                          src={getTokenIcon(selectedToken, chain?.id)}
                          alt={selectedToken}
                          width={20}
                          height={20}
                          className="w-5 h-5"
                        />
                        <span className="break-all sm:break-normal">Balance: {parseFloat(tokenBalances[selectedToken]).toFixed(6)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSendAmount(tokenBalances[selectedToken])}
                        className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium px-3 py-1.5 rounded text-xs min-h-[32px] touch-manipulation"
                      >
                        MAX
                      </button>
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-900 dark:text-gray-100">Amount ({selectedToken})</label>
                    <input
                      type="number"
                      placeholder="0.0"
                      step="any"
                      inputMode="decimal"
                      className="w-full p-3 sm:p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600 bg-white border-gray-200 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-base sm:text-sm min-h-[44px]"
                      value={sendAmount}
                      onChange={(e) => setSendAmount(e.target.value)}
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* NFT Selection */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-900 dark:text-gray-100">Membership NFT</label>
                    {isLoadingNFTs ? (
                      <div className="p-4 border rounded-lg">
                        <Skeleton className="h-20 w-full" />
                      </div>
                    ) : membershipNFTs.length === 0 ? (
                      <div className="p-4 border rounded-lg text-center text-sm text-gray-500 dark:text-gray-400">
                        No membership NFTs found
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-48 sm:max-h-64 overflow-y-auto -mx-1 px-1">
                        {membershipNFTs.map((nft) => (
                          <button
                            key={`${nft.lockAddress}-${nft.tokenId}`}
                            type="button"
                            onClick={() => setSelectedNFT(nft)}
                            className={`w-full p-3 sm:p-2.5 border rounded-lg text-left transition-colors min-h-[60px] sm:min-h-[56px] touch-manipulation ${selectedNFT?.lockAddress === nft.lockAddress && selectedNFT?.tokenId === nft.tokenId
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400'
                              : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 active:bg-gray-100 dark:active:bg-gray-600'
                              }`}
                          >
                            <div className="flex items-center space-x-3 sm:space-x-2">
                              <div className="w-12 h-12 sm:w-10 sm:h-10 rounded object-cover flex-shrink-0 bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden">
                                {nft.metadata?.image ? (
                                  <GatewayImage
                                    src={nft.metadata.image}
                                    alt={nft.metadata.name || 'Membership NFT'}
                                    width={40}
                                    height={40}
                                    className="w-full h-full object-cover"
                                    showSkeleton={false}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-green-400 to-green-600 dark:from-green-500 dark:to-green-700">
                                    <Key className="h-6 w-6 sm:h-5 sm:w-5 text-white" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                  {nft.metadata?.name || nft.lockName}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                  Token ID: {nft.tokenId}
                                </p>
                                {nft.metadata?.description && (
                                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 line-clamp-1">
                                    {nft.metadata.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Recipient Address */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-900 dark:text-gray-100">Recipient Address</label>
                <input
                  type="text"
                  placeholder="0x..."
                  inputMode="text"
                  className="w-full p-3 sm:p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600 bg-white border-gray-200 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-base sm:text-sm min-h-[44px] font-mono"
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto sm:order-2 min-h-[44px] touch-manipulation"
                  onClick={() => {
                    setIsDialogOpen(false);
                    setSelectedNFT(null);
                    setSendType('token');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="w-full sm:flex-1 sm:order-1 min-h-[44px] touch-manipulation"
                  onClick={handleSend}
                  disabled={
                    isSending ||
                    !recipientAddress ||
                    (sendType === 'token' && !sendAmount) ||
                    (sendType === 'nft' && !selectedNFT)
                  }
                >
                  {isSending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      <span className="hidden sm:inline">{sendType === 'nft' ? 'Sending NFT...' : `Sending ${selectedToken}...`}</span>
                      <span className="sm:hidden">Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      {sendType === 'nft' ? 'Send NFT' : `Send ${selectedToken}`}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        );
      case "swap":
        return (
          <div className="space-y-4">
            <div className="space-y-4">
              <AlchemySwapWidget
                onSwapSuccess={() => {
                  setIsDialogOpen(false);
                  toast({
                    title: "Swap Completed",
                    description: "Your token swap was successful!",
                  });
                }}
                className="border-0 shadow-none bg-transparent"
              />
            </div>
          </div>
        );
      case "session-keys":
        if (user?.type === "eoa") {
          setIsDialogOpen(false);
          return null;
        }
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Manage session keys for your smart account. Session keys allow you
              to delegate specific permissions to other signers.
            </p>
            <div className="flex flex-col gap-4">
              <div className="space-y-2">
                <label className="text-sm">Key Type</label>
                <select
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                  value={selectedKeyType.type}
                  onChange={(e) =>
                    setSelectedKeyType(
                      SESSION_KEY_TYPES.find(
                        (t) => t.type === e.target.value
                      ) || SESSION_KEY_TYPES[0]
                    )
                  }
                >
                  <option value="global">Global Access</option>
                  <option value="time-limited">Time Limited</option>
                  <option value="token-limited">Token Limited</option>
                  <option value="allowlist">Address Allowlist</option>
                </select>

                {selectedKeyType.type === "time-limited" && (
                  <div className="space-y-2 mt-4">
                    <label className="text-sm">Time Limit (hours)</label>
                    <input
                      type="number"
                      className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                      value={customTimeLimit}
                      onChange={(e) => setCustomTimeLimit(e.target.value)}
                    />
                  </div>
                )}

                {selectedKeyType.type === "token-limited" && (
                  <div className="space-y-2 mt-4">
                    <label className="text-sm">Spend Limit (ETH)</label>
                    <input
                      type="number"
                      className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                      value={customSpendLimit}
                      onChange={(e) => setCustomSpendLimit(e.target.value)}
                    />
                  </div>
                )}

                {selectedKeyType.type === "allowlist" && (
                  <div className="space-y-2 mt-4">
                    <label className="text-sm">Allowed Address</label>
                    <input
                      type="text"
                      className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                      value={customAddress}
                      onChange={(e) => setCustomAddress(e.target.value)}
                      placeholder="0x..."
                    />
                  </div>
                )}
              </div>

              <Button
                className="w-full mt-4"
                onClick={handleCreateSessionKey}
                disabled={isInstalling}
              >
                {isInstalling ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create New Session Key"
                )}
              </Button>

              <div className="space-y-2 mt-4">
                <h3 className="text-sm font-medium">Active Session Keys</h3>
                {sessionKeys.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No active session keys
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {sessionKeys.map((key, index) => (
                      <div
                        key={key.address}
                        className="flex items-center justify-between p-2 border rounded"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-mono">
                            {key.address.slice(0, 6)}...{key.address.slice(-4)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {key.permissions.isGlobal
                              ? "Global Access"
                              : key.permissions.timeLimit
                                ? `Time Limited (${Math.floor(
                                  key.permissions.timeLimit / 3600
                                )}h)`
                                : key.permissions.spendingLimit
                                  ? `Spend Limited (${key.permissions.spendingLimit} ETH)`
                                  : "Limited Access"}
                          </p>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRemoveSessionKey(key)}
                          className="ml-2"
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  if (!user) {
    return <LoginButton />;
  }

  return (
    <div className="flex items-center gap-2">
      <HydrationSafe
        fallback={
          <Button
            variant="outline"
            className="gap-2 items-center transition-all hover:bg-gray-100 dark:hover:bg-gray-800 hover:border-blue-500 hidden md:flex"
          >
            <div className="relative">
              <Image
                src={getChainIcon(chain)}
                alt={`${chain.name} network icon`}
                width={32}
                height={32}
                className="rounded-full"
              />
              <div className="absolute -bottom-1 -right-1">
                <NetworkStatus isConnected={isNetworkConnected} />
              </div>
            </div>
            <span>{chain.name}</span>
          </Button>
        }
      >
        <TooltipProvider>
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="gap-2 items-center transition-all hover:bg-gray-100 dark:hover:bg-gray-800 hover:border-blue-500 hidden md:flex"
                  >
                    <div className="relative">
                      <Image
                        src={getChainIcon(chain)}
                        alt={`${chain.name} network icon`}
                        width={32}
                        height={32}
                        className="rounded-full"
                      />
                      <div className="absolute -bottom-1 -right-1">
                        <NetworkStatus isConnected={isNetworkConnected} />
                      </div>
                    </div>
                    <span>{chain.name}</span>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <pre className="text-xs">{chain.name}</pre>
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent
              align="end"
              className="animate-in fade-in-80 slide-in-from-top-5"
            >
              <DropdownMenuLabel className="font-semibold text-sm text-gray-500 dark:text-gray-400">
                Switch Network
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {chains.map((dropdownChain) => (
                <Tooltip key={dropdownChain.id}>
                  <TooltipTrigger asChild>
                    <DropdownMenuItem
                      onClick={() => handleChainSwitch(dropdownChain)}
                      disabled={isSettingChain || chain.id === dropdownChain.id}
                      className={`
                        flex items-center cursor-pointer
                        hover:bg-gray-100 dark:hover:bg-gray-800
                        transition-colors
                      `}
                    >
                      <Image
                        src={getChainIcon(dropdownChain)}
                        alt={`${dropdownChain.name} network icon`}
                        width={32}
                        height={32}
                        className="mr-2 rounded-full"
                      />
                      {dropdownChain.name}
                    </DropdownMenuItem>
                  </TooltipTrigger>
                  <TooltipContent>
                    <pre className="text-xs">{dropdownChain.name}</pre>
                  </TooltipContent>
                </Tooltip>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </TooltipProvider>
      </HydrationSafe>

      {/* Desktop Dropdown */}
      <HydrationSafe
        fallback={
          <Button
            variant="outline"
            className="hidden md:flex items-center gap-2 transition-all hover:bg-gray-100 dark:hover:bg-gray-800 hover:border-blue-500"
          >
            <Avatar className="h-8 w-8">
              <AvatarImage
                src={makeBlockie(smartAccountAddress || user?.address || "0x")}
                alt="Wallet avatar"
              />
            </Avatar>
            <span className="max-w-[100px] truncate">
              {displayAddress || "Loading..."}
            </span>
          </Button>
        }
      >
        <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="hidden md:flex items-center gap-2 transition-all hover:bg-gray-100 dark:hover:bg-gray-800 hover:border-blue-500"
              id="nav-user-menu"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage
                  src={makeBlockie(smartAccountAddress || user?.address || "0x")}
                  alt="Wallet avatar"
                />
              </Avatar>
              <span className="max-w-[100px] truncate">
                {displayAddress || "Loading..."}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[320px] md:w-80 max-h-[80vh] overflow-y-auto"
            align="end"
          >
            <DropdownMenuLabel className="font-normal">
              <div
                className={`flex items-center justify-between cursor-pointer 
              hover:bg-gray-100 dark:hover:bg-gray-800 rounded px-2 py-1 transition-colors`}
                onClick={copyToClipboard}
              >
                <div className="flex flex-col space-y-1">
                  <p className="text-xs text-gray-500">
                    {smartAccountAddress ? "Smart Wallet" : user?.address ? "EOA" : "Not Connected"}
                  </p>
                  <p className="font-mono text-sm">{displayAddress}</p>
                  {user?.address && smartAccountAddress && user.address.toLowerCase() !== smartAccountAddress.toLowerCase() && (
                    <p className="text-xs text-gray-500">
                      Signer (EOA): {shortenAddress(user.address)}
                    </p>
                  )}
                </div>
                {copySuccess ? (
                  <CheckIcon className="ml-2 h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="ml-2 h-4 w-4" />
                )}
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            {/* Profile & Upload Access - Moved to Top */}
            <div className="px-2 py-2 w-full">
              <p className="text-xs text-muted-foreground mb-2">
                Options
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className={
                    "w-full flex flex-col items-center justify-center p-2 h-12 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                  }
                  onClick={() => setIsDropdownOpen(false)}
                >
                  <Link href={`/profile/${smartAccountAddress || user?.address}`}>
                    <ShieldUser className="h-3 w-3 mb-1" />
                    <span className="text-xs">Profile</span>
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className={
                    "w-full flex flex-col items-center justify-center p-2 h-12 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                  }
                  onClick={() => setIsDropdownOpen(false)}
                >
                  <Link href={`/upload/${smartAccountAddress || user?.address}`} id="nav-upload-link">
                    <CloudUpload className="h-3 w-3 mb-1" />
                    <span className="text-xs">Upload</span>
                  </Link>
                </Button>
              </div>
            </div>

            <DropdownMenuSeparator />

            {/* Membership Section */}
            <div className="px-2 py-2 w-full">
              <MembershipSection />
            </div>

            {/* Membership Error Handling */}
            {membershipError && (
              <div className="px-2 py-2 w-full">
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {membershipError.code === 'LOCK_NOT_FOUND' && 'Unable to verify membership. Please try again later.'}
                    {membershipError.code === 'BALANCE_CHECK_ERROR' && 'Unable to check membership status. Please try again later.'}
                    {membershipError.code === 'MEMBERSHIP_CHECK_ERROR' && 'Error verifying membership. Please try again later.'}
                    {membershipError.code === 'INVALID_ADDRESS' && 'Invalid wallet address. Please reconnect your wallet.'}
                    {membershipError.code === 'NO_VALID_ADDRESS' && 'Please connect your wallet to verify membership.'}
                    {membershipError.code === 'PROVIDER_ERROR' && 'Network connection error. Please try again later.'}
                    {membershipError.code === 'LOCK_FETCH_ERROR' && 'Unable to fetch membership details. Basic verification will continue.'}
                    {!membershipError.code && 'An error occurred while verifying membership.'}
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {/* Member Access Links - Only for Members (hide if error or loading) */}
            {!membershipError && !isMembershipLoading && isVerified && hasMembership && (
              <>
                <div className="px-2 py-2 w-full">
                  <p className="text-xs text-muted-foreground mb-2">
                    Member Access
                  </p>
                  {isLinksLoading ? (
                    <div className="grid grid-cols-2 gap-2">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <Link href="/live" className="w-full">
                        <Button
                          variant="outline"
                          size="sm"
                          className={
                            "w-full flex flex-col items-center justify-center p-2 h-12 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                          }
                          onClick={() => setIsDropdownOpen(false)}
                        >
                          <RadioTower className="h-3 w-3 mb-1" />
                          <span className="text-xs">Live</span>
                        </Button>
                      </Link>
                      <Link href="https://create.creativeplatform.xyz" className="w-full">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full flex flex-col items-center justify-center p-2 h-12 hover:bg-gray-50 
                          dark:hover:bg-gray-800 transition-colors relative"
                          onClick={() => setIsDropdownOpen(false)}
                        >
                          <Bot className="h-3 w-3 mb-1" />
                          <span className="text-xs">Pixels</span>
                          <span className="absolute -top-1 -right-1 px-1 py-0.5 rounded bg-blue-500 text-white text-[8px]">
                            Beta
                          </span>
                        </Button>
                      </Link>
                      {isBrandMember && (
                        <Link href="/vote/create" className="w-full">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full flex flex-col items-center justify-center p-2 h-12 hover:bg-green-50 
                          dark:hover:bg-green-900 transition-colors text-green-600 dark:text-green-400 
                          font-medium border-green-200 dark:border-green-800"
                            onClick={() => setIsDropdownOpen(false)}
                          >
                            <Plus className="h-3 w-3 mb-1" />
                            <span className="text-xs">Poll</span>
                          </Button>
                        </Link>
                      )}
                      <Link href="/predict/create" className="w-full">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full flex flex-col items-center justify-center p-2 h-12 hover:bg-blue-50 
                          dark:hover:bg-blue-900 transition-colors text-blue-600 dark:text-blue-400 
                          font-medium border-blue-200 dark:border-blue-800"
                          onClick={() => setIsDropdownOpen(false)}
                        >
                          <TrendingUp className="h-3 w-3 mb-1" />
                          <span className="text-xs">Predict</span>
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              </>
            )}

            <DropdownMenuSeparator />

            {/* Session Keys Section - Compact */}
            {user?.type !== "eoa" && (
              <>
                <div className="px-2 py-1 w-full">
                  <DropdownMenuItem
                    onClick={() => handleActionClick("session-keys")}
                    className="w-full flex items-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors p-2 rounded"
                  >
                    <Key className="mr-2 h-4 w-4 text-yellow-500" />
                    <span className="text-sm">Session Keys</span>
                    <ArrowRight className="ml-auto h-3 w-3" />
                  </DropdownMenuItem>
                </div>
                <DropdownMenuSeparator />
              </>
            )}

            {/* Feedback Link */}
            <div className="px-2 py-1 w-full">
              <DropdownMenuItem asChild>
                <Link
                  href="https://feedback.creativeplatform.xyz/crtv"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors p-2 rounded"
                  onClick={() => setIsDropdownOpen(false)}
                >
                  <ArrowUpRight className="mr-2 h-4 w-4" />
                  <span className="text-sm">Feedback</span>
                </Link>
              </DropdownMenuItem>
            </div>

            <DropdownMenuSeparator />

            {/* Wallet Actions and Balances - Moved to Bottom */}

            {/* Wallet Actions Section - Grid Layout */}
            <div className="px-2 py-2 w-full">
              <p className="text-xs text-muted-foreground mb-2">Actions</p>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleActionClick("buy")}
                  className="flex flex-col items-center justify-center p-3 h-16 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <Plus className="h-4 w-4 text-green-500 mb-1" />
                  <span className="text-xs">Add</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleActionClick("send")}
                  className="flex flex-col items-center justify-center p-3 h-16 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <ArrowUpRight className="h-4 w-4 text-blue-500 mb-1" />
                  <span className="text-xs">Send</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleActionClick("swap")}
                  className="flex flex-col items-center justify-center p-3 h-16 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <ArrowUpDown className="h-4 w-4 text-purple-500 mb-1" />
                  <span className="text-xs">Swap</span>
                </Button>
              </div>
            </div>

            <DropdownMenuSeparator />

            {/* Balances Section */}
            <div className="px-2 py-2">
              <TokenBalance />
            </div>

            {shouldShowMetokens && (
              <>
                <DropdownMenuSeparator />
                {/* MeToken Balances Section */}
                <div className="px-2 py-2">
                  <MeTokenBalances />
                </div>
              </>
            )}

            <DropdownMenuSeparator />

            {/* Logout */}
            <div className="px-2 py-1 w-full">
              <DropdownMenuItem
                onClick={async () => {
                  try {
                    await logout();
                    logger.debug('Logged out successfully');
                    // Small delay to ensure logout completes
                    setTimeout(() => {
                      setIsDropdownOpen(false);
                    }, 100);
                  } catch (error) {
                    logger.error('Logout error:', error);
                    setIsDropdownOpen(false);
                  }
                }}
                className="w-full flex items-center cursor-pointer hover:bg-red-50 dark:hover:bg-red-900 transition-colors p-2 text-red-500 rounded"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span className="text-sm">Logout</span>
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </HydrationSafe>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setDialogAction("buy");
            setSelectedNFT(null);
            setSendType('token');
            setRecipientAddress("");
            setSendAmount("");
          }
        }}
      >
        <DialogContent className="w-[95vw] max-w-[425px] max-h-[95vh] sm:max-h-[90vh] overflow-hidden p-4 sm:p-6 rounded-lg">
          <DialogHeader className="pb-4 pr-8 sm:pr-12">
            <DialogTitle className="text-lg sm:text-xl">
              {dialogAction.charAt(0).toUpperCase() + dialogAction.slice(1)}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {dialogAction === "buy" &&
                "Purchase cryptocurrency directly to your wallet using your preferred payment method."}
              {dialogAction === "send" &&
                "Send crypto to another address."}
              {dialogAction === "swap" &&
                "Exchange one cryptocurrency for another at the best available rates."}
            </DialogDescription>
            <DialogClose asChild>
              <button
                // className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
                aria-label="Close"
              >
                <span className="sr-only">Close</span>
              </button>
            </DialogClose>
          </DialogHeader>
          <div className="flex flex-col overflow-hidden">
            <div className="space-y-4 overflow-y-auto flex-1 pr-1 sm:pr-2">
              {getDialogContent()}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
