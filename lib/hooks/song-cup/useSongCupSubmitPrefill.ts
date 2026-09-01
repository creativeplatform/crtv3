"use client";

import { useEffect, useState } from "react";
import { fetchAccount } from "@lens-protocol/client/actions";
import { evmAddress } from "@lens-protocol/client";
import { useUser } from "@/lib/wallet/react";
import { useOrbSession } from "@/lib/hooks/orb/useOrbSession";
import { useCreatorProfile } from "@/lib/hooks/metokens/useCreatorProfile";
import { createLensClient } from "@/lib/sdk/lens/create-client";
import { logger } from "@/lib/utils/logger";

export type SongCupSubmitPrefill = {
  email: string;
  artistHandle: string;
  emailFromAuth: boolean;
  handleFromAuth: boolean;
  isLoadingHandle: boolean;
  setEmail: (value: string) => void;
  setArtistHandle: (value: string) => void;
};

function normalizeHandle(value: string | null | undefined): string {
  if (!value?.trim()) return "";
  const trimmed = value.trim().replace(/^@+/, "");
  return trimmed ? `@${trimmed}` : "";
}

export function useSongCupSubmitPrefill(): SongCupSubmitPrefill {
  const user = useUser();
  const { lensAccount, linkStatus } = useOrbSession();
  const { profile } = useCreatorProfile(user?.address);

  const [email, setEmail] = useState("");
  const [artistHandle, setArtistHandle] = useState("");
  const [emailFromAuth, setEmailFromAuth] = useState(false);
  const [handleFromAuth, setHandleFromAuth] = useState(false);
  const [isLoadingHandle, setIsLoadingHandle] = useState(false);

  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
      setEmailFromAuth(true);
    }
  }, [user?.email]);

  useEffect(() => {
    if (linkStatus !== "linked" || !lensAccount) {
      const fallback = normalizeHandle(profile?.lens_handle);
      if (fallback) {
        setArtistHandle(fallback);
        setHandleFromAuth(false);
      }
      return;
    }

    let cancelled = false;
    setIsLoadingHandle(true);

    void (async () => {
      try {
        const client = createLensClient();
        const result = await fetchAccount(client, { address: evmAddress(lensAccount) });
        if (cancelled) return;

        const localName = result.isOk() ? result.value?.username?.localName : null;
        const fromLens = normalizeHandle(localName);
        const fromProfile = normalizeHandle(profile?.lens_handle);
        const resolved = fromLens || fromProfile;

        if (resolved) {
          setArtistHandle(resolved);
          setHandleFromAuth(Boolean(fromLens));
        }
      } catch (err) {
        logger.error("[useSongCupSubmitPrefill] Lens handle fetch failed:", err);
        const fallback = normalizeHandle(profile?.lens_handle);
        if (!cancelled && fallback) {
          setArtistHandle(fallback);
          setHandleFromAuth(false);
        }
      } finally {
        if (!cancelled) setIsLoadingHandle(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [lensAccount, linkStatus, profile?.lens_handle]);

  return {
    email,
    artistHandle,
    emailFromAuth,
    handleFromAuth,
    isLoadingHandle,
    setEmail,
    setArtistHandle,
  };
}
