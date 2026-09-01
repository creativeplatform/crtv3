"use client";

import type { OrbFootballGame } from "@/lib/songchain/song-cup/orb-event-types";
import {
  formatVolumeLabel,
  getGameStatusLabel,
  getGameStatusVariant,
  getTeamProbability,
  isTbdTeam,
} from "@/lib/songchain/song-cup/predict-format";
import {
  SongCupPredictGameSurface,
  SongCupPredictMatchRow,
  SongCupPredictOddsFooter,
  SongCupPredictStageLabel,
} from "./predict/SongCupPredictUi";

type SongCupPredictGameCardProps = {
  game: OrbFootballGame;
  className?: string;
};

export function SongCupPredictGameCard({ game, className }: SongCupPredictGameCardProps) {
  const statusVariant = getGameStatusVariant(game);
  const statusLabel = getGameStatusLabel(game);
  const homeProb = getTeamProbability(game.homeTeam);
  const awayProb = getTeamProbability(game.awayTeam);
  const volume = formatVolumeLabel(game.volumeLabel, game.volumeUsd);
  const showOdds = !isTbdTeam(game.homeTeam) && !isTbdTeam(game.awayTeam);
  const dimScores =
    statusVariant === "scheduled" && game.score.home === 0 && game.score.away === 0;

  const surfaceVariant =
    statusVariant === "live"
      ? "live"
      : statusVariant === "halftime"
        ? "halftime"
        : "default";

  return (
    <SongCupPredictGameSurface variant={surfaceVariant} className={className}>
      {game.stage ? <SongCupPredictStageLabel>{game.stage}</SongCupPredictStageLabel> : null}

      <SongCupPredictMatchRow
        homeCode={game.homeTeam.code}
        homeFlagUrl={game.homeTeam.flag || game.homeTeam.icon}
        homeScore={game.score.home}
        awayCode={game.awayTeam.code}
        awayFlagUrl={game.awayTeam.flag || game.awayTeam.icon}
        awayScore={game.score.away}
        statusLabel={statusLabel}
        statusVariant={statusVariant}
        dimScores={dimScores}
      />

      {showOdds ? (
        <SongCupPredictOddsFooter
          homePct={homeProb}
          awayPct={awayProb}
          volumeLabel={volume ? `${volume} Vol.` : null}
        />
      ) : null}
    </SongCupPredictGameSurface>
  );
}
