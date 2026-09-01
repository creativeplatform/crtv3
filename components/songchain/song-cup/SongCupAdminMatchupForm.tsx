"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { parseOrbPostUrl } from "@/lib/songchain/song-cup/parse-orb-post-url";
import { fetchOrbPost } from "./SongCupOrbPostEmbed";
import type { SongCupMatchup, SongCupMatchupStatus } from "@/lib/sdk/supabase/song-cup-matchups";
import type { SongCupMatchupWithVotes } from "@/lib/hooks/song-cup/useSongCupMatchups";
import { deriveMatchupStatusFromTimes } from "@/lib/songchain/song-cup/matchup-lifecycle";
import { toast } from "sonner";
import {
  songCupAccentYellow,
  songCupAdminSection,
  songCupBody,
  songCupField,
  songCupGradientCta,
  songCupLabel,
  songCupMuted,
  songCupPanelInset,
} from "@/lib/songchain/song-cup/panel-styles";
import { cn } from "@/lib/utils/utils";

type SongCupAdminMatchupFormProps = {
  matchups: SongCupMatchupWithVotes[];
  onCreate: (data: {
    title: string;
    subtitle?: string;
    left_orb_url: string;
    right_orb_url: string;
    left_post_id?: string;
    right_post_id?: string;
    left_label?: string;
    right_label?: string;
    status?: SongCupMatchupStatus;
    starts_at?: string;
    ends_at?: string;
  }) => Promise<SongCupMatchup | null>;
  onUpdateStatus: (id: string, status: SongCupMatchupStatus) => Promise<boolean>;
  onRemove: (id: string) => Promise<boolean>;
  className?: string;
  scheduleMode?: boolean;
};

export function SongCupAdminMatchupForm({
  matchups,
  onCreate,
  onUpdateStatus,
  onRemove,
  className,
  scheduleMode = false,
}: SongCupAdminMatchupFormProps) {
  const [title, setTitle] = useState("SEMI FINALS");
  const [subtitle, setSubtitle] = useState("");
  const [leftUrl, setLeftUrl] = useState("");
  const [rightUrl, setRightUrl] = useState("");
  const [leftLabel, setLeftLabel] = useState("");
  const [rightLabel, setRightLabel] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [status, setStatus] = useState<SongCupMatchupStatus>("active");
  const [saving, setSaving] = useState(false);

  const toIsoOrUndefined = (local: string): string | undefined => {
    if (!local.trim()) return undefined;
    const [datePart, timePart] = local.split("T");
    if (!datePart || !timePart) return undefined;
    const [year, month, day] = datePart.split("-").map(Number);
    const [hours, minutes] = timePart.split(":").map(Number);
    if ([year, month, day, hours, minutes].some((n) => !Number.isFinite(n))) {
      return undefined;
    }
    const date = new Date(year, month - 1, day, hours, minutes);
    return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
  };

  const handleCreate = async () => {
    if (!title.trim() || !leftUrl.trim() || !rightUrl.trim()) {
      toast.error("Title and both Orb links are required");
      return;
    }

    const leftPostId = parseOrbPostUrl(leftUrl);
    const rightPostId = parseOrbPostUrl(rightUrl);
    if (!leftPostId || !rightPostId) {
      toast.error("Could not parse Lens post id from one or both Orb links");
      return;
    }

    setSaving(true);
    try {
      const [leftPost, rightPost] = await Promise.all([
        fetchOrbPost(leftUrl, leftPostId),
        fetchOrbPost(rightUrl, rightPostId),
      ]);

      if (!leftPost || !rightPost) {
        toast.error("Could not load one or both Orb posts — check the links");
        return;
      }

      const startsIso = toIsoOrUndefined(startsAt);
      const endsIso = toIsoOrUndefined(endsAt);
      if (startsIso && endsIso && new Date(startsIso) >= new Date(endsIso)) {
        toast.error("Start time must be before end time");
        return;
      }
      const derivedStatus =
        startsIso || endsIso
          ? deriveMatchupStatusFromTimes(startsIso, endsIso)
          : status;

      const row = await onCreate({
        title: title.trim(),
        subtitle: subtitle.trim() || undefined,
        left_orb_url: leftUrl.trim(),
        right_orb_url: rightUrl.trim(),
        left_post_id: leftPostId,
        right_post_id: rightPostId,
        left_label: leftLabel.trim() || leftPost.author,
        right_label: rightLabel.trim() || rightPost.author,
        status: derivedStatus,
        starts_at: startsIso,
        ends_at: endsIso,
      });

      if (row) {
        if (scheduleMode) {
          toast.success("Scheduled matchup saved");
        } else if (!row.poll_post_id) {
          toast.warning("Matchup saved, but Lens poll was not created — votes will use legacy mode");
        } else {
          toast.success("Matchup and Lens poll created");
        }
        setLeftUrl("");
        setRightUrl("");
        setLeftLabel("");
        setRightLabel("");
      } else {
        toast.error("Failed to save matchup");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not create matchup — try again",
      );
    } finally {
      setSaving(false);
    }
  };

  const inputClass = cn(songCupField, "h-10 rounded-md");

  return (
    <section className={cn(songCupAdminSection, className)}>
      <h3 className={cn("mb-4 text-lg font-bold uppercase tracking-wide", songCupAccentYellow)}>
        {scheduleMode ? "Schedule matchup" : "Create vote matchup"}
      </h3>
      <p className={cn("mb-4 text-xs", songCupMuted)}>
        Paste Orb post links from the Song Cup feed.
        {!scheduleMode && " A Lens poll is created automatically with both entries as vote options."}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Round title (e.g. SEMI FINALS)"
          className={cn(inputClass, "sm:col-span-2")}
        />
        <Input
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          placeholder="Subtitle (e.g. Today, 11 June)"
          className={cn(inputClass, "sm:col-span-2")}
        />
        <Input
          value={leftUrl}
          onChange={(e) => setLeftUrl(e.target.value)}
          placeholder="Left Orb link"
          className={inputClass}
        />
        <Input
          value={rightUrl}
          onChange={(e) => setRightUrl(e.target.value)}
          placeholder="Right Orb link"
          className={inputClass}
        />
        <Input
          value={leftLabel}
          onChange={(e) => setLeftLabel(e.target.value)}
          placeholder="Left label (optional)"
          className={inputClass}
        />
        <Input
          value={rightLabel}
          onChange={(e) => setRightLabel(e.target.value)}
          placeholder="Right label (optional)"
          className={inputClass}
        />
        <Input
          type="datetime-local"
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
          className={inputClass}
          aria-label="Start time"
        />
        <Input
          type="datetime-local"
          value={endsAt}
          onChange={(e) => setEndsAt(e.target.value)}
          className={inputClass}
          aria-label="End time"
        />
        <Select value={status} onValueChange={(v) => setStatus(v as SongCupMatchupStatus)}>
          <SelectTrigger className={inputClass}>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="past">Past</SelectItem>
          </SelectContent>
        </Select>
        <Button
          type="button"
          onClick={() => void handleCreate()}
          disabled={saving}
          className={cn("gap-2", songCupGradientCta)}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Create matchup
        </Button>
      </div>

      {matchups.length > 0 && (
        <div className="mt-6 space-y-2">
          <p className={cn("text-xs font-semibold uppercase tracking-wide", songCupLabel)}>
            Existing matchups
          </p>
          <ul className="space-y-2">
            {matchups.map((m) => (
              <li
                key={m.id}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm",
                  songCupPanelInset,
                  songCupBody,
                )}
              >
                <span className="font-medium">{m.title}</span>
                <div className="flex items-center gap-2">
                  <Select
                    value={m.status}
                    onValueChange={(v) => void onUpdateStatus(m.id, v as SongCupMatchupStatus)}
                  >
                    <SelectTrigger className={cn(inputClass, "h-8 w-[120px] text-xs")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upcoming">Upcoming</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="past">Past</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-400 hover:text-red-300"
                    onClick={() => void onRemove(m.id)}
                    aria-label="Delete matchup"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
