'use client';
import React, { useEffect, useState } from 'react';
import { Asset } from 'livepeer/models/components';
import { fetchAllAssets } from '@app/api/livepeer/actions';
import VideoCard from '@app/components/Videos/VideoCard';
import { Src } from '@livepeer/react';
import { getDetailPlaybackSource } from '@app/lib/utils/hooks/useDetailPlaybackSources';

type VideoCardProps = {
  asset: Asset;
};

const VideoCardGrid: React.FC = () => {
  const [playbackSources, setPlaybackSources] = useState<
    (Asset & { detailedSrc: Src[] | null })[] | null
  >(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSources = async () => {
      try {
        const response = await fetchAllAssets();
        if (response && Array.isArray(response)) {
          // Only process assets that are ready for playback
          const readyAssets = response.filter(
            (asset) => asset.status?.phase === 'ready',
          );

          // Fetch detailed playback sources for each ready asset
          const detailedPlaybackSources = await Promise.all(
            readyAssets.map(async (asset: Asset) => {
              try {
                const detailedSrc = await getDetailPlaybackSource(
                  `${asset.playbackId}`,
                );
                // console.log(asset.playbackId + ': ', detailedSrc);
                return { ...asset, detailedSrc }; // Add detailedSrc to the asset object
              } catch (err) {
                console.error(
                  `Error fetching playback source for asset ${asset.id}:`,
                  err,
                );
                return { ...asset, detailedSrc: null }; // Handle errors for individual assets
              }
            }),
          );
          setPlaybackSources(detailedPlaybackSources); // Set the modified assets with detailed sources
        } else {
          setPlaybackSources([]);
        }
      } catch (err) {
        console.error('Error fetching playback sources: ', err);
        setError('Failed to load videos.');
      } finally {
        setLoading(false);
      }
    };

    fetchSources();
  }, []);

  if (loading) {
    return <p>Loading videos...</p>;
  }

  if (error) {
    return <p>{error}</p>;
  }

  if (!playbackSources || playbackSources.length === 0) {
    return <p>No videos available.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {playbackSources.map((asset) => (
        <VideoCard
          key={asset.id}
          asset={asset}
          playbackSources={asset.detailedSrc}
        />
      ))}
    </div>
  );
};

export default VideoCardGrid;
