"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  useStreamTipEvents,
  type StreamTipEvent,
} from "@/lib/hooks/live/useStreamTipEvents";
import { shortenAddress } from "@/lib/utils/utils";
import { cn } from "@/lib/utils";

type FloatingHeart = {
  key: string;
  amount: number;
  wallet: string;
  /** Horizontal offset in px from the bottom-left origin */
  driftX: number;
  durationMs: number;
};

type FloatingTipHeartsProps = {
  /** Playback / chat stream id (same as LiveTokenPanel `streamId`). */
  streamId: string | null | undefined;
  className?: string;
};

const HEART_PATH =
  "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z";

function formatTipAmount(amount: number): string {
  if (amount >= 100) return `$${amount.toFixed(0)}`;
  if (amount >= 10) return `$${amount.toFixed(1)}`;
  return `$${amount.toFixed(2)}`;
}

function TipHeartBubble({
  amount,
  wallet,
  driftX,
  durationMs,
}: Omit<FloatingHeart, "key">) {
  return (
    <div
      className="absolute bottom-3 left-3 flex flex-col items-center pointer-events-none"
      style={
        {
          "--tip-drift-x": `${driftX}px`,
          "--tip-duration": `${durationMs}ms`,
          animation: `tip-heart-float var(--tip-duration) ease-out forwards`,
        } as React.CSSProperties
      }
    >
      <div className="relative h-16 w-16 drop-shadow-lg">
        <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden>
          <path d={HEART_PATH} fill="#ec4899" stroke="#9d174d" strokeWidth="0.6" />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center px-1 text-[11px] font-bold leading-none text-white drop-shadow-sm">
          {formatTipAmount(amount)}
        </span>
      </div>
      <span className="mt-0.5 rounded bg-black/55 px-1.5 py-0.5 font-mono text-[9px] text-white/90">
        {shortenAddress(wallet)}
      </span>
    </div>
  );
}

/**
 * Overlay hearts that spawn bottom-left and float to the top when viewers tip.
 * Mount inside a `relative` video frame; does not intercept pointer events.
 */
export function FloatingTipHearts({ streamId, className }: FloatingTipHeartsProps) {
  const [hearts, setHearts] = useState<FloatingHeart[]>([]);
  const timeoutIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const timeoutIds = timeoutIdsRef.current;
    return () => {
      for (const id of timeoutIds) {
        window.clearTimeout(id);
      }
      timeoutIds.clear();
    };
  }, []);

  const onTip = useCallback((tip: StreamTipEvent) => {
    const key = tip.id || `${tip.wallet}-${tip.created_at}-${Math.random()}`;
    const driftX = Math.round(Math.random() * 72); // 0–72px
    const durationMs = 2500 + Math.round(Math.random() * 1000); // 2.5–3.5s

    setHearts((prev) => [
      ...prev.slice(-11),
      {
        key,
        amount: tip.usdc_amount,
        wallet: tip.wallet,
        driftX,
        durationMs,
      },
    ]);

    const timeoutId = window.setTimeout(() => {
      timeoutIdsRef.current.delete(timeoutId);
      setHearts((prev) => prev.filter((h) => h.key !== key));
    }, durationMs + 50);
    timeoutIdsRef.current.add(timeoutId);
  }, []);

  useStreamTipEvents(streamId, onTip, !!streamId);

  // Inject keyframes once (scoped via unique animation name).
  useEffect(() => {
    const styleId = "floating-tip-hearts-keyframes";
    if (document.getElementById(styleId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
@keyframes tip-heart-float {
  0% {
    transform: translate(0, 0) scale(0.85);
    opacity: 0;
  }
  8% {
    opacity: 1;
    transform: translate(calc(var(--tip-drift-x) * 0.15), -8%) scale(1);
  }
  70% {
    opacity: 1;
  }
  100% {
    transform: translate(var(--tip-drift-x), -88vh) scale(1.05);
    opacity: 0;
  }
}
`;
    document.head.appendChild(style);
  }, []);

  if (!streamId || hearts.length === 0) {
    return (
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-[15] overflow-hidden",
          className
        )}
        aria-hidden
      />
    );
  }

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-[15] overflow-hidden",
        className
      )}
      aria-live="polite"
      aria-atomic="false"
    >
      {hearts.map((h) => (
        <TipHeartBubble
          key={h.key}
          amount={h.amount}
          wallet={h.wallet}
          driftX={h.driftX}
          durationMs={h.durationMs}
        />
      ))}
    </div>
  );
}
