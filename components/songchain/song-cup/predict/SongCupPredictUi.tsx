"use client";

import type { ReactNode } from "react";
import { MapPin } from "lucide-react";
import { bigShoulders } from "@/lib/fonts/big-shoulders";
import { cn } from "@/lib/utils/utils";
import { songCupPanel } from "@/lib/songchain/song-cup/panel-styles";
import {
  SONG_CUP_PREDICT_ASSETS,
  SONG_CUP_PREDICT_COLORS,
  SONG_CUP_PREDICT_HALFTIME_GRADIENT,
  SONG_CUP_PREDICT_ODDS_GRADIENT,
} from "@/lib/songchain/song-cup/predict-design";
import type { GameStatusVariant } from "@/lib/songchain/song-cup/predict-format";
import type { OrbFootballEvent } from "@/lib/songchain/song-cup/orb-event-types";
import { resolveOrbMediaUrl } from "@/lib/sdk/orb/media";

export function SongCupPredictContentWell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative min-h-[480px] overflow-hidden p-4 sm:p-6",
        songCupPanel,
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SongCupPredictCornerOrnament({
  className,
  position = "top-left",
}: {
  className?: string;
  position?: "top-left" | "bottom-right";
}) {
  const positionClass =
    position === "top-left" ? "-left-2 -top-2" : "-bottom-2 -right-2 rotate-180";

  return (
    <img
      src={SONG_CUP_PREDICT_ASSETS.cornerOrnament}
      alt=""
      aria-hidden
      className={cn(
        "pointer-events-none absolute h-[60px] w-[60px] object-contain sm:h-[108px] sm:w-[108px]",
        positionClass,
        className,
      )}
    />
  );
}

export function SongCupPredictGradientGlow({ className }: { className?: string }) {
  return (
    <div
      className={cn("pointer-events-none absolute blur-[75px]", className)}
      style={{ backgroundImage: SONG_CUP_PREDICT_ODDS_GRADIENT }}
      aria-hidden
    />
  );
}

export function SongCupPredictTitle({ className }: { className?: string }) {
  return (
    <h2
      className={cn(
        "text-[40px] font-bold leading-[20px] tracking-[-0.2px] text-foreground dark:text-white sm:text-[50px] sm:leading-none",
        className,
      )}
    >
      PREDICT
    </h2>
  );
}

export function SongCupPredictEventHeader({
  event,
  className,
}: {
  event: OrbFootballEvent;
  className?: string;
}) {
  const iconUrl = resolveOrbMediaUrl(event.icon, { type: "image", dimension: 128 });

  return (
    <div className={cn("flex flex-col items-center text-center", className)}>
      {iconUrl ? (
        <img
          src={iconUrl}
          alt=""
          className="h-20 w-20 shrink-0 rounded-[20px] object-cover"
        />
      ) : null}
      <h3
        className={cn(
          bigShoulders.className,
          "mt-4 text-[30px] font-bold leading-normal tracking-[-0.3px] text-foreground dark:text-white",
        )}
      >
        {event.title}
      </h3>
      {event.dateLabel ? (
        <p className="mt-1 text-[17px] leading-[22px] tracking-[0.2px] text-muted-foreground dark:text-white/60">
          {event.dateLabel}
        </p>
      ) : null}
      {event.location ? (
        <p className="mt-1 flex items-center justify-center gap-1 text-[17px] leading-[22px] tracking-[0.2px] text-muted-foreground dark:text-white/60">
          <MapPin className="h-4 w-4 shrink-0" aria-hidden />
          {event.location}
        </p>
      ) : null}
    </div>
  );
}

export function SongCupPredictDateHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-center text-[20px] font-bold leading-normal tracking-[-0.1px] text-foreground dark:text-white",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function SongCupPredictGameSurface({
  children,
  variant = "default",
  className,
}: {
  children: ReactNode;
  variant?: "default" | "live" | "halftime";
  className?: string;
}) {
  return (
    <article
      className={cn(
        "relative h-20 overflow-hidden rounded-[20px]",
        variant === "live" || variant === "halftime"
          ? "bg-black/[0.08] dark:bg-white/[0.12]"
          : "bg-black/[0.05] dark:bg-white/[0.08]",
        className,
      )}
    >
      {children}
    </article>
  );
}

export function SongCupPredictStageLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "absolute left-1/2 top-[6px] -translate-x-1/2 whitespace-nowrap text-[10px] font-medium tracking-[0.4px] text-muted-foreground dark:text-white/40",
        className,
      )}
    >
      {children}
    </p>
  );
}

function SongCupPredictTeamFlag({
  flagUrl,
  className,
}: {
  flagUrl?: string | null;
  className?: string;
}) {
  const resolvedFlag = resolveOrbMediaUrl(flagUrl, { type: "image", dimension: 64 });

  return (
    <div
      className={cn(
        "flex h-6 w-[41px] shrink-0 items-center justify-center overflow-hidden rounded-sm",
        className,
      )}
    >
      {resolvedFlag ? (
        <img src={resolvedFlag} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="text-[10px] text-muted-foreground dark:text-white/40">—</span>
      )}
    </div>
  );
}

export function SongCupPredictMatchRow({
  homeCode,
  homeFlagUrl,
  homeScore,
  awayCode,
  awayFlagUrl,
  awayScore,
  statusLabel,
  statusVariant,
  dimScores = false,
  className,
}: {
  homeCode: string;
  homeFlagUrl?: string | null;
  homeScore: number;
  awayCode: string;
  awayFlagUrl?: string | null;
  awayScore: number;
  statusLabel: string;
  statusVariant: GameStatusVariant;
  dimScores?: boolean;
  className?: string;
}) {
  const scoreClass = dimScores
    ? "text-foreground/15 dark:text-white/[0.08]"
    : "text-foreground dark:text-white";

  return (
    <div
      className={cn(
        "absolute inset-x-0 top-[28px] flex items-center justify-center gap-0 px-2",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center justify-end gap-1 pr-1">
        <span
          className={cn(
            bigShoulders.className,
            "shrink-0 text-[30px] font-bold leading-none tracking-[-0.3px] text-foreground dark:text-white",
          )}
        >
          {homeCode}
        </span>
        <SongCupPredictTeamFlag flagUrl={homeFlagUrl} />
        <span
          className={cn(
            bigShoulders.className,
            "w-6 shrink-0 text-center text-[30px] font-bold leading-none tracking-[-0.3px]",
            scoreClass,
          )}
        >
          {homeScore}
        </span>
      </div>

      <SongCupPredictStatusBadge
        label={statusLabel}
        variant={statusVariant}
        className="mx-1 shrink-0"
      />

      <div className="flex min-w-0 flex-1 items-center justify-start gap-1 pl-1">
        <span
          className={cn(
            bigShoulders.className,
            "w-6 shrink-0 text-center text-[30px] font-bold leading-none tracking-[-0.3px]",
            scoreClass,
          )}
        >
          {awayScore}
        </span>
        <SongCupPredictTeamFlag flagUrl={awayFlagUrl} />
        <span
          className={cn(
            bigShoulders.className,
            "shrink-0 text-[30px] font-bold leading-none tracking-[-0.3px] text-foreground dark:text-white",
          )}
        >
          {awayCode}
        </span>
      </div>
    </div>
  );
}

export function SongCupPredictStatusBadge({
  label,
  variant,
  className,
}: {
  label: string;
  variant: GameStatusVariant;
  className?: string;
}) {
  if (variant === "halftime") {
    return (
      <span
        className={cn(
          "bg-clip-text text-[22px] font-bold leading-[20px] tracking-[-0.2px] text-transparent",
          className,
        )}
        style={{ backgroundImage: SONG_CUP_PREDICT_HALFTIME_GRADIENT }}
      >
        {label}
      </span>
    );
  }

  if (variant === "scheduled") {
    return (
      <span
        className={cn(
          "text-[14px] font-medium leading-none tracking-[0.2px] text-muted-foreground dark:text-white/60",
          className,
        )}
      >
        {label}
      </span>
    );
  }

  if (variant === "finished") {
    return (
      <span
        className={cn(
          "text-[22px] font-bold leading-[20px] tracking-[-0.2px] tabular-nums text-muted-foreground dark:text-white/60",
          className,
        )}
      >
        {label}
      </span>
    );
  }

  const color = SONG_CUP_PREDICT_COLORS.live;

  return (
    <span
      className={cn(
        "text-[22px] font-bold leading-[20px] tracking-[-0.2px] tabular-nums",
        className,
      )}
      style={{ color }}
    >
      {label}
    </span>
  );
}

export function SongCupPredictProgressLine({
  pct,
  align = "left",
  className,
}: {
  pct: number;
  align?: "left" | "right";
  className?: string;
}) {
  const clamped = Math.min(100, Math.max(0, pct));

  return (
    <div
      className={cn(
        "relative h-[3px] w-full min-w-[42px] max-w-[58px] flex-1",
        align === "right" && "scale-x-[-1]",
        className,
      )}
    >
      <img
        src={SONG_CUP_PREDICT_ASSETS.progressLine}
        alt=""
        aria-hidden
        className="h-full w-full rotate-180 object-cover opacity-40"
      />
      <div
        className="absolute inset-y-0 left-0 overflow-hidden"
        style={{ width: `${clamped}%` }}
      >
        <img
          src={SONG_CUP_PREDICT_ASSETS.progressLine}
          alt=""
          aria-hidden
          className="h-full w-[58px] max-w-none rotate-180 object-cover"
        />
      </div>
    </div>
  );
}

export function SongCupPredictOddsFooter({
  homePct,
  awayPct,
  volumeLabel,
  className,
}: {
  homePct: number;
  awayPct: number;
  volumeLabel?: string | null;
  className?: string;
}) {
  const home = Math.min(100, Math.max(0, homePct));
  const away = Math.min(100, Math.max(0, awayPct));

  if (home === 0 && away === 0 && !volumeLabel) {
    return null;
  }

  return (
    <div
      className={cn(
        "absolute inset-x-0 bottom-[6px] flex items-center justify-center gap-1 px-3",
        className,
      )}
    >
      <span className="w-8 shrink-0 text-right text-[12px] font-bold leading-none tracking-[0.2px] text-foreground dark:text-white">
        {home > 0 ? `${home}%` : ""}
      </span>
      <SongCupPredictProgressLine pct={home} align="left" />
      {volumeLabel ? (
        <span className="shrink-0 px-1 text-[12px] leading-none tracking-[0.2px] text-muted-foreground dark:text-white/40">
          {volumeLabel}
        </span>
      ) : (
        <span className="w-16 shrink-0" />
      )}
      <SongCupPredictProgressLine pct={away} align="right" />
      <span className="w-8 shrink-0 text-left text-[12px] font-bold leading-none tracking-[0.2px] text-foreground dark:text-white">
        {away > 0 ? `${away}%` : ""}
      </span>
    </div>
  );
}

