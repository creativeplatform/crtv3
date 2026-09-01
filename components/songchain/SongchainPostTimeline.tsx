"use client";

import React, { useRef, useEffect, type ReactNode, Children } from "react";
import { motion, animate, useMotionValue } from "framer-motion";
import { cn } from "@/lib/utils/utils";

type SongchainPostTimelineProps = {
  children: ReactNode;
  className?: string;
  /** Enables a contained, scroll-driven animation where posts scale/opacity change near the center. */
  animated?: boolean;
};

function AnimatedItem({
  children,
  containerRef,
}: {
  children: ReactNode;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const scale = useMotionValue(0.94);
  const opacity = useMotionValue(0.65);
  const closenessRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    const item = ref.current;
    if (!container || !item) return;

    let rafId: number | null = null;
    let isDirty = false;

    const updateFromRects = () => {
      isDirty = false;
      const containerRect = container.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      const containerCenter = containerRect.top + containerRect.height / 2;
      const itemCenter = itemRect.top + itemRect.height / 2;
      const distance = Math.abs(containerCenter - itemCenter);
      const maxDistance = Math.max(1, containerRect.height / 2);
      const closeness = Math.max(0, 1 - distance / maxDistance);

      if (Math.abs(closeness - closenessRef.current) > 0.001) {
        closenessRef.current = closeness;
        animate(scale, 0.94 + closeness * 0.1, { duration: 0.15, ease: "linear" });
        animate(opacity, 0.65 + closeness * 0.35, { duration: 0.15, ease: "linear" });
      }
    };

    const scheduleUpdate = () => {
      if (isDirty) return;
      isDirty = true;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        updateFromRects();
      });
    };

    // Initial measurement deferred to next frame so container has layout.
    rafId = requestAnimationFrame(updateFromRects);

    container.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate, { passive: true });

    return () => {
      container.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [containerRef, scale, opacity]);

  return (
    <motion.div ref={ref} style={{ scale, opacity }} className="origin-center will-change-transform">
      {children}
    </motion.div>
  );
}

/** Single-column chronological feed with a vertical story line. */
export function SongchainPostTimeline({
  children,
  className,
  animated = false,
}: SongchainPostTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const timelineChildren = animated
    ? Children.toArray(children).map((child, i) => (
        <AnimatedItem key={i} containerRef={containerRef}>
          {child}
        </AnimatedItem>
      ))
    : children;

  const inner = (
    <>
      <div
        className="absolute bottom-0 left-4 top-0 w-px bg-gradient-to-b from-violet-500/40 via-border/60 to-transparent sm:left-6"
        aria-hidden
      />
      <div className="relative space-y-8 pl-10 sm:pl-14">{timelineChildren}</div>
    </>
  );

  if (!animated) {
    return (
      <div className={cn("relative mx-auto w-full max-w-2xl", className)}>
        {inner}
      </div>
    );
  }

  return (
    <div className={cn("relative mx-auto w-full max-w-2xl", className)}>
      <div
        ref={containerRef}
        className="h-[600px] overflow-y-auto overflow-x-hidden rounded-xl border border-border/40 bg-card/20 px-2 py-6 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 [&::-webkit-scrollbar-track]:bg-transparent"
      >
        {inner}
      </div>
    </div>
  );
}

type SongchainPostTimelineItemProps = {
  children: ReactNode;
  className?: string;
  isQuote?: boolean;
};

export function SongchainPostTimelineItem({
  children,
  className,
  isQuote = false,
}: SongchainPostTimelineItemProps) {
  return (
    <div
      className={cn(
        "relative",
        isQuote && "rounded-xl ring-1 ring-violet-500/30 ring-offset-2 ring-offset-background",
        className,
      )}
    >
      <div
        className={cn(
          "absolute -left-10 top-7 h-3 w-3 rounded-full border-2 bg-background sm:-left-14",
          isQuote ? "border-violet-400 bg-violet-500/20" : "border-violet-500",
        )}
        aria-hidden
      />
      {children}
    </div>
  );
}
