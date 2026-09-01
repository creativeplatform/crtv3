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

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import {
  useAuthModal,
  useUser,
  useChain,
  useSendUserOperation,
} from "@/lib/wallet/react";
import { useUnifiedLogout } from "@/hooks/useUnifiedLogout";
import { getPassDisplayName } from "@/lib/access/membership-labels";
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
  Disc3,
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
import { FundingOptions } from "@/components/wallet/buy/FundingOptions";
import { LoginButton } from "@/components/auth/LoginButton";
import { AlchemySwapWidget } from "@/components/wallet/swap/AlchemySwapWidget";
import { useSmartWalletDisplayAddress } from "@/lib/hooks/accountkit/useSmartWalletDisplayAddress";
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
import { parseEther, type Address, type Hex, encodeFunctionData, parseAbi, parseUnits, formatUnits } from "viem";
import { getEthBalance, getErc20Balance } from "@/lib/viem";
import { logger } from "@/lib/utils/logger";
import { deferAfterOverlayClose } from "@/lib/utils/radixLayerFocus";
import { appendBuilderCode } from "@/lib/utils/builder-code";
import {
  formatSendError,
  getMaxEthSendAmount,
  validateSendBalance,
  normalizeRecipientAddress,
} from "@/lib/utils/sendHelpers";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { USDC_TOKEN_ADDRESSES, USDC_TOKEN_DECIMALS } from "@/lib/contracts/USDCToken";
import { DAI_TOKEN_ADDRESSES, DAI_TOKEN_DECIMALS } from "@/lib/contracts/DAIToken";
import { USDS_TOKEN_ADDRESSES, USDS_TOKEN_DECIMALS } from "@/lib/contracts/USDSToken";
import { GHO_TOKEN_ADDRESSES, GHO_TOKEN_DECIMALS } from "@/lib/contracts/GHOToken";
import { SWAP_UI_TOKENS, emptyTokenBalances, type TokenSymbol as SwapTokenSymbol } from "@/lib/sdk/alchemy/swap-service";
import { useSessionKeyStorage } from "@/lib/hooks/accountkit/useSessionKeyStorage";
import { MembershipSection } from "./MembershipSection";
import { shortenAddress } from "@/lib/utils/utils";
import Link from "next/link";
import { useMembershipContext } from "@/lib/context/MembershipContext";
import { Skeleton } from "@/components/ui/skeleton";
import { useMeTokensSupabase } from "@/lib/hooks/metokens/useMeTokensSupabase";
import { useMeTokenHoldings, type MeTokenHolding } from "@/lib/hooks/metokens/useMeTokenHoldings";
import { chains, lensChain } from "@/config";
import { useOrbSession } from "@/context/OrbSessionContext";
import { HydrationSafe } from "@/components/ui/hydration-safe";
import { useMembershipNFTs, type MembershipNFT } from "@/lib/hooks/unlock/useMembershipNFTs";
import {
  hasAnyValidPass,
  hasValidBrandPass,
  hasValidCreatorPass,
} from "@/lib/access/creator-membership";

const chainIconMap: Record<number, string> = {
  [base.id]: "/images/chains/base.svg",
  [lensChain.id]: "/images/chains/default-chain.svg",
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

import { getTokenIcon } from '@/lib/utils/token-icons';

// Token configuration for send modal
type TokenSymbol = SwapTokenSymbol;

const ERC20_SEND_TOKENS: Exclude<TokenSymbol, 'ETH'>[] = ['USDC', 'DAI', 'USDS', 'GHO'];

// Helper function to get token info for the current chain
const getTokenInfo = (chainId?: number) => {
  const chainKey = chainId === base.id ? "base" : undefined;

  return {
    ETH: {
      decimals: 18,
      symbol: "ETH",
      address: null as null,
    },
    USDC: {
      decimals: USDC_TOKEN_DECIMALS,
      symbol: "USDC",
      address: chainKey ? USDC_TOKEN_ADDRESSES[chainKey] : undefined,
    },
    DAI: {
      decimals: DAI_TOKEN_DECIMALS,
      symbol: "DAI",
      address: chainKey ? DAI_TOKEN_ADDRESSES[chainKey] : undefined,
    },
    USDS: {
      decimals: USDS_TOKEN_DECIMALS,
      symbol: "USDS",
      address: chainKey ? USDS_TOKEN_ADDRESSES[chainKey] : undefined,
    },
    GHO: {
      decimals: GHO_TOKEN_DECIMALS,
      symbol: "GHO",
      address: chainKey ? GHO_TOKEN_ADDRESSES[chainKey] : undefined,
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

export type AccountDropdownHandle = {
  openAction: (action: "buy" | "send" | "swap" | "session-keys") => void;
};

export const AccountDropdown = forwardRef<AccountDropdownHandle>(
  function AccountDropdown(_, ref) {
  const { openAuthModal } = useAuthModal();
  const {
    isAuthenticated: isOrbAuthenticated,
    lensAccount,
    openLoginModal: openOrbLogin,
    linkProfile,
    isLinking: isOrbLinking,
    logout: logoutOrb,
    linkStatus: orbLinkStatus,
    loginError: orbLoginError,
    accountMenuRefreshSignal,
  } = useOrbSession();
  const user = useUser();
  const unifiedLogout = useUnifiedLogout();
  const { chain, setChain, isSettingChain } = useChain();
  const {
    primaryAddress,
    smartAccountAddress,
    signerAddress,
    displayAddress,
    walletLabel,
    client,
    account,
  } = useSmartWalletDisplayAddress();
  const [isNetworkConnected, setIsNetworkConnected] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isArrowUp, setIsArrowUp] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [balanceRefreshKey, setBalanceRefreshKey] = useState(0);
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
  const [sendType, setSendType] = useState<'token' | 'nft' | 'metoken'>('token');
  const [selectedNFT, setSelectedNFT] = useState<MembershipNFT | null>(null);
  const [selectedMeToken, setSelectedMeToken] = useState<MeTokenHolding | null>(null);
  const [tokenBalances, setTokenBalances] = useState<Record<TokenSymbol, string>>(emptyTokenBalances());
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

  const validationClient = chain
    ? (client?.extend(installValidationActions as any) as any)
    : undefined;

  const { isVerified, isLoading: isMembershipLoading, error: membershipError, membershipDetails } = useMembershipContext();

  // Check for MeTokens to conditionally render the section
  const { userMeToken, loading: meTokenLoading } = useMeTokensSupabase();
  const { holdings, loading: holdingsLoading } = useMeTokenHoldings();
  const hasMetokens = !!userMeToken || holdings.length > 0;
  const shouldShowMetokens = hasMetokens || meTokenLoading || holdingsLoading;

  useEffect(() => {
    logger.debug('Account state:', {
      "EOA Address (user.address)": user?.address,
      "Smart Contract Account Address": smartAccountAddress,
      "Primary display address": primaryAddress,
    });
  }, [smartAccountAddress, primaryAddress, user]);

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

  // Reopen account menu after Orb sign-in (desktop only).
  useEffect(() => {
    if (!accountMenuRefreshSignal || !isOrbAuthenticated) return;
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches) {
      setIsDropdownOpen(true);
    }
  }, [accountMenuRefreshSignal, isOrbAuthenticated]);

  // Fetch token balances when dialog opens with send action
  useEffect(() => {
    const fetchTokenBalances = async () => {
      if (!client || !smartAccountAddress || dialogAction !== 'send' || !isDialogOpen) return;

      try {
        // Get ETH balance via public client (smart-account client is write-only)
        const ethBalance = await getEthBalance(smartAccountAddress as Address);

        const chainKey = chain?.id === base.id ? "base" : undefined;
        const erc20Balances = Object.fromEntries(
          await Promise.all(
            ERC20_SEND_TOKENS.map(async (symbol) => {
              if (!chainKey) return [symbol, 0n] as const;
              const info = getTokenInfo(chain?.id)[symbol];
              if (!info.address) return [symbol, 0n] as const;
              const balance = await getErc20Balance({
                token: info.address as Address,
                owner: smartAccountAddress as Address,
              });
              return [symbol, balance] as const;
            })
          )
        ) as Record<Exclude<TokenSymbol, 'ETH'>, bigint>;

        setTokenBalances({
          ETH: formatUnits(ethBalance, 18),
          USDC: formatUnits(erc20Balances.USDC, USDC_TOKEN_DECIMALS),
          DAI: formatUnits(erc20Balances.DAI, DAI_TOKEN_DECIMALS),
          USDS: formatUnits(erc20Balances.USDS, USDS_TOKEN_DECIMALS),
          GHO: formatUnits(erc20Balances.GHO, GHO_TOKEN_DECIMALS),
        });
      } catch (error) {
        logger.error('Error fetching token balances:', error);
      }
    };

    fetchTokenBalances();
  }, [client, smartAccountAddress, dialogAction, isDialogOpen, chain?.id]);

  const copyToClipboard = async () => {
    const addressToCopy = primaryAddress;
    if (addressToCopy) {
      try {
        await navigator.clipboard.writeText(addressToCopy);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
        // Optionally close dropdown after copying
        // setIsDropdownOpen(false);
      } catch {
        // Clipboard write may fail on unsupported contexts; ignore silently.
      }
    }
  };

  const handleActionClick = useCallback(
    (action: "buy" | "send" | "swap" | "session-keys") => {
      deferAfterOverlayClose(
        () => setIsDropdownOpen(false),
        () => {
          setDialogAction(action);
          setIsDialogOpen(true);
        }
      );
    },
    []
  );

  useImperativeHandle(
    ref,
    () => ({
      openAction: handleActionClick,
    }),
    [handleActionClick]
  );

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

    const normalizedRecipient = normalizeRecipientAddress(recipientAddress);
    if (!normalizedRecipient) {
      toast({
        variant: "destructive",
        title: "Invalid Address",
        description: "Please enter a valid Ethereum recipient address (0x...).",
      });
      return;
    }

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
    if (sendType === 'metoken' && !selectedMeToken) {
      toast({
        variant: "destructive",
        title: "No MeToken Selected",
        description: "Please select a MeToken to send.",
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
            normalizedRecipient,
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
      } else if (sendType === 'metoken' && selectedMeToken) {
        // Send ERC-20 MeToken
        if (!sendAmount) {
          toast({
            variant: "destructive",
            title: "Amount Required",
            description: "Please enter an amount to send.",
          });
          setIsSending(false);
          return;
        }

        const rawBalance = BigInt(selectedMeToken.balanceRaw);
        const tokenAmount = parseEther(sendAmount);
        if (tokenAmount > rawBalance) {
          toast({
            variant: "destructive",
            title: "Insufficient MeToken Balance",
            description: `You only have ${selectedMeToken.balance} ${selectedMeToken.symbol}.`,
          });
          setIsSending(false);
          return;
        }

        toast({
          title: "Transaction Initiated",
          description: `Sending ${sendAmount} ${selectedMeToken.symbol}...`,
        });

        const transferCalldata = encodeFunctionData({
          abi: parseAbi(["function transfer(address,uint256) returns (bool)"]),
          functionName: "transfer",
          args: [normalizedRecipient, tokenAmount],
        });

        logger.debug('Sending MeToken transfer:', {
          token: selectedMeToken.symbol,
          tokenAddress: selectedMeToken.address,
          recipient: recipientAddress,
          amount: tokenAmount.toString(),
        });

        operation = await client!.sendUserOperation({
          uo: {
            target: selectedMeToken.address as Address,
            data: appendBuilderCode(transferCalldata as Hex),
            value: BigInt(0),
          },
        });
      } else {
        // Send token (existing logic)
        // Check balance (ETH reserves gas buffer)
        const balanceError = validateSendBalance(
          selectedToken,
          sendAmount,
          tokenBalances[selectedToken],
        );
        if (balanceError) {
          toast({
            variant: "destructive",
            title: "Insufficient Balance",
            description: balanceError,
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
              target: normalizedRecipient,
              data: appendBuilderCode("0x" as Hex),
              value: valueInWei,
            },
          });
        } else {
          // Send ERC-20 token (USDC, DAI, USDS, GHO)
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
            args: [normalizedRecipient, tokenAmount],
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

      setBalanceRefreshKey((key) => key + 1);
    } catch (error: unknown) {
      logger.error("Error sending transaction:", error);
      toast({
        variant: "destructive",
        title: "Transaction Failed",
        description: formatSendError(error),
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

  const renderSendDialogFooter = () => (
    <div className="flex flex-col sm:flex-row gap-3 border-t pt-3 mt-1 shrink-0">
      <Button
        variant="outline"
        className="w-full sm:w-auto sm:order-2 min-h-[44px] touch-manipulation"
        onClick={() => {
          setIsDialogOpen(false);
          setSelectedNFT(null);
          setSelectedMeToken(null);
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
          (sendType === 'nft' && !selectedNFT) ||
          (sendType === 'metoken' && (!selectedMeToken || !sendAmount))
        }
      >
        {isSending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            <span className="hidden sm:inline">{sendType === 'nft' ? 'Sending NFT...' : sendType === 'metoken' ? `Sending ${selectedMeToken?.symbol}...` : `Sending ${selectedToken}...`}</span>
            <span className="sm:hidden">Sending...</span>
          </>
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" />
            {sendType === 'nft' ? 'Send NFT' : sendType === 'metoken' ? `Send ${selectedMeToken?.symbol || 'MeToken'}` : `Send ${selectedToken}`}
          </>
        )}
      </Button>
    </div>
  );

  const getDialogContent = () => {
    switch (dialogAction) {
      case "buy":
        return (
          <div className="space-y-4">
            <FundingOptions
              presetFiatAmount={10}
              fiatCurrency="USD"
              asset="USDC"
              network="base"
              prefillEmail={user?.email}
              onSuccess={() => {
                setBalanceRefreshKey((key) => key + 1);
                setTimeout(() => setIsDialogOpen(false), 1500);
              }}
              onClose={() => setIsDialogOpen(false)}
            />
          </div>
        );
      case "send":
        return (
          <div className="space-y-4">
            <div className="flex flex-col gap-4">
              {/* Send Type Selection */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-900 dark:text-gray-100">Send Type</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSendType('token');
                      setSelectedNFT(null);
                      setSelectedMeToken(null);
                    }}
                    className={`flex items-center justify-center space-x-2 p-2 sm:p-2.5 border rounded-lg transition-colors min-h-[44px] w-full ${sendType === 'token'
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
                      setSelectedMeToken(null);
                    }}
                    disabled={membershipNFTs.length === 0}
                    className={`flex items-center justify-center space-x-2 p-2 sm:p-2.5 border rounded-lg transition-colors min-h-[44px] w-full ${sendType === 'nft'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400'
                      : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'
                      } ${membershipNFTs.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span className={`text-sm font-medium ${sendType === 'nft'
                      ? 'text-blue-700 dark:text-blue-300'
                      : 'text-gray-900 dark:text-gray-100'
                      }`}>
                      NFT
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSendType('metoken');
                      setSendAmount('');
                      setSelectedNFT(null);
                    }}
                    disabled={holdings.length === 0}
                    className={`flex items-center justify-center space-x-2 p-2 sm:p-2.5 border rounded-lg transition-colors min-h-[44px] w-full ${sendType === 'metoken'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400'
                      : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'
                      } ${holdings.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span className={`text-sm font-medium ${sendType === 'metoken'
                      ? 'text-blue-700 dark:text-blue-300'
                      : 'text-gray-900 dark:text-gray-100'
                      }`}>
                      MeToken
                    </span>
                  </button>
                </div>
                {membershipNFTs.length === 0 && sendType === 'nft' && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 px-1">
                    You don't have any membership NFTs to send.
                  </p>
                )}
                {holdings.length === 0 && sendType === 'metoken' && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 px-1">
                    You don't have any MeTokens to send.
                  </p>
                )}
              </div>

              {sendType === 'token' ? (
                <>
                  {/* Token Selection */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-900 dark:text-gray-100">Token</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {SWAP_UI_TOKENS.map((token) => (
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
                        onClick={() => {
                          if (selectedToken === 'ETH') {
                            setSendAmount(getMaxEthSendAmount(tokenBalances.ETH));
                          } else {
                            setSendAmount(tokenBalances[selectedToken]);
                          }
                        }}
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
              ) : sendType === 'nft' ? (
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
                                  {nft.lockAddress ? getPassDisplayName(nft.lockAddress) : nft.lockName}
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
              ) : (
                <>
                  {/* MeToken Selection */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-900 dark:text-gray-100">MeToken</label>
                    {holdings.length === 0 ? (
                      <div className="p-4 border rounded-lg text-center text-sm text-gray-500 dark:text-gray-400">
                        No MeTokens found
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-48 sm:max-h-64 overflow-y-auto -mx-1 px-1">
                        {holdings.map((holding) => (
                          <button
                            key={holding.address}
                            type="button"
                            onClick={() => setSelectedMeToken(holding)}
                            className={`w-full p-3 sm:p-2.5 border rounded-lg text-left transition-colors min-h-[60px] sm:min-h-[56px] touch-manipulation ${selectedMeToken?.address === holding.address
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400'
                              : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 active:bg-gray-100 dark:active:bg-gray-600'
                              }`}
                          >
                            <div className="flex flex-col">
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {holding.symbol}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Balance: {holding.balance}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Amount */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-900 dark:text-gray-100">Amount ({selectedMeToken?.symbol || "MeToken"})</label>
                    <input
                      type="number"
                      placeholder="0.0"
                      step="any"
                      inputMode="decimal"
                      className="w-full p-3 sm:p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600 bg-white border-gray-200 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-base sm:text-sm min-h-[44px]"
                      value={sendAmount}
                      onChange={(e) => setSendAmount(e.target.value)}
                    />
                    <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                      <span>Balance: {selectedMeToken?.balance || "0"}</span>
                      {selectedMeToken && (
                        <button
                          type="button"
                          onClick={() => setSendAmount(selectedMeToken.balance)}
                          className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium px-3 py-1.5 rounded text-xs min-h-[32px] touch-manipulation"
                        >
                          MAX
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Recipient Address */}
              <div className="space-y-3 pb-2">
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
                  setBalanceRefreshKey((key) => key + 1);
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
    return (
      <div className="hidden md:block">
        <LoginButton />
      </div>
    );
  }

  return (
    <>
    <div className="hidden md:flex items-center gap-2">
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

      {/* Account menu trigger (visible on all breakpoints when signed in) */}
      <HydrationSafe
        fallback={
          <Button
            variant="outline"
            className="flex items-center gap-2 transition-all hover:bg-gray-100 dark:hover:bg-gray-800 hover:border-blue-500"
          >
            <Avatar className="h-8 w-8">
              <AvatarImage
                src={makeBlockie(primaryAddress || user?.address || "0x")}
                alt="Wallet avatar"
              />
            </Avatar>
            <span className="max-w-[100px] truncate hidden sm:inline">
              {displayAddress || "Loading..."}
            </span>
          </Button>
        }
      >
        <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen} modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="flex items-center gap-2 transition-all hover:bg-gray-100 dark:hover:bg-gray-800 hover:border-blue-500"
              id="nav-user-menu"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage
                  src={makeBlockie(primaryAddress || user?.address || "0x")}
                  alt="Wallet avatar"
                />
              </Avatar>
              <span className="max-w-[100px] truncate hidden sm:inline">
                {displayAddress || "Loading..."}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[320px] md:w-80 p-0" align="end">
            <div className="max-h-[min(80vh,32rem)] overflow-y-auto overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch] p-1">
            <DropdownMenuLabel className="font-normal">
              <div
                className={`flex items-center justify-between cursor-pointer 
              hover:bg-gray-100 dark:hover:bg-gray-800 rounded px-2 py-1 transition-colors`}
                onClick={copyToClipboard}
              >
                <div className="flex flex-col space-y-1">
                  <p className="text-xs text-gray-500">
                    {walletLabel}
                  </p>
                  <p className="font-mono text-sm">{displayAddress || "Loading..."}</p>
                  {signerAddress && (
                    <p className="text-xs text-gray-500">
                      Signer (EOA): {shortenAddress(signerAddress)}
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

            <div className="px-2 py-2 w-full space-y-2">
              <p className="text-xs text-muted-foreground">Orb / Lens</p>
              {isOrbAuthenticated ? (
                <div className="space-y-2">
                  <p
                    className={
                      orbLinkStatus === "linked"
                        ? "text-xs text-green-600 dark:text-green-400"
                        : "text-xs text-amber-600 dark:text-amber-400"
                    }
                  >
                    {orbLinkStatus === "linked" ? "Linked" : "Signed in"}
                    {lensAccount ? `: ${shortenAddress(lensAccount)}` : ""}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      disabled={isOrbLinking}
                      onClick={() =>
                        linkProfile(primaryAddress)
                      }
                    >
                      {isOrbLinking ? "Linking…" : "Sync profile"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => logoutOrb()}
                    >
                      Orb out
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    openOrbLogin();
                  }}
                >
                  Sign in with Orb
                </Button>
              )}
            </div>

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
                  <Link href={`/profile/${primaryAddress ?? ""}`}>
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
                  <Link href={`/upload/${primaryAddress ?? ""}`} id="nav-upload-link">
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

            {/* Member Access Links — shown to connected users; each item gated by access rules */}
            {!membershipError && !isMembershipLoading && isVerified && user && (
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
                      {/* Live: Creator or Brand pass */}
                      {(hasValidCreatorPass(membershipDetails) || hasValidBrandPass(membershipDetails)) && (
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
                      )}

                      {/* Pixels: any paid pass */}
                      {hasAnyValidPass(membershipDetails) && (
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
                      )}

                      {/* Mixtape: any paid pass */}
                      {hasAnyValidPass(membershipDetails) && (
                        <Link href="https://air.creativeplatform.xyz/app" className="w-full">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full flex flex-col items-center justify-center p-2 h-12 hover:bg-gray-50
                          dark:hover:bg-gray-800 transition-colors relative"
                            onClick={() => setIsDropdownOpen(false)}
                          >
                            <Disc3 className="h-3 w-3 mb-1" />
                            <span className="text-xs">Mixtape</span>
                            <span className="absolute -top-1 -right-1 px-1 py-0.5 rounded bg-blue-500 text-white text-[8px]">
                              Beta
                            </span>
                          </Button>
                        </Link>
                      )}

                      {/* Campaigns/Polls: Brand pass only */}
                      {hasValidBrandPass(membershipDetails) && (
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
                            <span className="text-xs">Campaigns</span>
                          </Button>
                        </Link>
                      )}

                      {/* Predict: non-members + Investor; blocked for Creator or Brand pass holders */}
                      {!hasValidCreatorPass(membershipDetails) && !hasValidBrandPass(membershipDetails) && (
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
                      )}
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

            {/* Balances Section */}
            <div className="px-2 py-2">
              <TokenBalance
                isVisible={isDropdownOpen}
                refreshKey={balanceRefreshKey}
              />
            </div>

            <DropdownMenuSeparator />

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
                    await unifiedLogout();
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
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </HydrationSafe>
    </div>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setDialogAction("buy");
            setSelectedNFT(null);
            setSelectedMeToken(null);
            setSendType('token');
            setRecipientAddress("");
            setSendAmount("");
          }
        }}
      >
        <DialogContent className="flex w-[95vw] max-w-[425px] max-h-[min(85dvh,640px)] flex-col overflow-hidden p-4 sm:p-6 rounded-lg">
          <DialogHeader className="shrink-0 pb-4 pr-8 sm:pr-12">
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
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch] pr-1 sm:pr-2">
              {getDialogContent()}
            </div>
            {dialogAction === "send" && renderSendDialogFooter()}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});