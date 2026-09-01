export type SongchainEventStatus = "active" | "upcoming";

type SongchainEventBase = {
  slug: string;
  title: string;
  description?: string;
};

export type SongchainEvent =
  | (SongchainEventBase & { status: "active"; href: string })
  | (SongchainEventBase & { status: "upcoming" });

export const SONGCHAIN_EVENTS: SongchainEvent[] = [
  {
    slug: "song-cup",
    title: "Song Cup",
    description: "Predict your winner. Guess your song. Runs through the World Cup.",
    status: "active",
    href: "/songchain/song-cup",
  },
  {
    slug: "season-2",
    title: "Songchain Season 2",
    description: "Begins when Song Cup ends.",
    status: "upcoming",
  },
];

export const SONG_CUP_PLAY_LINKS = {
  goal: "https://orb.club/c/worldcup",
  club: "https://orb.club/c/0x0ea378e56930d4602e7b29cabfdbd84c5fd1959b",
  beat: "https://beatme.creativeplatform.xyz",
} as const;

/** Lens group contract — join here to access the member feed on Orb. */
export const SONG_CUP_CLUB_GROUP_ID =
  "0x0EA378E56930d4602E7b29CAbFdbD84C5Fd1959B" as const;

/** Group-gated feed contract for Song Cup club posts. */
export const SONG_CUP_CLUB_FEED_ID =
  "0x5D15E5b8848A2BaFB0B968dC4CB6725551F1addb" as const;
