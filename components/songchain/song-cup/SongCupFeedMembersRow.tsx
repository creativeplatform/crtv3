"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AnyClient } from "@lens-protocol/client";
import { fetchGroupMembers } from "@lens-protocol/client/actions";
import { evmAddress } from "@lens-protocol/types";
import { createLensClient } from "@/lib/sdk/lens/create-client";
import { useLensOrbWrite } from "@/hooks/useLensOrbWrite";
import { clearStaleOrbSessionIfNeeded } from "@/lib/sdk/orb/session-errors";
import { convertFailingGateway } from "@/lib/utils/image-gateway";
import makeBlockie from "ethereum-blockies-base64";
import { toast } from "sonner";
import { cn } from "@/lib/utils/utils";
import { songCupMuted } from "@/lib/songchain/song-cup/panel-styles";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ClubAffinityCircleGraph } from "@/components/songchain/affinity/ClubAffinityCircleGraph";
import type {
  ClubCircleData,
  ClubCircleMember,
} from "@/components/songchain/affinity/circle-types";
import { Loader2 } from "lucide-react";

type Member = {
  account: string;
  avatarUrl?: string | null;
  handle?: string | null;
  name?: string | null;
  lastActiveAt: number;
  score: number;
};

type SongCupFeedMembersRowProps = {
  groupId: string | null;
  orbClubUrl?: string;
  clubLogoUrl?: string;
  clubLabel?: string;
};

const MAX_AVATARS = 6;
const MAX_CIRCLE_MEMBERS = 24;
const DEFAULT_CLUB_LOGO = "/songchain/button-icons/feed-icon.svg";

/**
 * GraphQL schema supports LAST_ACTIVE; SDK enum currently omits it.
 * Fallback to ACCOUNT_SCORE if the API rejects LAST_ACTIVE.
 */
const ORDER_BY_LAST_ACTIVE = "LAST_ACTIVE" as "ACCOUNT_SCORE";
const ORDER_BY_ACCOUNT_SCORE = "ACCOUNT_SCORE" as const;

function normalizeAvatar(raw: unknown): string | null {
  if (!raw) return null;
  if (typeof raw === "string") return convertFailingGateway(raw);
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const nested =
      typeof obj.uri === "string"
        ? obj.uri
        : typeof obj.url === "string"
          ? obj.url
          : typeof obj.src === "string"
            ? obj.src
            : null;
    return nested ? convertFailingGateway(nested) : null;
  }
  return null;
}

function mapMemberItem(item: {
  account: string | { address?: string; metadata?: unknown; score?: number };
  lastActiveAt?: string | Date | null;
}): Member {
  const account =
    typeof item.account === "string"
      ? item.account
      : item.account?.address ?? "";
  const metadata =
    item.account && typeof item.account === "object"
      ? (item.account as { metadata?: unknown }).metadata
      : null;
  const avatarUrl = normalizeAvatar(
    metadata && typeof metadata === "object"
      ? (metadata as { picture?: unknown; avatar?: unknown }).picture ??
          (metadata as { picture?: unknown; avatar?: unknown }).avatar
      : null,
  );
  const handleRaw =
    metadata && typeof metadata === "object"
      ? (metadata as { username?: unknown; handle?: unknown }).username ??
        (metadata as { username?: unknown; handle?: unknown }).handle
      : null;
  const nameRaw =
    metadata && typeof metadata === "object"
      ? (metadata as { name?: unknown }).name
      : null;
  const handle =
    typeof handleRaw === "string"
      ? handleRaw.replace(/^@/, "").replace(/^lens\//i, "")
      : handleRaw && typeof handleRaw === "object" && "localName" in handleRaw
        ? String((handleRaw as { localName?: string }).localName ?? "")
        : null;
  const lastActiveAt = item.lastActiveAt
    ? new Date(item.lastActiveAt).getTime()
    : 0;
  const score =
    typeof item.account === "object" && typeof item.account?.score === "number"
      ? item.account.score
      : 0;
  return {
    account,
    avatarUrl,
    handle: handle || null,
    name: typeof nameRaw === "string" ? nameRaw : null,
    lastActiveAt: Number.isFinite(lastActiveAt) ? lastActiveAt : 0,
    score,
  };
}

function sortByActivity(members: Member[]): Member[] {
  return [...members].sort((a, b) => {
    if (b.lastActiveAt !== a.lastActiveAt) {
      return b.lastActiveAt - a.lastActiveAt;
    }
    return b.score - a.score;
  });
}

function toCircleMembers(members: Member[]): ClubCircleMember[] {
  const n = members.length;
  return members.map((m, i) => ({
    handle: m.handle || m.account.slice(0, 8) || "member",
    address: m.account || null,
    avatarUrl: m.avatarUrl || (m.account ? makeBlockie(m.account) : null),
    name: m.name ?? null,
    // Most active first → larger nodes in the circle
    count: Math.max(1, n - i),
  }));
}

async function fetchMembersPage(
  client: AnyClient,
  groupId: string,
  pageSize: "TEN" | "FIFTY",
  cursor?: string,
) {
  const base = {
    group: evmAddress(groupId),
    pageSize,
    ...(cursor ? { cursor } : {}),
  };

  const primary = await fetchGroupMembers(client, {
    ...base,
    orderBy: ORDER_BY_LAST_ACTIVE,
  });
  if (primary.isOk()) return primary;

  return fetchGroupMembers(client, {
    ...base,
    orderBy: ORDER_BY_ACCOUNT_SCORE,
  });
}

export function SongCupFeedMembersRow({
  groupId,
  orbClubUrl,
  clubLogoUrl = DEFAULT_CLUB_LOGO,
  clubLabel = "Club",
}: SongCupFeedMembersRowProps) {
  const { canWrite, getSessionClient } = useLensOrbWrite();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [circleMembers, setCircleMembers] = useState<Member[]>([]);
  const [circleLoading, setCircleLoading] = useState(false);
  const [circleSize, setCircleSize] = useState(360);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const getClient = useCallback(async (): Promise<AnyClient> => {
    let client: AnyClient = createLensClient();
    if (canWrite) {
      try {
        client = await getSessionClient();
      } catch (err) {
        clearStaleOrbSessionIfNeeded(err);
        client = createLensClient();
      }
    }
    return client;
  }, [canWrite, getSessionClient]);

  const loadPreviewMembers = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const client = await getClient();
      const result = await fetchMembersPage(client, groupId, "TEN");
      if (result.isOk()) {
        const sorted = sortByActivity(result.value.items.map(mapMemberItem));
        setMembers(sorted.slice(0, MAX_AVATARS));
      } else {
        console.error("Failed to load group members", result.error);
        toast.error("Could not load club members.");
      }
    } catch (err) {
      clearStaleOrbSessionIfNeeded(err);
      console.error("Error loading group members", err);
      toast.error("Could not load club members.");
    } finally {
      setLoading(false);
    }
  }, [groupId, getClient]);

  const loadCircleMembers = useCallback(async () => {
    if (!groupId) return;
    setCircleLoading(true);
    try {
      const client = await getClient();
      const collected: Member[] = [];
      let cursor: string | undefined;
      let pages = 0;

      while (collected.length < MAX_CIRCLE_MEMBERS && pages < 5) {
        const result = await fetchMembersPage(
          client,
          groupId,
          "FIFTY",
          cursor,
        );
        if (result.isErr()) {
          console.error("Failed to load circle members", result.error);
          toast.error("Could not load club members.");
          break;
        }
        for (const item of result.value.items) {
          collected.push(mapMemberItem(item));
          if (collected.length >= MAX_CIRCLE_MEMBERS) break;
        }
        cursor = result.value.pageInfo?.next ?? undefined;
        pages += 1;
        if (!cursor) break;
      }

      setCircleMembers(
        sortByActivity(collected).slice(0, MAX_CIRCLE_MEMBERS),
      );
    } catch (err) {
      clearStaleOrbSessionIfNeeded(err);
      console.error("Error loading circle members", err);
      toast.error("Could not load club members.");
    } finally {
      setCircleLoading(false);
    }
  }, [groupId, getClient]);

  useEffect(() => {
    void loadPreviewMembers();
  }, [loadPreviewMembers]);

  useEffect(() => {
    if (!modalOpen) return;
    void loadCircleMembers();
  }, [modalOpen, loadCircleMembers]);

  useEffect(() => {
    if (!modalOpen) return;
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === "undefined") {
      if (typeof window !== "undefined") {
        setCircleSize(
          Math.min(520, Math.max(260, window.innerWidth - 48)),
        );
      }
      return;
    }

    const update = (width: number) => {
      if (width <= 0) return;
      setCircleSize(Math.min(520, Math.max(260, Math.floor(width))));
    };

    update(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      update(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [modalOpen, circleLoading, circleMembers.length]);

  const circleData: ClubCircleData = useMemo(
    () => ({
      center: {
        label: clubLabel,
        logoUrl: clubLogoUrl,
      },
      members: toCircleMembers(
        circleMembers.length > 0 ? circleMembers : members,
      ),
    }),
    [circleMembers, members, clubLabel, clubLogoUrl],
  );

  const showLabels = circleSize >= 320;

  if (!groupId) return null;

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center">
          {loading && members.length === 0 ? (
            <span className={cn("text-xs", songCupMuted)}>Loading members…</span>
          ) : (
            members.map((member, index) => (
              <div
                key={member.account}
                className="relative -ml-2 first:ml-0 sm:-ml-2.5"
                style={{ zIndex: members.length - index }}
              >
                <img
                  src={member.avatarUrl || makeBlockie(member.account)}
                  alt={member.handle ?? member.account}
                  className="h-10 w-10 rounded-full border-2 border-background object-cover sm:h-[58px] sm:w-[58px] dark:border-black"
                />
              </div>
            ))
          )}
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className={cn(
            "shrink-0 text-[10px] font-semibold uppercase tracking-wide hover:underline",
            songCupMuted,
            "hover:text-fuchsia-600 dark:hover:text-[#fe01dc]",
          )}
        >
          more
        </button>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-[560px] flex-col gap-3 overflow-y-auto p-3 sm:p-5">
          <DialogHeader className="space-y-1.5 text-left">
            <DialogTitle>{clubLabel} members</DialogTitle>
            <DialogDescription>
              Most active members in this club. Hover for details, click to open
              their Orb profile.
            </DialogDescription>
          </DialogHeader>

          <div
            ref={stageRef}
            className="flex w-full min-h-[260px] items-center justify-center"
          >
            {circleLoading && circleMembers.length === 0 ? (
              <div className={cn("flex items-center gap-2 text-sm", songCupMuted)}>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading members…
              </div>
            ) : circleData.members.length === 0 ? (
              <p className={cn("text-sm", songCupMuted)}>No members found yet.</p>
            ) : (
              <ClubAffinityCircleGraph
                data={circleData}
                size={circleSize}
                showLabels={showLabels}
              />
            )}
          </div>

          {orbClubUrl && (
            <DialogFooter className="sm:justify-center">
              <a
                href={orbClubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-fuchsia-600 underline-offset-2 hover:underline dark:text-[#fe01dc]"
              >
                Open club on Orb
              </a>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
