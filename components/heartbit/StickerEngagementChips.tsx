"use client";

import { useEffect, useMemo, useState } from "react";
import { useHeartBit } from "@/components/heartbit/HeartBitProvider";
import { buildCompositeHash } from "@/lib/sdk/heartbit/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type TipAggregate = {
  stickerTokenId: number | null;
  stickerIpfsHash: string | null;
  name: string;
  seconds: number;
  usdc: number;
  heartBits: number;
};

type StickerEngagementChipsProps = {
  videoId: string;
  videoIpfsHash?: string | null;
  className?: string;
};

export function StickerEngagementChips({
  videoId,
  videoIpfsHash,
  className,
}: StickerEngagementChipsProps) {
  const { getTotalHeartBitByHash } = useHeartBit();
  const [aggregates, setAggregates] = useState<TipAggregate[]>([]);
  const [baseHearts, setBaseHearts] = useState(0);
  const [loading, setLoading] = useState(true);

  const videoHash = videoIpfsHash || `playback:${videoId}`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [tipsRes, stickersRes, base] = await Promise.all([
          fetch(`/api/stickers/tips?videoId=${encodeURIComponent(videoId)}`),
          fetch("/api/stickers/list"),
          getTotalHeartBitByHash({ hash: videoHash }).catch(() => 0),
        ]);
        if (!tipsRes.ok) {
          throw new Error(`Failed to load tips (${tipsRes.status})`);
        }
        if (!stickersRes.ok) {
          throw new Error(`Failed to load stickers (${stickersRes.status})`);
        }
        const tipsJson = await tipsRes.json();
        const stickersJson = await stickersRes.json();
        const tips = (tipsJson.tips ?? []) as Array<{
          sticker_token_id: number | null;
          sticker_ipfs_hash: string | null;
          seconds: number;
          usdc_amount: number;
        }>;
        const stickers = (stickersJson.stickers ?? []) as Array<{
          token_id: number;
          name: string | null;
          ipfs_hash: string;
        }>;

        const bySticker = new Map<string, TipAggregate>();
        for (const tip of tips) {
          // String(null) === "null" (truthy) — only build a key when at least
          // one sticker identifier is actually present.
          const key =
            tip.sticker_ipfs_hash ??
            (tip.sticker_token_id != null
              ? String(tip.sticker_token_id)
              : null);
          if (!key) continue;
          const existing = bySticker.get(key);
          const meta = stickers.find(
            (s) =>
              s.ipfs_hash === tip.sticker_ipfs_hash ||
              s.token_id === tip.sticker_token_id
          );
          if (existing) {
            existing.seconds += tip.seconds || 0;
            existing.usdc += Number(tip.usdc_amount) || 0;
          } else {
            bySticker.set(key, {
              stickerTokenId: tip.sticker_token_id,
              stickerIpfsHash: tip.sticker_ipfs_hash,
              name: meta?.name || `Sticker #${tip.sticker_token_id}`,
              seconds: tip.seconds || 0,
              usdc: Number(tip.usdc_amount) || 0,
              heartBits: 0,
            });
          }
        }

        const withHearts = await Promise.all(
          Array.from(bySticker.values()).map(async (agg) => {
            if (!agg.stickerIpfsHash) return agg;
            const composite = buildCompositeHash(videoHash, agg.stickerIpfsHash);
            const heartBits = await getTotalHeartBitByHash({
              hash: composite,
            }).catch(() => 0);
            return { ...agg, heartBits };
          })
        );

        if (!cancelled) {
          setBaseHearts(base);
          setAggregates(withHearts.sort((a, b) => b.usdc - a.usdc));
        }
      } catch {
        if (!cancelled) {
          setBaseHearts(0);
          setAggregates([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [videoId, videoHash, getTotalHeartBitByHash]);

  const chips = useMemo(() => aggregates, [aggregates]);

  if (loading) {
    return (
      <div className={cn("flex gap-2", className)}>
        <Skeleton className="h-7 w-24 rounded-full" />
        <Skeleton className="h-7 w-28 rounded-full" />
      </div>
    );
  }

  if (!chips.length && baseHearts === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <Badge variant="secondary" className="rounded-full px-3 py-1">
        ♥ {baseHearts}s base
      </Badge>
      {chips.map((c) => (
        <Badge
          key={c.stickerIpfsHash || String(c.stickerTokenId)}
          variant="outline"
          className="rounded-full px-3 py-1 gap-1.5"
        >
          <span>{c.name}</span>
          <span className="text-muted-foreground">
            {c.heartBits || c.seconds}s · ${c.usdc.toFixed(2)}
          </span>
        </Badge>
      ))}
    </div>
  );
}
