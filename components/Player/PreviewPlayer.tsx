"use client";
import * as Player from "@livepeer/react/player";
import { Src } from "@livepeer/react";
import {
  PlayIcon,
  PauseIcon,
  MuteIcon,
  UnmuteIcon,
  EnterFullscreenIcon,
  ExitFullscreenIcon,
} from "@livepeer/react/assets";
import { useEffect, useState, useRef, useCallback } from "react";
import "./Player.css";
import { ViewsComponent } from "./ViewsComponent";
import { useVideo } from "@/context/VideoContext";
import { safelyPauseVideo, safelyPlayVideo } from "@/lib/utils/video-controls";
import { logger } from '@/lib/utils/logger';


export const PreviewPlayer: React.FC<{
  src: Src[];
  title: string;
  /** Canonical Livepeer playback id for view metrics (preferred over parsing src). */
  playbackId?: string;
}> = ({ src, title, playbackId: playbackIdProp }) => {
  const [controlsVisible, setControlsVisible] = useState(true);
  const fadeTimeoutRef = useRef<NodeJS.Timeout>();
  const containerRef = useRef<HTMLDivElement>(null);
  const { currentPlayingId, setCurrentPlayingId } = useVideo();
  const playerId = useRef(Math.random().toString(36).substring(7)).current;
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isUnmountingRef = useRef(false);

  // Extract playback ID from the source
  const getPlaybackId = (sources: Src[]): string => {
    if (!sources.length) return "";

    const source = sources[0] as unknown;

    if (isHLSSource(source)) {
      const hrnParts = source.hrn.split(":");
      return hrnParts[hrnParts.length - 1];
    }

    if (isMP4Source(source)) {
      const urlParts = source.src.split("/");
      return urlParts[urlParts.length - 1].split(".")[0];
    }

    return "";
  };

  // Type guards for source types
  const isHLSSource = (source: unknown): source is HLSVideoSource => {
    if (!source || typeof source !== "object") return false;
    return (
      "hrn" in source &&
      "type" in source &&
      (source as { type: string }).type === "hls"
    );
  };

  const isMP4Source = (source: unknown): source is MP4VideoSource => {
    if (!source || typeof source !== "object") return false;
    return (
      "src" in source &&
      "type" in source &&
      (source as { type: string }).type === "mp4"
    );
  };

  const safelyPauseCurrentVideo = useCallback(async () => {
    if (!videoRef.current || isUnmountingRef.current) return;
    await safelyPauseVideo(videoRef.current);
  }, []);

  useEffect(() => {
    const video = containerRef.current?.querySelector("video");
    if (video) {
      videoRef.current = video;

      // Set initial volume and playback rate
      video.volume = 0.5;
      video.playbackRate = 1.0;
    }

    return () => {
      isUnmountingRef.current = true;
    };
  }, []);

  useEffect(() => {
    if (!videoRef.current) return;

    const handlePlay = async () => {
      if (isUnmountingRef.current) {
        await safelyPauseCurrentVideo();
        return;
      }

      setIsPlaying(true);
      setCurrentPlayingId(playerId);
    };

    const handlePause = () => {
      setIsPlaying(false);
      if (currentPlayingId === playerId) {
        setCurrentPlayingId("");
      }
    };

    const handleBeforeUnload = () => {
      safelyPauseCurrentVideo();
    };

    videoRef.current.addEventListener("play", handlePlay);
    videoRef.current.addEventListener("pause", handlePause);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      if (videoRef.current) {
        videoRef.current.removeEventListener("play", handlePlay);
        videoRef.current.removeEventListener("pause", handlePause);
        safelyPauseCurrentVideo();
      }
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (currentPlayingId === playerId) {
        setCurrentPlayingId("");
      }
    };
  }, [playerId, currentPlayingId, setCurrentPlayingId, safelyPauseCurrentVideo]);

  useEffect(() => {
    if (!videoRef.current) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        safelyPauseCurrentVideo();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [safelyPauseCurrentVideo]);

  useEffect(() => {
    if (!videoRef.current) return;

    if (
      currentPlayingId &&
      currentPlayingId !== playerId &&
      !videoRef.current.paused
    ) {
      safelyPauseCurrentVideo();
    }
  }, [currentPlayingId, playerId, safelyPauseCurrentVideo]);

  const resetFadeTimeout = () => {
    if (fadeTimeoutRef.current) {
      clearTimeout(fadeTimeoutRef.current);
    }
    setControlsVisible(true);
    fadeTimeoutRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, 2000);
  };

  const handleControlInteraction = useCallback(() => {
    resetFadeTimeout();
    if (videoRef.current) {
      if (videoRef.current.paused) {
        safelyPlayVideo(videoRef.current).catch((error) => {
          // Ignore AbortError as it's expected when interrupted
          if (error instanceof Error && error.name !== "AbortError") {
            logger.error("Error playing video:", error);
          }
        });
      } else {
        safelyPauseCurrentVideo();
      }
    }
  }, [safelyPauseCurrentVideo]);

  return (
    <div
      ref={containerRef}
      className="player-container"
      onMouseMove={resetFadeTimeout}
      onMouseLeave={() => setControlsVisible(false)}
      onTouchStart={resetFadeTimeout}
    >
      <Player.Root
        src={src}
        autoPlay={false}
        volume={0}
        aspectRatio={16 / 9}
        onError={(error) => {
          logger.error("Player error:", error);
        }}
      >
        <Player.Container className="relative h-full w-full">
          <Player.Video
            className="absolute inset-0 h-full w-full object-cover"
            title={title}
            playsInline
            controls={false}
            onCanPlay={() => {
              if (videoRef.current) {
                videoRef.current.volume = 0.5;
              }
            }}
            onPlay={() => {
              setIsPlaying(true);
              setCurrentPlayingId(playerId);
            }}
            onPause={() => {
              setIsPlaying(false);
              if (currentPlayingId === playerId) {
                setCurrentPlayingId("");
              }
            }}
          />

          <Player.LoadingIndicator className="absolute inset-0 flex items-center justify-center bg-black">
            <div className="flex flex-col items-center space-y-4">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
              <div className="text-lg font-semibold text-white">Loading...</div>
            </div>
          </Player.LoadingIndicator>

          <div
            className={`pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 
              via-transparent to-black/60 transition-opacity duration-300 
              ${controlsVisible ? "opacity-100" : "opacity-0"}`}
          />

          <div
            className={`absolute inset-0 z-30 flex flex-col justify-between transition-opacity 
              duration-300 ${controlsVisible ? "opacity-100" : "opacity-0"}`}
          >
            {/* Top controls bar */}
            <div className="w-full bg-gradient-to-b from-black/80 to-transparent px-4 py-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-white line-clamp-1">
                  {title}
                </h3>
                <ViewsComponent
                  playbackId={playbackIdProp || getPlaybackId(src)}
                />
              </div>
            </div>

            {/* Center play/pause button */}
            <div className="absolute inset-0 flex items-center justify-center">
              <Player.PlayPauseTrigger
                className={`group relative flex h-16 w-16 cursor-pointer items-center 
                  justify-center rounded-full bg-black/50 hover:bg-black/70 
                  transition-transform duration-200 hover:scale-110`}
                onClick={handleControlInteraction}
              >
                <Player.PlayingIndicator asChild matcher={false}>
                  <PlayIcon className="h-10 w-10 text-white" />
                </Player.PlayingIndicator>
                <Player.PlayingIndicator asChild>
                  <PauseIcon className="h-10 w-10 text-white" />
                </Player.PlayingIndicator>
              </Player.PlayPauseTrigger>
            </div>

            {/* Bottom controls */}
            <div className="w-full bg-gradient-to-t from-black/80 to-transparent px-4 pb-4 pt-20">
              <Player.Seek className="group relative mb-4 flex h-1 w-full cursor-pointer items-center">
                <Player.Track className="relative h-1 w-full rounded-full bg-white/30 group-hover:h-1.5 transition-all">
                  <Player.SeekBuffer className="absolute h-full rounded-full bg-white/50" />
                  <Player.Range className="absolute h-full rounded-full bg-white" />
                  <Player.Thumb
                    className={`absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-white opacity-0 
                  group-hover:opacity-100 transition-opacity ${
                    isPlaying ? "opacity-100" : "opacity-0"
                  }`}
                  />
                </Player.Track>
              </Player.Seek>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Player.MuteTrigger
                    className="group relative flex h-8 w-8 cursor-pointer items-center 
                      justify-center rounded-full hover:bg-white/10"
                    onClick={handleControlInteraction}
                  >
                    <Player.VolumeIndicator asChild matcher={false}>
                      <MuteIcon className="h-5 w-5 text-white" />
                    </Player.VolumeIndicator>
                    <Player.VolumeIndicator asChild matcher={true}>
                      <UnmuteIcon className="h-5 w-5 text-white" />
                    </Player.VolumeIndicator>
                  </Player.MuteTrigger>
                  <Player.Time className="text-sm font-medium text-white" />
                </div>

                <Player.FullscreenTrigger
                  className="group relative flex h-8 w-8 cursor-pointer items-center 
                    justify-center rounded-full hover:bg-white/10"
                >
                  <Player.FullscreenIndicator asChild matcher={false}>
                    <EnterFullscreenIcon className="h-5 w-5 text-white" />
                  </Player.FullscreenIndicator>
                  <Player.FullscreenIndicator asChild>
                    <ExitFullscreenIcon className="h-5 w-5 text-white" />
                  </Player.FullscreenIndicator>
                </Player.FullscreenTrigger>
              </div>
            </div>
          </div>
        </Player.Container>
      </Player.Root>
    </div>
  );
};

interface HLSVideoSource {
  type: "hls";
  hrn: string;
}

interface MP4VideoSource {
  type: "mp4";
  src: string;
}
