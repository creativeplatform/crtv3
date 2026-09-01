"use client";

import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { updateVideoAsset } from "@/services/video-assets";
import type { VideoAsset } from "@/lib/types/video-asset";
import { Loader2, X, RefreshCw, Link as LinkIcon } from "lucide-react";
import { compressImage } from "@/lib/utils/image-compression";
import { uploadThumbnailToIPFS } from "@/lib/services/thumbnail-upload";
import { convertFailingGateway, parseIpfsUriWithFallback } from "@/lib/utils/image-gateway";
import { GatewayImage } from "@/components/ui/gateway-image";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { regenerateThumbnailFromLivepeer } from "@/lib/utils/thumbnail-regeneration";
import { logger } from '@/lib/utils/logger';
import { VIDEO_GENRES, getVideoGenreLabel } from "@/lib/constants/video-genres";


interface VideoEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoAsset: VideoAsset;
  onSuccess?: () => void;
}

interface VideoEditFormData {
  title: string;
  description: string;
  category: string;
  location: string;
}

export function VideoEditDialog({
  open,
  onOpenChange,
  videoAsset,
  onSuccess,
}: VideoEditDialogProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [newThumbnailUrl, setNewThumbnailUrl] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [manualThumbnailUrl, setManualThumbnailUrl] = useState<string>("");
  const [manualUrlError, setManualUrlError] = useState<string>("");
  const [thumbnailTab, setThumbnailTab] = useState<"upload" | "regenerate" | "manual">("upload");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const blobUrlRef = useRef<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<VideoEditFormData>({
    defaultValues: {
      title: videoAsset.title || "",
      description: videoAsset.description || "",
      category: videoAsset.category || "",
      location: videoAsset.location || "",
    },
  });

  const categoryValue = watch("category");

  // Reset form when dialog opens or video identity changes (not every object refresh)
  useEffect(() => {
    if (!open || !videoAsset) return;
    reset({
      title: videoAsset.title || "",
      description: videoAsset.description || "",
      category: videoAsset.category || "",
      location: videoAsset.location || "",
    });
    setThumbnailFile(null);
    setNewThumbnailUrl(null);
    setUploadProgress(0);
    setIsRegenerating(false);
    setManualThumbnailUrl("");
    setManualUrlError("");
    setThumbnailTab("upload");
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setThumbnailPreview(null);
  }, [open, videoAsset?.id, reset]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, []);

  const handleThumbnailSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        variant: "destructive",
        title: "Invalid File",
        description: "Please select an image file.",
      });
      return;
    }

    setThumbnailFile(file);
    setIsUploadingThumbnail(true);
    setUploadProgress(0);

    try {
      // Compress image
      setUploadProgress(10);
      const compressionResult = await compressImage(file, {
        maxSizeMB: 5,
        maxWidth: 1920,
        maxHeight: 1080,
        quality: 0.8,
        outputFormat: 'image/jpeg',
      });

      if (!compressionResult.success) {
        toast({
          variant: "destructive",
          title: "Compression Failed",
          description: compressionResult.error || "Failed to compress image.",
        });
        setThumbnailFile(null);
        setIsUploadingThumbnail(false);
        return;
      }

      // Create preview
      const compressedFile = compressionResult.file!;
      const previewUrl = URL.createObjectURL(compressedFile);
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
      blobUrlRef.current = previewUrl;
      setThumbnailPreview(previewUrl);
      setUploadProgress(30);

      // Upload to IPFS
      setUploadProgress(50);
      const result = await uploadThumbnailToIPFS(compressedFile, videoAsset.asset_id || 'unknown');
      setUploadProgress(100);

      if (result.success && result.thumbnailUrl) {
        // Convert ipfs:// protocol to gateway URL
        const ipfsUrl = convertFailingGateway(result.thumbnailUrl);
        const finalUrl = ipfsUrl.startsWith('ipfs://')
          ? parseIpfsUriWithFallback(ipfsUrl, 0)
          : ipfsUrl;

        setNewThumbnailUrl(finalUrl);

        // Keep blob preview while uploading finishes; prefer IPFS URL in UI via
        // pendingPreview. Revoke blob to free memory but leave newThumbnailUrl set.
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = null;
        }
        setThumbnailPreview(null);

        toast({
          title: "Thumbnail Uploaded",
          description: "Thumbnail has been uploaded successfully. Save changes to apply it.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Upload Failed",
          description: result.error || "Failed to upload thumbnail.",
        });
        setThumbnailFile(null);
        setThumbnailPreview(null);
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = null;
        }
      }
    } catch (error) {
      logger.error("Error processing thumbnail:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to process thumbnail. Please try again.",
      });
      setThumbnailFile(null);
      setThumbnailPreview(null);
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    } finally {
      setIsUploadingThumbnail(false);
      setUploadProgress(0);
    }
  };

  const handleThumbnailRemove = () => {
    setThumbnailFile(null);
    setNewThumbnailUrl(null);
    setThumbnailPreview(null);
    setManualThumbnailUrl("");
    setManualUrlError("");
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRegenerateThumbnail = async () => {
    if (!videoAsset.playback_id) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Video does not have a playback ID.",
      });
      return;
    }

    setIsRegenerating(true);
    setUploadProgress(0);

    try {
      setUploadProgress(20);
      const result = await regenerateThumbnailFromLivepeer(
        videoAsset.playback_id,
        videoAsset.asset_id
      );

      setUploadProgress(80);

      if (result.success && result.thumbnailUrl) {
        setNewThumbnailUrl(result.thumbnailUrl);
        setUploadProgress(100);

        toast({
          title: "Thumbnail Regenerated",
          description: "Thumbnail has been successfully regenerated from Livepeer.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Regeneration Failed",
          description: result.error || "Failed to regenerate thumbnail. The video may not have Livepeer VTT thumbnails available.",
        });
      }
    } catch (error) {
      logger.error("Error regenerating thumbnail:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to regenerate thumbnail. Please try again.",
      });
    } finally {
      setIsRegenerating(false);
      setUploadProgress(0);
    }
  };

  const handleManualUrlChange = (url: string) => {
    setManualThumbnailUrl(url);
    setManualUrlError("");

    // Basic URL validation
    if (url.trim() === "") {
      setManualUrlError("");
      setNewThumbnailUrl(null);
      return;
    }

    try {
      new URL(url);
      setNewThumbnailUrl(url);
      setManualUrlError("");
    } catch (error) {
      setManualUrlError("Please enter a valid URL");
      setNewThumbnailUrl(null);
    }
  };

  const onSubmit = async (data: VideoEditFormData) => {
    setIsSaving(true);
    try {
      const updateData: {
        title: string;
        description: string | null;
        category: string;
        location: string;
        thumbnailUri?: string;
      } = {
        title: data.title.trim(),
        description: data.description.trim() || null,
        category: data.category.trim() || "",
        location: data.location.trim() || "",
      };

      // Include thumbnail URL if a new one was set (uploaded, regenerated, or manual)
      if (newThumbnailUrl) {
        updateData.thumbnailUri = newThumbnailUrl;
      }

      await updateVideoAsset(videoAsset.id, updateData);

      toast({
        title: "Video Updated",
        description: newThumbnailUrl
          ? "Your video and thumbnail have been updated successfully."
          : "Your video has been updated successfully.",
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      logger.error("Error updating video:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to update video. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Video</DialogTitle>
          <DialogDescription>
            Update your video details. Changes will be saved immediately.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                placeholder="Enter video title"
                {...register("title", {
                  required: "Title is required",
                  minLength: {
                    value: 1,
                    message: "Title must be at least 1 character",
                  },
                  maxLength: {
                    value: 200,
                    message: "Title must be less than 200 characters",
                  },
                })}
              />
              {errors.title && (
                <p className="text-sm text-destructive">{errors.title.message}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Enter video description"
                rows={4}
                {...register("description", {
                  maxLength: {
                    value: 5000,
                    message: "Description must be less than 5000 characters",
                  },
                })}
              />
              {errors.description && (
                <p className="text-sm text-destructive">
                  {errors.description.message}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="category">Genre</Label>
              <Select
                value={categoryValue}
                onValueChange={(value) => setValue("category", value)}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select a Genre" />
                </SelectTrigger>
                <SelectContent>
                  {VIDEO_GENRES.map((genre) => (
                    <SelectItem key={genre.value} value={genre.value}>
                      {getVideoGenreLabel(genre.value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                placeholder="Enter location (optional)"
                {...register("location", {
                  maxLength: {
                    value: 100,
                    message: "Location must be less than 100 characters",
                  },
                })}
              />
              {errors.location && (
                <p className="text-sm text-destructive">
                  {errors.location.message}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="thumbnail">Thumbnail</Label>
              <div className="space-y-4">
                {/* Pending / current thumbnail preview */}
                {(thumbnailPreview || newThumbnailUrl || (videoAsset as any).thumbnail_url) && (
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">
                      {thumbnailPreview || newThumbnailUrl
                        ? "New thumbnail (pending save)"
                        : "Current Thumbnail"}
                    </Label>
                    <div className="relative aspect-video w-full max-w-md rounded-lg overflow-hidden border">
                      {thumbnailPreview?.startsWith("blob:") ? (
                        <img
                          src={thumbnailPreview}
                          alt="Thumbnail preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <GatewayImage
                          src={
                            thumbnailPreview ||
                            newThumbnailUrl ||
                            (videoAsset as any).thumbnail_url
                          }
                          alt={
                            thumbnailPreview || newThumbnailUrl
                              ? "New thumbnail pending save"
                              : "Current thumbnail"
                          }
                          fill
                          className="object-cover"
                          showSkeleton={true}
                          fallbackSrc="/Creative_TV.png"
                        />
                      )}
                    </div>
                    {(thumbnailPreview || newThumbnailUrl) && (
                      <p className="text-xs text-muted-foreground">
                        Click Save changes to apply this thumbnail.
                      </p>
                    )}
                  </div>
                )}

                {/* Thumbnail Update Options Tabs */}
                <Tabs value={thumbnailTab} onValueChange={(value) => setThumbnailTab(value as "upload" | "regenerate" | "manual")}>
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="upload">Upload</TabsTrigger>
                    <TabsTrigger value="regenerate">Regenerate</TabsTrigger>
                    <TabsTrigger value="manual">Manual URL</TabsTrigger>
                  </TabsList>

                  {/* Upload Tab */}
                  <TabsContent value="upload" className="space-y-2">
                    {(thumbnailPreview || newThumbnailUrl) && (
                      <div className="flex items-center justify-between">
                        <Label className="text-sm text-muted-foreground">
                          {isUploadingThumbnail ? "Uploading…" : "Ready to save"}
                        </Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleThumbnailRemove}
                          className="h-8 w-8 p-0"
                          disabled={isUploadingThumbnail}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    <Input
                      id="thumbnail"
                      type="file"
                      accept="image/*"
                      ref={fileInputRef}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleThumbnailSelect(file);
                        }
                      }}
                      disabled={isUploadingThumbnail || isRegenerating}
                      className="cursor-pointer"
                    />
                    {isUploadingThumbnail && (
                      <div className="space-y-2">
                        <Progress value={uploadProgress} className="w-full" />
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Processing thumbnail...</span>
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Upload a new thumbnail image (JPG, PNG, or WebP). Max 5MB.
                    </p>
                  </TabsContent>

                  {/* Regenerate Tab */}
                  <TabsContent value="regenerate" className="space-y-2">
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Regenerate thumbnail from Livepeer VTT. This will fetch the thumbnail from Livepeer, upload it to IPFS, and update your video.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleRegenerateThumbnail}
                        disabled={isRegenerating || isUploadingThumbnail || !videoAsset.playback_id}
                        className="w-full"
                      >
                        {isRegenerating ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Regenerating...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Regenerate from Livepeer
                          </>
                        )}
                      </Button>
                      {isRegenerating && (
                        <div className="space-y-2">
                          <Progress value={uploadProgress} className="w-full" />
                          <p className="text-xs text-muted-foreground">Regenerating thumbnail...</p>
                        </div>
                      )}
                      {newThumbnailUrl && thumbnailTab === "regenerate" && (
                        <div className="space-y-2">
                          <Label className="text-sm text-muted-foreground">Regenerated Thumbnail</Label>
                          <div className="relative aspect-video w-full max-w-md rounded-lg overflow-hidden border">
                            <GatewayImage
                              src={newThumbnailUrl}
                              alt="Regenerated thumbnail"
                              fill
                              className="object-cover"
                              showSkeleton={true}
                              fallbackSrc="/Creative_TV.png"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  {/* Manual URL Tab */}
                  <TabsContent value="manual" className="space-y-2">
                    <div className="space-y-2">
                      <Label htmlFor="manual-thumbnail-url">Thumbnail URL</Label>
                      <div className="flex gap-2">
                        <Input
                          id="manual-thumbnail-url"
                          type="url"
                          placeholder="https://example.com/thumbnail.jpg"
                          value={manualThumbnailUrl}
                          onChange={(e) => handleManualUrlChange(e.target.value)}
                          disabled={isUploadingThumbnail || isRegenerating}
                          className={manualUrlError ? "border-destructive" : ""}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={handleThumbnailRemove}
                          disabled={!manualThumbnailUrl}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      {manualUrlError && (
                        <p className="text-sm text-destructive">{manualUrlError}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Enter a direct URL to an image file (JPG, PNG, or WebP).
                      </p>
                      {newThumbnailUrl && thumbnailTab === "manual" && manualThumbnailUrl && (
                        <div className="space-y-2">
                          <Label className="text-sm text-muted-foreground">Preview</Label>
                          <div className="relative aspect-video w-full max-w-md rounded-lg overflow-hidden border">
                            <GatewayImage
                              src={newThumbnailUrl}
                              alt="Manual thumbnail"
                              fill
                              className="object-cover"
                              showSkeleton={true}
                              fallbackSrc="/Creative_TV.png"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving || isUploadingThumbnail || isRegenerating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || isUploadingThumbnail || isRegenerating}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

