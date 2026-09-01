"use client";

import { useCallback, useState } from "react";
import { post } from "@lens-protocol/client/actions";
import { evmAddress, uri } from "@lens-protocol/client";
import { textOnly } from "@lens-protocol/metadata";
import { useLensOrbWrite } from "@/hooks/useLensOrbWrite";
import { groveService } from "@/lib/sdk/grove/service";
import { ORB_POLL_ACTION_ADDRESS } from "@/lib/sdk/orb/polls/constants";
import { getOrbPollCreateParams } from "@/lib/sdk/orb/polls/params";
import { SONG_CUP_CLUB_FEED_ID } from "@/lib/songchain/events";
import { extractCreatedPostId } from "@/lib/songchain/post-utils";
import {
  clearStaleOrbSessionIfNeeded,
  isIncompleteOrbSessionError,
} from "@/lib/sdk/orb/session-errors";
import { formatOrbAuthError } from "@/lib/sdk/orb/format-auth-error";
import { toast } from "sonner";

const MAX_POLL_DURATION_SEC = 7 * 24 * 60 * 60;

export type CreateSongCupPollInput = {
  title: string;
  leftLabel: string;
  rightLabel: string;
  endsAt?: string | null;
};

function resolvePollEndTimestamp(endsAt?: string | null): number {
  if (endsAt) {
    const ms = Date.parse(endsAt);
    if (!Number.isNaN(ms)) {
      return Math.floor(ms / 1000);
    }
  }
  return Math.floor(Date.now() / 1000) + MAX_POLL_DURATION_SEC;
}

export function useSongCupOrbPollCreate() {
  const { canWrite, needsOrbReauth, getSessionClient, promptWriteAccess } = useLensOrbWrite();
  const [isCreating, setIsCreating] = useState(false);

  const createPollPost = useCallback(
    async ({
      title,
      leftLabel,
      rightLabel,
      endsAt,
    }: CreateSongCupPollInput): Promise<string | null> => {
      if (!canWrite) {
        promptWriteAccess();
        toast.info(
          needsOrbReauth
            ? "Sign in again with Orb to create polls on Lens."
            : "Link your Orb account to create polls.",
        );
        return null;
      }

      setIsCreating(true);
      try {
        const client = await getSessionClient();
        const endTimestamp = resolvePollEndTimestamp(endsAt);
        const questions = [leftLabel.trim() || "Left", rightLabel.trim() || "Right"];

        const metadata = textOnly({
          content: title.trim() || "Song Cup vote",
          locale: "en",
        });

        const uploadResult = await groveService.uploadJson(metadata);
        if (!uploadResult.success || !uploadResult.url) {
          throw new Error("Failed to upload poll metadata");
        }

        const pollParams = getOrbPollCreateParams({
          endTimestamp,
          allowMultipleAnswers: false,
          questions,
        });

        const result = await post(client, {
          contentUri: uri(uploadResult.url),
          feed: evmAddress(SONG_CUP_CLUB_FEED_ID),
          actions: [
            {
              unknown: {
                address: evmAddress(ORB_POLL_ACTION_ADDRESS),
                params: pollParams,
              },
            },
          ],
        });

        if (result.isErr()) {
          throw new Error(result.error.message);
        }

        const createdId = extractCreatedPostId(result.value);
        if (!createdId) {
          toast.success("Poll submitted — indexing may take a moment");
          return null;
        }

        return createdId;
      } catch (err) {
        const cleared = clearStaleOrbSessionIfNeeded(err);
        if (cleared || isIncompleteOrbSessionError(err)) {
          promptWriteAccess();
        }
        toast.error(
          isIncompleteOrbSessionError(err)
            ? formatOrbAuthError(err)
            : err instanceof Error
              ? err.message
              : "Could not create poll",
        );
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    [canWrite, needsOrbReauth, getSessionClient, promptWriteAccess],
  );

  return { createPollPost, isCreating, canWrite, promptWriteAccess };
}
