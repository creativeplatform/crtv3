import React, { useState, useEffect, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { Button } from "../../ui/button";
import { SparklesIcon, AlertCircle, Upload, CreditCard, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useMeTokensSupabase } from "@/lib/hooks/metokens/useMeTokensSupabase";
import { uploadThumbnailToIPFS, uploadThumbnailFromBlob } from "@/lib/services/thumbnail-upload";
import { RobustMeTokenCreator } from "@/components/UserProfile/RobustMeTokenCreator";
import { useX402Payment } from "@/lib/hooks/payments/useX402Payment";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { compressImage } from "@/lib/utils/image-compression";
import { convertFailingGateway, parseIpfsUriWithFallback } from "@/lib/utils/image-gateway";
import { GatewayImage } from "@/components/ui/gateway-image";
import { StoryLicenseSelector } from "./StoryLicenseSelector";
import { NFTMintingStep } from "./NFTMintingStep";
import { useNftMintingConfigured } from "@/lib/hooks/story/useNftMintingConfigured";
import type { StoryLicenseTerms } from "@/lib/types/story-protocol";
import type { Address } from "viem";
import { logger } from '@/lib/utils/logger';
import { useNsfwDetection } from '@/lib/hooks/useNsfwDetection';


interface FormValues {
  thumbnailType: "custom" | "ai";
  customImage: File | null;
  aiPrompt: string;
  meTokenConfig: {
    requireMeToken: boolean;
    priceInMeToken: number;
  };
  selectedImage: string;
}

interface CreateThumbnailFormProps {
  livepeerAssetId?: string;
  assetReady?: boolean;
  videoAssetId?: number;
  creatorAddress?: Address;
  metadataURI?: string;
  onSelectThumbnailImages: (imageUrl: string) => void;
  onMeTokenConfigChange?: (meTokenConfig: {
    requireMeToken: boolean;
    priceInMeToken: number;
  }) => void;
  onStoryConfigChange?: (storyConfig: {
    registerIP: boolean;
    licenseTerms?: any;
  }) => void;
  onNFTMinted?: (mintResult: {
    tokenId: string;
    contractAddress: Address;
    txHash: string;
  }) => void;
  onMeTokenCreated?: (meTokenAddress: string, transactionHash?: string, meTokenId?: string) => void;
}

const CreateThumbnailForm = ({
  livepeerAssetId,
  assetReady = false,
  videoAssetId,
  creatorAddress,
  metadataURI,
  onSelectThumbnailImages,
  onMeTokenConfigChange,
  onStoryConfigChange,
  onNFTMinted,
  onMeTokenCreated,
}: CreateThumbnailFormProps) => {
  const {
    control,
    watch,
    formState: { errors, isSubmitting },
    setError,
    clearErrors,
    setValue,
    register,
  } = useForm<FormValues>({
    defaultValues: {
      thumbnailType: "custom",
      customImage: null,
      aiPrompt: "",
      meTokenConfig: {
        requireMeToken: false,
        priceInMeToken: 0,
      },
      selectedImage: "",
    },
  });

  const [customPreviewUrl, setCustomPreviewUrl] = useState<string | null>(null);
  const [aiImages, setAiImages] = useState<any[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [thumbnailUploading, setThumbnailUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isCompressing, setIsCompressing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | undefined>();
  const [showMeTokenCreator, setShowMeTokenCreator] = useState(false);
  const blobUrlRef = useRef<string | null>(null);
  const currentImageRef = useRef<File | null>(null);
  const blobUrlFileRef = useRef<File | null>(null); // Track which file the blob URL belongs to
  const isSettingFileRef = useRef<boolean>(false); // Flag to prevent cleanup during file selection

  const { userMeToken, loading: meTokenLoading, checkUserMeToken } = useMeTokensSupabase();
  const { makePayment, isProcessing: isPaymentProcessing, isConnected } = useX402Payment();
  const { gateImage, isClassifying: isNsfwChecking } = useNsfwDetection();
  const gateImageRef = useRef(gateImage);
  gateImageRef.current = gateImage;
  const requireMeToken = watch("meTokenConfig.requireMeToken");
  const thumbnailType = watch("thumbnailType");
  const customImage = watch("customImage");
  const [storyIPEnabled, setStoryIPEnabled] = useState(false);
  const [selectedStoryLicense, setSelectedStoryLicense] = useState<StoryLicenseTerms | null>(null);
  const { configured: nftMintingConfigured, loading: nftMintingConfigLoading } = useNftMintingConfigured();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const rejectCustomImage = (message: string) => {
    setError("customImage", { message });
    toast.error(message);
    setValue("customImage", null);
    setCustomPreviewUrl(null);
    setSelectedImage(undefined);
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    blobUrlFileRef.current = null;
    currentImageRef.current = null;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setIsCompressing(false);
    setThumbnailUploading(false);
    setUploadProgress(0);
  };

  useEffect(() => {
    checkUserMeToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle custom image upload with compression
  useEffect(() => {
    // Reset the flag at the start of the effect (after cleanup has already run)
    // This ensures the flag was checked during cleanup, and now we can reset it
    if (isSettingFileRef.current) {
      isSettingFileRef.current = false;
    }

    if (customImage && thumbnailType === "custom") {
      // Store the current image in ref to check against stale closures
      currentImageRef.current = customImage;
      const imageToUpload = customImage;

      // Process image: NSFW screen → compress → upload
      const processAndUpload = async () => {
        try {
          // Step 0: Client-side NSFW gate (privacy-first; fail-open if model unavailable)
          setIsCompressing(true);
          setUploadProgress(5);
          const gate = await gateImageRef.current(imageToUpload);
          if (currentImageRef.current !== imageToUpload) {
            return;
          }
          if (gate.action === 'block') {
            rejectCustomImage(
              'This image appears to contain explicit content and cannot be used as a thumbnail. Please choose another image.'
            );
            return;
          }
          if (gate.action === 'warn') {
            // User declined the suggestive-content confirm
            rejectCustomImage(
              'Thumbnail rejected. Please choose a different image if you do not want to use a suggestive thumbnail.'
            );
            return;
          }
          if (gate.action === 'allow' && gate.reason === 'model_unavailable') {
            logger.warn('[nsfw] Thumbnail NSFW check skipped (model unavailable); continuing upload');
          }

          // Step 1: Compress image
          setUploadProgress(10);

          const compressionResult = await compressImage(imageToUpload, {
            maxSizeMB: 5,
            maxWidth: 1920,
            maxHeight: 1080,
            quality: 0.8,
            outputFormat: 'image/jpeg',
          });

          setUploadProgress(30);

          if (!compressionResult.success) {
            if (currentImageRef.current !== imageToUpload) {
              return;
            }
            setError("customImage", {
              message: compressionResult.error || "Failed to compress image. Please use a smaller image size."
            });
            setIsCompressing(false);
            setThumbnailUploading(false);
            setUploadProgress(0);
            return;
          }

          const compressedFile = compressionResult.file!;

          // Check if customImage has changed while compression was in progress
          if (currentImageRef.current !== imageToUpload) {
            return;
          }

          // Step 2: Update preview URL with compressed file (or keep existing if already showing)
          // Create compressed preview URL first
          const compressedPreviewUrl = URL.createObjectURL(compressedFile);

          // Revoke the original preview URL if it's different from the compressed one
          if (blobUrlRef.current && blobUrlRef.current !== compressedPreviewUrl) {
            URL.revokeObjectURL(blobUrlRef.current);
          }

          // Update refs and state with compressed preview URL
          blobUrlRef.current = compressedPreviewUrl;
          blobUrlFileRef.current = imageToUpload; // Still track as the same file
          setCustomPreviewUrl(compressedPreviewUrl);
          setUploadProgress(50);

          // Step 3: Upload to IPFS
          setIsCompressing(false);
          setThumbnailUploading(true);

          const result = await uploadThumbnailToIPFS(compressedFile, livepeerAssetId || 'unknown');

          setUploadProgress(100);

          // Check if customImage has changed while upload was in progress
          if (currentImageRef.current !== imageToUpload) {
            // Image changed, ignore this result
            return;
          }

          if (result.success && result.thumbnailUrl) {
            // Keep the blob URL for the preview to ensure it remains visible instantly
            // and doesn't rely on the IPFS gateway for the visual feedback.

            // Convert ipfs:// protocol to gateway URL for database storage
            // This ensures the URL is in a format that can be accessed from any region
            // convertFailingGateway handles ipfs:// protocol and converts to Lighthouse gateway
            const ipfsUrl = convertFailingGateway(result.thumbnailUrl);

            // Ensure we have a valid gateway URL (not ipfs:// protocol)
            // If conversion didn't work, use parseIpfsUriWithFallback as backup
            const finalUrl = ipfsUrl.startsWith('ipfs://')
              ? parseIpfsUriWithFallback(ipfsUrl, 0) // Use Lighthouse (index 0)
              : ipfsUrl;

            // We consciously DO NOT update customPreviewUrl here to avoid flicker/loading
            // The blob URL remains valid until component unmount or new file selection

            setSelectedImage(finalUrl);
            onSelectThumbnailImages(finalUrl);
            toast.success("Custom thumbnail uploaded successfully!");
          } else {
            // IPFS upload failed - clear selected image since blob URLs can't be used on server
            toast.error(result.error || "Failed to upload thumbnail. Please try again.");
            // Clear blob URL and selected image to prevent submission with invalid URL
            if (blobUrlRef.current) {
              URL.revokeObjectURL(blobUrlRef.current);
              blobUrlRef.current = null;
              blobUrlFileRef.current = null;
            }
            setCustomPreviewUrl(null);
            setSelectedImage(undefined);
            setValue("customImage", null);
            setError("customImage", {
              message: "Thumbnail upload failed. Please select a different image and try again."
            });
          }
        } catch (error) {
          // Check if customImage has changed while processing was in progress
          if (currentImageRef.current !== imageToUpload) {
            return;
          }

          logger.error("Error processing thumbnail:", error);
          toast.error("Failed to process thumbnail. Please try again.");
          // Clear blob URL and selected image to prevent submission with invalid URL
          if (blobUrlRef.current) {
            URL.revokeObjectURL(blobUrlRef.current);
            blobUrlRef.current = null;
            blobUrlFileRef.current = null;
          }
          setCustomPreviewUrl(null);
          setSelectedImage(undefined);
          setValue("customImage", null);
          setError("customImage", {
            message: "Failed to process image. Please select a different image and try again."
          });
        } finally {
          // Stale runs must not clear loading for a newer image still in flight
          if (currentImageRef.current === imageToUpload) {
            setIsCompressing(false);
            setThumbnailUploading(false);
            setUploadProgress(0);
          }
        }
      };

      processAndUpload();
    } else {
      // Reset refs when no image is selected and reset loading state
      currentImageRef.current = null;
      // Clear blob URL if no image is selected
      if (blobUrlRef.current && !isSettingFileRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
        blobUrlFileRef.current = null;
      }
      setThumbnailUploading(false);
      setIsCompressing(false);
      setUploadProgress(0);
      // Reset the flag when no image is selected
      isSettingFileRef.current = false;
    }

    // Cleanup function to revoke blob URLs when component unmounts or dependencies change
    // This runs both when dependencies change AND when component unmounts
    return () => {
      // Skip cleanup entirely if we're in the middle of setting a new file (prevents race condition)
      // This flag is set in handleFileSelect before calling setValue, so cleanup won't revoke
      // the blob URL we just created for the immediate preview
      if (isSettingFileRef.current) {
        // Don't reset the flag here - let it reset after useEffect runs
        return;
      }

      // Clean up blob URLs when selection is cleared or component unmounts
      // We avoid comparing customImage to blobUrlFileRef because customImage is from closure (stale)
      // Strategy:
      // 1. handleFileSelect always cleans up old blob URLs before creating new ones (for file changes)
      // 2. Cleanup here only handles: clearing selection (customImage → null) or unmounting
      // 3. When customImage changes but isn't null, handleFileSelect handles cleanup
      if (blobUrlRef.current && !customImage) {
        // Only clean up if customImage is being cleared (set to null)
        // This avoids the stale closure comparison issue entirely
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
        blobUrlFileRef.current = null;
      }
      // Note: For file changes (customImage changing from one file to another),
      // handleFileSelect already cleaned up the old blob URL before creating the new one,
      // so we don't need to handle that case here.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customImage, thumbnailType, livepeerAssetId]);

  // Separate cleanup effect for component unmount to ensure blob URLs are always cleaned up
  useEffect(() => {
    return () => {
      // Always clean up blob URLs on unmount, regardless of flags
      // When component unmounts, we must clean up all resources to prevent memory leaks
      // The isSettingFileRef flag is only relevant for preventing cleanup during dependency changes,
      // not during unmount where we always want to clean up
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
        blobUrlFileRef.current = null;
      }
      // Reset flag on unmount to ensure clean state if component remounts
      isSettingFileRef.current = false;
    };
  }, []); // Empty deps = only run on mount/unmount

  // Watch MeToken config changes
  useEffect(() => {
    if (!onMeTokenConfigChange) return;
    const subscription = watch((value, { name }) => {
      const config = value.meTokenConfig;
      if (
        (name === "meTokenConfig" || name?.startsWith("meTokenConfig.")) &&
        config &&
        typeof config.requireMeToken === "boolean" &&
        typeof config.priceInMeToken === "number"
      )
        onMeTokenConfigChange({
          requireMeToken: config.requireMeToken,
          priceInMeToken: config.priceInMeToken,
        });
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileSelect = (file: File) => {
    // Clear any previous errors first
    clearErrors("customImage");

    if (!file) {
      setValue("customImage", null);
      setCustomPreviewUrl(null);
      setSelectedImage(undefined);
      clearErrors("customImage");
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError("customImage", { message: "Please select an image file (JPG, PNG, WebP)" });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setValue("customImage", null);
      setCustomPreviewUrl(null);
      setSelectedImage(undefined);
      return;
    }

    // File is valid - create immediate preview URL for instant feedback
    clearErrors("customImage");

    // Set flag to prevent cleanup from revoking the blob URL we're about to create
    isSettingFileRef.current = true;

    // Create immediate preview from original file before compression
    // Always clean up previous blob URL before creating a new one to prevent leaks
    // Even if it's the same file, we're creating a new blob URL so the old one should be revoked
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
      // Don't clear blobUrlFileRef yet - we'll set it to the new file below
    }

    // Create new blob URL and track which file it belongs to
    const immediatePreviewUrl = URL.createObjectURL(file);
    blobUrlRef.current = immediatePreviewUrl;
    blobUrlFileRef.current = file; // Track that this blob URL belongs to this file
    setCustomPreviewUrl(immediatePreviewUrl);

    // Set the file in form state (this will trigger the compression/upload useEffect)
    // The cleanup will see isSettingFileRef.current === true and skip revoking the blob URL
    // The flag will be reset at the start of the useEffect body
    setValue("customImage", file);
  };

  const handleCustomImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    // Reset the file input to allow re-selecting the same file
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  /**
   * Make x402 payment using the user's connected smart account
   * This is a client-side payment that requires wallet access
   */
  const makeX402PaymentWithWallet = async () => {
    try {
      // Check if wallet is connected
      if (!isConnected) {
        throw new Error('Please connect your wallet to make payments');
      }

      // Make the payment using the client-side hook
      const result = await makePayment({
        service: 'ai-thumbnail-generation',
        amount: '1000000', // 1 USDC (6 decimals) on Base
        endpoint: 'https://x402.payai.network/api/base/paid-content',
      });

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Payment failed",
      };
    }
  };

  const [selectedModel, setSelectedModel] = useState<'nano-banana' | 'gemini-3-pro'>('nano-banana');

  const getModelPrice = (model: 'nano-banana' | 'gemini-3-pro') => {
    return model === 'nano-banana' ? 500000 : 1000000; // 0.5 USDC vs 1.0 USDC
  };

  const getModelName = (model: 'nano-banana' | 'gemini-3-pro') => {
    return model === 'nano-banana' ? 'Nano Banana (Gemini 2.5 Flash)' : 'Nano Banana Pro (Gemini 3 Pro)';
  };

  const handleAiGenerateWithPayment = async (prompt: string) => {
    setPaymentLoading(true);
    setAiLoading(true);

    try {
      // Check wallet connection first
      if (!isConnected) {
        throw new Error('Please connect your wallet to use AI generation');
      }

      // Step 1: Make x402 payment using client-side wallet
      const price = getModelPrice(selectedModel);
      toast.info(`Processing payment of ${(price / 1000000).toFixed(2)} USDC...`);

      const paymentResult = await makePayment({
        service: 'ai-thumbnail-generation',
        amount: price.toString(),
        endpoint: 'https://x402.payai.network/api/base/paid-content',
        recipientAddress: '0x31ee83aef931a1af321c505053040e98545a5614',
      });

      if (!paymentResult.success) {
        throw new Error(paymentResult.error || "Payment failed");
      }

      toast.success('Payment successful!');

      // Step 2: Generate AI image (server verifies USDC payment before calling generateImage)
      const transactionHash = paymentResult.paymentResponse?.transactionHash;
      if (!transactionHash) {
        throw new Error('Payment succeeded but no transaction hash; please try again');
      }
      toast.info(`Generating AI thumbnail with ${getModelName(selectedModel)}...`);
      const aiResult = await generateAiImage(prompt, {
        transactionHash,
        amount: price.toString(),
      });

      if (aiResult.success) {
        setAiImages(aiResult.images);
        toast.success(`Generated ${aiResult.images.length} AI thumbnail${aiResult.images.length > 1 ? 's' : ''}!`);
      } else {
        throw new Error(aiResult.error || "Gemini AI generation failed");
      }

    } catch (error) {
      logger.error('AI Generation Error:', error);
      toast.error(error instanceof Error ? error.message : "Failed to generate AI thumbnail");
      setError("root", {
        message: error instanceof Error ? error.message : "Failed to generate AI thumbnail with Gemini",
      });
    } finally {
      setPaymentLoading(false);
      setAiLoading(false);
    }
  };

  const generateAiImage = async (
    prompt: string,
    paymentProof?: { transactionHash: string; amount: string }
  ) => {
    try {
      const response = await fetch('/api/ai/generate-thumbnail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          model: selectedModel,
          paymentProof: paymentProof ?? undefined,
        }),
      });

      const result = await response.json();

      if (result.success && result.images && result.images.length > 0) {
        return {
          success: true,
          images: result.images,
        };
      }

      return {
        success: false,
        error: result.error || "Gemini AI generation failed",
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "AI generation failed",
      };
    }
  };

  const handleImageSelection = async (imageUrl: string) => {
    // If it's a blob URL (AI-generated image), NSFW-gate then upload to IPFS
    if (imageUrl.startsWith('blob:')) {
      setThumbnailUploading(true);
      try {
        const gate = await gateImage(imageUrl);
        if (gate.action === 'block') {
          toast.error(
            'This AI image appears to contain explicit content and cannot be used as a thumbnail. Please generate another.'
          );
          setSelectedImage(undefined);
          return;
        }
        if (gate.action === 'warn') {
          toast.error(
            'Thumbnail rejected. Generate another image if you do not want a suggestive thumbnail.'
          );
          setSelectedImage(undefined);
          return;
        }
        if (gate.action === 'allow' && gate.reason === 'model_unavailable') {
          logger.warn('[nsfw] AI thumbnail NSFW check skipped (model unavailable); continuing upload');
        }

        const result = await uploadThumbnailFromBlob(imageUrl, livepeerAssetId || 'unknown');
        if (result.success && result.thumbnailUrl) {
          // Convert ipfs:// protocol to gateway URL for database storage
          const ipfsUrl = convertFailingGateway(result.thumbnailUrl);
          // Ensure we have a valid gateway URL (not ipfs:// protocol)
          const finalUrl = ipfsUrl.startsWith('ipfs://')
            ? parseIpfsUriWithFallback(ipfsUrl, 0) // Use Lighthouse (index 0)
            : ipfsUrl;
          setSelectedImage(finalUrl);
          onSelectThumbnailImages(finalUrl);
          toast.success("AI thumbnail uploaded successfully!");
        } else {
          // IPFS upload failed - clear selection since blob URLs can't be used on server
          toast.error(result.error || "Failed to upload AI thumbnail. Please try selecting again.");
          setSelectedImage(undefined);
          // Don't call onSelectThumbnailImages with blob URL - it's invalid for server use
        }
      } catch (error) {
        logger.error("Error uploading AI thumbnail:", error);
        toast.error("Failed to upload AI thumbnail. Please try selecting again.");
        // Clear selection - blob URLs can't be used on server
        setSelectedImage(undefined);
        // Don't call onSelectThumbnailImages with blob URL - it's invalid for server use
      } finally {
        setThumbnailUploading(false);
      }
    } else {
      // It's already a persistent URL (IPFS or other), use it directly
      const persistentUrl = convertFailingGateway(imageUrl);
      // Ensure we have a valid gateway URL (not ipfs:// protocol)
      const finalUrl = persistentUrl.startsWith('ipfs://')
        ? parseIpfsUriWithFallback(persistentUrl, 0) // Use Lighthouse (index 0)
        : persistentUrl;
      setSelectedImage(finalUrl);
      onSelectThumbnailImages(finalUrl);
    }
  };

  return (
    <div className="space-y-6">
      {/* Thumbnail Type Selection */}
      <Tabs value={thumbnailType} onValueChange={(value) => setValue("thumbnailType", value as "custom" | "ai")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="custom" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload Custom
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-2">
            <SparklesIcon className="h-4 w-4" />
            AI Generate
          </TabsTrigger>
        </TabsList>

        {/* Custom Upload Tab */}
        <TabsContent value="custom" className="space-y-4">
          <div className="space-y-4">
            <Label>Upload Thumbnail Image</Label>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${dragOver
                ? "border-primary bg-primary/5"
                : "border-gray-300 hover:border-gray-400"
                }`}
            >
              <input
                id="custom-image-upload"
                name="customImage"
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleCustomImageChange}
                className="hidden"
              />
              <div className="flex flex-col items-center gap-4">
                <Upload className={`h-8 w-8 ${dragOver ? "text-primary" : "text-gray-400"}`} />
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isCompressing || thumbnailUploading || isNsfwChecking}
                  >
                    {isCompressing || thumbnailUploading || isNsfwChecking ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Choose Image
                      </>
                    )}
                  </Button>
                  <p className="text-sm text-gray-500">
                    Drag and drop an image here, or click to browse
                  </p>
                  <p className="text-xs text-gray-400">
                    JPG, PNG, WebP (will be compressed to 5MB if needed)
                  </p>
                </div>
              </div>

              {/* Upload Progress */}
              {(isCompressing || thumbnailUploading || isNsfwChecking) && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>
                      {isNsfwChecking
                        ? "Checking image safety..."
                        : isCompressing
                          ? "Compressing image..."
                          : "Uploading to IPFS..."}
                    </span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}

              {errors.customImage && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{errors.customImage.message}</AlertDescription>
                </Alert>
              )}
            </div>

            {/* Custom Image Preview - Show immediately when file is selected */}
            {customPreviewUrl && (
              <div className="space-y-2">
                <Label>Preview</Label>
                <div className="relative w-full aspect-video rounded-lg overflow-hidden border">
                  {/* Use regular img tag for blob URLs (local previews), GatewayImage for IPFS URLs */}
                  {customPreviewUrl.startsWith('blob:') ? (
                    <img
                      src={customPreviewUrl}
                      alt="Custom thumbnail preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        logger.error("Preview image failed to load:", e);
                        setCustomPreviewUrl(null);
                      }}
                    />
                  ) : (
                    <GatewayImage
                      src={customPreviewUrl}
                      alt="Custom thumbnail preview"
                      fill
                      className="object-cover"
                      unoptimized={true} // Always unoptimized for uploads to prevent timeouts
                      showSkeleton={true}
                    />
                  )}
                  {/* Show loading overlay during NSFW check / compression / upload */}
                  {(isCompressing || thumbnailUploading || isNsfwChecking) && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <div className="text-center text-white">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                        <p className="text-sm">
                          {isNsfwChecking
                            ? "Checking..."
                            : isCompressing
                              ? "Compressing..."
                              : "Uploading..."}
                        </p>
                        <p className="text-xs mt-1">{uploadProgress}%</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* AI Generation Tab */}
        <TabsContent value="ai" className="space-y-4">
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-blue-600" />
                <Label className="text-blue-800 font-semibold">Paid AI Generation</Label>
              </div>

              <RadioGroup
                value={selectedModel}
                onValueChange={(v) => setSelectedModel(v as 'nano-banana' | 'gemini-3-pro')}
                className="grid gap-3 pt-2"
              >
                <Label className="cursor-pointer border border-blue-200 bg-white p-3 rounded-md hover:bg-blue-50 transition-colors flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="nano-banana" id="model-nano" />
                    <div className="grid gap-0.5">
                      <span className="font-medium text-sm">Nano Banana (Gemini 2.5 Flash)</span>
                      <span className="text-xs text-slate-500">Fast, efficient generation</span>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-blue-600">0.5 USDC</span>
                </Label>

                <Label className="cursor-pointer border border-blue-200 bg-white p-3 rounded-md hover:bg-blue-50 transition-colors flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="gemini-3-pro" id="model-pro" />
                    <div className="grid gap-0.5">
                      <span className="font-medium text-sm">Nano Banana Pro (Gemini 3 Pro)</span>
                      <span className="text-xs text-slate-500">Premium quality, highest detail</span>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-blue-600">1.0 USDC</span>
                </Label>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-prompt">AI Prompt</Label>
              <Textarea
                id="ai-prompt"
                {...register("aiPrompt", { required: "Prompt is required for AI generation" })}
                placeholder="Describe the thumbnail you want to generate... (e.g., 'A cyberpunk cityscape with neon lights', 'A person riding a camel in the desert')"
                rows={4}
                className="w-full"
              />
              <p className="text-xs text-gray-500">
                Tip: Be descriptive! Gemini works best with detailed scene descriptions rather than just keywords.
              </p>
              {errors.aiPrompt && (
                <p className="text-red-500 text-sm">{errors.aiPrompt.message}</p>
              )}
            </div>

            <Button
              type="button"
              onClick={() => handleAiGenerateWithPayment(watch("aiPrompt"))}
              disabled={aiLoading || paymentLoading || !watch("aiPrompt")}
              className="w-full"
            >
              {paymentLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Processing Payment...
                </>
              ) : aiLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Generating with Gemini AI...
                </>
              ) : (
                <>
                  Generate with {getModelName(selectedModel)} ({(getModelPrice(selectedModel) / 1000000).toFixed(1)} USDC)
                </>
              )}
            </Button>

            {/* AI Generated Images */}
            {aiImages.length > 0 && (
              <div className="space-y-2">
                <Label>Generated Thumbnails</Label>
                <p className="text-xs text-gray-500">
                  Generated with Google Gemini 2.5 Flash (16:9 aspect ratio)
                </p>
                <RadioGroup
                  value={selectedImage}
                  onValueChange={handleImageSelection}
                  className="grid grid-cols-2 gap-4"
                >
                  {aiImages.map((image, index) => (
                    <div key={image.id || index} className="flex flex-col items-center">
                      <RadioGroupItem
                        value={image.url}
                        id={`ai-image-${index}`}
                        className="mb-2"
                      />
                      <Label htmlFor={`ai-image-${index}`} className="cursor-pointer">
                        <div className="relative w-full aspect-video rounded-lg overflow-hidden border hover:border-blue-300 transition-colors">
                          <GatewayImage
                            src={image.url}
                            alt={`AI Generated Thumbnail ${index + 1}`}
                            fill
                            className="object-cover"
                            unoptimized
                            showSkeleton={false}
                          />
                          <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                            Gemini
                          </div>
                        </div>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Error Messages */}
      {errors.root && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Generation Error</AlertTitle>
          <AlertDescription>{errors.root.message}</AlertDescription>
        </Alert>
      )}

      {/* MeToken Configuration Section */}
      <div className="mt-8 space-y-4 border-t pt-4">
        <h3 className="text-lg font-semibold">Content Access Control</h3>

        {/* MeToken Status */}
        {meTokenLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : userMeToken ? (
          <Alert className="bg-green-50 border-green-200">
            <AlertCircle className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">MeToken Active</AlertTitle>
            <AlertDescription className="text-green-700">
              Your MeToken: {userMeToken.name} ({userMeToken.symbol})
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="bg-amber-50 border-amber-200">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800">No MeToken Found</AlertTitle>
            <AlertDescription className="text-amber-700">
              You need a MeToken to set access controls for your content.
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="ml-2 mt-2"
                onClick={() => setShowMeTokenCreator(true)}
              >
                Create MeToken
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* MeToken Creator Dialog */}
        {showMeTokenCreator && !userMeToken && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Create Your MeToken</CardTitle>
              <CardDescription>
                Create a MeToken to enable premium content access for your subscribers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RobustMeTokenCreator
                onMeTokenCreated={(meTokenAddress, txHash, meTokenId) => {
                  // Don't close immediately - let user see success state
                  // Just update parent state/data
                  checkUserMeToken();
                  onMeTokenCreated?.(meTokenAddress, txHash, meTokenId);
                }}
                onClose={() => {
                  // Close when user clicks "Done"
                  setShowMeTokenCreator(false);
                  checkUserMeToken();
                }}
              />
            </CardContent>
          </Card>
        )}

        {/* MeToken Gating Option */}
        <div className="flex items-center space-x-2">
          <Controller
            name="meTokenConfig.requireMeToken"
            control={control}
            render={({ field }) => (
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={!userMeToken}
              />
            )}
          />
          <Label className={!userMeToken ? "text-gray-400" : ""}>
            Require MeToken for Access
            {!userMeToken && " (Create a MeToken first)"}
          </Label>
        </div>

        {requireMeToken && userMeToken && (
          <div className="space-y-4 pl-6">
            <div className="space-y-2">
              <Label>Minimum MeToken Balance Required</Label>
              <Controller
                name="meTokenConfig.priceInMeToken"
                control={control}
                rules={{
                  required: "MeToken price is required",
                  min: { value: 0, message: "Price must be 0 or greater" },
                }}
                render={({ field }) => (
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      className="pr-20"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                      {userMeToken.symbol}
                    </span>
                  </div>
                )}
              />
              {errors.meTokenConfig?.priceInMeToken && (
                <p className="text-sm text-red-500">
                  {errors.meTokenConfig.priceInMeToken.message}
                </p>
              )}
              <p className="text-xs text-gray-500">
                Users will need to hold at least this amount of your MeToken to access this content
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Story Protocol IP Registration Section */}
      <div className="mt-8 space-y-4 border-t pt-4">
        <StoryLicenseSelector
          enabled={storyIPEnabled}
          selectedLicense={selectedStoryLicense}
          onEnabledChange={(enabled) => {
            setStoryIPEnabled(enabled);
            if (onStoryConfigChange) {
              onStoryConfigChange({
                registerIP: enabled,
                licenseTerms: enabled ? selectedStoryLicense : undefined,
              });
            }
          }}
          onLicenseChange={(license) => {
            setSelectedStoryLicense(license);
            if (onStoryConfigChange && storyIPEnabled) {
              onStoryConfigChange({
                registerIP: true,
                licenseTerms: license || undefined,
              });
            }
          }}
        />

        {/* NFT Minting Step - Show when Story Protocol is enabled, a license
            template is selected, and minting is configured. A license template
            is required before minting/registering on Story Protocol. */}
        {storyIPEnabled && !selectedStoryLicense && (
          <Alert className="bg-amber-50 border-amber-200">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800">Select a license template</AlertTitle>
            <AlertDescription className="text-amber-700">
              You must choose a license template above before you can mint and
              register your video on Story Protocol.
            </AlertDescription>
          </Alert>
        )}

        {storyIPEnabled && selectedStoryLicense && videoAssetId && creatorAddress && metadataURI && (
          <div className="mt-4">
            {nftMintingConfigLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : !nftMintingConfigured ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>NFT minting unavailable</AlertTitle>
                <AlertDescription>
                  Set STORY_PROTOCOL_PRIVATE_KEY in your environment to enable Story Protocol NFT minting.
                </AlertDescription>
              </Alert>
            ) : (
              <NFTMintingStep
                videoAssetId={videoAssetId}
                metadataURI={metadataURI}
                recipientAddress={creatorAddress}
                onMintSuccess={(result) => {
                  onNFTMinted?.(result);
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateThumbnailForm;