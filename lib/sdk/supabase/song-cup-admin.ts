import { createServiceClient } from "@/lib/sdk/supabase/service";
import type { SongCupSubmission } from "@/lib/sdk/supabase/song-cup-submissions";
import { serverLogger } from "@/lib/utils/logger";

/** Service-role list of all Song Cup submissions (bypasses RLS). Server-only. */
export async function listSongCupSubmissionsAsAdmin(): Promise<SongCupSubmission[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("song_cup_submissions")
    .select("*")
    .order("is_favorite", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    serverLogger.error("[songCupAdmin] list error:", error);
    throw new Error(error.message);
  }
  return (data ?? []) as SongCupSubmission[];
}

export async function updateSongCupSubmissionStatusAsAdmin(
  id: string,
  status: SongCupSubmission["status"],
): Promise<boolean> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("song_cup_submissions")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    serverLogger.error("[songCupAdmin] updateStatus error:", error);
    return false;
  }
  return true;
}

export async function setSongCupSubmissionFavoriteAsAdmin(
  id: string,
  isFavorite: boolean,
): Promise<boolean> {
  const supabase = createServiceClient();
  const updates: Record<string, unknown> = {
    is_favorite: isFavorite,
    updated_at: new Date().toISOString(),
  };
  if (isFavorite) updates.status = "approved";

  const { error } = await supabase
    .from("song_cup_submissions")
    .update(updates)
    .eq("id", id);

  if (error) {
    serverLogger.error("[songCupAdmin] setFavorite error:", error);
    return false;
  }
  return true;
}
