// components/Navbar.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  useAuthModal,
  useUser,
  useChain,
} from "@/lib/wallet/react";
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
import { useSmartWalletDisplayAddress } from "@/lib/hooks/accountkit/useSmartWalletDisplayAddress";
import { base } from "@account-kit/infra";
import { TokenBalance } from "./wallet/balance/TokenBalance";
import { MeTokenBalances } from "./wallet/balance/MeTokenBalances";
import type { Chain as ViemChain } from "viem";
import {
  AccountDropdown,
  type AccountDropdownHandle,
} from "@/components/account-dropdown/AccountDropdown";
import { MobileOrbSection } from "@/components/account-dropdown/MobileOrbSection";
import { useUnifiedLogout } from "@/hooks/useUnifiedLogout";
import { shortenAddress } from "@/lib/utils/utils";
import { useMembershipContext } from "@/lib/context/MembershipContext";
import { useMeTokensSupabase } from "@/lib/hooks/metokens/useMeTokensSupabase";
import { useMeTokenHoldings } from "@/lib/hooks/metokens/useMeTokenHoldings";
import { MembershipSection } from "./account-dropdown/MembershipSection";
import { ChainSelect } from "@/components/ui/select";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import makeBlockie from "ethereum-blockies-base64";
import { logger } from '@/lib/utils/logger';
import { AnimatedMenuIcon } from "@/components/navbar/AnimatedMenuIcon";
import { CreativePlatformAppsDrawer } from "@/components/navbar/CreativePlatformAppsDrawer";
import { navIconButtonProps } from "@/components/navbar/navButtonStyles";
import {
  hasAnyValidPass,
  hasValidBrandPass,
  hasValidCreatorPass,
} from "@/lib/access/creator-membership";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

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

/** Matches Tailwind `md` — mobile nav is hidden at 768px and above */
const MOBILE_NAV_MEDIA_QUERY = "(max-width: 767px)";

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
  const user = useUser();
  const unifiedLogout = useUnifiedLogout();
  const { chain: currentChain, setChain, isSettingChain } = useChain();
  const {
    primaryAddress,
    signerAddress,
    displayAddress,
    walletLabel,
    client: smartAccountClient,
  } = useSmartWalletDisplayAddress();
  const [isNetworkConnected, setIsNetworkConnected] = useState(true);
  const {
    isVerified,
    hasMembership,
    membershipDetails,
  } = useMembershipContext();

  // Check for MeTokens to conditionally render the section
  const { userMeToken, loading: meTokenLoading } = useMeTokensSupabase();
  const { holdings, loading: holdingsLoading } = useMeTokenHoldings();
  const hasMetokens = !!userMeToken || holdings.length > 0;
  const shouldShowMetokens = hasMetokens || meTokenLoading || holdingsLoading;

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();
  const accountDropdownRef = useRef<AccountDropdownHandle>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    const openMobileMenu = () => setIsMenuOpen(true);
    const closeMobileMenu = () => setIsMenuOpen(false);
    window.addEventListener("crtv:open-mobile-menu", openMobileMenu);
    window.addEventListener("crtv:close-mobile-menu", closeMobileMenu);
    return () => {
      window.removeEventListener("crtv:open-mobile-menu", openMobileMenu);
      window.removeEventListener("crtv:close-mobile-menu", closeMobileMenu);
    };
  }, []);

  // Close menu when viewport grows past mobile (e.g. rotate tablet) so scroll lock cannot stick
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_NAV_MEDIA_QUERY);
    const handleChange = () => {
      if (!mq.matches) setIsMenuOpen(false);
    };
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  // Close menu on navigation (e.g. logo link has no explicit close handler)
  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

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

  const openAccountAction = (
    action: "buy" | "send" | "swap" | "session-keys"
  ) => {
    if (accountDropdownRef.current) {
      accountDropdownRef.current.openAction(action);
      setIsMenuOpen(false);
    }
  };

  const copyToClipboard = async () => {
    const addressToCopy = primaryAddress;

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

  return (
    <>
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

          {/* Desktop: account dropdown. Mobile: hamburger only. */}
          <div className="flex items-center gap-2">
            <CreativePlatformAppsDrawer />
            <ThemeToggleComponent />
            <HydrationSafe>
              <AccountDropdown ref={accountDropdownRef} />
            </HydrationSafe>
            <Button
              {...navIconButtonProps}
              className="md:hidden"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-expanded={isMenuOpen}
              id="mobile-menu-btn"
              aria-label={isMenuOpen ? "Close main menu" : "Open main menu"}
            >
              <AnimatedMenuIcon isOpen={isMenuOpen} />
            </Button>
          </div>
        </div>
      </div>
    </header>

    <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
      <SheetContent
        side="right"
        overlayClassName="z-[100] bg-black/50 md:hidden"
        className="fixed inset-y-0 right-0 z-[101] flex h-full w-full flex-col overflow-hidden border-0 p-0 md:hidden bg-background [&>button]:hidden"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Navigation menu</SheetTitle>
          <SheetDescription>
            Site navigation, wallet, and account options.
          </SheetDescription>
        </SheetHeader>

        {/** Self-contained mobile menu header so it works even when the page is scrolled. */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4">
          <Link
            href="/"
            className="flex items-center space-x-2"
            onClick={() => setIsMenuOpen(false)}
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
            <span className="text-lg" style={{ fontFamily: "ConthraxSb-Regular, sans-serif" }}>
              {SITE_ORG}
              <span className="ml-1 text-xl font-bold text-red-500" style={{ fontFamily: "sans-serif" }}>
                {SITE_PRODUCT}
              </span>
            </span>
          </Link>
          <SheetClose asChild>
            <Button
              {...navIconButtonProps}
              className="md:hidden"
              aria-label="Close main menu"
              onClick={() => setIsMenuOpen(false)}
            >
              <AnimatedMenuIcon isOpen={true} />
            </Button>
          </SheetClose>
        </div>

        <div
          className={
            "flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y " +
            "[-webkit-overflow-scrolling:touch] p-4 " +
            "pb-[calc(2rem+env(safe-area-inset-bottom,0px))]"
          }
        >
          <div className="relative grid gap-4 rounded-md text-popover-foreground">

              {/* User Account Section or Get Started */}
              <HydrationSafe>
                {user ? (
                  <div className="space-y-4 border-b border-gray-200 dark:border-gray-700 pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage
                            src={makeBlockie(primaryAddress || user?.address || "0x")}
                            alt="Wallet avatar"
                          />
                        </Avatar>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {walletLabel}
                          </p>
                          <p className="text-sm font-medium font-mono">
                            {displayAddress || "Loading..."}
                          </p>
                          {signerAddress && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Signer: {shortenAddress(signerAddress)}
                              </p>
                            )}
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
                    <MobileOrbSection />
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
                      id="connect-wallet-btn-mobile"
                    >
                      Get Started
                    </Button>
                  </div>
                )}
              </HydrationSafe>

              {/* Navigation Links */}
              <nav className="grid grid-flow-row gap-2 auto-rows-max text-sm pb-4 border-b border-gray-200 dark:border-gray-700">
                <Link
                  href="/"
                  className={mobileNavLinkClass}
                  onClick={handleLinkClick}
                  id="mobile-nav-home-link"
                >
                  Home
                </Link>
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
                        href={`/profile/${primaryAddress ?? ""}`}
                        className={mobileMemberNavLinkClass}
                        onClick={handleLinkClick}
                      >
                        <ShieldUser className="mr-2 h-4 w-4" /> Profile
                      </Link>
                      <Link
                        href={`/upload/${primaryAddress ?? ""}`}
                        className={mobileMemberNavLinkClass}
                        onClick={handleLinkClick}
                        id="nav-upload-link"
                      >
                        <CloudUpload className="mr-2 h-4 w-4" /> Upload
                      </Link>
                      {user?.type !== "eoa" && (
                        <button
                          type="button"
                          className={mobileMemberNavLinkClass}
                          onClick={() => openAccountAction("session-keys")}
                        >
                          <Key className="mr-2 h-4 w-4 text-yellow-500" /> Session Keys
                        </button>
                      )}

                      {/* Membership Status Section */}
                      <div className="mt-4">
                        <MembershipSection onNavigate={handleLinkClick} />
                      </div>

                      {isVerified && user && (
                        <>
                          <div className="mt-4 mb-1 text-xs text-muted-foreground font-semibold">
                            Member Access
                          </div>
                          {(hasValidCreatorPass(membershipDetails) || hasValidBrandPass(membershipDetails)) && (
                            <Link
                              href="/live"
                              className={mobileMemberNavLinkClass}
                              onClick={handleLinkClick}
                            >
                              <RadioTower className="mr-2 h-4 w-4" /> Live
                            </Link>
                          )}
                          {hasAnyValidPass(membershipDetails) && (
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
                          )}
                          {hasValidBrandPass(membershipDetails) && (
                            <Link
                              href="/vote/create"
                              className="flex w-full items-center rounded-md p-2 text-sm font-medium
                                  hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors
                                  text-green-600 dark:text-green-400"
                              onClick={handleLinkClick}
                            >
                              <Plus className="mr-2 h-4 w-4 text-green-500" /> Campaigns
                            </Link>
                          )}
                          {!hasValidCreatorPass(membershipDetails) && !hasValidBrandPass(membershipDetails) && (
                            <Link
                              href="/predict/create"
                              className="flex w-full items-center rounded-md p-2 text-sm font-medium
                                  hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors
                                  text-blue-600 dark:text-blue-400"
                              onClick={handleLinkClick}
                            >
                              <TrendingUp className="mr-2 h-4 w-4 text-blue-500" /> Predict
                            </Link>
                          )}
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

                    {/* Balances */}
                    <div className="mt-4">
                      <TokenBalance />
                    </div>

                    {/* Wallet Actions */}
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openAccountAction("buy")}
                        className="flex items-center justify-center"
                      >
                        <Plus className="mr-2 h-4 w-4 text-green-500" />
                        Add
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openAccountAction("send")}
                        className="flex items-center justify-center"
                      >
                        <ArrowUpRight className="mr-2 h-4 w-4 text-blue-500" />
                        Send
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openAccountAction("swap")}
                        className="flex items-center justify-center"
                      >
                        <ArrowUpDown className="mr-2 h-4 w-4 text-purple-500" />
                        Swap
                      </Button>
                    </div>

                    {/* MeTokenBalances */}
                    {shouldShowMetokens && (
                      <div className="mt-4">
                        <MeTokenBalances />
                      </div>
                    )}

                    {/* Logout Button */}
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <button
                        onClick={() => {
                          void unifiedLogout();
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
          </div>
        </div>
      </SheetContent>
    </Sheet>
    </>
  );
}
