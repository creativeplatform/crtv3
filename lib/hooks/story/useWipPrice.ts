"use client";

import { useState, useEffect, useCallback } from "react";

export interface WipPriceResult {
  price: number | null;
  loading: boolean;
  error: string | null;
}

/**
 * Fetch the current WIP (Wrapped IP) price in USD for the license fee helper.
 * Used by the upload flow to show creators the USD equivalent of their
 * Story Protocol license minting fee.
 */
export function useWipPrice(): WipPriceResult {
  const [price, setPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrice = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/story/wip-price");
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "Failed to fetch WIP price");
        return;
      }
      setPrice(typeof data.price === "number" ? data.price : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch WIP price");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrice();
  }, [fetchPrice]);

  return { price, loading, error };
}
