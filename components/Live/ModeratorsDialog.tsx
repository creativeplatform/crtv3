"use client";

import { useCallback, useEffect, useState } from "react";
import { isAddress } from "viem";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldCheck, Trash2, AlertCircle, Loader2, Bot } from "lucide-react";
import { toast } from "sonner";
import { formatAddress } from "@/lib/helpers";
import {
  addModerator,
  listModerators,
  removeModerator,
  type ModeratorRecord,
} from "@/services/stream-moderation";
import { useCreatorProfile } from "@/lib/hooks/metokens/useCreatorProfile";
import { useWalletAuth } from "@/lib/auth/useWalletAuth";
import { logger } from "@/lib/utils/logger";

interface ModeratorsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  streamId: string;
  creatorAddress: string;
}

interface AuthHeaders {
  "X-Wallet-Address": string;
  "X-Wallet-Timestamp": string;
  "X-Wallet-Signature": string;
}

function headersToAuthArgs(headers: AuthHeaders) {
  return {
    address: headers["X-Wallet-Address"],
    timestamp: Number(headers["X-Wallet-Timestamp"]),
    signature: headers["X-Wallet-Signature"],
  };
}

export function ModeratorsDialog({
  open,
  onOpenChange,
  streamId,
  creatorAddress,
}: ModeratorsDialogProps) {
  const [moderators, setModerators] = useState<ModeratorRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newAddress, setNewAddress] = useState("");
  const { profile } = useCreatorProfile(creatorAddress);
  const { getAuthHeaders } = useWalletAuth();

  const refresh = useCallback(async () => {
    if (!streamId) return;
    setLoading(true);
    setError(null);
    try {
      const records = await listModerators(streamId);
      setModerators(records);
    } catch (err) {
      logger.error("Failed to list moderators:", err);
      setError(err instanceof Error ? err.message : "Failed to load moderators");
    } finally {
      setLoading(false);
    }
  }, [streamId]);

  useEffect(() => {
    if (open) {
      refresh();
    }
  }, [open, refresh]);

  const handleAdd = async (address: string) => {
    if (!isAddress(address)) {
      setError("Enter a valid EVM address (0x…)");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      await addModerator(streamId, address, headersToAuthArgs(headers as AuthHeaders));
      toast.success(`Added ${formatAddress(address)} as moderator`);
      setNewAddress("");
      refresh();
    } catch (err) {
      logger.error("Failed to add moderator:", err);
      const msg = err instanceof Error ? err.message : "Failed to add moderator";
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (address: string) => {
    setSubmitting(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      await removeModerator(streamId, address, headersToAuthArgs(headers as AuthHeaders));
      toast.success(`Removed ${formatAddress(address)}`);
      refresh();
    } catch (err) {
      logger.error("Failed to remove moderator:", err);
      const msg = err instanceof Error ? err.message : "Failed to remove moderator";
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const twinEnabled = profile?.twin_enabled && profile?.twin_address;
  const twinAlreadyMod =
    twinEnabled &&
    moderators.some(
      (m) => m.moderator_address.toLowerCase() === profile?.twin_address?.toLowerCase()
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Manage Moderators
          </DialogTitle>
          <DialogDescription>
            Moderators can hide messages and ban users in this stream's chat.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAdd(newAddress.trim());
            }}
            className="space-y-2"
          >
            <label className="text-xs font-medium text-muted-foreground">
              Add moderator by EVM address
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="0x…"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                disabled={submitting}
              />
              <Button type="submit" disabled={submitting || !newAddress.trim()}>
                Add
              </Button>
            </div>
          </form>

          {twinEnabled && profile?.twin_address && !twinAlreadyMod && (
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              disabled={submitting}
              onClick={() => handleAdd(profile.twin_address!)}
            >
              <Bot className="h-4 w-4" />
              Add my Digital Twin as moderator ({formatAddress(profile.twin_address)})
            </Button>
          )}

          <div className="border-t pt-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Current moderators
            </p>
            {loading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading…
              </div>
            ) : moderators.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No moderators appointed. The stream creator can always moderate.
              </p>
            ) : (
              <ul className="space-y-1">
                {moderators.map((m) => (
                  <li
                    key={m.moderator_address}
                    className="flex items-center justify-between text-xs rounded-md border px-2 py-1.5"
                  >
                    <span className="font-mono">{formatAddress(m.moderator_address)}</span>
                    <button
                      type="button"
                      onClick={() => handleRemove(m.moderator_address)}
                      disabled={submitting}
                      className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                      title="Remove moderator"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
