"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useHackBetaSubmissions } from "@/lib/hooks/hack-beta/useHackBetaSubmissions";
import { useHackBetaSettings } from "@/lib/hooks/hack-beta/useHackBetaSettings";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, RefreshCw, Save } from "lucide-react";
import {
  HackBetaSubmissionReviewCard,
  HACK_BETA_STATUS_FILTERS,
  filterHackBetaSubmissions,
  type HackBetaSubmissionStatusFilter,
} from "@/components/chones/hack-beta/HackBetaSubmissionReviewCard";
import {
  HACK_BETA_ADMIN_WALLETS,
  truncateWalletAddress,
} from "@/lib/chones/hack-beta/admin-config";
import { toast } from "sonner";

export default function HackBetaSubmissionsPage() {
  const [statusFilter, setStatusFilter] = useState<HackBetaSubmissionStatusFilter>("pending");
  const {
    submissions,
    isLoading,
    error,
    refetch,
    updateStatus,
    setFavorite,
    isAdmin,
    walletAddress,
    isAdminLoading,
  } = useHackBetaSubmissions(true);
  const { mixtapePlaylistUrl, updateMixtapeUrl, isLoading: settingsLoading } =
    useHackBetaSettings();
  const [mixtapeDraft, setMixtapeDraft] = useState<string | null>(null);
  const [savingMixtape, setSavingMixtape] = useState(false);

  const mixtapeValue = mixtapeDraft ?? mixtapePlaylistUrl ?? "";

  const filtered = useMemo(
    () => filterHackBetaSubmissions(submissions, statusFilter),
    [submissions, statusFilter],
  );

  const pendingCount = useMemo(
    () => submissions.filter((s) => s.status === "pending").length,
    [submissions],
  );

  const saveMixtape = async () => {
    if (!isAdmin) return;
    setSavingMixtape(true);
    try {
      const row = await updateMixtapeUrl(mixtapeValue.trim() || null, walletAddress);
      if (!row) {
        toast.error("Failed to save mixtape URL");
        return;
      }
      setMixtapeDraft(null);
      toast.success("Mixtape playlist URL saved");
    } finally {
      setSavingMixtape(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-6 md:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <nav className="text-sm text-muted-foreground">
          <Link href="/chones" className="hover:text-foreground">
            Chones
          </Link>
          <span className="mx-2">/</span>
          <Link href="/chones/hack-beta" className="hover:text-foreground">
            HACKATHON BETA
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">Submissions</span>
        </nav>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Hack Beta Submissions
            </h1>
            <p className="text-sm text-muted-foreground">
              Review demos, mark favorites, and set the featured Mixtape playlist.
            </p>
            {isAdmin && (
              <p className="mt-1 text-xs text-muted-foreground">
                {pendingCount} pending · {submissions.length} total
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {isAdminLoading && (
          <Card>
            <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              Resolving smart wallet…
            </CardContent>
          </Card>
        )}

        {!isAdminLoading && !walletAddress && (
          <Card>
            <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              Connect an admin wallet to review submissions.
            </CardContent>
          </Card>
        )}

        {!isAdminLoading && walletAddress && !isAdmin && (
          <Card>
            <CardContent className="space-y-2 p-4 text-sm">
              <p className="flex items-center gap-2 text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                {truncateWalletAddress(walletAddress)} is not an admin wallet.
              </p>
              <p className="text-xs text-muted-foreground">
                Admins:{" "}
                {HACK_BETA_ADMIN_WALLETS.map((w) => truncateWalletAddress(w)).join(", ")}
              </p>
            </CardContent>
          </Card>
        )}

        {isAdmin && (
          <Card>
            <CardContent className="space-y-3 p-4">
              <h2 className="text-sm font-semibold">Mixtape playlist URL</h2>
              <p className="text-xs text-muted-foreground">
                Paste a playlist link from{" "}
                <a
                  href="https://air.creativeplatform.xyz/app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  Mixtape
                </a>
                . Shown on the public Hack Beta page.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={mixtapeValue}
                  onChange={(e) => setMixtapeDraft(e.target.value)}
                  placeholder="https://air.creativeplatform.xyz/..."
                  disabled={settingsLoading || savingMixtape}
                />
                <Button
                  onClick={() => void saveMixtape()}
                  disabled={savingMixtape}
                  className="gap-2 shrink-0"
                >
                  <Save className="h-4 w-4" />
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isAdmin && (
          <>
            <div className="flex flex-wrap gap-2">
              {HACK_BETA_STATUS_FILTERS.map((f) => (
                <Button
                  key={f.id}
                  size="sm"
                  variant={statusFilter === f.id ? "default" : "outline"}
                  onClick={() => setStatusFilter(f.id)}
                >
                  {f.label}
                </Button>
              ))}
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            {isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-64 rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((s) => (
                  <HackBetaSubmissionReviewCard
                    key={s.id}
                    submission={s}
                    onApprove={(id) => void updateStatus(id, "approved")}
                    onFavorite={(id, fav) => void setFavorite(id, fav)}
                    onReject={(id) => void updateStatus(id, "rejected")}
                  />
                ))}
              </div>
            )}

            {!isLoading && filtered.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-10">
                No submissions in this filter.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
