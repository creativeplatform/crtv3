// components/Navbar.tsx
"use client";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import {
  SITE_LOGO,
  SITE_NAME,
  SITE_ORG,
  SITE_PRODUCT,
} from "@/context/context"; // Correct import path
import { HydrationSafe } from "@/components/ui/hydration-safe";
import { Button } from "@/components/ui/button"; // Corrected import
import {
  Dialog as AccountKitDialog,
  useAuthModal,
  useLogout,
  useUser,
  useChain,
  useSmartAccountClient,
} from "@account-kit/react";
import ThemeToggleComponent from "./ThemeToggle/toggleComponent";
import { toast } from "sonner";
import { CheckIcon } from "@radix-ui/react-icons";
import {
  Copy,
  User,
  Plus,
  ArrowUpRight,
  ArrowUpDown,
  LogOut,
  Wifi,
  WifiOff,
  Key,
  CloudUpload,
  RadioTower,
  Bot,
  ShieldUser,
  TrendingUp,
} from "lucide-react";
import type { User as AccountUser } from "@account-kit/signer";
import useModularAccount from "@/lib/hooks/accountkit/useModularAccount";
import { base } from "@account-kit/infra";
import { ArrowBigDown, ArrowBigUp, ChevronDown, Search, X } from "lucide-react";
import CoinbaseFundButton from "./wallet/buy/coinbase-fund-button";
import { TokenBalance } from "./wallet/balance/TokenBalance";
import { MeTokenBalances } from "./wallet/balance/MeTokenBalances";
import type { Chain as ViemChain } from "viem";
import { AccountDropdown } from "@/components/account-dropdown/AccountDropdown";
import { useOrbSession } from "@/context/OrbSessionContext";
import { useMembershipVerification } from "@/lib/hooks/unlock/useMembershipVerification";
import { useMeTokensSupabase } from "@/lib/hooks/metokens/useMeTokensSupabase";
import { useMeTokenHoldings } from "@/lib/hooks/metokens/useMeTokenHoldings";
import { MembershipSection } from "./account-dropdown/MembershipSection";
import { ChainSelect } from "@/components/ui/select";
import { TokenSelect } from "@/components/ui/token-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import makeBlockie from "ethereum-blockies-base64";
import { type Address, erc20Abi, formatUnits } from 'viem';
import { BASE_TOKENS, TOKEN_INFO, type TokenSymbol, alchemySwapService, AlchemySwapService } from '@/lib/sdk/alchemy/swap-service';
import { AlchemySwapWidget } from './wallet/swap/AlchemySwapWidget';
import { logger } from '@/lib/utils/logger';

type UseUserResult = (AccountUser & { type: "eoa" | "sca" }) | null;

// Define reusable className for nav links
const navLinkClass = `
  group inline-flex h-9 w-max items-center justify-center rounded-md bg-white px-4 py-2 
  text-sm font-medium transition-colors hover:bg-gray-100 hover:text-gray-900 
  focus:bg-gray-100 focus:text-gray-900 focus:outline-none disabled:pointer-events-none 
  disabled:opacity-50 data-[active]:bg-gray-100/50 data-[state=open]:bg-gray-100/50 
  dark:bg-gray-950 dark:hover:bg-gray-800 dark:hover:text-gray-50 dark:focus:bg-gray-800 
  dark:focus:text-gray-50 dark:data-[active]:bg-gray-800/50 dark:data-[state=open]:bg-gray-800/50
`
  .replace(/\s+/g, " ")
  .trim();

// Define reusable className for member-only nav links
const memberNavLinkClass = `
  group inline-flex h-9 w-max items-center justify-center rounded-md bg-white px-4 py-2 
  text-sm font-medium transition-colors hover:bg-gray-100 hover:text-gray-900 
  focus:bg-gray-100 focus:text-gray-900 focus:outline-none disabled:pointer-events-none 
  disabled:opacity-50 data-[active]:bg-gray-100/50 data-[state=open]:bg-gray-100/50 
  dark:bg-gray-950 dark:hover:bg-gray-800 dark:hover:text-gray-50 dark:focus:bg-gray-800 
  dark:focus:text-gray-50 dark:data-[active]:bg-gray-800/50 dark:data-[state=open]:bg-gray-800/50
  text-[#EC407A]
`
  .replace(/\s+/g, " ")
  .trim();

// Define reusable className for mobile menu links
const mobileNavLinkClass = `
  flex w-full items-center rounded-md p-2 text-sm font-medium
  hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors
`;

// Define reusable className for mobile menu member-only links
const mobileMemberNavLinkClass = `
  flex w-full items-center rounded-md p-2 text-sm font-medium
  hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors
  text-[#EC406A]
`;

// Simplified truncateAddress - ENS resolution disabled to prevent webpack chunk loading errors
const truncateAddress = (address: string) => {
  if (!address) return "";
  // Simply truncate the address without ENS resolution
  // This prevents webpack chunk loading issues with CCIP utilities
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Add this near the top with other utility functions
const getChainGradient = (chain: ViemChain) => {
  switch (chain.id) {
    case base.id:
      return "from-[#0052FF] to-[#0052FF]";
    default:
      return "from-gray-400 to-gray-600";
  }
};

const getChainName = (chain: ViemChain) => {
  switch (chain.id) {
    case base.id:
      return "Base";
    default:
      return chain.name;
  }
};

// Add this near the top with other utility functions
const getChainLogo = (chain: ViemChain) => {
  switch (chain.id) {
    case base.id:
      return "/images/chains/base.svg";
    default:
      return "/images/chains/default-chain.svg";
  }
};

const getChainTooltip = (chain: ViemChain) => {
  return `Network: ${chain.name}
Chain ID: ${chain.id}
Native Currency: ${chain.nativeCurrency?.symbol || "ETH"}`;
};

// Add this component for the network status indicator
function NetworkStatus({ isConnected }: { isConnected: boolean }) {
  return (
    <div className="flex items-center">
      {isConnected ? (
        <Wifi className="h-3 w-3 text-green-500" />
      ) : (
        <WifiOff className="h-3 w-3 text-red-500" />
      )}
    </div>
  );
}

export default function Navbar() {
  const { openAuthModal } = useAuthModal();
  const { openLoginModal: openOrbLogin, isAuthenticated: isOrbAuthenticated } =
    useOrbSession();
  const user = useUser();
  const { logout } = useLogout();
  const { chain: currentChain, setChain, isSettingChain } = useChain();
  const { account: modularAccount } = useModularAccount();
  const [displayAddress, setDisplayAddress] = useState<string>("");
  const { client: smartAccountClient } = useSmartAccountClient({});
  const [isNetworkConnected, setIsNetworkConnected] = useState(true);
  const [isSessionSigsModalOpen, setIsSessionSigsModalOpen] = useState(false);
  const { isVerified, hasMembership } = useMembershipVerification();
  const [selectedToken, setSelectedToken] = useState<"ETH" | "USDC" | "DAI">("ETH");

  // Check for MeTokens to conditionally render the section
  const { userMeToken, loading: meTokenLoading } = useMeTokensSupabase();
  const { holdings, loading: holdingsLoading } = useMeTokenHoldings();
  const hasMetokens = !!userMeToken || holdings.length > 0;
  const shouldShowMetokens = hasMetokens || meTokenLoading || holdingsLoading;

  // Update display address when user changes
  useEffect(() => {
    // Smart Wallet is the primary public identity for Creative TV
    // EOA is kept in background for signing and permissions
    const addressToDisplay = modularAccount?.address || user?.address;

    if (addressToDisplay) {
      const resolved = truncateAddress(addressToDisplay);
      setDisplayAddress(resolved);
    }
  }, [modularAccount?.address, user?.address]);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState<"buy" | "send" | "swap">(
    "buy"
  );
  const addressRef = useRef<HTMLDivElement | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [currentChainName, setCurrentChainName] = useState(currentChain.name);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    logger.debug("Current Chain:", currentChain);
    logger.debug("Current Chain Name:", currentChain.name);
    logger.debug("Current Chain ID:", currentChain.id);
    setCurrentChainName(currentChain?.name || "Unknown Chain");
  }, [currentChain]);

  // Add scroll effect for sticky navbar
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Add network status check
  useEffect(() => {
    const checkNetworkStatus = async () => {
      try {
        if (user?.type === "eoa") {
          setIsNetworkConnected(true);
          return;
        }
        await smartAccountClient?.transport.request({
          method: "eth_blockNumber",
        });
        setIsNetworkConnected(true);
      } catch (error) {
        setIsNetworkConnected(false);
      }
    };

    const interval = setInterval(checkNetworkStatus, 10000);
    checkNetworkStatus();

    return () => clearInterval(interval);
  }, [smartAccountClient, user?.type]);

  useEffect(() => {
    setCurrentChainName(getChainName(currentChain) || "Unknown Chain");
  }, [currentChain]);

  const handleLinkClick = () => {
    setIsMenuOpen(false);
  };

  const handleActionClick = (action: "buy" | "send" | "swap") => {
    setDialogAction(action);
    setIsDialogOpen(true);
  };

  const copyToClipboard = async () => {
    // Prioritize Smart Account address, fallback to EOA
    const addressToCopy = modularAccount?.address || user?.address;

    if (addressToCopy) {
      try {
        // Copy the address directly without ENS resolution
        // This prevents webpack chunk loading issues with CCIP utilities
        await navigator.clipboard.writeText(addressToCopy);

        setCopySuccess(true);
        toast.success("Address copied to clipboard!");
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (err) {
        logger.error("Failed to copy address: ", err);
        toast.error("Failed to copy address");
      }
    }
  };

  // Chain information
  const chainNames: Record<number, string> = {
    8453: "Base",
    84532: "Base Sepolia",
  };

  // Chain icons mapping
  const chainIcons: Record<number, string> = {
    8453: "/images/base.svg", // Base icon
    84532: "/images/base-sepolia.svg", // Base Sepolia icon
  };

  // Create header className to avoid line length issues
  const headerClassName = `sticky top-0 z-40 w-full transition-all duration-300 ${isScrolled
    ? "shadow-md bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm"
    : "bg-white dark:bg-gray-900"
    }`;

  // Dialog content based on the selected action
  const getDialogContent = () => {
    switch (dialogAction) {
      case "buy":
        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
            <h2 className="text-xl font-bold mb-4">Buy Crypto</h2>
            <p className="mb-4">Purchase crypto directly to your wallet.</p>
            <CoinbaseFundButton />
            <div className="flex justify-end">
              <Button onClick={() => setIsDialogOpen(false)}>Close</Button>
            </div>
          </div>
        );
      case "send":
        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
            <h2 className="text-xl font-bold mb-4">Send Crypto</h2>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">Send crypto to another address.</p>
            <div className="flex flex-col gap-4">
              {/* Token Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900 dark:text-gray-100">Token</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['ETH', 'USDC', 'DAI'] as const).map((token) => (
                    <button
                      key={token}
                      type="button"
                      onClick={() => setSelectedToken(token)}
                      className={`flex items-center justify-center space-x-2 p-2 border rounded-lg transition-colors ${selectedToken === token
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400'
                        : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'
                        }`}
                    >
                      <Image
                        src={`/images/tokens/${token.toLowerCase()}-logo.svg`}
                        alt={token}
                        width={16}
                        height={16}
                        className="w-4 h-4 flex-shrink-0"
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
              </div>
              <div className="space-y-2">
                <label htmlFor="recipient-address" className="text-sm font-medium text-gray-900 dark:text-gray-100">Recipient Address</label>
                <input
                  id="recipient-address"
                  name="recipientAddress"
                  type="text"
                  placeholder="0x..."
                  className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 bg-white border-gray-200 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="send-amount" className="text-sm font-medium text-gray-900 dark:text-gray-100">Amount ({selectedToken})</label>
                <input
                  id="send-amount"
                  name="sendAmount"
                  type="number"
                  placeholder="0.0"
                  step="any"
                  className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 bg-white border-gray-200 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto sm:order-2"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button className="w-full sm:flex-1 sm:order-1">Send</Button>
              </div>
            </div>
          </div>
        );
      case "swap":
        return (
          <AlchemySwapWidget
            onSwapSuccess={() => {
              toast.success("Swap successful!");
              setIsDialogOpen(false);
            }}
            hideHeader={true}
            className="border-none shadow-none p-0"
          />
        );
      default:
        return null;
    }
  };

  return (
    <header className={headerClassName}>
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <Link
              href="/"
              className="flex items-center space-x-2 transition-transform duration-200 hover:scale-105"
            >
              <Image
                src={SITE_LOGO}
                alt={SITE_NAME}
                width={30}
                height={30}
                priority
                style={{ width: "30px", height: "30px" }}
                className="rounded-md"
              />
              <span className="mx-auto my-auto">
                <h1
                  className="text-lg"
                  style={{ fontFamily: "ConthraxSb-Regular , sans-serif" }}
                >
                  {SITE_ORG}
                  <span
                    className="ml-1 text-xl font-bold text-red-500"
                    style={{ fontFamily: "sans-serif" }}
                  >
                    {SITE_PRODUCT}
                  </span>
                </h1>
              </span>
            </Link>

            <nav className="hidden md:flex items-center ml-8 space-x-1">
              <Link href="/discover" className={navLinkClass} id="nav-discover-link">
                Discover
              </Link>
              {/* <Link href="/leaderboard" className={navLinkClass}>
                Leaderboard
              </Link> */}
              <Link href="/market" className={navLinkClass} id="nav-trade-link">
                Trade
              </Link>
              <Link href="/predict" className={navLinkClass} id="nav-predict-link">
                Predictions
              </Link>
              <Link href="/vote" prefetch={false} className={navLinkClass}>
                Campaigns
              </Link>
            </nav>
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden items-center">
            <ThemeToggleComponent />
            <button
              className={
                "ml-2 inline-flex items-center justify-center rounded-md p-2 " +
                "text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 " +
                "dark:hover:bg-gray-800 dark:hover:text-gray-50 transition-colors"
              }
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-expanded={isMenuOpen}
              id="mobile-menu-btn"
            >
              <span className="sr-only">Open main menu</span>
              <MenuIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Desktop wallet display */}
          <div className="hidden md:flex items-center space-x-4">
            <div className="flex items-center">
              <ThemeToggleComponent />
            </div>
            <div>
              <AccountDropdown />
            </div>
          </div>

          {/* Mobile menu */}
          <div
            className={
              "fixed inset-0 top-16 z-50 grid h-[calc(100vh-4rem)] grid-flow-row " +
              "auto-rows-max overflow-auto p-4 pb-32 shadow-md md:hidden bg-white dark:bg-gray-900 " +
              (isMenuOpen ? "animate-in slide-in-from-top-5" : "hidden")
            }
            aria-hidden={!isMenuOpen}
            inert={!isMenuOpen}
          >
            <div
              className={
                "relative z-20 grid gap-4 rounded-md " +
                "text-popover-foreground"
              }
            >
              {/* User Account Section or Get Started */}
              <HydrationSafe>
                {user ? (
                  <div className="space-y-4 border-b border-gray-200 dark:border-gray-700 pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage
                            src={makeBlockie(modularAccount?.address || user?.address || "0x")}
                            alt="Wallet avatar"
                          />
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">
                            {displayAddress}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {getChainName(currentChain)}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={copyToClipboard}
                        className="h-8 w-8 p-0"
                      >
                        {copySuccess ? (
                          <CheckIcon className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="pb-4 border-b border-gray-200 dark:border-gray-700">
                    <Button
                      className="w-full bg-gradient-to-r from-blue-600 to-purple-600 
                        hover:from-blue-700 hover:to-purple-700 text-white 
                        transition-all duration-300 hover:shadow-lg"
                      onClick={() => {
                        openAuthModal();
                        setIsMenuOpen(false);
                      }}
                      id="connect-wallet-btn"
                    >
                      Get Started
                    </Button>
                    {!isOrbAuthenticated && (
                      <Button
                        variant="outline"
                        className="w-full mt-2"
                        onClick={() => {
                          openOrbLogin();
                          setIsMenuOpen(false);
                        }}
                      >
                        Sign in with Orb
                      </Button>
                    )}
                  </div>
                )}
              </HydrationSafe>

              {/* Navigation Links */}
              <nav className="grid grid-flow-row gap-2 auto-rows-max text-sm pb-4 border-b border-gray-200 dark:border-gray-700">
                <Link
                  href="/discover"
                  className={mobileNavLinkClass}
                  onClick={handleLinkClick}
                  id="mobile-nav-discover-link"
                >
                  Discover
                </Link>
                <Link
                  href="/market"
                  className={mobileNavLinkClass}
                  onClick={handleLinkClick}
                  id="mobile-nav-trade-link"
                >
                  Trade
                </Link>
                <Link
                  href="/predict"
                  className={mobileNavLinkClass}
                  onClick={handleLinkClick}
                  id="mobile-nav-predict-link"
                >
                  Predictions
                </Link>
                <Link
                  href="/vote"
                  className={mobileNavLinkClass}
                  onClick={handleLinkClick}
                >
                  Campaigns
                </Link>

                {/* Member/User Options */}
                <HydrationSafe>
                  {user && (
                    <>
                      <div className="mt-4 mb-1 text-xs text-muted-foreground font-semibold">
                        Options
                      </div>
                      <Link
                        href="/profile"
                        className={mobileMemberNavLinkClass}
                        onClick={handleLinkClick}
                      >
                        <ShieldUser className="mr-2 h-4 w-4" /> Profile
                      </Link>
                      <Link
                        href="/upload"
                        className={mobileMemberNavLinkClass}
                        onClick={handleLinkClick}
                        id="nav-upload-link"
                      >
                        <CloudUpload className="mr-2 h-4 w-4" /> Upload
                      </Link>

                      {/* Membership Status Section */}
                      <div className="mt-4">
                        <MembershipSection />
                      </div>

                      {isVerified && hasMembership && (
                        <>
                          <div className="mt-4 mb-1 text-xs text-muted-foreground font-semibold">
                            Member Access
                          </div>
                          <Link
                            href="/live"
                            className={mobileMemberNavLinkClass}
                            onClick={handleLinkClick}
                          >
                            <RadioTower className="mr-2 h-4 w-4" /> Live
                          </Link>
                          <Link
                            href="https://create.creativeplatform.xyz"
                            className={mobileMemberNavLinkClass}
                            onClick={handleLinkClick}
                          >
                            <Bot className="mr-2 h-4 w-4" /> Pixels
                            <span className="ml-2 px-2 py-0.5 rounded bg-muted-foreground/10 text-xs text-muted-foreground">
                              Beta
                            </span>
                          </Link>
                          <Link
                            href="/vote/create"
                            className="flex w-full items-center rounded-md p-2 text-sm font-medium
                                hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors
                                text-green-600 dark:text-green-400"
                            onClick={handleLinkClick}
                          >
                            <Plus className="mr-2 h-4 w-4 text-green-500" /> Poll
                          </Link>
                          <Link
                            href="/predict/create"
                            className="flex w-full items-center rounded-md p-2 text-sm font-medium
                                hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors
                                text-blue-600 dark:text-blue-400"
                            onClick={handleLinkClick}
                          >
                            <TrendingUp className="mr-2 h-4 w-4 text-blue-500" /> Predict
                          </Link>
                        </>
                      )}
                    </>
                  )}
                </HydrationSafe>

                {/* Feedback Link */}
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Link
                    href="https://feedback.creativeplatform.xyz/crtv"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={mobileNavLinkClass}
                    onClick={handleLinkClick}
                  >
                    <ArrowUpRight className="mr-2 h-4 w-4" />
                    Feedback
                  </Link>
                </div>
              </nav>

              {/* User Specific Bottom Sections */}
              <HydrationSafe>
                {user && (
                  <>
                    {/* Network Selection */}
                    <div className="mt-4 pt-4">
                      <p className="text-sm font-medium mb-2">Network</p>
                      <ChainSelect className="w-full" />
                    </div>

                    {/* Wallet Actions */}
                    <div className="mt-4 grid grid-cols-3 gap-2 pb-4 border-b border-gray-200 dark:border-gray-700">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          handleActionClick("buy");
                          setIsMenuOpen(false);
                        }}
                        className="flex items-center justify-center"
                      >
                        <Plus className="mr-2 h-4 w-4 text-green-500" />
                        Buy
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          handleActionClick("send");
                          setIsMenuOpen(false);
                        }}
                        className="flex items-center justify-center"
                      >
                        <ArrowUpRight className="mr-2 h-4 w-4 text-blue-500" />
                        Send
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          handleActionClick("swap");
                          setIsMenuOpen(false);
                        }}
                        className="flex items-center justify-center"
                      >
                        <ArrowUpDown className="mr-2 h-4 w-4 text-purple-500" />
                        Swap
                      </Button>
                    </div>

                    {/* Add TokenBalance here */}
                    <div className="mt-4">
                      <TokenBalance />
                    </div>

                    {/* Add MeTokenBalances here */}
                    {shouldShowMetokens && (
                      <div className="mt-4">
                        <MeTokenBalances />
                      </div>
                    )}

                    {/* Logout Button */}
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <button
                        onClick={() => {
                          logout();
                          setIsMenuOpen(false);
                        }}
                        className="flex w-full items-center rounded-md p-2 text-sm font-medium
                            hover:bg-red-50 dark:hover:bg-red-900 transition-colors text-red-500"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Logout
                      </button>
                    </div>
                  </>
                )}
              </HydrationSafe>

              {/* Navigation Links */}

            </div>
          </div>

          {/* Account Kit Dialog for actions */}
          <AccountKitDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)}>
            <div className="max-w-md mx-auto">{getDialogContent()}</div>
          </AccountKitDialog>
        </div>
      </div>
    </header>
  );
}

function MenuIcon(props: any) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
      {...props}
    >
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  );
}
