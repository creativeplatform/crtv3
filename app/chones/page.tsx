import { ChonesPageClient } from "@/components/chones/ChonesPageClient";
import { getChonesConfig } from "@/lib/chones/config";
import { resolveSongchainConfig } from "@/lib/songchain/resolve-lens-app";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Chones | Creative TV",
  description: "Hackathons on Lens Chain — feeds, community group, and events.",
};

export default async function ChonesPage() {
  const config = await resolveSongchainConfig(getChonesConfig());
  return <ChonesPageClient config={config} />;
}
