"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Film,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CreativeTVVideoPicker } from "@/components/songchain/CreativeTVVideoPicker";
import { SongCupAttestationModal } from "@/components/eas/SongCupAttestationModal";
import { SongCupAdminSubmissionsList } from "@/components/songchain/song-cup/SongCupAdminSubmissionsList";
import { useSongCupAttestation } from "@/lib/hooks/eas/useSongCupAttestation";
import { useSongCupSubmitPrefill } from "@/lib/hooks/song-cup/useSongCupSubmitPrefill";
import { useSongCupUserSubmission } from "@/lib/hooks/song-cup/useSongCupUserSubmission";
import { useCreatorVideoLibrary } from "@/hooks/useCreatorVideoLibrary";
import { songCupSubmissionsService } from "@/lib/sdk/supabase/song-cup-submissions";
import { useUser } from "@/lib/wallet/react";
import { useWalletAuth } from "@/lib/auth/useWalletAuth";
import type { VideoAsset } from "@/lib/types/video-asset";
import { resolveVideoPlaybackUrl } from "@/lib/songchain/build-lens-video-metadata";
import { cn } from "@/lib/utils/utils";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  songCupAccentYellow,
  songCupBody,
  songCupField,
  songCupFormCard,
  songCupGradientCta,
  songCupMuted,
  songCupPanel,
  songCupPanelInset,
} from "@/lib/songchain/song-cup/panel-styles";

type SongCupSubmitPanelProps = {
  className?: string;
};

function thumbnailFromVideoAsset(video: VideoAsset): string | undefined {
  const url =
    (video as { thumbnail_url?: string }).thumbnail_url ?? video.thumbnailUri;
  return url?.trim() || undefined;
}

function SongCupCheckbox({
  id,
  label,
  checked,
  onChange,
  className,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground dark:text-white",
        className,
      )}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 transition-colors",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-[#fe01dc]/50 peer-focus-visible:ring-offset-2",
          checked
            ? "border-[#fe01dc] bg-[#fe01dc]"
            : "border-[#fe01dc]/70 bg-background dark:bg-black/40",
        )}
      >
        <Check
          className={cn(
            "h-4 w-4 text-[#feed01] transition-opacity",
            checked ? "opacity-100" : "opacity-0",
          )}
          strokeWidth={3}
          aria-hidden
        />
      </span>
      {label}
    </label>
  );
}

export function SongCupSubmitPanel({ className }: SongCupSubmitPanelProps) {
  const user = useUser();
  const { getAuthHeaders, address: authAddress } = useWalletAuth();
  const { videos, loading: libraryLoading, hasWallet } = useCreatorVideoLibrary();
  const {
    submission: existingSubmission,
    hasSubmitted,
    isLoading: isLoadingSubmission,
    setSubmission: setExistingSubmission,
  } = useSongCupUserSubmission(authAddress);
  const [attestationModalOpen, setAttestationModalOpen] = useState(false);
  const { isAttested, isLoading: isAttestationLoading, attestation } = useSongCupAttestation();
  const {
    email,
    artistHandle,
    emailFromAuth,
    handleFromAuth,
    isLoadingHandle,
    setEmail,
    setArtistHandle,
  } = useSongCupSubmitPrefill();

  const [artistName, setArtistName] = useState("");
  const [description, setDescription] = useState("");
  const [uploadVideoEnabled, setUploadVideoEnabled] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoAsset | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setArtistName("");
    setDescription("");
    setUploadVideoEnabled(false);
    setSelectedVideo(null);
  };

  const handleSubmit = async () => {
    if (!authAddress) {
      toast.error("Connect your wallet to submit.");
      return;
    }
    if (hasSubmitted) {
      toast.message("You already submitted your Song Cup entry.");
      return;
    }
    if (!isAttested) {
      toast.error("Please sign the Terms & Conditions attestation before submitting.");
      setAttestationModalOpen(true);
      return;
    }
    if (!artistName.trim()) {
      toast.error("Artist name is required.");
      return;
    }
    if (!uploadVideoEnabled || !selectedVideo?.playback_id) {
      toast.error("Enable Upload Video and select a video from your library.");
      return;
    }

    setIsSubmitting(true);
    try {
      const playbackUrl = await resolveVideoPlaybackUrl(selectedVideo.playback_id);
      if (!playbackUrl) {
        toast.error("Could not resolve video playback URL. Try another video.");
        return;
      }

      const authHeaders = await getAuthHeaders();
      const result = await songCupSubmissionsService.create(
        {
          wallet_address: authAddress,
          grove_url: playbackUrl,
          grove_hash: selectedVideo.metadata_uri ?? undefined,
          title: artistName.trim(),
          description: description.trim() || undefined,
          artist_handle: artistHandle.trim() || undefined,
          email: email.trim() || undefined,
          cover_url: thumbnailFromVideoAsset(selectedVideo),
          attestation_uid: attestation?.uid,
        },
        authHeaders,
      );

      if (!result.ok) {
        if (result.reason === "duplicate") {
          toast.message(result.message ?? "You already submitted an entry.");
          if (authAddress) {
            const row = await songCupSubmissionsService.getForWallet(authAddress);
            if (row) setExistingSubmission(row);
          }
        } else {
          toast.error(result.message ?? "Submission failed. Please try again.");
        }
        return;
      }

      toast.success("Entry submitted successfully!");
      setExistingSubmission(result.submission);
      resetForm();
    } catch (err) {
      console.error("Song Cup submission failed", err);
      toast.error("Submission failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldClass = cn(songCupField, "h-[41px]");

  return (
    <div className={cn("relative overflow-hidden p-4 sm:p-6", songCupPanel, className)}>
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <div className="flex items-start gap-4">
            <img
              src="/songchain/button-icons/submit-icon.svg"
              alt=""
              aria-hidden
              className="hidden h-[120px] w-[120px] object-contain mix-blend-multiply dark:mix-blend-normal lg:block"
            />
            <div>
              <h2 className="text-[40px] font-bold leading-[20px] tracking-[-0.2px] text-foreground dark:text-white sm:text-[50px] sm:leading-none">
                SUBMIT
              </h2>
              <p className={cn("mt-2 text-sm", songCupMuted)}>
                Select a video from your Creative TV library to enter the Song Cup.
              </p>
            </div>
          </div>

          <div className={cn("relative mx-auto w-full max-w-[327px]", songCupFormCard)}>
            {isLoadingSubmission ? (
              <div className={cn("flex items-center justify-center gap-2 py-12 text-sm", songCupMuted)}>
                <Loader2 className="h-5 w-5 animate-spin" />
                Checking submission status…
              </div>
            ) : hasSubmitted && existingSubmission ? (
              <div className="space-y-4 py-2 text-center">
                <CheckCircle2 className={cn("mx-auto h-12 w-12", songCupAccentYellow)} />
                <div>
                  <h3 className={cn("text-lg font-bold", songCupBody)}>Entry submitted</h3>
                  <p className={cn("mt-2 text-sm", songCupMuted)}>
                    You submitted{" "}
                    {formatDistanceToNow(new Date(existingSubmission.created_at), { addSuffix: true })}
                    . Only one entry is allowed per wallet.
                  </p>
                </div>
                {existingSubmission.title && (
                  <p className={cn("text-sm font-medium", songCupBody)}>{existingSubmission.title}</p>
                )}
                <Badge variant="secondary" className="capitalize">
                  {existingSubmission.status}
                </Badge>
              </div>
            ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label htmlFor="artist-name" className={cn("text-sm font-medium", songCupBody)}>
                  Artist Name
                </label>
                <Input
                  id="artist-name"
                  value={artistName}
                  onChange={(e) => setArtistName(e.target.value)}
                  disabled={isSubmitting}
                  className={fieldClass}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="artist-handle" className={cn("text-sm font-medium", songCupBody)}>
                  Artist Handle
                </label>
                <Input
                  id="artist-handle"
                  value={artistHandle}
                  onChange={(e) => setArtistHandle(e.target.value)}
                  disabled={isSubmitting || handleFromAuth || isLoadingHandle}
                  placeholder={isLoadingHandle ? "Loading Lens handle…" : "@username"}
                  className={fieldClass}
                />
                {handleFromAuth && (
                  <p className={cn("text-[11px]", songCupMuted)}>Linked from your Orb account</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="email" className={cn("text-sm font-medium", songCupBody)}>
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting || emailFromAuth}
                  className={fieldClass}
                />
                {emailFromAuth && (
                  <p className={cn("text-[11px]", songCupMuted)}>From your Creative TV login</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="description" className={cn("text-sm font-medium", songCupBody)}>
                  Description about the track
                </label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isSubmitting}
                  rows={3}
                  className={cn(fieldClass, "min-h-[85px] resize-none py-3")}
                />
              </div>

              <div className="space-y-2 pt-1">
                <div className={cn("rounded-[16px] border p-3", songCupPanelInset)}>
                  {isAttestationLoading ? (
                    <div className={cn("flex items-center gap-2 text-sm", songCupMuted)}>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Checking terms attestation…
                    </div>
                  ) : isAttested ? (
                    <div className={cn("flex items-center gap-2 text-sm", songCupBody)}>
                      <CheckCircle2 className={cn("h-5 w-5 shrink-0", songCupAccentYellow)} />
                      Terms &amp; Conditions attestation confirmed
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className={cn("text-sm", songCupMuted)}>
                        Sign an on-chain attestation to agree to the Terms &amp; Conditions before
                        submitting your entry.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setAttestationModalOpen(true)}
                      >
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        Sign Terms Attestation
                      </Button>
                    </div>
                  )}
                </div>

                <SongCupCheckbox
                  id="upload-video"
                  label="Upload Video"
                  checked={uploadVideoEnabled}
                  onChange={(checked) => {
                    setUploadVideoEnabled(checked);
                    if (!checked) setSelectedVideo(null);
                  }}
                />
              </div>

              {uploadVideoEnabled && (
                <div className={cn("space-y-3 rounded-[20px] p-3", songCupPanelInset)}>
                  {!hasWallet && (
                    <p className={cn("flex items-center gap-2 text-xs", songCupMuted)}>
                      <AlertCircle className="h-3.5 w-3.5" />
                      Connect your wallet to load your library.
                    </p>
                  )}
                  <CreativeTVVideoPicker
                    videos={videos}
                    loading={libraryLoading}
                    selected={selectedVideo}
                    onSelect={setSelectedVideo}
                    disabled={!hasWallet || isSubmitting}
                  />
                  {!libraryLoading && hasWallet && videos.length === 0 && (
                    <p className={cn("text-xs", songCupMuted)}>
                      No published videos yet.{" "}
                      <Link href="/upload" className="underline text-[#feed01]">
                        Upload on Creative TV
                      </Link>{" "}
                      first, then return here to submit.
                    </p>
                  )}
                </div>
              )}

              {!user?.address && (
                <p className={cn("text-xs", songCupMuted)}>Connect your wallet to submit an entry.</p>
              )}

              <Button
                type="button"
                disabled={isSubmitting || !isAttested}
                onClick={() => void handleSubmit()}
                className={cn("mx-auto mt-2 flex h-10 w-[160px] disabled:opacity-50", songCupGradientCta)}
              >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                SUBMIT
              </Button>
            </div>
            )}
          </div>
        </div>

        <aside className="flex shrink-0 flex-col items-center gap-4 lg:pt-16">
          {selectedVideo?.location && (
            <div className={cn("flex items-center gap-2 text-xs text-[#feed01]")}>
              <Film className="h-4 w-4" />
              Video selected
            </div>
          )}
        </aside>
      </div>

      <SongCupAdminSubmissionsList className="mt-6" />

      <SongCupAttestationModal
        open={attestationModalOpen}
        onOpenChange={setAttestationModalOpen}
        onVerified={() => setAttestationModalOpen(false)}
      />
    </div>
  );
}
