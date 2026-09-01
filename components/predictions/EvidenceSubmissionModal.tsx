"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSmartAccountClient } from "@/lib/wallet/react";
import { submitEvidence } from "@/lib/sdk/reality-eth/reality-eth-arbitrator";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Upload } from "lucide-react";
import { logger } from "@/lib/utils/logger";
import { useIpfsService } from "@/lib/hooks/ipfs/useIpfsService";

interface EvidenceSubmissionModalProps {
  questionId: string;
  trigger?: React.ReactNode;
}

export function EvidenceSubmissionModal({
  questionId,
  trigger,
}: EvidenceSubmissionModalProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [uri, setUri] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { client: smartAccountClient } = useSmartAccountClient({});
  const { toast } = useToast();
  const { ipfsService, isReady: isHeliaReady } = useIpfsService();

  const handleFileUpload = async (file: File) => {
    if (!ipfsService) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: "IPFS service is not initialized yet.",
      });
      return;
    }
    setIsUploading(true);
    try {
      let fileUri = "";
      const fileResult = await ipfsService.uploadFile(file);
      if (!fileResult.success || !fileResult.url) {
        throw new Error(fileResult.error ?? "File upload failed");
      }
      fileUri = fileResult.url;

      const metadata = {
        name: title || file.name,
        description: description || "",
        fileURI: fileUri,
      };
      const metaBlob = new Blob([JSON.stringify(metadata)], {
        type: "application/json",
      });
      const metaFile = new File([metaBlob], "evidence-metadata.json", {
        type: "application/json",
      });
      const metaResult = await ipfsService.uploadFile(metaFile);
      if (!metaResult.success || !metaResult.url) {
        setUri(fileUri);
        toast({
          title: "File uploaded",
          description: "Using direct file URI (metadata upload failed).",
        });
        return;
      }
      setUri(metaResult.url);
      toast({
        title: "Evidence uploaded",
        description: "ERC-1497 metadata URI ready for submission.",
      });
    } catch (err) {
      logger.error("Evidence upload failed:", err);
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Could not upload to IPFS",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!smartAccountClient) {
      toast({
        variant: "destructive",
        title: "Wallet not connected",
        description: "Please connect your wallet to submit evidence.",
      });
      return;
    }

    if (!uri) {
      toast({
        variant: "destructive",
        title: "Evidence Link Required",
        description: "Upload a file or provide an IPFS URI.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const txHash = await submitEvidence(smartAccountClient, questionId, uri);

      toast({
        title: "Evidence Submitted",
        description: "Your evidence transaction has been sent.",
      });

      logger.info("Evidence submitted:", { questionId, txHash });
      setOpen(false);
      setTitle("");
      setDescription("");
      setUri("");
    } catch (error: unknown) {
      logger.error("Error submitting evidence:", error);
      toast({
        variant: "destructive",
        title: "Submission Failed",
        description:
          error instanceof Error ? error.message : "Failed to submit evidence transaction.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button variant="outline">Submit Evidence</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Submit Evidence</DialogTitle>
          <DialogDescription>
            Submit evidence to the Kleros Arbitrator to resolve a dispute.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="e.g. Official Match Results"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Explain what this evidence proves..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label>Upload evidence file</Label>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,application/pdf,application/json,.json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFileUpload(file);
                }}
              />
              <Button
                type="button"
                variant="outline"
                disabled={isUploading || !isHeliaReady}
                onClick={() => fileInputRef.current?.click()}
              >
                {isUploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                {isUploading ? "Uploading…" : "Upload to IPFS"}
              </Button>
              {!isHeliaReady && (
                <p className="text-xs text-muted-foreground">
                  IPFS service initializing… you can paste a URI manually below.
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="uri">
                Evidence Link (URI) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="uri"
                placeholder="https://w3s.link/ipfs/..."
                value={uri}
                onChange={(e) => setUri(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Auto-filled after upload, or paste an IPFS / ERC-1497 JSON URI.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || isUploading || !uri}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Transaction
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
