import {
  SONG_CUP_VOTE_ASSETS,
  SONG_CUP_VOTE_GRADIENT,
} from "@/lib/songchain/song-cup/vote-design";

/** Figma predict panel design tokens (worldcup-games node 1:743). */
export const SONG_CUP_PREDICT_ASSETS = {
  cornerOrnament: "/songchain/song-cup/predict/predict-corner-ornament.png",
  progressLine: SONG_CUP_VOTE_ASSETS.progressLine,
  predictIcon: "/songchain/button-icons/predict-icon.svg",
} as const;

/** Panel glow + progress bar fill — Song Cup pink→yellow brand gradient. */
export const SONG_CUP_PREDICT_ODDS_GRADIENT = SONG_CUP_VOTE_GRADIENT;

/** HT status text gradient (Song Cup yellow). */
export const SONG_CUP_PREDICT_HALFTIME_GRADIENT =
  "linear-gradient(180deg, rgb(254, 237, 1) 0%, rgb(253, 190, 1) 100%)";

export const SONG_CUP_PREDICT_COLORS = {
  live: "#22c55e",
  halftimeFrom: "#feed01",
  halftimeTo: "#FDBE01",
  finished: "rgba(255,255,255,0.6)",
  scheduled: "rgba(255,255,255,0.6)",
  muted: "rgba(255,255,255,0.4)",
} as const;
