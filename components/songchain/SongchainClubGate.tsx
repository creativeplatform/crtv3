"use client";

import Link from "next/link";
import Image from "next/image";
import { Loader2, Lock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { useSongchainGroupMembership } from "@/hooks/useSongchainGroupMembership";

type MembershipState = ReturnType<typeof useSongchainGroupMembership>;

type SongchainClubGateProps = {
  membership: MembershipState;
  title?: string;
  description?: string;
  orbClubUrl?: string;
};

export function SongchainClubGate({
  membership,
  title = "Members-only club feed",
  description = "Join this Orb club on Lens to read and post in the member feed.",
  orbClubUrl,
}: SongchainClubGateProps) {
  const {
    groupId,
    name,
    description: clubDescription,
    imageUrl,
    loading,
    joining,
    isMember,
    canWrite,
    join,
  } = membership;

  if (loading) {
    return (
      <div className="flex justify-center rounded-lg border border-border/60 bg-card py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isMember) return null;

  return (
    <section
      className="rounded-lg border border-violet-500/30 bg-gradient-to-b from-violet-500/10 to-card p-6 sm:p-8"
      aria-labelledby="songchain-club-gate-title"
    >
      <div className="mx-auto flex max-w-lg flex-col items-center text-center">
        {imageUrl ? (
          <div className="mb-4 h-20 w-20 overflow-hidden rounded-full border-2 border-violet-500/30 bg-violet-500/10">
            <Image
              src={imageUrl}
              alt={name ?? "Club"}
              width={80}
              height={80}
              className="h-full w-full object-cover"
              unoptimized
            />
          </div>
        ) : (
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-violet-500/15">
            <Lock className="h-7 w-7 text-violet-300" aria-hidden />
          </div>
        )}
        <h2
          id="songchain-club-gate-title"
          className="text-xl font-bold tracking-tight sm:text-2xl"
        >
          {title}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">{description}</p>

        {name && (
          <p className="mt-4 flex items-center gap-2 text-sm font-medium text-violet-300">
            <Users className="h-4 w-4 shrink-0" aria-hidden />
            {name}
          </p>
        )}
        {clubDescription && (
          <p className="mt-2 text-xs text-muted-foreground sm:text-sm">{clubDescription}</p>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            size="lg"
            disabled={joining || !groupId}
            onClick={() => void join()}
            className="min-w-[10rem]"
          >
            {joining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Join club
          </Button>
          {orbClubUrl && (
            <Button size="lg" variant="outline" asChild>
              <Link href={orbClubUrl} target="_blank" rel="noopener noreferrer">
                Open on Orb
              </Link>
            </Button>
          )}
        </div>

        {!canWrite && (
          <p className="mt-4 text-xs text-muted-foreground sm:text-sm">
            Connect your wallet, sign in with Orb above, and link your Lens profile to join.
          </p>
        )}

        {groupId && (
          <p className="mt-4 text-[10px] text-muted-foreground">
            Club{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[10px]">
              {groupId.slice(0, 10)}…{groupId.slice(-6)}
            </code>
          </p>
        )}
      </div>
    </section>
  );
}
