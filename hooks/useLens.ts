"use client";

import { useState, useCallback, useEffect } from "react";
import { useSmartAccountClient, useUser } from "@account-kit/react";
import { signLensChallenge } from "@/lib/sdk/lens/account-kit-adapter";
import { publicClient } from "@/lib/sdk/lens/client";
import { useOrbSession } from "@/context/OrbSessionContext";
import { video, MediaVideoMimeType, MetadataLicenseType } from "@lens-protocol/metadata";
import { groveService } from "@/lib/sdk/grove/service";
import { post } from "@lens-protocol/client/actions";
import { uri, SessionClient } from "@lens-protocol/client";
import { WalletClient } from "viem";
import { toast } from "sonner";

export interface CreatePostParams {
  content: string;
  mediaUrl: string;
  title?: string;
  coverUrl?: string;
  mimeType?: MediaVideoMimeType;
}

export interface UseLensReturn {
  isLoggedIn: boolean;
  isPosting: boolean;
  login: () => Promise<void>;
  createPost: (params: CreatePostParams) => Promise<string | undefined>;
}

export function useLens(): UseLensReturn {
  const [sessionClient, setSessionClient] = useState<SessionClient | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const { client } = useSmartAccountClient({
    accountParams: { mode: "7702" },
  });
  const user = useUser();
  const accountAddress = user?.address;
  const orb = useOrbSession();
  const hydrateSessionClientFromWallet = useCallback(async (): Promise<SessionClient | null> => {
    if (!client || !accountAddress) {
      toast.error("Please connect your wallet first.");
      return null;
    }

    const challengeResult = await publicClient.challenge({
      onboardingUser: { wallet: accountAddress },
    });

    if (challengeResult.isErr()) {
      throw new Error(challengeResult.error.message);
    }

    const { id, text } = challengeResult.value;
    const signature = await signLensChallenge(
      client as unknown as WalletClient,
      accountAddress,
      text,
    );

    const authResult = await publicClient.authenticate({ id, signature });
    if (authResult.isErr()) {
      throw new Error(authResult.error.message);
    }

    const session = authResult.value;
    setSessionClient(session);
    return session;
  }, [client, accountAddress]);

  const login = useCallback(async () => {
    if (orb.isAuthenticated && orb.session?.accessToken) {
      try {
        const synced = await orb.syncSession();
        if (synced?.accessToken) {
          toast.success("Lens session synced via Orb");
          if (accountAddress) {
            await orb.linkProfile(accountAddress);
          }
          return;
        }
      } catch (err) {
        console.error("Orb Lens sync failed:", err);
      }
    }

    orb.openLoginModal();
  }, [orb, accountAddress]);

  useEffect(() => {
    if (!orb.session?.accessToken) return;
    orb.syncSession().catch(() => undefined);
  }, [orb.session?.accessToken, orb.syncSession]);

  const createPost = useCallback(
    async ({
      content,
      mediaUrl,
      title = "Creative TV Video",
      coverUrl,
      mimeType = MediaVideoMimeType.MP4,
    }: CreatePostParams) => {
      let activeClient = sessionClient;
      if (!activeClient) {
        activeClient = await hydrateSessionClientFromWallet();
        if (!activeClient) {
          if (orb.isAuthenticated) {
            toast.error(
              "Connect your smart wallet to post on Lens, or complete Orb sign-in.",
            );
            orb.openLoginModal();
          }
          return;
        }
      }

      setIsPosting(true);
      try {
        const metadata = video({
          title,
          content,
          video: {
            item: mediaUrl,
            type: mimeType,
            cover: coverUrl,
            license: MetadataLicenseType.CCO,
          },
          locale: "en",
        });

        const uploadResult = await groveService.uploadJson(metadata);
        if (!uploadResult.success || !uploadResult.url) {
          throw new Error("Failed to upload post metadata to Grove");
        }

        const result = await post(activeClient, {
          contentUri: uri(uploadResult.url),
        });

        if (result.isErr()) {
          throw new Error(result.error.message);
        }

        toast.success("Post submitted to Lens!");
        return "posted";
      } catch (err: unknown) {
        console.error("Lens Post Error:", err);
        toast.error(
          `Posting failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      } finally {
        setIsPosting(false);
      }
    },
    [sessionClient, hydrateSessionClientFromWallet, orb],
  );

  const isLoggedIn =
    !!sessionClient || (orb.isAuthenticated && !!orb.session?.accessToken);

  return {
    isLoggedIn,
    isPosting,
    login,
    createPost,
  };
}
