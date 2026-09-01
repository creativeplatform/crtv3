import { createServiceClient } from "@/lib/sdk/supabase/service";
import type { HackBetaSubmission } from "@/lib/sdk/supabase/hack-beta-submissions";
import type { HackBetaSettings } from "@/lib/sdk/supabase/hack-beta-settings";
import { serverLogger } from "@/lib/utils/logger";

/** Service-role list of all Hack Beta submissions (bypasses RLS). Server-only. */
export async function listHackBetaSubmissionsAsAdmin(): Promise<HackBetaSubmission[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("hack_beta_submissions")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    serverLogger.error("[hackBetaAdmin] list error:", error);
    throw new Error(error.message);
  }
  return (data ?? []) as HackBetaSubmission[];
}

export async function updateHackBetaSubmissionStatusAsAdmin(
  id: string,
  status: HackBetaSubmission["status"],
): Promise<boolean> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("hack_beta_submissions")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    serverLogger.error("[hackBetaAdmin] updateStatus error:", error);
    return false;
  }
  return true;
}

export async function setHackBetaSubmissionFavoriteAsAdmin(
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
    .from("hack_beta_submissions")
    .update(updates)
    .eq("id", id);

  if (error) {
    serverLogger.error("[hackBetaAdmin] setFavorite error:", error);
    return false;
  }
  return true;
}

export async function updateHackBetaMixtapeUrlAsAdmin(
  url: string | null,
  updatedBy: string,
): Promise<HackBetaSettings | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("hack_beta_settings")
    .update({
      mixtape_playlist_url: url?.trim() || null,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy.toLowerCase(),
    })
    .eq("id", "default")
    .select("*")
    .single();

  if (error) {
    serverLogger.error("[hackBetaAdmin] updateMixtapeUrl error:", error);
    return null;
  }
  return data as HackBetaSettings;
}
