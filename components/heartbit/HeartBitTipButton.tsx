"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  type Address,
  createPublicClient,
  formatUnits,
  http,
} from "viem";
import { base } from "viem/chains";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CAMPAIGN_STICKERS_ADDRESS,
  campaignStickersAbi,
} from "@/lib/contracts/CampaignStickers";
import {
  USDC_TOKEN_ADDRESSES,
  USDC_TOKEN_DECIMALS,
} from "@/lib/contracts/USDCToken";
import { useHeartBit } from "@/components/heartbit/HeartBitProvider";
import { useVideoTip } from "@/lib/hooks/video/useVideoTip";
import { useSmartAccountClient } from "@/lib/wallet/react";
import { useWalletAuth } from "@/lib/auth/useWalletAuth";
import { buildCompositeHash } from "@/lib/sdk/heartbit/client";
import {
  MAX_HOLD_SECONDS,
  USDC_TIP_RATE_PER_SECOND,
} from "@/lib/sdk/heartbit/config";
import { getErc20Balance } from "@/lib/viem";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/utils/logger";
import type { StickerTipRow } from "@/lib/sdk/supabase/campaign-stickers";
import type { TokenSymbol } from "@/lib/hooks/video/useVideoTip";

type StickerOption = {
  token_id: number;
  ipfs_hash: string;
  name: string | null;
  image_uri: string | null;
  balance: bigint;
};

type HeartBitTipButtonProps = {
  videoId: string;
  videoIpfsHash?: string | null;
  creatorAddress: string;
  className?: string;
  /** Hide the optional sticker picker (useful in dense live chat headers). */
  showStickerPicker?: boolean;
  /** Fired after a successful USDC tip (for live chat announcements, etc.). */
  onTipSuccess?: (txHash: string, amount: string, token: TokenSymbol) => void;
};

const MIN_TIP_USDC = 0.01;
/** Heart fill animation reaches 100% at this hold time — visual only, not a tip cap. */
const FILL_SECONDS = 5;

const HEART_PATH =
  "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z";

function AnimatedHeart({
  fillPct,
  pulsing,
}: {
  fillPct: number;
  pulsing?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, fillPct));
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("h-5 w-5", pulsing && "animate-pulse")}
    >
      <path
        d={HEART_PATH}
        fill="none"
        stroke="#ef4444"
        strokeWidth="1.5"
      />
      <g
        style={{
          clipPath: `inset(${100 - clamped}% 0 0 0)`,
          transition: "clip-path 1s linear",
        }}
      >
        <path d={HEART_PATH} fill="#ef4444" />
      </g>
    </svg>
  );
}

function ipfsToHttp(uri: string | null | undefined): string | undefined {
  if (!uri) return undefined;
  if (uri.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${uri.slice(7)}`;
  }
  return uri;
}

function pulseHaptic() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(15);
    } catch {
      // ignore unsupported haptics
    }
  }
}

export function HeartBitTipButton({
  videoId,
  videoIpfsHash,
  creatorAddress,
  className,
  showStickerPicker = true,
  onTipSuccess,
}: HeartBitTipButtonProps) {
  const { address } = useSmartAccountClient({});
  const { mintHeartBit } = useHeartBit();
  const { sendTip, isTipping, balances, fetchBalances } = useVideoTip();
  const { getAuthHeaders } = useWalletAuth();

  const [stickers, setStickers] = useState<StickerOption[]>([]);
  const [selected, setSelected] = useState<StickerOption | null>(null);
  const [holding, setHolding] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [myTipTotal, setMyTipTotal] = useState<number | null>(null);
  const [myLastTipSeconds, setMyLastTipSeconds] = useState<number | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const startTimeRef = useRef<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdingRef = useRef(false);

  const videoHash = videoIpfsHash || `playback:${videoId}`;

  const tipUsd = useMemo(
    () => Number((elapsed * USDC_TIP_RATE_PER_SECOND).toFixed(2)),
    [elapsed]
  );

  const fillPercentage = useMemo(() => {
    // Visual only — amount keeps accruing past FILL_SECONDS.
    return Math.min(100, (elapsed / FILL_SECONDS) * 100);
  }, [elapsed]);

  const overfillPulsing = holding && elapsed > FILL_SECONDS;

  const cachedUsdcBalance = useMemo(
    () => parseFloat(balances.USDC || "0") || 0,
    [balances.USDC]
  );

  useEffect(() => {
    if (!address) return;
    void fetchBalances();
  }, [address, fetchBalances]);

  const readUsdcBalance = useCallback(async (): Promise<number> => {
    if (!address) return 0;
    try {
      const raw = await getErc20Balance({
        token: USDC_TOKEN_ADDRESSES.base as Address,
        owner: address as Address,
      });
      return Number(formatUnits(raw, USDC_TOKEN_DECIMALS));
    } catch (err) {
      logger.debug("USDC balance read failed, using cache:", err);
      return cachedUsdcBalance;
    }
  }, [address, cachedUsdcBalance]);

  const loadInventory = useCallback(async () => {
    if (!address) {
      setStickers([]);
      return;
    }
    try {
      const res = await fetch("/api/stickers/list");
      if (!res.ok) {
        throw new Error(`Failed to load stickers (${res.status})`);
      }
      const json = await res.json();
      const rows = (json.stickers ?? []) as Array<{
        token_id: number;
        ipfs_hash: string;
        name: string | null;
        image_uri: string | null;
      }>;

      if (
        !rows.length ||
        !CAMPAIGN_STICKERS_ADDRESS ||
        CAMPAIGN_STICKERS_ADDRESS ===
          "0x0000000000000000000000000000000000000000"
      ) {
        setStickers([]);
        return;
      }

      const publicClient = createPublicClient({
        chain: base,
        transport: http(),
      });

      const accounts = rows.map(() => address as Address);
      const ids = rows.map((r) => BigInt(r.token_id));
      const balancesBatch = (await publicClient.readContract({
        address: CAMPAIGN_STICKERS_ADDRESS,
        abi: campaignStickersAbi,
        functionName: "balanceOfBatch",
        args: [accounts, ids],
      })) as bigint[];

      const owned: StickerOption[] = rows
        .map((r, i) => ({
          ...r,
          balance: balancesBatch[i] ?? 0n,
        }))
        .filter((r) => r.balance > 0n);

      setStickers(owned);
      setSelected((prev) => prev ?? owned[0] ?? null);
    } catch (err) {
      logger.debug("sticker inventory load failed:", err);
    }
  }, [address]);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  const loadTipHistory = useCallback(async () => {
    if (!address) return;
    setLoadingHistory(true);
    try {
      const apiRes = await fetch(
        `/api/stickers/tips?videoId=${encodeURIComponent(
          videoId
        )}&wallet=${encodeURIComponent(address)}`
      );

      if (apiRes.ok) {
        const json = await apiRes.json();
        const myTips = (json.tips ?? []) as StickerTipRow[];
        if (myTips.length > 0) {
          const total = myTips.reduce((sum, t) => sum + Number(t.usdc_amount), 0);
          // API returns newest first (created_at DESC).
          const latest = myTips[0];
          setMyTipTotal(total);
          setMyLastTipSeconds(latest?.seconds ?? null);
        } else {
          setMyTipTotal(null);
          setMyLastTipSeconds(null);
        }
      }
    } catch (err) {
      logger.debug("load tip history failed:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, [address, videoId]);

  useEffect(() => {
    void loadTipHistory();
  }, [loadTipHistory]);

  const stopTimer = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const resetHold = useCallback(() => {
    stopTimer();
    holdingRef.current = false;
    setHolding(false);
    startTimeRef.current = null;
    setElapsed(0);
  }, [stopTimer]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (!address || isTipping) return;

      // Fast path from cache; live check runs on release before sending.
      if (cachedUsdcBalance > 0 && cachedUsdcBalance < MIN_TIP_USDC) {
        toast.message("Add USDC to tip — need at least $0.01");
        return;
      }

      e.currentTarget.setPointerCapture(e.pointerId);
      const start = Math.floor(Date.now() / 1000);
      startTimeRef.current = start;
      holdingRef.current = true;
      setHolding(true);
      setElapsed(0);
      pulseHaptic();
      tickRef.current = setInterval(() => {
        const next = Math.min(
          MAX_HOLD_SECONDS,
          Math.floor(Date.now() / 1000) - start
        );
        setElapsed(next);
        pulseHaptic();
      }, 1000);
    },
    [address, isTipping, cachedUsdcBalance]
  );

  const onPointerUp = useCallback(
    async (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }

      if (!holdingRef.current) return;

      stopTimer();
      holdingRef.current = false;
      setHolding(false);
      const start = startTimeRef.current;
      startTimeRef.current = null;
      if (!start || !address) return;

      const endTime = Math.floor(Date.now() / 1000);
      const seconds = Math.min(
        MAX_HOLD_SECONDS,
        Math.max(1, endTime - start)
      );
      const usdcAmount = Number((seconds * USDC_TIP_RATE_PER_SECOND).toFixed(2));
      setElapsed(seconds);

      if (usdcAmount < MIN_TIP_USDC) {
        toast.message("Hold a bit longer to tip at least $0.01");
        setElapsed(0);
        return;
      }

      const liveUsdc = await readUsdcBalance();
      if (liveUsdc < usdcAmount) {
        toast.message(
          liveUsdc < MIN_TIP_USDC
            ? "Add USDC to tip — need at least $0.01"
            : `Not enough USDC for $${usdcAmount.toFixed(2)} tip`
        );
        setElapsed(0);
        return;
      }

      const compositeHash = buildCompositeHash(
        videoHash,
        selected?.ipfs_hash ?? null
      );

      try {
        const mintEnd = start + seconds;
        const [tipResult] = await Promise.all([
          sendTip(usdcAmount.toFixed(2), "USDC", creatorAddress),
          mintHeartBit({
            startTime: start,
            endTime: mintEnd,
            hash: compositeHash,
            account: address,
          }).catch((err) => {
            logger.warn("HeartBit mint failed (USDC tip may still succeed):", err);
            return null;
          }),
        ]);

        const authHeaders = await getAuthHeaders();
        const tipRecordRes = await fetch("/api/stickers/tips", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
          body: JSON.stringify({
            videoId,
            wallet: address,
            stickerTokenId: selected?.token_id ?? null,
            stickerIpfsHash: selected?.ipfs_hash ?? null,
            compositeHash,
            seconds,
            usdcAmount,
            txHash: tipResult?.txHash,
          }),
        });
        const tipRecordJson = await tipRecordRes.json().catch(() => ({}));
        if (!tipRecordRes.ok) {
          const recordError =
            typeof tipRecordJson.error === "string"
              ? tipRecordJson.error
              : "Failed to record tip in ledger";
          // USDC may already have left the wallet — surface that clearly.
          if (tipResult) {
            logger.error("tip ledger record failed after USDC tip:", tipRecordJson);
            toast.warning(
              `Sent $${usdcAmount.toFixed(2)} USDC, but tip ledger failed: ${recordError}`
            );
            setMyTipTotal((prev) => (prev ?? 0) + usdcAmount);
            setMyLastTipSeconds(seconds);
            if (tipResult.txHash) {
              onTipSuccess?.(tipResult.txHash, usdcAmount.toFixed(2), "USDC");
            }
          } else {
            throw new Error(recordError);
          }
        } else if (tipResult) {
          toast.success(
            selected
              ? `Tipped $${usdcAmount.toFixed(2)} USDC with sticker`
              : `Tipped $${usdcAmount.toFixed(2)} USDC`
          );
          setMyTipTotal((prev) => (prev ?? 0) + usdcAmount);
          setMyLastTipSeconds(seconds);
          if (tipResult.txHash) {
            onTipSuccess?.(tipResult.txHash, usdcAmount.toFixed(2), "USDC");
          }
        }
      } catch (err) {
        logger.error("hold-to-tip failed:", err);
        toast.error(err instanceof Error ? err.message : "Tip failed");
      } finally {
        setElapsed(0);
        void fetchBalances();
      }
    },
    [
      stopTimer,
      address,
      selected,
      videoHash,
      sendTip,
      creatorAddress,
      mintHeartBit,
      videoId,
      getAuthHeaders,
      readUsdcBalance,
      fetchBalances,
      onTipSuccess,
    ]
  );

  const onPointerCancel = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      resetHold();
    },
    [resetHold]
  );

  useEffect(() => () => stopTimer(), [stopTimer]);

  if (!address) {
    return null;
  }

  return (
    <div className={cn("relative flex items-center gap-2", className)}>
      {showStickerPicker && (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="gap-1">
            {selected ? (
              <span className="flex items-center gap-2">
                {selected.image_uri && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ipfsToHttp(selected.image_uri)}
                    alt=""
                    className="h-5 w-5 rounded object-cover"
                  />
                )}
                <span className="max-w-[100px] truncate text-xs">
                  {selected.name || `#${selected.token_id}`}
                </span>
              </span>
            ) : (
              <span className="text-xs">Optional sticker</span>
            )}
            <ChevronDown className="h-3 w-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64 max-h-56 overflow-y-auto">
          {stickers.length === 0 ? (
            <div className="px-2 py-3 text-xs text-muted-foreground space-y-1">
              <p>No campaign stickers in this wallet.</p>
              <p>Tip without a sticker, or claim one to attach.</p>
            </div>
          ) : (
            <>
              <DropdownMenuItem
                onClick={() => setSelected(null)}
                className="text-xs text-muted-foreground"
              >
                Tip without sticker
              </DropdownMenuItem>
              {stickers.map((s) => (
                <DropdownMenuItem
                  key={s.token_id}
                  onClick={() => setSelected(s)}
                  className="gap-2"
                >
                  {s.image_uri && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={ipfsToHttp(s.image_uri)}
                      alt=""
                      className="h-8 w-8 rounded object-cover"
                    />
                  )}
                  <span className="truncate">
                    {s.name || `Sticker #${s.token_id}`}
                  </span>
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      )}

      <div className="relative">
        {holding && (
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-pink-600 px-2 py-0.5 text-xs font-semibold text-white shadow">
            ${tipUsd.toFixed(2)} · {elapsed}s
          </div>
        )}
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className={cn(
            "h-10 w-10 rounded-full select-none touch-none",
            holding && "scale-110",
          )}
          disabled={isTipping || loadingHistory}
          onPointerDown={(e) => {
            e.preventDefault();
            onPointerDown(e);
          }}
          onPointerUp={(e) => {
            e.preventDefault();
            void onPointerUp(e);
          }}
          onPointerCancel={(e) => {
            e.preventDefault();
            onPointerCancel(e);
          }}
          onContextMenu={(e) => e.preventDefault()}
          aria-label="Hold to tip USDC — tip as much as you want"
        >
          <AnimatedHeart
            fillPct={myTipTotal != null && !holding ? 100 : fillPercentage}
            pulsing={overfillPulsing}
          />
        </Button>
        {myTipTotal != null && !holding && (
          <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold text-pink-600">
            ${myTipTotal.toFixed(2)}
            {myLastTipSeconds != null ? ` · last ${myLastTipSeconds}s` : ""}
          </div>
        )}
      </div>
    </div>
  );
}
