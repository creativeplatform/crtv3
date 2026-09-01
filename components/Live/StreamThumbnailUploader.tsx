"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { uploadThumbnailToIPFS } from "@/lib/services/thumbnail-upload";
import { updateStream } from "@/services/streams";
import { useWalletAuth } from "@/lib/auth/useWalletAuth";
import { walletAuthHeadersToArgs } from "@/lib/auth/require-wallet";
import { logger } from "@/lib/utils/logger";
import { LivestreamThumbnail } from "./LivestreamThumbnail";

interface StreamThumbnailUploaderProps {
    creatorAddress: string;
    playbackId: string;
    currentThumbnailUrl?: string | null;
    onThumbnailUpdated: (url: string) => void;
}

export function StreamThumbnailUploader({
    creatorAddress,
    playbackId,
    currentThumbnailUrl,
    onThumbnailUpdated
}: StreamThumbnailUploaderProps) {
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { getAuthHeaders } = useWalletAuth();

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error("Please select an image file");
            return;
        }

        try {
            setIsUploading(true);
            toast.info("Uploading thumbnail...");

            // 1. Upload to IPFS/Grove
            const result = await uploadThumbnailToIPFS(file, playbackId);

            if (!result.success || !result.thumbnailUrl) {
                throw new Error(result.error || "Upload failed");
            }

            const newThumbnailUrl = result.thumbnailUrl;

            // 2. Update Stream Record
            const auth = walletAuthHeadersToArgs(await getAuthHeaders());
            await updateStream(
                creatorAddress,
                { thumbnail_url: newThumbnailUrl },
                auth,
            );

            // 3. Update UI
            onThumbnailUpdated(newThumbnailUrl);
            toast.success("Thumbnail updated successfully!");

            // Cleanup
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }

        } catch (error) {
            logger.error("Error updating thumbnail:", error);
            toast.error("Failed to update thumbnail. Please try again.");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="flex flex-col items-center gap-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800/50">
            <h3 className="font-semibold flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                Stream Thumbnail
            </h3>

            {currentThumbnailUrl ? (
                <div className="relative w-full max-w-xs aspect-video rounded-md overflow-hidden bg-black">
                    <LivestreamThumbnail thumbnailUrl={currentThumbnailUrl} />
                </div>
            ) : (
                <div className="w-full max-w-xs aspect-video rounded-md bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-400">
                    <span className="text-sm">No thumbnail</span>
                </div>
            )}

            <div className="flex gap-2">
                <input
                    id="stream-thumbnail-upload"
                    name="streamThumbnail"
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                />
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                >
                    {isUploading ? (
                        <>
                            <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                            Uploading...
                        </>
                    ) : (
                        <>
                            <Upload className="w-3 h-3 mr-2" />
                            {currentThumbnailUrl ? "Change Thumbnail" : "Upload Thumbnail"}
                        </>
                    )}
                </Button>
            </div>
            <p className="text-xs text-gray-500 text-center max-w-xs">
                This image will act as the poster for your stream when you aren't live, or before the video loads.
            </p>
        </div>
    );
}
