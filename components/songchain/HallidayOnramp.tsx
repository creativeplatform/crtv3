"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  initializeClient,
  openHallidayPayments,
} from "@halliday-sdk/payments";
import { connectWalletClient } from "@halliday-sdk/payments/viem";
import { useAuthModal, useSmartAccountClient, useUser } from "@/lib/wallet/react";
import type { WalletClient } from "viem";
import { Button } from "@/components/ui/button";
import { useLensOrbWrite } from "@/hooks/useLensOrbWrite";
import { Wallet } from "lucide-react";
import {
  isHallidayLensChainAsset,
  isHallidayLensOnrampSupported,
} from "@/lib/songchain/halliday";

/** Above app modals (e.g. z-50 nav, z-[99999] selects) so Halliday header stays visible. */
const HALLIDAY_WIDGET_Z_INDEX = 1_000_000;

export type HallidayOnrampVariant = "lens" | "story";

export type HallidayOnrampProps = {
  hallidayApiKey: string | null;
  hallidayOutputAsset: string;
  /** Fiat or token ids for the pay side, e.g. `["usd"]` for card onramp. */
  hallidayInputAssets: string[];
  hallidaySandbox: boolean;
  /** Lens GHO onramp vs Story $IP gas funding. */
  variant?: HallidayOnrampVariant;
  /** Override destination (e.g. Story funding wallet). */
  destinationAddressOverride?: string | null;
  /** When true, skip mount-time preload; init on button click only. */
  lazyInit?: boolean;
  /** When true and the Lens GHO onramp is unsupported, render nothing instead of the help text. */
  hideLensBlockedMessage?: boolean;
};

const VARIANT_COPY: Record<
  HallidayOnrampVariant,
  {
    headerTitle: string;
    buttonLabel: string;
    title: string;
    description: string;
    connectMessage: string;
    footer: string;
    missingKeyMessage: string;
  }
> = {
  lens: {
    headerTitle: "Buy GHO",
    buttonLabel: "Get GHO",
    title: "Fund on Lens Chain",
    description: "Buy GHO on Lens with debit/credit via Halliday — destination",
    connectMessage:
      "Sign in and connect a wallet so funds arrive at your Lens destination address.",
    footer:
      "Opens Halliday checkout. Pay by card or bank in the widget to receive GHO at your Lens destination.",
    missingKeyMessage: "Fund your Lens wallet with GHO via Halliday",
  },
  story: {
    headerTitle: "Buy $IP",
    buttonLabel: "Buy $IP",
    title: "Fund Story Protocol Gas",
    description: "Buy $IP with debit/credit via Halliday — destination",
    connectMessage: "Connect your wallet so Halliday knows where to send $IP.",
    footer:
      "Opens Halliday checkout. Pay by card or bank to top up Story Protocol gas.",
    missingKeyMessage: "Fund Story Protocol gas with $IP via Halliday",
  },
};

export function HallidayOnramp({
  hallidayApiKey,
  hallidayOutputAsset,
  hallidayInputAssets,
  hallidaySandbox,
  variant = "story",
  destinationAddressOverride,
  lazyInit = true,
  hideLensBlockedMessage = false,
}: HallidayOnrampProps) {
  const lensOnrampBlocked =
    (variant === "lens" || isHallidayLensChainAsset(hallidayOutputAsset)) &&
    !isHallidayLensOnrampSupported();

  const copy = VARIANT_COPY[variant];
  const { openAuthModal } = useAuthModal();
  const user = useUser();
  const { client: smartAccountClient, address: smartAccountAddress } =
    useSmartAccountClient({});
  const { lensAccount } = useLensOrbWrite();

  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const destinationAddress = useMemo(() => {
    if (destinationAddressOverride) return destinationAddressOverride;
    if (variant === "story") {
      return (
        smartAccountClient?.account?.address ??
        smartAccountAddress ??
        user?.address ??
        null
      );
    }
    return (
      lensAccount ??
      smartAccountClient?.account?.address ??
      smartAccountAddress ??
      user?.address ??
      null
    );
  }, [
    destinationAddressOverride,
    variant,
    lensAccount,
    smartAccountClient?.account?.address,
    smartAccountAddress,
    user?.address,
  ]);

  const userWallet = useMemo(() => {
    if (!smartAccountClient || !destinationAddress) return undefined;
    return connectWalletClient(
      () => smartAccountClient as unknown as WalletClient,
      "HIDE",
    );
  }, [smartAccountClient, destinationAddress]);

  const baseParams = useMemo(
    () => ({
      apiKey: hallidayApiKey ?? "",
      inputs: hallidayInputAssets,
      outputs: [hallidayOutputAsset],
      sandbox: hallidaySandbox,
      windowType: "MODAL" as const,
      sessionType: "cash" as const,
      destinationAddress: destinationAddress ?? undefined,
      headerTitle: copy.headerTitle,
      customStyles: {
        zIndex: HALLIDAY_WIDGET_Z_INDEX,
        backgroundStyle: "BLUR" as const,
      },
      userWallet,
      onError: (err: Error) => {
        setError(err.message || "Halliday widget failed to load.");
      },
      onConnectUserWallet: () => openAuthModal(),
    }),
    [
      hallidayApiKey,
      hallidayInputAssets,
      hallidayOutputAsset,
      hallidaySandbox,
      destinationAddress,
      userWallet,
      openAuthModal,
      copy.headerTitle,
    ],
  );

  const ensureInitialized = useCallback(async () => {
    if (!hallidayApiKey || initialized) return;
    await initializeClient({
      ...baseParams,
      onError: (err) => {
        setError(err.message || "Halliday failed to preload.");
      },
    });
    setInitialized(true);
  }, [hallidayApiKey, initialized, baseParams]);

  useEffect(() => {
    if (!lazyInit && hallidayApiKey && !lensOnrampBlocked) {
      void ensureInitialized();
    }
  }, [lazyInit, hallidayApiKey, lensOnrampBlocked, ensureInitialized]);

  const requireWallet = useCallback((): boolean => {
    if (destinationAddress) return true;
    setError(copy.connectMessage);
    openAuthModal();
    return false;
  }, [destinationAddress, openAuthModal, copy.connectMessage]);

  const openOnramp = useCallback(async () => {
    if (!hallidayApiKey || !requireWallet()) return;
    setError(null);
    try {
      await ensureInitialized();
      openHallidayPayments(baseParams);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open Halliday.");
    }
  }, [hallidayApiKey, requireWallet, ensureInitialized, baseParams]);

  if (!hallidayApiKey) {
    return (
      <p className="text-sm text-muted-foreground">
        {copy.missingKeyMessage} — set{" "}
        <code className="text-xs">NEXT_PUBLIC_HALLIDAY_API_KEY</code> to enable.
      </p>
    );
  }

  if (lensOnrampBlocked) {
    if (hideLensBlockedMessage) return null;
    return (
      <p className="text-sm text-muted-foreground">
        Lens GHO onramp via Halliday is temporarily unavailable — Halliday
        production does not support the Lens chain yet. Bridge or swap GHO on Lens
        manually, or set{" "}
        <code className="text-xs">NEXT_PUBLIC_HALLIDAY_LENS_ENABLED=true</code>{" "}
        after Halliday enables Lens.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-border/60 bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Wallet className="h-4 w-4 text-violet-400" aria-hidden />
            {copy.title}
          </h3>
          <p className="text-sm text-muted-foreground">
            {copy.description}{" "}
            {destinationAddress
              ? `${destinationAddress.slice(0, 6)}…${destinationAddress.slice(-4)}`
              : "connect wallet"}
          </p>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={() => void openOnramp()}>
          {copy.buttonLabel}
        </Button>
      </div>

      {error && (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}{" "}
          <button type="button" className="underline" onClick={() => void openOnramp()}>
            Try again
          </button>
        </p>
      )}

      {!destinationAddress && (
        <p className="mt-3 text-sm text-amber-200/90">{copy.connectMessage}</p>
      )}

      <p className="mt-3 text-xs text-muted-foreground">{copy.footer}</p>
    </div>
  );
}
