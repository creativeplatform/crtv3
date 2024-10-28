'use client';
import { Asset } from 'livepeer/models/components';
import React, {
  useState,
  useEffect,
  type CSSProperties,
  type PropsWithChildren,
  forwardRef,
} from 'react';
import { Src } from '@livepeer/react';
import * as Player from '@livepeer/react/player';
import * as Popover from '@radix-ui/react-popover';
import { cn } from '@app/lib/utils';
import {
  CheckIcon,
  ChevronDownIcon,
  XIcon,
  PictureInPictureIcon,
} from 'lucide-react';
import {
  PauseIcon,
  PlayIcon,
  MuteIcon,
  SettingsIcon,
  UnmuteIcon,
  LoadingIcon,
  EnterFullscreenIcon,
  ExitFullscreenIcon,
} from '@livepeer/react/assets';
import { Skeleton } from '@app/components/ui/skeleton';
import { getDetailPlaybackSource } from '@app/lib/utils/hooks/useDetailPlaybackSources';

type VideoDetailsProps = {
  asset: Asset;
};

export default function VideoDetails({ asset }: VideoDetailsProps) {
  const [playbackSources, setPlaybackSources] = useState<Src[] | null>(null);

  useEffect(() => {
    const fetchPlaybackSources = async () => {
      const sources = await getDetailPlaybackSource(asset.playbackId || '');
      setPlaybackSources(sources);
    };

    fetchPlaybackSources();
  }, [asset.playbackId]);

  const Seek = forwardRef<HTMLButtonElement, Player.SeekProps>(
    ({ children, ...props }, forwardedRef) => (
      <Player.Seek ref={forwardedRef} {...props}>
        <Player.Track
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            position: 'relative',
            flexGrow: 1,
            borderRadius: 9999,
            height: 2,
          }}
        >
          <Player.SeekBuffer
            style={{
              position: 'absolute',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              borderRadius: 9999,
              height: '100%',
            }}
          />
          <Player.Range
            style={{
              position: 'absolute',
              backgroundColor: 'white',
              borderRadius: 9999,
              height: '100%',
            }}
          />
        </Player.Track>
        <Player.Thumb
          style={{
            display: 'block',
            width: 12,
            height: 12,
            backgroundColor: '#EC407A',
            borderRadius: 9999,
          }}
        />
      </Player.Seek>
    ),
  );
  Seek.displayName = 'Seek';

  const Settings = React.forwardRef(
    (
      { className }: { className?: string },
      ref: React.Ref<HTMLButtonElement> | undefined,
    ) => {
      return (
        <Popover.Root>
          <Popover.Trigger ref={ref} asChild>
            <button
              type="button"
              className={className}
              aria-label="Playback settings"
              onClick={(e) => e.stopPropagation()}
            >
              <SettingsIcon />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              className="bg-gray/50 w-60 rounded-md border border-white/50 p-3 shadow-md outline-none backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
              side="top"
              alignOffset={-70}
              align="end"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col gap-2">
                <p className="mb-1 text-sm font-medium text-white/90">
                  Settings
                </p>
                <Player.LiveIndicator
                  matcher={false}
                  className="flex flex-col gap-2"
                >
                  <label
                    className="text-xs font-medium text-white/90"
                    htmlFor="speedSelect"
                  >
                    Playback speed
                  </label>
                  <Player.RateSelect name="speedSelect">
                    <Player.SelectTrigger
                      className="inline-flex h-7 items-center justify-between gap-1 rounded-sm bg-gray-400 px-1 text-xs leading-none outline-none outline-1 outline-white/50"
                      aria-label="Playback speed"
                    >
                      <Player.SelectValue placeholder="Select a speed..." />
                      <Player.SelectIcon>
                        <ChevronDownIcon className="h-4 w-4" />
                      </Player.SelectIcon>
                    </Player.SelectTrigger>
                    <Player.SelectPortal>
                      <Player.SelectContent className="overflow-hidden rounded-sm bg-gray-400">
                        <Player.SelectViewport className="p-1">
                          <Player.SelectGroup className="">
                            <RateSelectItem value={0.5}>0.5x</RateSelectItem>
                            <RateSelectItem value={0.75}>0.75x</RateSelectItem>
                            <RateSelectItem value={1}>
                              1x (normal)
                            </RateSelectItem>
                            <RateSelectItem value={1.25}>1.25x</RateSelectItem>
                            <RateSelectItem value={1.5}>1.5x</RateSelectItem>
                            <RateSelectItem value={1.75}>1.75x</RateSelectItem>
                            <RateSelectItem value={2}>2x</RateSelectItem>
                          </Player.SelectGroup>
                        </Player.SelectViewport>
                      </Player.SelectContent>
                    </Player.SelectPortal>
                  </Player.RateSelect>
                </Player.LiveIndicator>
                <div className="flex flex-col gap-2">
                  <label
                    className="text-xs font-medium text-white/90"
                    htmlFor="qualitySelect"
                  >
                    Quality
                  </label>
                  <Player.VideoQualitySelect
                    name="qualitySelect"
                    defaultValue="1.0"
                  >
                    <Player.SelectTrigger
                      className="inline-flex h-7 items-center justify-between gap-1 rounded-sm  bg-gray-400 px-1 text-xs leading-none outline-none outline-1 outline-white/50"
                      aria-label="Playback quality"
                    >
                      <Player.SelectValue placeholder="Select a quality..." />
                      <Player.SelectIcon>
                        <ChevronDownIcon className="h-4 w-4" />
                      </Player.SelectIcon>
                    </Player.SelectTrigger>
                    <Player.SelectPortal>
                      <Player.SelectContent className="overflow-hidden rounded-sm bg-gray-400">
                        <Player.SelectViewport className="p-[5px]">
                          <Player.SelectGroup>
                            <VideoQualitySelectItem value="auto">
                              Auto (HD+)
                            </VideoQualitySelectItem>
                            <VideoQualitySelectItem value="1080p">
                              1080p (HD)
                            </VideoQualitySelectItem>
                            <VideoQualitySelectItem value="720p">
                              720p
                            </VideoQualitySelectItem>
                            <VideoQualitySelectItem value="480p">
                              480p
                            </VideoQualitySelectItem>
                            <VideoQualitySelectItem value="360p">
                              360p
                            </VideoQualitySelectItem>
                          </Player.SelectGroup>
                        </Player.SelectViewport>
                      </Player.SelectContent>
                    </Player.SelectPortal>
                  </Player.VideoQualitySelect>
                </div>
              </div>
              <Popover.Close
                className="absolute right-2.5 top-2.5 inline-flex h-5 w-5 items-center justify-center rounded-full outline-none"
                aria-label="Close"
              >
                <XIcon />
              </Popover.Close>
              <Popover.Arrow className="fill-white/50" />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      );
    },
  );
  Settings.displayName = 'Settings';

  const RateSelectItem = React.forwardRef<
    HTMLDivElement,
    Player.RateSelectItemProps
  >(({ children, className, ...props }, forwardedRef) => {
    return (
      <Player.RateSelectItem
        className={cn(
          'relative flex h-7 select-none items-center rounded-sm pl-[25px] pr-[35px] text-xs leading-none data-[disabled]:pointer-events-none data-[highlighted]:bg-white/20 data-[highlighted]:outline-none',
          className,
        )}
        {...props}
        ref={forwardedRef}
      >
        <Player.SelectItemText>{children}</Player.SelectItemText>
        <Player.SelectItemIndicator className="absolute left-0 inline-flex w-[25px] items-center justify-center">
          <CheckIcon className="h-4 w-4" />
        </Player.SelectItemIndicator>
      </Player.RateSelectItem>
    );
  });
  RateSelectItem.displayName = 'RateSelectItem';

  const VideoQualitySelectItem = React.forwardRef<
    HTMLDivElement,
    Player.VideoQualitySelectItemProps
  >(({ children, className, ...props }, forwardedRef) => {
    return (
      <Player.VideoQualitySelectItem
        className={cn(
          'relative flex h-7 select-none items-center rounded-sm pl-[25px] pr-[35px] text-xs leading-none data-[disabled]:pointer-events-none data-[highlighted]:bg-white/20 data-[highlighted]:outline-none',
          className,
        )}
        {...props}
        ref={forwardedRef}
      >
        <Player.SelectItemText>{children}</Player.SelectItemText>
        <Player.SelectItemIndicator className="absolute left-0 inline-flex w-[25px] items-center justify-center">
          <CheckIcon className="h-4 w-4" />
        </Player.SelectItemIndicator>
      </Player.VideoQualitySelectItem>
    );
  });
  VideoQualitySelectItem.displayName = 'VideoQualitySelectItem';

  if (!asset) {
    return (
      <PlayerLoading
        title="Invalid source"
        description="We could not fetch valid playback information for the playback ID you provided. Please check and try again."
      />
    );
  }

  return (
    <div>
      <h1 className="max-w-full whitespace-nowrap text-xl font-bold">
        {asset.name}
      </h1>
      {/* Render other asset details */}
      {playbackSources ? (
        <Player.Root src={playbackSources}>
          <Player.Container className="h-full w-full overflow-hidden bg-gray-800">
            <Player.Video title={asset?.name} className="h-full w-full" />
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
                    Playback will start automatically once the stream has
                    started
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
            <Player.Controls className="flex flex-col-reverse gap-1 bg-gradient-to-b from-black/5 via-black/30 via-80% to-black/60 px-3 py-2 duration-1000 data-[visible=true]:animate-in data-[visible=false]:animate-out data-[visible=false]:fade-out-0 data-[visible=true]:fade-in-0 md:px-3">
              <div className="flex justify-between gap-4">
                <div className="flex flex-1 items-center gap-3">
                  <Player.PlayPauseTrigger className="h-6 w-6 flex-shrink-0 transition hover:scale-110">
                    <Player.PlayingIndicator asChild matcher={false}>
                      <PlayIcon
                        className="h-full w-full"
                        style={{ color: '#EC407A' }}
                      />
                    </Player.PlayingIndicator>
                    <Player.PlayingIndicator asChild>
                      <PauseIcon
                        className="h-full w-full"
                        style={{ color: '#EC407A' }}
                      />
                    </Player.PlayingIndicator>
                  </Player.PlayPauseTrigger>

                  <Player.LiveIndicator className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-red-600" />
                    <span className="select-none text-sm">LIVE</span>
                  </Player.LiveIndicator>
                  <Player.LiveIndicator
                    matcher={false}
                    className="flex items-center gap-2"
                  >
                    <Player.Time className="select-none text-sm tabular-nums text-gray-300" />
                  </Player.LiveIndicator>

                  <Player.MuteTrigger className="h-6 w-6 flex-shrink-0 transition hover:scale-110">
                    <Player.VolumeIndicator asChild matcher={false}>
                      <MuteIcon
                        className="h-full w-full"
                        style={{ color: '#EC407A' }}
                      />
                    </Player.VolumeIndicator>
                    <Player.VolumeIndicator asChild matcher={true}>
                      <UnmuteIcon className="h-full w-full text-gray-300" />
                    </Player.VolumeIndicator>
                  </Player.MuteTrigger>
                  <Player.Volume className="group relative mr-1 flex h-5 max-w-[120px] flex-1 cursor-pointer touch-none select-none items-center">
                    <Player.Track className="relative h-[2px] grow rounded-full bg-white/30 transition group-hover:h-[3px] md:h-[3px] group-hover:md:h-[4px]">
                      <Player.Range className="absolute h-full rounded-full bg-gray-300" />
                    </Player.Track>
                    <Player.Thumb className="block h-3 w-3 rounded-full bg-white transition group-hover:scale-110" />
                  </Player.Volume>
                </div>
                <div className="flex items-center justify-end gap-2.5 sm:flex-1 md:flex-[1.5]">
                  <Player.FullscreenIndicator matcher={false} asChild>
                    <Settings className="h-6 w-6 flex-shrink-0 text-gray-300 transition" />
                  </Player.FullscreenIndicator>
                  {/* <Clip className="flex items-center w-6 h-6 justify-center" /> */}

                  <Player.PictureInPictureTrigger className="h-6 w-6 flex-shrink-0 transition hover:scale-110">
                    <PictureInPictureIcon
                      className="h-full w-full"
                      style={{ color: '#EE774D' }}
                    />
                  </Player.PictureInPictureTrigger>

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
                        style={{ color: '#FACB80' }}
                      />
                    </Player.FullscreenIndicator>
                  </Player.FullscreenTrigger>
                </div>
              </div>
              <Seek
                className="relative flex h-5 items-center "
                style={{ touchAction: 'none', userSelect: 'none' }}
              />
            </Player.Controls>
          </Player.Container>
        </Player.Root>
      ) : (
        <Skeleton className="h-96 w-full" />
      )}
    </div>
  );
}

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
