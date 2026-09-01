"use client";

import { useCallback, useState } from "react";
import { executePostAction } from "@lens-protocol/client/actions";
import { evmAddress, postId } from "@lens-protocol/client";
import { useLensOrbWrite } from "@/hooks/useLensOrbWrite";
import { ORB_POLL_ACTION_ADDRESS } from "@/lib/sdk/orb/polls/constants";
import { getOrbPollVoteParams } from "@/lib/sdk/orb/polls/params";
import type { SongCupVoteChoice } from "@/lib/sdk/supabase/song-cup-votes";
import {
  clearStaleOrbSessionIfNeeded,
  isIncompleteOrbSessionError,
} from "@/lib/sdk/orb/session-errors";
import { formatOrbAuthError } from "@/lib/sdk/orb/format-auth-error";
import { toast } from "sonner";

function choiceToPollIndex(choice: SongCupVoteChoice): number {
  return choice === "left" ? 0 : 1;
}

export function useSongCupOrbPollVote() {
  const { canWrite, needsOrbReauth, getSessionClient, promptWriteAccess } = useLensOrbWrite();
  const [isVoting, setIsVoting] = useState(false);

  const voteOnPoll = useCallback(
    async (pollPostId: string, choice: SongCupVoteChoice): Promise<boolean> => {
      if (!pollPostId) {
        toast.error("This matchup has no poll configured yet");
        return false;
      }

      if (!canWrite) {
        promptWriteAccess();
        toast.info(
          needsOrbReauth
            ? "Sign in again with Orb to vote on Lens."
            : "Link your Orb account to vote.",
        );
        return false;
      }

      setIsVoting(true);
      try {
        const client = await getSessionClient();
        const params = getOrbPollVoteParams([choiceToPollIndex(choice)]);

        const result = await executePostAction(client, {
          post: postId(pollPostId),
          action: {
            unknown: {
              address: evmAddress(ORB_POLL_ACTION_ADDRESS),
              params,
            },
          },
        });

        if (result.isErr()) {
          throw new Error(result.error.message);
        }

        return true;
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
              : "Could not submit vote",
        );
        return false;
      } finally {
        setIsVoting(false);
      }
    },
    [canWrite, needsOrbReauth, getSessionClient, promptWriteAccess],
  );

  return { voteOnPoll, isVoting, canWrite, promptWriteAccess };
}
