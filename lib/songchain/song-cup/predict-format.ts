import type { OrbFootballGame, OrbFootballTeam } from "./orb-event-types";

export function formatKickoffTime(kickoffTimestamp: number | undefined): string {
  if (!kickoffTimestamp) return "—";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(kickoffTimestamp));
}

export function formatDayGroupLabel(date: string, title: string): string {
  const parsed = parseIsoDate(date);
  if (!parsed) return title;

  const today = startOfDay(new Date());
  const target = startOfDay(parsed);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000);

  const datePart = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "long",
  }).format(parsed);

  if (diffDays === 0) return `Today, ${datePart}`;
  if (diffDays === 1) return `Tomorrow, ${datePart}`;
  return title || datePart;
}

export type GameStatusVariant = "live" | "halftime" | "scheduled" | "finished";

export function getGameStatusVariant(game: OrbFootballGame): GameStatusVariant {
  const label = game.clock.label?.toUpperCase() ?? "";
  if (label === "HT" || game.period === "ht") return "halftime";
  if (game.period === "live" || game.status === "live") return "live";
  if (game.status === "finished" || game.period === "ft") return "finished";
  return "scheduled";
}

export function getGameStatusLabel(game: OrbFootballGame): string {
  const variant = getGameStatusVariant(game);
  if (variant === "halftime") return "HT";
  if (variant === "live") {
    const minute = game.clock.minute;
    if (minute != null) {
      const added = game.clock.addedMinutes;
      return added ? `${minute}+${added}'` : `${minute}'`;
    }
    return game.clock.label ?? "LIVE";
  }
  if (variant === "finished") return game.clock.label ?? "FT";
  return formatKickoffTime(game.kickoffTimestamp);
}

export function getTeamProbability(team: OrbFootballTeam): number {
  const option = team.options[0];
  return option?.probability ?? 0;
}

export function formatVolumeLabel(volumeLabel: string | undefined, volumeUsd?: number): string | null {
  if (volumeLabel?.trim()) return volumeLabel.trim();
  if (volumeUsd != null && volumeUsd > 0) {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      notation: volumeUsd >= 1000 ? "compact" : "standard",
      maximumFractionDigits: 2,
    }).format(volumeUsd);
  }
  return null;
}

export function isTbdTeam(team: OrbFootballTeam): boolean {
  return team.code === "TBD" || team.id === "tbd";
}

export function gameHasLivePeriod(games: OrbFootballGame[]): boolean {
  return games.some((g) => g.period !== "pre" && g.status !== "finished");
}

function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  const parsed = new Date(Number(y), Number(m) - 1, Number(d));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
