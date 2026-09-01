import { HackBetaPageClient } from "@/components/chones/hack-beta/HackBetaPageClient";
import { getHackBetaConfig } from "@/lib/chones/config";
import { resolveSongchainConfig } from "@/lib/songchain/resolve-lens-app";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const HACK_BETA_OG_IMAGE = {
  url: "/chones/hack-beta/hack-beta-og.png",
  width: 668,
  height: 672,
  alt: "Chones HACKATHON BETA — July 20–24, 2026 Virtual",
  type: "image/png",
} as const;

export const metadata: Metadata = {
  title: "HACKATHON BETA | Chones | Creative TV",
  description:
    "Chones HACKATHON BETA — a virtual hackathon July 20–24, 2026. Join the community feed on Lens and Orb.",
  openGraph: {
    title: "HACKATHON BETA | Chones | Creative TV",
    description:
      "Chones HACKATHON BETA — a virtual hackathon July 20–24, 2026. Join the community feed on Lens and Orb.",
    type: "website",
    url: "/chones/hack-beta",
    images: [HACK_BETA_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "HACKATHON BETA | Chones | Creative TV",
    description:
      "Chones HACKATHON BETA — a virtual hackathon July 20–24, 2026. Join the community feed on Lens and Orb.",
    images: [HACK_BETA_OG_IMAGE.url],
  },
};

export default async function HackBetaPage() {
  const config = await resolveSongchainConfig(getHackBetaConfig());
  return <HackBetaPageClient config={config} />;
}
