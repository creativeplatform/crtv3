'use client';
import React, {
  useState,
  useEffect,
  type CSSProperties,
  type PropsWithChildren,
  forwardRef,
} from 'react';
import {
  EnterFullscreenIcon,
  ExitFullscreenIcon,
  PauseIcon,
  PlayIcon,
  LoadingIcon,
  MuteIcon,
  UnmuteIcon,
} from '@livepeer/react/assets';
import { Src } from '@livepeer/react';
import * as Player from '@livepeer/react/player';
//import { Skeleton } from '../ui/skeleton';

export const PlayerComponent: React.FC<{
  src: Src[] | null;
  title: string;
}> = ({ src, title }) => {
  // if (!src) {
  //   return (
  //     <div className={'relative flex w-full'}>
  //       <div className="absolute left-1/2 top-1/2 translate-x-1/2 translate-y-1/2">
  //         <Skeleton className="h-40 w-[250px]" />
  //       </div>
  //     </div>
  //   );
  // }

  return (
    <>
      <Player.Root src={src}>
        <Player.Container className="h-full w-full overflow-hidden bg-gray-950">
          <Player.Video title={title} className="h-full w-full" poster={null} />

          <Player.LoadingIndicator className="relative h-full w-full bg-black/50 backdrop-blur data-[visible=true]:animate-in data-[visible=false]:animate-out data-[visible=false]:fade-out-0 data-[visible=true]:fade-in-0">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <LoadingIcon className="h-8 w-8 animate-spin" />
            </div>
            <PlayerLoading />
          </Player.LoadingIndicator>

          <Player.ErrorIndicator
            matcher="all"
            className="absolute inset-0 flex select-none flex-col items-center justify-center gap-4 bg-black/40 text-center backdrop-blur-lg duration-1000 data-[visible=true]:animate-in data-[visible=false]:animate-out data-[visible=false]:fade-out-0 data-[visible=true]:fade-in-0"
          >
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <LoadingIcon className="h-8 w-8 animate-spin" />
            </div>
            <PlayerLoading />
          </Player.ErrorIndicator>

          <Player.ErrorIndicator
            matcher="offline"
            className="absolute inset-0 flex select-none flex-col items-center justify-center gap-4 bg-black/40 text-center backdrop-blur-lg duration-1000 animate-in fade-in-0 data-[visible=true]:animate-in data-[visible=false]:animate-out data-[visible=false]:fade-out-0 data-[visible=true]:fade-in-0"
          >
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1">
                <div className="text-lg font-bold sm:text-2xl">
                  Stream is offline
                </div>
                <div className="text-xs text-gray-100 sm:text-sm">
                  Playback will start automatically once the stream has started
                </div>
              </div>
              <LoadingIcon className="mx-auto h-6 w-6 animate-spin md:h-8 md:w-8" />
            </div>
          </Player.ErrorIndicator>

          <Player.ErrorIndicator
            matcher="access-control"
            className="absolute inset-0 flex select-none flex-col items-center justify-center gap-4 bg-black/40 text-center backdrop-blur-lg duration-1000 data-[visible=true]:animate-in data-[visible=false]:animate-out data-[visible=false]:fade-out-0 data-[visible=true]:fade-in-0"
          >
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1">
                <div className="text-lg font-bold sm:text-2xl">
                  Stream is private
                </div>
                <div className="text-xs text-gray-100 sm:text-sm">
                  It looks like you don&apos;t have permission to view this
                  content
                </div>
              </div>
              <LoadingIcon className="mx-auto h-6 w-6 animate-spin md:h-8 md:w-8" />
            </div>
          </Player.ErrorIndicator>

          <Player.Controls className="flex items-center justify-center">
            <Player.PlayPauseTrigger className="h-10 w-10 flex-shrink-0 hover:scale-105">
              <Player.PlayingIndicator asChild matcher={false}>
                <PlayIcon
                  className="h-full w-full"
                  style={{
                    color: '#1A202C',
                    backgroundImage: 'linear-gradient(45deg, #EC407A, #FACB80)',
                  }}
                />
              </Player.PlayingIndicator>
              <Player.PlayingIndicator asChild>
                <PauseIcon
                  className="h-full w-full"
                  style={{ color: '#EC407A' }}
                />
              </Player.PlayingIndicator>
            </Player.PlayPauseTrigger>
            <div className=" flex justify-between gap-4">
              <div className="absolute bottom-0 left-0 mx-2 my-2 flex items-center justify-start gap-2.5 sm:flex-1 md:flex-[1.5]">
                <Player.LiveIndicator
                  matcher={false}
                  className="flex items-center gap-2"
                >
                  <Player.Time
                    className="select-none text-sm tabular-nums"
                    style={{ color: '#EC407A' }}
                  />
                </Player.LiveIndicator>
                <Player.MuteTrigger className="h-6 w-6 flex-shrink-0 transition hover:scale-110">
                  <Player.VolumeIndicator asChild matcher={false}>
                    <MuteIcon
                      className="h-full w-full"
                      style={{ color: '#EC407A' }}
                    />
                  </Player.VolumeIndicator>
                  <Player.VolumeIndicator asChild matcher={true}>
                    <UnmuteIcon
                      className="h-full w-full"
                      style={{ color: '#EC407A' }}
                    />
                  </Player.VolumeIndicator>
                </Player.MuteTrigger>
              </div>

              <div className="absolute bottom-0 right-0 mx-2 my-2 flex items-center justify-end gap-2.5 sm:flex-1 md:flex-[1.5]">
                <Player.FullscreenTrigger className="h-6 w-6 flex-shrink-0 transition hover:scale-110">
                  <Player.FullscreenIndicator asChild>
                    <ExitFullscreenIcon
                      className="h-full w-full"
                      style={{ color: '#EC407A' }}
                    />
                  </Player.FullscreenIndicator>
                  <Player.FullscreenIndicator matcher={false} asChild>
                    <EnterFullscreenIcon
                      className="h-full w-full"
                      style={{ color: '#EC407A' }}
                    />
                  </Player.FullscreenIndicator>
                </Player.FullscreenTrigger>
              </div>
            </div>
          </Player.Controls>
        </Player.Container>
      </Player.Root>
    </>
  );
};

export const PlayerLoading = ({
  title,
  description,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
}) => (
  <div className="relative flex aspect-video w-full flex-col-reverse gap-3 overflow-hidden rounded-sm bg-white/10 px-3 py-2">
    <div className="flex justify-between">
      <div className="flex items-center gap-2">
        <div className="h-6 w-6 animate-pulse overflow-hidden rounded-lg bg-white/5" />
        <div className="h-6 w-16 animate-pulse overflow-hidden rounded-lg bg-white/5 md:h-7 md:w-20" />
      </div>

      <div className="flex items-center gap-2">
        <div className="h-6 w-6 animate-pulse overflow-hidden rounded-lg bg-white/5" />
        <div className="h-6 w-6 animate-pulse overflow-hidden rounded-lg bg-white/5" />
      </div>
    </div>
    <div className="h-2 w-full animate-pulse overflow-hidden rounded-lg bg-white/5" />

    {title && (
      <div className="absolute inset-10 flex flex-col items-center justify-center gap-1 text-center">
        <span className="text-lg font-medium text-white">{title}</span>
        {description && (
          <span className="text-sm text-white/80">{description}</span>
        )}
      </div>
    )}
  </div>
);
