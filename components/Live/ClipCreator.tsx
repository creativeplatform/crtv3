"use client";
import { useCallback, useState } from "react";
import { useUser } from "@account-kit/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Scissors, Settings2 } from "lucide-react";

interface ClipCreatorProps {
  playbackId: string;
  sessionId: string;
  allowClipping?: boolean;
  parentStoryIpId?: string | null;
  parentCommercialRevShare?: number | null;
}

interface ClipState {
  playbackUrl: string;
  assetId: string;
  newPlaybackId: string;
  parentStoryIpId: string | null;
  parentCommercialRevShare: number | null;
  clipVideoAssetId?: number;
}

export function ClipCreator({
  playbackId,
  sessionId,
  allowClipping = true,
  parentStoryIpId,
  parentCommercialRevShare,
}: ClipCreatorProps) {
  const user = useUser();
  const clipperAddress = user?.address;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clip, setClip] = useState<ClipState | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [name, setName] = useState("");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [isMinting, setIsMinting] = useState(false);
  const [mintResult, setMintResult] = useState<{ ipId: string; txHash: string } | null>(null);

  const runClip = useCallback(
    async (startMs: number, endMs: number) => {
      if (!clipperAddress) {
        setError("Connect your wallet to create clips");
        return;
      }
      setIsLoading(true);
      setError(null);
      setClip(null);
      setMintResult(null);
      try {
        const res = await fetch("/api/livepeer/clips", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playbackId,
            sessionId,
            startTime: startMs,
            endTime: endMs,
            name: name.trim() || undefined,
            clipperAddress,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error || `Clip failed (${res.status})`);
          return;
        }

        const persistRes = await fetch("/api/video-assets/clips", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assetId: data.assetId,
            playbackId: data.newPlaybackId,
            playbackUrl: data.playbackUrl,
            name: name.trim() || undefined,
            parentPlaybackId: data.parentPlaybackId,
            parentStoryIpId: data.parentStoryIpId,
            clipStartMs: startMs,
            clipEndMs: endMs,
            clipperAddress,
          }),
        });
        const persist = await persistRes.json().catch(() => ({}));

        setClip({
          playbackUrl: data.playbackUrl,
          assetId: data.assetId,
          newPlaybackId: data.newPlaybackId,
          parentStoryIpId: data.parentStoryIpId ?? parentStoryIpId ?? null,
          parentCommercialRevShare:
            data.parentCommercialRevShare ?? parentCommercialRevShare ?? null,
          clipVideoAssetId: persist?.clip?.id,
        });
      } catch (e: any) {
        setError(e?.message || "Failed to create clip");
      } finally {
        setIsLoading(false);
      }
    },
    [clipperAddress, name, parentCommercialRevShare, parentStoryIpId, playbackId, sessionId]
  );

  const handleQuickClip = (durationSec: number) => {
    const now = Date.now();
    runClip(now - durationSec * 1000, now);
  };

  const handleCustomClip = () => {
    const start = Number(customStart);
    const end = Number(customEnd);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      setError("Enter valid start/end in ms with end > start");
      return;
    }
    runClip(start, end);
  };

  const handleMint = async () => {
    if (!clip?.clipVideoAssetId || !clipperAddress) return;
    setIsMinting(true);
    setError(null);
    try {
      const res = await fetch("/api/story/mint-derivative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clipVideoAssetId: clip.clipVideoAssetId,
          recipient: clipperAddress,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || `Mint failed (${res.status})`);
        return;
      }
      setMintResult({ ipId: data.ipId, txHash: data.txHash });
    } catch (e: any) {
      setError(e?.message || "Failed to mint clip");
    } finally {
      setIsMinting(false);
    }
  };

  if (!allowClipping) {
    return (
      <div className="w-full max-w-3xl mx-auto my-4 px-2">
        <Alert>
          <AlertTitle>Clipping disabled</AlertTitle>
          <AlertDescription>
            The broadcaster has disabled viewer clips on this stream.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!clipperAddress) {
    return (
      <div className="w-full max-w-3xl mx-auto my-4 px-2">
        <Alert>
          <AlertTitle>Connect to clip</AlertTitle>
          <AlertDescription>
            Connect your wallet to create clips from this stream.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const canMint = !!clip?.parentStoryIpId && !!clip?.clipVideoAssetId;

  return (
    <div className="w-full max-w-3xl mx-auto my-4 px-2 space-y-3">
      <div className="flex items-center gap-2">
        <Scissors className="h-4 w-4" />
        <span className="text-sm font-medium">Create a clip</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Clip name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 min-w-[200px]"
          maxLength={120}
        />
        <Button onClick={() => handleQuickClip(15)} disabled={isLoading} variant="outline">
          Last 15s
        </Button>
        <Button onClick={() => handleQuickClip(30)} disabled={isLoading} variant="outline">
          Last 30s
        </Button>
        <Button onClick={() => handleQuickClip(60)} disabled={isLoading} variant="outline">
          Last 60s
        </Button>
        <Button
          onClick={() => setCustomOpen((v) => !v)}
          variant="ghost"
          size="icon"
          aria-label="Toggle custom range"
        >
          <Settings2 className="h-4 w-4" />
        </Button>
      </div>

      {customOpen && (
        <div className="flex flex-col sm:flex-row gap-2 border rounded-md p-3 bg-muted/30">
          <Input
            placeholder="Start (epoch ms)"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            type="number"
            className="flex-1"
          />
          <Input
            placeholder="End (epoch ms)"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            type="number"
            className="flex-1"
          />
          <Button onClick={handleCustomClip} disabled={isLoading}>
            Clip range
          </Button>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Creating clip...
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {clip?.playbackUrl && (
        <Alert>
          <AlertTitle>Clip Created!</AlertTitle>
          <AlertDescription className="space-y-3">
            <video
              src={clip.playbackUrl}
              controls
              className="w-full max-w-sm rounded shadow"
              style={{ aspectRatio: "16/9" }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={handleMint}
                disabled={!canMint || isMinting}
                title={
                  !clip.parentStoryIpId
                    ? "Broadcaster hasn't registered this stream as IP yet."
                    : undefined
                }
              >
                {isMinting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Minting...
                  </>
                ) : (
                  "Mint as NFT"
                )}
              </Button>
              {clip.parentStoryIpId && clip.parentCommercialRevShare != null && (
                <span className="text-xs text-muted-foreground">
                  {clip.parentCommercialRevShare}% royalty to the creator.
                </span>
              )}
              {!clip.parentStoryIpId && (
                <span className="text-xs text-muted-foreground">
                  Broadcaster hasn&apos;t registered this stream as IP yet.
                </span>
              )}
            </div>
            {mintResult && (
              <div className="text-sm">
                Minted as Story IP:{" "}
                <span className="font-mono text-xs">{mintResult.ipId}</span>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
