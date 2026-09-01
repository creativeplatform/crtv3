"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { updateStream } from "@/services/streams";
import { useWalletAuth } from "@/lib/auth/useWalletAuth";
import { walletAuthHeadersToArgs } from "@/lib/auth/require-wallet";
import { useMeTokensSupabase } from "@/lib/hooks/metokens/useMeTokensSupabase";
import { logger } from "@/lib/utils/logger";

interface StreamMeTokenGateEditorProps {
  creatorAddress: string;
  requiresMetoken?: boolean;
  metokenPrice?: number | null;
  onGateUpdated: (config: { requiresMetoken: boolean; metokenPrice: number | null }) => void;
}

export function StreamMeTokenGateEditor({
  creatorAddress,
  requiresMetoken = false,
  metokenPrice = null,
  onGateUpdated,
}: StreamMeTokenGateEditorProps) {
  const { userMeToken, loading: meTokenLoading, checkUserMeToken } = useMeTokensSupabase();
  const { getAuthHeaders } = useWalletAuth();
  const [requireMeToken, setRequireMeToken] = useState(requiresMetoken);
  const [price, setPrice] = useState(
    metokenPrice !== null && metokenPrice !== undefined ? String(metokenPrice) : "0",
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    checkUserMeToken();
  }, [checkUserMeToken]);

  useEffect(() => {
    setRequireMeToken(requiresMetoken);
    setPrice(
      metokenPrice !== null && metokenPrice !== undefined ? String(metokenPrice) : "0",
    );
  }, [requiresMetoken, metokenPrice]);

  const saveGate = async () => {
    const parsedPrice = Number(price);
    if (requireMeToken && (Number.isNaN(parsedPrice) || parsedPrice < 0)) {
      toast.error("Enter a valid minimum balance (0 or greater)");
      return;
    }

    try {
      setIsSaving(true);
      const auth = walletAuthHeadersToArgs(await getAuthHeaders());
      await updateStream(
        creatorAddress,
        {
          requires_metoken: requireMeToken,
          metoken_price: requireMeToken ? parsedPrice : null,
        },
        auth,
      );
      onGateUpdated({
        requiresMetoken: requireMeToken,
        metokenPrice: requireMeToken ? parsedPrice : null,
      });
      toast.success("MeToken access settings saved");
    } catch (error) {
      logger.error("Error updating stream MeToken gate:", error);
      toast.error("Failed to save MeToken settings. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const isDirty =
    requireMeToken !== requiresMetoken ||
    (requireMeToken &&
      Number(price) !== (metokenPrice ?? 0));

  return (
    <div className="flex flex-col items-center gap-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800/50">
      <h3 className="font-semibold flex items-center gap-2">
        <Lock className="w-4 h-4" />
        MeToken Access
      </h3>

      {meTokenLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading MeToken...
        </div>
      ) : !userMeToken ? (
        <div className="text-center space-y-2 max-w-xs">
          <p className="text-sm text-muted-foreground">
            Create a MeToken first to gate live playback for your holders.
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/profile/${creatorAddress}`}>Create MeToken</Link>
          </Button>
        </div>
      ) : (
        <div className="flex w-full max-w-xs flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="require-metoken-live" className="text-sm">
              Require MeToken for Access
            </Label>
            <Switch
              id="require-metoken-live"
              checked={requireMeToken}
              onCheckedChange={setRequireMeToken}
              disabled={isSaving}
            />
          </div>

          {requireMeToken && (
            <div className="space-y-2">
              <Label htmlFor="metoken-min-balance">Minimum MeToken Balance Required</Label>
              <div className="relative">
                <Input
                  id="metoken-min-balance"
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="pr-20"
                  disabled={isSaving}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                  {userMeToken.symbol}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Users will need to hold at least this amount of your MeToken to watch live playback.
              </p>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => void saveGate()}
            disabled={isSaving || !isDirty}
            className="self-end"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Access Settings"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
