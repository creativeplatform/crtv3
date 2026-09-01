'use client';
import * as Player from '@livepeer/react/player';
import { Src } from '@livepeer/react';
import { PlayIcon, PauseIcon, MuteIcon, UnmuteIcon } from '@livepeer/react/assets';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useVideo } from '../../context/VideoContext';
import './Player.css';
import { safelyPauseVideo } from '@/lib/utils/video-controls';
import { CreativeBrandOverlay } from './CreativeBrandOverlay';

export const HeroPlayer: React.FC<{
  src: Src[] | null;
  title: string;
  playbackId?: string;
}> = ({ src, title, playbackId }) => {
  const [controlsVisible, setControlsVisible] = useState(true);
  const fadeTimeoutRef = useRef<NodeJS.Timeout>();
  const containerRef = useRef<HTMLDivElement>(null);
  const { currentPlayingId, setCurrentPlayingId } = useVideo();
  const playerId = useRef(Math.random().toString(36).substring(7)).current;

  useEffect(() => {
    resetFadeTimeout();
    return () => {
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current);
      }
    };
  }, [src, title]);

  const safelyPauseCurrentVideo = useCallback(async () => {
    const video = containerRef.current?.querySelector('video');
    if (video) {
      await safelyPauseVideo(video);
    }
  }, []);

  useEffect(() => {
    if (currentPlayingId && currentPlayingId !== playerId) {
      // Another video started playing, pause this one
      const video = containerRef.current?.querySelector('video');
      if (video && !video.paused) {
        safelyPauseCurrentVideo();
      }
    }
  }, [currentPlayingId, playerId, safelyPauseCurrentVideo]);


  if (!src || src.length === 0) {
    return <div>No video source available.</div>;
  }

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
    setControlsVisible(true);
    resetFadeTimeout();
  };

  const handlePlay = () => {
    setCurrentPlayingId(playerId);
  };

  return (
    <Player.Root src={src} playbackId={playbackId} autoPlay volume={0}>
      <Player.Container 
        ref={containerRef}
        className="hero-player-container relative aspect-video touch-none"
        onMouseMove={resetFadeTimeout}
        onMouseEnter={() => setControlsVisible(true)}
        onTouchStart={handleControlInteraction}
      >
        <Player.Video 
          title={title} 
          onPlay={handlePlay}
          className="h-full w-full"
          playsInline
          controls={false}
        />

        <CreativeBrandOverlay />
        
        <Player.LoadingIndicator
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
            zIndex: 20
          }}
        >
          <div className="flex flex-col items-center space-y-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <div className="text-lg font-semibold text-white">Loading...</div>
          </div>
        </Player.LoadingIndicator>

        <div 
          className={`absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/60 
            pointer-events-none transition-opacity duration-300 
            ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}
        />
        
        <div 
          className={`absolute inset-0 z-30 touch-none transition-opacity duration-300 
            ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-6">
              <Player.PlayPauseTrigger 
                className={`group relative flex h-16 w-16 touch-none cursor-pointer items-center 
                  justify-center rounded-full bg-black/50 hover:bg-black/70`}
                onClick={handleControlInteraction}
              >
                <Player.PlayingIndicator asChild matcher={false}>
                  <PlayIcon className="h-10 w-10 text-white" />
                </Player.PlayingIndicator>
                <Player.PlayingIndicator asChild>
                  <PauseIcon className="h-10 w-10 text-white" />
                </Player.PlayingIndicator>
              </Player.PlayPauseTrigger>

              <Player.MuteTrigger 
                className={`group relative flex h-14 w-14 touch-none cursor-pointer items-center 
                  justify-center rounded-full bg-black/50 hover:bg-black/70`}
                onClick={handleControlInteraction}
              >
                <Player.VolumeIndicator asChild matcher={false}>
                  <MuteIcon className="h-8 w-8 text-white" />
                </Player.VolumeIndicator>
                <Player.VolumeIndicator asChild matcher={true}>
                  <UnmuteIcon className="h-8 w-8 text-white" />
                </Player.VolumeIndicator>
              </Player.MuteTrigger>
            </div>
          </div>
        </div>
      </Player.Container>
    </Player.Root>
  );
};
