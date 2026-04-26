"use client";
import { cn } from "@/lib/utils";
import * as React from "react";
import { useRef, useEffect, useState } from "react";
import { useBroadcast } from "@/hooks/useBroadcast";
import { toast } from "sonner";
import * as Popover from "@radix-ui/react-popover";
import {
  CheckIcon,
  ChevronDownIcon,
  XIcon,
  CopyIcon,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Settings as SettingsIcon,
  MonitorUp,
  MonitorOff,
  Maximize,
  Minimize,
  Loader2,
  Square,
  Radio,
} from "lucide-react";

import { logger } from '@/lib/utils/logger';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateStream } from "@/services/streams";

interface BroadcastProps {
  streamKey: string;
  streamId?: string | null;
  creatorAddress: string;
}

export interface StreamProfile {
  name: string;
  width: number;
  height: number;
  bitrate: number;
  fps: number;
  fpsDen: number;
  quality: number;
  gop: string;
  profile: string;
}

export interface CreateStreamProxyParams {
  name: string;
  profiles: StreamProfile[];
  record: boolean;
  playbackPolicy: any;
  multistream?: any;
}

export async function createStreamViaProxy(params: CreateStreamProxyParams) {
  const { name, profiles, record, playbackPolicy, multistream } = params;
  const body: any = {
    name,
    profiles,
    record,
    playbackPolicy,
  };
  if (multistream !== undefined) {
    body.multistream = multistream;
  }
  const res = await fetch("/api/livepeer/livepeer-proxy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to create stream");
  return res.json();
}

function BroadcastWithControls({ streamKey, streamId: propStreamId, creatorAddress }: BroadcastProps) {
  const ingestUrl = React.useMemo(() => {
    return `https://ingest.livepeer.studio/whip/${streamKey}`;
  }, [streamKey]);

  const {
    status,
    startBroadcast,
    stopBroadcast,
    videoRef,
    toggleAudio,
    toggleVideo,
    isAudioEnabled,
    isVideoEnabled,
    devices,
    selectedAudioDeviceId,
    selectedVideoDeviceId,
    changeAudioDevice,
    changeVideoDevice,
    error: broadcastError,
    isScreenSharing,
    toggleScreenShare
  } = useBroadcast({ ingestUrl, streamKey });

  useEffect(() => {
    if (broadcastError) {
      toast.error(broadcastError);
    }
  }, [broadcastError]);

  // Sync is_live status with DB
  useEffect(() => {
    if (!creatorAddress) return;

    const syncStatus = async () => {
      try {
        if (status === 'live') {
          await updateStream(creatorAddress, { is_live: true, last_live_at: new Date().toISOString() });
          logger.info("Stream marked as live in DB");
        } else if (status === 'idle' || status === 'error') {
          await updateStream(creatorAddress, { is_live: false });
          logger.info("Stream marked as offline in DB");
        }
      } catch (err) {
        logger.error("Failed to sync stream status:", err);
      }
    };

    syncStatus();
  }, [status, creatorAddress]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  return (
    <div className="mx-auto max-w-[576px]">
      <div
        ref={containerRef}
        className="group relative h-full w-full overflow-hidden rounded-sm bg-gray-950 aspect-video flex flex-col"
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="h-full w-full object-contain bg-black"
        />

        {/* Loading / Status Overlay */}
        {(status === 'loading' || status === 'error') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm z-10">
            {status === 'loading' && <Loader2 className="h-10 w-10 animate-spin text-white mb-2" />}
            {status === 'error' && (
              <div className="text-center px-4">
                <div className="text-red-500 font-bold mb-1">Broadcast Error</div>
                <div className="text-white text-sm">{broadcastError}</div>
              </div>
            )}
          </div>
        )}

        {/* Status Badge */}
        <div className="absolute left-2 top-2 z-20 flex items-center gap-2">
          <div className={cn(
            "flex items-center gap-2 rounded-full px-2 py-1 backdrop-blur-md",
            status === 'live' ? "bg-red-500/90" : "bg-black/50"
          )}>
            <div className={cn(
              "h-2 w-2 rounded-full",
              status === 'live' ? "bg-white animate-pulse" : "bg-gray-400"
            )} />
            <span className="text-xs font-medium text-white uppercase">
              {status === 'live' ? 'Live' : status.toUpperCase()}
            </span>
          </div>
          {isScreenSharing && (
            <div className="flex items-center gap-1 rounded-full px-2 py-1 backdrop-blur-md bg-green-500/80">
              <MonitorUp size={12} className="text-white" />
              <span className="text-xs font-medium text-white">Screen</span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className={cn(
          "absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300 z-20",
          status !== 'idle' && "opacity-0 group-hover:opacity-100"
        )}>
          <div className="flex items-center justify-between gap-4">

            {/* Left Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleVideo}
                className="p-2 rounded-full hover:bg-white/10 text-white transition-colors"
                title={isVideoEnabled ? "Disable Video" : "Enable Video"}
              >
                {isVideoEnabled ? <Video size={20} /> : <VideoOff size={20} className="text-red-500" />}
              </button>
              <button
                onClick={toggleAudio}
                className="p-2 rounded-full hover:bg-white/10 text-white transition-colors"
                title={isAudioEnabled ? "Mute Mic" : "Unmute Mic"}
              >
                {isAudioEnabled ? <Mic size={20} /> : <MicOff size={20} className="text-red-500" />}
              </button>
              <button
                onClick={toggleScreenShare}
                className="p-2 rounded-full hover:bg-white/10 text-white transition-colors"
                title={isScreenSharing ? "Stop Screen Share" : "Share Screen"}
              >
                {isScreenSharing ? <MonitorOff size={20} className="text-green-500" /> : <MonitorUp size={20} />}
              </button>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-2">
              <Settings
                streamId={propStreamId || ""}
                streamKey={streamKey}
                ingestUrl={ingestUrl}
                devices={devices}
                selectedAudioDeviceId={selectedAudioDeviceId}
                selectedVideoDeviceId={selectedVideoDeviceId}
                onAudioDeviceChange={changeAudioDevice}
                onVideoDeviceChange={changeVideoDevice}
              />

              <button
                onClick={toggleFullscreen}
                className="p-2 rounded-full hover:bg-white/10 text-white transition-colors"
              >
                {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
              </button>

              {status === 'live' ? (
                <button
                  onClick={stopBroadcast}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md font-medium text-sm transition-colors"
                >
                  <Square size={16} fill="currentColor" />
                  Stop
                </button>
              ) : (
                <button
                  onClick={startBroadcast}
                  disabled={status === 'loading'}
                  className="flex items-center gap-2 bg-white hover:bg-gray-100 text-black px-4 py-2 rounded-md font-medium text-sm transition-colors disabled:opacity-50"
                >
                  <Radio size={16} className={status === 'loading' ? 'animate-spin' : ''} />
                  Go Live
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const BroadcastLoading = ({
  title,
  description,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
}) => (
  <div className="relative flex aspect-video w-full flex-col-reverse gap-2 overflow-hidden rounded-sm bg-white/10 px-2 py-2">
    <div className="flex justify-between">
      <div className="flex items-center gap-1.5">
        <div className="h-5 w-5 animate-pulse overflow-hidden rounded-lg bg-white/5" />
        <div className="h-5 w-14 animate-pulse overflow-hidden rounded-lg bg-white/5" />
      </div>
      <div className="flex items-center gap-1.5">
        <div className="h-5 w-5 animate-pulse overflow-hidden rounded-lg bg-white/5" />
        <div className="h-5 w-5 animate-pulse overflow-hidden rounded-lg bg-white/5" />
      </div>
    </div>
    <div className="h-1.5 w-full animate-pulse overflow-hidden rounded-lg bg-white/5" />
    {title && (
      <div className="absolute inset-8 flex flex-col items-center justify-center gap-1 text-center">
        <span className="text-base font-medium text-white">{title}</span>
        {description && (
          <span className="text-xs text-white">{description}</span>
        )}
      </div>
    )}
  </div>
);

interface SettingsProps {
  streamId: string;
  streamKey?: string | null;
  ingestUrl?: string | null;
  devices: MediaDeviceInfo[];
  selectedAudioDeviceId: string;
  selectedVideoDeviceId: string;
  onAudioDeviceChange: (id: string) => void;
  onVideoDeviceChange: (id: string) => void;
}

const Settings = ({
  streamId,
  streamKey,
  ingestUrl,
  devices,
  selectedAudioDeviceId,
  selectedVideoDeviceId,
  onAudioDeviceChange,
  onVideoDeviceChange
}: SettingsProps) => {

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard!`);
    } catch (err) {
      logger.error("Failed to copy:", err);
      toast.error("Failed to copy to clipboard");
    }
  };

  const rtmpServerUrl = ingestUrl && streamKey
    ? ingestUrl.replace(streamKey, '').replace(/\/$/, '') + '/'
    : ingestUrl
      ? ingestUrl.split('/').slice(0, -1).join('/') + '/'
      : null;

  // Filter devices
  const audioDevices = devices.filter(d => d.kind === 'audioinput');
  const videoDevices = devices.filter(d => d.kind === 'videoinput');

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="p-2 rounded-full hover:bg-white/10 text-white transition-colors"
          aria-label="Stream settings"
        >
          <SettingsIcon size={20} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="w-80 rounded-md border border-white/20 bg-gray-900/95 p-4 shadow-xl backdrop-blur-md text-white z-50"
          side="top"
          align="end"
          sideOffset={5}
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Settings</h4>
              <Popover.Close className="rounded-full p-1 hover:bg-white/10">
                <XIcon size={16} />
              </Popover.Close>
            </div>

            {/* Device Selection */}
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-gray-400">Camera</label>
                <Select value={selectedVideoDeviceId} onValueChange={onVideoDeviceChange}>
                  <SelectTrigger className="w-full bg-black/40 border-white/10 h-8 text-xs">
                    <SelectValue placeholder="Select Camera" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-white/10 text-white">
                    {videoDevices.map(device => (
                      <SelectItem key={device.deviceId} value={device.deviceId} className="text-xs hover:bg-white/10 focus:bg-white/10">
                        {device.label || `Camera ${device.deviceId.slice(0, 5)}...`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-400">Microphone</label>
                <Select value={selectedAudioDeviceId} onValueChange={onAudioDeviceChange}>
                  <SelectTrigger className="w-full bg-black/40 border-white/10 h-8 text-xs">
                    <SelectValue placeholder="Select Microphone" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-white/10 text-white">
                    {audioDevices.map(device => (
                      <SelectItem key={device.deviceId} value={device.deviceId} className="text-xs hover:bg-white/10 focus:bg-white/10">
                        {device.label || `Mic ${device.deviceId.slice(0, 5)}...`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Stream Info Section */}
            {streamKey && rtmpServerUrl && (
              <div className="rounded-md border border-white/10 bg-black/20 p-3 space-y-2">
                <p className="text-xs font-semibold text-gray-300">
                  OBS / RTMP Info
                </p>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase">Server URL</label>
                    <div className="flex gap-1">
                      <input
                        readOnly
                        value={rtmpServerUrl}
                        className="flex-1 bg-black/40 border border-white/10 rounded px-2 py-1 text-[10px] font-mono text-gray-300"
                      />
                      <button onClick={() => copyToClipboard(rtmpServerUrl, "Server URL")} className="p-1 hover:bg-white/10 rounded">
                        <CopyIcon size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase">Stream Key</label>
                    <div className="flex gap-1">
                      <input
                        readOnly
                        value={streamKey}
                        type="password"
                        className="flex-1 bg-black/40 border border-white/10 rounded px-2 py-1 text-[10px] font-mono text-gray-300"
                      />
                      <button onClick={() => copyToClipboard(streamKey, "Stream Key")} className="p-1 hover:bg-white/10 rounded">
                        <CopyIcon size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <Popover.Arrow className="fill-gray-900 stroke-white/20" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};

export { BroadcastWithControls as Broadcast };
export default BroadcastWithControls;
