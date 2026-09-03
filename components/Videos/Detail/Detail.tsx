"use client";
import { useEffect, useState } from "react";
import { Player } from "@/components/Player/Player";
import { Asset } from "livepeer/models/components";
import { Src } from "@livepeer/react";
import { fullLivepeer } from "@/lib/sdk/livepeer/fullClient";
import { getDetailPlaybackSource } from "@/lib/hooks/livepeer/useDetailPlaybackSources";
import VideoViewMetrics from "@/components/Videos/VideoViewMetrics";
import { Skeleton } from "@/components/ui/skeleton";
import { useShoppableAnnotations } from "@/lib/hooks/shoppable/useShoppableAnnotations";
import { logger } from '@/lib/utils/logger';


export default function VideoDetailsPage({
  params,
}: {
  params: { slug: string };
}) {
  const [asset, setAsset] = useState<any>();
  const [playbackSources, setPlaybackSources] = useState<Src[] | null>(null);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [assetLoading, setAssetLoading] = useState(false);
  const [error, setError] = useState("");
  const { annotations, campaignId } = useShoppableAnnotations(asset?.playbackId);

  useEffect(() => {
    const fetchVideoDetails = async () => {
      setIsLoading(true);
      try {
        await fetchAssetDetails(asset?.assetId);
      } catch (err) {
        setError("Failed to load video data");
        logger.error(err);
      }
      setIsLoading(false);
    };

    fetchVideoDetails();
  }, [asset?.assetId, params.slug]);

  useEffect(() => {
    if (!asset?.playbackId) {
      setPlaybackSources(null);
      return;
    }

    let cancelled = false;
    const fetchPlaybackSources = async () => {
      setSourcesLoading(true);
      try {
        const sources = await getDetailPlaybackSource(asset.playbackId);
        if (!cancelled) {
          setPlaybackSources(sources);
        }
      } catch (err) {
        if (!cancelled) {
          setPlaybackSources(null);
          logger.error(err);
        }
      } finally {
        if (!cancelled) {
          setSourcesLoading(false);
        }
      }
    };

    fetchPlaybackSources();
    return () => {
      cancelled = true;
    };
  }, [asset?.playbackId]);

  const fetchAssetDetails = async (asset: Asset) => {
    setAssetLoading(true);
    try {
      const assetData = await fullLivepeer?.asset.get(`${asset.id}`);
      setAsset(assetData);
    } catch (err) {
      setError("Failed to load asset data");
      logger.error(err);
    }
    setAssetLoading(false);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex flex-1 flex-col items-center justify-center px-2 py-6 w-full">
        <div className="w-full max-w-lg md:max-w-2xl flex flex-col items-center">
          {isLoading || assetLoading ? (
            <Skeleton className="h-7 w-2/3 mb-4 rounded" />
          ) : (
            <h1 className="text-lg md:text-2xl font-bold mb-4 text-center break-words w-full px-2 md:px-0">
              {asset?.name || params.slug}
            </h1>
          )}

          <div className="w-full aspect-video flex justify-center items-center bg-black rounded-lg overflow-hidden shadow-md">
            {isLoading || assetLoading || sourcesLoading ? (
              <Skeleton className="w-full h-full rounded-lg" />
            ) : error ? (
              <div className="text-red-500">{error}</div>
            ) : (
              asset && (
                <Player
                  src={playbackSources}
                  playbackId={asset.playbackId}
                  title={asset?.name}
                  shoppableAnnotations={annotations}
                  shoppableCampaignId={campaignId ?? undefined}
                />
              )
            )}
          </div>
          {asset?.playbackId && (
            <div className="w-full flex">
              <div className="flex-1 justify-end" />
              <div className="mt-3 md:mt-4 text-sm md:text-base text-gray-500">
                <VideoViewMetrics playbackId={asset.playbackId} />
              </div>
            </div>
          )}
        </div>
      </main>
      {/* Footer is assumed to be outside this file, but this layout ensures it stays at the bottom */}
    </div>
  );
}
