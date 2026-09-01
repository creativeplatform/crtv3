/** Orb football event API types (games category). */

export type OrbEventProvider = {
  id: string;
  label: string;
};

export type OrbFootballEvent = {
  type: "FOOTBALL_EVENT";
  id: string;
  title: string;
  description?: string;
  icon?: string;
  background?: string;
  startDate?: string;
  endDate?: string;
  dateLabel?: string;
  location?: string;
  provider?: OrbEventProvider;
};

export type OrbMarketOption = {
  id: string;
  kind: "HOME" | "AWAY" | "DRAW" | string;
  label: string;
  longLabel?: string;
  marketId?: string | null;
  clobTokenId?: string | null;
  conditionId?: string | null;
  price?: number;
  probability?: number;
  tickSize?: string;
  negativeRisk?: boolean;
};

export type OrbFootballTeam = {
  type: "FOOTBALL_TEAM";
  id: string;
  code: string;
  name: string;
  country?: string;
  tag?: string;
  flag?: string;
  icon?: string;
  supportersCount?: number;
  friendsCount?: number;
  isMyTeam?: boolean;
  options: OrbMarketOption[];
};

export type OrbGameClock = {
  label?: string | null;
  minute?: number | null;
  addedMinutes?: number | null;
  periodStartedAt?: number | null;
};

export type OrbGameScore = {
  home: number;
  away: number;
  penalties?: { home: number; away: number } | null;
};

export type OrbFootballGame = {
  type: "FOOTBALL_GAME";
  id: string;
  title: string;
  stage?: string;
  status: string;
  period: string;
  clock: OrbGameClock;
  finishType?: string | null;
  kickoffTimestamp?: number;
  image?: string;
  homeTeam: OrbFootballTeam;
  awayTeam: OrbFootballTeam;
  score: OrbGameScore;
  shootout?: unknown;
  volumeUsd?: number;
  volumeLabel?: string;
};

export type OrbEventDayGroup = {
  id: string;
  title: string;
  date: string;
  games: OrbFootballGame[];
};

export type OrbEventGamesData = {
  event: OrbFootballEvent;
  categories?: string[];
  category: string;
  items: OrbEventDayGroup[];
  tables?: unknown[];
};

export type OrbEventGamesResponse = {
  status: string;
  data: OrbEventGamesData;
};
