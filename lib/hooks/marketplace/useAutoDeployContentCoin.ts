import { useContentCoin } from '@/lib/hooks/marketplace/useContentCoin';
import { updateVideoAsset } from '@/services/video-assets';
import { fetchVideoAssetByPlaybackId } from '@/lib/utils/video-assets-client';
import { logger } from '@/lib/utils/logger';


/**
 * Hook wrapper around deployment to be used in upload forms.
 * Can be integrated into the VideoUpload component's "onSuccess" callback.
 */
export function useAutoDeployContentCoin() {
    const { deployContentCoin } = useContentCoin();

    const handleUploadSuccess = async (videoTitle: string, symbol: string, creatorMeToken: string, creatorAddress: string, playbackId?: string) => {
        try {
            logger.debug("Auto-deploying Content Coin for:", videoTitle);

            // Add a timeout race for the deployment promise
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Content coin deployment timed out")), 12000)
            );

            const deployTx = await Promise.race([
                deployContentCoin(videoTitle, symbol, creatorMeToken, creatorAddress),
                timeoutPromise
            ]);

            logger.debug("Content Coin Deployment Initiated:", deployTx);

            if (playbackId && typeof deployTx === 'string') {
                // Fetch the video asset ID first
                const videoAsset = await fetchVideoAssetByPlaybackId(playbackId);

                if (videoAsset && videoAsset.id) {
                    logger.debug("Saving Content Coin ID to video asset:", videoAsset.id);
                    // Use server action to update the asset
                    await updateVideoAsset(videoAsset.id, {
                        thumbnailUri: videoAsset.thumbnail_url || '',
                        status: videoAsset.status || 'draft',
                        attributes: {
                            content_coin_id: deployTx
                        }
                    });
                    logger.debug("Content Coin ID saved successfully");
                }
            }

            return deployTx;
        } catch (e: any) {
            logger.error("Auto-deploy failed:", e);

            if (e.message === "Content coin deployment timed out") {
                logger.warn("Continuing despite deployment timeout");
                return null;
            }
            // Don't block upload success UI — deployContentCoin already soft-toasts
            return null;
        }
    };

    return { handleUploadSuccess };
}
