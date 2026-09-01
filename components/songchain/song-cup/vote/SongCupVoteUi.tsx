"use client";

import type { ReactNode } from "react";
import { QRCodeSVG } from "qrcode.react";
import { bigShoulders } from "@/lib/fonts/big-shoulders";
import { cn } from "@/lib/utils/utils";
import type { MatchupLifecyclePhase } from "@/lib/songchain/song-cup/matchup-lifecycle";
import {
  SONG_CUP_VOTE_ASSETS,
  SONG_CUP_VOTE_COLORS,
  SONG_CUP_VOTE_GRADIENT,
  SONG_CUP_VOTE_GRADIENT_CTA,
  SONG_CUP_VOTE_MATCHUP_GRADIENT,
} from "@/lib/songchain/song-cup/vote-design";
import { songCupPanel } from "@/lib/songchain/song-cup/panel-styles";
import { SONG_CUP_PLAY_LINKS } from "@/lib/songchain/events";

/** 161:781 — blurred gradient glow */
export function SongCupVoteGradientGlow({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute blur-[75px]",
        className,
      )}
      style={{ backgroundImage: SONG_CUP_VOTE_GRADIENT }}
      aria-hidden
    />
  );
}

/** 163:962 — VOTE NOW title */
export function SongCupVoteTitle({ className, title = "VOTE NOW" }: { className?: string; title?: string }) {
  return (
    <h2
      className={cn(
        "text-[40px] font-bold leading-[20px] tracking-[-0.2px] text-foreground dark:text-white sm:text-[50px] sm:leading-none",
        className,
      )}
    >
      {title}
    </h2>
  );
}

/** 161:803 / 161:809 / 161:810 — filter pills */
export function SongCupVoteFilterPill({
  label,
  active,
  onClick,
  className,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-[44px] min-w-[120px] flex-1 items-center justify-center rounded-full px-6 py-2 text-base font-medium leading-none tracking-[0.2px] transition sm:h-[47px] sm:min-w-[140px] sm:px-8 sm:text-[17px]",
        active
          ? "text-black"
          : "bg-muted/60 text-foreground hover:bg-muted dark:bg-white/[0.08] dark:text-white dark:hover:bg-white/15",
        className,
      )}
      style={active ? { backgroundImage: SONG_CUP_VOTE_GRADIENT_CTA } : undefined}
    >
      {label}
    </button>
  );
}

/** 163:964 — date line */
export function SongCupVoteRoundDate({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-center text-[15px] font-bold leading-normal tracking-[-0.1px] text-foreground dark:text-white",
        className,
      )}
    >
      {children}
    </p>
  );
}

/** 163:966 — round title */
export function SongCupVoteRoundTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h3
      className={cn(
        "text-center text-[25px] font-bold leading-normal tracking-[-0.1px] text-foreground dark:text-white",
        className,
      )}
    >
      {children}
    </h3>
  );
}

/** 163:974 / 164:1000 — entry name (SILVER RAIDS) */
export function SongCupVoteEntryName({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        bigShoulders.className,
        "text-right text-[18px] font-bold uppercase leading-normal tracking-[-0.3px] sm:text-[25px]",
        className,
      )}
      style={{ color: SONG_CUP_VOTE_COLORS.yellow }}
    >
      {children}
    </p>
  );
}

/** 163:996 / 164:1001 — entry sublabel (RIA) */
export function SongCupVoteEntryTag({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-right text-xs font-bold uppercase leading-normal tracking-[-0.3px] sm:text-base",
        className,
      )}
      style={{ color: SONG_CUP_VOTE_COLORS.magenta }}
    >
      {children}
    </p>
  );
}

/** 164:1004 / 164:1019 — VS */
export function SongCupVoteVs({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        bigShoulders.className,
        "text-[30px] font-bold uppercase leading-normal tracking-[-0.3px] text-foreground dark:text-white",
        className,
      )}
    >
      VS
    </span>
  );
}

/** 163:981 / 164:1009 — gradient progress line */
export function SongCupVoteProgressLine({
  pct,
  className,
}: {
  pct: number;
  className?: string;
}) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div className={cn("relative h-[3px] w-[104px] max-w-full", className)}>
      <img
        src={SONG_CUP_VOTE_ASSETS.progressLine}
        alt=""
        aria-hidden
        className="h-full w-full rotate-180 object-cover opacity-40"
      />
      <div
        className="absolute inset-y-0 left-0 overflow-hidden"
        style={{ width: `${clamped}%` }}
      >
        <img
          src={SONG_CUP_VOTE_ASSETS.progressLine}
          alt=""
          aria-hidden
          className="h-full w-[104px] rotate-180 object-cover"
        />
      </div>
    </div>
  );
}

/** 164:1006 / 164:1013 — vote percentage */
export function SongCupVotePercent({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-right text-xs font-bold leading-normal tracking-[0.2px] text-foreground dark:text-white",
        className,
      )}
    >
      {value}%
    </p>
  );
}

/** 164:1088 — VOTE NOW CTA pill */
export function SongCupVoteCtaButton({
  children,
  onClick,
  disabled,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-[47px] min-w-[132px] items-center justify-center rounded-[46px] px-[10px] py-[2px] text-[17px] font-medium leading-[22px] tracking-[0.2px] text-black transition disabled:opacity-70",
        className,
      )}
      style={{ backgroundImage: SONG_CUP_VOTE_GRADIENT_CTA }}
    >
      {children}
    </button>
  );
}

/** 163:969 — matchup inner panel */
export function SongCupVoteMatchupSurface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[20px] bg-white/[0.12] px-4 py-5 sm:px-8 sm:py-6",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{ backgroundImage: SONG_CUP_VOTE_MATCHUP_GRADIENT }}
        aria-hidden
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/** 137:787 — club QR card (inside Vote panel only) */
export function SongCupClubQrCard({
  url = SONG_CUP_PLAY_LINKS.club,
  className,
}: {
  url?: string;
  className?: string;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Open Song Cup club on Orb"
      className={cn(
        "flex aspect-square w-full max-w-[92px] items-center justify-center overflow-hidden rounded-[20px] border border-[#dc2bb3] bg-white transition-opacity hover:opacity-90",
        className,
      )}
    >
      <QRCodeSVG value={url} size={64} bgColor="#ffffff" fgColor="#000000" level="M" className="h-full w-full" />
    </a>
  );
}

/** 163:959 — Song Cup logo strip above matchups */
export function SongCupVoteLogoBanner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative mx-auto flex h-[72px] w-[153px] items-center justify-center overflow-hidden rounded-[20px] border border-[#dc2bb3] bg-black",
        className,
      )}
    >
      <img
        src="/songchain/button-icons/songcup-icon.svg"
        alt="Song Cup"
        className="h-full w-full object-cover"
      />
    </div>
  );
}

/** 158:39 — post thumbnail frame */
export function SongCupVotePostFrame({
  src,
  alt = "",
  className,
  children,
}: {
  src?: string | null;
  alt?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative size-[107px] shrink-0 overflow-hidden rounded-[15px] border border-[#dc2bb3] bg-black",
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="size-full object-cover" />
      ) : !children ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={SONG_CUP_VOTE_ASSETS.postPlaceholder}
          alt=""
          className="size-full object-cover"
        />
      ) : null}
      {children}
    </div>
  );
}

/** 163:958 — black content well */
export function SongCupVoteContentWell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative min-h-[480px] overflow-visible p-4 sm:p-6",
        songCupPanel,
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Countdown / LIVE / Ended badge for schedule matchups */
export function SongCupMatchupStatusBadge({
  phase,
  label,
  className,
}: {
  phase: MatchupLifecyclePhase;
  label: string;
  className?: string;
}) {
  if (!label || phase === "unknown") return null;

  if (phase === "live") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-2 text-[18px] font-bold uppercase tracking-wide sm:text-[22px]",
          className,
        )}
        style={{ color: SONG_CUP_VOTE_COLORS.magenta }}
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
        </span>
        {label}
      </span>
    );
  }

  if (phase === "ended") {
    return (
      <span
        className={cn(
          "text-[16px] font-bold uppercase tracking-wide text-muted-foreground dark:text-white/50 sm:text-[20px]",
          className,
        )}
      >
        {label}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "text-[14px] font-semibold tabular-nums tracking-wide text-[#feed01] sm:text-[18px]",
        className,
      )}
    >
      {label}
    </span>
  );
}
