import { SongchainSeason2PageClient } from "@/components/songchain/season-2/SongchainSeason2PageClient";
import { getSongchainConfig } from "@/lib/songchain/config";
import { resolveSongchainConfig } from "@/lib/songchain/resolve-lens-app";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Songchain Season 2 | Creative TV",
  description:
    "Songchain Season 2 — music on Lens Chain. Predict, create, and compete.",
};

export default async function SongchainSeason2Page() {
  const config = await resolveSongchainConfig(getSongchainConfig());

  if (!config.season2Enabled) {
    notFound();
  }

  return <SongchainSeason2PageClient config={config} />;
}
