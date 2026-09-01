"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Type } from "lucide-react";
import { toast } from "sonner";
import { updateStream } from "@/services/streams";
import { useWalletAuth } from "@/lib/auth/useWalletAuth";
import { walletAuthHeadersToArgs } from "@/lib/auth/require-wallet";
import { logger } from "@/lib/utils/logger";

const MAX_NAME_LENGTH = 100;

interface StreamNameEditorProps {
  creatorAddress: string;
  currentName?: string | null;
  onNameUpdated: (name: string) => void;
}

export function StreamNameEditor({
  creatorAddress,
  currentName,
  onNameUpdated,
}: StreamNameEditorProps) {
  const [name, setName] = useState(currentName?.trim() || "Live Stream");
  const [isSaving, setIsSaving] = useState(false);
  const { getAuthHeaders } = useWalletAuth();

  useEffect(() => {
    setName(currentName?.trim() || "Live Stream");
  }, [currentName]);

  const saveName = async () => {
    if (isSaving) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Stream title cannot be empty");
      return;
    }

    if (trimmedName === (currentName?.trim() || "Live Stream")) {
      return;
    }

    try {
      setIsSaving(true);
      const auth = walletAuthHeadersToArgs(await getAuthHeaders());
      await updateStream(creatorAddress, { name: trimmedName }, auth);
      onNameUpdated(trimmedName);
      toast.success("Stream title updated");
    } catch (error) {
      logger.error("Error updating stream name:", error);
      toast.error("Failed to update stream title. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleBlur = () => {
    void saveName();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    }
  };

  const isDirty = name.trim() !== (currentName?.trim() || "Live Stream");
  const isEmpty = name.trim().length === 0;

  return (
    <div className="flex flex-col items-center gap-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800/50">
      <h3 className="font-semibold flex items-center gap-2">
        <Type className="w-4 h-4" />
        Stream Title
      </h3>

      <div className="flex w-full max-w-xs flex-col gap-2">
        <Input
          id="stream-name"
          name="streamName"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, MAX_NAME_LENGTH))}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="Live Stream"
          maxLength={MAX_NAME_LENGTH}
          disabled={isSaving}
          aria-label="Stream title"
        />
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-gray-500">
            {name.length}/{MAX_NAME_LENGTH}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void saveName()}
            disabled={isSaving || isEmpty || !isDirty}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Title"
            )}
          </Button>
        </div>
      </div>

      <p className="text-xs text-gray-500 text-center max-w-xs">
        This title appears on the live grid, share dialogs, and when viewers discover your stream.
      </p>
    </div>
  );
}
