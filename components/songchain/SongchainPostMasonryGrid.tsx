"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils/utils";

type SongchainPostMasonryGridProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Masonry-style post grid using CSS columns so cards keep natural height.
 */
export function SongchainPostMasonryGrid({
  children,
  className,
}: SongchainPostMasonryGridProps) {
  return (
    <div className={cn("columns-1 gap-6 sm:columns-2 lg:columns-3", className)}>
      {children}
    </div>
  );
}

type SongchainPostMasonryItemProps = {
  children: ReactNode;
  className?: string;
};

export function SongchainPostMasonryItem({
  children,
  className,
}: SongchainPostMasonryItemProps) {
  return (
    <div className={cn("mb-6 break-inside-avoid-column", className)}>{children}</div>
  );
}
