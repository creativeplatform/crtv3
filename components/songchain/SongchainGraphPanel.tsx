"use client";

import { useCallback, useEffect, useState } from "react";
import type { AnyClient } from "@lens-protocol/client";
import {
  fetchFollowStatus,
  fetchFollowing,
  fetchGraph,
} from "@lens-protocol/client/actions";
import { evmAddress } from "@lens-protocol/types";
import { createLensClient } from "@/lib/sdk/lens/create-client";
import { Button } from "@/components/ui/button";
import { Loader2, Share2, UserPlus } from "lucide-react";
import { useLensOrbWrite } from "@/hooks/useLensOrbWrite";
import { useSongchainFollow } from "@/hooks/useSongchainFollow";
import { clearStaleOrbSessionIfNeeded } from "@/lib/sdk/orb/session-errors";
import { checkLensGraphExists } from "@/lib/songchain/lens-graph";
import { toast } from "sonner";

type SongchainGraphPanelProps = {
  graphId: string | null;
  groupId: string | null;
};

function accountLabel(address: string, username?: string | null): string {
  if (username) return `@${username}`;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function SongchainGraphPanel({ graphId, groupId }: SongchainGraphPanelProps) {
  const { canWrite, lensAccount, getSessionClient } = useLensOrbWrite();
  const { unfollowAccount } = useSongchainFollow(graphId);
  const [name, setName] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [following, setFollowing] = useState<
    Array<{ address: string; username?: string | null }>
  >([]);

  const loadGraph = useCallback(async () => {
    if (!graphId) return;
    setLoading(true);
    setConfigError(null);
    try {
      const check = await checkLensGraphExists(graphId);
      if (!check.exists) {
        setConfigError(check.error);
        setName(null);
        setFollowing([]);
        return;
      }

      let client: AnyClient = createLensClient();
      if (canWrite) {
        try {
          client = await getSessionClient();
        } catch (err) {
          clearStaleOrbSessionIfNeeded(err);
          client = createLensClient();
        }
      }

      const graphResult = await fetchGraph(client, {
        graph: evmAddress(graphId),
      });
      if (graphResult.isErr()) throw new Error(graphResult.error.message);
      const graph = graphResult.value;
      if (!graph) {
        setConfigError("Graph not found on this Lens network.");
        return;
      }

      setName(graph.metadata?.name ?? "Songchain graph");
      setDescription(
        graph.metadata && "description" in graph.metadata
          ? String(graph.metadata.description ?? "")
          : null,
      );

      if (lensAccount) {
        const followingResult = await fetchFollowing(client, {
          account: evmAddress(lensAccount),
          filter: {
            graphs: [{ graph: evmAddress(graphId) }],
          },
          pageSize: "TEN",
        });
        if (followingResult.isOk()) {
          setFollowing(
            followingResult.value.items.map((item) => ({
              address: item.following.address,
              username: item.following.username?.localName ?? null,
            })),
          );
        }
      } else {
        setFollowing([]);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load graph");
    } finally {
      setLoading(false);
    }
  }, [graphId, canWrite, lensAccount, getSessionClient]);

  useEffect(() => {
    void loadGraph();
  }, [loadGraph]);

  if (!graphId) {
    return (
      <section className="rounded-lg border border-dashed border-border/60 p-8 text-center text-muted-foreground">
        <Share2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Graph address not configured yet.</p>
        <p className="mt-2 text-xs">
          Set <code>NEXT_PUBLIC_SONGCHAIN_GRAPH_ID</code> or{" "}
          <code>NEXT_PUBLIC_SONGCHAIN_APP_ID</code> (auto-resolves from the app).
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border/60 bg-card p-6 space-y-6">
      {loading && !name ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Share2 className="h-6 w-6 text-violet-400" />
              {name ?? "Social graph"}
            </h2>
            {description && (
              <p className="mt-2 text-sm text-muted-foreground max-w-xl">{description}</p>
            )}
            <p className="mt-2 text-xs text-muted-foreground font-mono">{graphId}</p>
          </div>

          {configError && (
            <p className="text-sm text-destructive">{configError}</p>
          )}

          <p className="text-sm text-muted-foreground">
            Follows on this graph use the Creative Member Social Graph. Following is
            group-gated — join the Songchain group
            {groupId ? ` (${groupId.slice(0, 6)}…${groupId.slice(-4)})` : ""} first,
            then follow creators from feed posts or here.
          </p>

          {canWrite && lensAccount ? (
            <div>
              <h3 className="text-sm font-semibold mb-2">
                You follow on this graph
              </h3>
              {following.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Not following anyone on this graph yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {following.map((item) => (
                    <li
                      key={item.address}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span>{accountLabel(item.address, item.username)}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void unfollowAccount(item.address).then((ok) => {
                            if (ok) void loadGraph();
                          })
                        }
                      >
                        Unfollow
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <UserPlus className="h-4 w-4 shrink-0" />
              Connect Orb and link your profile to follow on this graph.
            </p>
          )}
        </>
      )}
    </section>
  );
}

type SongchainFollowButtonProps = {
  graphId: string | null;
  accountAddress: string;
  className?: string;
};

/** Follow / unfollow an account on the configured Songchain graph. */
export function SongchainFollowButton({
  graphId,
  accountAddress,
  className,
}: SongchainFollowButtonProps) {
  const { canWrite, lensAccount, promptWriteAccess } = useLensOrbWrite();
  const { followAccount, unfollowAccount, graphAddress } =
    useSongchainFollow(graphId);
  const [isFollowing, setIsFollowing] = useState(false);
  const [checking, setChecking] = useState(true);
  const [pending, setPending] = useState(false);

  const isSelf =
    !!lensAccount &&
    lensAccount.toLowerCase() === accountAddress.toLowerCase();

  useEffect(() => {
    if (!graphAddress || !lensAccount || isSelf) {
      setChecking(false);
      setIsFollowing(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const client = createLensClient();
        const result = await fetchFollowStatus(client, {
          pairs: [
            {
              graph: evmAddress(graphAddress),
              follower: evmAddress(lensAccount),
              account: evmAddress(accountAddress),
            },
          ],
        });
        if (!cancelled && result.isOk() && result.value[0]) {
          setIsFollowing(Boolean(result.value[0].isFollowing));
        }
      } catch {
        if (!cancelled) setIsFollowing(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [graphAddress, lensAccount, accountAddress, isSelf]);

  if (!graphId || isSelf) return null;

  const toggle = async () => {
    if (!canWrite) {
      promptWriteAccess();
      toast.info("Connect Orb to follow on the Creative graph");
      return;
    }
    setPending(true);
    try {
      const ok = isFollowing
        ? await unfollowAccount(accountAddress)
        : await followAccount(accountAddress);
      if (ok) setIsFollowing(!isFollowing);
    } finally {
      setPending(false);
    }
  };

  return (
    <Button
      type="button"
      size="sm"
      variant={isFollowing ? "secondary" : "outline"}
      className={className}
      disabled={checking || pending}
      onClick={() => void toggle()}
    >
      {pending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : isFollowing ? (
        "Following"
      ) : (
        "Follow"
      )}
    </Button>
  );
}
