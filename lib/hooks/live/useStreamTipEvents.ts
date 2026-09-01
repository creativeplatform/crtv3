"use client";

import { useEffect, useRef } from "react";
import type { RealtimePostgresInsertPayload } from "@supabase/supabase-js";
import { supabase } from "@/lib/sdk/supabase/client";

/** Ledger / HeartBit tip key for a live stream (matches LiveTokenPanel). */
export function streamTipVideoId(streamId: string): string {
  return `stream:${streamId}`;
}

export type StreamTipEvent = {
  id: string;
  video_id: string;
  wallet: string;
  sticker_token_id: number | null;
  sticker_ipfs_hash: string | null;
  seconds: number;
  usdc_amount: number;
  tx_hash: string | null;
  created_at: string;
};

type StickerTipInsertRow = {
  id: string;
  video_id: string;
  wallet: string;
  sticker_token_id: number | null;
  sticker_ipfs_hash: string | null;
  seconds: number;
  usdc_amount: number | string;
  tx_hash: string | null;
  created_at: string;
};

function mapRow(row: StickerTipInsertRow): StreamTipEvent {
  return {
    id: row.id,
    video_id: row.video_id,
    wallet: row.wallet,
    sticker_token_id: row.sticker_token_id,
    sticker_ipfs_hash: row.sticker_ipfs_hash,
    seconds: Number(row.seconds) || 0,
    usdc_amount: Number(row.usdc_amount) || 0,
    tx_hash: row.tx_hash,
    created_at: row.created_at,
  };
}

/**
 * Subscribe to new tip ledger rows for a live stream (`video_id = stream:{id}`).
 * Uses Supabase Realtime postgres_changes on `sticker_tips`.
 */
export function useStreamTipEvents(
  streamId: string | null | undefined,
  onTip: (tip: StreamTipEvent) => void,
  enabled = true
): void {
  const onTipRef = useRef(onTip);
  onTipRef.current = onTip;

  useEffect(() => {
    if (!enabled || !streamId) return;

    const videoId = streamTipVideoId(streamId);
    const channel = supabase
      .channel(`sticker-tips:${videoId}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "sticker_tips",
          filter: `video_id=eq.${videoId}`,
        },
        (payload: RealtimePostgresInsertPayload<StickerTipInsertRow>) => {
          if (!payload.new) return;
          onTipRef.current(mapRow(payload.new));
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [streamId, enabled]);
}
