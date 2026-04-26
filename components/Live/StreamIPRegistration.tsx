"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Shield, CheckCircle2 } from "lucide-react";

const STORY_SCAN_BASE =
  process.env.NEXT_PUBLIC_STORY_NETWORK === "mainnet"
    ? "https://www.storyscan.io"
    : "https://aeneid.storyscan.io";

interface StreamIPRegistrationProps {
  creatorAddress: string;
  streamName?: string | null;
  thumbnailUrl?: string | null;
  storyIpId?: string | null;
  licenseTermsId?: string | null;
  commercialRevShare?: number | null;
  onRegistered?: (result: {
    ipId: string;
    licenseTermsId: string | null;
    commercialRevShare: number;
  }) => void;
}

export function StreamIPRegistration({
  creatorAddress,
  streamName,
  thumbnailUrl,
  storyIpId,
  licenseTermsId,
  commercialRevShare,
  onRegistered,
}: StreamIPRegistrationProps) {
  const [revShare, setRevShare] = useState<string>("10");
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRegistered = !!storyIpId;

  async function handleRegister() {
    const share = Number(revShare);
    if (!Number.isFinite(share) || share < 0 || share > 100) {
      setError("Enter a royalty between 0 and 100.");
      return;
    }
    setIsRegistering(true);
    setError(null);
    try {
      const res = await fetch("/api/story/register-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorAddress,
          commercialRevShare: share,
          streamName: streamName || undefined,
          thumbnailUrl: thumbnailUrl || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || `Registration failed (${res.status})`);
        return;
      }
      onRegistered?.({
        ipId: data.ipId,
        licenseTermsId: data.licenseTermsId ?? null,
        commercialRevShare: data.commercialRevShare ?? share,
      });
    } catch (e: any) {
      setError(e?.message || "Failed to register stream as IP");
    } finally {
      setIsRegistering(false);
    }
  }

  if (isRegistered) {
    return (
      <div className="mt-4 border-t border-white/20 pt-3 max-w-[576px] mx-auto">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Registered as Story IP</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Viewer clips will mint as derivatives with{" "}
              <span className="font-medium">
                {commercialRevShare ?? 0}%
              </span>{" "}
              royalty back to you.
            </p>
            <a
              href={`${STORY_SCAN_BASE}/ip/${storyIpId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline mt-1 inline-block font-mono truncate"
              title={storyIpId!}
            >
              {storyIpId!.slice(0, 10)}…{storyIpId!.slice(-6)} →
            </a>
            {licenseTermsId && (
              <p className="text-[10px] text-gray-500 mt-0.5">
                License terms ID: {licenseTermsId}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-white/20 pt-3 max-w-[576px] mx-auto">
      <div className="flex items-center gap-2 mb-2">
        <Shield className="h-4 w-4" />
        <p className="text-sm font-semibold">Register this stream as IP</p>
      </div>
      <p className="text-xs text-gray-400 mb-3">
        Register your livestream as a Story Protocol IP Asset so viewers can mint their
        clips as derivative NFTs, with automatic royalties back to you.
      </p>
      <div className="flex flex-col sm:flex-row sm:items-end gap-2">
        <div className="flex-1">
          <Label htmlFor="rev-share" className="text-xs">
            Royalty share from clip sales (%)
          </Label>
          <Input
            id="rev-share"
            type="number"
            min={0}
            max={100}
            value={revShare}
            onChange={(e) => setRevShare(e.target.value)}
            disabled={isRegistering}
            className="mt-1"
          />
        </div>
        <Button onClick={handleRegister} disabled={isRegistering}>
          {isRegistering ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Registering...
            </>
          ) : (
            "Register as IP"
          )}
        </Button>
      </div>
      {error && (
        <Alert variant="destructive" className="mt-2">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
