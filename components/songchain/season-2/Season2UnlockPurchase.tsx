"use client";

import { useEffect, useState } from "react";
import {
  type Abi,
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  getAddress,
  http,
  isAddress,
} from "viem";
import PublicLockV14Json from "@unlock-protocol/contracts/dist/abis/PublicLock/PublicLockV14.json";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  useAuthModal,
  useChain,
  useSendUserOperation,
  useSmartAccountClient,
  useUser,
} from "@/lib/wallet/react";
import { getLensChain, resolveLensRpcUrl } from "@/lib/sdk/lens/chains";
import { appendBuilderCode } from "@/lib/utils/builder-code";
import {
  SEASON_2_UNLOCK_CHAIN_ID,
  SEASON_2_UNLOCK_CURRENCY,
  SEASON_2_UNLOCK_GHO_DECIMALS,
  SEASON_2_UNLOCK_KEY_PRICE,
  SEASON_2_UNLOCK_PRICE_GHO,
} from "@/lib/songchain/season-2-unlock";

type Season2UnlockPurchaseProps = {
  lockAddress: string;
  onPurchaseSuccess?: () => void | Promise<void>;
};

const lensMainnetPublicClient = createPublicClient({
  chain: getLensChain("mainnet"),
  transport: http(resolveLensRpcUrl("mainnet")),
});

export function Season2UnlockPurchase({
  lockAddress,
  onPurchaseSuccess,
}: Season2UnlockPurchaseProps) {
  const user = useUser();
  const { openAuthModal } = useAuthModal();
  const { chain, setChain } = useChain();
  const { client, address: clientAddress } = useSmartAccountClient({});
  const address = client?.account?.address ?? clientAddress ?? user?.address;
  const lensMainnet = getLensChain("mainnet");
  const onLensMainnet = chain?.id === SEASON_2_UNLOCK_CHAIN_ID;

  const [ghoBalance, setGhoBalance] = useState("0");
  const [isBalanceLoading, setIsBalanceLoading] = useState(true);

  const { sendUserOperation, isSendingUserOperation } = useSendUserOperation({
    client,
    waitForTxn: true,
    onSuccess: async () => {
      toast.success("Season 2 pass purchased!");
      await onPurchaseSuccess?.();
    },
    onError: (error) => {
      console.error("[Season2UnlockPurchase]", error);
      toast.error("Failed to purchase Season 2 pass. Please try again.");
    },
  });

  useEffect(() => {
    let active = true;

    async function fetchBalance() {
      if (!address || !isAddress(address)) {
        if (active) {
          setGhoBalance("0");
          setIsBalanceLoading(false);
        }
        return;
      }

      if (active) {
        setIsBalanceLoading(true);
      }
      try {
        const balance = await lensMainnetPublicClient.readContract({
          address: SEASON_2_UNLOCK_CURRENCY,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address],
        });
        if (active) {
          setGhoBalance(formatUnits(balance, SEASON_2_UNLOCK_GHO_DECIMALS));
        }
      } catch (error) {
        console.error("[Season2UnlockPurchase] balance", error);
        if (active) {
          setGhoBalance("0");
        }
      } finally {
        if (active) {
          setIsBalanceLoading(false);
        }
      }
    }

    void fetchBalance();
    const interval = setInterval(() => void fetchBalance(), 10_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [address]);

  const handleSwitchToLens = () => {
    setChain({ chain: lensMainnet });
  };

  const handlePurchase = () => {
    if (!address) {
      openAuthModal();
      return;
    }

    if (!client) {
      toast.error("Wallet is still connecting. Try again in a moment.");
      return;
    }

    if (!onLensMainnet) {
      toast.error("Switch to Lens mainnet to purchase the Season 2 pass.");
      handleSwitchToLens();
      return;
    }

    if (!isAddress(lockAddress)) {
      toast.error("Season 2 Unlock lock is not configured.");
      return;
    }

    const balance = Number.parseFloat(ghoBalance);
    const price = Number.parseFloat(SEASON_2_UNLOCK_PRICE_GHO);
    if (!Number.isFinite(balance) || balance < price) {
      toast.error(
        `Insufficient GHO. You need ${SEASON_2_UNLOCK_PRICE_GHO} GHO on Lens to purchase.`,
      );
      return;
    }

    const lock = getAddress(lockAddress);
    const userAddress = getAddress(address);
    const zeroAddress =
      "0x0000000000000000000000000000000000000000" as const;

    const approvalData = encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [lock, SEASON_2_UNLOCK_KEY_PRICE],
    });

    const purchaseData = encodeFunctionData({
      abi: PublicLockV14Json.abi as Abi,
      functionName: "purchase",
      args: [
        [SEASON_2_UNLOCK_KEY_PRICE],
        [userAddress],
        [zeroAddress],
        [userAddress],
        ["0x"],
      ],
    });

    sendUserOperation({
      uo: [
        {
          target: SEASON_2_UNLOCK_CURRENCY,
          data: appendBuilderCode(approvalData),
          value: 0n,
        },
        {
          target: lock,
          data: appendBuilderCode(purchaseData),
          value: 0n,
        },
      ],
    });
  };

  const canPurchase = Boolean(address && client && onLensMainnet);

  return (
    <section
      className="rounded-lg border border-violet-500/30 bg-gradient-to-b from-violet-500/10 to-card p-6 sm:p-8"
      aria-labelledby="season-2-unlock-title"
    >
      <div className="mx-auto flex max-w-lg flex-col items-center text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-violet-500/15">
          <Lock className="h-7 w-7 text-violet-300" aria-hidden />
        </div>
        <h2
          id="season-2-unlock-title"
          className="text-xl font-bold tracking-tight sm:text-2xl"
        >
          Season 2 Exclusive Pass
        </h2>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Unlock the Season 2 exclusive feed with a unique NFT on Lens mainnet
          for {SEASON_2_UNLOCK_PRICE_GHO} GHO.
        </p>

        <p className="mt-4 text-sm text-muted-foreground">
          Your GHO balance:{" "}
          <span className="font-medium text-foreground">
            {isBalanceLoading
              ? "—"
              : `${Number.isFinite(Number.parseFloat(ghoBalance)) ? Number.parseFloat(ghoBalance).toFixed(2) : "0.00"} GHO`}
          </span>
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          {!address ? (
            <Button size="lg" onClick={() => openAuthModal()} className="min-w-[10rem]">
              Connect wallet
            </Button>
          ) : !onLensMainnet ? (
            <Button size="lg" onClick={handleSwitchToLens} className="min-w-[10rem]">
              Switch to Lens
            </Button>
          ) : (
            <Button
              size="lg"
              disabled={!canPurchase || isSendingUserOperation}
              onClick={handlePurchase}
              className="min-w-[10rem]"
            >
              {isSendingUserOperation ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Buy for {SEASON_2_UNLOCK_PRICE_GHO} GHO
            </Button>
          )}
        </div>

        <p className="mt-4 text-[10px] text-muted-foreground">
          Lock{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-[10px]">
            {lockAddress.slice(0, 10)}…{lockAddress.slice(-6)}
          </code>
        </p>
      </div>
    </section>
  );
}
