"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AnyClient } from "@lens-protocol/client";
import { fetchGroup, joinGroup, leaveGroup } from "@lens-protocol/client/actions";
import { evmAddress } from "@lens-protocol/types";
import { createLensClient } from "@/lib/sdk/lens/create-client";
import { useLensOrbWrite } from "@/hooks/useLensOrbWrite";
import { clearStaleOrbSessionIfNeeded } from "@/lib/sdk/orb/session-errors";
import { toast } from "sonner";

type UseSongchainGroupMembershipOptions = {
  groupId: string | null;
};

const MEMBERSHIP_SYNC_DELAYS_MS = [2000, 4000, 8000];

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveImageUri(raw: unknown): string | null {
  if (!raw) return null;
  let value: string | null = null;

  if (typeof raw === "string") {
    value = raw;
  } else if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    value =
      typeof obj.uri === "string"
        ? obj.uri
        : typeof obj.url === "string"
          ? obj.url
          : typeof obj.src === "string"
            ? obj.src
            : null;
  }

  if (!value) return null;

  // Lens sometimes returns URIs like `ipfs://cid...` or `ar://hash...`.
  // Convert them to HTTP gateway URLs so next/image and <img> can render them.
  if (value.startsWith("ipfs://")) {
    const cidAndPath = value.slice(7);
    return `https://ipfs.io/ipfs/${cidAndPath}`;
  }
  if (value.startsWith("ar://")) {
    const arHash = value.slice(5);
    return `https://arweave.net/${arHash}`;
  }

  return value;
}

function extractGroupImage(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const m = metadata as Record<string, unknown>;

  // Avatar / icon first, then cover picture / banner.
  const candidates = [m.icon, m.picture, m.logo, m.image, m.coverPicture];
  for (const candidate of candidates) {
    const resolved = resolveImageUri(candidate);
    if (resolved) return resolved;
  }

  return null;
}

function applyMembershipFromApi(
  memberFromApi: boolean,
  optimisticMemberRef: { current: boolean },
  setIsMember: (value: boolean) => void,
) {
  if (memberFromApi) {
    optimisticMemberRef.current = false;
    setIsMember(true);
    return;
  }
  if (optimisticMemberRef.current) {
    setIsMember(true);
    return;
  }
  setIsMember(false);
}

export function useSongchainGroupMembership({
  groupId,
}: UseSongchainGroupMembershipOptions) {
  const { canWrite, getSessionClient, promptWriteAccess } = useLensOrbWrite();
  const [name, setName] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [isPendingApproval, setIsPendingApproval] = useState(false);
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const optimisticMemberRef = useRef(false);
  const loadRef = useRef<(() => Promise<void>) | null>(null);

  const load = useCallback(async () => {
    if (!groupId) {
      optimisticMemberRef.current = false;
      setName(null);
      setDescription(null);
      setImageUrl(null);
      setIsMember(false);
      setIsPendingApproval(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let client: AnyClient = createLensClient();
      if (canWrite) {
        try {
          client = await getSessionClient();
        } catch (err) {
          clearStaleOrbSessionIfNeeded(err);
          client = createLensClient();
        }
      }

      const groupResult = await fetchGroup(client, {
        group: evmAddress(groupId),
      });
      if (groupResult.isErr()) throw new Error(groupResult.error.message);

      const group = groupResult.value;
      if (!group) {
        optimisticMemberRef.current = false;
        setName(null);
        setDescription(null);
        setImageUrl(null);
        applyMembershipFromApi(false, optimisticMemberRef, setIsMember);
        setError("Club not found on this Lens network.");
        return;
      }

      setName(group.metadata?.name ?? "Song Cup club");
      setDescription(
        group.metadata && "description" in group.metadata
          ? String(group.metadata.description ?? "")
          : null,
      );

      const resolvedImage = extractGroupImage(group.metadata);
      setImageUrl(resolvedImage);

      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.log("[useSongchainGroupMembership] group metadata:", group.metadata);
        // eslint-disable-next-line no-console
        console.log("[useSongchainGroupMembership] resolved imageUrl:", resolvedImage);
      }

      const ops = group.operations;
      const memberFromApi =
        ops && "isMember" in ops ? Boolean(ops.isMember) : false;
      applyMembershipFromApi(memberFromApi, optimisticMemberRef, setIsMember);
      if (memberFromApi) setIsPendingApproval(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load club";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [groupId, canWrite, getSessionClient]);

  loadRef.current = load;

  useEffect(() => {
    void load();
  }, [load]);

  const join = useCallback(async () => {
    if (!groupId) return false;
    if (!canWrite) {
      promptWriteAccess();
      toast.info("Link your Orb account to join the club");
      return false;
    }

    setJoining(true);
    try {
      const client = await getSessionClient();
      const result = await joinGroup(client, { group: evmAddress(groupId) });
      if (result.isErr()) throw new Error(result.error.message);
      toast.success("Join request sent — you will get access once approved");

      void (async () => {
        for (const delayMs of MEMBERSHIP_SYNC_DELAYS_MS) {
          await sleep(delayMs);
          try {
            const pollClient = await getSessionClient();
            const groupResult = await fetchGroup(pollClient, {
              group: evmAddress(groupId),
            });
            if (groupResult.isErr() || !groupResult.value) continue;

            const ops = groupResult.value.operations;
            const memberFromApi =
              ops && "isMember" in ops ? Boolean(ops.isMember) : false;
            if (memberFromApi) {
              optimisticMemberRef.current = false;
              setIsMember(true);
              setIsPendingApproval(false);
              toast.success("You are now a member — you can post and react");
              await loadRef.current?.();
              return;
            }
          } catch {
            // Indexer may still be behind; keep polling.
          }
        }
        setIsPendingApproval(true);
      })();

      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not join club");
      return false;
    } finally {
      setJoining(false);
    }
  }, [groupId, canWrite, getSessionClient, promptWriteAccess]);

  const leave = useCallback(async () => {
    if (!groupId) return false;
    if (!canWrite) {
      promptWriteAccess();
      toast.info("Link your Orb account to leave the club");
      return false;
    }

    setLeaving(true);
    try {
      const client = await getSessionClient();
      const result = await leaveGroup(client, { group: evmAddress(groupId) });
      if (result.isErr()) throw new Error(result.error.message);
      toast.success("Left club");
      setIsMember(false);
      setIsPendingApproval(false);
      await loadRef.current?.();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not leave club");
      return false;
    } finally {
      setLeaving(false);
    }
  }, [groupId, canWrite, getSessionClient, promptWriteAccess]);

  return {
    groupId,
    name,
    description,
    imageUrl,
    isMember,
    isPendingApproval,
    loading,
    joining,
    leaving,
    error,
    canWrite,
    refresh: load,
    join,
    leave,
  };
}
