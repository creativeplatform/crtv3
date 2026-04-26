"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { useInterval } from "@/lib/hooks/useInterval";

interface LivestreamThumbnailProps {
  thumbnailUrl: string;
  priority?: boolean;
}

export function LivestreamThumbnail({ thumbnailUrl, priority = false }: LivestreamThumbnailProps) {
  const [refreshValue, setRefreshValue] = useState(Date.now());
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Only refresh when component is visible in viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Only refresh when visible and tab is active (30s interval instead of 5s)
  const shouldRefresh = isVisible && typeof document !== "undefined" && document.visibilityState === "visible";

  useInterval(
    useCallback(() => setRefreshValue(Date.now()), []),
    shouldRefresh ? 30000 : null
  );

  if (!thumbnailUrl) return null;

  return (
    <div ref={containerRef}>
      <Image
        src={`${thumbnailUrl}?refresh=${refreshValue}`}
        alt="Live stream thumbnail"
        className="w-full h-auto rounded-md"
        loading={priority ? "eager" : "lazy"}
        priority={priority}
        width={320}
        height={180}
      />
    </div>
  );
}
