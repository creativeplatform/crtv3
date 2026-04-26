import { Metadata, ResolvingMetadata } from "next";
import { getVideoAssetByPlaybackId } from "@/services/video-assets";
import { getTokenMarketData } from "@/lib/services/market";
import WatchClient from "./WatchClient";

interface WatchPageProps {
    params: Promise<{
        playbackId: string;
    }>;
}

const DEFAULT_METADATA: Metadata = {
    title: "Watch Live",
    description: "Watch on Creative TV",
};

export async function generateMetadata(
    { params }: WatchPageProps,
    parent: ResolvingMetadata
): Promise<Metadata> {
    try {
        const { playbackId } = await params;

        const videoAsset = await getVideoAssetByPlaybackId(playbackId).catch((err) => {
            console.error("Watch page metadata: videoAsset fetch failed", err);
            return null;
        });
        const tokenAddress = videoAsset?.attributes?.content_coin_id;

        const title = videoAsset?.title || "Live Stream";
        const desc = "Watch on Creative TV";

        if (!tokenAddress) {
            return {
                title: videoAsset?.title ? `Watch ${title}` : 'Watch Live',
                description: desc,
            };
        }

        const marketData = await getTokenMarketData(tokenAddress).catch((err) => {
            console.error("Watch page metadata: market data fetch failed", err);
            return null;
        });

        if (marketData) {
            const price = `$${marketData.price.toFixed(4)}`;
            const tvl = marketData.tvl >= 1000
                ? `$${(marketData.tvl / 1000).toFixed(1)}K`
                : `$${marketData.tvl.toFixed(2)}`;

            const metaTitle = `${marketData.symbol} ($${price}) - ${title}`;
            const metaDesc = `Watch & Trade ${marketData.symbol}. TVL: ${tvl}. ${desc}`;

            return {
                title: metaTitle,
                description: metaDesc,
                openGraph: {
                    title: metaTitle,
                    description: metaDesc,
                    images: videoAsset?.thumbnail_url ? [videoAsset.thumbnail_url] : [],
                },
                twitter: {
                    card: "summary_large_image",
                    title: metaTitle,
                    description: metaDesc,
                    images: videoAsset?.thumbnail_url ? [videoAsset.thumbnail_url] : [],
                }
            };
        }

        return {
            title: `Watch ${title}`,
            description: desc,
        };
    } catch (err) {
        console.error("Watch page generateMetadata failed", err);
        return DEFAULT_METADATA;
    }
}

export default async function WatchPage({ params }: WatchPageProps) {
    const { playbackId } = await params;

    // Fetch data for the client component. Swallow errors so a DB/market blip
    // doesn't kick the whole page to the generic error boundary — WatchClient
    // can classify "stream not watchable" states on its own.
    let videoAsset = null;
    try {
        videoAsset = await getVideoAssetByPlaybackId(playbackId);
    } catch (err) {
        console.error("Watch page: videoAsset fetch failed", err);
    }

    const tokenAddress = videoAsset?.attributes?.content_coin_id;

    let marketData = null;
    let tokenInfo = null;

    if (tokenAddress) {
        try {
            marketData = await getTokenMarketData(tokenAddress);
            if (marketData) {
                tokenInfo = {
                    address: tokenAddress,
                    symbol: marketData.symbol,
                    name: marketData.name
                };
            }
        } catch (err) {
            console.error("Watch page: market data fetch failed", err);
        }
    }

    return (
        <WatchClient
            initialMarketData={marketData}
            tokenInfo={tokenInfo}
            videoTitle={videoAsset?.title}
            storyIpId={videoAsset?.story_ip_id ?? null}
            storyIpRegistered={videoAsset?.story_ip_registered ?? false}
        />
    );
}
