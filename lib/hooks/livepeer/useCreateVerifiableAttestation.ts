"use client";

import { useState, useRef, useCallback } from "react";
import { useSignTypedData } from "@/lib/wallet/react";
import { useUniversalAccount } from "@/lib/hooks/accountkit/useUniversalAccount";
import { useSmartAccountClient } from "@/lib/wallet/react";
import {
  VERIFIABLE_VIDEO_DOMAIN,
  VERIFIABLE_VIDEO_TYPES,
  buildVerifiableVideoMessage,
  type VerifiableVideoMessageForApi,
} from "@/lib/livepeer/verifiable-video";
import { logger } from "@/lib/utils/logger";

const ATTESTATION_API = "/api/livepeer/attestation";

type PendingState = {
  messageForApi: VerifiableVideoMessageForApi;
  resolve: (id: string) => void;
  reject: (err: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

export function useCreateVerifiableAttestation() {
  const { address } = useUniversalAccount();
  const { client: smartAccountClient } = useSmartAccountClient({
    type: "MultiOwnerModularAccount",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef<PendingState | null>(null);

  const { signTypedData } = useSignTypedData({
    client: smartAccountClient ?? undefined,
    onSuccess: async (signature: string) => {
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (!pending) {
        logger.error("[VerifiableAttestation] onSuccess but no pending state");
        setIsLoading(false);
        return;
      }
      clearTimeout(pending.timeoutId);
      try {
        const { messageForApi, resolve, reject } = pending;
        const payload = {
          primaryType: "VideoAttestation" as const,
          domain: VERIFIABLE_VIDEO_DOMAIN,
          message: {
            ...messageForApi,
            timestamp: Number(messageForApi.timestamp),
          },
          signature,
        };
        const res = await fetch(ATTESTATION_API, {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          reject(new Error(data?.error ?? "Failed to submit attestation"));
          return;
        }
        const id = data?.id ?? null;
        if (id) resolve(id);
        else reject(new Error("No attestation id in response"));
      } catch (err) {
        pending.reject(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsLoading(false);
      }
    },
    onError: (err: Error) => {
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (pending) {
        clearTimeout(pending.timeoutId);
        pending.reject(err);
      }
      setError(err.message);
      setIsLoading(false);
    },
  });

  const createAttestation = useCallback(
    (ipfsCid: string): Promise<string> => {
      setError(null);
      if (!address) {
        const err = new Error("Wallet not connected");
        setError(err.message);
        return Promise.reject(err);
      }
      const creatorAddress = address as `0x${string}`;
      const { message, messageForApi } = buildVerifiableVideoMessage(
        ipfsCid,
        creatorAddress
      );
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          if (pendingRef.current?.messageForApi === messageForApi) {
            pendingRef.current = null;
            reject(new Error("Signing timed out – you may have cancelled"));
            setIsLoading(false);
          }
        }, 120000);
        pendingRef.current = { messageForApi, resolve, reject, timeoutId };
        setIsLoading(true);
        signTypedData({
          typedData: {
            domain: VERIFIABLE_VIDEO_DOMAIN,
            types: VERIFIABLE_VIDEO_TYPES,
            primaryType: "Video",
            message,
          },
        });
      });
    },
    [address, signTypedData]
  );

  return {
    createAttestation,
    isLoading,
    error,
    canAttest: !!smartAccountClient && !!address,
  };
}
