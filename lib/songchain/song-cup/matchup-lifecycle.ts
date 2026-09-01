export type MatchupLifecyclePhase = "countdown" | "live" | "ended" | "unknown";

export type MatchupLifecycle = {
  phase: MatchupLifecyclePhase;
  label: string;
  msRemaining: number | null;
};

function parseTime(value: string | null | undefined): number | null {
  if (!value?.trim()) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/** Derive display phase from start/end timestamps (preferred) with status fallback. */
export function getMatchupLifecycle(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
  status?: string | null,
  nowMs: number = Date.now(),
): MatchupLifecycle {
  const start = parseTime(startsAt);
  const end = parseTime(endsAt);

  if (start != null && nowMs < start) {
    const msRemaining = start - nowMs;
    return {
      phase: "countdown",
      label: formatCountdown(msRemaining),
      msRemaining,
    };
  }

  if (end != null && nowMs >= end) {
    return { phase: "ended", label: "Ended", msRemaining: null };
  }

  if (start != null && (end == null || nowMs < end) && nowMs >= start) {
    return { phase: "live", label: "LIVE", msRemaining: end != null ? end - nowMs : null };
  }

  if (status === "past") {
    return { phase: "ended", label: "Ended", msRemaining: null };
  }
  if (status === "active") {
    return { phase: "live", label: "LIVE", msRemaining: end != null ? end - nowMs : null };
  }
  if (status === "upcoming") {
    if (start != null && nowMs < start) {
      const msRemaining = start - nowMs;
      return { phase: "countdown", label: formatCountdown(msRemaining), msRemaining };
    }
    return { phase: "countdown", label: "Starting soon", msRemaining: null };
  }

  return { phase: "unknown", label: "", msRemaining: null };
}

export function deriveMatchupStatusFromTimes(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
  nowMs: number = Date.now(),
): "upcoming" | "active" | "past" {
  const lifecycle = getMatchupLifecycle(startsAt, endsAt, null, nowMs);
  if (lifecycle.phase === "ended") return "past";
  if (lifecycle.phase === "live") return "active";
  if (lifecycle.phase === "countdown") return "upcoming";
  return "upcoming";
}

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}
