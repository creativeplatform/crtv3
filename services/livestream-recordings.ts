"use server";

import {
  getLivepeerAsset,
  getStreamSessions,
  listRecentRecordingAssets,
  type LivepeerAssetSummary,
} from "@/lib/livepeer/studio-api";
import { getClipThumbnailUrl } from "@/services/livepeer-clips";
import { getStreamByStreamId } from "@/services/streams";
import { createLivestreamVideoAsset } from "@/services/video-assets";
import { serverLogger } from "@/lib/utils/logger";

function isRecordingAsset(asset: LivepeerAssetSummary): boolean {
  return asset.source?.type === "recording";
}

async function resolveThumbnail(
  playbackId: string,
  streamThumbnail?: string | null
): Promise<string | null> {
  const fromAsset = await getClipThumbnailUrl(playbackId);
  return fromAsset ?? streamThumbnail ?? null;
}

export async function persistRecordingAsset(
  asset: LivepeerAssetSummary,
  options?: { streamId?: string }
) {
  if (!isRecordingAsset(asset)) return null;
  if (!asset.id || !asset.playbackId) return null;
  if (asset.status?.phase && asset.status.phase !== "ready") return null;

  const streamId = options?.streamId ?? asset.source?.streamId;
  if (!streamId) {
    serverLogger.warn("Recording asset missing streamId", { assetId: asset.id });
    return null;
  }

  const stream = await getStreamByStreamId(streamId);
  if (!stream) {
    serverLogger.warn("No stream row for recording asset", { streamId, assetId: asset.id });
    return null;
  }

  if (stream.save_recording === false) {
    serverLogger.debug("Skipping recording persistence because save_recording is false", {
      streamId,
      assetId: asset.id,
    });
    return null;
  }

  const thumbnailUrl = await resolveThumbnail(asset.playbackId, stream.thumbnail_url);
  const durationSec =
    asset.videoSpec?.duration != null
      ? Math.round(asset.videoSpec.duration)
      : null;

  return createLivestreamVideoAsset({
    assetId: asset.id,
    playbackId: asset.playbackId,
    creatorId: stream.creator_id,
    parentPlaybackId: stream.playback_id,
    title: asset.name ?? stream.name ?? null,
    thumbnailUrl,
    durationSec,
    sessionId: asset.source?.sessionId ?? null,
  });
}

async function findRecordingAssetForSession(
  streamId: string,
  sessionId: string
): Promise<LivepeerAssetSummary | null> {
  const direct = await getLivepeerAsset(sessionId);
  if (direct && isRecordingAsset(direct) && direct.status?.phase === "ready") {
    return direct;
  }

  const recent = await listRecentRecordingAssets(30);
  return (
    recent.find(
      (asset) =>
        asset.source?.sessionId === sessionId &&
        asset.source?.streamId === streamId &&
        asset.status?.phase === "ready"
    ) ?? null
  );
}

/**
 * Best-effort: after a broadcast ends, persist any ready session recordings
 * that do not yet have a video_assets row.
 */
export async function finalizeStreamRecordings(streamId: string) {
  const stream = await getStreamByStreamId(streamId);
  if (!stream) {
    return { created: 0, skipped: 0, error: "Stream not found" };
  }

  if (stream.save_recording === false) {
    return { created: 0, skipped: 0, ignored: true };
  }

  const sessions = await getStreamSessions(streamId, { record: true });
  const readySessions = sessions.filter((s) => s.recordingStatus === "ready");

  let created = 0;
  let skipped = 0;

  for (const session of readySessions) {
    try {
      let asset = await findRecordingAssetForSession(streamId, session.id);

      if (!asset && session.id) {
        asset = await getLivepeerAsset(session.id);
      }

      if (!asset || !isRecordingAsset(asset)) {
        skipped += 1;
        continue;
      }

      const row = await persistRecordingAsset(asset, { streamId });
      if (row) created += 1;
      else skipped += 1;
    } catch (err) {
      serverLogger.error("Failed to finalize session recording", {
        streamId,
        sessionId: session.id,
        err,
      });
      skipped += 1;
    }
  }

  return { created, skipped };
}
