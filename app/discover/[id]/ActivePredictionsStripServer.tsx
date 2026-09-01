import { ActivePredictionsStrip } from "@/components/Videos/ActivePredictionsStrip";
import { getVideoPredictionLinks } from "@/lib/predictions/video-prediction-links";
import type { PredictionStripItem } from "@/components/Videos/ActivePredictionsStrip";

interface ActivePredictionsStripServerProps {
  videoAssetId: string;
}

/**
 * Server-side wrapper for the video-page predictions strip.
 *
 * Calls getVideoPredictionLinks() directly instead of self-fetching
 * /api/predictions/by-video over HTTP — the route sits behind BotID deep
 * analysis (Kasada), which 403s server-to-server requests with no browser
 * headers; the old self-fetch would have made the strip silently empty.
 */
export async function ActivePredictionsStripServer({
  videoAssetId,
}: ActivePredictionsStripServerProps) {
  const result = await getVideoPredictionLinks(videoAssetId);

  const linkedPredictions: PredictionStripItem[] =
    result.ok ? result.predictions : [];

  return (
    <ActivePredictionsStrip
      videoAssetId={videoAssetId}
      linkedPredictions={linkedPredictions}
    />
  );
}