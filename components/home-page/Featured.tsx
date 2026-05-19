"use client";

import React, { useEffect, useState } from "react";
import { PreviewPlayer } from "../Player/PreviewPlayer";
import { getFeaturedPlaybackSource } from "@/lib/hooks/livepeer/useFeaturePlaybackSource";
import {
  FEATURED_VIDEO_TITLE,
  LIVEPEER_FEATURED_PLAYBACK_ID,
} from "@/context/context";
import { Src } from "@livepeer/react";
import { useVideo } from "@/context/VideoContext";
import { logger } from '@/lib/utils/logger';


const FeaturedVideo: React.FC = () => {
  const [playbackSource, setPlaybackSource] = useState<Src[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPlaybackSource = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const src = await getFeaturedPlaybackSource();

        if (!src || src.length === 0) {
          setError("No playback source available");
          return;
        }

        setPlaybackSource(src);
      } catch (err) {
        setError("Failed to load featured video");
        logger.error("Error loading featured video:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadPlaybackSource();
  }, []);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl py-10">
        <h2 className="mb-8 text-2xl font-bold">Featured</h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="flex items-center justify-center aspect-video bg-gray-900 rounded-lg">
            <div className="flex flex-col items-center space-y-4">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
              <div className="text-lg font-semibold text-white">
                Loading featured content...
              </div>
            </div>
          </div>
          <div className="space-y-4 animate-pulse">
            <div className="h-8 bg-gray-700 rounded w-3/4"></div>
            <div className="h-20 bg-gray-700 rounded"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-700 rounded w-1/2"></div>
              <div className="h-4 bg-gray-700 rounded w-3/4"></div>
              <div className="h-4 bg-gray-700 rounded w-2/3"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !playbackSource || playbackSource.length === 0) {
    return (
      <div className="mx-auto max-w-7xl py-10">
        <h2 className="mb-8 text-2xl font-bold">Featured</h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="flex items-center justify-center aspect-video bg-gray-900 rounded-lg">
            <div className="text-center">
              <h3 className="text-xl font-medium text-white">
                Unable to load featured content
              </h3>
              <p className="mt-2 text-gray-400">Please try again later</p>
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-xl font-medium">{FEATURED_VIDEO_TITLE}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Experience the future of creative content. Watch how creators are
              leveraging Web3 technology to build sustainable careers and
              connect with their audience in new ways.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl py-10">
      <h2 className="mb-8 text-2xl font-bold">Featured</h2>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="overflow-hidden rounded-lg bg-gray-900 shadow-md transition-all hover:shadow-lg">
          <PreviewPlayer
            src={playbackSource}
            title={FEATURED_VIDEO_TITLE}
            playbackId={LIVEPEER_FEATURED_PLAYBACK_ID}
          />
        </div>
        <div className="space-y-4">
          <h3 className="text-xl font-medium">{FEATURED_VIDEO_TITLE}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Join us for another exciting episode of The Creative Podcast where
            we explore the intersection of creativity and technology. In this
            episode, we dive deep into how creators are leveraging Web3 to build
            sustainable careers.
          </p>
          <div className="mt-6">
            <h4 className="text-lg font-medium mb-4">Episode Highlights</h4>
            <ul className="list-inside list-disc space-y-2">
              <li>The evolution of creative platforms</li>
              <li>How Web3 is changing content monetization</li>
              <li>Building direct creator-audience relationships</li>
              <li>The future of decentralized media</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeaturedVideo;
