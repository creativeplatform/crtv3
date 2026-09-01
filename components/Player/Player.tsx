"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import * as LivepeerPlayer from "@livepeer/react/player";
import type { PlaybackError } from "@livepeer/react";
import {
  PlayIcon,
  PauseIcon,
  MuteIcon,
  UnmuteIcon,
  EnterFullscreenIcon,
  ExitFullscreenIcon,
} from "@livepeer/react/assets";
import { useVideo } from "@/context/VideoContext";
import "./Player.css";
import { Src } from "@livepeer/react";
import { SubtitlesControl } from "./Subtitles";
import { CreativeBrandOverlay } from "./CreativeBrandOverlay";
import { FloatingTipHearts } from "@/components/Live/FloatingTipHearts";
import { safelyPauseVideo } from "@/lib/utils/video-controls";
import { logger } from '@/lib/utils/logger';


export const PlayerLoading: React.FC<{ title: string }> = ({ title }) => {
  return (
    <div className="flex h-64 w-full items-center justify-center bg-gray-900 md:h-96">
      <div className="flex flex-col items-center space-y-4">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-orange-500"></div>
        <p className="text-lg font-medium text-white">{title}</p>
      </div>
    </div>
  );
};

interface PlayerProps {
  src: Src[] | null;
  title: string;
  playbackId?: string;
  assetId?: string;
  jwt?: string;
  onPlay?: () => void;
  autoPlay?: boolean;
  lowLatency?: boolean;
  /** Called when the player has been trying to load too long or the stream goes offline. */
  onStalled?: () => void;
}

/** HLS live warm-up can take ~10–20s; allow headroom before declaring a stall. */
const HLS_WARMUP_MS = 45_000;

export function Player(props: PlayerProps) {
  const { src, title, playbackId, assetId, jwt, onPlay, onStalled, autoPlay = true, lowLatency = true } = props;

  const [controlsVisible, setControlsVisible] = useState(true);
  const fadeTimeoutRef = useRef<NodeJS.Timeout>();
  const containerRef = useRef<HTMLDivElement>(null);
  const { currentPlayingId, setCurrentPlayingId } = useVideo();
  const playerId = useRef(Math.random().toString(36).substring(7)).current;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stalledTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasPlayedRef = useRef(false);

  const clearStalledTimer = useCallback(() => {
    if (stalledTimerRef.current) {
      clearTimeout(stalledTimerRef.current);
      stalledTimerRef.current = null;
    }
  }, []);

  const markPlaybackStarted = useCallback(() => {
    if (hasPlayedRef.current) return;
    hasPlayedRef.current = true;
    clearStalledTimer();
    logger.debug("[Player] Playback started; cleared stall warm-up timer", {
      playbackId,
    });
  }, [clearStalledTimer, playbackId]);

  // Only report a stall if we never reached playable media within the HLS warm-up budget.
  useEffect(() => {
    hasPlayedRef.current = false;
    if (!onStalled) return;

    clearStalledTimer();
    stalledTimerRef.current = setTimeout(() => {
      if (hasPlayedRef.current) return;
      logger.warn("[Player] HLS warm-up exceeded without playback; reporting stall", {
        playbackId,
        budgetMs: HLS_WARMUP_MS,
        hasJwt: Boolean(jwt),
      });
      onStalled();
    }, HLS_WARMUP_MS);

    return () => clearStalledTimer();
  }, [src, onStalled, playbackId, jwt, clearStalledTimer]);

  useEffect(() => {
    const video = containerRef.current?.querySelector("video");
    if (video) {
      videoRef.current = video;
    }
  }, [src]);

  useEffect(() => {
    const video = videoRef.current ?? containerRef.current?.querySelector("video");
    if (!video) return;
    videoRef.current = video;

    const handlePlay = () => {
      markPlaybackStarted();
      setCurrentPlayingId(assetId || playerId);
      onPlay?.();
    };

    const handlePlaying = () => {
      markPlaybackStarted();
    };

    const handleLoadedData = () => {
      // First frame / segment available — treat as successful warm-up.
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        markPlaybackStarted();
      }
    };

    const handlePause = () => {
      if (currentPlayingId === (assetId || playerId)) {
        setCurrentPlayingId("");
      }
    };

    video.addEventListener("play", handlePlay);
    video.addEventListener("playing", handlePlaying);
    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("pause", handlePause);

    return () => {
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("pause", handlePause);
    };
  }, [playerId, currentPlayingId, setCurrentPlayingId, assetId, onPlay, src, markPlaybackStarted]);

  const safelyPauseCurrentVideo = useCallback(async () => {
    if (videoRef.current) {
      await safelyPauseVideo(videoRef.current);
    }
  }, []);

  useEffect(() => {
    if (!videoRef.current) return;

    if (
      currentPlayingId &&
      currentPlayingId !== (assetId || playerId) &&
      !videoRef.current.paused
    ) {
      safelyPauseCurrentVideo();
    }
  }, [currentPlayingId, playerId, assetId, safelyPauseCurrentVideo]);

  const resetFadeTimeout = () => {
    if (fadeTimeoutRef.current) {
      clearTimeout(fadeTimeoutRef.current);
    }
    setControlsVisible(true);
    fadeTimeoutRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, 2000);
  };

  const handleControlInteraction = () => {
    resetFadeTimeout();
  };

  // Log the src array for debugging
  logger.debug("[Player] src array:", src);

  const isInvalidSrc = !src || !Array.isArray(src) || src.length === 0;

  if (isInvalidSrc) {
    logger.error("[Player] No valid video source provided:", src);
    return (
      <div className="flex h-64 w-full items-center justify-center bg-gray-900 md:h-96">
        <p className="text-lg font-medium text-white">
          No video source available
        </p>
      </div>
    );
  }

  return (
    <LivepeerPlayer.Root
      src={src}
      playbackId={playbackId}
      jwt={jwt}
      autoPlay={autoPlay}
      volume={0}
      aspectRatio={16 / 9}
      lowLatency={lowLatency} // default low latency for livestream; allow override
    >
      <LivepeerPlayer.Container
        ref={containerRef}
        className="relative aspect-video touch-none"
        onMouseMove={resetFadeTimeout}
        onMouseEnter={() => setControlsVisible(true)}
        onTouchStart={handleControlInteraction}
      >
        <LivepeerPlayer.Video
          title={title}
          className="h-full w-full"
          playsInline
          controls={false}
          hlsConfig={{
            manifestLoadingTimeOut: HLS_WARMUP_MS,
            manifestLoadingMaxRetry: 6,
            manifestLoadingRetryDelay: 1_500,
            levelLoadingTimeOut: 20_000,
            fragLoadingTimeOut: 20_000,
          }}
        />

        <CreativeBrandOverlay />
        {playbackId ? <FloatingTipHearts streamId={playbackId} /> : null}

        <LivepeerPlayer.LoadingIndicator
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "black",
            position: "absolute",
            top: 0,
            left: 0,
            zIndex: 20,
          }}
        >
          <div className="flex flex-col items-center space-y-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <div className="text-lg font-semibold text-white">Loading...</div>
          </div>
        </LivepeerPlayer.LoadingIndicator>

        <LivepeerPlayer.ErrorIndicator
          matcher="offline"
          className="absolute inset-0 z-30 flex select-none flex-col items-center justify-center gap-3 bg-black/70 text-center backdrop-blur-sm
            data-[visible=true]:animate-in data-[visible=false]:animate-out data-[visible=false]:fade-out-0 data-[visible=true]:fade-in-0 duration-500"
        >
          <div className="flex flex-col gap-1 px-6">
            <div className="text-lg font-bold text-white sm:text-2xl">
              Stream went offline
            </div>
            <div className="text-xs text-gray-200 sm:text-sm">
              Playback will resume automatically if the broadcaster returns.
            </div>
          </div>
        </LivepeerPlayer.ErrorIndicator>

        <LivepeerPlayer.ErrorIndicator
          matcher="access-control"
          className="absolute inset-0 z-30 flex select-none flex-col items-center justify-center gap-3 bg-black/70 text-center backdrop-blur-sm
            data-[visible=true]:animate-in data-[visible=false]:animate-out data-[visible=false]:fade-out-0 data-[visible=true]:fade-in-0 duration-500"
        >
          <div className="flex flex-col gap-1 px-6">
            <div className="text-lg font-bold text-white sm:text-2xl">
              Stream is private
            </div>
            <div className="text-xs text-gray-200 sm:text-sm">
              You don&apos;t have permission to view this content.
            </div>
          </div>
        </LivepeerPlayer.ErrorIndicator>

        <div
          className={`pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 
              via-transparent to-black/60 transition-opacity duration-300 ${controlsVisible ? "opacity-100" : "opacity-0"
            }`}
        />

        <div
          className={`absolute inset-0 z-30 touch-none transition-opacity duration-300 ${controlsVisible ? "opacity-100" : "opacity-0"
            }`}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-6">
              <LivepeerPlayer.PlayPauseTrigger
                className="group relative flex h-16 w-16 cursor-pointer touch-none items-center 
                  justify-center rounded-full bg-black/50 hover:bg-black/70"
                onClick={handleControlInteraction}
              >
                <LivepeerPlayer.PlayingIndicator asChild matcher={false}>
                  <PlayIcon className="h-10 w-10 text-white" />
                </LivepeerPlayer.PlayingIndicator>
                <LivepeerPlayer.PlayingIndicator asChild>
                  <PauseIcon className="h-10 w-10 text-white" />
                </LivepeerPlayer.PlayingIndicator>
              </LivepeerPlayer.PlayPauseTrigger>

              <LivepeerPlayer.MuteTrigger
                className="group relative flex h-14 w-14 cursor-pointer touch-none items-center 
                  justify-center rounded-full bg-black/50 hover:bg-black/70"
                onClick={handleControlInteraction}
              >
                <LivepeerPlayer.VolumeIndicator asChild matcher={false}>
                  <MuteIcon className="h-8 w-8 text-white" />
                </LivepeerPlayer.VolumeIndicator>
                <LivepeerPlayer.VolumeIndicator asChild matcher={true}>
                  <UnmuteIcon className="h-8 w-8 text-white" />
                </LivepeerPlayer.VolumeIndicator>
              </LivepeerPlayer.MuteTrigger>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0">
            <div className="flex items-center justify-between px-5 pb-8">
              <LivepeerPlayer.Time className="rounded-full bg-black/40 px-2 py-0.5 text-xs font-medium tabular-nums text-white/90" />

              <div className="flex items-center gap-4">
                <LivepeerPlayer.FullscreenTrigger
                  className="group relative flex h-10 w-10 cursor-pointer 
                  touch-none items-center justify-center rounded-full bg-black/50 hover:bg-black/70"
                >
                  <LivepeerPlayer.FullscreenIndicator asChild matcher={false}>
                    <EnterFullscreenIcon className="h-6 w-6 text-white" />
                  </LivepeerPlayer.FullscreenIndicator>
                  <LivepeerPlayer.FullscreenIndicator asChild>
                    <ExitFullscreenIcon className="h-6 w-6 text-white" />
                  </LivepeerPlayer.FullscreenIndicator>
                </LivepeerPlayer.FullscreenTrigger>
              </div>
            </div>

            <LivepeerPlayer.Seek
              style={{
                position: "absolute",
                left: 20,
                right: 20,
                bottom: 20,
                height: 20,
                display: "flex",
                alignItems: "center",
                gap: 10,
                userSelect: "none",
                touchAction: "none",
              }}
            >
              <LivepeerPlayer.Track
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.7)",
                  position: "relative",
                  flexGrow: 1,
                  borderRadius: 9999,
                  height: 2,
                }}
              >
                <LivepeerPlayer.SeekBuffer
                  style={{
                    position: "absolute",
                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                    borderRadius: 9999,
                    height: "100%",
                  }}
                />
                <LivepeerPlayer.Range
                  style={{
                    position: "absolute",
                    backgroundColor: "white",
                    borderRadius: 9999,
                    height: "100%",
                  }}
                />
              </LivepeerPlayer.Track>
              <LivepeerPlayer.Thumb
                style={{
                  display: "block",
                  width: 12,
                  height: 12,
                  backgroundColor: "white",
                  borderRadius: 9999,
                }}
              />
            </LivepeerPlayer.Seek>
          </div>
        </div>
      </LivepeerPlayer.Container>
    </LivepeerPlayer.Root>
  );
}
