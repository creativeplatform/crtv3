"use client";

import { useEffect, useState } from "react";
import { isAddress } from "viem";
import { hasValidBrandPass } from "@/lib/access/creator-membership";

type MembershipApiItem = {
  name?: string;
  address?: string;
  isValid?: boolean;
};

type MembershipApiResponse = {
  memberships?: MembershipApiItem[];
  error?: string;
};

export type AddressMembershipStatus = {
  hasMembership: boolean;
  /** Valid Creative Brand Pass (or legacy Brand Plus). */
  hasBrandMembership: boolean;
};

const EMPTY_STATUS: AddressMembershipStatus = {
  hasMembership: false,
  hasBrandMembership: false,
};

const cache = new Map<string, AddressMembershipStatus>();
const inflight = new Map<string, Promise<AddressMembershipStatus>>();

function summarizeMemberships(
  memberships: MembershipApiItem[] | undefined,
): AddressMembershipStatus {
  const normalized =
    memberships
      ?.filter(
        (m): m is MembershipApiItem & { address: string; isValid: boolean } =>
          typeof m.address === "string" &&
          m.address.length > 0 &&
          typeof m.isValid === "boolean",
      )
      .map((m) => ({ address: m.address, isValid: m.isValid })) ?? [];
  const hasMembership = normalized.some((m) => m.isValid);
  const hasBrandMembership = hasValidBrandPass(normalized);
  return {
    hasMembership,
    hasBrandMembership,
  };
}

async function fetchMembershipStatus(
  address: string,
): Promise<AddressMembershipStatus> {
  const key = address.toLowerCase();
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const res = await fetch("/api/membership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: key }),
      });
      if (!res.ok) {
        cache.set(key, EMPTY_STATUS);
        return EMPTY_STATUS;
      }
      const data = (await res.json()) as MembershipApiResponse;
      const status = summarizeMemberships(data.memberships);
      cache.set(key, status);
      return status;
    } catch {
      cache.set(key, EMPTY_STATUS);
      return EMPTY_STATUS;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

/**
 * Whether `address` holds a valid Unlock Creative membership (any lock),
 * and whether Brand Pass specifically is held (gold badge).
 * Results are cached in-memory for the session.
 */
export function useAddressHasMembership(address?: string | null) {
  const normalized =
    address && isAddress(address) ? address.toLowerCase() : null;
  const [status, setStatus] = useState<AddressMembershipStatus>(() =>
    normalized ? (cache.get(normalized) ?? EMPTY_STATUS) : EMPTY_STATUS,
  );
  const [isLoading, setIsLoading] = useState(() =>
    normalized ? !cache.has(normalized) : false,
  );

  useEffect(() => {
    if (!normalized) {
      setStatus(EMPTY_STATUS);
      setIsLoading(false);
      return;
    }

    if (cache.has(normalized)) {
      setStatus(cache.get(normalized) ?? EMPTY_STATUS);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    void fetchMembershipStatus(normalized).then((value) => {
      if (cancelled) return;
      setStatus(value);
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [normalized]);

  return {
    hasMembership: status.hasMembership,
    hasBrandMembership: status.hasBrandMembership,
    isLoading,
  };
}
