import { SongCupPageClient } from "@/components/songchain/song-cup/SongCupPageClient";
import { getSongCupConfig } from "@/lib/songchain/config";
import { resolveSongchainConfig } from "@/lib/songchain/resolve-lens-app";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const SONG_CUP_OG_IMAGE = {
  url: "/songchain/song-cup/song-cup-og.png",
  width: 1220,
  height: 321,
  alt: "Song Cup — Where Music Meets the World's Game.",
  type: "image/png",
} as const;

export const metadata: Metadata = {
  title: "Song Cup | Songchain | Creative TV",
  description:
    "Song Cup is an audio-visual competition celebrating the passion, unity, and energy of the World Cup. Create original music and Pixel AI visuals, then submit your 30–60 second entry.",
  openGraph: {
    title: "Song Cup | Songchain | Creative TV",
    description:
      "Song Cup is an audio-visual competition celebrating the passion, unity, and energy of the World Cup. Create original music and Pixel AI visuals, then submit your 30–60 second entry.",
    type: "website",
    url: "/songchain/song-cup",
    images: [SONG_CUP_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Song Cup | Songchain | Creative TV",
    description:
      "Song Cup is an audio-visual competition celebrating the passion, unity, and energy of the World Cup. Create original music and Pixel AI visuals, then submit your 30–60 second entry.",
    images: [SONG_CUP_OG_IMAGE.url],
  },
};

export default async function SongCupPage() {
  const config = await resolveSongchainConfig(getSongCupConfig());
  return <SongCupPageClient config={config} />;
}
